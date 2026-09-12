"""Permanent learning v2: every verdict is recorded with the reviewer's identity (focus mode, cards, comments),
decisions are recorded, the digest turns comments into desk-wide and reviewer-scoped rules, the Learning view
shows reviewer profiles and the log, and the next pre-review adapts: identical dismissed passages are set
aside, close ones and the reviewer's rejected rules are left to the reviewer, precedents show on the cards.
Usage: python3 tests/test_learning.py"""
import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
BASE = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'test_flow.py')).read().split('FAKE = r"""')[1].split('"""')[0]
FAKE = BASE.replace("const sample = async (input, opts) => { throw {code:'invalid_request', message:'text mode not used'}; };",
  "const sample = async (input, opts) => { await delay(80); const t = typeof input === 'string' && input.includes('decision email') ? 'Changes requested. Please add the preferred-return disclosure on page 27 and the award disclosure on page 1, then resubmit.' : 'Answer from the document: see page 27.'; if (opts && opts.onText) opts.onText({ text: t, delta: t }); return { text: t, truncated: false }; };").replace(
  "if (typeof input === 'string' && input.includes('Write ONE calibration rule'))",
  "if (typeof input === 'string' && input.includes('You maintain the calibration rules')) { window.__digestPrompt = input; return { rules: [ { rule: 'B10', scope: 'desk', action: 'never_raise', text: 'Do not raise B10 on institutional decks when the individual-investor terms sit in the fund terms table with a minimum commitment.', evidence: 'C. Officer dismissed B10 p.27 with a comment' }, { rule: 'C4', scope: 'reviewer', reviewer: 'c.officer@finalis.com', action: 'downgrade', text: 'For this reviewer, market-size figures with a named source elsewhere in the deck are low severity, not medium.', evidence: 'comment on C4 p.6' } ], summary: 'One desk rule on B10, one preference of C. Officer on C4.' }; }\n    if (typeof input === 'string' && input.includes('Write ONE calibration rule'))")
OUT = os.path.join(ROOT, 'tests', 'out'); os.makedirs(OUT, exist_ok=True)
REVIEWER = {'name': 'Compliance Officer', 'email': 'c.officer@finalis.com', 'firm': 'Finalis Securities LLC', 'role': 'reviewer'}

async def prereview(page):
    await page.click('#sample-slot button'); await page.wait_for_selector('#filechip:not([hidden])', timeout=30000)
    await page.click('#btn-submit-form'); await page.wait_for_selector('#btn-start'); await page.click('#btn-start')
    await page.wait_for_function("document.getElementById('wh-status-text').textContent.includes('complete')", timeout=60000)
    await page.wait_for_timeout(300)

