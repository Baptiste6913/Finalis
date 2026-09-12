import asyncio, json, os, subprocess, sys, time, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
APP=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(APP,'tests','out'); os.makedirs(OUT, exist_ok=True)
import tempfile
TMPDATA=tempfile.mkdtemp(prefix='prescreen-test-')
env=dict(os.environ, PRESCREEN_MOCK='1', PRESCREEN_PORT='8789', PRESCREEN_QUIET='1', PRESCREEN_DATA=TMPDATA)
srv=subprocess.Popen([sys.executable, os.path.join(APP,'server.py')], env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
for _ in range(50):
    try: urllib.request.urlopen('http://127.0.0.1:8789/api/health').read(); break
    except Exception: time.sleep(0.2)
async def main():
    async with async_playwright() as pw:
        browser=await pw.chromium.launch()
        ctx=await browser.new_context(viewport={'width':1400,'height':900}, accept_downloads=True)
        page=await ctx.new_page()
        await page.add_init_script("try{localStorage.setItem('prescreen.user', JSON.stringify({name:'Jane Doe',email:'jane.doe@northbridge.example',firm:'Northbridge Advisors',role:'banker'}))}catch(e){}")
        await page.route('**/*', lambda r: r.abort() if 'fonts.g' in r.request.url else r.continue_())
        page.on('pageerror', lambda e: print('[pageerror]', e))
        await page.goto('http://127.0.0.1:8789/'); await page.wait_for_timeout(800)
        await page.click('#sample-slot button'); await page.wait_for_selector('#filechip:not([hidden])', timeout=60000)
        await page.click('#btn-submit-form'); await page.wait_for_selector('#btn-start'); await page.click('#btn-start')
        await page.wait_for_function("document.getElementById('wh-status-text').textContent.includes('complete')", timeout=90000)
        await page.wait_for_timeout(400)
        await page.click('#tab-summary'); await page.wait_for_timeout(300)
        async with page.expect_download() as dl:
            await page.get_by_role('button', name='Export this summary as PDF').click()
        d = await dl.value
        path = os.path.join(OUT, 'dl_banker.pdf'); await d.save_as(path)
        print('download:', d.suggested_filename, os.path.getsize(path), 'bytes')
        await page.screenshot(path=os.path.join(OUT, 'shot_summary_pdfbtn.png'))
        # submit and download from the done page
        highs = await page.evaluate("UI.S.result.findings.filter(f=>f.severity==='high' && Review.isCertain(f)).map(f=>f.id)")
        for fid in highs:
            tab = await page.evaluate(f"UI.S.result.findings.find(f=>f.id==='{fid}').tier === 'C' ? 'language' : 'disclosures'")
            await page.click(f'#tab-{tab}'); await page.click(f'[data-card="{fid}"] .resp .chips button:first-child')
        await page.check('#ack'); await page.click('#btn-submit'); await page.wait_for_selector('#view-done:not([hidden])')
        async with page.expect_download() as dl2:
            await page.get_by_role('button', name='Download my summary (PDF)').click()
        d2 = await dl2.value; print('done-page download:', d2.suggested_filename)
        # desk side
        await page.click('#mode-reviewer'); await page.wait_for_timeout(500)
        async with page.expect_download() as dl3:
            await page.click('#inbox-list .trow:not(.h) .acts button[title="Export the brief as PDF"]')
        d3 = await dl3.value; p3=os.path.join(OUT, 'dl_desk.pdf'); await d3.save_as(p3); print('desk download:', d3.suggested_filename, os.path.getsize(p3), 'bytes')
        await page.click('#inbox-list .trow:not(.h) .btn.primary'); await page.wait_for_timeout(800)
        await page.click('#tab-summary'); await page.wait_for_timeout(200)
        brief_btn = await page.evaluate("!!Array.from(document.querySelectorAll('#railbody button')).find(b=>b.textContent.includes('Export the full brief as PDF'))")
        print('brief button:', brief_btn)
        await browser.close()
        import subprocess
        valid = all(subprocess.run(['qpdf', '--check', f], capture_output=True).returncode == 0 for f in (path, p3))
        ok = d.suggested_filename.startswith('pre-review-summary-') and d3.suggested_filename.startswith('reviewer-brief-') and os.path.getsize(path) > 5000 and os.path.getsize(p3) > os.path.getsize(path) and brief_btn and valid
        print('ALL OK' if ok else 'FAILURES: pdf exports (qpdf valid=%s)' % valid)
        if not ok: srv.terminate(); sys.exit(1)
try: asyncio.run(main())
finally: srv.terminate()
