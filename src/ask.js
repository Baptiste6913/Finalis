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
  /* reviewer platform: the decision message to the banker, drafted from the verdicts and the corrections */
  async function decision(sample, sub, kind, ctx, signal) {
    const findings = sub.findings || []; const verdicts = sub.verdicts || {};
    const confirmed = findings.filter((f) => (Review.isCertain(f) && !(verdicts[f.id] && verdicts[f.id].verdict === 'incorrect')) || (verdicts[f.id] && verdicts[f.id].verdict === 'correct'));
    const dismissed = findings.filter((f) => verdicts[f.id] && verdicts[f.id].verdict === 'incorrect');
    const resolved = sub.resolved || [];
    const lines = [
      'Decision: ' + (kind === 'approve' ? 'approved' : kind === 'escalate' ? 'escalated to the Chief Compliance Officer' : 'changes requested'),
      'Document: ' + sub.file.name + ' (' + (sub.file.pages || '?') + ' pages), lane ' + (sub.lane || 'retail') + ', submitted by ' + (sub.submitter || 'the banker') + (sub.form && sub.form.bankName ? ' at ' + sub.form.bankName : ''),
      sub.version > 1 ? 'The banker corrected the file in the app (version ' + sub.version + '): ' + (sub.changes || []).slice(0, 12).map((c) => 'p. ' + c.page + ' ' + (c.label || c.kind)).join('; ') : 'No corrections were made in the app.',
      resolved.length ? 'Resolved by the corrections: ' + resolved.map((r) => r.rule + (r.page ? ' p. ' + r.page : '') + ' ' + r.title).join('; ') : '',
      'Points that stand (' + confirmed.length + '): ' + confirmed.slice(0, 15).map((f) => f.rule + (f.page ? ' p. ' + f.page : '') + ' ' + f.title + (f.text_to_add ? ' [add: ' + f.text_to_add.slice(0, 120) + ']' : f.rewrite ? ' [rewrite: ' + f.rewrite.slice(0, 120) + ']' : '') + (sub.responses && sub.responses[f.id] && sub.responses[f.id].status !== 'none' ? ' (banker: ' + sub.responses[f.id].status + (sub.responses[f.id].note ? ', ' + sub.responses[f.id].note : '') + ')' : '') + (verdicts[f.id] && verdicts[f.id].reason ? ' (reviewer comment: ' + verdicts[f.id].reason.slice(0, 160) + ')' : '')).join('; '),
      dismissed.length ? 'Dismissed after verification (do not mention as issues): ' + dismissed.map((f) => f.rule + ' ' + f.title).join('; ') : '',
    ].filter(Boolean).join('\n');
    const prompt = 'You are a FINRA 2210 compliance reviewer at a broker-dealer writing the decision email to the banker who submitted marketing material. Write the email body only (no subject line, no signature block beyond a first name placeholder), in plain professional English, short paragraphs, at most 220 words. State the decision in the first sentence. List what must change as a numbered list only if changes are requested, each item naming the page and the exact text to add or the rewrite. Acknowledge the corrections the banker already made when there are any. Never mention points that were dismissed. No exclamation marks, no filler.\n\n' + lines;
    const r = await sample(prompt, { modelTier: 'quick', cache: false, signal });
    return r.text.trim();
  }
  /* document-level conversation: the rulebook, the pre-review and the text of the pages relevant to the question */
  function docContext(ctx, findings, q) {
    const pages = ctx.pages || [];
    const wanted = new Set();
    const m = String(q || '').match(/\b(?:page|p\.?|slide)\s*(\d{1,3})/gi) || [];
    m.forEach((x) => { const n = parseInt(x.replace(/\D/g, ''), 10); if (n) wanted.add(n); });
    (findings || []).forEach((f) => { if (f.page) wanted.add(f.page); });
    let budget = 14000; const parts = [];
    const order = pages.slice().sort((a, b) => (wanted.has(a.number) ? 0 : 1) - (wanted.has(b.number) ? 0 : 1) || a.number - b.number);
    order.forEach((p) => { if (budget <= 0) return; const t = Prompts.cleanText(p.text || '').slice(0, wanted.has(p.number) ? 2600 : 900); if (!t.trim()) return; budget -= t.length; parts.push('[page ' + p.number + '] ' + t); });
    parts.sort((a, b) => parseInt(a.slice(6), 10) - parseInt(b.slice(6), 10));
    return parts.join('\n');
  }
  async function chat(sample, history, ctx, findings, q, onText, signal) {
    const points = (findings || []).map((f) => f.rule + (f.page ? ' p. ' + f.page : '') + ' [' + (f.severity || '') + (f.assurance === 'verify' ? ', pending verification' : '') + '] ' + f.title + (f.quote ? ' — "' + f.quote.slice(0, 120) + '"' : '')).join('\n');
    const convo = (history || []).slice(-6).map((m) => (m.role === 'user' ? 'Banker: ' : 'Reviewer: ') + m.text).join('\n');
    const prompt = 'You are a FINRA 2210 compliance reviewer at a broker-dealer answering questions about one piece of marketing material that went through an AI pre-review. Answer from the document text and the pre-review below; cite pages; when the answer depends on facts you do not have, say what to check. At most 6 sentences, plain words, no headings, no bullet points unless the user asks for a list.\n\nRULEBOOK SUMMARY:\n' + RULES.RULEBOOK.slice(0, 2400) + '\n\nLANE: ' + (ctx.lane || 'retail') + '; DOCUMENT: ' + (ctx.docLabel || '') + '\n\nPRE-REVIEW POINTS:\n' + (points || '(none)') + '\n\nDOCUMENT TEXT (excerpts):\n' + docContext(ctx, findings, q) + (convo ? '\n\nCONVERSATION SO FAR:\n' + convo : '') + '\n\nQUESTION: ' + q;
    const r = await sample(prompt, { modelTier: 'default', cache: false, onText, signal });
    return r.text;
  }
  return { why, alternatives, question, decision, chat, GUIDE };
})();
