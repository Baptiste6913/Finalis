'use strict';
/* Persistence: the artifact db when this view has it (shared inbox across the desk), otherwise this
   browser's localStorage (a private inbox, still enough to demonstrate the flow). */
const Store = (() => {
  let db = null;
  let mode = 'local';
  const LS = { subs: 'mmat.submissions', cal: 'mmat.calibration', settings: 'mmat.settings' };
  const listeners = new Set();

  function lsGet(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
  function lsSet(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ } }

  async function init(caps) {
    db = caps.db || null;
    mode = db ? 'shared' : 'local';
    return mode;
  }
  function status() { return mode; }

  /* Strip what can be recomputed (boxes, ranges) before storing. */
  function slim(sub) {
    const copy = JSON.parse(JSON.stringify(sub));
    (copy.findings || []).forEach((f) => { delete f.boxes; delete f.range; });
    if (copy.result) { delete copy.result.pages; }
    return copy;
  }

  async function saveSubmission(sub) {
    const doc = slim(sub);
    if (db) {
      try { await db.doc('submissions/' + doc.id).set(doc); return { ok: true, mode: 'shared' }; }
      catch (e) { console.warn('db set failed', e); }
    }
    const all = lsGet(LS.subs, []);
    const idx = all.findIndex((s) => s.id === doc.id);
    if (idx >= 0) all[idx] = doc; else all.unshift(doc);
    lsSet(LS.subs, all.slice(0, 60));
    notify();
    return { ok: true, mode: 'local' };
  }
  async function updateSubmission(id, patch) {
    if (db) {
      try { await db.doc('submissions/' + id).update(patch); return; } catch (e) { console.warn('db update failed', e); }
    }
    const all = lsGet(LS.subs, []);
    const idx = all.findIndex((s) => s.id === id);
    if (idx >= 0) { Object.assign(all[idx], patch); lsSet(LS.subs, all); }
    notify();
  }
  async function getSubmission(id) {
    if (db) {
      try { const snap = await db.doc('submissions/' + id).get(); if (snap.exists) return snap.data(); } catch (e) { /* fall through */ }
    }
    return lsGet(LS.subs, []).find((s) => s.id === id) || null;
  }
  /* every submission the store holds (the queue subscription is capped at the most recent 60) */
  async function listSubmissions(max) {
    if (db) {
      try { const snap = await db.collection('submissions').orderBy('created_at', 'desc').limit(max || 1000).get(); return snap.docs.map((d) => d.data()).filter(Boolean); } catch (e) { console.warn('db list failed', e); }
    }
    return lsGet(LS.subs, []).slice(0, max || 1000);
  }
  function notify() { listeners.forEach((fn) => { try { fn(lsGet(LS.subs, [])); } catch (e) { /* ignore */ } }); }
  /* Subscribe to the inbox. Returns an unsubscribe function. */
  function watchSubmissions(fn) {
    if (db) {
      try {
        const unsub = db.collection('submissions').orderBy('created_at', 'desc').limit(60).onSnapshot(
          (snap) => fn(snap.docs.map((d) => d.data()).filter(Boolean)),
          (e) => { console.warn('db subscription ended', e); listeners.add(fn); fn(lsGet(LS.subs, [])); },
        );
        return unsub;
      } catch (e) { console.warn('db subscribe failed', e); }
    }
    listeners.add(fn);
    fn(lsGet(LS.subs, []));
    return () => listeners.delete(fn);
  }

  async function addCalibration(entry) {
    const doc = Object.assign({ id: U.uid('cal'), at: new Date().toISOString() }, entry);
    if (!doc.id) doc.id = U.uid('cal');
    if (db) {
      try { await db.doc('calibration/' + doc.id).set(doc); return doc; } catch (e) { console.warn('db calibration failed', e); }
    }
    const all = lsGet(LS.cal, []);
    all.unshift(doc);
    lsSet(LS.cal, all.slice(0, 400));
    return doc;
  }
  /* one document per key: a second verdict on the same point, or a comment added later, replaces the first */
  async function upsertCalibration(entry) {
    const doc = Object.assign({ at: new Date().toISOString() }, entry);
    if (!doc.id) doc.id = U.uid('cal');
    if (db) {
      try { await db.doc('calibration/' + doc.id).set(doc); return doc; } catch (e) { console.warn('db calibration failed', e); }
    }
    const all = lsGet(LS.cal, []).filter((e) => e && e.id !== doc.id);
    all.unshift(doc);
    lsSet(LS.cal, all.slice(0, 600));
    return doc;
  }
  async function getLearningMeta() {
    if (db) { try { const s = await db.doc('learning/meta').get(); if (s.exists) return s.data() || {}; } catch (e) { /* ignore */ } }
    return lsGet('mmat.learningMeta', {});
  }
  async function setLearningMeta(patch) {
    const cur = await getLearningMeta();
    const next = Object.assign({}, cur, patch, { updated_at: new Date().toISOString() });
    if (db) { try { await db.doc('learning/meta').set(next); } catch (e) { /* ignore */ } }
    lsSet('mmat.learningMeta', next);
    return next;
  }
  /* the playbook Claude wrote, kept apart from the log so that neither rewrite drops the other */
  async function getPlaybook() {
    if (db) { try { const s = await db.doc('learning/playbook').get(); if (s.exists) return s.data() || null; } catch (e) { /* ignore */ } }
    return lsGet('mmat.playbook', null);
  }
  async function setPlaybook(pb) {
    if (db) { try { if (pb) await db.doc('learning/playbook').set(pb); else await db.doc('learning/playbook').delete(); } catch (e) { /* ignore */ } }
    try { if (pb) localStorage.setItem('mmat.playbook', JSON.stringify(pb)); else localStorage.removeItem('mmat.playbook'); } catch (e) { /* storage unavailable */ }
    return pb;
  }
  async function listCalibration(limit) {
    let list = [];
    if (db) {
      try { const snap = await db.collection('calibration').orderBy('at', 'desc').limit(limit || 40).get(); list = snap.docs.map((d) => d.data()).filter((d) => d && (!d.type || d.type === 'verdict' || d.type === 'decision' || d.type === 'comment')); }
      catch (e) { list = []; }
    }
    if (!list.length) list = lsGet(LS.cal, []).filter((d) => d && (!d.type || d.type === 'verdict' || d.type === 'decision' || d.type === 'comment')).slice(0, limit || 40);
    return list;
  }
  async function getLearnedRules() {
    if (db) { try { const s = await db.doc('learning/rules').get(); if (s.exists) return (s.data().rules || []); } catch (e) { /* ignore */ } }
    return lsGet('mmat.learnedRules', []);
  }
  async function setLearnedRules(rules) {
    const list = (rules || []).slice(0, 60);
    if (db) { try { await db.doc('learning/rules').set({ rules: list, updated_at: new Date().toISOString() }); } catch (e) { /* ignore */ } }
    lsSet('mmat.learnedRules', list);
    return list;
  }
  async function getSettings() {
    if (db) { try { const s = await db.doc('settings/desk').get(); if (s.exists) return s.data(); } catch (e) { /* ignore */ } }
    return lsGet(LS.settings, {});
  }
  async function setSettings(patch) {
    const cur = await getSettings();
    const next = Object.assign({}, cur, patch);
    if (db) { try { await db.doc('settings/desk').set(next); } catch (e) { /* ignore */ } }
    lsSet(LS.settings, next);
    return next;
  }

  /* Wipe every verdict and learned rule (both stores). Submissions are kept. */
  async function clearLearning() {
    if (db) {
      try { const snap = await db.collection('calibration').limit(1000).get(); for (const d of snap.docs) { try { await db.doc('calibration/' + d.id).delete(); } catch (e) { /* ignore */ } } } catch (e) { /* ignore */ }
      try { await db.doc('learning/rules').set({ rules: [], updated_at: new Date().toISOString() }); } catch (e) { /* ignore */ }
      try { await db.doc('learning/meta').set({ log: [], updated_at: new Date().toISOString() }); } catch (e) { /* ignore */ }
      try { await db.doc('learning/playbook').delete(); } catch (e) { /* ignore */ }
    }
    lsSet(LS.cal, []); lsSet('mmat.learnedRules', []); lsSet('mmat.learningMeta', {});
    try { localStorage.removeItem('mmat.playbook'); } catch (e) { /* storage unavailable */ }
  }
  return { init, status, saveSubmission, updateSubmission, getSubmission, watchSubmissions, listSubmissions, addCalibration, upsertCalibration, getLearningMeta, setLearningMeta, listCalibration, getLearnedRules, setLearnedRules, getPlaybook, setPlaybook, getSettings, setSettings, clearLearning };
})();
