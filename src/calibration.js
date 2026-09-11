'use strict';
/* Reviewer ground truth for the calibration deck (Quartus AI Fund II LP, institutional lane), taken
   from the Finalis finding sheet: which machine flags the compliance reviewer validated, which ones
   they rejected, and which were left without a verdict. A live run on that deck is scored against it. */
const Calibration = (() => {
  const EXPECTED = [
    { label: 'A1a · Finalis disclaimer missing', test: (f) => /^A1/.test(f.rule) },
    { label: 'A3 · "For Institutional Investors Only" on the first page', test: (f) => f.rule === 'A3' },
    { label: 'A7 · Source on the chart, page 16', test: (f) => f.rule === 'A7' && has(f, 16) },
    { label: 'B8 · Award disclosure, page 1', test: (f) => f.rule === 'B8' && has(f, 1) },
    { label: 'B6 · Service provider logos, page 23', test: (f) => f.rule === 'B6' && has(f, 23) },
    { label: 'B4 · Preferred return disclosure, page 27', test: (f) => f.rule === 'B4' && has(f, 27) },
    { label: 'C · "Led by AI pioneers", page 1', test: (f) => f.tier === 'C' && has(f, 1) && /pioneer/i.test(f.quote + f.title + f.issue) },
    { label: 'C · "trillions of dollars" unsourced, page 6', test: (f) => f.tier === 'C' && has(f, 6) && /trillion/i.test(f.quote + f.title + f.issue) },
    { label: 'C · "attractive long-term growth potential", page 17', test: (f) => f.tier === 'C' && has(f, 17) && /attractive|growth potential/i.test(f.quote + f.title) },
  ];
  const FALSE_POSITIVES = [
    { label: 'A1b broker-dealer line requested separately', test: (f) => f.rule === 'A1b' },
    { label: 'A2 "separate, unaffiliated" on deal material', test: (f) => f.rule === 'A2' },
    { label: 'A7 on a team, terms or sourced page (7, 9, 25, 27)', test: (f) => f.rule === 'A7' && hasAny(f, [7, 9, 25, 27]) },
    { label: 'B1/B2 despite the disclaimers page (3, 4, 9, 25, 27)', test: (f) => /^B[12]$/.test(f.rule) && hasAny(f, [3, 4, 9, 25, 27]) },
    { label: 'B3 despite "past performance is not indicative" (3, 4, 6, 7, 9, 25)', test: (f) => f.rule === 'B3' && hasAny(f, [3, 4, 6, 7, 9, 25]) },
    { label: 'B9 real estate on a venture fund', test: (f) => f.rule === 'B9' },
    { label: 'B10 audience from risk wording', test: (f) => f.rule === 'B10' && (has(f, 3) || /your investment/i.test(f.quote)) },
    { label: 'B6 on bios, values, focus areas or portfolio (7, 8, 12, 17, 25)', test: (f) => f.rule === 'B6' && hasAny(f, [7, 8, 12, 17, 25]) },
    { label: 'B8 on the footnoted benchmark, page 6', test: (f) => f.rule === 'B8' && has(f, 6) },
    { label: 'Language flag on the disclaimers or risk pages (3, 4)', test: (f) => f.tier === 'C' && hasAny(f, [3, 4]) },
    { label: 'Formatting or complexity point on institutional material', test: (f) => /^C1[234]$/.test(f.rule) },
    { label: 'Award name treated as a superlative, page 1', test: (f) => f.tier === 'C' && has(f, 1) && /award/i.test(f.quote) && !/pioneer/i.test(f.quote) },
    { label: '"We believe … best" or "largest global institutions", page 6', test: (f) => f.tier === 'C' && has(f, 6) && /best risk|largest global|to deliver strong/i.test(f.quote) },
    { label: 'Fair-and-balanced per page (6, 7, 13, 17, 21)', test: (f) => f.rule === 'C9' && hasAny(f, [6, 7, 13, 17, 21]) },
    { label: 'Substantiation of team bios, page 7', test: (f) => f.tier === 'C' && has(f, 7) },
    { label: '"7.65x Projected" or "Past Fund", page 9', test: (f) => f.tier === 'C' && has(f, 9) },
    { label: '"superior" in the mission statement, page 11', test: (f) => f.tier === 'C' && has(f, 11) },
    { label: 'Aspirational plan language, page 13', test: (f) => f.tier === 'C' && has(f, 13) },
    { label: 'Sourced third-party data or "we believe", page 15', test: (f) => f.tier === 'C' && has(f, 15) },
    { label: 'Key target metrics, page 16', test: (f) => f.tier === 'C' && has(f, 16) && /margin of safety|10x|liquidity/i.test(f.quote) },
    { label: '"knowledge edge", page 17', test: (f) => f.tier === 'C' && has(f, 17) && /knowledge edge/i.test(f.quote) },
    { label: '"designed to deliver" with the illustrative legend, page 18', test: (f) => f.tier === 'C' && has(f, 18) },
    { label: 'Footnoted criteria, page 20', test: (f) => f.tier === 'C' && has(f, 20) },
  ];
  const OPEN = [
    { label: 'p.21 "Investor of choice" / "Market credibility" / "To Achieve 4x" (no verdict)', test: (f) => f.tier === 'C' && has(f, 21) },
    { label: 'p.22 "proven business models" / "lower valuation than our VC/PE peers" (no verdict)', test: (f) => f.tier === 'C' && has(f, 22) },
    { label: 'p.27 "Target Return: 4x TVPI, 20% IRR" (no verdict)', test: (f) => f.tier === 'C' && has(f, 27) },
    { label: 'p.27 "$100K for individual investors" audience confirmation (no verdict)', test: (f) => f.rule === 'B10' && has(f, 27) },
  ];
  function has(f, n) { return f.page === n || (f.pages || []).includes(n); }
  function hasAny(f, list) { return list.some((n) => has(f, n)); }

  function isReferenceDeck(pages) {
    if (!pages || pages.length !== 28) return false;
    const first = (pages[0].search || '');
    return /quartus ai fund ii/.test(first) && /best performance award 2024/.test(first);
  }

  function score(findings) {
    const expected = EXPECTED.map((e) => { const hit = findings.find(e.test); return { label: e.label, hit: !!hit, id: hit ? hit.id : null }; });
    const fps = FALSE_POSITIVES.map((e) => { const hit = findings.find(e.test); return { label: e.label, raised: !!hit, id: hit ? hit.id : null }; });
    const open = OPEN.map((e) => { const hit = findings.find(e.test); return { label: e.label, raised: !!hit, id: hit ? hit.id : null }; });
    return {
      expected, falsePositives: fps, open,
      recall: expected.filter((e) => e.hit).length, expectedTotal: expected.length,
      fpCount: fps.filter((e) => e.raised).length, fpTotal: fps.length,
      openCount: open.filter((e) => e.raised).length,
    };
  }
  return { isReferenceDeck, score };
})();
