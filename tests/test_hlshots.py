import os, asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
FAKE = open('test_flow.py').read().split('FAKE = r"""')[1].split('"""')[0]
async def main():
    async with async_playwright() as pw:
        browser, page = await open_page(pw, page_html='dist/prescreen.html', width=1440, height=900, init_script=FAKE)
        await page.wait_for_timeout(500)
        await page.click('#sample-slot button')
        await page.wait_for_selector('#filechip:not([hidden])', timeout=30000)
        await page.click('#btn-submit-form'); await page.wait_for_selector('#btn-start', timeout=30000); await page.click('#btn-start')
        await page.wait_for_function("document.getElementById('wh-status-text').textContent.includes('complete')", timeout=60000)
        await page.wait_for_timeout(600)
        await page.screenshot(path='shot_brand.png')
        # zoom in twice then walk pages with highlights
        await page.click('#zoom-in'); await page.click('#zoom-in'); await page.wait_for_timeout(600)
        for n in [1, 6, 21, 22, 27]:
            fid = await page.evaluate(f"(UI.S.result.findings.find(f=>f.page==={n} && f.boxes && f.boxes.length)||{{}}).id")
            if fid:
                await page.evaluate(f"UI.S.result.findings.filter(f=>f.id==='{fid}').forEach(f=>{{ document.querySelector('[data-card=\"{fid}\"]') && document.querySelector('[data-card=\"{fid}\"]').click(); }})")
            await page.evaluate(f"document.getElementById('viewer').scrollTo({{top: document.getElementById('page-{n}').offsetTop - 12}})")
            await page.wait_for_timeout(900)
            box = await page.query_selector(f'#page-{n}')
            await box.screenshot(path=f'hl_p{n}.png')
        # keyboard nav
        await page.keyboard.press('j'); await page.wait_for_timeout(300)
        print('point nav:', await page.text_content('#pt-label'), 'active', await page.evaluate('UI.S.active'))
        await page.keyboard.press('j'); await page.wait_for_timeout(300)
        print('point nav:', await page.text_content('#pt-label'), 'active', await page.evaluate('UI.S.active'))
        # click a mark
        await page.evaluate("document.getElementById('viewer').scrollTo({top: document.getElementById('page-6').offsetTop - 12})"); await page.wait_for_timeout(500)
        marks = await page.query_selector_all('[data-overlay="6"] .mark')
        if marks:
            await marks[0].click(); await page.wait_for_timeout(400)
            print('after mark click active', await page.evaluate('UI.S.active'), 'tab', await page.evaluate('UI.S.tab'), 'card active', await page.evaluate("!!document.querySelector('.card.active')"))
        await page.screenshot(path='shot_markclick.png')
        await browser.close()
asyncio.run(main())
