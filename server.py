#!/usr/bin/env python3
"""Finalis AI Prescreen local server. Standard library only: no pip install needed.

Serves the page (web/), the runtime the page expects (Claude calls, a JSON document store, asset
storage), and the learning state on disk (data/).

    python3 server.py                                           # picks the backend for you (see below)
    ANTHROPIC_API_KEY=sk-ant-... python3 server.py              # force the Anthropic API (adds page images)
    PRESCREEN_BACKEND=cli python3 server.py                     # force the `claude` CLI (your Claude Code login)
    PRESCREEN_MOCK=1 python3 server.py                          # no model at all: replays the reference pre-review

Backend chosen automatically: the Anthropic API when ANTHROPIC_API_KEY is set, otherwise the `claude`
CLI when it is on PATH (the model calls then run under your own Claude Code login and are billed to
your Claude account, no API key needed), otherwise the mock so the page still opens.

Then open http://127.0.0.1:8787/ . Everything the desk learns lives in data/db.json (export it from
the Learning view, or back the file up).
"""
import base64
import secrets
import hmac
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
import urllib.error
import uuid
from http import HTTPStatus
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, unquote

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HERE, "web")


def _load_dotenv(path):
    """KEY=value lines from .env next to this script; the process environment wins. Standard library only."""
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val


if "--help" in sys.argv or "-h" in sys.argv:
    print(__doc__)
    sys.exit(0)
_load_dotenv(os.path.join(HERE, ".env"))
DATA = os.path.abspath(os.environ.get("PRESCREEN_DATA", os.path.join(HERE, "data")))
ASSETS = os.path.join(DATA, "assets")
DB_PATH = os.path.join(DATA, "db.json")
os.makedirs(ASSETS, exist_ok=True)
PASSCODE = os.environ.get("PRESCREEN_PASSCODE", "")
LOCAL_ONLY = os.environ.get("PRESCREEN_LOCAL_ONLY", "1") == "1"
PUBLIC_HOST = os.environ.get("PRESCREEN_PUBLIC_HOST", "")  # host:port the team reaches a shared install on
ASSET_TYPES = {"application/pdf", "image/png", "image/jpeg", "image/webp"}

PORT = int(os.environ.get("PRESCREEN_PORT", "8787"))
API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
CLAUDE_EXE = shutil.which("claude")
BACKEND = os.environ.get("PRESCREEN_BACKEND", "") or ("api" if API_KEY else ("cli" if CLAUDE_EXE else "mock"))
if os.environ.get("PRESCREEN_MOCK"):
    BACKEND = "mock"
MODELS = {
    "complex": os.environ.get("MODEL_COMPLEX", "claude-opus-5"),
    "default": os.environ.get("MODEL_DEFAULT", "claude-sonnet-5"),
    "quick": os.environ.get("MODEL_QUICK", "claude-haiku-4-5-20251001"),
}
MAX_TOKENS = {"complex": 16000, "default": 12000, "quick": 2000}
ANTHROPIC_URL = os.environ.get("ANTHROPIC_BASE_URL", "https://api.anthropic.com") + "/v1/messages"

# ----------------------------------------------------------------------------- document store
_lock = threading.RLock()
_LOGIN_FAILS = {}  # client ip -> timestamps of wrong passcodes
_SESSIONS = {}  # token -> {"role", "email", "name", "at"}; only used when PRESCREEN_PASSCODE is set
SESSION_COOKIE = "prescreen_session"
SESSION_TTL = 12 * 3600
REVIEWER_COLLECTIONS = ("submissions", "calibration")
REVIEWER_PREFIXES = ("calibration/", "learning/", "settings/")
BANKER_COLLECTIONS = ("submissions", "settings")


def _owner(doc):
    """The e-mail a submission was submitted with, lower-cased; '' when the document does not say."""
    d = doc.get("data") if isinstance(doc, dict) and isinstance(doc.get("data"), dict) else doc
    sb = d.get("submitted_by") if isinstance(d, dict) else None
    return str(sb.get("email") or "").lower() if isinstance(sb, dict) else ""


class StoreError(Exception):
    """The document store on disk cannot be read; nothing is written until it is repaired."""


def _load_db():
    if not os.path.exists(DB_PATH):
        return {}
    with open(DB_PATH, "r", encoding="utf-8") as f:
        try:
            db = json.load(f)
        except json.JSONDecodeError as e:
            bak = DB_PATH + ".corrupt-" + time.strftime("%Y%m%d%H%M%S", time.gmtime())
            if not os.path.exists(bak):
                shutil.copy(DB_PATH, bak)
            raise StoreError("data/db.json is not valid JSON (%s); a copy was kept as %s" % (e, os.path.basename(bak)))
    if not isinstance(db, dict):
        raise StoreError("data/db.json does not hold an object")
    return db


