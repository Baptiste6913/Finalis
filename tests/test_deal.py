"""Deal file: the deterministic figure scanner (targets, fees, sizes, track record, ranges, tiers on one page),
the consistency check inside a document and across the documents of the same deal, and the guards on model
claims (quote located on the page, plausible values). Runs the module in the built page.
Usage: python3 tests/test_deal.py"""
import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
FAKE = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'test_flow.py')).read().split('FAKE = r"""')[1].split('"""')[0]
FAKE = FAKE.replace("return JSON.parse(JSON.stringify(Fixture.batch));", r"""
    if (typeof input === 'string' && input.includes('Extract the figures the material commits to')) return { claims: [
      { key: 'carried_interest', value: '20%', num: 20, unit: '%', page: 1, quote: '20% carried interest' },
      { key: 'management_fee', value: '3%', num: 3, unit: '%', page: 1, quote: 'Management fee of 2% per year' },
      { key: 'gp_commitment', value: '2%', num: 2, unit: '%', page: 1, quote: 'The general partner commits 2% of total commitments' },
      { key: 'target_return', value: '99%', num: 99, unit: '%', page: 2, quote: 'nowhere on the page' },
      { key: 'fund_term', value: '900 years', num: 900, unit: 'years', page: 1, quote: 'term of 10 years' },
      { key: 'not_a_key', value: 'x', num: 1, unit: '%', page: 1, quote: 'Management fee of 2%' } ] };
    return JSON.parse(JSON.stringify(Fixture.batch));""")