async def submit(page):
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
        await prereview(page); await submit(page)
        # ---- reviewer: sign in with an identity, open, verdicts in focus mode, a comment on a card
        await page.evaluate("(u) => UI.signIn(u, true)", REVIEWER); await page.wait_for_timeout(400)
        await page.click('#inbox-list .trow:not(.h) .btn.primary'); await page.wait_for_timeout(900)
        pending = await page.evaluate("UI.S.viewing.findings.filter(f=>!Review.isCertain(f)).map(f=>f.id+':'+f.rule)")
        print('PENDING', pending)
        await page.click('#gate .btn:has-text("Verify one by one")'); await page.wait_for_timeout(200)
        await page.keyboard.press('j'); await page.wait_for_timeout(200)   # skip the A-tier item (required blocks never set aside by precedent)
        first = await page.evaluate("UI.S.focus.ids[UI.S.focus.i]")
        await page.keyboard.press('d'); await page.wait_for_timeout(300)   # dismissed, no comment
        await page.keyboard.press('c'); await page.wait_for_timeout(300)   # confirmed
        await page.keyboard.press('Escape'); await page.wait_for_timeout(200)
        # a comment on the dismissed point, from the card (both tabs)
        tab = await page.evaluate(f"UI.S.viewing.findings.find(f=>f.id==='{first}').tier === 'C' ? 'language' : 'disclosures'")
        await page.click(f'#tab-{tab}'); await page.wait_for_timeout(200)
        await page.fill(f'#verdict-{first}', 'The terms table states a minimum commitment; individual investors here are qualified purchasers.'); await page.wait_for_timeout(900)
        # a comment without a verdict on an asserted point
        certain = await page.evaluate("UI.S.viewing.findings.filter(f=>Review.isCertain(f) && f.rule==='C4').map(f=>f.id)")
        if certain:
            tab2 = 'language'; await page.click(f'#tab-{tab2}'); await page.wait_for_timeout(200)
            await page.fill(f'#verdict-{certain[0]}', 'Fine at low severity for me: the source is on the sources page.'); await page.wait_for_timeout(900)
        ent = await page.evaluate("async () => (await Store.listCalibration(100)).map(e => ({ type: e.type, rule: e.rule, verdict: e.verdict, reviewer: e.reviewer && e.reviewer.email, source: e.source, reason: (e.reason||'').slice(0,40), id: e.id }))")
        print('ENTRIES', json.dumps(ent, indent=1))
        ok = ok and len(ent) >= 3 and all(e['reviewer'] == REVIEWER['email'] for e in ent) and any(e['source'] == 'focus' for e in ent) and any(e['reason'] for e in ent)
        ok = ok and len(set(e['id'] for e in ent)) == len(ent)
        # ---- decision: recorded + digest reads the comments
        dbg = await page.evaluate("async () => { try { return await Ask.decision(UI.S.caps.sample, UI.S.viewing, 'changes', {}); } catch (e) { return 'ERR ' + (e && (e.message || e.code || JSON.stringify(e))); } }")
        print('ASK.DECISION', str(dbg)[:100])
        await page.click('#gate .btn:has-text("Draft with Claude")'); await page.wait_for_timeout(800)
        msg = await page.evaluate("document.getElementById('decision-msg').value"); print('DRAFT', msg[:80]); ok = ok and 'Changes requested' in msg
        await page.click('#gate .btn:has-text("Request changes")'); await page.wait_for_timeout(1500)
        lr = await page.evaluate("async () => ({ rules: (await Learn.learnedRules()).map(r => ({ rule: r.rule, scope: r.scope, reviewer: r.reviewer, source: r.source })), meta: await Learn.meta(), decisions: (await Store.listCalibration(100)).filter(e => e.type === 'decision').length, prompt: (window.__digestPrompt || '').slice(0, 60), hasComment: (window.__digestPrompt || '').includes('minimum commitment'), hasDecision: (window.__digestPrompt || '').includes('DECISION changes') })")
        print('LEARNED', json.dumps(lr['rules']), 'decisions', lr['decisions'], 'log', [e['event'] for e in lr['meta'].get('log', [])], 'digest read comment', lr['hasComment'], 'decision', lr['hasDecision'])
        ok = ok and lr['decisions'] == 1 and any(r['scope'] == 'reviewer' and r['reviewer'] == REVIEWER['email'] for r in lr['rules']) and any(r['scope'] == 'desk' for r in lr['rules']) and 'digest' in [e['event'] for e in lr['meta'].get('log', [])] and lr['hasComment'] and lr['hasDecision']
        # ---- learning view
        await page.click('#btn-back'); await page.wait_for_timeout(300); await page.click('#btn-learning'); await page.wait_for_timeout(600)
        lv = await page.evaluate("() => ({ profiles: document.querySelectorAll('#profiles .rule-item').length, profileText: (document.querySelector('#profiles .rule-item') || {}).textContent, log: document.querySelectorAll('#learning-log .rule-item').length, prefs: Array.from(document.querySelectorAll('.rule-item .m')).filter(m => m.textContent.includes('preference of')).length })")
        print('LEARNING VIEW', lv['profiles'], lv['log'], lv['prefs'], (lv['profileText'] or '')[:160]); ok = ok and lv['profiles'] == 1 and lv['log'] >= 2 and lv['prefs'] >= 1
        await page.screenshot(path=os.path.join(OUT, 'learning_v2.png'), full_page=True)
        # ---- adaptation: the desk routes submissions to this reviewer; four C1 dismissals by them on other passages
        await page.evaluate("async (email) => { await Store.setSettings({ reviewerEmail: email }); for (let i = 0; i < 4; i += 1) await Store.upsertCalibration({ id: 'cal-seed-' + i, type: 'verdict', at: new Date(Date.now() - 86400000 * (i + 1)).toISOString(), reviewer: { name: 'Compliance Officer', email }, rule: 'C1', lane: 'institutional', docType: 'deal-deck', page: 3 + i, quote: 'a different superlative passage number ' + i, verdict: 'incorrect', reason: 'institutional readers, qualified language', submission: 'seed' }); }", REVIEWER['email'])
        await page.evaluate("UI.signIn({ name: 'Jane Doe', email: 'jane.doe@northbridge.example', firm: 'Northbridge Advisors', role: 'banker' }, true)"); await page.wait_for_timeout(400)
        print('banker view after switch:', await page.evaluate("UI.S.view"))
        await page.click('#view-done .btn.primary'); await page.wait_for_timeout(300)
        await page.evaluate("async () => { UI.S.settings = await Store.getSettings(); }")
        await prereview(page)
        ad = await page.evaluate("() => { const r = UI.S.result; return { learning: r.meta.learning, precedentSetAside: r.suppressed.filter(s => /Set aside by precedent/.test(s.reason)).map(s => s.rule + ' ' + s.reason.slice(0, 90)), precedents: r.findings.filter(f => f.precedent).map(f => f.rule + ':' + f.precedent.verdict + ':' + f.precedent.score + (f.precedent.mine ? ':mine' : '')), c1: r.findings.filter(f => f.rule === 'C1').map(f => f.assurance + ' · ' + (f.why_verify || '')), rulesInPrompt: (window.__calls || []).length }; }")
        print('ADAPTED', json.dumps(ad, indent=1))
        ok = ok and ad['learning']['reviewer'] == REVIEWER['email'] and ad['learning']['reviewerRules'] >= 1 and len(ad['precedentSetAside']) >= 1 and any(':correct:' in p for p in ad['precedents'])
        ok = ok and all(c.startswith('verify') and 'dismissed 4 of' in c for c in ad['c1']) if ad['c1'] else ok
        exp = await page.evaluate("async () => { const s = await Learn.exportState(); return { version: s.version, verdicts: s.verdicts.length, rules: s.learned_rules.length, log: (s.meta.log || []).length }; }")
        print('EXPORT', exp); ok = ok and exp['version'] == 2 and exp['log'] >= 2
        await browser.close()
    print('ALL OK' if ok else 'FAILURES'); sys.exit(0 if ok else 1)
asyncio.run(main())
