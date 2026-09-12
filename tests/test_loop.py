"""The loop closed: the banker's "My submissions" with the reviewer's decision and the unseen badge, the next
round (reopen, reviewer message, carried points, round and thread on the submission, previous round marked as
superseded), the reviewer's round view (badge, since-round card, timeline, deal file), the second opinion after
an approval, and the brief sections for the previous round and the deal file. Also the figures step of the
pre-review: model claims kept only when their quote is on the page, the text scan filling the rest.
Usage: python3 tests/test_loop.py"""
import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
FAKE = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'test_flow.py')).read().split('FAKE = r"""')[1].split('"""')[0]
FAKE = FAKE.replace("return JSON.parse(JSON.stringify(Fixture.batch));", r"""
    if (typeof input === 'string' && input.includes('Extract the figures the material commits to')) return { claims: [
      { key: 'target_return', value: '20% IRR', num: 20, num2: null, unit: '%', page: 27, quote: 'Target Return 4x TVPI, 20% IRR' },
      { key: 'fund_size', value: '$150M', num: 150, unit: 'money', currency: '$', page: 27, quote: 'Target Fund Size $150M' },
      { key: 'management_fee', value: '3%', num: 3, unit: '%', page: 5, quote: 'this passage is not on the page' } ] };
    if (typeof input === 'string' && input.includes('deliberately sceptical')) return { points: [
      { page: 27, quote: 'Target Return 4x TVPI, 20% IRR', concern: 'Target stated without its basis on the same page', rule: 'C4', severity: 'medium' },
      { page: 3, quote: 'this quote is not on the page', concern: 'invented', rule: '', severity: 'low' } ], verdict: 'Would have approved with one caveat.' };
    return JSON.parse(JSON.stringify(Fixture.batch));""")
OUT = os.path.join(ROOT, 'tests', 'out'); os.makedirs(OUT, exist_ok=True)

async def run_prereview(page):
    await page.click('#btn-start')
    await page.wait_for_function("document.getElementById('wh-status-text').textContent.includes('complete')", timeout=60000)
    await page.wait_for_timeout(300)
async def answer_and_submit(page):
    highs = await page.evaluate("UI.S.result.findings.filter(f=>f.severity==='high' && Review.isCertain(f)).map(f=>f.id)")
    for fid in highs:
        tab = await page.evaluate(f"UI.S.result.findings.find(f=>f.id==='{fid}').tier === 'C' ? 'language' : 'disclosures'")
        await page.click(f'#tab-{tab}'); await page.click(f'[data-card="{fid}"] .resp .chips button:first-child')
    await page.check('#ack'); await page.click('#btn-submit'); await page.wait_for_selector('#view-done:not([hidden])'); await page.wait_for_timeout(300)