def _save_db(db):
    tmp = DB_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False)
    os.replace(tmp, DB_PATH)


def db_get(path):
    with _lock:
        db = _load_db()
        return db.get(path)


def db_put(path, data, merge=False):
    with _lock:
        db = _load_db()
        if merge and isinstance(db.get(path), dict):
            cur = db[path]
            for k, v in data.items():
                if isinstance(v, dict) and isinstance(cur.get(k), dict):
                    cur[k] = {**cur[k], **v}
                else:
                    cur[k] = v
            db[path] = cur
        else:
            db[path] = data
        _save_db(db)


def db_delete(path):
    with _lock:
        db = _load_db()
        db.pop(path, None)
        _save_db(db)


def _match(value, op, ref):
    try:
        if op in ("==", "eq"):
            return value == ref
        if op in ("!=", "ne"):
            return value != ref
        if op in ("<", "lt"):
            return value < ref
        if op in ("<=", "lte"):
            return value <= ref
        if op in (">", "gt"):
            return value > ref
        if op in (">=", "gte"):
            return value >= ref
        if op == "in":
            return value in (ref or [])
        if op == "not-in":
            return value not in (ref or [])
        if op == "array-contains":
            return isinstance(value, list) and ref in value
    except TypeError:
        return False
    return False


def db_query(collection, where, order_by, direction, limit):
    with _lock:
        db = _load_db()
    prefix = collection.rstrip("/") + "/"
    docs = []
    for path, data in db.items():
        if not path.startswith(prefix):
            continue
        rest = path[len(prefix):]
        if "/" in rest:
            continue
        if not isinstance(data, dict):
            continue  # a document that is not an object is never a query result
        ok = True
        for clause in where or []:
            if len(clause) != 3 or not _match(data.get(clause[0]), clause[1], clause[2]):
                ok = False
                break
        if ok:
            docs.append({"id": rest, "data": data})
    if order_by:
        docs.sort(key=lambda d: (d["data"].get(order_by) is None, str(d["data"].get(order_by, ""))), reverse=(direction == "desc"))
    else:
        docs.sort(key=lambda d: d["id"])
    return docs[: max(1, min(int(limit or 200), 1000))]


# ----------------------------------------------------------------------------- Claude backends
def _parse_json_tolerant(text):
    text = (text or "").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass
    starts = [i for i in (text.find("{"), text.find("[")) if i >= 0]
    if starts:
        s = min(starts)
        e = max(text.rfind("}"), text.rfind("]"))
        if e > s:
            try:
                return json.loads(text[s:e + 1])
            except json.JSONDecodeError:
                pass
    raise ValueError("no JSON value in the answer")


def _messages_from_input(inp, images):
    def content_for(text, imgs):
        parts = [{"type": "text", "text": text}]
        for im in imgs or []:
            parts.insert(0, {"type": "image", "source": {"type": "base64", "media_type": im.get("media_type", "image/jpeg"), "data": im.get("data", "")}})
        return parts
    if isinstance(inp, str):
        return [{"role": "user", "content": content_for(inp, images)}]
    msgs = []
    for i, turn in enumerate(inp or []):
        role = "assistant" if turn.get("role") == "assistant" else "user"
        last = i == len(inp) - 1
        msgs.append({"role": role, "content": content_for(str(turn.get("content", "")), images if last else None)})
    return msgs


def claude_api(inp, tier, images, want_json):
    model = MODELS.get(tier, MODELS["default"])
    body = {
        "model": model,
        "max_tokens": MAX_TOKENS.get(tier, 8000),
        "messages": _messages_from_input(inp, images),
    }
    if want_json:
        body["system"] = "Reply with the JSON value requested and nothing else. No prose before or after it."
    req = urllib.request.Request(ANTHROPIC_URL, data=json.dumps(body).encode("utf-8"), method="POST", headers={
        "x-api-key": API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=600) as res:
            out = json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:500]
        code = "rate_limited" if e.code == 429 else "not_granted" if e.code in (401, 403) else "upstream_error"
        raise RuntimeError(json.dumps({"code": code, "message": "Anthropic API %s: %s" % (e.code, detail)}))
    text = "".join(block.get("text", "") for block in out.get("content", []) if block.get("type") == "text")
    return {"text": text, "truncated": out.get("stop_reason") == "max_tokens", "modelTierApplied": tier, "model": model}


