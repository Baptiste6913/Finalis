#!/usr/bin/env python3
"""Writes docs/SIMULATIONS.md from sim/scores.json (run sim/score.py first) and sim/results_*.json."""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
S = json.load(open(os.path.join(HERE, "scores.json"), encoding="utf-8"))
NEW = json.load(open(os.path.join(HERE, "results_new.json"), encoding="utf-8"))
OLD = json.load(open(os.path.join(HERE, "results_old.json"), encoding="utf-8"))
TRUTH = json.load(open(os.path.join(HERE, "corpus", "truth.json"), encoding="utf-8"))
NOTES = json.load(open(os.path.join(HERE, "notes.json"), encoding="utf-8")) if os.path.exists(os.path.join(HERE, "notes.json")) else {}


def pct(a, b):
    return "%d%%" % round(100.0 * a / b) if b else "n/a"


def main():
    out = []
    out.append("# Simulations: old overlay engine vs Finalis AI Prescreen\n")
    out.append(NOTES.get("intro", ""))
    # ---- corpus table
    out.append("\n## Results on the synthetic corpus\n")
    out.append("Old = the engine of finalis-overlay 0.4.0 (`sim/old/engine.js`, run unchanged on the same PDFs). New = this product through its real path: the local build in headless Chromium, `server.py` with the CLI backend, Thorough depth (Opus for findings, Sonnet for the profile and the second pass), no page images (the CLI backend is text only), learning state empty. Hits = expected reviewer points found; FP = points the ground truth forbids; n = points raised in total.\n")
    out.append("| Document | Lane | Expected | Old: hits | Old: FP | Old: n | New: hits | New: FP | New: n | Time | Cost | Quotes located | Asserted / for review |")
    out.append("|---|---|---|---|---|---|---|---|---|---|---|---|---|")
    tot = {"oh": 0, "of": 0, "on": 0, "nh": 0, "nf": 0, "nn": 0, "exp": 0, "cost": 0.0, "sec": 0, "loc": 0, "locn": 0, "cert": 0, "ver": 0}
    for name, sc in S["docs"].items():
        o, n, m = sc["old"], sc["new"], sc["new_meta"]
        lane = TRUTH[name]["audience"] if TRUTH[name]["audience"] != "retail" else "retail"
        if TRUTH[name]["docType"] in ("linkedin-post", "website") or "LinkedIn" in TRUTH[name]["distribution"] or "Website" in TRUTH[name]["distribution"]:
            lane = "retail (public channel)"
        row = "| %s | %s | %d | %d | %d | %d |" % (name, lane, o["expected"], o["hits"], o["false_positives"], o["findings"])
        tot["oh"] += o["hits"]; tot["of"] += o["false_positives"]; tot["on"] += o["findings"]; tot["exp"] += o["expected"]
        if n:
            loc = sc["located"]; a = sc["assurance"]
            row += " %d | %d | %d | %ss | $%.2f | %d/%d | %d / %d |" % (n["hits"], n["false_positives"], n["findings"], m["seconds"], m["cost"], loc[0], loc[1], a["certain"], a["verify"])
            tot["nh"] += n["hits"]; tot["nf"] += n["false_positives"]; tot["nn"] += n["findings"]; tot["cost"] += m["cost"]; tot["sec"] += m["seconds"]; tot["loc"] += loc[0]; tot["locn"] += loc[1]; tot["cert"] += a["certain"]; tot["ver"] += a["verify"]
        else:
            row += " – | – | – | – | – | – | – |"
        out.append(row)
    out.append("| **Total** | | **%d** | **%d** | **%d** | **%d** | **%d** | **%d** | **%d** | %ss | $%.2f | %d/%d | %d / %d |" % (tot["exp"], tot["oh"], tot["of"], tot["on"], tot["nh"], tot["nf"], tot["nn"], tot["sec"], tot["cost"], tot["loc"], tot["locn"], tot["cert"], tot["ver"]))
    out.append("")
    out.append("Recall (expected points found): old %s, new %s. Precision against the ground truth's forbidden points (points raised that a reviewer had ruled out): old %d false positives in %d points (%s), new %d in %d (%s). Points that are neither expected nor forbidden (extras) are listed per document below and judged one by one.\n" % (
        pct(tot["oh"], tot["exp"]), pct(tot["nh"], tot["exp"]), tot["of"], tot["on"], pct(tot["of"], tot["on"]), tot["nf"], tot["nn"], pct(tot["nf"], tot["nn"])))
    # ---- quartus
    q = S.get("quartus", {})
    if q:
        out.append("## Results on the calibration deck (Quartus AI Fund II, 28 pages, institutional)\n")
        out.append("Ground truth: the reviewer's finding sheet (9 validated flags, 23 rejected flags, 4 items without a verdict), encoded in `src/calibration.js`.\n")
        out.append("| Engine | Validated flags found | Rejected flags raised | Open items raised | Points in total | Time | Cost |")
        out.append("|---|---|---|---|---|---|---|")
        if "old" in q:
            out.append("| Old overlay engine | %d/9 | %d/23 | %d/4 | %d | 3.5 s | $0 |" % (q["old"]["recall"], q["old"]["fp"], q["old"]["open"], q["old"]["findings"]))
        if "new" in q:
            out.append("| Finalis AI Prescreen (real models) | %d/9 | %d/23 | %d/4 | %d | %ss | $%.2f |" % (q["new"]["recall"], q["new"]["fp"], q["new"]["open"], q["new"]["findings"], q["new_meta"]["seconds"], q["new_meta"]["cost"]))
            if q["new"]["missed"]:
                out.append("\nMissed by the new engine: " + "; ".join(q["new"]["missed"]))
            if q["new"]["raised"]:
                out.append("\nRejected flags still raised by the new engine: " + "; ".join(q["new"]["raised"]))
        if "old" in q:
            out.append("\nRejected flags raised by the old engine: " + "; ".join(q["old"]["raised"]) + ".")
            out.append("\nValidated flags the old engine missed: " + "; ".join(q["old"]["missed"]) + ".")
        out.append("")
    out.append(NOTES.get("quartus", ""))
    # ---- per document detail
    out.append("\n## Per document\n")
    for name, sc in S["docs"].items():
        spec = TRUTH[name]
        out.append("### %s\n" % name)
        out.append(spec.get("note", "") + "\n")
        n = sc["new"]
        if n:
            found = NEW[name]["findings"]
            out.append("New engine, %d points (%s):\n" % (len(found), "%ss, $%.2f" % (sc["new_meta"]["seconds"], sc["new_meta"]["cost"])))
            for f in found:
                q = (f.get("quote") or f.get("title") or "")[:110].replace("|", "/")
                out.append("- %s · %s · p.%s · %s%s: \"%s\"" % (f["rule"], f["severity"], f.get("page") or "doc", f.get("assurance", "?"), "" if f.get("located") or not f.get("quote") else " · quote not located", q))
            if n["misses"]:
                out.append("\nMissed: " + "; ".join(json.dumps(m) for m in n["misses"]))
            if n["fp_list"]:
                out.append("\nForbidden points raised: " + "; ".join("%s p.%s" % (x["rule"], x["page"]) for x in n["fp_list"]))
            if n["extra_list"]:
                out.append("\nExtras (neither expected nor forbidden): " + "; ".join("%s p.%s (%s) \"%s\"" % (x["rule"], x["page"] or "doc", x["sev"], x["quote"].replace('"', "'")) for x in n["extra_list"]))
        o = sc["old"]
        oldf = OLD[name]["findings"]
        out.append("\nOld engine, %d points: " % len(oldf) + ", ".join("%s p.%s" % (f["rule"], f.get("page") or "doc") for f in oldf) + ".")
        if o["misses"]:
            out.append("\nOld engine missed: " + "; ".join(json.dumps(m) for m in o["misses"]))
        out.append("\n" + NOTES.get(name, "") + "\n")
    out.append(NOTES.get("outro", ""))
    os.makedirs(os.path.join(APP, "docs"), exist_ok=True)
    open(os.path.join(APP, "docs", "SIMULATIONS.md"), "w", encoding="utf-8").write("\n".join(out).replace("\n\n\n", "\n\n"))
    print("wrote docs/SIMULATIONS.md")


if __name__ == "__main__":
    main()