async def main():
    checks = {}
    async with async_playwright() as pw:
        browser, page = await open_page(pw, width=1300, height=1000, init_script=FAKE)
        await page.wait_for_timeout(500)
        await page.click('#sample-slot button'); await page.wait_for_selector('#filechip:not([hidden])', timeout=30000)
        await page.click('#btn-submit-form'); await page.wait_for_selector('#btn-start')
        await run_prereview(page)
        # ---- the figures step
        cl = await page.evaluate("() => ({ n: UI.S.result.claims.length, both: UI.S.result.claims.filter(c=>c.source==='model+scan').map(c=>c.key+'='+c.value), fee: UI.S.result.claims.filter(c=>c.key==='management_fee').map(c=>c.value), contradictions: UI.S.result.consistency.contradictions.length, last: UI.S.steps[UI.S.steps.length-1].key+':'+UI.S.steps[UI.S.steps.length-1].status })")
        print('CLAIMS', cl)
        # the model and the scanner read the same target and fund size (kept once, with the scanner's exact number); the model's 3% fee is not on the page and is dropped
        checks['claims_model_and_scan'] = cl['n'] >= 10 and sorted(cl['both']) == ['fund_size=$150m', 'target_return=20%'] and cl['fee'] == ['2%'] and cl['last'] == 'claims:done'
        checks['claims_consistent'] = cl['contradictions'] == 0
        await page.click('#tab-summary'); await page.wait_for_timeout(200)
        figs = await page.evaluate("() => { const h = Array.from(document.querySelectorAll('.summary-card h4')).find(x=>x.textContent.includes('figures you commit')); return h ? h.parentElement.querySelectorAll('.claim').length : 0; }")
        print('FIGURES CARD rows', figs); checks['figures_card'] = figs >= 10
        await answer_and_submit(page)
        r1 = await page.evaluate("() => ({ id: UI.S.submission.id, round: UI.S.submission.round, thread: UI.S.submission.thread, previous: UI.S.submission.previous, claims: UI.S.submission.claims.length, mineBtn: !document.getElementById('btn-mine').hidden, title: document.querySelector('#done-card h1').textContent })")
        print('ROUND 1', r1)
        checks['round1_shape'] = r1['round'] == 1 and r1['thread'] == r1['id'] and r1['previous'] is None and r1['claims'] >= 10 and r1['mineBtn']
        first_id = r1['id']
        # ---- the reviewer requests changes
        await page.click('#mode-reviewer'); await page.wait_for_timeout(400)
        await page.click('#inbox-list .trow:not(.h) .btn.primary'); await page.wait_for_timeout(1000)
        await page.fill('#decision-msg', 'Please add the source for the market figure on page 6 and resubmit.')
        await page.click('#gate .btn:has-text("Request changes")'); await page.wait_for_timeout(400)
        # ---- the banker sees it under My submissions
        await page.click('#mode-banker'); await page.wait_for_timeout(400)
        badge = await page.evaluate("() => ({ hidden: document.getElementById('mine-count').hidden, n: document.getElementById('mine-count').textContent })")
        print('BADGE before opening', badge); checks['unseen_badge'] = (not badge['hidden']) and badge['n'] == '1'
        await page.click('#btn-mine'); await page.wait_for_selector('#view-mine:not([hidden])'); await page.wait_for_timeout(200)
        mine = await page.evaluate("() => ({ rows: document.querySelectorAll('#mine-list .mrow:not(.h)').length, unseen: document.querySelectorAll('#mine-list .mrow.unseen').length, status: document.querySelector('#mine-list .mrow:not(.h) .tag').textContent, msg: document.querySelector('#mine-list .mrow:not(.h) .msg').textContent, resubmit: !!Array.from(document.querySelectorAll('#mine-list button')).find(b=>b.textContent.includes('resubmit')), badgeHidden: document.getElementById('mine-count').hidden, kpis: Array.from(document.querySelectorAll('#mine-kpis .kpi b')).map(b=>b.textContent) })")
        print('MINE', mine)
        checks['mine_view'] = mine['rows'] == 1 and mine['unseen'] == 1 and mine['status'] == 'Changes requested' and 'source for the market figure' in mine['msg'] and mine['resubmit'] and mine['badgeHidden']
        await page.screenshot(path=os.path.join(OUT, 'loop_mine.png'))
        await page.click('#mine-list .mrow:not(.h) .btn:has-text("Details")'); await page.wait_for_timeout(200)
        det = await page.evaluate("() => ({ open: !!document.querySelector('.dialog'), text: document.querySelector('.dialog .db').textContent.slice(0, 400) })")
        print('DETAILS', det['open'], det['text'][:120]); checks['details_dialog'] = det['open'] and 'Changes requested' in det['text'] and 'Points that stood' in det['text']
        await page.keyboard.press('Escape'); await page.wait_for_timeout(150)
        # ---- round 2
        await page.click('#mine-list .mrow:not(.h) .btn.primary'); await page.wait_for_selector('#btn-start', timeout=30000); await page.wait_for_timeout(300)
        r2setup = await page.evaluate("() => ({ of: UI.S.resubmitOf && UI.S.resubmitOf.id, note: document.querySelector('.roundnote') && document.querySelector('.roundnote').textContent, audience: document.getElementById('audience').value, bank: document.getElementById('bank-name').value })")
        print('ROUND 2 SETUP', r2setup)
        checks['resubmit_setup'] = r2setup['of'] == first_id and r2setup['note'] and 'Round 2' in r2setup['note'] and 'source for the market figure' in r2setup['note'] and r2setup['audience'] == 'institutional' and r2setup['bank'] == 'Northbridge Advisors'
        # a point that stood on round 1 but is not in the document any more counts as resolved; the others are still open
        await page.evaluate("() => { UI.S.resubmitOf.findings.push({ id: 'f-gone', rule: 'C4', tier: 'C', severity: 'medium', assurance: 'certain', page: 6, quote: 'this passage was removed by the banker before round 2', title: 'Unsupported figure (fixed)', confidence: 'high', det: false }); }")
        await run_prereview(page)
        sr = await page.evaluate("() => ({ since: UI.S.sinceRound && { of: UI.S.sinceRound.of, open: UI.S.sinceRound.open.length, resolved: UI.S.sinceRound.resolved.length, resolvedIds: UI.S.sinceRound.resolved.map(x=>x.id) }, carried: UI.S.result.findings.filter(f=>f.carried).length, tags: document.querySelectorAll('.tag.carried').length })")
        print('SINCE ROUND 1', sr)
        checks['carried_points'] = sr['since'] and sr['since']['of'] >= 4 and sr['since']['open'] == sr['since']['of'] - 1 and sr['since']['resolvedIds'] == ['f-gone'] and sr['carried'] == sr['since']['open'] and sr['tags'] >= 1
        await page.screenshot(path=os.path.join(OUT, 'loop_round2.png'))
        await answer_and_submit(page)
        r2 = await page.evaluate(f"() => ({{ round: UI.S.submission.round, prev: UI.S.submission.previous && UI.S.submission.previous.id, thread: UI.S.submission.thread, since: UI.S.submission.previous && UI.S.submission.previous.since && UI.S.submission.previous.since.of, title: document.querySelector('#done-card h1').textContent, superseded: (UI.S.inbox.find(s=>s.id==='{first_id}')||{{}}).superseded_by }})")
        print('ROUND 2', r2)
        checks['round2_shape'] = r2['round'] == 2 and r2['prev'] == first_id and r2['thread'] == first_id and r2['since'] >= 4 and r2['title'].startswith('Round 2') and r2['superseded']
        # ---- the reviewer sees round 2
        await page.click('#mode-reviewer'); await page.wait_for_timeout(400)
        rows = await page.evaluate("() => Array.from(document.querySelectorAll('#inbox-list .trow:not(.h)')).map(r => ({ badge: r.querySelector('.rbadge') && r.querySelector('.rbadge').textContent, s: r.querySelector('.s').textContent }))")
        print('INBOX', rows)
        checks['inbox_round_badge'] = any(r['badge'] == 'Round 2' and 'since round 1' in r['s'] for r in rows) and any('superseded' in r['s'] for r in rows)
        await page.click('#inbox-list .trow:not(.h):has(.rbadge) .btn.primary'); await page.wait_for_timeout(1200)
        await page.wait_for_function("!!document.querySelector('.memcard')", timeout=10000)
        dv = await page.evaluate("() => ({ tags: document.querySelectorAll('.tag.carried').length, deal: !!(UI.S.result.consistency && UI.S.result.consistency.file.length === 1 && UI.S.result.consistency.file[0].thread === true && UI.S.result.consistency.changed.length === 0), stored: UI.S.viewing.consistency.file.length, memDeal: !!Array.from(document.querySelectorAll('.memcard .mc-sec b')).find(b=>b.textContent==='From the deal file') })")
        print('DESK VIEW', dv); checks['desk_round_view'] = dv['tags'] >= 1 and dv['deal'] and dv['memDeal'] and dv['stored'] == 1  # the banker compared with their own earlier round; the stored record is not rewritten by the reviewer's view
        await page.click('#tab-summary'); await page.wait_for_timeout(300)
        sm = await page.evaluate("() => ({ since: !!Array.from(document.querySelectorAll('.summary-card h4')).find(h=>h.textContent==='Since round 1'), deal: !!Array.from(document.querySelectorAll('.summary-card h4')).find(h=>h.textContent.startsWith('Deal file')), tl: Array.from(document.querySelectorAll('.timeline li b')).map(b=>b.textContent) })")
        print('DESK SUMMARY', sm); checks['desk_summary'] = sm['since'] and sm['deal'] and 'Round 1 submitted' in sm['tl'] and 'Changes requested' in sm['tl']
        await page.screenshot(path=os.path.join(OUT, 'loop_desk_round2.png'))
        blocks = await page.evaluate("() => Notify.reportBlocks(UI.S.viewing, 'desk').filter(b=>b.t==='section').map(b=>b.text)")
        print('BRIEF SECTIONS', blocks); checks['brief_sections'] = 'Previous round' in blocks and 'Deal file: figures and consistency' in blocks
        bblocks = await page.evaluate("() => Notify.reportBlocks(UI.S.viewing, 'banker').filter(b=>b.t==='section').map(b=>b.text)")
        checks['summary_sections'] = 'Since the previous round' in bblocks and 'The figures you commit to' in bblocks
        pdf = await page.evaluate("() => { const b = PdfOut.make({ title: 't', blocks: Notify.reportBlocks(UI.S.viewing, 'desk') }); return String.fromCharCode.apply(null, b.slice(0, 5)); }")
        checks['brief_pdf'] = pdf == '%PDF-'
        # ---- approve, then the second opinion
        await page.click('#gate .btn:has-text("Approve")'); await page.wait_for_timeout(400)
        checks['second_button'] = await page.evaluate("!!document.getElementById('btn-second')")
        await page.click('#btn-second'); await page.wait_for_selector('.sop .pt', timeout=10000); await page.wait_for_timeout(200)
        so = await page.evaluate("() => ({ pts: document.querySelectorAll('.sop .pt').length, verdict: document.querySelector('.sop .helper').textContent, stored: UI.S.viewing.secondOpinion && UI.S.viewing.secondOpinion.points.length })")
        print('SECOND OPINION', so); checks['second_opinion'] = so['pts'] == 1 and 'one caveat' in so['verdict'] and so['stored'] == 1
        await page.screenshot(path=os.path.join(OUT, 'loop_second_opinion.png'))
        # ---- the audit chain covers both rounds and every verdict and decision
        au = await page.evaluate("async () => { const ch = await Audit.chain(UI.S.inbox); const v = await Audit.verify(JSON.parse(JSON.stringify(ch))); const types = ch.records.map(r=>r.type); return { count: ch.count, ok: v.ok, types: Array.from(new Set(types)), rounds: ch.records.filter(r=>r.type==='submitted').map(r=>r.data.round) }; }")
        print('AUDIT', au); checks['audit_chain'] = au['ok'] and au['count'] >= 5 and 'decision' in au['types'] and 'seal' in au['types'] and sorted(au['rounds']) == [1, 2]
        await browser.close()
    bad = [k for k, v in checks.items() if not v]
    print('ALL OK' if not bad else 'FAILURES: ' + ', '.join(bad)); sys.exit(1 if bad else 0)
asyncio.run(main())
