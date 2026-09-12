import os, asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
OUT = os.path.join(ROOT, 'tests', 'out'); os.makedirs(OUT, exist_ok=True)

FAKE = r"""
window.__calls = [];
window.claude = { use: async (name) => {
  if (name !== 'sample') return null;
  const delay = (ms) => new Promise(r => setTimeout(r, ms));
  const sample = async (input, opts) => { throw {code:'invalid_request', message:'text mode not used'}; };
  sample.json = async (input, opts) => {
    window.__calls.push({ bytes: new TextEncoder().encode(typeof input === 'string' ? input : JSON.stringify(input)).length, tier: opts && opts.modelTier, images: opts && opts.images ? (opts.images.length || 1) : 0, head: (typeof input === 'string' ? input : '').slice(0, 80) });
    await delay(150);
    if (opts && opts.onText) opts.onText({ text: '{"partial":1', delta: '{"partial":1' });
    await delay(150);
    if (typeof input === 'string' && input.includes('FIRST pass')) return JSON.parse(JSON.stringify(Fixture.profile));
    if (typeof input === 'string' && input.includes('senior compliance reviewer checking')) {
      const ids = Array.from(input.matchAll(/"id":"(f\d+)"/g)).map(m => m[1]);
      return ids.map(id => ({ id, verdict: id === 'f14' ? 'drop' : 'keep', reason: 'test verdict' }));
    }
    if (typeof input === 'string' && input.includes('Write ONE calibration rule')) return { rule: 'Do not raise A3 when the legend appears in the footer of the first page.' };
    return JSON.parse(JSON.stringify(Fixture.batch));
  };
  sample.limits = async () => ({ maxPromptBytes: 65536, images: { maxCount: 6, maxInputBytes: 20000000, mediaTypes: ['image/jpeg','image/png'] } });
  return sample;
}};
"""

