'use strict';
/* Permanent learning. Every reviewer verdict is a structured example; from them the desk gets
   (1) precedents retrieved by relevance for the next pre-review, (2) learned calibration rules distilled
   by Claude from repeated rejections, (3) an accuracy record per rule that demotes rules the reviewers
   keep rejecting, (4) an exportable state that survives the artifact (JSON), (5) regression replays. */
const Learn = (() => {
  function tokens(s) { return new Set(U.normalize(s || '').split(/[^a-z0-9]+/).filter((t) => t.length > 3)); }
  function overlap(a, b) { let n = 0; a.forEach((t) => { if (b.has(t)) n += 1; }); return n; }
  function wilsonLow(pos, n) {
    if (!n) return 0;
    const z = 1.96; const p = pos / n;
    const d = 1 + (z * z) / n;
    const c = p + (z * z) / (2 * n);
    const r = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
    return Math.max(0, (c - r) / d);
  }

  async function stats() {
    const entries = await Store.listCalibration(400);
    const byRule = {};
    entries.forEach((e) => {
      if (!e || !e.rule) return;
      const r = byRule[e.rule] || (byRule[e.rule] = { rule: e.rule, correct: 0, incorrect: 0, total: 0, reasons: [] });
      if (e.verdict === 'correct') r.correct += 1; else if (e.verdict === 'incorrect') { r.incorrect += 1; if (e.reason) r.reasons.push(e.reason); }
      r.total = r.correct + r.incorrect;
    });
    Object.keys(byRule).forEach((k) => { const r = byRule[k]; r.accuracy = r.total ? r.correct / r.total : null; r.confidence = wilsonLow(r.correct, r.total); r.status = r.total >= 8 && r.incorrect / r.total >= 0.8 ? 'suppressed' : r.total >= 5 && r.incorrect / r.total >= 0.6 ? 'demoted' : 'active'; });
    return { byRule, total: entries.length, at: new Date().toISOString() };
  }

  /* Precedents for a document: verdicts on the same rules and lane, scored by lexical overlap with the
     material and by recency. Returns prompt lines (max 30) and the raw entries used. */
  async function precedents(facts, pages, max) {
    const entries = await Store.listCalibration(400);
    if (!entries.length) return { lines: [], entries: [] };
    const candidateRules = new Set(facts.triggers.map((t) => t.id).concat(facts.lexicon.map((l) => l.id)).concat(facts.required.map((r) => r.id)).concat(['C4', 'C9']));
    const docTokens = tokens(pages.map((p) => (p.search || '').slice(0, 4000)).join(' '));
    const now = Date.now();
    const scored = entries.map((e) => {
      let score = 0;
      if (candidateRules.has(e.rule)) score += 3;
      if (e.lane === facts.lane) score += 2;
      if (e.docType === facts.docType) score += 1;
      score += Math.min(4, overlap(tokens(e.quote), docTokens));
      const ageDays = (now - Date.parse(e.at || 0)) / 86400000;
      score += Math.max(0, 2 - ageDays / 90);
      if (e.reason) score += 1;
      return { e, score };
    }).sort((a, b) => b.score - a.score);
    const seen = new Set();
    const picked = [];
    scored.forEach(({ e }) => {
      const key = e.rule + '|' + (e.quote || '').slice(0, 30);
      if (seen.has(key) || picked.length >= (max || 30)) return;
      seen.add(key); picked.push(e);
    });
    const lines = picked.map((e) => (e.rule || '?') + ' on a ' + (e.lane || 'retail') + ' ' + (e.docType || 'document') + (e.quote ? ', "' + e.quote.slice(0, 90) + '"' : '') + ': ' + (e.verdict === 'correct' ? 'CORRECT flag' : 'INCORRECT flag (do not raise this again)') + (e.reason ? ' — ' + e.reason.slice(0, 140) : ''));
    return { lines, entries: picked };
  }

  async function learnedRules() { return Store.getLearnedRules(); }
  async function saveLearnedRules(rules) { return Store.setLearnedRules(rules); }

  /* Distill: for every rule with at least three rejections carrying a reason, ask Claude (quick tier)
     for one calibration rule that would have prevented them. Existing rules for that rule id are replaced
     only when the evidence grew. */
  async function synthesize(sample) {
    if (!sample) throw { code: 'not_granted', message: 'Claude is not available in this view' };
    const st = await stats();
    const existing = await learnedRules();
    const entries = await Store.listCalibration(400);
    const out = existing.slice();
    let changed = 0;
    for (const rule of Object.keys(st.byRule)) {
      const r = st.byRule[rule];
      if (r.incorrect < 3 || r.reasons.length < 2) continue;
      const prev = existing.find((x) => x.rule === rule && x.source === 'synthesized');
      if (prev && prev.evidence >= r.incorrect) continue;
      const rejected = entries.filter((e) => e.rule === rule && e.verdict === 'incorrect').slice(0, 12).map((e) => '- "' + (e.quote || '').slice(0, 120) + '" (' + (e.lane || '') + ' ' + (e.docType || '') + '): ' + (e.reason || 'no reason given'));
      const accepted = entries.filter((e) => e.rule === rule && e.verdict === 'correct').slice(0, 6).map((e) => '- "' + (e.quote || '').slice(0, 120) + '"');
      const prompt = 'A compliance desk reviews AI pre-reviews of marketing materials under FINRA Rule 2210. The reviewers rejected these ' + rule + ' (' + (RULES.CATEGORY_NAMES[rule] || rule) + ') flags:\n' + rejected.join('\n') + (accepted.length ? '\n\nThey accepted these ' + rule + ' flags:\n' + accepted.join('\n') : '') + '\n\nWrite ONE calibration rule (max 220 characters, imperative, specific, starting with "Do not raise ' + rule + '" or "Raise ' + rule + ' only") that separates the rejected flags from the accepted ones. Reply with only a JSON object {"rule": "..."}.';
      try {
        const res = await sample.json(prompt, { modelTier: 'quick', cache: false });
        const text = res && res.rule ? String(res.rule).slice(0, 240) : '';
        if (!text) continue;
        const entry = { id: U.uid('lr'), rule, text, source: 'synthesized', evidence: r.incorrect, at: new Date().toISOString() };
        const idx = out.findIndex((x) => x.rule === rule && x.source === 'synthesized');
        if (idx >= 0) out[idx] = entry; else out.push(entry);
        changed += 1;
      } catch (e) { console.warn('synthesis failed for', rule, e); }
    }
    if (changed) await saveLearnedRules(out);
    return { changed, rules: out };
  }

  async function addManualRule(text, rule) {
    const rules = await learnedRules();
    rules.push({ id: U.uid('lr'), rule: rule || '', text: String(text).slice(0, 240), source: 'manual', evidence: 0, at: new Date().toISOString() });
    await saveLearnedRules(rules);
    return rules;
  }
  async function removeRule(id) {
    const rules = (await learnedRules()).filter((r) => r.id !== id);
    await saveLearnedRules(rules);
    return rules;
  }

  /* Everything the next pre-review needs from the learning state. */
  async function memoryFor(facts, pages) {
    const [pre, rules, st] = await Promise.all([precedents(facts, pages, 30), learnedRules(), stats()]);
    return { memory: { rules: rules.map((r) => r.text).slice(0, 25), verdicts: pre.lines }, stats: st, precedents: pre.entries, learnedRules: rules };
  }

  async function exportState() {
    const [verdicts, rules, st] = await Promise.all([Store.listCalibration(1000), learnedRules(), stats()]);
    return { version: 1, exported_at: new Date().toISOString(), verdicts, learned_rules: rules, stats: st.byRule };
  }
  async function importState(obj) {
    if (!obj || typeof obj !== 'object') throw new Error('Not a learning export');
    const existing = await Store.listCalibration(1000);
    const ids = new Set(existing.map((e) => e.id));
    let added = 0;
    for (const v of (obj.verdicts || [])) { if (v && v.id && !ids.has(v.id)) { await Store.addCalibration(v); added += 1; } }
    const rules = await learnedRules();
    const rids = new Set(rules.map((r) => r.id));
    (obj.learned_rules || []).forEach((r) => { if (r && r.id && !rids.has(r.id)) rules.push(r); });
    await saveLearnedRules(rules);
    return { added, rules: rules.length };
  }

  async function clearAll() { return Store.clearLearning(); }
  return { stats, precedents, learnedRules, saveLearnedRules, synthesize, addManualRule, removeRule, memoryFor, exportState, importState, wilsonLow, clearAll };
})();
