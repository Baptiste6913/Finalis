#!/usr/bin/env python3
"""Scores sim/results_old.json (the overlay's engine) and sim/results_new.json (this product, real models)
against sim/corpus/truth.json, and the Quartus deck against the reviewer's finding sheet (src/calibration.js,
evaluated with node). Prints the tables and writes sim/scores.json. Usage: python3 sim/score.py"""
import json
import os
import re
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
TRUTH = json.load(open(os.path.join(HERE, "corpus", "truth.json"), encoding="utf-8"))
OLD = json.load(open(os.path.join(HERE, "results_old.json"), encoding="utf-8"))
NEW = json.load(open(os.path.join(HERE, "results_new.json"), encoding="utf-8"))


def pages_of(f):
    out = set(f.get("pages") or [])
    if f.get("page"):
        out.add(f["page"])
    return out


def text_of(f):
    return " ".join(str(f.get(k) or "") for k in ("quote", "excerpt", "title", "issue", "name")).lower()


def matches(exp, f):
    rules = exp["rule"].split("|")
    page_ok = ("page" not in exp) or (exp["page"] in pages_of(f)) or (f.get("page") is None and not f.get("pages"))
    quote_ok = ("quote" not in exp) or (exp["quote"].lower() in text_of(f))
    rule_ok = f["rule"] in rules
    if "quote" in exp and "page" in exp:
        # a reviewer accepts the point when the right passage on the right page is raised, whatever the letter
        return page_ok and quote_ok
    return rule_ok and page_ok and quote_ok


def score_doc(name, spec, findings):
    expected = spec.get("expected", [])
    must_not = set(spec.get("must_not", []))
    must_not_pages = spec.get("must_not_pages", {})
    # maximum bipartite matching (augmenting paths): a finding satisfies at most one expectation
    adj = [[i for i, f in enumerate(findings) if matches(exp, f)] for exp in expected]
    match_f = {}

    def augment(e, seen):
        for i in adj[e]:
            if i in seen:
                continue
            seen.add(i)
            if i not in match_f or augment(match_f[i], seen):
                match_f[i] = e
                return True
        return False

    matched_e = set()
    for e in range(len(expected)):
        if augment(e, set()):
            matched_e.add(e)
    used = set(match_f.keys())
    hits = [(expected[e], findings[i]) for i, e in match_f.items()]
    misses = [expected[e] for e in range(len(expected)) if e not in matched_e]
    fps = []
    for i, f in enumerate(findings):
        bad = f["rule"] in must_not or any(f["rule"] == r and (set(pgs) & pages_of(f)) for r, pgs in must_not_pages.items())
        if bad:
            fps.append(f)
    extras = [f for i, f in enumerate(findings) if i not in used and f not in fps]
    n = len(findings)
    return {
        "findings": n, "expected": len(expected), "hits": len(hits), "misses": [m for m in misses],
        "false_positives": len(fps), "fp_list": [{"rule": f["rule"], "page": f.get("page")} for f in fps],
        "extras": len(extras), "extra_list": [{"rule": f["rule"], "page": f.get("page"), "sev": f.get("severity"), "quote": (f.get("quote") or f.get("excerpt") or f.get("title") or "")[:70]} for f in extras],
        "recall": (len(hits) / len(expected)) if expected else None,
        "precision": (len(hits) / n) if n else None,
    }