def claude_cli(inp, tier, images, want_json):
    if images:
        # the CLI print mode takes text only; the visual checks are skipped in this backend
        pass
    prompt = inp if isinstance(inp, str) else "\n\n".join(("%s: %s" % (t.get("role", "user"), t.get("content", ""))) for t in inp)
    if want_json:
        prompt += "\n\nReply with the JSON value requested and nothing else."
    exe = shutil.which("claude")
    if not exe:
        raise RuntimeError(json.dumps({"code": "sampling_disabled", "message": "The `claude` CLI is not on PATH and ANTHROPIC_API_KEY is not set. Install Claude Code (npm i -g @anthropic-ai/claude-code), run `claude` once to sign in, then restart this server."}))
    model = MODELS.get(tier, MODELS["default"])
    system = "You are a careful compliance reviewer. Follow the instructions in the message exactly and reply in the format requested, with nothing else."
    # Three attempts, so the same code works on an older CLI and on an account without the preferred model:
    # full flags -> minimal flags (older CLI) -> minimal flags without --model (account default model).
    # The model never gets tools, never keeps a session and never runs more than one turn: the prompt carries
    # document text, banker notes and reviewer comments, none of which may drive actions. Three attempts, so the
    # same code works on an older CLI and on an account without the preferred model: full flags -> without the
    # newer system-prompt flags (older CLI) -> without --model (account default model). The sandbox flags stay.
    sandbox = ["--no-session-persistence", "--tools", "", "--max-turns", "1", "--strict-mcp-config"]
    attempts = [
        [exe, "-p", "--output-format", "json", "--model", model] + sandbox + ["--exclude-dynamic-system-prompt-sections", "--system-prompt", system],
        [exe, "-p", "--output-format", "json", "--model", model] + sandbox,
        [exe, "-p", "--output-format", "json"] + sandbox,
    ]
    cwd = os.path.join(DATA, "cli")
    os.makedirs(cwd, exist_ok=True)
    keep = ("PATH", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "TMP", "TEMP", "TMPDIR", "LANG", "LC_ALL", "SYSTEMROOT", "COMSPEC", "SHELL", "TERM", "HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY", "SSL_CERT_FILE", "NODE_EXTRA_CA_CERTS")
    env = {k: v for k, v in os.environ.items() if k in keep or k.startswith("CLAUDE_")}
    proc = None
    used_attempt = 0
    for i, cmd in enumerate(attempts):
        used_attempt = i
        try:
            proc = subprocess.run(cmd, input=prompt, capture_output=True, text=True, timeout=900, cwd=cwd, env=env)
        except subprocess.TimeoutExpired:
            raise RuntimeError(json.dumps({"code": "upstream_error", "message": "claude CLI timed out"}))
        if proc.returncode == 0:
            break
        err = (proc.stderr or "")[-600:]
        low = err.lower()
        retryable = ("unknown option" in low or "unrecognized" in low or "unknown argument" in low or "did you mean" in low) if i == 0 else ("model" in low and ("not found" in low or "invalid" in low or "access" in low or "not available" in low))
        if not retryable or i == len(attempts) - 1:
            sys.stderr.write("claude CLI failed (attempt %d): %s\n" % (i + 1, err.replace("\n", " ")))
            hint = "See the server log for the CLI's message."
            if "not logged in" in low or "authentication" in low or "unauthorized" in low or "/login" in low:
                hint = "Run `claude` in a terminal and sign in (/login), then try again."
            elif "model" in low:
                hint = "This Claude account may not have access to %s: set MODEL_COMPLEX / MODEL_DEFAULT in .env to a model you can use." % model
            raise RuntimeError(json.dumps({"code": "upstream_error", "message": "claude CLI failed. " + hint}))
    cost = None
    actual = None
    try:
        payload = json.loads(proc.stdout)
        text = payload.get("result") if isinstance(payload, dict) else proc.stdout
        cost = payload.get("total_cost_usd") if isinstance(payload, dict) else None
        if isinstance(payload, dict) and isinstance(payload.get("modelUsage"), dict) and payload["modelUsage"]:
            # the CLI also bills a small helper model (Haiku) for its own housekeeping; report the model that answered
            keys = list(payload["modelUsage"].keys())
            main = [k for k in keys if k == model] or [k for k in keys if "haiku" not in k] or keys
            actual = ", ".join(sorted(main))
        if isinstance(payload, dict) and payload.get("is_error"):
            raise RuntimeError(json.dumps({"code": "upstream_error", "message": str(text)[:300]}))
    except json.JSONDecodeError:
        text = proc.stdout
    # the model that answered, and whether the ladder had to give up the preferred model (results then differ
    # from the calibrated runs; the page shows a warning)
    fallback = used_attempt >= 2
    return {"text": text or "", "truncated": False, "modelTierApplied": tier, "model": actual or ("account default" if fallback else model), "requested": model, "fallback": fallback, "cost_usd": cost}