async def main():
    async with async_playwright() as pw:
        browser, page = await open_page(pw, init_script=FAKE)
        await page.wait_for_timeout(800)
        # load sample deck
        await page.click('#sample-slot button')
        await page.wait_for_selector('#filechip:not([hidden])', timeout=30000)
        print('filechip:', await page.text_content('#filechip-meta'))
        print('submit-form disabled before file:', await page.evaluate("document.getElementById('btn-submit-form').disabled"))
        await page.click('#btn-submit-form')
        await page.wait_for_selector('#view-work:not([hidden])')
        await page.wait_for_selector('#btn-start', timeout=10000)
        print('setup phase status:', await page.text_content('#wh-status-text'))
        await page.screenshot(path=os.path.join(OUT, 'shot_setup.png'), full_page=False)
        print('audience prefilled for the calibration deck:', await page.evaluate("document.getElementById('audience').value"))
        await page.select_option('#audience', '')
        await page.click('#btn-start')  # audience missing: refused
        await page.wait_for_timeout(200)
        print('phase after empty start (expect setup):', await page.evaluate("UI.S.phase"))
        await page.select_option('#audience', 'institutional')
        await page.click('#btn-start')
        await page.wait_for_function("document.getElementById('wh-status-text').textContent.includes('complete')", timeout=60000)
        await page.wait_for_timeout(500)
        calls = await page.evaluate('window.__calls')
        for c in calls: print('CALL', c['tier'], c['bytes'], 'bytes', c['images'], 'images', '|', c['head'][:60])
        st = await page.evaluate('''() => {
          const S = UI.S; const r = S.result;
          return { n: r.findings.length, counts: Review.counts(r.findings),
            list: r.findings.map(f => f.id+' '+f.tier+' '+f.rule+' '+f.severity+' p'+f.page+' boxes='+(f.boxes||[]).length+' '+f.assurance+' '+f.title.slice(0,50)+(f.why_verify?' ['+f.why_verify+']':'')),
            calib: S.calib && { recall: S.calib.recall, fp: S.calib.fpCount, open: S.calib.openCount, missed: S.calib.expected.filter(e=>!e.hit).map(e=>e.label) },
            suppressed: r.suppressed.length, steps: S.steps.map(s=>s.key+':'+s.status) };
        }''')
        print(json.dumps(st, indent=1))
        checks = {'findings': st['n'] >= 9 and st['calib']['recall'] >= 8, 'steps': 'assemble:done' in st['steps'] and st['steps'][-1] == 'claims:done'}
        await page.screenshot(path=os.path.join(OUT, 'shot_work.png'), full_page=False)
        # gate: try submit before answers
        print('submit disabled before answers:', await page.evaluate("document.getElementById('btn-submit').disabled"))
        # answer high findings: click 'Fixed in the new version' on each high card
        highs = await page.evaluate("UI.S.result.findings.filter(f=>f.severity==='high' && Review.isCertain(f)).map(f=>f.id)")
        for fid in highs:
            tab = await page.evaluate(f"UI.S.result.findings.find(f=>f.id==='{fid}').tier === 'C' ? 'language' : 'disclosures'")
            await page.click(f'#tab-{tab}')
            await page.click(f'[data-card="{fid}"] .resp .chips button:first-child')
        await page.check('#ack')
        checks['gate'] = not await page.evaluate("document.getElementById('btn-submit').disabled")
        print('submit enabled after answers:', checks['gate'])
        await page.click('#btn-submit')
        await page.wait_for_selector('#view-done:not([hidden])', timeout=10000)
        txt = await page.text_content('#done-card')
        print('DONE VIEW:', txt[:300].replace('\n',' '))
        await page.screenshot(path=os.path.join(OUT, 'shot_done.png'), full_page=True)
        # reviewer inbox
        await page.click('#mode-reviewer')
        await page.wait_for_selector('#view-inbox:not([hidden])')
        await page.wait_for_timeout(300)
        print('INBOX:', (await page.text_content('#inbox-list'))[:200].replace('\n',' '))
        await page.screenshot(path=os.path.join(OUT, 'shot_inbox.png'), full_page=True)
        await page.click('#inbox-list .trow:not(.h) .btn.primary')
        await page.wait_for_selector('#view-work:not([hidden])')
        await page.wait_for_timeout(800)
        # verdict on first finding, verification on a pending one
        await page.click('[data-card="f1"] .verdict button.yes')
        await page.wait_for_timeout(300)
        pend = await page.evaluate("UI.S.result.findings.filter(f=>!Review.isCertain(f)).map(f=>f.id)")
        print('PENDING VERIFICATION:', pend, 'gate:', (await page.text_content('#gate .why')))
        if pend:
            tab = await page.evaluate(f"UI.S.result.findings.find(f=>f.id==='{pend[0]}').tier === 'C' ? 'language' : 'disclosures'")
            await page.click(f'#tab-{tab}')
            await page.click(f'[data-card="{pend[0]}"] .verdict button[data-verify="confirm"]')
            await page.wait_for_timeout(300)
            print('after confirm:', await page.text_content(f'[data-card="{pend[0]}"] .verdict'))
            await page.screenshot(path=os.path.join(OUT, 'shot_verify.png'), full_page=False)
        cal = await page.evaluate("Store.listCalibration(10)")
        print('CALIBRATION ENTRIES:', len(cal), cal[0] if cal else None)
        mem = await page.evaluate("async () => (await Learn.precedents(UI.S.facts, UI.S.doc.pages, 30)).lines")
        print('MEMORY:', mem)
        checks['calibration'] = len(cal) >= 2 and all(e.get('reviewer') and e['reviewer'].get('email') for e in cal)
        checks['precedents'] = len(mem) >= 1
        await page.screenshot(path=os.path.join(OUT, 'shot_reviewer.png'), full_page=False)
        # learning view
        await page.click('#btn-back'); await page.wait_for_timeout(300)
        await page.click('#btn-learning'); await page.wait_for_timeout(600)
        print('LEARNING:', (await page.text_content('#learning-body'))[:220].replace('\n',' '))
        await page.screenshot(path=os.path.join(OUT, 'shot_learning.png'), full_page=True)
        exp = await page.evaluate("Learn.exportState()")
        checks['export'] = exp.get('version') == 2 and len(exp.get('verdicts', [])) >= 2
        print('EXPORT keys:', list(exp.keys()), 'verdicts', len(exp['verdicts']))
        # back to the submission, other tabs
        await page.click('#btn-learning-back'); await page.wait_for_timeout(300)
        await page.click('#inbox-list .trow:not(.h) .btn.primary'); await page.wait_for_timeout(800)
        await page.click('#tab-language'); await page.wait_for_timeout(200)
        await page.screenshot(path=os.path.join(OUT, 'shot_language.png'), full_page=False)
        await page.click('#tab-summary'); await page.wait_for_timeout(200)
        await page.screenshot(path=os.path.join(OUT, 'shot_summary.png'), full_page=False)
        await browser.close()
        bad = [k for k, v in checks.items() if not v]
        print('ALL OK' if not bad else 'FAILURES: ' + ', '.join(bad))
        sys.exit(1 if bad else 0)
asyncio.run(main())
