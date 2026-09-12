import os, asyncio, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
OUT = os.path.join(ROOT, 'tests', 'out'); os.makedirs(OUT, exist_ok=True)
async def main():
    async with async_playwright() as pw:
        browser, page = await open_page(pw, width=1280, height=1000)
        await page.wait_for_timeout(600)
        await page.screenshot(path=os.path.join(OUT, 'shot_landing.png'), full_page=True)
        await page.click('#dist-btn'); await page.wait_for_timeout(150)
        await page.screenshot(path=os.path.join(OUT, 'shot_landing_menu.png'), full_page=False)
        await page.click('label.msel-opt:has(#dist-email)'); await page.click('label.msel-opt:has(#dist-dataroom)')
        await page.keyboard.press('Escape'); await page.wait_for_timeout(100)
        print('dist label:', await page.text_content('#dist-label'), '| submit disabled:', await page.evaluate("document.getElementById('btn-submit-form').disabled"))
        await page.select_option('#involved', 'banker')
        checks = {}
        checks['no_file_blocks'] = await page.evaluate("document.getElementById('btn-submit-form').disabled")
        print('submit disabled without file:', checks['no_file_blocks'])
        await page.click('#sample-slot button')
        await page.wait_for_selector('#filechip:not([hidden])', timeout=30000)
        checks['file_enables'] = not await page.evaluate("document.getElementById('btn-submit-form').disabled")
        print('submit disabled with file:', not checks['file_enables'])
        await page.screenshot(path=os.path.join(OUT, 'shot_landing_filled.png'), full_page=True)
        await page.click('#btn-submit-form')
        await page.wait_for_selector('#btn-start', timeout=10000)
        await page.wait_for_timeout(1200)
        await page.screenshot(path=os.path.join(OUT, 'shot_setup.png'), full_page=False)
        print('crumb-ai hidden:', await page.evaluate("document.getElementById('crumb-ai').hidden"), '| status:', await page.text_content('#wh-status-text'))
        # back to the form keeps the file
        await page.click('#btn-back'); await page.wait_for_timeout(200)
        print('after back: view-form visible', not await page.evaluate("document.getElementById('view-form').hidden"), '| file still loaded:', await page.evaluate("!!UI.S.doc"))
        await page.click('#btn-submit-form'); await page.wait_for_selector('#btn-start'); await page.wait_for_timeout(300)
        await page.click('#btn-start')  # no Claude in this view: reference pre-review
        await page.wait_for_function("document.getElementById('wh-status-text').textContent.match(/complete|Reference|Required/)", timeout=60000)
        await page.wait_for_timeout(1500)
        await page.screenshot(path=os.path.join(OUT, 'shot_work_new.png'), full_page=False)
        st = await page.evaluate("() => { const r = UI.S.result; return { n: r.findings.length, certain: r.findings.filter(Review.isCertain).length, verify: r.findings.filter(f=>!Review.isCertain(f)).map(f=>f.rule+' '+f.why_verify) } }")
        print(st)
        checks['result'] = st['n'] >= 9 and st['certain'] >= 5
        await page.click('#tab-language'); await page.wait_for_timeout(300)
        await page.screenshot(path=os.path.join(OUT, 'shot_language_new.png'), full_page=False)
        # mobile
        await page.set_viewport_size({'width': 420, 'height': 860})
        await page.click('#btn-back'); await page.wait_for_timeout(300)
        await page.screenshot(path=os.path.join(OUT, 'shot_landing_mobile.png'), full_page=True)
        await browser.close()
        bad = [k for k, v in checks.items() if not v]
        print('ALL OK' if not bad else 'FAILURES: ' + ', '.join(bad))
        sys.exit(1 if bad else 0)

asyncio.run(main())