_FIXTURE = None


def claude_mock(inp, tier, images, want_json):
    global _FIXTURE
    if _FIXTURE is None:
        with open(os.path.join(WEB, "fixture.json"), "r", encoding="utf-8") as f:
            _FIXTURE = json.load(f)
    text = inp if isinstance(inp, str) else " ".join(str(t.get("content", "")) for t in inp)
    time.sleep(0.2)
    if "FIRST pass" in text:
        return {"text": json.dumps(_FIXTURE["profile"]), "truncated": False, "modelTierApplied": tier, "model": "mock"}
    if "senior compliance reviewer checking" in text:
        ids = re.findall(r'"id":\s*"(f\d+)"', text)
        return {"text": json.dumps([{"id": i, "verdict": "keep", "reason": "mock"} for i in ids]), "truncated": False, "modelTierApplied": tier, "model": "mock"}
    if "Write ONE calibration rule" in text:
        return {"text": json.dumps({"rule": "Do not raise this flag when the reviewers rejected the same wording before (mock)."}), "truncated": False, "modelTierApplied": tier, "model": "mock"}
    if "alternative wordings" in text:
        return {"text": json.dumps(["Alternative wording one (mock)", "Alternative wording two (mock)", "Alternative wording three (mock)"]), "truncated": False, "modelTierApplied": tier, "model": "mock"}
    if "Transcribe every piece of text" in text:
        return {"text": json.dumps({"text": "Mock transcription: For institutional investors only. Target net IRR 25%.", "visuals": []}), "truncated": False, "modelTierApplied": tier, "model": "mock"}
    if "You are the pre-review engine" in text:
        return {"text": json.dumps(_FIXTURE["batch"]), "truncated": False, "modelTierApplied": tier, "model": "mock"}
    return {"text": "Mock answer: this point was raised under the rulebook; check the page context and the calibration rules.", "truncated": False, "modelTierApplied": tier, "model": "mock"}


BACKENDS = {"api": claude_api, "cli": claude_cli, "mock": claude_mock}


