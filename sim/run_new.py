#!/usr/bin/env python3
"""Runs the corpus (and the Quartus calibration deck) through the product path: the local build served by
server.py with the CLI backend (real Claude models), driven in headless Chromium exactly as a banker would.
Writes sim/results_new.json. Usage: python3 sim/run_new.py [names...]"""
import asyncio, json, os, subprocess, sys, time, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
from playwright.async_api import async_playwright

PORT = int(os.environ.get('SIM_PORT', '8790'))
TRUTH = json.load(open(os.path.join(HERE, 'corpus', 'truth.json')))
DIST_LABELS = {'Email': 'dist-email', 'Meeting (in person or virtual)': 'dist-meeting', 'Data room': 'dist-dataroom', 'LinkedIn': 'dist-linkedin', 'Website': 'dist-website', 'Conference or event': 'dist-event'}

def start_server():
    env = dict(os.environ, PRESCREEN_BACKEND=os.environ.get('SIM_BACKEND', 'cli'), PRESCREEN_PORT=str(PORT), PRESCREEN_QUIET='1')
    env.pop('PRESCREEN_MOCK', None)
    srv = subprocess.Popen([sys.executable, os.path.join(APP, 'server.py')], env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for _ in range(60):
        try:
            h = json.loads(urllib.request.urlopen('http://127.0.0.1:%d/api/health' % PORT).read()); print('server', h['backend'], h['models']); return srv
        except Exception:
            time.sleep(0.25)
    raise SystemExit('server did not start')

async def run_doc(page, name, spec, depth):
    await page.goto('http://127.0.0.1:%d/' % PORT)
    await page.wait_for_timeout(700)
    await page.evaluate("window.PRESCREEN_COST = 0; window.PRESCREEN_CALLS = 0;")
    if spec['kind'] == 'pdf':
        await page.set_input_files('#file-input', os.path.join(HERE, 'corpus', spec['file']))
        await page.wait_for_selector('#filechip:not([hidden])', timeout=60000)
    elif spec['kind'] == 'quartus':
        await page.click('#sample-slot button'); await page.wait_for_selector('#filechip:not([hidden])', timeout=60000)
    else:
        await page.click('#paste-toggle')
        await page.fill('#paste-text', open(os.path.join(HERE, 'corpus', spec['file']), encoding='utf-8').read())
    await page.select_option('#doc-type', spec['docType'])
    await page.evaluate("document.getElementById('doc-type').dispatchEvent(new Event('change'))")
    await page.select_option('#involved', spec['involvement'])
    await page.click('#dist-btn')
    for d in spec['distribution']:
        await page.evaluate("(id) => { const i = document.getElementById(id); if (!i.checked) { i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); } }", DIST_LABELS[d])
    await page.click('#dist-btn')
    # the Marketing materials modal: Submit is mandatory and opens the AI Prescreen
    await page.click('#btn-submit-form')
    await page.wait_for_selector('#btn-start', timeout=30000)
    await page.select_option('#audience', spec['audience'])
    await page.fill('#bank-name', spec.get('bankName', '')); await page.fill('#submitter', 'Sim Runner · sim@northbridge.example')
    await page.click('#%s' % ('depth-thorough' if depth == 'complex' else 'depth-fast'))
    t0 = time.time()
    await page.click('#btn-start')
    await page.wait_for_function("document.getElementById('wh-status-text').textContent.match(/complete|Required blocks only|Reference/)", timeout=900000)
    await page.wait_for_timeout(500)
    res = await page.evaluate("""() => { const S = UI.S; const r = S.result; return {
      lane: S.facts.lane, findings: r.findings.map(f => ({ id: f.id, rule: f.rule, tier: f.tier, severity: f.severity, page: f.page, pages: f.pages, quote: f.quote, title: f.title, issue: f.issue, action: f.action, confidence: f.confidence, located: !!(f.boxes && f.boxes.length) || !!f.range, boxes: (f.boxes||[]).length, assurance: f.assurance, why_verify: f.why_verify || '', unverified: !!f.unverified, note: f.note || '', text_to_add: (f.text_to_add||'').slice(0,80), rewrite: (f.rewrite||'').slice(0,120) })),
      suppressed: (r.suppressed||[]).map(s => ({ rule: s.rule, pages: s.pages, reason: (s.reason||'').slice(0,160) })), brief: r.brief, gut: r.gut_check, meta: r.meta, calib: S.calib && { recall: S.calib.recall, expectedTotal: S.calib.expectedTotal, fp: S.calib.fpCount, open: S.calib.openCount, missed: S.calib.expected.filter(e=>!e.hit).map(e=>e.label), raised: S.calib.falsePositives.filter(e=>e.raised).map(e=>e.label) },
      steps: S.steps.map(s => s.key + ':' + s.status + (s.detail ? ' (' + s.detail + ')' : '')), cost: window.PRESCREEN_COST || 0, calls: window.PRESCREEN_CALLS || 0, error: r.meta && r.meta.error || null } }""")
    res['seconds'] = round(time.time() - t0)
    return res

async def main():
    names = sys.argv[1:] or (list(TRUTH.keys()) + ['quartus'])
    depth = os.environ.get('SIM_DEPTH', 'complex')
    srv = start_server()
    out_path = os.path.join(HERE, 'results_new.json')
    results = json.load(open(out_path)) if os.path.exists(out_path) else {}
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch()
            ctx = await browser.new_context(viewport={'width': 1400, 'height': 900})
            page = await ctx.new_page()
            await page.route('**/*', lambda r: r.abort() if 'fonts.g' in r.request.url else r.continue_())
            page.on('pageerror', lambda e: print('[pageerror]', e))
            for name in names:
                spec = TRUTH.get(name) or {'kind': 'quartus', 'docType': 'deal-deck', 'audience': 'institutional', 'distribution': ['Email', 'Meeting (in person or virtual)'], 'involvement': 'banker', 'bankName': 'Northbridge Advisors'}
                print('== running', name, 'depth', depth, flush=True)
                try:
                    res = await run_doc(page, name, spec, depth)
                except Exception as e:  # noqa
                    print('FAILED', name, e); results[name] = {'error': str(e)}; json.dump(results, open(out_path, 'w'), indent=1); continue
                results[name] = res
                json.dump(results, open(out_path, 'w'), indent=1)
                print('   %d findings · %ss · $%.2f · %d calls · %s' % (len(res['findings']), res['seconds'], res['cost'], res['calls'], res['error'] or 'ok'), flush=True)
                for f in res['findings']: print('     ', f['rule'], f['severity'], 'p', f['page'], f.get('assurance', '?'), ('' if f['located'] or not f['quote'] else 'NOT-LOCATED ') + '|', (f['quote'] or f['title'])[:80])
                if res.get('calib'): print('   calibration', res['calib'])
            await browser.close()
    finally:
        srv.terminate()
        log = srv.stdout.read(); print('server log tail:', log[-600:])

if __name__ == '__main__':
    asyncio.run(main())
