"""Metrics and audit: the desk metrics computed from a seeded inbox (first-pass approval, readiness by week,
corrections, rounds, time to decision, rules and firms, reviewers), the metrics view, the audit hash chain
(export, verification, tamper detection) and the export button. Usage: python3 tests/test_dashboard.py"""
import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
FAKE = r"""
window.__saved = [];
window.claude = { use: async (name) => {
  if (name === 'downloads') return { save: async ({ filename, data }) => { window.__saved.push({ filename, size: typeof data === 'string' ? data.length : (data.size || data.length || 0), text: typeof data === 'string' ? data : '' }); return { saved: true, filename }; } };
  return null;
}};
try { localStorage.setItem('prescreen.user', JSON.stringify({ name: 'Ana Ruiz', email: 'ana.ruiz@finalis.com', firm: 'Finalis Securities LLC', role: 'reviewer' })); } catch (e) {}
(() => {
  const day = 86400000; const now = Date.now();
  const iso = (d) => new Date(d).toISOString();
  const F = (id, rule, sev, assurance, page) => ({ id, rule, tier: rule[0], severity: sev, assurance, page, pages: [page], title: rule + ' point', issue: 'x', quote: 'q ' + id, det: rule[0] === 'A' });
  const mk = (o) => Object.assign({ status: 'submitted', submitter: 'Jane Doe', lane: 'institutional', file: { name: o.id + '.pdf', sha: 'sha-' + o.id, pages: 20, kind: 'pdf' }, form: { docType: 'deal-deck', bankName: 'Northbridge Advisors', distribution: ['Email'] }, facts: { lane: 'institutional', laneReason: 'x' }, result: { profile: {}, meta: {} }, findings: [F('f1', 'A1a', 'high', 'certain', 1), F('f2', 'B4', 'medium', 'verify', 3), F('f3', 'C4', 'high', 'certain', 6)], responses: { f1: { status: 'fixed' } }, verdicts: {}, submitted_by: { name: 'Jane Doe', email: 'jane.doe@northbridge.example' }, version: 1, changes: [], resolved: [], readiness: { score: 60, band: 'b-work', label: 'Needs work', open: 2 }, notification: { to: '', subject: 's', body: 'b' } }, o);
  const subs = [
    mk({ id: 'a1', created_at: iso(now - 20 * day), status: 'approved', decision: { kind: 'approve', message: 'ok', by: 'Ana Ruiz', at: iso(now - 20 * day + 5 * 3600000) }, history: [{ at: iso(now - 20 * day + 5 * 3600000), by: 'Ana Ruiz', event: 'approve', message: 'ok' }], verdicts: { f2: { verdict: 'correct', reason: 'yes', at: iso(now - 20 * day + 3600000), by: 'Ana Ruiz', byEmail: 'ana.ruiz@finalis.com' } }, readiness: { score: 85, band: 'b-ready', label: 'Ready', open: 0 }, version: 2, changes: [{ page: 1, kind: 'text', label: 'Added', text: 't' }], resolved: [{ id: 'f1', rule: 'A1a', title: 't', how: 'added' }], thread: 'a1', round: 1 }),
    mk({ id: 'b1', created_at: iso(now - 12 * day), status: 'changes', decision: { kind: 'changes', message: 'fix', by: 'Ana Ruiz', at: iso(now - 12 * day + 2 * day) }, history: [{ at: iso(now - 12 * day + 2 * day), by: 'Ana Ruiz', event: 'changes', message: 'fix' }], thread: 'b1', round: 1, superseded_by: 'b2', form: { docType: 'deal-deck', bankName: 'Harbor Point Capital', distribution: ['Email'] }, claims: [{ key: 'fund_size', unit: 'money', num: 100, value: '$100m', page: 2, quote: 'x' }] }),
    mk({ id: 'b2', created_at: iso(now - 8 * day), status: 'approved', decision: { kind: 'approve', message: 'ok', by: 'Tom Ortiz', at: iso(now - 8 * day + 3600000) }, history: [{ at: iso(now - 8 * day + 3600000), by: 'Tom Ortiz', event: 'approve', message: 'ok' }], thread: 'b1', round: 2, previous: { id: 'b1', round: 1, created_at: iso(now - 12 * day), status: 'changes', decision: null, since: { of: 2, resolved: [{ id: 'f1', rule: 'A1a', title: 't' }], open: [{ id: 'f3', rule: 'C4', title: 't' }] } }, readiness: { score: 80, band: 'b-ready', label: 'Ready', open: 0 }, form: { docType: 'deal-deck', bankName: 'Harbor Point Capital', distribution: ['Email'] }, claims: [{ key: 'fund_size', unit: 'money', num: 120, value: '$120m', page: 2, quote: 'x' }], consistency: { contradictions: [{ kind: 'deal', key: 'fund_size' }], internal: [], deal: [{ kind: 'deal', key: 'fund_size' }], file: [] } }),
    mk({ id: 'c1', created_at: iso(now - 3 * day), status: 'submitted', thread: 'c1', round: 1, readiness: { score: 40, band: 'b-notready', label: 'Not ready', open: 3 } }),
    mk({ id: 'd1', created_at: iso(now - 1 * day), status: 'escalated', decision: { kind: 'escalate', message: '', by: 'Ana Ruiz', at: iso(now - 1 * day + 7200000) }, history: [{ at: iso(now - 1 * day + 7200000), by: 'Ana Ruiz', event: 'escalate', message: '' }], thread: 'd1', round: 1 }),
  ];
  try { localStorage.setItem('mmat.submissions', JSON.stringify(subs)); } catch (e) {}
})();
"""
async def main():
    checks = {}
    async with async_playwright() as pw:
        browser, page = await open_page(pw, width=1280, height=1100, init_script=FAKE, fresh=True)
        await page.wait_for_timeout(700)
        m = await page.evaluate("() => Metrics.compute(UI.S.inbox)")
        print('METRICS', json.dumps({k: m[k] for k in ('submissions', 'decided', 'firstPass', 'readiness', 'corrected', 'rounds', 'decisionTime', 'status', 'withContradictions', 'answers')}, indent=1))
        checks['counts'] = m['submissions'] == 5 and m['decided'] == 4 and m['status'] == {'submitted': 1, 'changes': 1, 'approved': 2, 'escalated': 1}
        checks['first_pass'] = m['firstPass'] == {'approved': 1, 'decided': 3, 'rate': 33}  # a1 approved, b1 changes, d1 escalated; b2 is round 2
        checks['rounds'] = m['rounds']['threads'] == 4 and m['rounds']['multi'] == 1 and m['rounds']['rate'] == 25
        checks['corrected'] = m['corrected']['n'] == 1 and m['corrected']['rate'] == 20 and m['corrected']['resolved'] == 1
        checks['decision_time'] = m['decisionTime']['n'] == 4 and abs(m['decisionTime']['median'] - 3.5) < 0.01
        checks['readiness'] = m['readiness']['avg'] == 65 and m['readiness']['ready'] == 2 and m['readiness']['notReady'] == 1  # the bands stored with each submission (what the banker saw)
        checks['answers'] = m['answers'] == {'asked': 10, 'answered': 5, 'rate': 50}
        checks['rules_firms'] = m['rules'][0]['raised'] == 5 and any(r['rule'] == 'B4' and r['confirmed'] == 1 for r in m['rules']) and m['firms'][0]['firm'] == 'Northbridge Advisors' and m['firms'][0]['subs'] == 3 and m['firms'][1]['top'][0]['rule'] == 'A1a'
        checks['reviewers'] = [r['name'] for r in m['reviewers']] == ['Ana Ruiz', 'Tom Ortiz'] and m['reviewers'][0]['decisions'] == 3
        checks['trend'] = len(m['trend']) >= 3 and all('week' in w and 'readiness' in w for w in m['trend'])
        checks['contradictions'] = m['withContradictions'] == 1
        # ---- the view
        await page.click('#btn-metrics'); await page.wait_for_selector('#view-metrics:not([hidden])'); await page.wait_for_timeout(300)
        v = await page.evaluate("() => ({ kpis: Array.from(document.querySelectorAll('#metrics-body .kpi b')).map(b => b.textContent), cards: Array.from(document.querySelectorAll('#metrics-body .summary-card h4')).map(h => h.textContent), bars: document.querySelectorAll('#metrics-body .mbar').length, trend: document.querySelectorAll('#metrics-body .trendrow > div').length, firms: document.querySelectorAll('#metrics-body .table .rule-item').length, crumb: document.getElementById('crumb-root').textContent })")
        print('VIEW', v)
        checks['view'] = v['kpis'][0] == '5' and v['kpis'][1] == '33%' and 'Readiness at submission, by week' in v['cards'] and 'Rules the pre-review raises' in v['cards'] and v['bars'] >= 6 and v['trend'] >= 3 and v['firms'] == 2 and v['crumb'] == 'Metrics and audit'
        tr = await page.evaluate("() => Array.from(document.querySelectorAll('#metrics-body .trendrow > div small:first-child')).map(s => s.textContent)")
        checks['trend_values'] = tr == [str(w['readiness']) for w in m['trend']] and len(tr) >= 3
        await page.screenshot(path=os.path.join(ROOT, 'tests', 'out', 'metrics.png'), full_page=True)
        # ---- audit chain
        au = await page.evaluate("""async () => {
          const ch = await Audit.chain(UI.S.inbox, { by: { name: 'Ana Ruiz' } });
          const ok = await Audit.verify(ch);
          const tampered = JSON.parse(JSON.stringify(ch)); tampered.records[1].data.by = 'Someone Else';
          const t = await Audit.verify(tampered);
          const removed = JSON.parse(JSON.stringify(ch)); removed.records.splice(2, 1);
          const r = await Audit.verify(removed);
          const reheaded = JSON.parse(JSON.stringify(ch)); reheaded.head = 'ff';
          const h = await Audit.verify(reheaded);
          const empty = await Audit.chain([]);
          const truncated = JSON.parse(JSON.stringify(ch)); truncated.records.splice(ch.records.length - 2, 2); // drop the last event and the seal: a shortened file
          const tr = await Audit.verify(truncated);
          const roundtrip = await Audit.verify(JSON.parse(JSON.stringify(ch)));
          const undef = await Audit.chain([{ id: 'u1', created_at: '2026-09-01T10:00:00Z', lane: undefined, file: { name: 'u.pdf' }, findings: [], responses: { f1: null }, history: [null, { at: '2026-09-01T11:00:00Z', by: 'X', event: 'approve' }] }]);
          const undefOk = (await Audit.verify(JSON.parse(JSON.stringify(undef)))).ok;
          const wrongHead = await Audit.verify(JSON.parse(JSON.stringify(ch)), 'ab'.repeat(32));
          const rightHead = await Audit.verify(JSON.parse(JSON.stringify(ch)), ch.head.toUpperCase());
          return { count: ch.count, types: ch.records.map(x => x.type), ok, t, r, h, tr, roundtrip: roundtrip.ok, undefOk, wrongHead: wrongHead.ok, rightHead: rightHead.ok, first: ch.records[0].prev_hash, hashes: ch.records.every(x => /^[0-9a-f]{64}$/.test(x.hash)), chained: ch.records.every((x, i) => i === 0 || x.prev_hash === ch.records[i - 1].hash), emptyOk: (await Audit.verify(empty)).ok && empty.count === 1, canon: Audit.canonical({ b: [2, { z: 1, a: null, u: undefined }], a: 'x', f: () => 1 }) };
        }""")
        print('AUDIT', json.dumps({k: au[k] for k in ('count', 'ok', 't', 'r', 'h', 'emptyOk', 'canon')}, indent=1))
        checks['chain_shape'] = au['count'] == 11 and au['types'].count('submitted') == 5 and au['types'].count('decision') == 4 and au['types'].count('verdict') == 1 and au['types'][-1] == 'seal' and au['first'] == '0' * 64 and au['hashes'] and au['chained']
        checks['chain_verifies'] = au['ok']['ok'] and au['ok']['checked'] == 11 and au['ok']['events'] == 10 and au['roundtrip'] and au['undefOk']
        checks['truncation_detected'] = (not au['tr']['ok']) and 'seal' in au['tr']['error']
        checks['expected_head'] = (not au['wrongHead']) and au['rightHead']
        checks['tamper_detected'] = (not au['t']['ok']) and au['t']['brokenAt'] == 2 and 'altered' in au['t']['error']
        checks['removal_detected'] = (not au['r']['ok']) and au['r']['brokenAt'] == 3
        checks['head_checked'] = (not au['h']['ok']) and 'head' in au['h']['error']
        checks['empty_chain'] = au['emptyOk']
        checks['canonical'] = au['canon'] == '{"a":"x","b":[2,{"a":null,"z":1}]}'  # undefined and functions dropped like JSON.stringify
        # ---- export button
        await page.click('#btn-audit-export'); await page.wait_for_timeout(600)
        ex = await page.evaluate("() => ({ saved: window.__saved.map(s => s.filename), out: document.getElementById('audit-out').textContent, parsed: (() => { try { return JSON.parse(window.__saved[0].text).count; } catch (e) { return -1; } })() })")
        print('EXPORT', ex['saved'], ex['out'][:80]); checks['export'] = len(ex['saved']) == 1 and ex['saved'][0].startswith('prescreen-audit-') and ex['parsed'] == 11 and '11 records' in ex['out']
        await browser.close()
    bad = [k for k, v in checks.items() if not v]
    print('ALL OK' if not bad else 'FAILURES: ' + ', '.join(bad)); sys.exit(1 if bad else 0)
asyncio.run(main())
