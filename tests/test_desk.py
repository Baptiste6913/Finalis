"""Reviewer platform: queue with KPIs, filters, search and readiness sort; focus mode with keyboard verdicts;
decision bar recording a decision; timeline in the brief; chat dock opens. Usage: python3 tests/test_desk.py"""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
FAKE = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'test_flow.py')).read().split('FAKE = r"""')[1].split('"""')[0]
OUT = os.path.join(ROOT, 'tests', 'out'); os.makedirs(OUT, exist_ok=True)
async def main():
    ok = True
    async with async_playwright() as pw:
        browser, page = await open_page(pw, width=1280, height=1000, init_script=FAKE)
        await page.wait_for_timeout(500)
        await page.click('#sample-slot button'); await page.wait_for_selector('#filechip:not([hidden])', timeout=30000)
        await page.click('#btn-submit-form'); await page.wait_for_selector('#btn-start'); await page.click('#btn-start')
        await page.wait_for_function("document.getElementById('wh-status-text').textContent.includes('complete')", timeout=60000)
        await page.wait_for_timeout(300)
        highs = await page.evaluate("UI.S.result.findings.filter(f=>f.severity==='high' && Review.isCertain(f)).map(f=>f.id)")
        for fid in highs:
            tab = await page.evaluate(f"UI.S.result.findings.find(f=>f.id==='{fid}').tier === 'C' ? 'language' : 'disclosures'")
            await page.click(f'#tab-{tab}'); await page.click(f'[data-card="{fid}"] .resp .chips button:first-child')
        await page.check('#ack'); await page.click('#btn-submit'); await page.wait_for_selector('#view-done:not([hidden])'); await page.wait_for_timeout(300)
        await page.click('#mode-reviewer'); await page.wait_for_timeout(400)
        q = await page.evaluate("() => ({ kpis: Array.from(document.querySelectorAll('.kpi b')).map(b=>b.textContent), filters: document.querySelectorAll('#inbox-filters button').length, rows: document.querySelectorAll('#inbox-list .trow:not(.h)').length, ready: document.querySelector('#inbox-list .ready') && document.querySelector('#inbox-list .ready').textContent, tv: document.querySelector('#inbox-list .tv') && document.querySelector('#inbox-list .tv').textContent })")
        print('QUEUE', q); ok = ok and q['rows'] == 1 and q['filters'] == 6
        await page.fill('#inbox-search', 'nothing-matches'); await page.wait_for_timeout(100)
        n0 = await page.evaluate("document.querySelectorAll('#inbox-list .trow:not(.h)').length"); await page.fill('#inbox-search', ''); await page.wait_for_timeout(100)
        print('SEARCH filtered rows', n0); ok = ok and n0 == 0
        await page.screenshot(path=os.path.join(OUT, 'desk_queue.png'))
        await page.click('#inbox-list .trow:not(.h) .btn.primary'); await page.wait_for_timeout(1000)
        # focus mode
        pend = await page.evaluate("UI.S.viewing.findings.filter(f=>!Review.isCertain(f)).length")
        await page.click('#gate .btn:has-text("Verify one by one")'); await page.wait_for_timeout(300)
        f1 = await page.evaluate("() => ({ focus: !!document.querySelector('.focus'), label: document.querySelector('.focus .fh b').textContent })")
        print('FOCUS', f1, 'pending', pend); ok = ok and f1['focus']
        await page.screenshot(path=os.path.join(OUT, 'desk_focus.png'))
        await page.keyboard.press('c'); await page.wait_for_timeout(300)
        await page.keyboard.press('d'); await page.wait_for_timeout(300)
        f2 = await page.evaluate("() => ({ verdicts: Object.keys(UI.S.viewing.verdicts).length, label: document.querySelector('.focus') ? document.querySelector('.focus .fh b').textContent : 'ended' })")
        print('AFTER KEYS', f2); ok = ok and f2['verdicts'] == 2
        await page.keyboard.press('Escape'); await page.wait_for_timeout(200)
        # decision
        await page.fill('#decision-msg', 'Please add the disclosures listed and resubmit.')
        await page.click('#gate .btn:has-text("Request changes")'); await page.wait_for_timeout(300)
        d = await page.evaluate("() => ({ status: UI.S.viewing.status, decision: UI.S.viewing.decision && UI.S.viewing.decision.kind, history: (UI.S.viewing.history||[]).length, decided: !!document.querySelector('.decision .decided') })")
        print('DECISION', d); ok = ok and d['status'] == 'changes' and d['history'] == 1
        await page.click('#tab-summary'); await page.wait_for_timeout(300)
        tl = await page.evaluate("Array.from(document.querySelectorAll('.timeline li b')).map(b=>b.textContent)")
        print('TIMELINE', tl); ok = ok and 'Changes requested' in tl
        await page.screenshot(path=os.path.join(OUT, 'desk_brief.png'))
        await page.click('#btn-chat'); await page.wait_for_timeout(200)
        ch = await page.evaluate("() => ({ open: !document.getElementById('chatdock').hidden, hint: document.querySelector('.cd-hint') && document.querySelector('.cd-hint').textContent.slice(0, 40) })")
        print('CHAT', ch); ok = ok and ch['open']
        await page.screenshot(path=os.path.join(OUT, 'desk_chat.png'))
        await page.click('#btn-back'); await page.wait_for_timeout(300)
        st = await page.evaluate("() => ({ view: UI.S.view, status: document.querySelector('#inbox-list .trow:not(.h) .tag.medium, #inbox-list .trow:not(.h) .tag.info') && document.querySelectorAll('#inbox-list .trow:not(.h) .tag')[4].textContent })")
        print('BACK', st)
        await browser.close()
    print('ALL OK' if ok else 'FAILURES'); sys.exit(0 if ok else 1)
asyncio.run(main())
