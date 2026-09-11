#!/usr/bin/env python3
"""Baseline: the previous overlay engine (finalis-overlay 0.4.0, engine/engine.js + rules.json) run on the
same corpus in the same headless Chromium, so the two generations can be compared on identical inputs."""
import asyncio, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(APP, 'tests'))
from harness import *  # noqa

DOCS = [('S1_inst_clean', {'institutional_only': True}, 'pitch deck'), ('S2_inst_gaps', {'institutional_only': True}, 'pitch deck'),
        ('S3_retail_projections', {'natural_persons': True}, 'pitch deck'), ('S4_firm_mmr', {'institutional_only': True}, 'other'),
        ('S5_linkedin', {'natural_persons': True}, 'linkedin post'), ('S6_email', {'institutional_only': True}, 'email'),
        ('S7_article', {'natural_persons': True}, 'article'), ('quartus', {'institutional_only': True}, 'pitch deck')]

async def main():
    out = {}
    async with async_playwright() as pw:
        browser, page = await open_page(pw, page_html='dist/prescreen.html')
        await page.add_script_tag(url='/sim/old/engine.js')
        rules = json.load(open(os.path.join(HERE, 'old', 'rules.json')))
        for name, q, dt in DOCS:
            path = '/sim/corpus/%s.pdf' % name if name != 'quartus' else '/quartus.pdf'
            res = await page.evaluate("""async ([path, rules, q, dt]) => {
              const r = await fetch(path); const bytes = new Uint8Array(await r.arrayBuffer());
              const t0 = performance.now();
              const scan = await FinalisEngine.scan({ bytes, rules, questionnaire: q, documentType: dt });
              return { ms: Math.round(performance.now() - t0), counts: scan.counts, lane: scan.lane,
                findings: scan.findings.map(f => ({ rule: f.rule_id, tier: f.tier, severity: f.severity, page: f.page, status: f.status, name: f.name, excerpt: (f.excerpt || f.term || '').slice(0, 120) })) };
            }""", [path, rules, q, dt])
            out[name] = res
            print(name, res['lane'], res['counts'], res['ms'], 'ms')
        await browser.close()
    json.dump(out, open(os.path.join(HERE, 'results_old.json'), 'w'), indent=1)

if __name__ == '__main__':
    asyncio.run(main())
