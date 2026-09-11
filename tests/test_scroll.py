import os, asyncio, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
FAKE = open('test_flow.py').read().split('FAKE = r"""')[1].split('"""')[0]
async def main():
    async with async_playwright() as pw:
        browser, page = await open_page(pw, width=1440, height=900, init_script=FAKE)
        await page.wait_for_timeout(600)
        await page.click('#sample-slot button')
        await page.wait_for_selector('#filechip:not([hidden])', timeout=30000)
        await page.click('#btn-submit-form'); await page.wait_for_selector('#btn-start', timeout=30000); await page.click('#btn-start')
        await page.wait_for_function("document.getElementById('wh-status-text').textContent.includes('complete')", timeout=60000)
        await page.wait_for_timeout(800)
        pre = await page.evaluate("() => ({ sy: window.scrollY, docH: document.documentElement.scrollHeight, inner: window.innerHeight, appH: document.getElementById('app').scrollHeight, workH: document.querySelector('.work').getBoundingClientRect().height, headH: document.querySelector('.work-head').getBoundingClientRect().height })")
        print('before', pre)
        await page.click('[data-card="f4"] .pg')
        await page.wait_for_timeout(2500)
        post = await page.evaluate("() => { const v = document.getElementById('viewer'); const b = document.getElementById('page-27'); return { sy: window.scrollY, vst: v.scrollTop, vsh: v.scrollHeight, off: b.offsetTop, offParent: b.offsetParent && b.offsetParent.className, railTop: document.getElementById('railbody').scrollTop } }")
        print('after', post)
        await browser.close()
asyncio.run(main())
