'use strict';
/* On-demand Claude helpers scoped to one attention point (quick tier, small prompts):
   plain-words explanation, alternative wordings, a free question. */
const Ask = (() => {
  const RULE_CONTEXT = {
    B1: RULES.SOP.forecast, B2: RULES.SOP.illustration, B3: RULES.SOP.past_perf, B4: RULES.SOP.pref, B5: RULES.SOP.distributions,
    B6: RULES.SOP.logos, B7: RULES.SOP.testimonial, B9: RULES.SOP.real_estate, B11: RULES.SOP.linkedin_cta, B12: RULES.SOP.email_short, A7: RULES.SOP.source,
  };
  const GUIDE = {
    C1: 'Language Guide 2(a): superlatives and absolutes (best, unique, proven, guaranteed, industry-leading) are unwarranted unless substantiated; qualify ("strives to", "one of the") or source them.',
    C2: 'Language Guide 2(h): promissory language (will, always, certainly, guarantees, mitigates the risk) about returns, cash flow or risk is not allowed; state targets and mechanisms, not outcomes.',
    C3: 'Language Guide 3(b): fear, urgency or pressure ("invest now", "limited time", "you don\'t want to lose out") is not permitted.',
    C4: 'Language Guide, lack of substantiation: factual claims need a source; opinions must be framed as opinions ("we believe"). Self-endorsements are avoided.',
    C5: 'Language Guide 3(e): disparaging statements about competitors, the industry or regulators are not permitted.',
    C6: 'Language Guide 3(f) and the institutional framework: comparisons to other funds, investments or firms must be fair, supportable and disclose material differences; close calls are escalated.',
    C7: 'Language Guide 3(g): legal or disciplinary history must be accurate and not misleadingly incomplete.',
    C8: 'Language Guide (c): realized performance must show all realized holdings with equal prominence; no cherry-picking.',
    C9: 'FINRA 2210(d)(1) and the framework: the overall impression must be fair and balanced; material limitations, assumptions and risks must not be omitted.',
    C10: 'Framework: third-party material must be attributed accurately and not distorted.',
    C11: 'Language Guide 3(d): promissory images (money trees, gold, luxury) must be removed.',
    C12: 'Language Guide 3(c): technical content must be explained for a retail audience.',
    C13: 'Language Guide 2(b): bolding and underlining reserved for headings.',
    C14: 'Language Guide 2(c): FINRA recommends 10 pt in a general-size advertisement.',
  };
  function excerpt(pages, f) {
    if (!f.page) return '';
    const page = pages.find((p) => p.number === f.page);
    if (!page) return '';
    const text = Prompts.cleanText(page.text || '');
    if (!f.quote) return text.slice(0, 900);
    const loc = Engine.locate(page, f.quote);
    if (!loc) return text.slice(0, 900);
    const raw = page.text || '';
    const from = Math.max(0, loc.start - 450);
    const to = Math.min(raw.length, loc.end + 450);
    return Prompts.cleanText(raw.slice(from, to));
  }
  function context(f, ctx) {
    const lines = [
      'Rule: ' + f.rule + ' (' + (f.category || '') + ')', 'Lane: ' + (ctx.lane || 'retail') + '; document: ' + (ctx.docLabel || ''),
      'Attention point: ' + f.title, 'Issue: ' + (f.issue || ''), 'Basis: ' + (f.basis || ''),
    ];
    if (f.quote) lines.push('Quoted text (page ' + f.page + '): "' + f.quote + '"');
    if (RULE_CONTEXT[f.rule]) lines.push('SOP disclosure text: "' + RULE_CONTEXT[f.rule] + '"');
    if (GUIDE[f.rule]) lines.push('Standard: ' + GUIDE[f.rule]);
    if (f.text_to_add) lines.push('Text to add: "' + f.text_to_add.slice(0, 600) + '"');
    if (f.rewrite) lines.push('Suggested rewrite: "' + f.rewrite + '"');
    const ex = excerpt(ctx.pages || [], f);
    if (ex) lines.push('Page context: ' + ex.slice(0, 1400));
    return lines.join('\n');
  }
  async function why(sample, f, ctx, onText, signal) {
    const prompt = 'You are a FINRA 2210 compliance reviewer at a broker-dealer explaining an attention point to a banker. In at most 4 short sentences, plain words, no headings: why this was raised, what the risk is for the reader of the material, and the smallest change that resolves it. If the point is a close call, say so.\n\n' + context(f, ctx);
    const r = await sample(prompt, { modelTier: 'quick', onText, signal });
    return r.text;
  }
  async function alternatives(sample, f, ctx, signal) {
    const prompt = 'Propose 3 alternative wordings for the quoted sentence that keep its meaning and make it compliant (no superlatives stated as fact, no promised outcome, opinions framed as opinions, targets labelled as targets). Reply with only a JSON array of 3 strings.\n\n' + context(f, ctx);
    const arr = await sample.json(prompt, { modelTier: 'quick', signal });
    return Array.isArray(arr) ? arr.map((s) => String(s)).filter(Boolean).slice(0, 3) : [];
  }
  async function question(sample, f, ctx, q, onText, signal) {
    const prompt = 'You are a FINRA 2210 compliance reviewer at a broker-dealer answering a banker\'s question about one attention point. Answer in at most 5 sentences, plain words, no headings. Be precise about the rule; if the answer depends on facts you do not have, say what to confirm.\n\n' + context(f, ctx) + '\n\nBanker\'s question: ' + q.slice(0, 500);
    const r = await sample(prompt, { modelTier: 'quick', cache: false, onText, signal });
    return r.text;
  }
  return { why, alternatives, question, GUIDE };
})();
