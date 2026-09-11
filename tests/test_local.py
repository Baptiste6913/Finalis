import os, asyncio, json, os, subprocess, sys, time, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
APP=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env=dict(os.environ, PRESCREEN_MOCK='1', PRESCREEN_PORT='8787', PRESCREEN_QUIET='1')
srv=subprocess.Popen([sys.executable, os.path.join(APP,'server.py')], env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
for _ in range(50):
    try:
        h=json.loads(urllib.request.urlopen('http://127.0.0.1:8787/api/health').read()); print('HEALTH', h); break
    except Exception: time.sleep(0.2)
async def main():
    async with async_playwright() as pw:
        browser=await pw.chromium.launch()
        page=await (await browser.new_context(viewport={'width':1400,'height':900})).new_page()
        await page.route('**/*', lambda r: r.abort() if 'fonts.g' in r.request.url else r.continue_())
        page.on('pageerror', lambda e: print('[pageerror]', e))
        page.on('console', lambda m: print('[console]', m.type, m.text) if m.type=='error' else None)
        await page.goto('http://127.0.0.1:8787/')
        await page.wait_for_timeout(800)
        print('claude.local:', await page.evaluate('window.claude && window.claude.local'))
        await page.click('#sample-slot button')
        await page.wait_for_selector('#filechip:not([hidden])', timeout=60000)
        await page.click('#btn-submit-form'); await page.wait_for_selector('#btn-start', timeout=30000); await page.click('#btn-start')
        await page.wait_for_function("document.getElementById('wh-status-text').textContent.includes('complete')", timeout=90000)
        st=await page.evaluate("() => ({ n: UI.S.result.findings.length, calib: UI.S.calib && {recall: UI.S.calib.recall, fp: UI.S.calib.fpCount}, calls: UI.S.result.meta.calls.map(c=>c.pass), steps: UI.S.steps.map(s=>s.key+':'+s.status) })")
        print('RESULT', st)
        highs=await page.evaluate("UI.S.result.findings.filter(f=>f.severity==='high' && Review.isCertain(f)).map(f=>f.id)")
        for fid in highs:
            tab=await page.evaluate(f"UI.S.result.findings.find(f=>f.id==='{fid}').tier === 'C' ? 'language' : 'disclosures'")
            await page.click(f'#tab-{tab}'); await page.click(f'[data-card="{fid}"] .resp .chips button:first-child')
        await page.check('#ack'); await page.click('#btn-submit')
        await page.wait_for_selector('#view-done:not([hidden])', timeout=20000)
        print('DONE', (await page.text_content('#done-card'))[:160].replace('\n',' '))
        # server-side db check
        q=json.loads(urllib.request.urlopen('http://127.0.0.1:8787/api/db/query?collection=submissions').read())
        print('SERVER SUBMISSIONS', len(q['docs']), 'assetId', q['docs'][0]['data']['file'].get('assetId'))
        await page.click('#mode-reviewer'); await page.wait_for_timeout(1200)
        print('INBOX', (await page.text_content('#inbox-list'))[:120].replace('\n',' '))
        await page.click('#inbox-list .trow:not(.h) .btn.primary'); await page.wait_for_timeout(1500)
        print('VIEWING kind', await page.evaluate('UI.S.doc.kind'), 'pages', await page.evaluate('UI.S.doc.pages.length'))
        await page.click('[data-card="f1"] .verdict button.yes'); await page.wait_for_timeout(500)
        exp=json.loads(urllib.request.urlopen('http://127.0.0.1:8787/api/learning/export').read())
        print('EXPORT verdicts', len(exp['verdicts']), 'rules', len(exp['learned_rules']), 'submissions', exp['submissions'])
        await page.click('#btn-back'); await page.wait_for_timeout(300); await page.click('#btn-learning'); await page.wait_for_timeout(800)
        print('LEARNING', (await page.text_content('#learning-body'))[:100].replace('\n',' '))
        await page.screenshot(path='shot_local.png', full_page=True)
        await browser.close()
try:
    asyncio.run(main())
finally:
    srv.terminate()
    out=srv.stdout.read(); print('SERVER LOG tail:', out[-300:])
