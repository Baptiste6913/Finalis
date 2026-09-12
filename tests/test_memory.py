"""Personal and shared memory on the reviewer platform: a second reviewer opening a similar submission sees
the desk's similar submissions and the colleague's verdicts under the points; a verdict that differs from a
colleague's is flagged; the first reviewer, back on a similar deck, sees their habits and the points they
have not verdicted yet that they usually confirm. Usage: python3 tests/test_memory.py"""
import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
FAKE = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'test_flow.py')).read().split('FAKE = r"""')[1].split('"""')[0]
OUT = os.path.join(ROOT, 'tests', 'out'); os.makedirs(OUT, exist_ok=True)
CO = {'name': 'Compliance Officer', 'email': 'c.officer@finalis.com', 'firm': 'Finalis Securities LLC', 'role': 'reviewer'}
MC = {'name': 'Marie Curie', 'email': 'm.curie@finalis.com', 'firm': 'Finalis Securities LLC', 'role': 'reviewer'}
BK = {'name': 'Jane Doe', 'email': 'jane.doe@northbridge.example', 'firm': 'Northbridge Advisors', 'role': 'banker'}

async def prereview_and_submit(page):
    await page.click('#sample-slot button'); await page.wait_for_selector('#filechip:not([hidden])', timeout=30000)
    await page.click('#btn-submit-form'); await page.wait_for_selector('#btn-start'); await page.click('#btn-start')
    await page.wait_for_function("document.getElementById('wh-status-text').textContent.includes('complete')", timeout=60000)
    await page.wait_for_timeout(300)
    highs = await page.evaluate("UI.S.result.findings.filter(f=>f.severity==='high' && Review.isCertain(f) && !(UI.S.responses[f.id]&&UI.S.responses[f.id].status!=='none')).map(f=>f.id)")
    for fid in highs:
        tab = await page.evaluate(f"UI.S.result.findings.find(f=>f.id==='{fid}').tier === 'C' ? 'language' : 'disclosures'")
        await page.click(f'#tab-{tab}'); await page.click(f'[data-card="{fid}"] .resp .chips button:first-child')
    await page.check('#ack'); await page.click('#btn-submit'); await page.wait_for_selector('#view-done:not([hidden])'); await page.wait_for_timeout(300)