SCRIPT = r"""
async () => {
  const P = (n, t) => Extract.pageFromText(n, t);
  const pages = [
    P(1, 'Meridian Growth Fund III\nThe Fund targets a net IRR of 20% and a target multiple of 2.5x.\nTarget Fund Size $200M (hard cap $250M). Minimum commitment: $5M for institutions and $250,000 for individuals.\nManagement fee of 2% per year; 20% carried interest over an 8% preferred return; term of 10 years.\nFund II delivered a net IRR of 18% and a realized MOIC of 2.1x. The general partner commits 2% of total commitments.'),
    P(2, 'Summary of terms\nTargeting 25% net IRR over the life of the fund. Target fund size: $200 million.\nCarried interest 20%. Preferred return 8%.'),
    P(3, 'Track record\n41% Gross IRR 30% Net IRR 3.10x MOIC (Fund I, 2015 vintage)\n7.65x Projected TVPI'),
  ];
  const claims = Deal.scan(pages);
  const has = (key, value, page) => claims.some((c) => c.key === key && c.value === value && c.page === page);
  const cons = Deal.consistency({ id: 'draft', form: { bankName: 'Northbridge Advisors', docType: 'deal-deck' }, lane: 'institutional', file: { name: 'Meridian III deck.pdf' }, result: { profile: { subject: 'Meridian Growth Fund III', material_kind: 'fund pitch deck' } }, findings: [] }, claims, [
    { id: 'old1', created_at: '2026-08-01T10:00:00Z', status: 'approved', form: { bankName: 'Northbridge Advisors', docType: 'deal-deck' }, lane: 'institutional', file: { name: 'Meridian III teaser.pdf' }, result: { profile: { subject: 'Meridian Growth Fund III teaser', material_kind: 'teaser' } }, findings: [], claims: [ { key: 'fund_size', unit: 'money', num: 150, value: '$150m', page: 1, quote: 'x' }, { key: 'carried_interest', unit: '%', num: 20, value: '20%', page: 1, quote: 'x' }, { key: 'management_fee', unit: '%', num: 1.5, num2: 2, value: '1.5–2%', page: 1, quote: 'x' } ] },
    { id: 'other', created_at: '2026-08-02T10:00:00Z', status: 'approved', form: { bankName: 'Some Other Bank', docType: 'deal-deck' }, lane: 'institutional', file: { name: 'Meridian III teaser.pdf' }, result: { profile: { subject: 'Meridian Growth Fund III', material_kind: 'teaser' } }, findings: [], claims: [ { key: 'fund_size', unit: 'money', num: 999, value: '$999m', page: 1, quote: 'x' } ] },
  ]);
  const sample = await window.claude.use('sample');
  const ex = await Deal.extract(sample, pages);
  const blank = Deal.scan([P(1, 'Minimum commitment' + ' '.repeat(20000) + '$5M'), P(2, 'targets 1,000% returns; hard cap of $1,5bn; Target IRR 18%–22%')]);
  const twoRanges = Deal.internal([{ key: 'target_return', unit: '%', num: 18, num2: 22, page: 1, value: '18–22%' }, { key: 'target_return', unit: '%', num: 20, num2: null, page: 3, value: '20%' }, { key: 'target_return', unit: '%', num: 25, num2: null, page: 5, value: '25%' }, { key: 'target_return', unit: '%', num: 25, num2: null, page: 7, value: '25%' }]);
  return {
    keys: claims.map((c) => c.key + '=' + c.value + '@' + c.page),
    checks: {
      target_return: has('target_return', '20%', 1) && has('target_return', '25%', 2),
      target_multiple: has('target_multiple', '2.5x', 1),
      fund_size: has('fund_size', '$200m', 1) && has('fund_size', '$200m', 2),
      hard_cap: has('hard_cap', '$250m', 1),
      min_commitment: has('min_commitment', '$5m', 1) && has('min_commitment', '$250k', 1),
      fees: has('management_fee', '2%', 1) && has('carried_interest', '20%', 1) && has('carried_interest', '20%', 2) && has('preferred_return', '8%', 1) && has('preferred_return', '8%', 2),
      term: has('fund_term', '10 years', 1),
      track_record: has('track_record_irr', '18%', 1) && has('track_record_multiple', '2.1x', 1) && has('track_record_irr', '41%', 3) && has('track_record_irr', '30%', 3) && has('track_record_multiple', '3.1x', 3),
      no_target_from_table: !claims.some((c) => c.key === 'target_return' && c.page === 3) && !claims.some((c) => c.key === 'target_multiple' && c.page === 3),
      ranges_agree: Deal.agree({ num: 20, num2: null }, { num: 18, num2: 22 }) && !Deal.agree({ num: 20, num2: null }, { num: 25, num2: null }) && Deal.agree({ num: 1.5, num2: 2 }, { num: 2, num2: null }),
      internal_contradiction: cons.internal.length === 1 && cons.internal[0].key === 'target_return' && /20% \(p\. 1\) and as 25% \(p\. 2\)/.test(cons.internal[0].text),
      one_per_figure: twoRanges.length === 1 && twoRanges[0].values.length === 2 && /18–22% \/ 20% \(p\. 1, 3\) and as 25% \(p\. 5, 7\)/.test(twoRanges[0].text),
      no_backtracking: blank.some((c) => c.key === 'min_commitment' && c.num === 5) && !blank.some((c) => c.value === '0%') && blank.some((c) => c.key === 'hard_cap' && c.num === 1500) && blank.some((c) => c.key === 'target_return' && c.num === 18 && c.num2 === 22),
      deal_contradiction: cons.deal.length === 1 && cons.deal[0].key === 'fund_size' && cons.deal[0].values[1].doc === 'Meridian III teaser.pdf',
      deal_file_scope: cons.file.length === 1 && cons.file[0].id === 'old1',
      model_guarded: ex.source === 'model+scan' && ex.claims.some((c) => c.key === 'carried_interest' && c.source === 'model+scan') && ex.claims.some((c) => c.key === 'gp_commitment' && c.source === 'model' && c.num === 2) && !ex.claims.some((c) => c.value === '99%') && !ex.claims.some((c) => c.num === 900) && !ex.claims.some((c) => c.key === 'not_a_key') && ex.claims.filter((c) => c.key === 'management_fee').every((c) => c.num === 2),
      same_deal_gate: Deal.sameDeal({ id: 'a', form: { bankName: 'Northbridge Advisors', docType: 'deal-deck' }, lane: 'institutional', file: { name: 'Meridian III deck.pdf' }, result: { profile: { subject: 'Meridian Growth Fund III' } }, findings: [] }, { id: 'b', form: { bankName: 'Northbridge Advisors', docType: 'deal-deck' }, lane: 'institutional', file: { name: 'Atlas Credit Opportunities I teaser.pdf' }, result: { profile: { subject: 'Atlas Credit Opportunities Fund I' } }, findings: [] }) === false,
    },
    cons: { internal: cons.internal.map((x) => x.text), deal: cons.deal.map((x) => x.text) },
  };
}
"""
async def main():
    async with async_playwright() as pw:
        browser, page = await open_page(pw, init_script=FAKE)
        await page.wait_for_timeout(400)
        r = await page.evaluate(SCRIPT)
        print('CLAIMS', r['keys'])
        print('CONSISTENCY', json.dumps(r['cons'], indent=1))
        for k, v in r['checks'].items(): print('%-26s %s' % (k, 'ok' if v else 'FAIL'))
        await browser.close()
    bad = [k for k, v in r['checks'].items() if not v]
    print('ALL OK' if not bad else 'FAILURES: ' + ', '.join(bad)); sys.exit(1 if bad else 0)
asyncio.run(main())