def calib_score(findings):
    """Runs src/calibration.js on a findings list with node; the list needs rule/tier/page/pages/quote/title/issue."""
    src = open(os.path.join(APP, "src", "calibration.js"), encoding="utf-8").read()
    payload = json.dumps([{"id": f.get("id") or ("o%d" % i), "rule": f["rule"], "tier": f.get("tier") or f["rule"][0], "page": f.get("page"), "pages": f.get("pages") or ([f["page"]] if f.get("page") else []), "quote": f.get("quote") or f.get("excerpt") or "", "title": f.get("title") or f.get("name") or "", "issue": f.get("issue") or ""} for i, f in enumerate(findings)])
    js = src + "\nconst r = Calibration.score(" + payload + ");\nprocess.stdout.write(JSON.stringify({recall: r.recall, expectedTotal: r.expectedTotal, fp: r.fpCount, fpTotal: r.fpTotal, open: r.openCount, missed: r.expected.filter(e=>!e.hit).map(e=>e.label), raised: r.falsePositives.filter(e=>e.raised).map(e=>e.label)}));"
    out = subprocess.run(["node", "-e", js], capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def main():
    scores = {"docs": {}, "quartus": {}}
    for name, spec in TRUTH.items():
        old = OLD.get(name, {}).get("findings", [])
        new = NEW.get(name, {}).get("findings", [])
        scores["docs"][name] = {"old": score_doc(name, spec, old), "new": score_doc(name, spec, new) if name in NEW else None,
                               "new_meta": {k: NEW[name].get(k) for k in ("seconds", "cost", "calls", "error")} if name in NEW else None,
                               "located": (sum(1 for f in new if f.get("located") or not f.get("quote")), len(new)) if name in NEW else None,
                               "assurance": {"certain": sum(1 for f in new if f.get("assurance") == "certain"), "verify": sum(1 for f in new if f.get("assurance") == "verify")} if name in NEW else None}
    if "quartus" in OLD:
        scores["quartus"]["old"] = calib_score(OLD["quartus"]["findings"])
    if "quartus" in NEW and NEW["quartus"].get("findings") is not None:
        scores["quartus"]["new"] = calib_score(NEW["quartus"]["findings"])
        scores["quartus"]["new"]["findings"] = len(NEW["quartus"]["findings"])
        scores["quartus"]["new_meta"] = {k: NEW["quartus"].get(k) for k in ("seconds", "cost", "calls", "error")}
        scores["quartus"]["located"] = (sum(1 for f in NEW["quartus"]["findings"] if f.get("located") or not f.get("quote")), len(NEW["quartus"]["findings"]))
        scores["quartus"]["assurance"] = {"certain": sum(1 for f in NEW["quartus"]["findings"] if f.get("assurance") == "certain"), "verify": sum(1 for f in NEW["quartus"]["findings"] if f.get("assurance") == "verify")}
    if "quartus" in OLD:
        scores["quartus"]["old"]["findings"] = len(OLD["quartus"]["findings"])
    json.dump(scores, open(os.path.join(HERE, "scores.json"), "w", encoding="utf-8"), indent=1)
    # ---- print
    print("%-24s %-28s %-28s" % ("document", "old overlay engine", "this product (real models)"))
    tot = {"old": [0, 0, 0, 0], "new": [0, 0, 0, 0]}  # hits, expected, fps, findings
    for name, sc in scores["docs"].items():
        o, n = sc["old"], sc["new"]
        line = "%-24s hits %d/%d fp %-2d n %-3d" % (name, o["hits"], o["expected"], o["false_positives"], o["findings"])
        if n:
            line += "   hits %d/%d fp %-2d n %-3d  %ss $%.2f  located %d/%d  certain %d verify %d" % (n["hits"], n["expected"], n["false_positives"], n["findings"], sc["new_meta"]["seconds"], sc["new_meta"]["cost"], sc["located"][0], sc["located"][1], sc["assurance"]["certain"], sc["assurance"]["verify"])
            for k, v in (("hits", n["hits"]), ("expected", n["expected"]), ("fps", n["false_positives"]), ("findings", n["findings"])):
                pass
            tot["new"][0] += n["hits"]; tot["new"][1] += n["expected"]; tot["new"][2] += n["false_positives"]; tot["new"][3] += n["findings"]
        tot["old"][0] += o["hits"]; tot["old"][1] += o["expected"]; tot["old"][2] += o["false_positives"]; tot["old"][3] += o["findings"]
        print(line)
        if n and n["misses"]:
            print("      new misses:", n["misses"])
        if n and n["fp_list"]:
            print("      new false positives:", n["fp_list"])
    print("TOTAL old: hits %d/%d, false positives %d, findings %d" % tuple(tot["old"]))
    print("TOTAL new: hits %d/%d, false positives %d, findings %d" % tuple(tot["new"]))
    if scores["quartus"]:
        print("quartus:", json.dumps(scores["quartus"], indent=1))


if __name__ == "__main__":
    main()
