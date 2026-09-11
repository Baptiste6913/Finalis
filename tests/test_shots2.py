import os, asyncio, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
FAKE = open('test_flow.py').read().split('FAKE = r"""')[1].split('"""')[0]
FAKE2 = FAKE + r"""
(function(){ const orig = window.claude.use; window.claude.use = async (name) => { const s = await orig(name); if (!s) return null;
  const wrapped = async (input, opts) => { await new Promise(r=>setTimeout(r,200)); const t = 'This sentence states as fact that the team are pioneers, which nothing in the deck supports. Under FINRA 2210 an unsupported characterization is unwarranted. Replace it with a factual description of the team or add a source; if the banker can substantiate it, keep it with the basis in a footnote.'; if (opts && opts.onText) opts.onText({text:t, delta:t}); return {text:t, truncated:false, modelTierApplied:'quick'}; };
  wrapped.json = async (input, opts) => { if (typeof input === 'string' && input.includes('alternative wordings')) { await new Promise(r=>setTimeout(r,200)); return ['Led by experienced AI technologists and seasoned operators', 'Led by a team with long experience in AI, technology and operations', 'Led by AI practitioners and seasoned operators']; } return s.json(input, opts); };
  wrapped.limits = s.limits; return wrapped; }; })();
"""
async def main():
    async with async_playwright() as pw:
        browser, page = await open_page(pw, width=1440, height=900, init_script=FAKE2)
        await page.wait_for_timeout(600)
        await page.click('#sample-slot button')
        await page.wait_for_selector('#filechip:not([hidden])', timeout=30000)
        await page.click('#btn-submit-form'); await page.wait_for_selector('#btn-start', timeout=30000); await page.click('#btn-start')
        await page.wait_for_function("document.getElementById('wh-status-text').textContent.includes('complete')", timeout=60000)
        await page.wait_for_timeout(600)
        await page.click('#tab-language'); await page.wait_for_timeout(200)
        fid = await page.evaluate("UI.S.result.findings.find(f=>f.tier==='C').id")
        await page.click(f'[data-card="{fid}"] .ib[title="Why is this a potential risk?"]'); await page.wait_for_timeout(200)
        await page.click(f'[data-card="{fid}"] .expand .btn.sm:has-text("Explain")'); await page.wait_for_timeout(600)
        await page.click(f'[data-card="{fid}"] .ib[title="Suggestions"]'); await page.wait_for_timeout(200)
        await page.click(f'[data-card="{fid}"] .expand .btn.sm:has-text("alternative")'); await page.wait_for_timeout(600)
        await page.screenshot(path='shot_card_ai.png')
        await page.click('#btn-rulebook-2'); await page.wait_for_timeout(300)
        await page.screenshot(path='shot_rulebook.png')
        await page.keyboard.press('Escape')
        await browser.close()
        browser, page = await open_page(pw, width=400, height=820, init_script=FAKE2)
        await page.emulate_media(color_scheme='dark')
        await page.click('#sample-slot button')
        await page.wait_for_selector('#filechip:not([hidden])', timeout=30000)
        await page.click('#btn-submit-form'); await page.wait_for_selector('#btn-start', timeout=30000); await page.click('#btn-start')
        await page.wait_for_function("document.getElementById('wh-status-text').textContent.includes('complete')", timeout=60000)
        await page.wait_for_timeout(800)
        await page.screenshot(path='shot_mobile_dark2.png')
        await browser.close()
asyncio.run(main())
