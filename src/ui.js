'use strict';
/* UI: submission form (modal look), workspace (viewer + panel), gate, submitted view, reviewer inbox,
   rulebook dialog. Rendering only; the logic lives in the other modules. */
const UI = (() => {
  const S = {
    mode: 'banker', view: 'form', doc: null, form: {}, facts: null, result: null, responses: {},
    submission: null, inbox: [], viewing: null, active: null, tab: 'disclosures', filter: 'all',
    caps: { sample: null, db: null, assets: null, downloads: null, limits: null }, running: false, abort: null,
    steps: [], reference: false, calib: null, settings: {}, railOpen: false, zoom: 1, page: 1, expanded: {}, ai: {},
    phase: 'landing', prefill: {},
  };
  const $ = (id) => document.getElementById(id);
  const el = U.el;
  const ICON = {
    bulb: '<svg class="i" viewBox="0 0 24 24"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/></svg>',
    spark: '<svg class="i" viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/></svg>',
    down: '<svg class="i" viewBox="0 0 24 24"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.7a2 2 0 0 0-2 1.7l-1.4 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/></svg>',
    doc: '<svg class="i s" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    x: '<svg class="i s" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    check: '<svg class="i s" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
    copy: '<svg class="i s" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    send: '<svg class="i s" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    download: '<svg class="i s" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    mail: '<svg class="i s" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    refresh: '<svg class="i s" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/></svg>',
    checkCircle: '<svg class="i" viewBox="0 0 24 24"><path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><polyline points="22 4 12 14 9 11"/></svg>',
    alert: '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    inbox: '<svg class="i s" viewBox="0 0 24 24"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.5 5.1L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/></svg>',
    stop: '<svg class="i s" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  };
  const LABELS = { A1a: 'Missing disclaimer', A1b: 'Missing disclaimer', A1e: 'Missing disclaimer', A1p: 'Disclosure to confirm', A1l: 'Missing disclosure', A1r: 'Missing disclaimer', A1w: 'Missing disclosure', A2: 'Missing line', A3: 'Missing legend', A4: 'Audience legend', A5: 'Missing disclosure', A6: 'Legibility', A7: 'Source needed', B1: 'Forecast', B2: 'Illustration', B3: 'Past performance', B4: 'Preferred return', B5: 'Distributions', B6: 'Logos', B7: 'Testimonial', B8: 'Award', B9: 'Illiquidity', B10: 'Audience', B11: 'Social media', B12: 'Email', B13: 'Article', C1: 'Exaggerated', C2: 'Promissory', C3: 'Pressure', C4: 'Unsupported', C5: 'Disparaging', C6: 'Comparison', C7: 'Legal history', C8: 'Cherry-picked', C9: 'Misleading', C10: 'Attribution', C11: 'Promissory image', C12: 'Complexity', C13: 'Emphasis', C14: 'Font size' };
  const DOC_HINTS = {
    'deal-deck': 'Any type of presentation in relation to a specific deal distributed to a deal counterpart, such as decks, CIMs, teasers, executive summaries, or one-pagers.',
    'firm-marketing': 'Firm overviews, capability decks and newsletters that do not relate to a specific transaction. Institutional-only versions need the legend and the broker-dealer identification.',
    email: 'An email or letter about an offering. The short email disclaimer may replace the long Finalis disclaimer.',
    'linkedin-post': 'Firm or registered-representative posts. No standing disclaimer, but awards, calls to action and mentions of investment opportunities each trigger one. Public channel: retail lane.',
    'linkedin-profile': 'The About section must carry the broker-dealer disclosure; no specific physical address.',
    article: 'Articles, newsletters and educational content carry the SOP section 9 disclaimer.',
    website: 'Websites and blogs carry the general blog disclosure; public channel: retail lane.',
    other: 'The deal-deck rules apply by default; the reviewer decides the treatment.',
  };
  const STEP_LABELS = { extract: 'Read the file', blocks: 'Required blocks', transcribe: 'Transcribe the image', profile: 'Read the whole document', findings: 'Review under the rulebook', verify: 'Second pass: senior check', assemble: 'Assemble the pre-review' };
  const RESP = { fixed: 'Fixed in the new version', covered: 'Already covered', disagree: 'Disagree' };
  const isMobile = () => window.matchMedia('(max-width: 980px)').matches;
  function svg(name) { const t = document.createElement('template'); t.innerHTML = ICON[name]; return t.content.firstChild; }
  function tierOfTab(f) { return f.tier === 'C' ? 'language' : 'disclosures'; }

  /* ---------- views ---------- */
  function show(view) {
    S.view = view;
    ['form', 'work', 'done', 'inbox', 'learning'].forEach((v) => { $('view-' + v).hidden = v !== view; });
    $('crumb-ai').hidden = !(view === 'work' || view === 'done');
    window.scrollTo(0, 0);
  }
  const STASH_KEYS = ['doc', 'form', 'facts', 'result', 'responses', 'steps', 'calib', 'reference', 'submission', 'ack', 'active', 'tab', 'filter', 'expanded', 'ai', 'phase', 'prefill'];
  function setMode(mode) {
    if (mode === S.mode) { if (mode === 'reviewer' && S.viewing) { S.viewing = null; renderInbox(); show('inbox'); } return; }
    if (mode === 'reviewer') { if (S.running && S.abort) S.abort.abort(); S.stash = {}; STASH_KEYS.forEach((k) => { S.stash[k] = S[k]; }); }
    S.mode = mode;
    $('mode-banker').setAttribute('aria-pressed', String(mode === 'banker'));
    $('mode-reviewer').setAttribute('aria-pressed', String(mode === 'reviewer'));
    $('avatar').textContent = mode === 'reviewer' ? 'CO' : 'JD';
    if (mode === 'reviewer') { S.viewing = null; renderInbox(); show('inbox'); return; }
    S.viewing = null;
    if (S.stash) { STASH_KEYS.forEach((k) => { S[k] = S.stash[k]; }); S.stash = null; }
    if (S.submission) { show('done'); return; }
    if (S.result && S.doc) { show('work'); renderWorkspace(); } else show('form');
  }
  function renderWorkspace() { renderViewer(); renderHead(); renderStatus(); renderRail(); }

  /* ---------- the Marketing materials modal (landing) ---------- */
  function readLanding() {
    const distribution = Array.from(document.querySelectorAll('#dist-menu input:checked')).map((i) => i.value);
    return {
      docType: $('doc-type').value, distribution, involvement: $('involved').value, notes: $('notes').value.trim(),
      pasted: $('pastebox').hidden ? '' : $('paste-text').value.trim(),
    };
  }
  function validateLanding(form) {
    const errors = [];
    if (!S.doc && !form.pasted) errors.push('Upload a file or paste the text.');
    if (!form.distribution.length) errors.push('Select at least one distribution method.');
    if (!form.involvement) errors.push('Say who was involved in the creation of the material.');
    return errors;
  }
  /* The Submit button at the bottom of the modal is enabled only when the form is complete, as in the app. */
  function updateSubmit() {
    const btn = $('btn-submit-form');
    if (!btn) return;
    btn.disabled = validateLanding(readLanding()).length > 0;
  }
  function setStatus(text) {
    const n = $('form-status');
    n.hidden = !text;
    n.textContent = text || '';
  }
  function renderDistLabel() {
    const chosen = Array.from(document.querySelectorAll('#dist-menu input:checked')).map((i) => i.value.replace(' (in person or virtual)', ''));
    const lbl = $('dist-label');
    lbl.textContent = chosen.length ? chosen.join(', ') : 'Select distribution method(s)';
    lbl.className = chosen.length ? 'val' : 'ph';
  }
  function toggleDistMenu(open) {
    const menu = $('dist-menu');
    const want = typeof open === 'boolean' ? open : menu.hidden;
    menu.hidden = !want;
    $('dist-btn').setAttribute('aria-expanded', String(want));
  }
  async function handleFile(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { U.toast('File is over 10 MB'); return; }
    const name = file.name || 'document';
    const ext = (name.split('.').pop() || '').toLowerCase();
    const kind = ext === 'pdf' || file.type === 'application/pdf' ? 'pdf' : ext === 'docx' ? 'docx' : /^(png|jpg|jpeg)$/.test(ext) || /^image\//.test(file.type) ? 'image' : null;
    if (!kind) { U.toast('PDF, DOCX, PNG or JPEG only'); return; }
    setStatus('Reading ' + name + '…');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const sha = await U.sha256(bytes);
      let extracted;
      if (kind === 'pdf') extracted = await Extract.pdf(bytes);
      else if (kind === 'docx') extracted = await Extract.docx(bytes);
      else extracted = Extract.image(file);
      S.doc = Object.assign({ kind, name, size: file.size, file, bytes, sha }, extracted);
      $('filechip').hidden = false;
      $('filechip-name').textContent = name;
      const textPages = S.doc.pages.filter((p) => p.textLayer).length;
      $('filechip-meta').textContent = U.fmtBytes(file.size) + ' · ' + S.doc.pages.length + (kind === 'pdf' ? ' pages' : kind === 'docx' ? ' sections' : ' image') + (kind === 'pdf' && textPages < S.doc.pages.length ? ' · ' + (S.doc.pages.length - textPages) + ' without text layer' : '');
      setStatus('');
      $('pastebox').hidden = true;
    } catch (e) {
      console.error(e);
      S.doc = null;
      setStatus('Could not read ' + name + ': ' + (e && e.message ? e.message : 'unknown error'));
    }
    updateSubmit();
  }
  function removeFile() {
    if (S.doc && S.doc.imageUrl) URL.revokeObjectURL(S.doc.imageUrl);
    S.doc = null; $('filechip').hidden = true; $('file-input').value = '';
    setStatus('');
    updateSubmit();
  }
  function resetForm() {
    removeFile(); $('paste-text').value = ''; $('pastebox').hidden = true; $('notes').value = ''; $('notes-count').textContent = '0';
    $('involved').value = ''; $('doc-type').value = 'deal-deck'; $('doc-type-hint').textContent = DOC_HINTS['deal-deck'];
    document.querySelectorAll('#dist-menu input').forEach((i) => { i.checked = false; });
    renderDistLabel(); toggleDistMenu(false);
    S.result = null; S.facts = null; S.responses = {}; S.submission = null; S.ack = false; S.expanded = {}; S.ai = {}; S.phase = 'landing'; S.prefill = {}; S.form = {};
    updateSubmit();
  }
  function bindForm() {
    const dz = $('dropzone');
    const input = $('file-input');
    dz.addEventListener('click', () => input.click());
    dz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('over'); }));
    dz.addEventListener('drop', (e) => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) handleFile(f); });
    input.addEventListener('change', () => handleFile(input.files && input.files[0]));
    $('filechip-remove').addEventListener('click', removeFile);
    $('paste-toggle').addEventListener('click', () => { $('pastebox').hidden = !$('pastebox').hidden; if (!$('pastebox').hidden) $('paste-text').focus(); });
    $('paste-text').addEventListener('input', updateSubmit);
    $('doc-type').addEventListener('change', () => { $('doc-type-hint').textContent = DOC_HINTS[$('doc-type').value] || ''; updateSubmit(); });
    $('involved').addEventListener('change', updateSubmit);
    $('notes').addEventListener('input', () => { $('notes-count').textContent = String($('notes').value.length); });
    // distribution: a select that accepts several values (checkbox menu under a select-looking button)
    $('dist-btn').addEventListener('click', () => toggleDistMenu());
    $('dist-btn').addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); toggleDistMenu(true); const first = $('dist-menu').querySelector('input'); if (first) first.focus(); } });
    document.querySelectorAll('#dist-menu input').forEach((i) => i.addEventListener('change', () => { renderDistLabel(); updateSubmit(); }));
    document.addEventListener('click', (e) => { if (!$('dist-menu').hidden && !e.target.closest('#dist-select')) toggleDistMenu(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('dist-menu').hidden) { toggleDistMenu(false); $('dist-btn').focus(); } });
    $('btn-dismiss').addEventListener('click', resetForm);
    $('btn-close').addEventListener('click', resetForm);
    $('btn-submit-form').addEventListener('click', submitLanding);
    $('btn-templates').addEventListener('click', () => openRulebook());
    $('btn-rulebook-2').addEventListener('click', () => openRulebook());
    if (typeof SAMPLE_DECK_B64 !== 'undefined' && SAMPLE_DECK_B64) {
      const b = el('button', { class: 'btn xs', type: 'button', text: 'Use the calibration deck (Quartus AI Fund II, 28 pages)' });
      b.addEventListener('click', loadSampleDeck);
      $('sample-slot').append(b);
    }
    renderDistLabel(); updateSubmit();
  }
  async function loadSampleDeck() {
    const bin = atob(SAMPLE_DECK_B64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    const file = new File([bytes], 'Quartus AI Fund II LP - Pitch Deck 05252026.pdf', { type: 'application/pdf' });
    if (!$('involved').value) $('involved').value = 'banker';
    if (!document.querySelector('#dist-menu input:checked')) { ['dist-email', 'dist-meeting'].forEach((id) => { $(id).checked = true; }); renderDistLabel(); }
    $('doc-type').value = 'deal-deck'; $('doc-type-hint').textContent = DOC_HINTS['deal-deck'];
    S.prefill = { audience: 'institutional', bankName: 'Northbridge Advisors', submitter: 'Jane Doe · jane.doe@northbridge.example' };
    await handleFile(file);
  }

  /* ---------- pre-review ---------- */
  function setStep(key, patch) {
    let s = S.steps.find((x) => x.key === key);
    if (!s) { s = { key, label: STEP_LABELS[key] || (key.startsWith('findings') ? 'Review under the rulebook (' + key.split('-')[1] + ')' : key), status: 'pending', detail: '' }; S.steps.push(s); }
    Object.assign(s, patch);
    renderStatus();
    if (!S.result) renderRail();
  }
  function renderStatus() {
    const running = S.steps.find((s) => s.status === 'run');
    const failed = S.steps.find((s) => s.status === 'fail');
    const ic = $('wh-status-ic');
    ic.innerHTML = '';
    if (S.phase === 'setup' && !S.viewing) { $('wh-status-text').textContent = 'Document loaded · answer two questions to start'; return; }
    if (S.result && !S.result.meta.error) { const ok = el('span', { class: 'ok' }); ok.append(svg('checkCircle')); ic.append(ok); }
    else if (failed && !running) { const w = el('span', { style: 'color:var(--danger);display:inline-flex' }); w.append(svg('alert')); ic.append(w); }
    else ic.append(el('span', { class: 'spin' }));
    $('wh-status-text').textContent = S.result ? (S.result.meta.error ? 'Required blocks only' : (S.reference ? 'Reference pre-review' : 'Pre-review complete')) : failed ? 'Stopped: ' + failed.label : running ? running.label + (running.detail ? ' · ' + running.detail : '') : 'Preparing';
  }
  /* Submit on the modal: mandatory, and it does not send anything. It opens the Finalis AI Prescreen with
     the document already rendered; the pre-review runs from there and the submission completes after it. */
  async function submitLanding() {
    const form = readLanding();
    const errors = validateLanding(form);
    if (errors.length) { setStatus(errors.join(' ')); U.toast(errors[0]); updateSubmit(); return; }
    const btn = $('btn-submit-form');
    btn.disabled = true;
    if (!S.doc && form.pasted) {
      const ex = Extract.plain(form.pasted);
      const bytes = new TextEncoder().encode(form.pasted);
      S.doc = Object.assign({ kind: 'text', name: 'Pasted text', size: bytes.length, file: new File([bytes], 'pasted.txt', { type: 'text/plain' }), bytes, sha: await U.sha256(bytes) }, ex);
    }
    S.form = Object.assign({}, form, { audience: S.prefill.audience || '', bankName: S.prefill.bankName || '', submitter: S.prefill.submitter || '', depth: 'complex', images: true });
    S.result = null; S.responses = {}; S.steps = []; S.reference = false; S.calib = null; S.active = null; S.tab = 'disclosures'; S.filter = 'all'; S.expanded = {}; S.ai = {}; S.ack = false; S.zoom = 1; S.page = 1; S.facts = null;
    S.phase = 'setup';
    show('work');
    $('wh-title').textContent = S.doc.name;
    renderViewer(); renderHead(); renderStatus(); renderRail();
    btn.disabled = false;
    U.toast('Opened in Finalis AI Prescreen');
  }
  function readSetup() {
    const depth = (document.querySelector('input[name=depth]:checked') || {}).value || 'complex';
    const img = $('opt-images');
    return { audience: $('audience').value, bankName: $('bank-name').value.trim(), submitter: $('submitter').value.trim(), depth, images: img ? img.checked : false };
  }
  function renderSetup(body) {
    const w = el('div', { class: 'setup' });
    w.append(el('h3', { text: 'Before the pre-review' }));
    w.append(el('p', { class: 'intro', text: 'Finalis AI Prescreen reads the whole document and lists what Compliance will look at. The audience decides which checklist applies; the rest fills the disclaimer texts.' }));
    const f1 = el('div', { class: 'field' });
    f1.append(el('label', { class: 'label', for: 'audience', html: 'Intended audience <span class="req">*</span>' }));
    const sel = el('select', { id: 'audience', required: '' });
    [['', 'Select audience'], ['institutional', 'Institutional investors only'], ['retail', 'Includes natural persons, or more than 25 retail investors'], ['unknown', 'Not sure']].forEach(([v, t]) => sel.append(el('option', { value: v, text: t })));
    sel.value = S.form.audience || '';
    f1.append(sel, el('div', { class: 'helper', text: 'Institutional: firm policy, lighter review. Retail, or a public channel: the full FINRA 2210 checklist.' }));
    w.append(f1);
    const f2 = el('div', { class: 'field' });
    f2.append(el('label', { class: 'label', for: 'bank-name', text: 'Bank / DBA name' }), el('input', { type: 'text', id: 'bank-name', placeholder: 'e.g. Northbridge Advisors', autocomplete: 'organization', value: S.form.bankName || '' }), el('div', { class: 'helper', text: 'Fills the {Bank Name} placeholder in the disclaimer text.' }));
    w.append(f2);
    const f3 = el('div', { class: 'field' });
    f3.append(el('label', { class: 'label', for: 'submitter', text: 'Your name and email' }), el('input', { type: 'text', id: 'submitter', placeholder: 'Jane Doe · jane@bank.com', value: S.form.submitter || '' }));
    w.append(f3);
    const f4 = el('div', { class: 'field' });
    f4.append(el('span', { class: 'label', text: 'Depth' }));
    const opts = el('div', { class: 'opts' });
    [['complex', 'Thorough', 'Most capable model plus a second pass; 2 to 4 minutes on a long deck. Only a thorough run lets points be asserted to you as certain.', 'depth-thorough'], ['default', 'Fast', 'About a minute. Every model point is then left for the Finalis reviewer to verify.', 'depth-fast']].forEach(([v, t, d, id]) => {
      const o = el('label', { class: 'opt' + ((S.form.depth || 'complex') === v ? ' on' : ''), id: 'opt-' + (v === 'complex' ? 'thorough' : 'fast') });
      const r = el('input', { type: 'radio', name: 'depth', value: v, id });
      if ((S.form.depth || 'complex') === v) r.checked = true;
      r.addEventListener('change', () => { document.querySelectorAll('.setup .opt').forEach((x) => x.classList.toggle('on', x.querySelector('input').checked)); });
      const t2 = el('span'); t2.append(el('b', { text: t }), el('span', { text: d }));
      o.append(r, t2);
      opts.append(o);
    });
    f4.append(opts);
    if (S.caps.limits && S.caps.limits.images) {
      const chip = el('label', { class: 'chip' + (S.form.images !== false ? ' on' : ''), id: 'opt-images-chip', style: 'margin-top:10px' });
      const cb = el('input', { type: 'checkbox', id: 'opt-images' });
      cb.checked = S.form.images !== false;
      cb.addEventListener('change', () => chip.classList.toggle('on', cb.checked));
      chip.append(cb, svg('check'), document.createTextNode('Send page images for visual checks (charts, logos, promissory images)'));
      f4.append(chip);
    }
    w.append(f4);
    const go = el('button', { class: 'btn primary go', type: 'button', id: 'btn-start' });
    go.append(document.createTextNode('Start the pre-review'), svg('send'));
    go.addEventListener('click', startPreReview);
    w.append(go);
    w.append(el('div', { class: 'helper', style: 'text-align:center;margin-top:8px', text: 'Nothing reaches Compliance until the pre-review is complete.' }));
    const st = el('div', { class: 'steps3' });
    [['1', 'Required blocks', 'the SOP legends are matched verbatim on the text layer: present, missing, or set too small to read.'], ['2', 'Coverage map', 'disclaimer pages, risk factors, footnotes and sources are mapped first, so a disclosure the deck already carries is never requested twice.'], ['3', 'Attention points', 'triggered disclosures and language under FINRA 2210 and the institutional framework, calibrated on the reviewers\' verdicts; only points confirmed by a second pass are asserted to you, the rest waits for the Finalis reviewer.']].forEach(([n, t, d]) => { const row = el('div'); row.append(el('span', { text: n }), el('div', { html: '<b>' + U.esc(t) + '</b> · ' + U.esc(d) })); st.append(row); });
    w.append(st);
    body.append(w);
    if (!S.caps.sample) body.append(el('div', { class: 'note amber', style: 'margin-top:12px', text: 'Claude is not available in this view: the pre-review will check the required blocks only' + (typeof SAMPLE_DECK_B64 !== 'undefined' ? ', and the calibration deck shows the reference pre-review.' : '.') }));
  }
  async function startPreReview() {
    const setup = readSetup();
    if (!setup.audience) { U.toast('Select the intended audience.'); const a = $('audience'); if (a) a.focus(); return; }
    const form = Object.assign({}, S.form, setup);
    S.form = form; S.result = null; S.responses = {}; S.steps = []; S.reference = false; S.calib = null; S.active = null; S.tab = 'disclosures'; S.filter = 'all'; S.expanded = {}; S.ai = {}; S.ack = false;
    S.phase = 'review';
    renderRail();
    setStep('extract', { status: 'done', detail: S.doc.pages.length + (S.doc.kind === 'pdf' ? ' pages read' : S.doc.kind === 'image' ? ' image' : ' sections') });
    setStep('blocks', { status: 'run' });
    S.facts = Engine.analyze(S.doc.pages, form);
    const missing = S.facts.required.filter((r) => r.status === 'missing' || r.status === 'forbidden_present' || r.status === 'illegible').length;
    setStep('blocks', { status: 'done', detail: 'lane ' + S.facts.lane + ' · ' + missing + ' required block' + (missing === 1 ? '' : 's') + ' to fix' });
    renderHead();
    await runModel(false);
  }
  async function runModel(noCache) {
    if (!S.caps.sample) {
      if (Calibration.isReferenceDeck(S.doc.pages)) {
        S.result = Fixture.build(S.facts, S.form, S.doc.pages); S.reference = true;
        setStep('profile', { status: 'done', detail: 'Reference pre-review loaded (Claude is not available in this view)' });
      } else {
        S.result = Review.deterministicOnly(S.facts, S.form, S.doc.pages);
        setStep('profile', { status: 'fail', detail: 'Claude is not available in this view: required blocks only' });
      }
      finishRun();
      return;
    }
    S.running = true;
    S.abort = new AbortController();
    renderRail();
    try {
      const learning = await Learn.memoryFor(S.facts, S.doc.pages);
      S.learningUsed = { rules: learning.memory.rules.length, precedents: learning.memory.verdicts.length };
      const result = await Review.run({
        doc: S.doc, pages: S.doc.pages, form: S.form, facts: S.facts, caps: S.caps, memory: learning.memory, stats: learning.stats, noCache,
        signal: S.abort.signal, onStep: setStep,
        onPagesReplaced: (pages, facts) => { S.doc.pages = pages; S.facts = facts; renderViewer(); },
      });
      S.result = result;
      setStep('assemble', { status: 'done', detail: result.findings.length + ' attention points' });
    } catch (e) {
      console.warn('pre-review failed', e);
      const code = e && e.code ? e.code : 'upstream_error';
      const copy = {
        not_granted: 'Claude was not allowed for this page. The required blocks are still checked below.',
        cancelled: 'Stopped.', rate_limited: 'Claude is busy or the usage limit is reached. Try again in a few minutes.',
        prompt_too_large: 'The document is too large for one pass; try a shorter version.',
        invalid_json: 'The model answered in an unexpected shape. Run again.',
        refused: 'The model declined this content.', session_expired: 'Sign in again to continue.',
        sampling_disabled: 'Claude is not available for this account.', empty_completion: 'No text could be read from the file.',
      };
      S.lastError = copy[code] || ('The review could not complete (' + code + '). Run again.');
      S.result = Review.deterministicOnly(S.facts, S.form, S.doc.pages);
      S.result.meta.error = S.lastError;
      setStep('assemble', { status: 'fail', detail: code === 'cancelled' ? 'Stopped by you' : S.lastError });
    } finally { S.running = false; S.abort = null; }
    finishRun();
  }
  function finishRun() {
    if (Calibration.isReferenceDeck(S.doc.pages) && S.result && !S.result.meta.deterministicOnly) S.calib = Calibration.score(S.result.findings);
    if (S.result) {
      const c = Review.counts(S.result.findings);
      if (S.tab !== 'summary') S.tab = c.A + c.B ? 'disclosures' : 'language';
    }
    renderHead(); renderStatus(); drawMarks(); renderRail();
  }

  /* ---------- toolbar ---------- */
  function renderHead() {
    const f = S.facts;
    const meta = $('wh-meta');
    meta.innerHTML = '';
    if (f) {
      meta.append(el('span', { class: 'tag grey', text: f.lane === 'institutional' ? 'Institutional' : 'Retail' }));
      meta.append(el('span', { class: 'tag grey', text: S.doc.pages.length + (S.doc.kind === 'pdf' ? ' pages' : S.doc.kind === 'image' ? ' image' : ' sections') }));
    }
    $('pg-of').textContent = '/ ' + S.doc.pages.length;
    $('pg-input').value = String(S.page);
    $('zoom-pct').textContent = Math.round(S.zoom * 100) + '%';
    const c = S.result ? Review.counts(S.result.findings) : null;
    $('tab-language-n').textContent = c ? String(c.C) : '0';
    $('tab-disclosures-n').textContent = c ? String(c.A + c.B) : '0';
    $('tab-language-n').className = 'badge ' + (c && c.C ? '' : 'grey');
    $('tab-disclosures-n').className = 'badge ' + (c && (c.A + c.B) ? 'warn' : 'grey');
    renderPointNav();
  }

  /* ---------- viewer ---------- */
  const rendered = new Set();
  let observer = null;
  function renderViewer() {
    const stage = $('stage');
    stage.innerHTML = '';
    rendered.clear();
    if (observer) observer.disconnect();
    applyZoom();
    const pages = S.doc.pages;
    pages.forEach((p) => {
      const box = el('div', { class: 'pagebox', id: 'page-' + p.number, 'data-page': p.number });
      if (S.doc.kind === 'pdf') {
        const ratio = p.height && p.width ? (p.height / p.width) : 0.75;
        box.append(el('div', { class: 'ph', style: 'height:0;padding-bottom:' + (ratio * 100).toFixed(2) + '%' }));
      } else if (S.doc.kind === 'image') {
        const wrap = el('div', { class: 'imgpage' });
        wrap.append(el('img', { src: S.doc.imageUrl, alt: 'Uploaded material' }));
        box.append(wrap);
        if (p.text) box.append(el('div', { class: 'textpage', 'data-textpage': p.number, text: p.text }));
      } else {
        box.append(el('div', { class: 'textpage', 'data-textpage': p.number, text: p.text || '(no text)' }));
      }
      box.append(el('div', { class: 'overlay', 'data-overlay': p.number }));
      box.append(el('div', { class: 'pins', 'data-badge': p.number }));
      box.append(el('span', { class: 'pn', text: S.doc.kind === 'pdf' ? String(p.number) : (S.doc.kind === 'image' ? 'image' : 'section ' + p.number) }));
      stage.append(box);
    });
    const viewer = $('viewer');
    if (S.doc.kind === 'pdf' && S.doc.pdf) {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) renderPdfInto(+en.target.getAttribute('data-page'), en.target); });
      }, { root: viewer, rootMargin: '700px 0px' });
      stage.querySelectorAll('.pagebox').forEach((b) => observer.observe(b));
    }
    if (!viewer.dataset.scrollBound) {
      viewer.dataset.scrollBound = '1';
      let tick = null;
      viewer.addEventListener('scroll', () => {
        if (tick) return;
        tick = requestAnimationFrame(() => {
          tick = null;
          const boxes = Array.from(document.querySelectorAll('#stage .pagebox'));
          if (!boxes.length) return;
          const y = viewer.scrollTop + viewer.clientHeight * 0.35;
          let best = boxes[0];
          boxes.forEach((b) => { if (b.offsetTop <= y) best = b; });
          const n = +best.getAttribute('data-page');
          if (n !== S.page) { S.page = n; $('pg-input').value = String(n); }
        });
      }, { passive: true });
    }
    drawMarks();
  }
  function applyZoom() {
    const viewer = $('viewer');
    const base = Math.min(1100, Math.max(320, viewer.clientWidth - 40));
    $('stage').style.maxWidth = Math.round(base * S.zoom) + 'px';
    $('zoom-pct').textContent = Math.round(S.zoom * 100) + '%';
  }
  let zoomTimer = null;
  function rerenderVisible() {
    if (!S.doc || S.doc.kind !== 'pdf' || !S.doc.pdf) return;
    clearTimeout(zoomTimer);
    zoomTimer = setTimeout(() => {
      rendered.clear();
      const viewer = $('viewer');
      const top = viewer.scrollTop - 600;
      const bottom = viewer.scrollTop + viewer.clientHeight + 600;
      document.querySelectorAll('#stage .pagebox').forEach((box) => {
        if (box.offsetTop + box.clientHeight < top || box.offsetTop > bottom) return;
        renderPdfInto(+box.getAttribute('data-page'), box);
      });
    }, 180);
  }
  async function renderPdfInto(n, box) {
    if (rendered.has(n)) return;
    rendered.add(n);
    try {
      const width = Math.min(2400, Math.max(700, (box.clientWidth || 900) * 1.6));
      const canvas = await Extract.renderPdfPage(S.doc.pdf, n, width);
      const old = box.querySelector('canvas');
      const ph = box.querySelector('.ph');
      if (old) old.replaceWith(canvas); else if (ph) ph.replaceWith(canvas); else box.prepend(canvas);
    } catch (e) { rendered.delete(n); }
  }
  function currentFindings() { return S.result ? S.result.findings : Review.tierAFindings(S.facts || { required: [] }, S.form); }
  function drawMarks() {
    if (!S.doc) return;
    const findings = currentFindings();
    document.querySelectorAll('[data-overlay]').forEach((o) => { o.innerHTML = ''; });
    document.querySelectorAll('[data-badge]').forEach((o) => { o.innerHTML = ''; });
    document.querySelectorAll('[data-textpage]').forEach((n) => { delete n.dataset.marked; });
    const perPage = {};
    findings.forEach((f) => {
      (f.pages && f.pages.length ? f.pages : (f.page ? [f.page] : [])).forEach((n) => { (perPage[n] = perPage[n] || []).push(f); });
      (f.boxes || []).forEach((b) => {
        const overlay = document.querySelector('[data-overlay="' + b.page + '"]');
        if (!overlay) return;
        const m = el('div', { class: 'mark' + (S.active === f.id ? ' active' : ''), 'data-fid': f.id, style: 'left:' + (b.x * 100).toFixed(2) + '%;top:' + (b.y * 100).toFixed(2) + '%;width:' + (b.w * 100).toFixed(2) + '%;height:' + (b.h * 100).toFixed(2) + '%', title: f.rule + ' · ' + f.title, role: 'button', tabindex: '0' });
        m.addEventListener('click', (e) => { e.stopPropagation(); selectFinding(f, { scrollPage: false, scrollPanel: true }); });
        m.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectFinding(f, { scrollPage: false, scrollPanel: true }); } });
        overlay.append(m);
      });
    });
    if (S.doc.kind !== 'pdf') S.doc.pages.forEach((p) => highlightText(p.number, findings));
    Object.keys(perPage).forEach((n) => {
      const badge = document.querySelector('[data-badge="' + n + '"]');
      if (!badge) return;
      const list = perPage[n];
      const hi = list.filter((f) => f.severity === 'high').length;
      const pin = el('span', { class: 'pin' });
      pin.append(el('span', { class: 'd', style: 'background:' + (hi ? 'var(--danger)' : 'var(--warn)') }), document.createTextNode(list.length + (list.length === 1 ? ' point' : ' points')));
      badge.append(pin);
    });
  }
  function highlightText(n, findings) {
    const node = document.querySelector('[data-textpage="' + n + '"]');
    if (!node || node.dataset.marked) return;
    const page = S.doc.pages.find((p) => p.number === n);
    const text = page.text || '';
    const ranges = findings.filter((x) => x.page === n && x.range).map((x) => x.range).sort((a, b) => a.start - b.start);
    const frag = document.createDocumentFragment();
    let cur = 0;
    ranges.forEach((r) => { if (r.start < cur) return; frag.append(document.createTextNode(text.slice(cur, r.start))); frag.append(el('mark', { text: text.slice(r.start, r.end) })); cur = r.end; });
    frag.append(document.createTextNode(text.slice(cur)));
    node.innerHTML = ''; node.append(frag); node.dataset.marked = '1';
  }
  function scrollToPage(n, f) {
    const box = $('page-' + n);
    const viewer = $('viewer');
    if (!box || !viewer) return;
    let top = box.offsetTop - 12;
    if (f && f.boxes && f.boxes.length) {
      const b = f.boxes.find((x) => x.page === n) || f.boxes[0];
      const y = box.offsetTop + b.y * box.clientHeight;
      if (b.y > 0.35) top = Math.max(box.offsetTop - 12, y - viewer.clientHeight * 0.35);
    }
    viewer.scrollTo({ top, behavior: 'smooth' });
    if (isMobile()) window.scrollTo({ top: 0, behavior: 'smooth' });
    S.page = n; $('pg-input').value = String(n);
  }
  function orderedFindings() {
    return currentFindings().slice().sort((a, b) => ((a.page || 0) - (b.page || 0)) || (a.id > b.id ? 1 : -1));
  }
  function selectFinding(f, opts) {
    opts = opts || {};
    S.active = f.id;
    const wantTab = tierOfTab(f);
    if (S.tab !== 'summary' && S.tab !== wantTab) { S.tab = wantTab; S.filter = 'all'; renderRail(); }
    document.querySelectorAll('.card.active').forEach((c) => c.classList.remove('active'));
    const card = document.querySelector('[data-card="' + f.id + '"]');
    if (card) { card.classList.add('active'); if (opts.scrollPanel !== false) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    document.querySelectorAll('.mark.active').forEach((m) => m.classList.remove('active'));
    document.querySelectorAll('.mark.pulse').forEach((m) => m.classList.remove('pulse'));
    document.querySelectorAll('.mark[data-fid="' + f.id + '"]').forEach((m) => { m.classList.add('active'); m.classList.add('pulse'); });
    renderPointNav();
    const n = f.page || (f.pages && f.pages[0]);
    if (n && opts.scrollPage !== false) scrollToPage(n, f);
    if (isMobile() && opts.scrollPage !== false) toggleRail(false);
  }
  function goTo(f) { selectFinding(f, { scrollPage: true, scrollPanel: false }); }
  function stepFinding(delta) {
    const list = orderedFindings();
    if (!list.length) return;
    let i = list.findIndex((f) => f.id === S.active);
    i = i === -1 ? (delta > 0 ? 0 : list.length - 1) : (i + delta + list.length) % list.length;
    selectFinding(list[i], { scrollPage: true, scrollPanel: true });
  }
  function renderPointNav() {
    const nav = $('pointnav');
    const list = orderedFindings();
    nav.hidden = !list.length;
    if (!list.length) return;
    const i = list.findIndex((f) => f.id === S.active);
    $('pt-label').textContent = (i === -1 ? '–' : String(i + 1)) + ' / ' + list.length + ' points';
  }
  function toggleRail(open) {
    S.railOpen = typeof open === 'boolean' ? open : !S.railOpen;
    const mobile = isMobile();
    $('rail').style.display = mobile ? (S.railOpen ? 'flex' : 'none') : '';
    $('viewer').style.display = mobile ? (S.railOpen ? 'none' : '') : '';
    $('rail-toggle').textContent = S.railOpen ? 'Document' : 'Points';
  }

  /* ---------- panel ---------- */
  function renderRail() {
    const body = $('railbody');
    const keep = body.scrollTop;
    body.innerHTML = '';
    const setup = S.phase === 'setup' && S.mode === 'banker' && !S.viewing;
    document.querySelectorAll('.panel-tabs [role=tab]').forEach((t) => { t.setAttribute('aria-selected', String(t.dataset.tab === S.tab)); t.hidden = setup; });
    $('btn-back-label').textContent = S.viewing ? 'Inbox' : 'Form';
    if (setup) { renderSub([]); renderSetup(body); $('gate').hidden = true; return; }
    const findings = currentFindings();
    renderSub(findings);
    if (S.tab === 'summary') renderSummary(body, findings);
    else renderList(body, findings.filter((f) => tierOfTab(f) === S.tab));
    renderGate();
    body.scrollTop = keep;
  }
  function renderSub(findings) {
    const sub = $('panel-sub');
    sub.innerHTML = '';
    if (S.phase === 'setup' && S.mode === 'banker' && !S.viewing) { sub.append(el('span', { text: 'Finalis AI Prescreen · setup' }), el('span', { class: 'grow' })); return; }
    const list = S.tab === 'summary' ? findings : findings.filter((f) => tierOfTab(f) === S.tab);
    const need = findings.filter((f) => f.severity === 'high' && Review.isCertain(f) && (!S.responses[f.id] || S.responses[f.id].status === 'none')).length;
    const toVerify = findings.filter((f) => !Review.isCertain(f)).length;
    sub.append(el('span', { text: S.running ? 'Reviewing…' : (S.tab === 'summary' ? findings.length + ' attention point' + (findings.length === 1 ? '' : 's') : list.length + ' suggestion' + (list.length === 1 ? '' : 's')) }));
    if (need && S.mode === 'banker' && !S.viewing && S.result) sub.append(el('span', { class: 'tag high', text: need + ' need an answer' }));
    if (toVerify && S.result && !S.running && S.tab === 'summary') sub.append(el('span', { class: 'tag violet', text: toVerify + ' for Finalis review' }));
    sub.append(el('span', { class: 'grow' }));
    if (S.result && S.caps.sample && !S.running && !S.viewing) {
      const rerun = el('button', { class: 'btn ghost icon', type: 'button', title: 'Run again (fresh answer)', 'aria-label': 'Run again' });
      rerun.append(svg('refresh'));
      rerun.addEventListener('click', async () => { S.result = null; S.steps = S.steps.filter((s) => s.key === 'extract' || s.key === 'blocks'); S.calib = null; S.reference = false; S.expanded = {}; S.ai = {}; renderHead(); renderStatus(); renderRail(); await runModel(true); });
      sub.append(rerun);
    }
    if (S.result && S.caps.downloads) {
      const dl = el('button', { class: 'btn ghost icon', type: 'button', title: 'Save the report (.md)', 'aria-label': 'Save the report' });
      dl.append(svg('download'));
      dl.addEventListener('click', async () => { try { await S.caps.downloads.save({ filename: 'pre-review-' + S.doc.name.replace(/\.[^.]+$/, '') + '.md', data: Notify.reportMarkdown(currentSubmissionShape()) }); } catch (e) { if (!e || e.code !== 'cancelled') U.toast('Could not save'); } });
      sub.append(dl);
    }
    if (S.running) {
      const stop = el('button', { class: 'btn xs', type: 'button' });
      stop.append(svg('stop'), document.createTextNode('Stop'));
      stop.addEventListener('click', () => { if (S.abort) S.abort.abort(); });
      sub.append(stop);
    }
  }
  function renderSteps(body) {
    if (!S.steps.length || (S.result && !S.result.meta.error && !S.running)) return;
    const wrap = el('div', { class: 'steps' });
    S.steps.forEach((s) => {
      const st = el('div', { class: 'step ' + s.status });
      const ic = el('span', { class: 'ic' });
      if (s.status === 'done') ic.append(svg('check')); else if (s.status === 'fail') ic.textContent = '!';
      const t = el('div', { class: 't', text: s.label });
      if (s.detail) t.append(el('small', { text: s.detail }));
      st.append(ic, t);
      wrap.append(st);
    });
    body.append(wrap);
    if (S.running) body.append(el('div', { class: 'helper', style: 'margin:-4px 2px 12px', text: 'Thorough runs take 2 to 4 minutes on a long deck. The first call asks you to allow Claude for this page.' }));
  }
  function renderList(body, list) {
    renderSteps(body);
    if (S.result && S.result.meta.error) { const n = el('div', { class: 'note red', style: 'margin-bottom:10px' }); n.append(svg('alert'), el('span', { text: S.result.meta.error })); body.append(n); }
    if (S.result && S.result.meta.deterministicOnly && !S.result.meta.error) { const n = el('div', { class: 'note amber', style: 'margin-bottom:10px' }); n.append(svg('alert'), el('span', { text: 'Claude is not available in this view: only the required blocks were checked. Open the page in the Claude app to run the full pre-review.' })); body.append(n); }
    if (S.result && S.result.meta.reference) { const n = el('div', { class: 'note blue', style: 'margin-bottom:10px' }); n.append(el('span', { text: S.result.meta.note })); body.append(n); }
    if (S.result && S.result.meta.truncated) { const n = el('div', { class: 'note amber', style: 'margin-bottom:10px' }); n.append(el('span', { text: 'The model\'s answer was cut short; some points may be missing.' })); body.append(n); }
    if (!S.result && !S.running) return;
    const filters = el('div', { class: 'filters' });
    const opts = S.tab === 'language' ? [['all', 'All'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']] : [['all', 'All'], ['high', 'High'], ['A', 'Required'], ['B', 'Triggered']];
    opts.forEach(([k, label]) => {
      const b = el('button', { type: 'button', 'aria-pressed': String(S.filter === k), text: label });
      b.addEventListener('click', () => { S.filter = k; renderRail(); });
      filters.append(b);
    });
    body.append(filters);
    const shown = list.filter((f) => S.filter === 'all' || (['high', 'medium', 'low'].includes(S.filter) ? f.severity === S.filter : f.tier === S.filter));
    if (!shown.length) { body.append(el('div', { class: 'empty', text: S.running ? 'Reading…' : (list.length ? 'Nothing in this filter.' : (S.tab === 'language' ? 'No language points. The wording reads as fair and balanced under the rulebook.' : 'No disclosure points.')) })); return; }
    const certain = shown.filter((f) => Review.isCertain(f));
    const verify = shown.filter((f) => !Review.isCertain(f));
    if (S.tab === 'disclosures') {
      const req = certain.filter((f) => f.tier === 'A');
      const trig = certain.filter((f) => f.tier === 'B');
      if (req.length) { body.append(sectionHead('Required blocks', req.length)); req.forEach((f) => body.append(cardDisclosure(f))); }
      if (trig.length) { body.append(sectionHead('Triggered by the content', trig.length)); trig.forEach((f) => body.append(cardDisclosure(f))); }
      if (verify.length) { body.append(sectionHead('For Finalis review', verify.length, true)); body.append(verifyIntro()); verify.forEach((f) => body.append(cardDisclosure(f))); }
    } else {
      if (certain.length) { body.append(sectionHead(S.facts.lane === 'institutional' ? 'Institutional Marketing Compliance' : 'Retail Marketing Compliance', certain.length)); certain.forEach((f) => body.append(cardLanguage(f))); }
      if (verify.length) { body.append(sectionHead('For Finalis review', verify.length, true)); body.append(verifyIntro()); verify.forEach((f) => body.append(cardLanguage(f))); }
    }
    if (S.result && S.result.suppressed && S.result.suppressed.length && S.filter === 'all') {
      const sup = S.result.suppressed.filter((s) => (S.tab === 'language') === /^C/.test(s.rule));
      if (sup.length) {
        const d = el('details', { style: 'margin-top:8px' });
        const sm = el('summary', { style: 'cursor:pointer;font-size:12.5px;color:var(--text-3);padding:6px 4px', text: sup.length + ' candidate' + (sup.length === 1 ? '' : 's') + ' set aside · what a naive scan would have raised' });
        d.append(sm);
        sup.forEach((s) => d.append(el('div', { class: 'sub-item', html: '<span class="code">' + U.esc(s.rule) + ' · p. ' + U.esc((s.pages || []).join(', ') || '–') + '</span>' + (s.quote ? '<i>' + U.esc(s.quote.slice(0, 100)) + '</i> · ' : '') + U.esc(s.reason) })));
        body.append(d);
      }
    }
  }
  function sectionHead(label, n, verify) {
    const h = el('div', { class: 'section-h' + (verify ? ' v' : '') });
    h.append(el('span', { text: label }), el('span', { class: 'line' }), el('span', { class: 'badge ' + (verify ? 'grey' : n ? 'warn' : 'grey'), text: String(n) }));
    return h;
  }
  function verifyIntro() {
    return el('div', { class: 'helper', style: 'margin:-2px 4px 10px', text: S.viewing ? 'These points were shown to the banker as pending your verification, not as facts. Confirm or dismiss each one; your verdict trains the next pre-reviews.' : 'Possible points the pre-review is not certain enough to assert. The Finalis reviewer confirms or dismisses them; no answer is required from you, a comment helps.' });
  }
  function verifyTag() { return el('span', { class: 'tag vtag', text: 'Finalis review' }); }
  function verifyNote(f) {
    const n = el('div', { class: 'verify-note' });
    n.append(el('b', { text: 'Awaiting verification by Finalis Compliance' }), document.createTextNode(f.why_verify ? ' · ' + f.why_verify + '.' : '.'));
    return n;
  }
  function riskTag(sev) {
    const t = el('span', { class: 'tag ' + sev });
    const bars = el('span', { class: 'bars' }); bars.append(el('i'), el('i'), el('i'));
    t.append(bars, document.createTextNode(sev === 'high' ? 'High risk' : sev === 'medium' ? 'Medium risk' : 'Low risk'));
    return t;
  }
  function pageBtn(f) {
    const label = f.pages && f.pages.length > 1 ? 'p. ' + f.pages.join(', ') : f.page ? 'p. ' + f.page : 'document';
    const b = el('button', { class: 'pgbtn', type: 'button', text: label });
    b.addEventListener('click', (e) => { e.stopPropagation(); goTo(f); });
    return b;
  }
  function iconBtn(name, title, on, expanded) {
    const b = el('button', { class: 'ib' + (on ? ' on' : ''), type: 'button', title, 'aria-label': title });
    if (expanded !== undefined) b.setAttribute('aria-expanded', String(!!expanded));
    b.append(svg(name));
    return b;
  }
  function copyBox(cap, text) {
    const b = el('div', { class: 'copybox' });
    b.append(el('div', { class: 'cap', text: cap }), document.createTextNode(text));
    const c = el('button', { class: 'btn xs cp', type: 'button' }); c.append(svg('copy'), document.createTextNode('Copy'));
    c.addEventListener('click', () => U.copyText(text));
    b.append(c);
    return b;
  }
  function toggleExpand(f, key) {
    const cur = S.expanded[f.id] || {};
    cur[key] = !cur[key];
    S.expanded[f.id] = cur;
    renderRail();
  }
  function baseCard(f) {
    const c = el('div', { class: 'card' + (S.active === f.id ? ' active' : ''), 'data-card': f.id });
    c.addEventListener('click', (e) => { if (e.target.closest('button, input, textarea, summary, a, details')) return; selectFinding(f, { scrollPage: true, scrollPanel: false }); });
    return c;
  }
  function catTag(kind) {
    const t = el('span', { class: 'tag grey' });
    t.append(el('span', { style: 'width:7px;height:7px;border-radius:50%;display:inline-block;background:' + (kind === 'Compliance' ? 'var(--danger)' : '#F79009') }), document.createTextNode(kind));
    return t;
  }
  function cardLanguage(f) {
    const c = baseCard(f);
    const ex = S.expanded[f.id] || {};
    const top = el('div', { class: 'top' });
    top.append(catTag('Compliance'), el('span', { class: 'code', text: f.rule }), el('span', { class: 'grow' }));
    const why = iconBtn('bulb', 'Why is this a potential risk?', false, ex.why); why.addEventListener('click', () => toggleExpand(f, 'why'));
    const sug = iconBtn('spark', 'Suggestions', false, ex.sugg); sug.addEventListener('click', () => toggleExpand(f, 'sugg'));
    top.append(why, sug);
    if (S.mode === 'banker' && !S.viewing) { const dis = iconBtn('down', 'Not relevant (disagree)', (S.responses[f.id] || {}).status === 'disagree'); dis.addEventListener('click', () => setResponse(f, 'disagree')); top.append(dis); }
    c.append(top);
    if (f.quote) { const q = el('div', { class: 'quote pg-link', text: '“' + f.quote + '”' }); q.addEventListener('click', () => goTo(f)); c.append(q); }
    else c.append(el('div', { class: 'quote', text: f.title }));
    const row = el('div', { class: 'row' });
    row.append(riskTag(f.severity), el('span', { class: 'tag info', text: LABELS[f.rule] || f.category }));
    if (!Review.isCertain(f)) row.append(verifyTag());
    else if (f.action === 'escalate') row.append(el('span', { class: 'tag violet', text: 'Escalate' }));
    if (f.unverified) row.append(el('span', { class: 'tag medium', text: 'Quote not found' }));
    row.append(pageBtn(f));
    c.append(row);
    if (!Review.isCertain(f)) c.append(verifyNote(f));
    if (f.note) c.append(el('div', { class: 'kv', style: 'color:var(--text-3);font-size:12.5px', text: f.note }));
    if (ex.why) c.append(whyBlock(f));
    if (ex.sugg) c.append(suggBlock(f));
    if (S.mode === 'banker' && !S.viewing) c.append(responseBlock(f));
    if (S.viewing) c.append(reviewerBlock(f));
    return c;
  }
  function cardDisclosure(f) {
    const c = baseCard(f);
    const ex = S.expanded[f.id] || {};
    const top = el('div', { class: 'top' });
    top.append(catTag('Disclosure'), el('span', { class: 'grow' }));
    const why = iconBtn('bulb', 'Why is this required?', false, ex.why); why.addEventListener('click', () => toggleExpand(f, 'why'));
    top.append(why);
    if (S.mode === 'banker' && !S.viewing) { const dis = iconBtn('down', 'Not relevant (disagree)', (S.responses[f.id] || {}).status === 'disagree'); dis.addEventListener('click', () => setResponse(f, 'disagree')); top.append(dis); }
    c.append(top);
    const h = el('div', { class: 'head2' });
    h.append(svg('doc'), el('span', { class: 'code', text: f.rule }), el('span', { text: '|', style: 'color:var(--text-4)' }), el('span', { text: f.category || f.title }));
    c.append(h);
    const row = el('div', { class: 'row' });
    const missing = f.action === 'add' || f.action === 'source' || (f.det && /missing/i.test(f.title));
    if (missing) { const t = el('span', { class: 'tag high' }); t.append(svg('x'), document.createTextNode(f.action === 'source' ? 'Source missing' : 'Missing from document')); row.append(t); }
    else if (f.action === 'remove') row.append(el('span', { class: 'tag high', text: 'Must be removed' }));
    else if (f.action === 'confirm') row.append(el('span', { class: 'tag medium', text: 'To confirm' }));
    else if (f.action === 'escalate') row.append(el('span', { class: 'tag violet', text: 'Escalate' }));
    row.append(riskTag(f.severity));
    if (!Review.isCertain(f)) row.append(verifyTag());
    row.append(pageBtn(f));
    c.append(row);
    if (f.quote) c.append(el('div', { class: 'kv', html: '<b>Trigger:</b> <i>“' + U.esc(f.quote) + '”</i>' }));
    if (!Review.isCertain(f)) c.append(verifyNote(f));
    if (f.note) c.append(el('div', { class: 'kv', style: 'color:var(--text-3);font-size:12.5px', text: f.note }));
    if (f.text_to_add) {
      const long = f.text_to_add.length > 220 && !ex.more;
      const kv = el('div', { class: 'kv' });
      kv.append(el('b', { text: 'Disclosure information: ' }), document.createTextNode(long ? f.text_to_add.slice(0, 220) + '…' : f.text_to_add));
      c.append(kv);
      if (f.text_to_add.length > 220) { const more = el('button', { class: 'more', type: 'button', text: long ? 'View more' : 'View less' }); more.addEventListener('click', () => toggleExpand(f, 'more')); c.append(more); }
      if (f.placement) c.append(el('div', { class: 'kv', html: '<b>Where:</b> ' + U.esc(f.placement) }));
      const cp = el('button', { class: 'btn xs', type: 'button', style: 'margin-top:8px' }); cp.append(svg('copy'), document.createTextNode('Copy disclosure text'));
      cp.addEventListener('click', () => U.copyText(f.text_to_add));
      c.append(cp);
    } else if (f.rewrite) c.append(copyBox('Suggested rewrite', f.rewrite));
    if (ex.why) c.append(whyBlock(f));
    if (S.mode === 'banker' && !S.viewing) c.append(responseBlock(f));
    if (S.viewing) c.append(reviewerBlock(f));
    return c;
  }
  function aiCtx() { return { lane: S.facts ? S.facts.lane : 'retail', docLabel: Prompts.DOC_LABELS[S.form.docType] || '', pages: S.doc ? S.doc.pages : [] }; }
  function whyBlock(f) {
    const w = el('div', { class: 'expand' });
    w.append(el('h5', { text: f.tier === 'C' ? 'Why is this a potential risk?' : 'Why is this required?' }));
    w.append(el('p', { text: f.issue || '' }));
    if (f.basis) w.append(el('p', { style: 'margin-top:4px;color:var(--text-3);font-size:12.5px', text: f.basis }));
    if (S.caps.sample) {
      const ai = S.ai[f.id] || {};
      const row = el('div', { class: 'askrow' });
      const input = el('input', { type: 'text', id: 'ask-' + f.id, placeholder: 'Ask about this point (e.g. does a footnote suffice?)', value: ai.q || '' });
      const send = el('button', { class: 'btn sm', type: 'button', 'aria-label': 'Ask' }); send.append(svg('send'));
      const explain = el('button', { class: 'btn sm', type: 'button', text: 'Explain in plain words' });
      const run = async (kind) => {
        const q = input.value.trim();
        if (kind === 'ask' && !q) return;
        S.ai[f.id] = Object.assign({}, S.ai[f.id], { q, busy: true, answer: '' });
        renderRail();
        try {
          const onText = ({ text }) => { S.ai[f.id].answer = text; const node = document.querySelector('[data-answer="' + f.id + '"] .txt'); if (node) node.textContent = text; };
          const text = kind === 'ask' ? await Ask.question(S.caps.sample, f, aiCtx(), q, onText) : await Ask.why(S.caps.sample, f, aiCtx(), onText);
          S.ai[f.id] = Object.assign({}, S.ai[f.id], { busy: false, answer: text });
        } catch (e) { S.ai[f.id] = Object.assign({}, S.ai[f.id], { busy: false, answer: e && e.text ? e.text : 'Claude could not answer (' + (e && e.code ? e.code : 'error') + ').' }); }
        renderRail();
      };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') run('ask'); });
      send.addEventListener('click', () => run('ask'));
      explain.addEventListener('click', () => run('why'));
      row.append(input, send);
      w.append(row, el('div', { style: 'margin-top:6px' }, [explain]));
      if (ai.busy || ai.answer) {
        const a = el('div', { class: 'answer', 'data-answer': f.id });
        const who = el('div', { class: 'who' }); who.append(svg('spark'), document.createTextNode(ai.busy ? 'Claude · thinking' : 'Claude'));
        a.append(who, el('div', { class: 'txt', text: ai.answer || 'Thinking…' }));
        w.append(a);
      }
    }
    return w;
  }
  function suggBlock(f) {
    const w = el('div', { class: 'expand' });
    w.append(el('h5', { text: 'Suggestions' }));
    if (f.rewrite) w.append(copyBox('Suggested rewrite', f.rewrite));
    if (f.text_to_add) w.append(copyBox('Text to add' + (f.placement ? ' · ' + f.placement : ''), f.text_to_add));
    if (!f.rewrite && !f.text_to_add) w.append(el('p', { text: f.action === 'remove' ? 'Remove the passage.' : f.action === 'source' ? 'Add a source on the page, or "Source: Information provided by Sponsoring/Issuing Company."' : 'Confirm the facts with the banker, or escalate.' }));
    if (S.caps.sample && f.quote) {
      const ai = S.ai[f.id] || {};
      const b = el('button', { class: 'btn sm', type: 'button', style: 'margin-top:8px' }); b.append(svg('spark'), document.createTextNode(ai.alts ? 'More alternatives' : 'Propose 3 alternative wordings'));
      b.disabled = !!ai.altBusy;
      b.addEventListener('click', async () => {
        S.ai[f.id] = Object.assign({}, S.ai[f.id], { altBusy: true }); renderRail();
        try { const alts = await Ask.alternatives(S.caps.sample, f, aiCtx()); S.ai[f.id] = Object.assign({}, S.ai[f.id], { altBusy: false, alts }); }
        catch (e) { S.ai[f.id] = Object.assign({}, S.ai[f.id], { altBusy: false, alts: [] }); U.toast('Claude could not propose alternatives'); }
        renderRail();
      });
      w.append(b);
      if (ai.altBusy) w.append(el('div', { class: 'helper', text: 'Writing alternatives…' }));
      if (ai.alts && ai.alts.length) {
        const ul = el('ul', { class: 'alts' });
        ai.alts.forEach((t) => { const li = el('li'); const cp = el('button', { class: 'btn xs', type: 'button', 'aria-label': 'Copy' }); cp.append(svg('copy')); cp.addEventListener('click', () => U.copyText(t)); li.append(el('span', { text: t }), cp); ul.append(li); });
        w.append(ul);
      }
    }
    return w;
  }
  function setResponse(f, status) {
    const r = S.responses[f.id] || { status: 'none', note: '' };
    S.responses[f.id] = Object.assign({}, r, { status: r.status === status ? 'none' : status });
    renderRail();
  }
  function responseBlock(f) {
    const r = S.responses[f.id] || { status: 'none', note: '' };
    const wrap = el('div', { class: 'resp' });
    const lbl = el('div', { class: 'lbl' });
    const certain = Review.isCertain(f);
    lbl.append(el('span', { text: certain ? 'Your answer' : 'Your comment (optional)' }));
    if (certain && f.severity === 'high' && r.status === 'none') lbl.append(el('span', { class: 'need', text: 'Required before submission' }));
    wrap.append(lbl);
    const chips = el('div', { class: 'chips' });
    Object.keys(RESP).forEach((k) => {
      const ch = el('button', { class: 'chip' + (r.status === k ? ' on' : ''), type: 'button' });
      if (r.status === k) ch.append(svg('check'));
      ch.append(document.createTextNode(RESP[k]));
      ch.addEventListener('click', () => setResponse(f, k));
      chips.append(ch);
    });
    wrap.append(chips);
    if (r.status === 'covered' || r.status === 'disagree') {
      const input = el('input', { type: 'text', id: 'resp-' + f.id, placeholder: r.status === 'covered' ? 'Where is it covered? e.g. page 3, paragraph 2' : 'Tell the reviewer why', value: r.note || '' });
      input.addEventListener('input', () => { S.responses[f.id] = Object.assign({}, S.responses[f.id], { note: input.value }); renderGate(); });
      wrap.append(input);
    }
    return wrap;
  }
  function reviewerBlock(f) {
    const sub = S.viewing;
    const resp = sub.responses && sub.responses[f.id];
    const certain = Review.isCertain(f);
    const wrap = el('div', { class: 'resp' });
    wrap.append(el('div', { class: 'said', html: resp && resp.status && resp.status !== 'none' ? '<b>Banker:</b> ' + U.esc(RESP[resp.status]) + (resp.note ? ' — ' + U.esc(resp.note) : '') : '<b>Banker:</b> ' + (certain ? 'no answer' : 'no comment (not asked to answer)') }));
    const v = (sub.verdicts && sub.verdicts[f.id]) || {};
    const row = el('div', { class: 'verdict' });
    row.append(el('span', { class: 'helper', style: 'margin:0', text: certain ? 'Your verdict' : 'Verification' }));
    const yes = el('button', { type: 'button', class: 'chip ' + (certain ? 'yes' : 'confirm') + (v.verdict === 'correct' ? ' on' : ''), 'data-verify': certain ? '' : 'confirm' }); yes.append(svg('check'), document.createTextNode(certain ? 'Correct flag' : 'Confirm'));
    const no = el('button', { type: 'button', class: 'chip ' + (certain ? 'no' : 'dismiss') + (v.verdict === 'incorrect' ? ' on' : ''), 'data-verify': certain ? '' : 'dismiss' }); no.append(svg('x'), document.createTextNode(certain ? 'Incorrect flag' : 'Dismiss'));
    yes.addEventListener('click', () => setVerdict(f, 'correct'));
    no.addEventListener('click', () => setVerdict(f, 'incorrect'));
    row.append(yes, no);
    if (!certain && !v.verdict) row.append(el('span', { class: 'tag vtag', text: 'Awaiting' }));
    if (!certain && v.verdict === 'correct') row.append(el('span', { class: 'tag ok', text: 'Confirmed as a point' }));
    if (!certain && v.verdict === 'incorrect') row.append(el('span', { class: 'tag grey', text: 'Dismissed' }));
    wrap.append(row);
    if (v.verdict === 'incorrect') {
      const input = el('input', { type: 'text', id: 'verdict-' + f.id, placeholder: 'Why? This teaches the next pre-reviews.', value: v.reason || '' });
      input.addEventListener('change', () => setVerdict(f, 'incorrect', input.value));
      wrap.append(input);
    }
    return wrap;
  }
  async function setVerdict(f, verdict, reason) {
    const sub = S.viewing;
    sub.verdicts = sub.verdicts || {};
    const cur = sub.verdicts[f.id] || {};
    if (cur.verdict === verdict && reason === undefined) delete sub.verdicts[f.id];
    else sub.verdicts[f.id] = { verdict, reason: reason !== undefined ? reason : (cur.reason || ''), at: new Date().toISOString() };
    await Store.updateSubmission(sub.id, { verdicts: sub.verdicts });
    if (sub.verdicts[f.id] && (verdict === 'correct' || reason)) await Store.addCalibration({ rule: f.rule, lane: sub.lane, docType: sub.form.docType, page: f.page, quote: f.quote || f.title, verdict, reason: reason || '', submission: sub.id });
    renderRail();
  }

  /* ---------- summary tab ---------- */
  function renderSummary(body, findings) {
    renderSteps(body);
    const r = S.result;
    if (!r) { if (!S.running) body.append(el('div', { class: 'empty', text: 'The summary is written at the end of the pre-review.' })); return; }
    const c = Review.counts(findings);
    const g = gateState();
    const st = el('div', { class: 'summary-card' });
    const h = el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:10px' });
    const ic = el('span', { style: 'display:inline-flex;color:' + (g.ok ? 'var(--success)' : 'var(--warn)') }); ic.append(svg(g.ok ? 'checkCircle' : 'alert'));
    h.append(ic, el('h4', { style: 'margin:0', text: S.viewing ? 'Submitted for review' : (g.ok ? 'Ready to submit' : 'Not ready to submit') }));
    st.append(h);
    if (!S.viewing) st.append(el('p', { class: 'helper', style: 'margin:-4px 0 10px', text: g.why }));
    const grid = el('div', { class: 'grid' });
    [['high', c.high, 'High'], ['medium', c.medium, 'Medium'], ['low', c.low, 'Low']].forEach(([k, n, l]) => { const s = el('div', { class: 'stat' }); s.append(el('div', { class: 'n', style: 'color:var(--' + (k === 'high' ? 'danger' : k === 'medium' ? 'warn' : 'success') + ')', text: String(n) }), el('div', { class: 'l', text: l + ' risk' })); grid.append(s); });
    st.append(grid);
    st.append(el('p', { class: 'helper', text: 'Required blocks ' + c.A + ' · triggered disclosures ' + c.B + ' · language ' + c.C + (r.suppressed && r.suppressed.length ? ' · ' + r.suppressed.length + ' candidates set aside' : '') }));
    if (!r.meta.deterministicOnly) {
      const a = el('div', { class: 'gc', style: 'padding-top:8px' });
      a.append(el('span', { class: 'tag ok', text: String(c.certain) }), el('span', { html: '<b style="font-weight:500">asserted</b> <span style="color:var(--text-3)">deterministic checks and points confirmed by the second pass with a verbatim quote located on the page</span>' }));
      const b = el('div', { class: 'gc' });
      b.append(el('span', { class: 'tag vtag', text: String(c.verify) }), el('span', { html: '<b style="font-weight:500">for Finalis review</b> <span style="color:var(--text-3)">' + (S.viewing ? 'shown to the banker as pending your verification' : 'the reviewer confirms or dismisses them; no answer required from you') + '</span>' }));
      st.append(a, b);
    }
    body.append(st);
    if (S.calib) body.append(scoreCard(S.calib));
    if (r.gut_check && !r.meta.deterministicOnly) {
      const gc = el('div', { class: 'summary-card' });
      gc.append(el('h4', { text: '60-second gut check' }));
      [['inaccurate_picture', 'Could an investor walk away with an inaccurate picture?'], ['unsupported_claims', 'Claims the banker could not back up right now?'], ['promised_results', 'A result promised instead of a target?']].forEach(([k, q]) => {
        const x = r.gut_check[k] || {};
        const row = el('div', { class: 'gc' });
        row.append(el('span', { class: 'tag ' + (x.flag ? 'medium' : 'ok'), text: x.flag ? 'Yes' : 'No' }), el('span', { html: '<b style="font-weight:500">' + U.esc(q) + '</b>' + (x.why ? ' <span style="color:var(--text-3)">' + U.esc(x.why) + '</span>' : '') }));
        gc.append(row);
      });
      body.append(gc);
    }
    if (r.profile && r.profile.coverage) {
      const cv = el('div', { class: 'summary-card' });
      cv.append(el('h4', { text: 'Already covered in the material' }));
      Object.keys(r.profile.coverage).forEach((k) => {
        const x = r.profile.coverage[k] || {};
        const row = el('div', { class: 'covrow' });
        row.append(el('span', { class: 'd ' + (x.covered ? 'ok' : 'miss') }));
        const t = el('div');
        t.append(el('div', { text: k.replace(/_/g, ' ') + (x.covered ? '' : ' · not covered') }));
        if (x.where || x.quote) t.append(el('div', { class: 'w', text: [x.where, x.quote ? '“' + String(x.quote).slice(0, 140) + '”' : ''].filter(Boolean).join(' · ') }));
        row.append(t);
        cv.append(row);
      });
      body.append(cv);
    } else if (S.facts) {
      const cv = el('div', { class: 'summary-card' });
      cv.append(el('h4', { text: 'Required blocks' }));
      S.facts.required.forEach((q) => { const row = el('div', { class: 'covrow' }); row.append(el('span', { class: 'd ' + (q.status === 'present' || q.status === 'clear' ? 'ok' : 'miss') })); row.append(el('div', { html: '<span class="code">' + U.esc(q.id) + '</span> ' + U.esc(q.name) + '<div class="w">' + U.esc(q.status === 'present' ? 'Present on page ' + q.page : q.status === 'clear' ? 'Not present, as required' : q.status) + '</div>' })); cv.append(row); });
      body.append(cv);
    }
    if (r.brief) { const b = el('div', { class: 'summary-card' }); b.append(el('h4', { text: 'Brief for the reviewer' }), el('div', { class: 'brief', text: r.brief })); body.append(b); }
    if (r.banker_message) { const b = el('div', { class: 'summary-card' }); b.append(el('h4', { text: 'Comment to the banker' }), copyBox('Ready to paste', r.banker_message)); body.append(b); }
    if (S.learningUsed && !S.viewing) body.append(el('div', { class: 'helper', style: 'padding:0 4px 6px', text: 'Learning applied: ' + S.learningUsed.rules + ' learned rule' + (S.learningUsed.rules === 1 ? '' : 's') + ', ' + S.learningUsed.precedents + ' precedent' + (S.learningUsed.precedents === 1 ? '' : 's') + ' from reviewer verdicts.' }));
    if (r.meta && r.meta.calls && r.meta.calls.length) body.append(el('div', { class: 'helper', style: 'padding:0 4px', text: 'Model calls: ' + r.meta.calls.map((x) => x.pass + (x.batch ? ' ' + x.batch : '') + ' ' + Math.round(x.ms / 1000) + ' s, ' + Math.round(x.bytes / 1024) + ' KB' + (x.images ? ', ' + x.images + ' images' : '')).join(' · ') }));
    if (Calibration.isReferenceDeck(S.doc.pages) && !S.reference && S.caps.sample && !S.viewing) {
      const b2 = el('button', { class: 'btn sm', type: 'button', text: 'Show the reference pre-review instead' });
      b2.addEventListener('click', () => { S.result = Fixture.build(S.facts, S.form, S.doc.pages); S.reference = true; S.calib = Calibration.score(S.result.findings); S.expanded = {}; S.ai = {}; finishRun(); });
      body.append(el('div', { style: 'padding:6px 4px' }, [b2]));
    }
  }
  function scoreCard(c) {
    const wrap = el('div', { class: 'summary-card' });
    wrap.append(el('h4', { text: 'Calibration against the reviewer\'s finding sheet' }));
    const grid = el('div', { class: 'grid' });
    [[c.recall + '/' + c.expectedTotal, 'validated flags found', 'var(--success)'], [String(c.fpCount), 'rejected flags raised (of ' + c.fpTotal + ')', c.fpCount ? 'var(--danger)' : 'var(--success)'], [String(c.openCount), 'items without a verdict', 'var(--text-2)']].forEach(([n, l, col]) => { const s = el('div', { class: 'stat' }); s.append(el('div', { class: 'n', style: 'color:' + col, text: n }), el('div', { class: 'l', text: l })); grid.append(s); });
    wrap.append(grid);
    const d = el('details', { style: 'margin-top:8px' });
    d.append(el('summary', { text: 'Detail', style: 'cursor:pointer;font-size:12.5px;color:var(--text-3)' }));
    const ul = el('div', { style: 'font-size:12.5px;margin-top:6px;display:grid;gap:4px' });
    c.expected.forEach((e) => ul.append(el('div', {}, [el('span', { class: 'tag ' + (e.hit ? 'ok' : 'high'), text: e.hit ? 'found' : 'missed' }), document.createTextNode(' ' + e.label)])));
    c.falsePositives.filter((e) => e.raised).forEach((e) => ul.append(el('div', {}, [el('span', { class: 'tag high', text: 'raised' }), document.createTextNode(' ' + e.label)])));
    c.open.filter((e) => e.raised).forEach((e) => ul.append(el('div', {}, [el('span', { class: 'tag grey', text: 'open' }), document.createTextNode(' ' + e.label)])));
    d.append(ul);
    wrap.append(d);
    return wrap;
  }

  /* ---------- gate and submission ---------- */
  function gateState() {
    if (!S.result) return { ok: false, why: 'Waiting for the pre-review.' };
    const high = S.result.findings.filter((f) => f.severity === 'high' && Review.isCertain(f));
    const unanswered = high.filter((f) => !S.responses[f.id] || S.responses[f.id].status === 'none');
    if (unanswered.length) return { ok: false, why: unanswered.length + ' high point' + (unanswered.length === 1 ? '' : 's') + ' still need' + (unanswered.length === 1 ? 's' : '') + ' an answer.' };
    const noteMissing = Object.keys(S.responses).filter((id) => { const r = S.responses[id]; return (r.status === 'covered' || r.status === 'disagree') && !(r.note || '').trim(); });
    if (noteMissing.length) return { ok: false, why: 'Say where it is covered, or why you disagree.' };
    const toVerify = S.result.findings.filter((f) => !Review.isCertain(f)).length;
    return { ok: true, why: 'The reviewer receives the pre-review, your answers and the brief' + (toVerify ? ', and verifies ' + toVerify + ' pending point' + (toVerify === 1 ? '' : 's') + '.' : '.') };
  }
  function renderGate() {
    const g = $('gate');
    if (S.mode !== 'banker' || S.viewing) { if (S.viewing) renderReviewerGate(g); else g.hidden = true; return; }
    g.hidden = false;
    g.innerHTML = '';
    const state = gateState();
    const ack = el('label', {}, [el('input', { type: 'checkbox', id: 'ack' }), document.createTextNode('I have read the attention points. This pre-review is advisory and is not an approval.')]);
    const ackInput = ack.querySelector('input');
    ackInput.checked = !!S.ack;
    ackInput.addEventListener('change', () => { S.ack = ackInput.checked; renderGate(); });
    const row = el('div', { class: 'row' });
    const btn = el('button', { class: 'btn primary', type: 'button', id: 'btn-submit' });
    btn.append(document.createTextNode('Complete submission'), svg('send'));
    btn.disabled = !(state.ok && S.ack) || S.running;
    btn.addEventListener('click', submit);
    row.append(el('span', { class: 'why', text: state.why }), btn);
    g.append(ack, row);
  }
  function currentSubmissionShape() {
    return {
      id: S.submission ? S.submission.id : 'draft', created_at: new Date().toISOString(), status: 'draft', submitter: S.form.submitter || '',
      file: { name: S.doc.name, size: S.doc.size, sha: S.doc.sha, pages: S.doc.pages.length, kind: S.doc.kind },
      form: S.form, lane: S.facts.lane, facts: { lane: S.facts.lane, laneReason: S.facts.laneReason },
      result: { profile: S.result.profile, suppressed: S.result.suppressed, gut_check: S.result.gut_check, brief: S.result.brief, banker_message: S.result.banker_message, meta: S.result.meta },
      findings: S.result.findings, responses: S.responses,
    };
  }
  async function submit() {
    if (!S.result || S.running) return;
    const btn = $('btn-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }
    const id = U.uid('sub');
    const sub = Object.assign(currentSubmissionShape(), { id, status: 'submitted', verdicts: {}, calibration: S.calib ? { recall: S.calib.recall, expectedTotal: S.calib.expectedTotal, fpCount: S.calib.fpCount } : null });
    sub.facts.required = S.facts.required.map((r) => ({ id: r.id, name: r.name, status: r.status, page: r.page, score: Math.round(r.score) }));
    sub.file.assetId = null;
    if (S.caps.assets && S.doc.file && S.doc.kind === 'pdf') {
      try { const up = await S.caps.assets.upload(S.doc.file, { type: 'application/pdf' }); sub.file.assetId = up.id; } catch (e) { console.warn('asset upload failed', e); }
    }
    const to = (S.settings && S.settings.reviewerEmail) || '';
    const msg = Notify.compose(sub);
    sub.notification = { to, subject: msg.subject, body: msg.body, sent_at: new Date().toISOString() };
    const saved = await Store.saveSubmission(sub);
    S.submission = sub;
    renderDone(sub, saved.mode);
    show('done');
    U.toast('Submitted · feedback sent to the reviewer');
  }
  function renderDone(sub, mode) {
    const card = $('done-card');
    card.innerHTML = '';
    const c = Review.counts(sub.findings);
    const ic = el('div', { class: 'done-ic' }); ic.append(svg('checkCircle'));
    card.append(ic, el('h1', { style: 'font-size:20px;margin-bottom:6px', text: 'Submitted for compliance review' }));
    card.append(el('p', { class: 'lede', text: sub.file.name + ' · ' + (sub.lane === 'institutional' ? 'Institutional' : 'Retail') + ' · ' + c.total + ' attention point' + (c.total === 1 ? '' : 's') + (c.verify ? ' (' + c.verify + ' for Finalis review)' : '') + ' · ' + Object.keys(sub.responses).filter((k) => sub.responses[k].status !== 'none').length + ' answered.' }));
    const n = el('div', { class: 'note green', style: 'margin-bottom:16px' });
    n.append(svg('inbox'), el('span', { class: 'grow', text: 'The reviewer' + (sub.notification.to ? ' (' + sub.notification.to + ')' : '') + ' received the pre-review automatically' + (mode === 'shared' ? ' in the shared compliance inbox' : ' in this browser\'s inbox') + ', with your answers and the brief.' + (mode === 'shared' ? '' : ' Open this page in the Claude app with the shared inbox to reach the whole desk.') }));
    card.append(n);
    card.append(el('div', { class: 'label', text: 'Feedback sent to the reviewer' }));
    card.append(el('div', { class: 'mailpreview', text: 'Subject: ' + sub.notification.subject + '\n\n' + sub.notification.body }));
    const row = el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;align-items:center' });
    const mail = el('a', { class: 'btn', href: Notify.mailto(sub.notification.to, sub.notification.subject, sub.notification.body) }); mail.append(svg('mail'), document.createTextNode('Open in your mail client'));
    const copy = el('button', { class: 'btn', type: 'button' }); copy.append(svg('copy'), document.createTextNode('Copy feedback'));
    copy.addEventListener('click', () => U.copyText('Subject: ' + sub.notification.subject + '\n\n' + sub.notification.body));
    row.append(mail, copy);
    if (S.caps.downloads) {
      const dl = el('button', { class: 'btn', type: 'button' }); dl.append(svg('download'), document.createTextNode('Save the report'));
      dl.addEventListener('click', async () => { try { await S.caps.downloads.save({ filename: 'pre-review-' + sub.file.name.replace(/\.[^.]+$/, '') + '.md', data: Notify.reportMarkdown(sub) }); } catch (e) { if (!e || e.code !== 'cancelled') U.toast('Could not save'); } });
      row.append(dl);
    }
    row.append(el('span', { style: 'flex:1' }));
    const again = el('button', { class: 'btn ghost', type: 'button', text: 'New submission' });
    again.addEventListener('click', () => { resetForm(); show('form'); });
    const inbox = el('button', { class: 'btn primary', type: 'button', text: 'Open the compliance inbox' });
    inbox.addEventListener('click', () => setMode('reviewer'));
    row.append(again, inbox);
    card.append(row);
  }

  /* ---------- reviewer inbox ---------- */
  function renderInbox() {
    const list = $('inbox-list');
    list.innerHTML = '';
    $('store-status').textContent = Store.status() === 'shared' ? 'Shared inbox: the whole desk sees it.' : 'Private inbox in this browser. Open the page in the Claude app for the shared inbox.';
    const head = el('div', { class: 'trow h' });
    ['Document', 'Submitted by', 'Lane', 'Points', 'Status', ''].forEach((t) => head.append(el('span', { text: t })));
    list.append(head);
    if (!S.inbox.length) { list.append(el('div', { class: 'empty', text: 'No submissions yet. Submit a pre-reviewed document as a banker to see it here.' })); return; }
    S.inbox.forEach((sub) => {
      const c = Review.counts(sub.findings || []);
      const row = el('div', { class: 'trow' });
      const d = el('div'); d.append(el('div', { class: 't', text: sub.file.name }), el('div', { class: 's', text: U.fmtDate(sub.created_at) + ' · ' + (sub.file.pages || 0) + ' p.' }));
      const by = el('div'); by.append(el('div', { text: sub.submitter || 'unknown', style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }), el('div', { class: 's', text: sub.form && sub.form.bankName ? sub.form.bankName : '' }));
      const lane = el('span', { class: 'tag grey', text: sub.lane === 'institutional' ? 'Institutional' : 'Retail' });
      const pts = el('div', { class: 'pts' });
      pts.append(el('span', { class: 'tag high', text: String(c.high) }), el('span', { class: 'tag medium', text: String(c.medium) }), el('span', { class: 'tag low', text: String(c.low) }));
      const status = el('span', { class: 'tag ' + (sub.status === 'approved' ? 'ok' : sub.status === 'changes' ? 'medium' : 'info'), text: sub.status === 'approved' ? 'Approved' : sub.status === 'changes' ? 'Changes requested' : 'Awaiting review' });
      const acts = el('div', { class: 'acts' });
      const fb = el('button', { class: 'btn sm', type: 'button', text: 'Feedback' });
      fb.addEventListener('click', () => openDialog('Feedback sent to the reviewer', (body) => { body.append(el('div', { class: 'mailpreview', text: 'Subject: ' + sub.notification.subject + '\n\n' + sub.notification.body })); const cp = el('button', { class: 'btn sm', type: 'button', style: 'margin-top:10px' }); cp.append(svg('copy'), document.createTextNode('Copy')); cp.addEventListener('click', () => U.copyText('Subject: ' + sub.notification.subject + '\n\n' + sub.notification.body)); body.append(cp); }));
      const open = el('button', { class: 'btn sm primary', type: 'button', text: 'Open' });
      open.addEventListener('click', () => openSubmission(sub));
      acts.append(fb, open);
      row.append(d, by, lane, pts, status, acts);
      list.append(row);
    });
  }
  async function openSubmission(sub) {
    S.viewing = sub; S.result = null; S.tab = 'disclosures'; S.filter = 'all'; S.active = null; S.expanded = {}; S.ai = {}; S.zoom = 1; S.page = 1;
    show('work');
    $('wh-title').textContent = sub.file.name;
    let pages = null; let pdf = null;
    if (S.doc && S.doc.sha && S.doc.sha === sub.file.sha) { pages = S.doc.pages; pdf = S.doc.pdf; }
    else if (S.stash && S.stash.doc && S.stash.doc.sha === sub.file.sha) { pages = S.stash.doc.pages; pdf = S.stash.doc.pdf; }
    else if (sub.file.assetId) {
      try { const res = await fetch('/_blob/' + sub.file.assetId); if (res.ok) { const bytes = new Uint8Array(await res.arrayBuffer()); const ex = await Extract.pdf(bytes); pages = ex.pages; pdf = ex.pdf; } } catch (e) { console.warn('asset fetch failed', e); }
    }
    if (!pages) {
      pages = [Extract.pageFromText(1, 'The document itself was not stored with this submission (' + sub.file.name + ', ' + sub.file.pages + ' pages). The attention points quote the passages; open the file in the case to see them in place.')];
      S.doc = { kind: 'text', name: sub.file.name, pages, pdf: null, sha: sub.file.sha };
    } else S.doc = { kind: pdf ? 'pdf' : 'text', name: sub.file.name, pages, pdf, sha: sub.file.sha };
    S.form = sub.form;
    S.facts = Engine.analyze(pages, sub.form);
    const findings = JSON.parse(JSON.stringify(sub.findings || []));
    Review.attachBoxes(findings, pages);
    S.result = { profile: sub.result.profile, findings, suppressed: sub.result.suppressed || [], gut_check: sub.result.gut_check, brief: sub.result.brief, banker_message: sub.result.banker_message, meta: sub.result.meta || {} };
    S.steps = []; S.reference = !!(sub.result.meta && sub.result.meta.reference);
    S.calib = Calibration.isReferenceDeck(pages) && !(sub.result.meta && sub.result.meta.deterministicOnly) ? Calibration.score(findings) : null;
    renderViewer(); renderHead(); renderStatus(); renderRail();
  }
  function renderReviewerGate(g) {
    const sub = S.viewing;
    g.hidden = false;
    g.innerHTML = '';
    const verdicts = Object.keys(sub.verdicts || {}).length;
    const pending = (sub.findings || []).filter((f) => !Review.isCertain(f) && !(sub.verdicts && sub.verdicts[f.id])).length;
    g.append(el('div', { class: 'why', text: (pending ? pending + ' point' + (pending === 1 ? '' : 's') + ' awaiting your verification · ' : '') + verdicts + ' verdict' + (verdicts === 1 ? '' : 's') + ' recorded · verdicts calibrate the next pre-reviews' }));
    const row = el('div', { class: 'row', style: 'flex-wrap:wrap' });
    const copy = el('button', { class: 'btn sm', type: 'button' }); copy.append(svg('copy'), document.createTextNode('Comment to banker'));
    copy.addEventListener('click', () => U.copyText(sub.result.banker_message || sub.notification.body));
    const changes = el('button', { class: 'btn sm', type: 'button', text: 'Request changes' });
    changes.addEventListener('click', async () => { sub.status = 'changes'; await Store.updateSubmission(sub.id, { status: 'changes' }); U.toast('Marked: changes requested'); });
    const approve = el('button', { class: 'btn sm success', type: 'button', text: 'Approve' });
    approve.addEventListener('click', async () => { sub.status = 'approved'; await Store.updateSubmission(sub.id, { status: 'approved' }); U.toast('Approved'); });
    row.append(copy, changes, approve);
    g.append(row);
  }

  /* ---------- learning view (reviewer) ---------- */
  async function renderLearning() {
    show('learning');
    const body = $('learning-body');
    body.innerHTML = '';
    body.append(el('div', { class: 'empty', text: 'Loading the learning state…' }));
    const [st, rules, verdicts] = await Promise.all([Learn.stats(), Learn.learnedRules(), Store.listCalibration(400)]);
    body.innerHTML = '';
    const grid = el('div', { class: 'lgrid' });
    const stat = (n, l) => { const c = el('div', { class: 'summary-card', style: 'margin:0' }); c.append(el('div', { class: 'n', style: 'font-size:22px;font-weight:600', text: String(n) }), el('div', { class: 'helper', style: 'margin-top:2px', text: l })); return c; };
    const rulesTracked = Object.keys(st.byRule).length;
    const demoted = Object.values(st.byRule).filter((r) => r.status !== 'active').length;
    grid.append(stat(st.total, 'verdicts recorded'), stat(rulesTracked, 'rules with a track record'), stat(rules.length, 'learned calibration rules'), stat(demoted, 'rules demoted or set aside'));
    body.append(grid);
    // per-rule table
    const table = el('div', { class: 'table', style: 'margin-bottom:14px' });
    const head = el('div', { class: 'lrow h' });
    ['Rule', 'What it checks', 'Correct', 'Rejected', 'Accuracy', 'Status'].forEach((t, i) => head.append(el('span', { class: i === 2 || i === 3 || i === 4 ? 'hide-m' : '', text: t })));
    table.append(head);
    const ruleIds = Object.keys(st.byRule).sort();
    if (!ruleIds.length) table.append(el('div', { class: 'empty', text: 'No verdicts yet. Open a submission and mark each point correct or incorrect.' }));
    ruleIds.forEach((id) => {
      const r = st.byRule[id];
      const row = el('div', { class: 'lrow' });
      const bar = el('div', { class: 'bar' }); bar.append(el('i', { style: 'width:' + Math.round((r.accuracy || 0) * 100) + '%' + (r.status !== 'active' ? ';background:var(--danger)' : '') }));
      const acc = el('div', { class: 'hide-m' }); acc.append(el('div', { style: 'font-size:12px;margin-bottom:3px', text: r.accuracy === null ? '–' : Math.round(r.accuracy * 100) + '% · conf. ' + Math.round(r.confidence * 100) + '%' }), bar);
      row.append(el('span', { class: 'code', text: id }), el('span', { text: RULES.CATEGORY_NAMES[id] || id }), el('span', { class: 'hide-m', text: String(r.correct) }), el('span', { class: 'hide-m', text: String(r.incorrect) }), acc, el('span', { class: 'tag ' + (r.status === 'active' ? 'ok' : r.status === 'demoted' ? 'medium' : 'high'), text: r.status === 'active' ? 'Active' : r.status === 'demoted' ? 'Demoted to low' : 'Set aside' }));
      table.append(row);
    });
    body.append(el('div', { class: 'label', text: 'Track record per rule (demoted at 60% rejected over 5 verdicts, set aside at 80% over 8; Tier A never)' }), table);
    // learned rules
    body.append(el('div', { class: 'label', text: 'Learned calibration rules (injected into every pre-review)' }));
    const rl = el('div', { class: 'table', style: 'margin-bottom:10px' });
    if (!rules.length) rl.append(el('div', { class: 'empty', text: 'None yet. Rules are distilled from three or more rejections of the same rule that carry a reason, or written by hand below.' }));
    rules.forEach((r) => {
      const item = el('div', { class: 'rule-item' });
      const g = el('div', { class: 'grow' });
      g.append(el('div', { text: r.text }), el('div', { class: 'm', text: (r.rule ? r.rule + ' · ' : '') + (r.source === 'synthesized' ? 'distilled from ' + r.evidence + ' rejection' + (r.evidence === 1 ? '' : 's') : 'written by the desk') + ' · ' + U.fmtDate(r.at) }));
      const del = el('button', { class: 'btn ghost icon', type: 'button', 'aria-label': 'Remove rule' }); del.append(svg('x'));
      del.addEventListener('click', async () => { await Learn.removeRule(r.id); renderLearning(); });
      item.append(g, del);
      rl.append(item);
    });
    body.append(rl);
    const tools = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:18px' });
    const distill = el('button', { class: 'btn sm primary', type: 'button' }); distill.append(svg('spark'), document.createTextNode('Distill rules from rejections'));
    distill.disabled = !S.caps.sample;
    distill.addEventListener('click', async () => { distill.disabled = true; distill.textContent = 'Distilling…'; try { const r = await Learn.synthesize(S.caps.sample); U.toast(r.changed ? r.changed + ' rule' + (r.changed === 1 ? '' : 's') + ' distilled' : 'Nothing new to distill (needs 3+ rejections with a reason per rule)'); } catch (e) { U.toast('Claude is not available in this view'); } renderLearning(); });
    const manual = el('input', { type: 'text', id: 'manual-rule', placeholder: 'Write a rule by hand, e.g. Do not raise B6 for logos of a fund\'s own portfolio companies', style: 'flex:1;min-width:260px;padding:7px 10px' });
    const add = el('button', { class: 'btn sm', type: 'button', text: 'Add rule' });
    add.addEventListener('click', async () => { if (!manual.value.trim()) return; await Learn.addManualRule(manual.value.trim(), (manual.value.match(/\b([ABC]\d{1,2}[a-z]?)\b/) || [])[1] || ''); renderLearning(); });
    tools.append(distill, manual, add);
    body.append(tools);
    // export / import / replay
    body.append(el('div', { class: 'label', text: 'Portability and regression' }));
    const io = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px' });
    const exp = el('button', { class: 'btn sm', type: 'button' }); exp.append(svg('download'), document.createTextNode('Export learning state (.json)'));
    exp.addEventListener('click', async () => { const state = await Learn.exportState(); const text = JSON.stringify(state, null, 2); if (S.caps.downloads) { try { await S.caps.downloads.save({ filename: 'mmat-learning-' + new Date().toISOString().slice(0, 10) + '.json', data: text }); return; } catch (e) { if (e && e.code === 'cancelled') return; } } U.copyText(text); });
    const impInput = el('input', { type: 'file', accept: 'application/json,.json', hidden: '' });
    const imp = el('button', { class: 'btn sm', type: 'button', text: 'Import learning state' });
    imp.addEventListener('click', () => impInput.click());
    impInput.addEventListener('change', async () => { const f = impInput.files && impInput.files[0]; if (!f) return; try { const obj = JSON.parse(await f.text()); const r = await Learn.importState(obj); U.toast('Imported ' + r.added + ' verdicts · ' + r.rules + ' rules'); } catch (e) { U.toast('Not a learning export'); } renderLearning(); });
    const replay = el('button', { class: 'btn sm', type: 'button', text: 'Replay the calibration deck with the current learning' });
    replay.addEventListener('click', () => replayCalibration(replay));
    io.append(exp, imp, impInput, replay);
    body.append(io);
    body.append(el('div', { id: 'replay-out' }));
    // recent verdicts
    body.append(el('div', { class: 'label', style: 'margin-top:18px', text: 'Recent verdicts (' + verdicts.length + ')' }));
    const vt = el('div', { class: 'table' });
    if (!verdicts.length) vt.append(el('div', { class: 'empty', text: 'No verdicts yet.' }));
    verdicts.slice(0, 40).forEach((v) => {
      const item = el('div', { class: 'rule-item' });
      const g = el('div', { class: 'grow' });
      g.append(el('div', { html: '<span class="code">' + U.esc(v.rule || '?') + '</span> <span class="tag ' + (v.verdict === 'correct' ? 'ok' : 'high') + '">' + (v.verdict === 'correct' ? 'correct' : 'incorrect') + '</span> <i>' + U.esc((v.quote || '').slice(0, 140)) + '</i>' }), el('div', { class: 'm', text: [v.lane, v.docType, v.page ? 'p. ' + v.page : '', v.reason ? '— ' + v.reason : '', U.fmtDate(v.at)].filter(Boolean).join(' · ') }));
      item.append(g);
      vt.append(item);
    });
    body.append(vt);
  }
  async function replayCalibration(btn) {
    const out = $('replay-out');
    out.innerHTML = '';
    if (typeof SAMPLE_DECK_B64 === 'undefined') { out.append(el('div', { class: 'note amber', text: 'The calibration deck is not embedded in this build.' })); return; }
    btn.disabled = true;
    const status = el('div', { class: 'note', style: 'margin-bottom:10px' });
    const txt = el('span', { class: 'grow', text: 'Reading the deck…' });
    status.append(el('span', { class: 'spin' }), txt);
    out.append(status);
    try {
      const bin = atob(SAMPLE_DECK_B64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
      const ex = await Extract.pdf(bytes);
      const form = { docType: 'deal-deck', distribution: ['Email'], involvement: 'banker', audience: 'institutional', bankName: 'Northbridge Advisors', depth: 'default', images: false };
      const facts = Engine.analyze(ex.pages, form);
      let result;
      if (S.caps.sample) {
        const learning = await Learn.memoryFor(facts, ex.pages);
        result = await Review.run({ doc: { kind: 'pdf', name: 'calibration', pages: ex.pages, pdf: ex.pdf }, pages: ex.pages, form, facts, caps: S.caps, memory: learning.memory, stats: learning.stats, noCache: true, onStep: (k, p) => { txt.textContent = (p.detail ? k + ' · ' + p.detail : k); } });
      } else result = Fixture.build(facts, form, ex.pages);
      const c = Calibration.score(result.findings);
      status.remove();
      out.append(scoreCard(c));
      out.append(el('div', { class: 'helper', text: (S.caps.sample ? 'Live run, balanced model, learning state applied.' : 'Claude is not available in this view: the reference pre-review was scored instead.') }));
    } catch (e) { status.remove(); out.append(el('div', { class: 'note red', text: 'Replay failed: ' + (e && (e.message || e.code) || 'error') })); }
    btn.disabled = false;
  }

  /* ---------- dialogs ---------- */
  function openDialog(title, fill) {
    const root = $('dialog-root');
    root.innerHTML = '';
    const bg = el('div', { class: 'overlay-bg', role: 'dialog', 'aria-modal': 'true' });
    const d = el('div', { class: 'dialog' });
    const h = el('div', { class: 'dh' });
    const x = el('button', { class: 'btn ghost icon', type: 'button', 'aria-label': 'Close' }); x.append(svg('x'));
    x.addEventListener('click', () => { root.innerHTML = ''; });
    h.append(el('h2', { text: title }), x);
    const body = el('div', { class: 'db' });
    fill(body);
    d.append(h, body);
    bg.append(d);
    bg.addEventListener('click', (e) => { if (e.target === bg) root.innerHTML = ''; });
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { root.innerHTML = ''; document.removeEventListener('keydown', esc); } });
    root.append(bg);
  }
  function openRulebook() {
    const form = S.form && S.form.docType ? S.form : Object.assign(readLanding(), { audience: '' });
    const lane = S.facts ? S.facts.lane : Engine.resolveLane(form).lane;
    openDialog('Marketing Materials templates and rulebook', (body) => {
      body.append(el('p', { text: 'The disclosure templates below are quoted from the Finalis Disclaimer SOP and the Language Guide; the pre-review applies them with FINRA Rule 2210 and the interim Institutional MMAT Review Framework; the calibration rules encode the reviewer\'s verdicts on the finding sheet.' }));
      body.append(el('h3', { text: 'Required blocks · ' + (Prompts.DOC_LABELS[form.docType] || 'document') + ' · ' + lane + ' lane' }));
      RULES.requiredBlocks(form.docType, lane, form.involvement).forEach((r) => { const rb = el('div', { class: 'rb' }); rb.append(el('b', { text: r.id + ' · ' + r.name + ' (' + r.citation + ')' }), document.createTextNode(r.text || '')); body.append(rb); });
      body.append(el('h3', { text: 'Disclosures triggered by the content' }));
      [['B1 Forecasts and projections', RULES.SOP.forecast], ['B2 Projection charts and illustrations', RULES.SOP.illustration], ['B3 Past or present performance (bold, standalone)', RULES.SOP.past_perf], ['B4 Preferred returns', RULES.SOP.pref], ['B5 Distributions', RULES.SOP.distributions], ['B6 Corporate logos', RULES.SOP.logos], ['B7 Testimonials', RULES.SOP.testimonial], ['B8 Awards and rankings', 'Disclose the awarding organization and its role in the selection, the criteria, the period covered, and whether fees were paid.'], ['B9 Real-estate private offerings', RULES.SOP.real_estate], ['B11 LinkedIn calls to action', RULES.SOP.linkedin_cta], ['A7 Statistics, charts and graphs', RULES.SOP.source]].forEach(([t, x]) => { const rb = el('div', { class: 'rb' }); rb.append(el('b', { text: t }), document.createTextNode(x)); body.append(rb); });
      body.append(el('h3', { text: 'Language and content' }));
      Object.keys(Ask.GUIDE).forEach((k) => body.append(el('div', { class: 'rb', html: '<b>' + U.esc(k + ' · ' + (LABELS[k] || k)) + '</b>' + U.esc(Ask.GUIDE[k]) })));
      body.append(el('h3', { text: 'Calibration rules (from the reviewer\'s verdicts)' }));
      const cal = (RULES.RULEBOOK.split('## CALIBRATION RULES')[1] || '').split('\n').filter((l) => /^\d+\. /.test(l));
      const ol = el('ol');
      cal.forEach((s) => ol.append(el('li', { text: s.replace(/^\d+\. /, '') })));
      body.append(ol);
    });
  }

  /* ---------- wiring ---------- */
  function bind() {
    bindForm();
    $('mode-banker').addEventListener('click', () => setMode('banker'));
    $('mode-reviewer').addEventListener('click', () => setMode('reviewer'));
    document.querySelectorAll('.panel-tabs [role=tab]').forEach((t) => t.addEventListener('click', () => { S.tab = t.dataset.tab; S.filter = 'all'; renderRail(); $('railbody').scrollTop = 0; }));
    $('btn-back').addEventListener('click', () => { if (S.running && S.abort) S.abort.abort(); if (S.viewing) { S.viewing = null; renderInbox(); show('inbox'); } else { if (S.phase === 'review' && !S.result) S.phase = 'setup'; show('form'); updateSubmit(); } });
    $('rail-toggle').addEventListener('click', () => toggleRail());
    $('pg-prev').addEventListener('click', () => scrollToPage(Math.max(1, S.page - 1)));
    $('pg-next').addEventListener('click', () => scrollToPage(Math.min(S.doc ? S.doc.pages.length : 1, S.page + 1)));
    $('pg-input').addEventListener('change', () => { const n = U.clamp(parseInt($('pg-input').value, 10) || 1, 1, S.doc ? S.doc.pages.length : 1); scrollToPage(n); });
    $('zoom-in').addEventListener('click', () => { S.zoom = Math.min(2, Math.round((S.zoom + 0.15) * 100) / 100); applyZoom(); rerenderVisible(); });
    $('zoom-out').addEventListener('click', () => { S.zoom = Math.max(0.5, Math.round((S.zoom - 0.15) * 100) / 100); applyZoom(); rerenderVisible(); });
    $('pt-prev').addEventListener('click', () => stepFinding(-1));
    $('pt-next').addEventListener('click', () => stepFinding(1));
    document.addEventListener('keydown', (e) => {
      if (S.view !== 'work') return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key === 'j' || e.key === 'ArrowDown' && e.altKey) { e.preventDefault(); stepFinding(1); }
      else if (e.key === 'k' || e.key === 'ArrowUp' && e.altKey) { e.preventDefault(); stepFinding(-1); }
      else if (e.key === 'n') { e.preventDefault(); scrollToPage(Math.min(S.doc ? S.doc.pages.length : 1, S.page + 1)); }
      else if (e.key === 'p') { e.preventDefault(); scrollToPage(Math.max(1, S.page - 1)); }
    });
    $('btn-learning').addEventListener('click', () => renderLearning());
    $('btn-learning-back').addEventListener('click', () => { renderInbox(); show('inbox'); });
    $('reviewer-email').addEventListener('change', async () => { S.settings = await Store.setSettings({ reviewerEmail: $('reviewer-email').value.trim() }); });
    window.addEventListener('resize', () => { if (!isMobile()) { $('rail').style.display = ''; $('viewer').style.display = ''; } if (S.view === 'work') { applyZoom(); rerenderVisible(); } });
  }
  function renderBrand() {
    const logo = (typeof window !== 'undefined' && window.FINALIS_LOGO) || '';
    ['brand-logo', 'brand-logo-2'].forEach((id) => {
      const slot = $(id);
      if (!slot) return;
      slot.innerHTML = '';
      if (logo) slot.append(el('img', { src: logo, alt: 'Finalis' }));
      else slot.append(el('span', { class: 'wm', text: 'finalis' }));
    });
  }
  async function start(caps) {
    renderBrand();
    S.caps = caps;
    await Store.init(caps);
    S.settings = await Store.getSettings();
    if (S.settings.reviewerEmail) $('reviewer-email').value = S.settings.reviewerEmail;
    Store.watchSubmissions((list) => {
      S.inbox = list.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      const n = S.inbox.filter((s) => s.status === 'submitted').length;
      $('inbox-count').hidden = !n; $('inbox-count').textContent = String(n);
      if (S.view === 'inbox') renderInbox();
    });
    if (!caps.sample) $('form-foot').textContent = 'Claude is not available in this view: the pre-review will check the required blocks only' + (typeof SAMPLE_DECK_B64 !== 'undefined' ? ', and the calibration deck shows the reference pre-review.' : '.');
  }
  return { bind, start, S, openRulebook, readLanding, readSetup };
})();
