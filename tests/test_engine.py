import os, asyncio, json, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
async def main():
    async with async_playwright() as pw:
        browser, page = await open_page(pw)
        res = await page.evaluate("""async () => {
          const r = await fetch('/quartus.pdf'); const bytes = new Uint8Array(await r.arrayBuffer());
          const t0 = performance.now();
          const {pages, pdf} = await Extract.pdf(bytes);
          const t1 = performance.now();
          const facts = Engine.analyze(pages, {docType:'deal-deck', audience:'institutional', involvement:'banker', distribution:['Email'], bankName:'Northbridge Advisors'});
          const t2 = performance.now();
          return { extractMs: Math.round(t1-t0), analyzeMs: Math.round(t2-t1),
            pages: pages.map(p => ({n:p.number, chars:p.charCount, images:p.imageCount, textLayer:p.textLayer, spans:p.spans.length, head:p.text.slice(0,100).replace(/\\n/g,' | ')})),
            required: facts.required.map(r => ({id:r.id, status:r.status, page:r.page, score:Math.round(r.score), near:r.near})),
            coverage: facts.coverage.filter(c=>c.found).map(c => ({key:c.key, page:c.page, score:c.score, ex:c.excerpt.slice(0,80)})),
            stats: facts.stats,
            triggers: facts.triggers.map(t => t.id+':p'+t.page+' ['+t.terms.join(',')+'] img='+t.images),
            lexicon: facts.lexicon.map(l => l.id+':p'+l.page+' "'+l.phrase+'"'),
            page6: pages[5].text, page9: pages[8].text, page27: pages[26].text };
        }""")
        print('extract', res['extractMs'], 'ms; analyze', res['analyzeMs'], 'ms')
        for p in res['pages']: print(p)
        print('REQUIRED', json.dumps(res['required'], indent=1))
        print('COVERAGE', json.dumps(res['coverage'], indent=1))
        print('STATS', [ (s['page'], s['role'], s['numbers'], s['images'], s['boldShare']) for s in res['stats']])
        print('TRIGGERS', json.dumps(res['triggers'], indent=1))
        print('LEXICON', json.dumps(res['lexicon'], indent=1))
        print('PAGE6\n', res['page6']); print('PAGE9\n', res['page9']); print('PAGE27\n', res['page27'])
        await browser.close()
        req = {r['id']: r['status'] for r in res['required']}
        ok = len(res['pages']) == 28 and all(p['textLayer'] for p in res['pages']) and req.get('A3') == 'missing' and req.get('A1a') == 'missing' and any(c['key'] == 'forward_generic' for c in res['coverage']) and res['analyzeMs'] < 5000
        print('ALL OK' if ok else 'FAILURES: required=%s pages=%d' % (req, len(res['pages'])))
        sys.exit(0 if ok else 1)
asyncio.run(main())
