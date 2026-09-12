import os, asyncio, json, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
OUT = os.path.join(ROOT, 'tests', 'out'); os.makedirs(OUT, exist_ok=True)
FAKE = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'test_flow.py')).read().split('FAKE = r"""')[1].split('"""')[0]
async def main():
    async with async_playwright() as pw:
        # 1) docx + retail lane, deterministic engine output
        browser, page = await open_page(pw, init_script=FAKE)
        res = await page.evaluate("""async () => {
          const r = await fetch('/tests/fixtures/test.docx'); const bytes = new Uint8Array(await r.arrayBuffer());
          const {pages} = await Extract.docx(bytes);
          const facts = Engine.analyze(pages, {docType:'firm-marketing', audience:'retail', involvement:'banker', distribution:['Email'], bankName:'Northbridge Advisors'});
          return { text: pages[0].text, required: facts.required.map(r=>r.id+':'+r.status+(r.page?':p'+r.page:'')), lex: facts.lexicon.map(l=>l.id+':'+l.phrase), cov: facts.coverage.filter(c=>c.found).map(c=>c.key) };
        }""")
        print('DOCX', json.dumps(res, indent=1))
        checks = {'docx_text': len(res['text']) > 20, 'docx_required': len(res['required']) >= 1}
        # 2) pasted LinkedIn post
        res2 = await page.evaluate("""async () => {
          const ex = Extract.plain('Thrilled to share that our team was ranked #1 by Deal Weekly 2026. We are raising for a new real estate fund, DM me for details and comment below!');
          const facts = Engine.analyze(ex.pages, {docType:'linkedin-post', audience:'institutional', involvement:'banker', distribution:['LinkedIn']});
          return { lane: facts.lane, reason: facts.laneReason, required: facts.required.map(r=>r.id+':'+r.status), triggers: facts.triggers.map(t=>t.id+':'+t.terms.join('/')), lex: facts.lexicon.map(l=>l.id+':'+l.phrase) };
        }""")
        print('POST', json.dumps(res2, indent=1))
        checks['post_lane'] = res2['lane'] == 'retail' and any(t.startswith('B8') or t.startswith('B11') for t in res2['triggers'])
        # 3) image upload flow through the UI (fake transcription)
        await page.evaluate("""() => {
          const s = UI.S.caps.sample; const j = s.json;
          s.json = async (input, opts) => { if (typeof input === 'string' && input.includes('Transcribe')) { window.__calls.push({bytes:0, tier:'default', images: opts.images ? 1 : 0, head:'transcribe'}); return {text:'ACME Growth Fund III\\nFor institutional investors only\\nTarget net IRR 25%. Guaranteed downside protection.\\nSource: Company data', visuals:['pot of gold illustration']}; } return j(input, opts); };
        }""")
        # create a png in-page and set it on the input
        await page.evaluate("""async () => {
          const c = document.createElement('canvas'); c.width = 400; c.height = 300; const ctx = c.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,400,300); ctx.fillStyle='#000'; ctx.font='20px sans-serif'; ctx.fillText('ACME Growth Fund III', 20, 40);
          const blob = await new Promise(r => c.toBlob(r, 'image/png'));
          const file = new File([blob], 'teaser.png', {type:'image/png'});
          const dt = new DataTransfer(); dt.items.add(file);
          const input = document.getElementById('file-input'); input.files = dt.files; input.dispatchEvent(new Event('change'));
        }""")
        await page.wait_for_selector('#filechip:not([hidden])')
        await page.select_option('#involved', 'banker'); await page.click('#dist-btn'); await page.click('label.msel-opt:has(#dist-email)'); await page.keyboard.press('Escape')
        await page.click('#btn-submit-form'); await page.wait_for_selector('#btn-start', timeout=30000); await page.select_option('#audience', 'institutional'); await page.click('#btn-start')
        await page.wait_for_function("document.getElementById('wh-status-text').textContent.includes('complete')", timeout=30000)
        st = await page.evaluate("() => ({ kind: UI.S.doc.kind, text: UI.S.doc.pages[0].text.slice(0,80), required: UI.S.facts.required.map(r=>r.id+':'+r.status), n: UI.S.result.findings.length, calls: window.__calls.map(c=>c.head.slice(0,20)) })")
        print('IMAGE FLOW', json.dumps(st, indent=1))
        checks['image_flow'] = st['kind'] == 'image' and st['n'] >= 1
        await page.screenshot(path=os.path.join(OUT, 'shot_image.png'))
        await browser.close()
        # 4) mobile + dark
        browser, page = await open_page(pw, width=400, height=820, init_script=FAKE)
        await page.emulate_media(color_scheme='dark')
        await page.wait_for_timeout(500)
        await page.screenshot(path=os.path.join(OUT, 'shot_mobile_form_dark.png'), full_page=True)
        await page.click('#sample-slot button')
        await page.wait_for_selector('#filechip:not([hidden])', timeout=30000)
        await page.click('#btn-submit-form'); await page.wait_for_selector('#btn-start', timeout=30000); await page.click('#btn-start')
        await page.wait_for_function("document.getElementById('wh-status-text').textContent.includes('complete')", timeout=60000)
        await page.wait_for_timeout(800)
        await page.screenshot(path=os.path.join(OUT, 'shot_mobile_work_dark.png'))
        await page.click('#rail-toggle'); await page.wait_for_timeout(300)
        await page.screenshot(path=os.path.join(OUT, 'shot_mobile_rail_dark.png'))
        scrollw = await page.evaluate("document.documentElement.scrollWidth")
        print('mobile scrollWidth', scrollw)
        checks['no_horizontal_overflow'] = scrollw <= 400
        await browser.close()
        bad = [k for k, v in checks.items() if not v]
        print('ALL OK' if not bad else 'FAILURES: ' + ', '.join(bad))
        sys.exit(1 if bad else 0)

asyncio.run(main())