async def main():
    ok = True
    async with async_playwright() as pw:
        browser, page = await open_page(pw, width=1280, height=1000, init_script=FAKE)
        await page.wait_for_timeout(500)
        await prereview_and_submit(page)
        # first reviewer: confirms two points, dismisses one, decides
        await page.evaluate("(u) => UI.signIn(u, true)", CO); await page.wait_for_timeout(400)
        await page.click('#inbox-list .trow:not(.h) .btn.primary'); await page.wait_for_timeout(900)
        ids = await page.evaluate("UI.S.viewing.findings.filter(f=>!Review.isCertain(f) && f.tier !== 'A').map(f=>f.id)")
        await page.evaluate("async (ids) => { const F = UI.S.viewing.findings; const v = async (id, verdict, why) => { const f = F.find(x => x.id === id); UI.S.viewing.verdicts[id] = { verdict, reason: why, at: new Date().toISOString() }; await Learn.record(UI.S.viewing, f, verdict, why, UI.S.user, 'card'); }; await v(ids[0], 'correct', 'individual investor terms on an institutional deck'); await v(ids[1], 'correct', ''); await v(ids[2], 'incorrect', 'qualified language, fine for institutions'); await Store.updateSubmission(UI.S.viewing.id, { verdicts: UI.S.viewing.verdicts }); }", ids)
        await page.click('#gate .btn:has-text("Approve")'); await page.wait_for_timeout(600)
        first_id = await page.evaluate("UI.S.viewing.id")
        # banker submits the same deck again (a similar submission), then a second reviewer opens it
        await page.evaluate("(u) => UI.signIn(u, true)", BK); await page.wait_for_timeout(300)
        await page.click('#view-done .btn.primary'); await page.wait_for_timeout(300)
        await prereview_and_submit(page)
        await page.evaluate("(u) => UI.signIn(u, true)", MC); await page.wait_for_timeout(400)
        # open the new (undecided) one
        await page.evaluate("() => { const rows = Array.from(document.querySelectorAll('#inbox-list .trow:not(.h)')); const r = rows.find(x => /New/.test(x.textContent)); r.querySelector('.btn.primary').click(); }"); await page.wait_for_timeout(1200)
        m1 = await page.evaluate("() => { const m = UI.S.memory; return { similar: m.desk.similar.map(x => ({ name: x.name, score: x.score, reviewers: x.reviewers, status: x.status, confirmed: x.confirmed })), hints: m.desk.hints, personal: { habits: m.personal.habits.length, missed: m.personal.missed.length }, card: !!document.querySelector('.memcard'), deskHints: document.querySelectorAll('.precedent.desk').length }; }")
        print('MARIE MEMORY', json.dumps(m1, indent=1))
        ok = ok and m1['card'] and len(m1['similar']) == 1 and m1['similar'][0]['status'] == 'approved' and 'Compliance Officer' in m1['similar'][0]['reviewers'] and m1['hints'] >= 2 and m1['personal']['habits'] == 0
        await page.screenshot(path=os.path.join(OUT, 'memory_marie.png'))
        # Marie dismisses the point CO confirmed with a comment -> desk disagreement
        target = await page.evaluate("() => { const m = UI.S.memory; return Object.keys(m.byFinding).find(id => m.byFinding[id].colleagues.some(c => c.entry.verdict === 'correct' && c.entry.reason)); }")
        tab = await page.evaluate(f"UI.S.viewing.findings.find(f=>f.id==='{target}').tier === 'C' ? 'language' : 'disclosures'")
        await page.click(f'#tab-{tab}'); await page.wait_for_timeout(200)
        await page.click(f'[data-card="{target}"] .verdict button[data-verify="dismiss"], [data-card="{target}"] .verdict .chip.no'); await page.wait_for_timeout(900)
        m2 = await page.evaluate("() => ({ differs: UI.S.memory.desk.differs.map(x => x.rule + ':' + x.now + ' vs ' + x.by + ':' + x.theirs), warnRows: document.querySelectorAll('.memcard .mc-row.warn').length })")
        print('MARIE DIFFERS', m2); ok = ok and len(m2['differs']) == 1 and m2['warnRows'] >= 1
        await page.evaluate("document.getElementById('railbody').scrollTop = 0"); await page.wait_for_timeout(150)
        await page.screenshot(path=os.path.join(OUT, 'memory_differs.png'))
        # CO opens the same new submission: habits and missed points
        await page.evaluate("(u) => UI.signIn(u, true)", CO); await page.wait_for_timeout(400)
        await page.evaluate("() => { const rows = Array.from(document.querySelectorAll('#inbox-list .trow:not(.h)')); const r = rows.find(x => /New/.test(x.textContent)); r.querySelector('.btn.primary').click(); }"); await page.wait_for_timeout(1200)
        m3 = await page.evaluate("() => { const m = UI.S.memory; return { habits: m.personal.habits.map(h => h.rule + ' ' + h.correct + '/' + h.total), missed: m.personal.missed.map(x => x.rule + ': ' + x.why), text: (document.querySelector('.memcard') || {}).textContent }; }")
        print('CO MEMORY', json.dumps(m3, indent=1)[:600]); ok = ok and len(m3['missed']) >= 1 and 'you dismissed it here' not in (m3['text'] or '')
        await page.evaluate("document.getElementById('railbody').scrollTop = 0"); await page.wait_for_timeout(150)
        await page.screenshot(path=os.path.join(OUT, 'memory_co.png'))
        await browser.close()
    print('ALL OK' if ok else 'FAILURES'); sys.exit(0 if ok else 1)
asyncio.run(main())
