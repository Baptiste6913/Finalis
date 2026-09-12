'use strict';
/* Desk metrics, computed from the submissions the reviewer platform holds (no separate counters to keep in
   sync): first-pass approval, readiness at submission over time, points per submission, time to decision,
   corrections made in the app, rounds per thread, the rules that recur per firm, and what each reviewer
   decided. Everything is derived on the fly from the same records the audit export hashes. */
const Metrics = (() => {
  const H = 3600000;
  function weekKey(iso) {
    const d = new Date(iso || 0);
    if (Number.isNaN(d.getTime())) return '';
    const day = (d.getUTCDay() + 6) % 7; // Monday = 0
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
    return monday.toISOString().slice(0, 10);
  }
  function median(list) { if (!list.length) return null; const s = list.slice().sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  function pct(n, d) { return d ? Math.round((n / d) * 100) : null; }
  function hours(h) { if (h === null || h === undefined) return '–'; if (h < 1) return Math.round(h * 60) + ' min'; if (h < 48) return (Math.round(h * 10) / 10) + ' h'; return (Math.round((h / 24) * 10) / 10) + ' d'; }
  function compute(subs) {
    const list = (subs || []).filter((s) => s && s.id && s.created_at);
    const decided = list.filter((s) => s.decision && s.decision.at);
    // the first decision taken on a first-round submission (a later reopening does not change what happened first)
    const firstDecision = (s) => { const h = Array.isArray(s.history) ? s.history.find((x) => x && x.event) : null; return h ? h.event : (s.decision ? s.decision.kind : null); };
    const firstRound = list.filter((s) => (s.round || 1) === 1 && firstDecision(s));
    const firstPassApproved = firstRound.filter((s) => firstDecision(s) === 'approve').length;
    const counts = list.map((s) => Review.counts(Array.isArray(s.findings) ? s.findings : []));
    const avg = (arr) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null);
    const readinessOf = (s) => (s.readiness && Number.isFinite(s.readiness.score) ? s.readiness : Fix.readiness(Array.isArray(s.findings) ? s.findings : [], s.responses || {}, { all: false }));
    const bands = list.map(readinessOf);
    const readiness = bands.map((r) => r.score);
    // readiness and volume per week (last 12 weeks that have submissions)
    const weeks = {};
    list.forEach((s, i) => { const k = weekKey(s.created_at); if (!k) return; const w = weeks[k] || (weeks[k] = { week: k, n: 0, readiness: [], corrected: 0, approvedFirst: 0, decided: 0 }); w.n += 1; w.readiness.push(readiness[i]); if ((s.version || 1) > 1) w.corrected += 1; if (firstDecision(s)) { w.decided += 1; if ((s.round || 1) === 1 && firstDecision(s) === 'approve') w.approvedFirst += 1; } });
    const trend = Object.values(weeks).sort((a, b) => a.week.localeCompare(b.week)).slice(-12).map((w) => ({ week: w.week, n: w.n, readiness: Math.round(avg(w.readiness)), corrected: w.corrected, firstPass: pct(w.approvedFirst, w.decided) }));
    // time to decision
    const ttd = decided.map((s) => (Date.parse(s.decision.at) - Date.parse(s.created_at)) / H).filter((h) => Number.isFinite(h) && h >= 0);
    // rounds per thread
    const threads = {};
    list.forEach((s) => { const t = s.thread || s.id; threads[t] = Math.max(threads[t] || 0, s.round || 1); });
    const threadRounds = Object.values(threads);
    // answers to the high points the banker was asked
    let asked = 0; let answered = 0;
    list.forEach((s) => { (Array.isArray(s.findings) ? s.findings : []).forEach((f) => { if (f.severity === 'high' && Review.isCertain(f)) { asked += 1; const r = s.responses && s.responses[f.id]; if (r && r.status && r.status !== 'none') answered += 1; } }); });
    // rules: raised, asserted, confirmed and dismissed by the desk
    const byRule = {};
    list.forEach((s) => (Array.isArray(s.findings) ? s.findings : []).forEach((f) => { const r = byRule[f.rule] || (byRule[f.rule] = { rule: f.rule, raised: 0, asserted: 0, confirmed: 0, dismissed: 0 }); r.raised += 1; if (Review.isCertain(f)) r.asserted += 1; const v = s.verdicts && s.verdicts[f.id]; if (v && v.verdict === 'correct') r.confirmed += 1; else if (v && v.verdict === 'incorrect') r.dismissed += 1; }));
    const rules = Object.values(byRule).sort((a, b) => b.raised - a.raised);
    // per firm: volume, average readiness, the rules that keep coming back
    const byFirm = {};
    list.forEach((s, i) => { const firm = (s.form && s.form.bankName && s.form.bankName.trim()) || 'Firm not stated'; const f = byFirm[firm] || (byFirm[firm] = { firm, subs: 0, readiness: [], rules: {}, approved: 0, changes: 0 }); f.subs += 1; f.readiness.push(readiness[i]); if (s.status === 'approved') f.approved += 1; if (s.status === 'changes') f.changes += 1; (Array.isArray(s.findings) ? s.findings : []).filter((x) => Review.isCertain(x)).forEach((x) => { f.rules[x.rule] = (f.rules[x.rule] || 0) + 1; }); });
    const firms = Object.values(byFirm).map((f) => ({ firm: f.firm, subs: f.subs, readiness: Math.round(avg(f.readiness)), approved: f.approved, changes: f.changes, top: Object.keys(f.rules).map((r) => ({ rule: r, n: f.rules[r] })).sort((a, b) => b.n - a.n || a.rule.localeCompare(b.rule)).slice(0, 4) })).sort((a, b) => b.subs - a.subs || a.firm.localeCompare(b.firm)).slice(0, 10);
    // reviewers: what each one decided
    const byReviewer = {};
    list.forEach((s) => (Array.isArray(s.history) ? s.history : []).filter((h) => h && typeof h === 'object').forEach((h) => { const name = h.by || 'Unknown reviewer'; const r = byReviewer[name] || (byReviewer[name] = { name, decisions: 0, approved: 0, changes: 0, escalated: 0 }); r.decisions += 1; if (h.event === 'approve') r.approved += 1; else if (h.event === 'escalate') r.escalated += 1; else r.changes += 1; }));
    const reviewers = Object.values(byReviewer).sort((a, b) => b.decisions - a.decisions);
    const withContradictions = list.filter((s) => s.consistency && Array.isArray(s.consistency.contradictions) && s.consistency.contradictions.length).length;
    return {
      at: new Date().toISOString(), submissions: list.length, decided: decided.length, open: list.length - decided.length,
      firstPass: { approved: firstPassApproved, decided: firstRound.length, rate: pct(firstPassApproved, firstRound.length) },
      readiness: { avg: readiness.length ? Math.round(avg(readiness)) : null, ready: bands.filter((r) => r.band === 'b-ready').length, notReady: bands.filter((r) => r.band === 'b-notready').length },
      points: { certain: avg(counts.map((c) => c.certain)), pending: avg(counts.map((c) => c.verify)), high: avg(counts.map((c) => c.high)) },
      answers: { asked, answered, rate: pct(answered, asked) },
      decisionTime: { median: median(ttd), p90: ttd.length ? ttd.slice().sort((a, b) => a - b)[Math.min(ttd.length - 1, Math.floor(ttd.length * 0.9))] : null, n: ttd.length },
      corrected: { n: list.filter((s) => (s.version || 1) > 1).length, rate: pct(list.filter((s) => (s.version || 1) > 1).length, list.length), edits: list.reduce((n, s) => n + (Array.isArray(s.changes) ? s.changes.length : 0), 0), resolved: list.reduce((n, s) => n + (Array.isArray(s.resolved) ? s.resolved.length : 0), 0) },
      rounds: { threads: threadRounds.length, multi: threadRounds.filter((n) => n > 1).length, avg: avg(threadRounds), rate: pct(threadRounds.filter((n) => n > 1).length, threadRounds.length) },
      status: { submitted: list.filter((s) => s.status === 'submitted').length, changes: list.filter((s) => s.status === 'changes').length, approved: list.filter((s) => s.status === 'approved').length, escalated: list.filter((s) => s.status === 'escalated').length },
      withContradictions, trend, rules, firms, reviewers,
    };
  }
  return { compute, weekKey, median, hours, pct };
})();
