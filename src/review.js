'use strict';
/* Review orchestration: the two Claude passes (profile, then findings in batches that fit the cap),
   merged with the deterministic Tier A results into one findings list. */
const Review = (() => {
  const SEV = { high: 3, medium: 2, low: 1 };
  const TIER_ORDER = { A: 0, B: 1, C: 2 };

  function tierOf(rule) { return (rule || 'C').charAt(0).toUpperCase(); }
  function normSeverity(s) { s = String(s || '').toLowerCase(); return SEV[s] ? s : 'medium'; }
  function normRule(r) {
    r = String(r || '').toUpperCase().replace(/\s+/g, '');
    if (!/^[ABC]\d{1,2}[A-Z]?$/.test(r)) return 'C4';
    return r;
  }

  /* Tier A findings come from the deterministic engine and are final. */
  function tierAFindings(facts, form) {
    const out = [];
    facts.required.forEach((r) => {
      const base = { tier: 'A', rule: r.id, category: RULES.CATEGORY_NAMES[r.id] || r.name, det: true, confidence: 'high', basis: r.citation, pages: [], quote: '' };
      if (r.status === 'missing') {
        out.push(Object.assign(base, {
          severity: r.severity || 'high', page: r.scope === 'first_page' ? 1 : null, pages: r.scope === 'first_page' ? [1] : [],
          title: r.name + ' is missing', issue: 'Required by the SOP for this lane and document type; not found in the text layer' + (r.near ? ' (' + r.near + ')' : '') + '.' + (r.note ? ' ' + r.note : ''),
          text_to_add: r.text, placement: r.placement || '', action: r.note ? 'confirm' : 'add', rewrite: '',
        }));
      } else if (r.status === 'forbidden_present') {
        out.push(Object.assign(base, { severity: 'high', page: r.page, pages: [r.page], quote: r.excerpt, title: r.name, issue: 'The legend restricts the material to institutional investors while the declared audience includes natural persons: either the legend or the questionnaire is wrong.', text_to_add: '', rewrite: '', placement: '', action: 'confirm', boxes: r.boxes }));
      } else if (r.status === 'illegible') {
        out.push(Object.assign(base, { rule: 'A6', category: RULES.CATEGORY_NAMES.A6, severity: 'high', page: r.page, pages: [r.page], quote: r.excerpt.slice(0, 200), title: r.name + ' is set at ' + r.minSize + ' pt', issue: 'A legend the reader cannot read is not a legend. FINRA recommends 10 pt in a general-size advertisement; ' + r.minSize + ' pt is below the 7 pt floor.', text_to_add: '', rewrite: '', placement: 'same page, at 10 pt', action: 'rewrite', boxes: r.boxes }));
      } else if (r.status === 'present' && r.small && facts.lane === 'retail') {
        out.push(Object.assign(base, { rule: 'A6', category: RULES.CATEGORY_NAMES.A6, severity: 'low', page: r.page, pages: [r.page], quote: r.excerpt.slice(0, 200), title: r.name + ' is set at ' + r.minSize + ' pt', issue: 'Present and legible, but below the 10 pt FINRA recommends for a general-size advertisement.', text_to_add: '', rewrite: '', placement: '', action: 'confirm', boxes: r.boxes }));
      } else if (r.status === 'conditional') {
        out.push(Object.assign(base, { severity: 'low', page: null, title: r.name, issue: 'Applies ' + r.conditional + '. Not found in the text.', text_to_add: r.text, placement: r.placement || '', action: 'confirm', rewrite: '' }));
      }
    });
    return out;
  }

  function normalizeModelFindings(raw, facts) {
    const list = Array.isArray(raw) ? raw : [];
    const seen = new Set();
    const out = [];
    const detIds = new Set(facts.required.map((r) => r.id));
    list.forEach((f) => {
      if (!f || typeof f !== 'object') return;
      const rule = normRule(f.rule);
      if (detIds.has(rule) || /^A[1-5]/.test(rule)) return; // Tier A is deterministic
      if (facts.lane === 'institutional' && /^C1[234]$/.test(rule)) return; // retail-only categories
      if (rule === 'B12' && (facts.docType !== 'email' || detIds.has('A1e'))) return; // the email disclaimer concerns emails, not a deck's transmittal email; on an email it is the deterministic A1e
      if (rule === 'B13' && (!/^(article|website)$/.test(facts.docType || '') || detIds.has('A1r') || detIds.has('A1w'))) return; // deterministic A1r / A1w
      if (rule === 'B11' && !/^linkedin/.test(facts.docType || '') && !(facts.publicChannel)) return;
      const page = Number.isFinite(+f.page) && +f.page > 0 ? +f.page : null;
      let pages = Array.isArray(f.pages) ? f.pages.map((n) => +n).filter((n) => Number.isFinite(n) && n > 0) : [];
      if (page && !pages.includes(page)) pages.unshift(page);
      const quote = String(f.quote || '').replace(/\s+/g, ' ').trim().slice(0, 240);
      const key = rule + '|' + (page || 0) + '|' + quote.slice(0, 40).toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        tier: tierOf(rule), rule, category: RULES.CATEGORY_NAMES[rule] || rule, det: false,
        severity: normSeverity(f.severity), page, pages, quote,
        title: String(f.title || f.issue || rule).slice(0, 110),
        issue: String(f.issue || '').slice(0, 700),
        text_to_add: String(f.text_to_add || '').slice(0, 1200),
        rewrite: String(f.rewrite || '').slice(0, 600),
        action: ['add', 'rewrite', 'source', 'remove', 'confirm', 'escalate'].includes(f.action) ? f.action : 'confirm',
        placement: String(f.placement || '').slice(0, 200),
        confidence: ['high', 'medium', 'low'].includes(f.confidence) ? f.confidence : 'medium',
        basis: String(f.basis || '').slice(0, 300),
      });
    });
    return out;
  }

  function sortFindings(list) {
    return list.sort((a, b) => (TIER_ORDER[a.tier] - TIER_ORDER[b.tier]) || (SEV[b.severity] - SEV[a.severity]) || ((a.page || 999) - (b.page || 999)));
  }

  /* Highlight boxes for every page the finding names (the quote is looked up on each of them). */
  function attachBoxes(findings, pages) {
    findings.forEach((f) => {
      if (f.boxes && f.boxes.length) return;
      f.boxes = [];
      if (!f.quote) return;
      const targets = (f.pages && f.pages.length ? f.pages : (f.page ? [f.page] : [])).slice(0, 6);
      targets.forEach((n) => {
        const page = pages.find((p) => p.number === n);
        const loc = Engine.locate(page, f.quote);
        if (!loc) return;
        f.boxes = f.boxes.concat(loc.boxes);
        if (n === f.page || !f.range) f.range = { start: loc.start, end: loc.end };
      });
    });
  }

  /* Hallucination guard: a quote that cannot be found on the cited page is looked for elsewhere; if it is
     nowhere in the material the point is kept but marked unverified and downgraded one step. */
  function quoteGuard(findings, pages, suppressed) {
    findings.forEach((f) => {
      if (f.det || !f.quote) return;
      const page = pages.find((p) => p.number === f.page);
      if (page && Engine.locate(page, f.quote)) return;
      const hit = pages.find((p) => p.number !== f.page && Engine.locate(p, f.quote));
      if (hit) { f.pages = [hit.number].concat((f.pages || []).filter((n) => n !== f.page)); f.page = hit.number; f.note = 'Quote found on page ' + hit.number + ', not ' + (f.page || '?') + ' as first cited.'; return; }
      f.unverified = true;
      f.confidence = 'low';
      if (f.severity === 'high') f.severity = 'medium'; else if (f.severity === 'medium') f.severity = 'low';
      f.note = 'The quoted text was not found in the text layer; check the page before sending this point.';
    });
  }
  /* Coverage guard: a triggered disclosure the profile says is already covered is set aside unless the
     finding argues the wording is deficient. */
  function coverageGuard(findings, profile, suppressed, facts) {
    const cov = (profile && profile.coverage) || {};
    const covered = (k) => cov[k] && cov[k].covered === true;
    const verbatim = {};
    ((facts && facts.coverage) || []).forEach((c) => { if (c.found) verbatim[c.key] = c; });
    const keep = [];
    findings.forEach((f) => {
      if (f.det) { keep.push(f); return; }
      const argues = /deficien|incomplete|lacks|does not (?:say|state|cover)|not bold|standalone|missing (?:the|any)/i.test((f.issue || '') + ' ' + (f.basis || ''));
      let why = '';
      if ((f.rule === 'B1' || f.rule === 'B2' || f.rule === 'C19') && covered('forward_looking') && !argues) why = 'the whole-document pass found forward-looking coverage (' + (cov.forward_looking.where || '') + ')';
      else if (f.rule === 'B3' && covered('past_performance') && !argues) why = 'the whole-document pass found past-performance coverage (' + (cov.past_performance.where || '') + ')';
      else if (f.rule === 'B9' && covered('illiquidity') && !argues) why = 'the whole-document pass found illiquidity coverage (' + (cov.illiquidity.where || '') + ')';
      // item-specific disclosures whose verbatim SOP text is in the material (the desk accepts the disclaimers page for B4, B5, B7; B6 must be on the page)
      else if (f.rule === 'B4' && verbatim.pref && !argues) why = 'the SOP preferred-return text is on page ' + verbatim.pref.page + ' (verbatim match ' + verbatim.pref.score + '%)';
      else if (f.rule === 'B5' && verbatim.distributions && !argues) why = 'the SOP distributions line is on page ' + verbatim.distributions.page;
      else if (f.rule === 'B7' && verbatim.testimonial && !argues) why = 'the testimonial legend is on page ' + verbatim.testimonial.page;
      else if (f.rule === 'B6' && verbatim.logos && (f.pages || [f.page]).every((n) => n === verbatim.logos.page) && !argues) why = 'the logo disclosure is on page ' + verbatim.logos.page + ', with the logos';
      if (why) suppressed.push({ rule: f.rule, pages: f.pages && f.pages.length ? f.pages : (f.page ? [f.page] : []), quote: (f.quote || f.title).slice(0, 160), reason: 'Coverage guard: ' + why + '. Calibration rule 3.' });
      else keep.push(f);
    });
    return keep;
  }
  /* Learned accuracy: rules the reviewers keep rejecting are demoted (never Tier A). */
  function applyDemotion(findings, stats, suppressed) {
    if (!stats || !stats.byRule) return findings;
    const keep = [];
    findings.forEach((f) => {
      const st = stats.byRule[f.rule];
      if (f.det || f.tier === 'A' || !st || st.total < 5) { keep.push(f); return; }
      const bad = st.incorrect / st.total;
      if (st.total >= 8 && bad >= 0.8) { suppressed.push({ rule: f.rule, pages: f.pages || [], quote: (f.quote || f.title).slice(0, 160), reason: 'Set aside by the desk\'s track record: reviewers rejected ' + st.incorrect + ' of ' + st.total + ' ' + f.rule + ' flags.' }); return; }
      if (bad >= 0.6) { f.severity = 'low'; f.confidence = 'low'; f.note = (f.note ? f.note + ' ' : '') + 'Low-confidence rule: reviewers rejected ' + st.incorrect + ' of ' + st.total + ' ' + f.rule + ' flags.'; }
      keep.push(f);
    });
    return keep;
  }
  function applyVerdicts(findings, verdicts, suppressed) {
    if (!Array.isArray(verdicts)) return findings;
    const byId = {};
    verdicts.forEach((v) => { if (v && v.id) byId[String(v.id)] = v; });
    const keep = [];
    findings.forEach((f) => {
      const v = byId[f.id];
      if (!v || f.det) { keep.push(f); return; }
      if (v.verdict === 'drop') { suppressed.push({ rule: f.rule, pages: f.pages || [], quote: (f.quote || f.title).slice(0, 160), reason: 'Verifier: ' + String(v.reason || '').slice(0, 300) }); return; }
      if (v.verdict === 'downgrade') { f.severity = SEV[String(v.severity || '').toLowerCase()] ? String(v.severity).toLowerCase() : (f.severity === 'high' ? 'medium' : 'low'); f.confidence = 'low'; if (f.action !== 'escalate' && f.tier === 'C') f.action = 'escalate'; f.note = (f.note ? f.note + ' ' : '') + 'Verifier: ' + String(v.reason || '').slice(0, 200); }
      f.verdict = v.verdict === 'downgrade' ? 'downgrade' : 'keep';
      keep.push(f);
    });
    return keep;
  }

  /* Assurance: what the banker may be told as a fact versus what the Finalis reviewer must verify first.
     "certain" = deterministic (Tier A), or a model point that (1) quotes text located verbatim on the page,
     (2) came out of the findings pass at high confidence, (3) survived the second pass unchanged, and (4) is
     corroborated by an independent signal: for a disclosure, the SOP wording is absent from the whole
     material (or the rule has no wording to look for); for a language point, the quote contains a term of
     the desk's language guide. Everything else is "verify": shown to the banker as a point the reviewer
     will confirm, never asserted, never blocking. */
  const COVERAGE_KEY = { B1: 'forecast', B2: 'illustration', B3: 'past_perf', B4: 'pref', B5: 'distributions', B6: 'logos', B7: 'testimonial', B9: 'real_estate' };
  function classify(findings, facts, opts, pages) {
    const verified = !!(opts && Array.isArray(opts.verdicts) && opts.verdicts.length);
    const covFound = {};
    (facts.coverage || []).forEach((c) => { covFound[c.key] = !!c.found; });
    const lexByPage = {};
    (facts.lexicon || []).forEach((l) => { (lexByPage[l.page] = lexByPage[l.page] || []).push(U.normalize(l.phrase)); });
    findings.forEach((f) => {
      f.why_verify = '';
      if (f.det) { f.assurance = 'certain'; return; }
      if (opts && opts.reference) { // the reference pre-review: the desk's own verdicts stand in for the second pass
        const validated = /reviewer verdict: (?:correct|well)/i.test(f.basis || '');
        f.assurance = validated ? 'certain' : 'verify';
        f.why_verify = validated ? '' : 'no reviewer verdict on this item yet';
        return;
      }
      const located = !!((f.boxes && f.boxes.length) || f.range);
      const reasons = [];
      // a document-level disclosure finding quotes nothing: its corroboration is the deterministic absence of
      // both the SOP wording and any generic wording for the same item, checked below
      const GENERIC = { B1: 'forward_generic', B2: 'forward_generic', B3: 'past_perf', B9: 'risk_generic' };
      const docLevel = f.tier === 'B' && !f.quote && !f.page && GENERIC[f.rule];
      if (docLevel) { if (covFound[GENERIC[f.rule]] || covFound[COVERAGE_KEY[f.rule]]) reasons.push('wording for ' + f.rule + ' was found in the material'); }
      else if (!f.quote || !located) reasons.push('the quoted text could not be located on the page');
      if (f.confidence !== 'high') reasons.push('the review pass rated it ' + (f.confidence || 'medium') + ' confidence');
      if (!verified) reasons.push('the second pass did not run (fast pre-review)');
      else if (f.verdict !== 'keep') reasons.push(f.verdict === 'downgrade' ? 'the second pass downgraded it' : 'the second pass returned no verdict on it');
      if (f.action === 'escalate') reasons.push('it is a close call to escalate');
      if (f.tier === 'C') {
        const q = U.normalize(f.quote || '');
        const terms = lexByPage[f.page] || [];
        const lex = terms.some((t) => q.indexOf(t) !== -1);
        const figure = /\d|\b(?:trillions?|billions?|millions?|percent|bn|mm)\b/.test(q);
        const page = (pages || []).find((p) => p.number === f.page);
        const sourced = !!(page && /\bsources?\s*:/.test(page.search || ''));
        if (f.rule === 'C4') { if (!lex && !(figure && !sourced)) reasons.push(figure ? 'the page carries a source line' : 'neither a language-guide term nor an unsourced figure appears in the quote'); }
        else if (f.rule === 'C15' || f.rule === 'C16') { if (!(figure && facts.lane === 'retail')) reasons.push('no return or distribution figure in the quote on retail material'); }
        else if (/^C(?:[89]|1\d)$/.test(f.rule)) reasons.push('a judgement category (' + f.rule + ') is always left to the reviewer');
        else if (!lex) reasons.push('no term of the language guide appears in the quote');
      } else {
        const key = COVERAGE_KEY[f.rule];
        if (key && covFound[key]) reasons.push('the SOP wording for ' + f.rule + ' was found elsewhere in the material');
      }
      f.assurance = reasons.length ? 'verify' : 'certain';
      f.why_verify = reasons.join('; ');
    });
    return findings;
  }

  function assemble(facts, form, profile, batches, pages, options) {
    const opts = options || {};
    const findings = tierAFindings(facts, form);
    let suppressed = [];
    const briefs = [];
    const msgs = [];
    const gut = { inaccurate_picture: { flag: false, why: '' }, unsupported_claims: { flag: false, why: '' }, promised_results: { flag: false, why: '' } };
    batches.forEach((b, i) => {
      normalizeModelFindings(b.findings, facts).forEach((f) => findings.push(f));
      if (Array.isArray(b.suppressed)) suppressed = suppressed.concat(b.suppressed.filter((s) => s && typeof s === 'object').map((s) => ({ rule: normRule(s.rule), pages: Array.isArray(s.pages) ? s.pages : (s.page ? [s.page] : []), quote: String(s.quote || '').slice(0, 160), reason: String(s.reason || '').slice(0, 400) })));
      if (b.brief) briefs.push(String(b.brief));
      if (b.banker_message && (i === 0 || String(b.banker_message).length > 40)) msgs.push(String(b.banker_message));
      if (b.gut_check && typeof b.gut_check === 'object') Object.keys(gut).forEach((k) => { const g = b.gut_check[k]; if (g && g.flag) { gut[k].flag = true; gut[k].why = gut[k].why ? gut[k].why + ' ' + (g.why || '') : (g.why || ''); } });
    });
    // dedupe again across batches
    const seen = new Set();
    let unique = findings.filter((f) => { const k = f.rule + '|' + (f.page || 0) + '|' + (f.quote || f.title).slice(0, 40).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
    quoteGuard(unique, pages, suppressed);
    unique = coverageGuard(unique, profile, suppressed, facts);
    unique = applyDemotion(unique, opts.stats, suppressed);
    sortFindings(unique);
    unique.forEach((f, i) => { f.id = 'f' + (i + 1); });
    if (opts.verdicts) { unique = applyVerdicts(unique, opts.verdicts, suppressed); sortFindings(unique); unique.forEach((f, i) => { f.id = 'f' + (i + 1); }); }
    attachBoxes(unique, pages);
    classify(unique, facts, opts, pages);
    return { profile: profile || {}, findings: unique, suppressed: suppressed.slice(0, 60), gut_check: gut, brief: briefs.join('\n\n'), banker_message: msgs.join('\n\n') };
  }

  function counts(findings) {
    const c = { A: 0, B: 0, C: 0, high: 0, medium: 0, low: 0, total: findings.length, certain: 0, verify: 0 };
    findings.forEach((f) => { c[f.tier] += 1; c[f.severity] += 1; if (f.assurance === 'verify') c.verify += 1; else c.certain += 1; });
    return c;
  }
  const isCertain = (f) => f.assurance !== 'verify';

  /* Pick pages worth sending as images: exhibits, logo-heavy pages, cover. */
  function pickImagePages(facts, max) {
    const scored = facts.stats
      .filter((s) => s.role !== 'section divider' && s.role !== 'no text layer' && s.role !== 'toc' && s.role !== 'disclaimers' && s.role !== 'risk factors')
      .map((s) => ({ page: s.page, score: (s.images >= 3 ? 2 : 0) + (s.numbers >= 6 ? 2 : 0) + (s.page === 1 ? 1 : 0) + Math.min(2, s.images / 20) }))
      .filter((s) => s.score >= 2)
      .sort((a, b) => b.score - a.score || a.page - b.page)
      .slice(0, max);
    return scored.map((s) => s.page).sort((a, b) => a - b);
  }

  async function run(ctx) {
    const { doc, form, caps, onStep, signal, memory, noCache } = ctx;
    let { pages, facts } = ctx;
    const sample = caps.sample;
    if (!sample) throw { code: 'not_granted', message: 'Claude is not available in this view' };
    const limits = caps.limits || { maxPromptBytes: 65536 };
    const maxBytes = Math.min(65536, limits.maxPromptBytes || 65536) - 512;
    const cacheOpt = noCache ? false : true;
    const meta = { calls: [], truncated: false };

    // ---- image documents: transcription first
    if (doc.kind === 'image') {
      onStep('transcribe', { status: 'run', detail: 'Reading the image' });
      if (!limits.images) throw { code: 'images_unavailable', message: 'This view cannot send images to Claude' };
      const t = await sample.json(Prompts.transcribePrompt(form), { images: doc.file, modelTier: 'default', signal, cache: cacheOpt });
      const text = String((t && t.text) || '') + ((t && Array.isArray(t.visuals) && t.visuals.length) ? '\n' + t.visuals.map((v) => '[visual] ' + v).join('\n') : '');
      if (text.replace(/\s/g, '').length < 20) { onStep('transcribe', { status: 'fail', detail: 'No readable text in the image' }); throw { code: 'empty_completion', message: 'No text could be read from the image' }; }
      pages = [Extract.pageFromText(1, text, { kind: 'image', imageCount: 1 })];
      facts = Engine.analyze(pages, form);
      ctx.onPagesReplaced && ctx.onPagesReplaced(pages, facts);
      onStep('transcribe', { status: 'done', detail: text.length + ' characters transcribed' });
    }

    // ---- pass 1: profile
    onStep('profile', { status: 'run', detail: 'Reading all ' + pages.length + ' pages' });
    const p1 = Prompts.profilePrompt(form, facts, pages, maxBytes);
    let profile;
    let streamed = 0;
    const t0 = performance.now();
    try {
      profile = await sample.json(p1, {
        modelTier: 'default', signal, cache: cacheOpt,
        onText: ({ text }) => { streamed = text.length; onStep('profile', { status: 'run', detail: 'Mapping the document · ' + streamed + ' chars' }); },
      });
    } catch (e) { onStep('profile', { status: 'fail', detail: (e && e.message) || 'failed' }); throw e; }
    meta.calls.push({ pass: 'profile', ms: Math.round(performance.now() - t0), bytes: U.byteLength(p1) });
    if (!profile || typeof profile !== 'object') profile = {};
    onStep('profile', { status: 'done', detail: (profile.material_kind || 'document') + ' · lane ' + (profile.lane || facts.lane) + ' · ' + Object.keys(profile.coverage || {}).filter((k) => profile.coverage[k] && profile.coverage[k].covered).length + ' disclosures already covered' });

    // ---- pass 2: findings (batched)
    const probe = Prompts.findingsPrompt(form, facts, profile, pages.slice(0, 1), null, memory, maxBytes, null);
    const batches = Prompts.planBatches(pages, probe.headBytes, maxBytes, profile && profile.page_roles);
    const results = [];
    const wantImages = form.images && limits.images && doc.kind === 'pdf' && doc.pdf;
    const imagePages = wantImages ? pickImagePages(facts, Math.min(limits.images.maxCount || 4, 6)) : [];
    for (let i = 0; i < batches.length; i += 1) {
      const batch = batches[i];
      const info = { index: i + 1, batches: batches.length, from: batch[0].number, to: batch[batch.length - 1].number };
      const stepKey = 'findings' + (batches.length > 1 ? '-' + (i + 1) : '');
      onStep(stepKey, { status: 'run', detail: batches.length > 1 ? 'Pages ' + info.from + ' to ' + info.to : 'Applying the rulebook and the calibration rules' });
      const inBatch = imagePages.filter((n) => n >= info.from && n <= info.to);
      let images = null;
      if (inBatch.length) {
        try {
          images = [];
          for (const n of inBatch) images.push(await Extract.pageJpeg(doc.pdf, n, 1100));
        } catch (e) { images = null; }
      }
      const built = Prompts.findingsPrompt(form, facts, profile, batch, info, memory, maxBytes, images ? inBatch : null);
      const t1 = performance.now();
      let res;
      try {
        const opts = { modelTier: form.depth || 'complex', signal, cache: cacheOpt, onText: ({ text }) => onStep(stepKey, { status: 'run', detail: 'Writing findings · ' + text.length + ' chars' }) };
        if (images) opts.images = images;
        res = await sample.json(built.prompt, opts);
      } catch (e) {
        if (e && e.code === 'images_unavailable' && images) {
          res = await sample.json(built.prompt, { modelTier: form.depth || 'complex', signal, cache: cacheOpt });
        } else { onStep(stepKey, { status: 'fail', detail: (e && e.message) || 'failed' }); throw e; }
      }
      meta.calls.push({ pass: 'findings', batch: i + 1, ms: Math.round(performance.now() - t1), bytes: U.byteLength(built.prompt), images: images ? inBatch.length : 0 });
      results.push(res && typeof res === 'object' ? res : {});
      onStep(stepKey, { status: 'done', detail: ((res && res.findings) || []).length + ' points, ' + ((res && res.suppressed) || []).length + ' candidates set aside' });
    }
    let out = assemble(facts, form, profile, results, pages, { stats: ctx.stats });
    // ---- pass 3: verifier (thorough runs only, when there is something to check)
    const candidates = out.findings.filter((f) => !f.det);
    if ((form.depth || 'complex') === 'complex' && candidates.length && !ctx.skipVerify) {
      onStep('verify', { status: 'run', detail: candidates.length + ' candidates re-checked by a second pass' });
      const vp = Prompts.verifyPrompt(form, facts, profile, candidates, pages, memory, maxBytes);
      const t2 = performance.now();
      try {
        const verdicts = await sample.json(vp, { modelTier: 'default', signal, cache: cacheOpt, onText: ({ text }) => onStep('verify', { status: 'run', detail: 'Checking · ' + text.length + ' chars' }) });
        meta.calls.push({ pass: 'verify', ms: Math.round(performance.now() - t2), bytes: U.byteLength(vp) });
        out = assemble(facts, form, profile, results, pages, { stats: ctx.stats, verdicts: Array.isArray(verdicts) ? verdicts : (verdicts && verdicts.verdicts) });
        const dropped = out.suppressed.filter((s) => /^Verifier:/.test(s.reason)).length;
        onStep('verify', { status: 'done', detail: dropped ? dropped + ' candidate' + (dropped === 1 ? '' : 's') + ' set aside, ' + out.findings.length + ' points kept' : 'all ' + out.findings.length + ' points confirmed' });
      } catch (e) {
        if (e && e.code === 'cancelled') throw e;
        onStep('verify', { status: 'done', detail: 'verifier unavailable (' + (e && e.code ? e.code : 'error') + '), points kept as found' });
      }
    }
    out.meta = meta;
    out.pages = pages;
    out.facts = facts;
    return out;
  }

  /* Deterministic-only result (no model available). */
  function deterministicOnly(facts, form, pages) {
    const out = assemble(facts, form, {}, [], pages, {});
    out.meta = { calls: [], deterministicOnly: true };
    out.pages = pages; out.facts = facts;
    return out;
  }

  return { run, assemble, deterministicOnly, counts, isCertain, classify, tierAFindings, sortFindings, attachBoxes, quoteGuard, coverageGuard, applyDemotion };
})();