# ----------------------------------------------------------------------------- HTTP handler
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=WEB, **kw)

    def log_message(self, fmt, *args):
        if os.environ.get("PRESCREEN_QUIET"):
            return
        sys.stderr.write("%s %s\n" % (self.log_date_time_string(), fmt % args))

    _cookie = None

    def _json(self, status, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if self._cookie:
            self.send_header("Set-Cookie", self._cookie)
            self._cookie = None
        self.end_headers()
        self.wfile.write(body)

    def _body(self, max_bytes):
        """The request body, refused before it is read when it is over max_bytes or the length is not a number."""
        raw = self.headers.get("Content-Length") or "0"
        try:
            n = int(raw)
        except ValueError:
            self._json(400, {"code": "invalid_request", "message": "bad Content-Length"})
            return None
        if n < 0 or n > max_bytes:
            self._json(413, {"code": "too_large", "message": "request body over %d bytes" % max_bytes})
            return None
        return self.rfile.read(n) if n else b""

    def _read_json(self, max_bytes):
        raw = self._body(max_bytes)
        if raw is None:
            return None
        try:
            obj = json.loads(raw.decode("utf-8") or "{}")
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._json(400, {"code": "invalid_request", "message": "bad JSON body"})
            return None
        if not isinstance(obj, dict):
            self._json(400, {"code": "invalid_request", "message": "a JSON object is required"})
            return None
        return obj

    def _token(self):
        cookie = self.headers.get("Cookie", "")
        for part in cookie.split(";"):
            k, _, v = part.strip().partition("=")
            if k == SESSION_COOKIE:
                return v
        return ""

    def _session(self):
        if not PASSCODE:
            return {"role": "reviewer", "email": "", "name": "", "open": True}
        with _lock:
            sess = _SESSIONS.get(self._token())
            if sess and time.time() - sess["at"] > SESSION_TTL:
                _SESSIONS.pop(self._token(), None)
                sess = None
        return sess

    def _require(self, role=None):
        """The session for this request, or None after a 401/403 reply. Only enforced when a passcode is set."""
        sess = self._session()
        if not sess:
            self._json(401, {"code": "session_expired", "message": "Sign in to continue"})
            return None
        if role and sess["role"] != role and not sess.get("open"):
            self._json(403, {"code": "not_granted", "message": "This needs the reviewer platform"})
            return None
        return sess

    def _gate(self, mutating):
        """Same-origin gate: the Host must be one this install answers to (no DNS rebinding), a present Origin must
        match it (no cross-site POST), and every mutating request carries the page's own header (no plain
        form/CSRF request can send it). Returns False after replying."""
        host = (self.headers.get("Host") or "").lower()
        allowed = {"127.0.0.1:%d" % PORT, "localhost:%d" % PORT, "[::1]:%d" % PORT}
        if PUBLIC_HOST:
            allowed.add(PUBLIC_HOST.lower())
        if LOCAL_ONLY or PUBLIC_HOST:
            if host not in allowed:
                self._json(421, {"code": "bad_host", "message": "unexpected Host header"})
                return False
        origin = self.headers.get("Origin")
        if origin:
            ohost = urlparse(origin).netloc.lower()
            if ohost != host:
                self._json(403, {"code": "bad_origin", "message": "cross-origin request refused"})
                return False
        if mutating and self.headers.get("X-Prescreen") != "1":
            self._json(403, {"code": "bad_request", "message": "missing X-Prescreen header"})
            return False
        return True

    def do_HEAD(self):
        if not self._gate(False):
            return None
        return super().do_HEAD()

    def list_directory(self, path):
        self._json(404, {"code": "not_found", "message": "no directory listings"})
        return None

    def guess_type(self, path):
        t = super().guess_type(path)
        if t.startswith("text/") or t.endswith("javascript"):
            return t + "; charset=utf-8"
        return t

    # ---- GET
    def do_GET(self):
        try:
            return self._get()
        except StoreError as e:
            return self._json(500, {"code": "store_unreadable", "message": str(e)})

    def _get(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        if not self._gate(False):
            return None
        if u.path == "/" or u.path == "/index.html":
            self.path = "/index.html"
            return super().do_GET()
        if u.path == "/api/health":
            return self._json(200, {"ok": True, "backend": BACKEND, "models": MODELS, "data": os.path.basename(DATA), "passcode": bool(PASSCODE), "signedIn": bool(self._session())})
        if u.path == "/api/limits":
            limits = {"maxPromptBytes": 65536}
            if BACKEND in ("api", "mock"):
                limits["images"] = {"maxCount": 8, "maxInputBytes": 20 * 1024 * 1024, "mediaTypes": ["image/jpeg", "image/png", "image/webp", "image/gif"]}
            return self._json(200, limits)
        if u.path == "/api/db/doc":
            path = unquote(q.get("path", [""])[0]).strip("/")
            sess = self._require("reviewer" if path.startswith(REVIEWER_PREFIXES) and path != "settings/desk" else None)
            if not sess:
                return None
            data = db_get(path)
            if path.startswith("submissions/") and sess["role"] == "banker" and not sess.get("open") and data and _owner(data) != sess["email"]:
                return self._json(403, {"code": "not_granted", "message": "not your submission"})
            return self._json(200, {"exists": data is not None, "data": data})
        if u.path == "/api/db/query":
            col = unquote(q.get("collection", [""])[0]).strip("/")
            sess = self._require()
            if not sess:
                return None
            try:
                where = json.loads(unquote(q.get("where", ["[]"])[0]) or "[]")
                if not isinstance(where, list) or not all(isinstance(c, list) and len(c) == 3 and isinstance(c[0], str) and isinstance(c[1], str) for c in where):
                    raise ValueError("where must be a list of [field, op, value]")
                limit = int(q.get("limit", ["200"])[0])
            except (ValueError, json.JSONDecodeError):
                return self._json(400, {"code": "invalid_argument", "message": "bad query"})
            order_by = q.get("orderBy", [None])[0]
            direction = q.get("dir", ["asc"])[0]
            if sess["role"] == "banker" and not sess.get("open") and col not in BANKER_COLLECTIONS:
                return self._json(403, {"code": "not_granted", "message": "This needs the reviewer platform"})
            docs = db_query(col, where, order_by, direction, limit)
            if col == "submissions" and sess["role"] == "banker" and not sess.get("open"):
                docs = [d for d in docs if _owner(d) == sess["email"]]
            return self._json(200, {"docs": docs})
        if u.path == "/api/assets":
            if not self._require("reviewer"):
                return None
            idx = db_get("assets/index") or {"items": []}
            return self._json(200, {"assets": idx.get("items", []), "usage": {"count": len(idx.get("items", []))}})
        if u.path == "/api/learning/export":
            if not self._require("reviewer"):
                return None
            with _lock:
                db = _load_db()
            verdicts = [v for p, v in db.items() if p.startswith("calibration/")]
            rules = (db.get("learning/rules") or {}).get("rules", [])
            subs = [p for p in db if p.startswith("submissions/")]
            meta = db.get("learning/meta") or {}
            return self._json(200, {"version": 2, "exported_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "verdicts": verdicts, "learned_rules": rules, "meta": meta, "submissions": len(subs)})
        if u.path.startswith("/_blob/"):
            if not self._require("reviewer"):
                return None
            aid = os.path.basename(u.path)
            if not re.fullmatch(r"[0-9a-f]{32}", aid):
                return self._json(404, {"code": "not_found", "message": "no such asset"})
            idx = db_get("assets/index") or {"items": []}
            meta = next((i for i in idx.get("items", []) if isinstance(i, dict) and i.get("id") == aid), None)
            fp = os.path.join(ASSETS, aid)
            if not meta or not os.path.isfile(fp):
                return self._json(404, {"code": "not_found", "message": "no such asset"})
            with open(fp, "rb") as f:
                data = f.read()
            ctype = meta.get("contentType") if meta.get("contentType") in ASSET_TYPES else "application/octet-stream"
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Disposition", "attachment")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)
            return None
        return super().do_GET()

    # ---- POST
    def do_POST(self):
        try:
            return self._post()
        except StoreError as e:
            return self._json(500, {"code": "store_unreadable", "message": str(e)})

    def _post(self):
        u = urlparse(self.path)
        if not self._gate(True):
            return None
        if u.path == "/api/login":
            # Sign-in. Without PRESCREEN_PASSCODE (the demo) this only acknowledges the identity. With it (a team
            # install) the reviewer role needs the passcode (constant-time compare, at most 5 wrong passcodes per
            # minute per client) and every sign-in gets a session cookie that the API then requires.
            req = self._read_json(16 * 1024)
            if req is None:
                return None
            role = "reviewer" if req.get("role") == "reviewer" else "banker"
            email = str(req.get("email", ""))[:200].lower()
            name = str(req.get("name", ""))[:200]
            if PASSCODE and role == "reviewer":
                ip = self.client_address[0]
                now = time.time()
                with _lock:
                    recent = [t for t in _LOGIN_FAILS.get(ip, []) if now - t < 60]
                    _LOGIN_FAILS[ip] = recent
                if len(recent) >= 5:
                    return self._json(429, {"ok": False, "code": "rate_limited", "message": "Too many attempts; wait a minute"})
                if not hmac.compare_digest(str(req.get("passcode", "")), PASSCODE):
                    with _lock:
                        _LOGIN_FAILS[ip] = recent + [now]
                    return self._json(401, {"ok": False, "code": "bad_passcode", "message": "Wrong passcode"})
            if PASSCODE:
                token = secrets.token_urlsafe(32)
                with _lock:
                    now = time.time()
                    for k in [k for k, v in _SESSIONS.items() if now - v["at"] > SESSION_TTL]:
                        _SESSIONS.pop(k, None)
                    _SESSIONS[token] = {"role": role, "email": email, "name": name, "at": now}
                self._cookie = "%s=%s; Path=/; HttpOnly; SameSite=Strict; Max-Age=%d" % (SESSION_COOKIE, token, SESSION_TTL)
            return self._json(200, {"ok": True, "role": role, "session": bool(PASSCODE)})
        if u.path == "/api/logout":
            tok = self._token()
            with _lock:
                _SESSIONS.pop(tok, None)
            self._cookie = "%s=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0" % SESSION_COOKIE
            return self._json(200, {"ok": True})
        if u.path == "/api/sample":
            if not self._require():
                return None
            req = self._read_json(40 * 1024 * 1024)  # text plus up to eight page images
            if req is None:
                return None
            inp = req.get("input")
            if not inp or not (isinstance(inp, str) or (isinstance(inp, list) and all(isinstance(t, dict) for t in inp))):
                return self._json(400, {"code": "invalid_request", "message": "input must be a string or a list of turns"})
            text_len = len(inp.encode("utf-8")) if isinstance(inp, str) else sum(len(str(t.get("content", "")).encode("utf-8")) for t in inp)
            if text_len > 65536 * 3:
                return self._json(400, {"code": "prompt_too_large", "message": "input over the cap"})
            tier = req.get("modelTier") or "default"
            want_json = bool(req.get("json"))
            try:
                out = BACKENDS[BACKEND](inp, tier, req.get("images") or [], want_json)
            except RuntimeError as e:
                try:
                    err = json.loads(str(e))
                except ValueError:
                    err = {"code": "upstream_error", "message": str(e)}
                return self._json(502, err)
            except Exception as e:  # noqa: BLE001
                sys.stderr.write("backend error: %r\n" % (e,))
                return self._json(502, {"code": "upstream_error", "message": "the model call failed; see the server log"})
            if want_json:
                try:
                    out["json"] = _parse_json_tolerant(out.get("text", ""))
                except ValueError:
                    return self._json(422, {"code": "invalid_json", "message": "the answer held no JSON value", "text": out.get("text", "")[:4000]})
            return self._json(200, out)
        if u.path == "/api/assets":
            if not self._require():
                return None
            ctype = self.headers.get("Content-Type", "application/octet-stream").split(";")[0].strip().lower()
            if ctype not in ASSET_TYPES:
                return self._json(415, {"code": "unsupported_type", "message": "PDF, PNG, JPEG or WebP only"})
            name = unquote(self.headers.get("X-File-Name", "file"))[:200]
            data = self._body(20 * 1024 * 1024)
            if data is None:
                return None
            if not data:
                return self._json(400, {"code": "invalid_request", "message": "empty upload"})
            aid = uuid.uuid4().hex
            with open(os.path.join(ASSETS, aid), "wb") as f:
                f.write(data)
            with _lock:
                idx = db_get("assets/index") or {"items": []}
                idx["items"].append({"id": aid, "url": "/_blob/" + aid, "contentType": ctype, "sizeBytes": len(data), "name": name, "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
                db_put("assets/index", idx)
            return self._json(200, {"id": aid, "url": "/_blob/" + aid, "sizeBytes": len(data), "contentType": ctype})
        if u.path == "/api/learning/import":
            if not self._require("reviewer"):
                return None
            obj = self._read_json(8 * 1024 * 1024)
            if obj is None:
                return None
            added = 0
            with _lock:
                db = _load_db()
                for v in obj.get("verdicts", []) if isinstance(obj.get("verdicts"), list) else []:
                    if isinstance(v, dict) and isinstance(v.get("id"), str) and re.fullmatch(r"[\w.-]{1,80}", v["id"]) and ("calibration/" + v["id"]) not in db:
                        db["calibration/" + v["id"]] = v
                        added += 1
                stored = (db.get("learning/rules") or {}).get("rules", [])
                rules = [r for r in stored if isinstance(r, dict)] if isinstance(stored, list) else []
                ids = {r.get("id") for r in rules}
                for r in obj.get("learned_rules", []) if isinstance(obj.get("learned_rules"), list) else []:
                    if not (isinstance(r, dict) and isinstance(r.get("text"), str) and r.get("id") not in ids):
                        continue
                    text = r["text"][:240]
                    # the same guard as the page: an SOP block is never learned away, and text that reads like an
                    # instruction to the model is not a rule
                    if re.match(r"^A\d", str(r.get("rule", "")).upper()) and re.search(r"never_raise|remove|drop|skip", str(r.get("action", "")) + " " + text, re.I):
                        continue
                    if re.search(r"ignore (\w+ ){0,3}(rules|instructions)|system prompt", text, re.I):
                        continue
                    rules.append({**r, "text": text})
                db["learning/rules"] = {"rules": rules, "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
                _save_db(db)
            return self._json(200, {"added": added, "rules": len(rules)})
        return self._json(404, {"code": "not_found", "message": "unknown endpoint"})

    # ---- PUT / DELETE
    def do_PUT(self):
        try:
            return self._put()
        except StoreError as e:
            return self._json(500, {"code": "store_unreadable", "message": str(e)})

    def _put(self):
        u = urlparse(self.path)
        if not self._gate(True):
            return None
        if u.path == "/api/db/doc":
            req = self._read_json(300 * 1024)
            if req is None:
                return None
            path = str(req.get("path", "")).strip("/")
            data = req.get("data")
            if not path or not re.fullmatch(r"[\w.-]+(/[\w.-]+)+", path) or any(seg.strip(".") == "" for seg in path.split("/")) or not isinstance(data, dict):
                return self._json(400, {"code": "invalid_argument", "message": "path and an object body are required"})
            sess = self._require("reviewer" if path.startswith(REVIEWER_PREFIXES) else None)
            if not sess:
                return None
            if path.startswith("submissions/") and sess["role"] == "banker" and not sess.get("open"):
                cur = db_get(path)
                if cur is not None and _owner(cur) != sess["email"]:
                    return self._json(403, {"code": "not_granted", "message": "not your submission"})
            if len(json.dumps(data)) > 256 * 1024:
                return self._json(400, {"code": "invalid_argument", "message": "document over 256 KiB"})
            if req.get("merge") and db_get(path) is None:
                return self._json(400, {"code": "invalid_argument", "message": "update requires an existing document"})
            db_put(path, data, merge=bool(req.get("merge")))
            return self._json(200, {"ok": True})
        return self._json(404, {"code": "not_found", "message": "unknown endpoint"})

    def do_DELETE(self):
        try:
            return self._delete()
        except StoreError as e:
            return self._json(500, {"code": "store_unreadable", "message": str(e)})

    def _delete(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        if not self._gate(True):
            return None
        if not self._require("reviewer"):
            return None
        if u.path == "/api/db/doc":
            db_delete(unquote(q.get("path", [""])[0]).strip("/"))
            return self._json(200, {"ok": True})
        if u.path.startswith("/api/assets/"):
            aid = os.path.basename(u.path)
            if not re.fullmatch(r"[0-9a-f]{32}", aid):
                return self._json(404, {"code": "not_found", "message": "no such asset"})
            fp = os.path.join(ASSETS, aid)
            existed = os.path.exists(fp)
            if existed:
                os.remove(fp)
            with _lock:
                idx = db_get("assets/index") or {"items": []}
                idx["items"] = [i for i in idx["items"] if isinstance(i, dict) and i.get("id") != aid]
                db_put("assets/index", idx)
            return self._json(200, {"deleted": existed})
        return self._json(404, {"code": "not_found", "message": "unknown endpoint"})


BANNER = {
    "api": "Claude through the Anthropic API (ANTHROPIC_API_KEY). Page images are sent for the visual checks.",
    "cli": "Claude through your own Claude Code login (the `claude` CLI). No API key needed; the calls are billed to your Claude account. Text only: no page images.",
    "mock": "No model: the page replays the reference pre-review of the calibration deck. Good for a click-through, not for a real review.",
}


def preflight():
    """Explain, before the first click, exactly how this server will reach Claude."""
    if sys.version_info < (3, 8):
        print("Python 3.8 or newer is required (found %s)." % sys.version.split()[0])
        sys.exit(1)
    backend = BACKEND
    if backend == "api" and not API_KEY:
        print("PRESCREEN_BACKEND=api but ANTHROPIC_API_KEY is empty.")
    if backend == "cli":
        exe = shutil.which("claude")
        if not exe:
            print("The `claude` CLI is not on PATH, so the pre-review cannot call a model.")
            print("  Fix (recommended): npm install -g @anthropic-ai/claude-code, then run `claude` once and sign in.")
            print("  Or put ANTHROPIC_API_KEY=sk-ant-... in a .env file next to this script.")
            print("Starting in mock mode so you can still see the page.")
            backend = "mock"
        else:
            try:
                v = subprocess.run([exe, "--version"], capture_output=True, text=True, timeout=30)
                print("claude CLI: %s (%s)" % ((v.stdout or v.stderr or "").strip().splitlines()[0] if (v.stdout or v.stderr).strip() else "found", exe))
            except Exception:  # noqa: BLE001
                print("claude CLI found at %s (version check skipped)" % exe)
    if backend == "mock" and not os.environ.get("PRESCREEN_MOCK") and os.environ.get("PRESCREEN_BACKEND", "") != "mock":
        print("No ANTHROPIC_API_KEY and no `claude` CLI on PATH: running in mock mode, so the pre-review")
        print("replays the reference result instead of reviewing your document.")
        print("  Fix (recommended): npm install -g @anthropic-ai/claude-code, then run `claude` once and sign in.")
        print("  Or put ANTHROPIC_API_KEY=sk-ant-... in a .env file next to this script.")
    return backend


def main():
    global BACKEND
    BACKEND = preflight()
    print("")
    print("  Finalis AI Prescreen")
    print("  backend : %s" % BACKEND)
    print("            %s" % BANNER.get(BACKEND, ""))
    print("  models  : %s" % ", ".join("%s=%s" % (k, v) for k, v in MODELS.items()))
    print("  data    : %s" % DATA)
    print("  access  : %s%s" % ("this machine only (127.0.0.1)" if LOCAL_ONLY else "the network (0.0.0.0)", "; reviewer platform behind a passcode, sessions on" if PASSCODE else "; no passcode (demo sign-in)"))
    if not LOCAL_ONLY and not PASSCODE:
        print("  WARNING : the server is reachable from the network with no passcode. Set PRESCREEN_PASSCODE (and PRESCREEN_PUBLIC_HOST) in .env.")
    print("")
    print("  Open http://127.0.0.1:%d/  (Ctrl+C to stop)" % PORT)
    print("")
    ThreadingHTTPServer.allow_reuse_address = True
    server = ThreadingHTTPServer(("127.0.0.1" if LOCAL_ONLY else "0.0.0.0", PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
