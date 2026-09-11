'use strict';
/* Local runtime shim: gives the page the same `window.claude.use(name)` surface as the claude.ai artifact
   runtime (sample, db, assets, downloads), backed by the local server (server.py). Loaded only in the
   local build; the artifact build never includes it. */
(function () {
  if (window.claude && typeof window.claude.use === 'function') return; // real runtime present
  const API = (window.PRESCREEN_API || '') + '/api';
  const err = (code, message, text) => ({ code, message, text });
  async function call(path, opts) {
    let res;
    try { res = await fetch(API + path, opts); } catch (e) { throw err('upstream_error', 'server unreachable'); }
    let body = null;
    try { body = await res.json(); } catch (e) { body = null; }
    if (!res.ok) throw err((body && body.code) || 'upstream_error', (body && body.message) || ('HTTP ' + res.status), body && body.text);
    return body;
  }
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1]); r.onerror = reject; r.readAsDataURL(blob); });
  }
  async function packImages(images) {
    if (!images) return [];
    const list = images instanceof Blob ? [images] : Array.from(images);
    const out = [];
    for (const b of list) out.push({ media_type: b.type || 'image/jpeg', data: await blobToBase64(b) });
    return out;
  }

  /* ---- sample ---- */
  async function sampleCore(input, opts, wantJson) {
    opts = opts || {};
    const body = { input, modelTier: opts.modelTier || 'default', json: !!wantJson, images: await packImages(opts.images), cache: opts.cache };
    if (opts.signal && opts.signal.aborted) throw err('cancelled', 'aborted');
    const res = await call('/sample', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: opts.signal }).catch((e) => { if (e && e.name === 'AbortError') throw err('cancelled', 'aborted'); throw e; });
    if (typeof res.cost_usd === 'number') { window.PRESCREEN_COST = (window.PRESCREEN_COST || 0) + res.cost_usd; window.PRESCREEN_CALLS = (window.PRESCREEN_CALLS || 0) + 1; }
    // which model answered (the page shows it, and warns when the server had to fall back from the calibrated model)
    window.PRESCREEN_LAST = { model: res.model || '', requested: res.requested || '', fallback: !!res.fallback };
    if (opts.onText && res.text) { try { opts.onText({ text: res.text, delta: res.text }); } catch (e) { /* ignore */ } }
    if (wantJson) { if (res.json === undefined) throw err('invalid_json', 'no JSON in the answer', res.text); return res.json; }
    return { text: res.text, truncated: !!res.truncated, modelTierApplied: res.modelTierApplied || body.modelTier };
  }
  const sample = (input, opts) => sampleCore(input, opts, false);
  sample.json = (input, opts) => sampleCore(input, opts, true);
  sample.limits = async () => { try { return await call('/limits'); } catch (e) { return { maxPromptBytes: 65536 }; } };

  /* ---- db (JSON document store on the server, polled snapshots) ---- */
  function segs(path) { return String(path).split('/').filter(Boolean); }
  function docRef(path) {
    const parts = segs(path);
    if (parts.length % 2 !== 0) throw new TypeError('document path needs an even number of segments: ' + path);
    const p = parts.join('/');
    const snapOf = (b) => ({ id: parts[parts.length - 1], exists: !!(b && b.exists), data: () => (b && b.exists ? b.data : undefined), metadata: { fromCache: false, hasPendingWrites: false } });
    return {
      id: parts[parts.length - 1], path: p,
      get: async () => snapOf(await call('/db/doc?path=' + encodeURIComponent(p))),
      set: async (data) => { await call('/db/doc', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: p, data, merge: false }) }); },
      update: async (data) => { await call('/db/doc', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: p, data, merge: true }) }); },
      delete: async () => { await call('/db/doc?path=' + encodeURIComponent(p), { method: 'DELETE' }); },
      acquire: async () => ({ acquired: true }),
      onSnapshot: (next, error) => poll(async () => snapOf(await call('/db/doc?path=' + encodeURIComponent(p))), next, error),
      collection: (sub) => colRef(p + '/' + sub),
    };
  }
  function poll(fetcher, next, error) {
    let last = null; let alive = true;
    const tick = async () => {
      if (!alive) return;
      try { const snap = await fetcher(); const key = JSON.stringify(snap.docs ? snap.docs.map((d) => [d.id, d.data()]) : snap.data()); if (key !== last) { last = key; next(snap); } }
      catch (e) { if (error) error({ code: 'unavailable', message: String(e && e.message) }); }
    };
    tick();
    const timer = setInterval(tick, 4000);
    return () => { alive = false; clearInterval(timer); };
  }
  function colRef(path, q) {
    const parts = segs(path);
    if (parts.length % 2 !== 1) throw new TypeError('collection path needs an odd number of segments: ' + path);
    const p = parts.join('/');
    const query = q || { where: [], orderBy: null, dir: 'asc', limit: 200 };
    const run = async () => {
      const url = '/db/query?collection=' + encodeURIComponent(p) + '&where=' + encodeURIComponent(JSON.stringify(query.where)) + (query.orderBy ? '&orderBy=' + encodeURIComponent(query.orderBy) + '&dir=' + query.dir : '') + '&limit=' + query.limit;
      const res = await call(url);
      const docs = (res.docs || []).map((d) => ({ id: d.id, exists: true, data: () => d.data, metadata: { fromCache: false, hasPendingWrites: false } }));
      return { docs, size: docs.length, empty: !docs.length, docChanges: () => docs.map((doc, i) => ({ type: 'added', doc, oldIndex: -1, newIndex: i })), metadata: { fromCache: false, hasPendingWrites: false } };
    };
    return {
      path: p,
      where: (f, op, v) => colRef(p, Object.assign({}, query, { where: query.where.concat([[f, op, v]]) })),
      orderBy: (f, dir) => colRef(p, Object.assign({}, query, { orderBy: f, dir: dir || 'asc' })),
      limit: (n) => colRef(p, Object.assign({}, query, { limit: n })),
      get: run,
      onSnapshot: (next, error) => poll(run, next, error),
      doc: (id) => docRef(p + '/' + (id || ('d' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)))),
      add: async (data) => { const ref = docRef(p + '/' + 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)); await ref.set(data); return ref; },
    };
  }
  const db = { doc: (path) => docRef(path), collection: (path) => colRef(path) };

  /* ---- assets ---- */
  const assets = {
    upload: async (blob, options) => {
      const type = (options && options.type) || blob.type || 'application/octet-stream';
      const res = await call('/assets', { method: 'POST', headers: { 'Content-Type': type, 'X-File-Name': encodeURIComponent(blob.name || 'file') }, body: blob });
      return { id: res.id, url: res.url, sizeBytes: res.sizeBytes, contentType: res.contentType };
    },
    list: async () => call('/assets'),
    delete: async (id) => call('/assets/' + encodeURIComponent(String(id).replace(/^.*\/_blob\//, '')), { method: 'DELETE' }),
  };

  /* ---- downloads ---- */
  const downloads = {
    save: async ({ filename, data }) => {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename || 'download'; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return { saved: true, filename };
    },
  };

  const caps = { sample, db, assets, downloads };
  window.claude = { use: async (name) => (Object.prototype.hasOwnProperty.call(caps, name) ? caps[name] : null), local: true };
})();
