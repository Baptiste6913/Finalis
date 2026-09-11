import os, asyncio, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
async def main():
    async with async_playwright() as pw:
        browser, page = await open_page(pw, width=1280, height=1000)
        await page.wait_for_timeout(500)
        await page.click('#sample-slot button'); await page.wait_for_selector('#filechip:not([hidden])', timeout=30000)
        await page.click('#btn-submit-form'); await page.wait_for_selector('#btn-start'); await page.click('#btn-start')
        await page.wait_for_function("document.getElementById('wh-status-text').textContent.match(/complete|Reference|Required/)", timeout=60000)
        await page.wait_for_timeout(800)
        await page.click('#tab-language'); await page.wait_for_timeout(200)
        await page.evaluate("document.querySelector('.section-h.v').scrollIntoView({block:'start'})"); await page.wait_for_timeout(300)
        await page.screenshot(path='shot_verify_section.png', full_page=False)
        await page.click('#tab-summary'); await page.wait_for_timeout(200)
        await page.screenshot(path='shot_summary_new.png', full_page=False)
        await browser.close()
asyncio.run(main())
