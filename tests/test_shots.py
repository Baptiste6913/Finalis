import os, asyncio, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
FAKE = open('test_flow.py').read().split('FAKE = r"""')[1].split('"""')[0]
async def main():
    async with async_playwright() as pw:
        browser, page = await open_page(pw, width=1440, height=900, init_script=FAKE)
        await page.wait_for_timeout(600)
        await page.screenshot(path='shot_form.png', full_page=True)
        await page.click('#sample-slot button')
        await page.wait_for_selector('#filechip:not([hidden])', timeout=30000)
        await page.click('#btn-submit-form'); await page.wait_for_selector('#btn-start', timeout=30000); await page.click('#btn-start')
        await page.wait_for_function("document.getElementById('wh-status-text').textContent.includes('complete')", timeout=60000)
        await page.wait_for_timeout(800)
        # click the B4 card to jump to page 27
        await page.click('[data-card="f4"] .pgbtn')
        await page.wait_for_timeout(1500)
        await page.screenshot(path='shot_work2.png')
        await browser.close()
asyncio.run(main())
