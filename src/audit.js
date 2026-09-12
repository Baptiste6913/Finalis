'use strict';
/* Audit trail. Every event the platforms hold on a submission (submitted, verdict, comment, decision) is laid
   out in time order as a hash chain: each record carries the SHA-256 of the previous record's hash and of its
   own canonical JSON, and a closing seal record carries the count and the export time, so that a record in
   the exported file that is altered, removed, inserted or reordered after the export breaks every hash that
   follows it and the seal. The export is what a firm keeps under its books-and-records retention (SEC 17a-4
   asks for records that cannot be altered without detection); the verifier recomputes the chain from the
   file alone. The chain proves the integrity of the file, not that the file is complete or that the records
   were not edited before the export: the head hash is what to write down at export time, and a later export
   must reproduce it record for record. */
const Audit = (() => {
  const ZERO = '0'.repeat(64);
  /* canonical JSON with the semantics of JSON.stringify (undefined and functions dropped in objects, null in
     arrays, toJSON honoured) and keys sorted at every level, so a record hashes the same before and after a
     round trip through a file */
  function canonical(v) {
    if (v && typeof v === 'object' && typeof v.toJSON === 'function') v = v.toJSON();
    if (v === undefined || typeof v === 'function') return 'null';
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map((x) => canonical(x)).join(',') + ']';
    return '{' + Object.keys(v).filter((k) => v[k] !== undefined && typeof v[k] !== 'function').sort().map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  }
  async function digest(text) {
    const h = await U.sha256(new TextEncoder().encode(text));
    if (!h) throw new Error('SHA-256 is not available in this context');
    return h;
  }
  const ORDER = { submitted: 0, comment: 1, verdict: 1, decision: 2, seal: 9 };
  const str = (x) => (x === undefined || x === null ? null : String(x));
  /* the events of one submission, from its stored fields only */
  function events(sub) {
    const out = [];
    const c = Review.counts(Array.isArray(sub.findings) ? sub.findings : []);
    const responses = sub.responses && typeof sub.responses === 'object' ? sub.responses : {};
    const file = sub.file && typeof sub.file === 'object' ? sub.file : {};
    out.push({ at: str(sub.created_at), type: 'submitted', submission: str(sub.id), data: { file: { name: str(file.name), sha: str(file.sha), pages: file.pages === undefined ? null : file.pages }, submitter: str(sub.submitter) || '', submitted_by: sub.submitted_by && typeof sub.submitted_by === 'object' ? { name: str(sub.submitted_by.name), email: str(sub.submitted_by.email) } : null, firm: str(sub.form && sub.form.bankName) || '', lane: str(sub.lane), docType: str(sub.form && sub.form.docType), version: sub.version || 1, round: sub.round || 1, previous: sub.previous && sub.previous.id ? str(sub.previous.id) : null, readiness: sub.readiness && Number.isFinite(sub.readiness.score) ? sub.readiness.score : null, points: { certain: c.certain, pending: c.verify, high: c.high }, responses: Object.keys(responses).filter((k) => responses[k] && responses[k].status && responses[k].status !== 'none').map((k) => ({ id: k, status: str(responses[k].status), note: str(responses[k].note) || '' })), changes: Array.isArray(sub.changes) ? sub.changes.length : 0, resolved: Array.isArray(sub.resolved) ? sub.resolved.length : 0, claims: Array.isArray(sub.claims) ? sub.claims.length : 0 } });
    const verdicts = sub.verdicts && typeof sub.verdicts === 'object' ? sub.verdicts : {};
    Object.keys(verdicts).forEach((fid) => {
      const v = verdicts[fid]; if (!v || typeof v !== 'object') return;
      const f = (Array.isArray(sub.findings) ? sub.findings : []).find((x) => x && x.id === fid) || {};
      out.push({ at: str(v.at) || str(sub.created_at), type: v.verdict ? 'verdict' : 'comment', submission: str(sub.id), data: { finding: fid, rule: str(f.rule), page: f.page === undefined ? null : f.page, verdict: str(v.verdict), reason: str(v.reason) || '', by: str(v.by) || '', byEmail: str(v.byEmail) || '' } });
    });
    (Array.isArray(sub.history) ? sub.history : []).filter((h) => h && typeof h === 'object').forEach((h) => out.push({ at: str(h.at), type: 'decision', submission: str(sub.id), data: { event: str(h.event), by: str(h.by) || '', message: str(h.message) || '' } }));
    return out;
  }
  /* a total order: time, then the kind of event, then the submission, then the record itself */
  function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function sortEvents(list) { return list.slice().sort((a, b) => cmp(a.at || '', b.at || '') || (ORDER[a.type] || 0) - (ORDER[b.type] || 0) || cmp(a.submission || '', b.submission || '') || cmp(canonical(a.data), canonical(b.data))); }
  /* build the chain over a list of submissions; the seal closes it */
  async function chain(subs, meta) {
    const list = (subs || []).filter((s) => s && typeof s === 'object' && s.id);
    const evs = sortEvents(list.flatMap(events));
    const generatedAt = new Date().toISOString();
    evs.push({ at: generatedAt, type: 'seal', submission: null, data: { count: evs.length, submissions: list.length, generated_at: generatedAt, generated_by: meta && meta.by ? { name: str(meta.by.name), email: str(meta.by.email) } : null } });
    const records = [];
    let prev = ZERO;
    for (let i = 0; i < evs.length; i += 1) {
      const body = Object.assign({ seq: i + 1 }, evs[i]);
      const hash = await digest(prev + canonical(body));
      records.push(Object.assign({}, body, { prev_hash: prev, hash }));
      prev = hash;
    }
    return { format: 'finalis-prescreen-audit', version: 2, algorithm: 'SHA-256 over prev_hash + canonical JSON of the record (keys sorted); the last record is the seal', generated_at: generatedAt, generated_by: meta && meta.by ? { name: str(meta.by.name), email: str(meta.by.email) } : null, submissions: list.length, count: records.length, head: prev, records };
  }
  /* recompute from the file alone; expectedHead, when the reader wrote it down at export time, must match */
  async function verify(exp, expectedHead) {
    if (!exp || typeof exp !== 'object' || !Array.isArray(exp.records)) return { ok: false, checked: 0, error: 'not an audit export' };
    let prev = ZERO;
    for (let i = 0; i < exp.records.length; i += 1) {
      const r = exp.records[i];
      if (!r || typeof r !== 'object') return { ok: false, checked: i, brokenAt: i + 1, error: 'record ' + (i + 1) + ' is not a record' };
      const body = Object.assign({}, r); delete body.prev_hash; delete body.hash;
      if (r.prev_hash !== prev) return { ok: false, checked: i, brokenAt: i + 1, error: 'record ' + (i + 1) + ' does not chain to the previous one' };
      if (body.seq !== i + 1) return { ok: false, checked: i, brokenAt: i + 1, error: 'record ' + (i + 1) + ' is out of sequence' };
      const h = await digest(prev + canonical(body));
      if (h !== r.hash) return { ok: false, checked: i, brokenAt: i + 1, error: 'record ' + (i + 1) + ' was altered' };
      prev = h;
    }
    const n = exp.records.length;
    const last = n ? exp.records[n - 1] : null;
    if (!last || last.type !== 'seal' || !last.data || last.data.count !== n - 1) return { ok: false, checked: n, error: 'the seal is missing or does not match the number of records (a truncated file)' };
    if (exp.head !== undefined && exp.head !== prev) return { ok: false, checked: n, error: 'the head hash does not match the records' };
    const want = String(expectedHead || '').trim().toLowerCase();
    if (want && want !== prev) return { ok: false, checked: n, head: prev, error: 'the chain is intact but its head is not the one you wrote down: this is another export' };
    return { ok: true, checked: n, head: prev, events: n - 1 };
  }
  function filename() { return 'prescreen-audit-' + new Date().toISOString().slice(0, 10) + '.json'; }
  return { canonical, events, chain, verify, filename, ZERO };
})();
