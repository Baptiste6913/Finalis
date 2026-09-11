'use strict';
/* Prompt builders. Everything the model sees is assembled here, within the 64 KiB input cap. */
const Prompts = (() => {
  const DOC_LABELS = { 'deal-deck': 'Marketing Deck and Investor Communication (deal-related)', 'firm-marketing': 'Firm Marketing Material (non-deal)', email: 'Email or Letter', 'linkedin-post': 'LinkedIn Post', 'linkedin-profile': 'LinkedIn Profile', article: 'Article, Newsletter or Educational Content', website: 'Website or Blog', other: 'Other' };
  const INVOLVED = { banker: 'the banker (registered representative)', 'third-party': 'a third party (issuer or company)', both: 'the banker and a third party' };

  function cleanText(text) {
    return (text || '').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{2,}/g, '\n').trim();
  }
  function questionnaire(form, facts) {
    const lines = [
      'Document type: ' + (DOC_LABELS[form.docType] || form.docType),
      'Audience declared by the banker: ' + (form.audience === 'institutional' ? 'institutional investors only' : form.audience === 'retail' ? 'includes natural persons or more than 25 retail investors' : 'not sure'),
      'Lane resolved: ' + facts.lane + ' (' + facts.laneReason + ')',
      'Distribution: ' + ((form.distribution || []).join(', ') || 'not stated'),
      'Prepared by: ' + (INVOLVED[form.involvement] || 'not stated'),
      'Bank / DBA: ' + (form.bankName || 'not stated'),
    ];
    if (form.notes) lines.push('Banker notes: ' + form.notes.slice(0, 600));
    return lines.join('\n');
  }
  function factsBlock(facts) {
    const req = facts.required.map((r) => {
      let s = r.id + ' ' + r.name + ': ';
      if (r.status === 'present') s += 'PRESENT on page ' + r.page + ' (match ' + Math.round(r.score) + '%' + (r.minSize ? ', ' + r.minSize + ' pt' : '') + ')';
      else if (r.status === 'illegible') s += 'PRESENT on page ' + r.page + ' but set at ' + r.minSize + ' pt (below the 7 pt floor)';
      else if (r.status === 'forbidden_present') s += 'PRESENT on page ' + r.page + ' although it must not appear on retail material';
      else if (r.status === 'clear') s += 'not present (correct for this lane)';
      else if (r.status === 'conditional') s += 'not present (' + r.conditional + ')';
      else s += 'MISSING' + (r.near ? ' (' + r.near + ')' : '');
      return '- ' + s;
    });
    const found = facts.coverage.filter((c) => c.found).map((c) => c.label + ' (p' + c.page + ': "' + c.excerpt.slice(0, 70) + '")');
    const notFound = facts.coverage.filter((c) => !c.found).map((c) => c.label);
    const stats = facts.stats.map((s) => 'p' + s.page + ':' + s.chars + 'c/' + s.images + 'img/' + s.numbers + 'fig' + (s.exhibit ? '/EXHIBIT' : '') + (s.role ? '/' + s.role : ''));
    const exhibits = facts.stats.filter((s) => s.exhibit).map((s) => s.page);
    return ['Required blocks (Tier A, deterministic, final):', ...req, '', 'Verbatim SOP wording found (fuzzy): ' + (found.length ? found.join('; ') : 'none'), 'Not found verbatim: ' + notFound.join(', '), '', 'Page statistics (chars/images/distinct figures/hint): ' + stats.join(' '), exhibits.length ? 'EXHIBIT = the text layer is a series of periods or categories paired with values, or a titled chart/table of figures: treat these pages as charts or statistical exhibits for A7 even though a vector-drawn chart leaves no image object. Pages: ' + exhibits.join(', ') + '.' : ''].filter(Boolean).join('\n');
  }
  function candidatesBlock(facts) {
    const skip = new Set(facts.stats.filter((s) => s.role === 'disclaimers' || s.role === 'risk factors').map((s) => s.page));
    const byRule = {};
    facts.triggers.filter((t) => !skip.has(t.page)).forEach((t) => { (byRule[t.id] = byRule[t.id] || []).push('p' + t.page + ' [' + t.terms.slice(0, 5).join(', ') + (t.images ? ', ' + t.images + ' img' : '') + ']'); });
    const trig = Object.keys(byRule).map((id) => '- ' + id + ': ' + byRule[id].join('; '));
    const seenLex = new Set();
    const lex = facts.lexicon.filter((l) => !skip.has(l.page)).filter((l) => { const k = l.id + '|' + l.page + '|' + l.phrase; if (seenLex.has(k)) return false; seenLex.add(k); return true; }).slice(0, 36).map((l) => '- ' + l.id + ' p' + l.page + ' "' + l.phrase + '": ' + l.context.slice(0, 100));
    return ['Trigger candidates from the deterministic scanner (a naive scanner would raise all of these; most are wrong, decide each with the coverage map and the calibration rules)' + (skip.size ? '; candidates on the disclaimers and risk-factor pages (' + Array.from(skip).join(', ') + ') are omitted' : '') + ':', ...(trig.length ? trig : ['- none']), '', 'Lexicon hits (same caveat):', ...(lex.length ? lex : ['- none'])].join('\n');
  }
  function isBoilerplate(role) { return /disclaim|risk factor/i.test(role || ''); }
  function pagesBlock(pages, roles, budget, condenseBoilerplate) {
    const texts = pages.map((p) => {
      let t = cleanText(p.text);
      const role = roles && roles[p.number] ? roles[p.number] : '';
      if (condenseBoilerplate && isBoilerplate(role) && t.length > 1800) t = t.slice(0, 1300) + ' […disclaimer page condensed; the coverage map above lists what it covers…] ' + t.slice(t.length - 400);
      return { n: p.number, t, role };
    });
    let total = texts.reduce((a, x) => a + x.t.length, 0);
    if (total > budget) {
      // proportional trim, keeping the head and the tail of long pages (footnotes live at the end)
      const factor = budget / total;
      texts.forEach((x) => {
        const allowed = Math.max(300, Math.floor(x.t.length * factor));
        if (x.t.length > allowed) {
          const head = Math.floor(allowed * 0.62);
          const tail = allowed - head;
          x.t = x.t.slice(0, head) + ' […trimmed…] ' + x.t.slice(x.t.length - tail);
        }
      });
    }
    return texts.map((x) => '=== Page ' + x.n + (x.role ? ' (' + x.role + ')' : '') + ' ===\n' + (x.t || '(no text on this page)')).join('\n\n');
  }

  function profilePrompt(form, facts, pages, maxBytes) {
    const head = [
      'You prepare a compliance pre-review of a marketing communication under FINRA Rule 2210 for a broker-dealer. This is the FIRST pass: read the whole material and map it. Do not list findings yet. Be literal about what the pages say; quote verbatim.',
      '',
      '## Questionnaire', questionnaire(form, facts), '',
      '## Deterministic facts', factsBlock(facts), '',
      '## Output', RULES.PROFILE_SCHEMA, '',
      '## Material (text layer, page by page)',
    ].join('\n');
    const budget = Math.max(6000, maxBytes - U.byteLength(head) - 1500);
    return head + '\n' + pagesBlock(pages, null, budget);
  }

  function findingsPrompt(form, facts, profile, pages, batchInfo, memory, maxBytes, imagePages) {
    const parts = [
      RULES.RULEBOOK, '',
      '## Questionnaire', questionnaire(form, facts), '',
      '## Deterministic facts', factsBlock(facts), '',
      '## Document profile (first pass, whole material)', JSON.stringify(profile), '',
      '## Candidates', candidatesBlock(facts), '',
    ];
    parts.push(...memoryBlock(memory));
    if (imagePages && imagePages.length) parts.push('## Attached images', 'Page renders are attached in this order: ' + imagePages.map((n) => 'page ' + n).join(', ') + '. Use them only for visual questions: whether a page carries a chart or statistical exhibit, whether logos belong to third parties presented as relationships, whether photos are team portraits, and whether any image is promissory (money, gold, luxury).', '');
    parts.push('## Output', RULES.FINDINGS_SCHEMA, '');
    if (batchInfo && batchInfo.batches > 1) parts.push('This is batch ' + batchInfo.index + ' of ' + batchInfo.batches + ' (pages ' + batchInfo.from + ' to ' + batchInfo.to + '). Findings, suppressed candidates and the brief must concern these pages only; the coverage map covers the whole material. The brief and banker_message may be short in batches after the first.', '');
    parts.push('## Material text, pages ' + pages[0].number + ' to ' + pages[pages.length - 1].number);
    const head = parts.join('\n');
    const budget = Math.max(4000, maxBytes - U.byteLength(head) - 1200);
    return { prompt: head + '\n' + pagesBlock(pages, profile && profile.page_roles, budget, true), headBytes: U.byteLength(head) };
  }

  function memoryBlock(memory) {
    if (!memory) return [];
    const rules = Array.isArray(memory) ? [] : (memory.rules || []);
    const verdicts = Array.isArray(memory) ? memory : (memory.verdicts || []);
    const out = [];
    if (rules.length) out.push('## Learned calibration rules (distilled from this desk\'s verdicts; apply them like the numbered calibration rules)', rules.map((r, i) => 'L' + (i + 1) + '. ' + r).join('\n'), '');
    if (verdicts.length) out.push('## Reviewer verdicts on earlier pre-reviews (closest precedents; follow them)', verdicts.map((m) => '- ' + m).join('\n'), '');
    return out;
  }
  function excerptAround(page, quote, radius) {
    if (!page) return '';
    const raw = page.text || '';
    if (!quote) return cleanText(raw).slice(0, radius * 2);
    const loc = Engine.locate(page, quote);
    if (!loc) return cleanText(raw).slice(0, radius * 2);
    return cleanText(raw.slice(Math.max(0, loc.start - radius), Math.min(raw.length, loc.end + radius)));
  }
  /* Verifier pass: a senior reviewer checks each candidate against the calibration rules and the page context. */
  function verifyPrompt(form, facts, profile, findings, pages, memory, maxBytes) {
    const cal = '## CALIBRATION RULES' + (RULES.RULEBOOK.split('## CALIBRATION RULES')[1] || '');
    const lanes = RULES.RULEBOOK.slice(RULES.RULEBOOK.indexOf('## Lanes'), RULES.RULEBOOK.indexOf('## Tier A'));
    const parts = [
      'You are the senior compliance reviewer checking a colleague\'s pre-review of a marketing communication under FINRA Rule 2210 before it goes to the banker. For each candidate attention point decide: keep (a reviewer would send it), drop (a reviewer would not raise it), or downgrade (raise it, but at a lower severity or as a close call to escalate). Apply the calibration rules strictly; they encode the desk\'s past verdicts. Be as literal as the reviewer: a claim framed as belief, a target labelled as a target, a bio, a footnoted source, a disclosure already on the disclaimers page are NOT points. Do not add new points.',
      'Two kinds of candidate, two tests. Language candidates (C1 to C19) are judged under the language rules 9 and 10. Disclosure candidates (A7, B1 to B13) are requirements of the SOP: judge them only on whether the required disclosure, or an equivalent addressing the same item, is present where the SOP requires it (see calibration rule 3 for what counts as equivalent and where). Never drop a disclosure candidate under a language rule (9(a) to 9(h)), because the wording is factual, because the item is "quoted as received", or because a general forward-looking or risk line exists elsewhere; drop it only when the coverage map or the page context shows the item-specific disclosure text. Keep A7 when the page is an EXHIBIT and carries no source line. Language candidates whose quoted passage is framed as an opinion or an aim ("we believe", "we think", "in our view", "we aim", "we seek", "designed to", "has the potential", "our mission") are DROPPED under rule 9(a), not downgraded: a low-severity note on an opinion is still noise for the reviewer.',
      '', lanes.trim(), '', cal.trim(), '',
      '## Questionnaire', questionnaire(form, facts), '',
      '## Coverage map and page roles (from the whole-document pass)', JSON.stringify({ coverage: profile.coverage || {}, page_roles: profile.page_roles || {}, sources_on_pages: profile.sources_on_pages || {}, notes: profile.notes || [] }), '',
    ];
    parts.push(...memoryBlock(memory));
    parts.push('## Candidates');
    const budget = Math.max(3000, maxBytes - U.byteLength(parts.join('\n')) - 2500);
    const per = Math.max(300, Math.floor(budget / Math.max(1, findings.length)));
    findings.forEach((f) => {
      const page = pages.find((p) => p.number === f.page);
      const ctx = excerptAround(page, f.quote, Math.min(500, Math.floor(per / 2))).slice(0, per);
      parts.push(JSON.stringify({ id: f.id, rule: f.rule, severity: f.severity, page: f.page, pages: f.pages, quote: f.quote, title: f.title, issue: f.issue, basis: f.basis, action: f.action }), 'Page context: ' + ctx, '');
    });
    parts.push('## Output', 'Reply with only a JSON array, one entry per candidate id: [{"id": "f5", "verdict": "keep" | "drop" | "downgrade", "severity": "high" | "medium" | "low", "reason": "one sentence citing the rule or calibration rule"}]. Every candidate id must appear exactly once.');
    return parts.join('\n');
  }

  function transcribePrompt(form) {
    return 'The attached image is a marketing communication (' + (DOC_LABELS[form.docType] || 'document') + ') submitted for compliance pre-review. Transcribe every piece of text in it, in reading order, preserving line breaks, headings, footnotes and any legend or disclaimer verbatim. Also describe any logos, charts, photos or illustrations in one line each, prefixed with [visual]. Reply with only a JSON object: {"text": "the transcription", "visuals": ["..."]}.';
  }

  /* Plan the findings batches so each prompt fits the cap. */
  function planBatches(pages, headBytes, maxBytes, roles) {
    const room = Math.max(6000, maxBytes - headBytes - 1500);
    const sizes = pages.map((p) => {
      let t = cleanText(p.text);
      const role = roles && roles[p.number] ? roles[p.number] : '';
      if (isBoilerplate(role) && t.length > 1800) t = t.slice(0, 1300) + t.slice(t.length - 400) + ' '.repeat(80);
      return U.byteLength(t) + 40;
    });
    const total = sizes.reduce((a, b) => a + b, 0);
    if (total <= room * 1.08) return [pages.slice()]; // a small overflow is trimmed, not split
    const batches = [];
    let cur = [];
    let size = 0;
    pages.forEach((p, i) => {
      const len = sizes[i];
      if (cur.length && size + len > room) { batches.push(cur); cur = []; size = 0; }
      cur.push(p); size += len;
    });
    if (cur.length) batches.push(cur);
    return batches;
  }

  return { profilePrompt, findingsPrompt, verifyPrompt, transcribePrompt, planBatches, DOC_LABELS, INVOLVED_LABELS: INVOLVED, cleanText, excerptAround };
})();
