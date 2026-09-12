#!/usr/bin/env python3
"""Builds the page in three flavours from shell.html + src/*.js (standard library only; node is optional):
  dist/prescreen.html       the claude.ai artifact (pdf.js from cdnjs, the artifact runtime provides Claude)
  dist/prescreen-demo.html  same page, titled for the public demo variant
  web/index.html            the local build served by server.py (local pdf.js, runtime shim to the server)
  prescreen.html, prescreen-demo.html (repo root, gitignored): publish copies of the two artifact flavours
Also writes web/fixture.json (the reference pre-review, used by the server's mock backend; needs node,
skipped with a notice otherwise) and copies the vendor files and the shim into web/.
"""
import os, re, shutil, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ORDER = ["util.js","extract.js","rules.js","engine.js","prompts.js","review.js","store.js","pdfout.js","pdfedit.js","fix.js","exports.js","notify.js","calibration.js","fixture.js","sample_deck.js","ask.js","learn.js","ui.js","boot.js"]
shell = open(os.path.join(HERE, "shell.html"), encoding="utf-8").read()
parts = []
for f in ORDER:
    fp = os.path.join(HERE, "src", f)
    if os.path.exists(fp):
        parts.append("/* ===== %s ===== */\n" % f + open(fp, encoding="utf-8").read())
js = "\n".join(parts)
assert "</script" not in js.replace("<\\/script", ""), "a </script> inside the bundle would end the tag"
os.makedirs(os.path.join(HERE, "dist"), exist_ok=True)
os.makedirs(os.path.join(HERE, "web", "vendor"), exist_ok=True)

def jpeg_size(data):
    """Width and height from the JPEG's SOF marker (no imaging library needed)."""
    i = 2
    while i + 9 < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        seg = (data[i + 2] << 8) | data[i + 3]
        if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
            return ((data[i + 7] << 8) | data[i + 8]), ((data[i + 5] << 8) | data[i + 6])
        i += 2 + seg
    raise ValueError("not a JPEG")


# official logo, when the file is present (brand/logo.svg or brand/logo.png), inlined as a data URI
brand_tag = ""
import base64
for name, mime in (("logo.svg", "image/svg+xml"), ("logo.png", "image/png")):
    fp = os.path.join(HERE, "brand", name)
    if os.path.exists(fp):
        data = base64.b64encode(open(fp, "rb").read()).decode("ascii")
        brand_tag = '<script>window.FINALIS_LOGO = "data:%s;base64,%s";' % (mime, data)
        for extra, var, emime in (("logo-dark.png", "FINALIS_LOGO_DARK", "image/png"),):
            fx = os.path.join(HERE, "brand", extra)
            if os.path.exists(fx):
                brand_tag += 'window.%s = "data:%s;base64,%s";' % (var, emime, base64.b64encode(open(fx, "rb").read()).decode("ascii"))
        fj = os.path.join(HERE, "brand", "logo.jpg")
        if os.path.exists(fj):
            w, h = jpeg_size(open(fj, "rb").read())
            brand_tag += 'window.FINALIS_LOGO_JPG = {"w": %d, "h": %d, "b64": "%s"};' % (w, h, base64.b64encode(open(fj, "rb").read()).decode("ascii"))
        brand_tag += '</script>\n'
        print("brand logo inlined from brand/%s" % name)
        break

# artifact flavour
art = shell.replace("<!--RUNTIME-->", brand_tag).replace("__PDFJS__", "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js").replace("/*SCRIPTS*/", js)
open(os.path.join(HERE, "dist", "prescreen.html"), "w", encoding="utf-8").write(art)
demo = art.replace("<title>Finalis Prescreen</title>", "<title>Finalis Prescreen Demo</title>", 1).replace(
    '<b>AI Prescreen</b></span></div>', '<b>AI Prescreen</b></span><span class="demo-note">· public demo, inbox stays in this browser</span></div>', 1)
open(os.path.join(HERE, "dist", "prescreen-demo.html"), "w", encoding="utf-8").write(demo)
# publish copies (the artifact URLs are bound to these two paths)
open(os.path.join(HERE, "prescreen.html"), "w", encoding="utf-8").write(art)
open(os.path.join(HERE, "prescreen-demo.html"), "w", encoding="utf-8").write(demo)

# local flavour (a complete document: nothing wraps it)
runtime = brand_tag + '<script>window.PDFJS_WORKER_SRC = "/vendor/pdf.worker.min.js";</script>\n<script src="/runtime-shim.js"></script>'
local = shell.replace("<!--RUNTIME-->", runtime).replace("__PDFJS__", "/vendor/pdf.min.js").replace("/*SCRIPTS*/", js)
local = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' + local.split("<style>")[0] + "<style>\nbody{margin:0}\n</style>\n<style>" + local.split("<style>", 1)[1].split("</style>", 1)[0] + "</style>\n</head>\n<body>\n" + local.split("</style>", 1)[1] + "\n</body>\n</html>\n")
if not os.environ.get("NO_WEB"): open(os.path.join(HERE, "web", "index.html"), "w", encoding="utf-8").write(local)  # NO_WEB=1 keeps a served build untouched
shutil.copy(os.path.join(HERE, "src", "shim.js"), os.path.join(HERE, "web", "runtime-shim.js"))
for v in ("pdf.min.js", "pdf.worker.min.js", "PDFJS-LICENSE.txt"):
    src = os.path.join(HERE, "vendor", v)
    if os.path.exists(src):
        shutil.copy(src, os.path.join(HERE, "web", "vendor", v))

# fixture.json for the mock backend (evaluated with node from the same sources)
try:
    node_src = "\n".join(open(os.path.join(HERE, "src", f), encoding="utf-8").read() for f in ("util.js", "rules.js"))
    node_src += "\nconst Review={assemble:()=>({})};const Engine={};\n" + open(os.path.join(HERE, "src", "fixture.js"), encoding="utf-8").read()
    node_src += "\nprocess.stdout.write(JSON.stringify({profile: Fixture.profile, batch: Fixture.batch}));"
    out = subprocess.run(["node", "-e", node_src], capture_output=True, text=True, check=True).stdout
    open(os.path.join(HERE, "web", "fixture.json"), "w", encoding="utf-8").write(out)
except Exception as e:  # noqa: BLE001
    print("fixture.json not written:", e)
print("built dist/prescreen.html (%d bytes), dist/prescreen-demo.html, web/index.html (%d bytes)" % (len(art), len(local)))
