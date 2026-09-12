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
    edits: [], editing: null, version: 1, resolved: [], history: [], correctedBytes: null, correctedDirty: false, user: null,
    resubmitOf: null, sinceRound: null, seen: {}, secondOpinion: null,
  };
  const DOC_CACHE = new Map();
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
    pen: '<svg class="i s" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
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
  const STEP_LABELS = { extract: 'Read the file', blocks: 'Required blocks', transcribe: 'Transcribe the image', profile: 'Read the whole document', findings: 'Review under the rulebook', verify: 'Second pass: senior check', assemble: 'Assemble the pre-review', claims: 'Check the figures' };
  const RESP = { fixed: 'Fixed in the new version', covered: 'Already covered', disagree: 'Disagree' };
  const isMobile = () => window.matchMedia('(max-width: 980px)').matches;
  function svg(name) { const t = document.createElement('template'); t.innerHTML = ICON[name]; return t.content.firstChild; }
  function tierOfTab(f) { return f.tier === 'C' ? 'language' : 'disclosures'; }

  /* ---------- views ---------- */
  function show(view) {
    S.view = view;
    ['login', 'form', 'work', 'done', 'inbox', 'learning', 'mine', 'metrics'].forEach((v) => { $('view-' + v).hidden = v !== view; });
    document.body.setAttribute('data-view', view);
    renderChrome();
    window.scrollTo(0, 0);
  }
  const STASH_KEYS = ['doc', 'form', 'facts', 'result', 'responses', 'steps', 'calib', 'reference', 'submission', 'ack', 'active', 'tab', 'filter', 'expanded', 'ai', 'phase', 'prefill', 'edits', 'editing', 'version', 'resolved', 'history', 'correctedBytes', 'correctedDirty', 'resubmitOf', 'sinceRound'];
  function setMode(mode) {
    S.focus = null; if ($('chatdock')) { $('chatdock').hidden = true; $('btn-chat').setAttribute('aria-pressed', 'false'); }
    if (mode === S.mode) { if (mode === 'reviewer' && S.viewing) { S.viewing = null; renderInbox(); show('inbox'); } return; }
    if (mode === 'reviewer') { if (S.running && S.abort) S.abort.abort(); S.stash = {}; STASH_KEYS.forEach((k) => { S.stash[k] = S[k]; }); }
    S.mode = mode;
    renderChrome();
    if (mode === 'reviewer') { S.viewing = null; renderInbox(); show('inbox'); return; }
    S.viewing = null;
    if (S.stash) { STASH_KEYS.forEach((k) => { S[k] = S.stash[k]; }); S.stash = null; }
    if (S.submission) { show('done'); return; }
    if (S.result && S.doc) { show('work'); renderWorkspace(); } else show('form');
  }
  function renderWorkspace() { renderViewer(); renderHead(); renderStatus(); renderRail(); }
  /* The banker platform and the reviewer platform are two applications that share one page here: the app bar,
     the accent colour, the crumb and the tab labels change with the side you are on. */
  function renderChrome() {
    const desk = S.mode === 'reviewer';
    document.body.setAttribute('data-platform', desk ? 'desk' : 'banker');
    $('mode-banker').setAttribute('aria-pressed', String(!desk));
    $('mode-reviewer').setAttribute('aria-pressed', String(desk));
    const u = S.user || {};
    $('avatar').textContent = initials(u.name || (desk ? 'Compliance Officer' : 'Jane Doe'));
    $('avatar').title = (u.name ? u.name + ' · ' : '') + (desk ? 'Reviewer platform' : 'Banker platform');
    $('am-name').textContent = u.name || (desk ? 'Finalis reviewer' : 'Banker'); $('am-email').textContent = u.email || ''; $('am-role').textContent = desk ? 'Reviewer platform' : 'Banker platform' + (u.firm ? ' · ' + u.firm : '');
    $('am-switch').textContent = desk ? 'Open the banker platform (demo)' : 'Open the reviewer platform (demo)';
    $('am-switch').hidden = lockedPlatforms();
    const seg = document.querySelector('.appbar .seg'); if (seg) seg.hidden = lockedPlatforms();
    $('product-name').textContent = desk ? 'Reviewer platform' : 'Banker platform';
    $('crumb-root').textContent = desk ? (S.view === 'metrics' ? 'Metrics and audit' : S.view === 'learning' ? 'Learning' : 'Inbox') : 'Marketing materials';
    const ai = $('crumb-ai');
    ai.querySelector('b').textContent = desk ? 'Submission' : (S.view === 'mine' ? 'My submissions' : 'AI Prescreen');
    ai.hidden = !((S.view === 'work' || S.view === 'done' || S.view === 'mine') && (desk ? !!S.viewing : true));
    $('tab-summary').textContent = desk ? 'Brief' : 'Summary';
    // the banker's own submissions and the decisions not yet seen
    const mine = $('btn-mine');
    if (mine) { mine.hidden = desk || !S.user || S.view === 'login'; const n = unseenDecisions().length; $('mine-count').hidden = !n; $('mine-count').textContent = String(n); }
  }

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
      renderFileChip();
      setStatus('');
      $('pastebox').hidden = true;
    } catch (e) {
      console.error(e);
      S.doc = null;
      setStatus('Could not read ' + name + ': ' + (e && e.message ? e.message : 'unknown error'));
    }
    updateSubmit();
  }
  function renderFileChip() {
    const d = S.doc; if (!d) return;
    $('filechip').hidden = false;
    $('filechip-name').textContent = d.name;
    const textPages = d.pages.filter((p) => p.textLayer).length;
    $('filechip-meta').textContent = U.fmtBytes(d.size) + ' · ' + d.pages.length + (d.kind === 'pdf' ? ' pages' : d.kind === 'docx' ? ' sections' : ' image') + (d.kind === 'pdf' && textPages < d.pages.length ? ' · ' + (d.pages.length - textPages) + ' without text layer' : '');
  }
  function removeFile() {
    if (S.doc && S.doc.imageUrl) URL.revokeObjectURL(S.doc.imageUrl);
    S.doc = null; $('filechip').hidden = true; $('file-input').value = '';
    setStatus('');
    updateSubmit();
  }
  function resetForm() {
    if (S.running && S.abort) S.abort.abort();
    runToken += 1; S.running = false; S.abort = null; // a run that was still going must not write into the fresh state
    removeFile(); $('paste-text').value = ''; $('pastebox').hidden = true; $('notes').value = ''; $('notes-count').textContent = '0';
    $('involved').value = ''; $('doc-type').value = 'deal-deck'; $('doc-type-hint').textContent = DOC_HINTS['deal-deck'];
    document.querySelectorAll('#dist-menu input').forEach((i) => { i.checked = false; });
    renderDistLabel(); toggleDistMenu(false);
    S.result = null; S.facts = null; S.responses = {}; S.submission = null; S.ack = false; S.expanded = {}; S.ai = {}; S.phase = 'landing'; S.prefill = {}; S.form = {}; S.edits = []; S.editing = null; S.version = 1; S.resolved = []; S.history = []; S.correctedBytes = null;
    S.resubmitOf = null; S.sinceRound = null; S.secondOpinion = null;
    renderRoundChip();
    updateSubmit();
  }
  /* the form says when the next upload goes out as the next round of an earlier submission */
  function renderRoundChip() {
    const chip = $('round-chip'); if (!chip) return;
    const p = S.resubmitOf;
    chip.hidden = !p;
    if (!p) return;
    chip.innerHTML = '';
    chip.append(el('span', { class: 'grow', text: 'Round ' + ((p.round || 1) + 1) + ' of ' + (p.file && p.file.name ? p.file.name : 'the previous submission') + ': the file you upload here is sent as the next round, with the reviewer\'s message.' }));
    const cancel = el('button', { class: 'btn xs', type: 'button', text: 'Not a resubmission' });
    cancel.addEventListener('click', () => { S.resubmitOf = null; S.sinceRound = null; renderRoundChip(); U.toast('This will be a new submission'); });
    chip.append(cancel);
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
    if (running) ic.append(el('span', { class: 'spin' }));
    else if (S.result && !S.result.meta.error) { const ok = el('span', { class: 'ok' }); ok.append(svg('checkCircle')); ic.append(ok); }
    else if (failed) { const w = el('span', { style: 'color:var(--danger);display:inline-flex' }); w.append(svg('alert')); ic.append(w); }
    else ic.append(el('span', { class: 'spin' }));
    $('wh-status-text').textContent = running ? running.label + (running.detail ? ' · ' + running.detail : '') : S.result ? (S.result.meta.error ? 'Required blocks only' : (S.reference ? 'Reference pre-review' : 'Pre-review complete' + modelSuffix(S.result.meta))) : failed ? 'Stopped: ' + failed.label : 'Preparing';
  }
  function shortModel(m) { return String(m || '').replace(/^cli:/, '').replace(/^claude-/, '').replace(/-\d{8}$/, ''); }
  function modelSuffix(meta) {
    const calls = (meta && meta.calls) || [];
    const models = Array.from(new Set(calls.map((c) => c.model).filter(Boolean)));
    if (!models.length) return '';
    return ' · ' + models.map(shortModel).join(', ') + (calls.some((c) => c.fallback) ? ' (fallback)' : '');
  }
  function modelWarning() {
    const calls = (S.result && S.result.meta && S.result.meta.calls) || [];
    const fb = calls.filter((c) => c.fallback);
    if (!fb.length) return null;
    const n = el('div', { class: 'note amber', style: 'margin-bottom:10px' });
    n.append(svg('alert'), el('span', { text: 'This account could not use ' + Array.from(new Set(fb.map((c) => c.requested).filter(Boolean))).join(', ') + ', so ' + fb.map((c) => c.pass).join(', ') + ' ran on the account\'s default model (' + Array.from(new Set(fb.map((c) => shortModel(c.model)))).join(', ') + '). The pre-review was calibrated on claude-opus-5 and claude-sonnet-5: results differ. Set MODEL_COMPLEX and MODEL_DEFAULT in .env to models this account can use.' }));
    return n;
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
    { const rn = roundNote(); if (rn) w.append(rn); }
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
    [['complex', 'Thorough', 'Most capable model plus a second pass; 2 to 5 minutes on a long deck. Only a thorough run lets points be asserted to you as certain.', 'depth-thorough'], ['default', 'Fast', 'About a minute. Every model point is then left for the Finalis reviewer to verify.', 'depth-fast']].forEach(([v, t, d, id]) => {
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
    w.append(el('div', { class: 'helper', style: 'text-align:center;margin-top:8px', text: 'Nothing reaches the reviewer until the pre-review is complete.' }));
    if (S.health && S.health.backend) w.append(el('div', { class: 'helper', style: 'text-align:center;margin-top:4px', text: (S.health.backend === 'mock' ? 'No model: the reference pre-review is replayed' : 'Models: ' + shortModel(S.health.models.complex) + ' for the findings, ' + shortModel(S.health.models.default) + ' for the map and the second pass' + (S.health.backend === 'cli' ? ' · your Claude Code login' : ' · Anthropic API')) }));
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
    S.phase = 'review'; S.edits = []; S.editing = null; S.version = 1; S.resolved = []; S.history = []; S.correctedBytes = null; S.correctedDirty = false; S.chat = []; S.focus = null; S.sinceRound = null; S.secondOpinion = null;
    renderRail();
    setStep('extract', { status: 'done', detail: S.doc.pages.length + (S.doc.kind === 'pdf' ? ' pages read' : S.doc.kind === 'image' ? ' image' : ' sections') });
    setStep('blocks', { status: 'run' });
    S.facts = Engine.analyze(S.doc.pages, form);
    const missing = S.facts.required.filter((r) => r.status === 'missing' || r.status === 'forbidden_present' || r.status === 'illegible').length;
    setStep('blocks', { status: 'done', detail: 'lane ' + S.facts.lane + ' · ' + missing + ' required block' + (missing === 1 ? '' : 's') + ' to fix' });
    renderHead();
    await runModel(false);
  }
  let runToken = 0;
  async function runModel(noCache) {
    const token = ++runToken; // a run that was abandoned (platform switch, new document) must not write into the state that replaced it
    if (!S.caps.sample) {
      if (Calibration.isReferenceDeck(S.doc.pages)) {
        S.result = Fixture.build(S.facts, S.form, S.doc.pages); S.reference = true;
        setStep('profile', { status: 'done', detail: 'Reference pre-review loaded (Claude is not available in this view)' });
      } else {
        S.result = Review.deterministicOnly(S.facts, S.form, S.doc.pages);
        setStep('profile', { status: 'fail', detail: 'Claude is not available in this view: required blocks only' });
      }
      attachClaims({ claims: Deal.scan(S.doc.pages), source: 'scan' });
      finishRun();
      return;
    }
    S.running = true;
    S.abort = new AbortController();
    renderRail();
    try {
      const learning = await Learn.memoryFor(S.facts, S.doc.pages, (S.settings && S.settings.reviewerEmail) || '');
      S.learningUsed = { rules: learning.memory.rules.length, precedents: learning.memory.verdicts.length, reviewerRules: learning.reviewerRules.length, reviewer: learning.reviewer, verdicts: learning.entries.length };
      const result = await Review.run({
        doc: S.doc, pages: S.doc.pages, form: S.form, facts: S.facts, caps: S.caps, memory: learning.memory, stats: learning.stats, learning, noCache,
        signal: S.abort.signal, onStep: setStep,
        onPagesReplaced: (pages, facts) => { S.doc.pages = pages; S.facts = facts; renderViewer(); },
      });
      if (token !== runToken || S.mode !== 'banker') return;
      S.result = result;
      result.meta.learning = S.learningUsed;
      setStep('assemble', { status: 'done', detail: result.findings.length + ' attention points' });
      // the figures the document commits to: a failure or a stop here never costs the finished pre-review
      setStep('claims', { status: 'run', detail: 'Reading the figures the document commits to' });
      const steps = S.steps; const pages = S.doc.pages;
      let ex;
      try { ex = await Deal.extract(S.caps.sample, pages, { signal: S.abort.signal, cache: !noCache, maxBytes: Math.min(65536, (S.caps.limits && S.caps.limits.maxPromptBytes) || 65536) }); }
      catch (e) { ex = { claims: Deal.scan(pages), source: 'scan', error: e && e.code ? e.code : 'error' }; }
      if (token !== runToken || S.mode !== 'banker') {
        // the banker switched platform meanwhile: the finished pre-review is stashed with the figures the scan read, and the step is closed on the stashed steps
        result.claims = ex.claims; result.claimsSource = 'scan';
        const st = steps.find((x) => x.key === 'claims'); if (st) { st.status = 'done'; st.detail = ex.claims.length + ' figures (text scan)'; }
        return;
      }
      attachClaims(ex);
    } catch (e) {
      if (token !== runToken || S.mode !== 'banker') return;
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
      attachClaims({ claims: Deal.scan(S.doc.pages), source: 'scan' });
    } finally { if (token === runToken) { S.running = false; S.abort = null; } }
    if (token !== runToken || S.mode !== 'banker') return;
    finishRun();
  }
  function finishRun() {
    if (Calibration.isReferenceDeck(S.doc.pages) && S.result && !S.result.meta.deterministicOnly) S.calib = Calibration.score(S.result.findings);
    if (S.result) {
      const c = Review.counts(S.result.findings);
      if (S.tab !== 'summary') S.tab = c.A + c.B ? 'disclosures' : 'language';
      S.sinceRound = S.resubmitOf ? carriedSince(S.resubmitOf, S.result.findings) : null;
    }
    renderHead(); renderStatus(); drawMarks(); renderRail();
  }
  /* the deal file: the figures found, checked against each other and against the other documents of the same deal */
  function attachClaims(ex) {
    if (!S.result) return;
    const claims = (ex && ex.claims) || [];
    S.result.claims = claims; S.result.claimsSource = ex && ex.source === 'model+scan' ? 'model+scan' : 'scan';
    S.result.consistency = Deal.consistency(dealShape(), claims, dealPool());
    const n = S.result.consistency.contradictions.length;
    setStep('claims', { status: 'done', detail: claims.length + ' figure' + (claims.length === 1 ? '' : 's') + ' found' + (n ? ', ' + n + ' that do not agree' : ', consistent') + (ex && ex.source === 'scan' && S.caps.sample ? ' (text scan only' + (ex.error ? ', ' + ex.error : '') + ')' : '') });
  }
  /* the documents a submission is compared with: the banker's own on the banker platform, the whole desk on the reviewer's */
  function dealPool() { return S.mode === 'reviewer' ? S.inbox : mineList(); }
  function dealShape() {
    return { id: 'draft', form: S.form, lane: S.facts ? S.facts.lane : '', file: { name: S.doc ? S.doc.name : '', sha: S.doc ? S.doc.sha : '' }, result: { profile: S.result ? S.result.profile : {} }, findings: S.result ? S.result.findings : [], thread: S.resubmitOf ? (S.resubmitOf.thread || S.resubmitOf.id) : null, previous: S.resubmitOf ? { id: S.resubmitOf.id } : null };
  }
  /* round n of a submission: which of the points that stood on the previous round are still here, which are gone */
  function samePassage(a, b) {
    const qa = U.normalize(a.quote || ''); const qb = U.normalize(b.quote || '');
    if (!qa || !qb) return !qa && !qb && (a.page || null) === (b.page || null);
    if (qa === qb) return true;
    const short = qa.length < qb.length ? qa : qb; const long = qa.length < qb.length ? qb : qa;
    return (short.length >= 20 && long.includes(short)) || U.ratio(qa.slice(0, 200), qb.slice(0, 200)) >= 80;
  }
  function carriedSince(prev, findings) {
    const verdicts = prev.verdicts || {};
    const stood = (prev.findings || []).filter((f) => !(verdicts[f.id] && verdicts[f.id].verdict === 'incorrect') && (Review.isCertain(f) || (verdicts[f.id] && verdicts[f.id].verdict === 'correct')));
    const open = []; const resolved = []; const taken = new Set();
    stood.forEach((pf) => {
      const hit = findings.find((f) => !taken.has(f.id) && f.rule === pf.rule && samePassage(f, pf)); // never by id: ids are positional and change between runs
      if (hit) { taken.add(hit.id); hit.carried = { round: prev.round || 1, id: pf.id }; open.push({ id: hit.id, rule: pf.rule, title: pf.title, page: hit.page || pf.page || null }); }
      else resolved.push({ id: pf.id, rule: pf.rule, title: pf.title, page: pf.page || null });
    });
    return { round: prev.round || 1, of: stood.length, open, resolved };
  }

  /* ---------- toolbar ---------- */
  function renderHead() {
    const f = S.facts;
    const meta = $('wh-meta');
    meta.innerHTML = '';
    if (f) {
      meta.append(el('span', { class: 'tag grey', text: f.lane === 'institutional' ? 'Institutional' : 'Retail' }));
      meta.append(el('span', { class: 'tag grey', text: S.doc.pages.length + (S.doc.kind === 'pdf' ? ' pages' : S.doc.kind === 'image' ? ' image' : ' sections') }));
      if (S.version > 1) meta.append(el('span', { class: 'tag blue', text: 'v' + S.version + ' corrected' }));
      const rp = readinessPill(); if (rp) meta.append(rp);
    }
    $('pg-of').textContent = '/ ' + S.doc.pages.length;
    $('pg-input').value = String(S.page);
    $('zoom-pct').textContent = Math.round(S.zoom * 100) + '%';
    const c = S.result ? Review.counts(currentFindings()) : null;
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
  /* Everything the pre-review produced (the reviewer platform sees all of it). */
  function allFindings() { return S.result ? S.result.findings : Review.tierAFindings(S.facts || { required: [] }, S.form); }
  /* What the current platform shows: the reviewer sees everything; the banker only the asserted points.
     Pending points exist for the reviewer to verify, they are never put in front of the banker. */
  function currentFindings() { const all = allFindings(); return S.viewing ? all : all.filter((f) => Review.isCertain(f)); }
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
    drawEdits();
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
    if (S.tab === 'summary') renderSummary(body, S.viewing ? findings : allFindings());
    else renderList(body, findings.filter((f) => tierOfTab(f) === S.tab));
    renderGate();
    body.scrollTop = keep;
  }
  /* the submission as the PDF sees it: on the reviewer platform the open submission carries the desk-wide deal file */
  function pdfShape(sub) { return sub && sub === S.viewing && S.result && S.result.consistency ? Object.assign({}, sub, { consistency: S.result.consistency }) : sub; }
  async function savePdf(sub, kind) {
    if (!S.caps.downloads) { U.toast('Downloads are not available in this view'); return; }
    sub = pdfShape(sub);
    try { await S.caps.downloads.save({ filename: Notify.reportFilename(sub, kind), data: Notify.reportPdf(sub, kind) }); U.toast(kind === 'desk' ? 'Brief saved as PDF' : 'Summary saved as PDF'); }
    catch (e) { if (!e || (e.code !== 'cancelled' && e.code !== 'declined')) U.toast('Could not save the PDF' + (e && e.message ? ': ' + e.message : '')); }
  }
  function renderSub(findings) {
    const sub = $('panel-sub');
    sub.innerHTML = '';
    if (S.phase === 'setup' && S.mode === 'banker' && !S.viewing) { sub.append(el('span', { text: 'Finalis AI Prescreen · setup' }), el('span', { class: 'grow' })); return; }
    const list = S.tab === 'summary' ? findings : findings.filter((f) => tierOfTab(f) === S.tab);
    const need = findings.filter((f) => f.severity === 'high' && Review.isCertain(f) && (!S.responses[f.id] || S.responses[f.id].status === 'none')).length;
    const toVerify = allFindings().filter((f) => !Review.isCertain(f)).length;
    sub.append(el('span', { text: S.running ? 'Reviewing…' : (S.tab === 'summary' ? findings.length + ' attention point' + (findings.length === 1 ? '' : 's') : list.length + ' suggestion' + (list.length === 1 ? '' : 's')) }));
    if (need && S.mode === 'banker' && !S.viewing && S.result) sub.append(el('span', { class: 'tag high', text: need + ' need an answer' }));
    if (toVerify && S.result && !S.running && S.viewing) sub.append(el('span', { class: 'tag violet', text: toVerify + ' to verify' }));
    sub.append(el('span', { class: 'grow' }));
    if (S.result && S.caps.sample && !S.running && !S.viewing) {
      const rerun = el('button', { class: 'btn ghost icon', type: 'button', title: 'Run again (fresh answer)', 'aria-label': 'Run again' });
      rerun.append(svg('refresh'));
      rerun.addEventListener('click', async () => { S.result = null; S.steps = S.steps.filter((s) => s.key === 'extract' || s.key === 'blocks'); S.calib = null; S.reference = false; S.expanded = {}; S.ai = {}; S.responses = {}; S.ack = false; S.edits.forEach((e) => { e.fid = null; }); renderHead(); renderStatus(); renderRail(); await runModel(true); });
      sub.append(rerun);
    }
    if (S.result && S.caps.downloads && !S.running) {
      const dl = el('button', { class: 'btn ghost icon', type: 'button', title: S.viewing ? 'Export the brief as PDF' : 'Export the summary as PDF', 'aria-label': S.viewing ? 'Export the brief as PDF' : 'Export the summary as PDF' });
      dl.append(svg('download'));
      dl.addEventListener('click', () => savePdf(S.viewing || currentSubmissionShape(), S.viewing ? 'desk' : 'banker'));
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
    if (S.running) body.append(el('div', { class: 'helper', style: 'margin:-4px 2px 12px', text: 'Thorough runs take 2 to 5 minutes on a long deck. The first call asks you to allow Claude for this page.' }));
  }
  function renderList(body, list) {
    renderSteps(body);
    if (S.result && S.result.meta.error) { const n = el('div', { class: 'note red', style: 'margin-bottom:10px' }); n.append(svg('alert'), el('span', { text: S.result.meta.error })); body.append(n); }
    if (S.result && S.result.meta.deterministicOnly && !S.result.meta.error) { const n = el('div', { class: 'note amber', style: 'margin-bottom:10px' }); n.append(svg('alert'), el('span', { text: 'Claude is not available in this view: only the required blocks were checked. Open the page in the Claude app to run the full pre-review.' })); body.append(n); }
    if (S.result && S.result.meta.reference) { const n = el('div', { class: 'note blue', style: 'margin-bottom:10px' }); n.append(el('span', { text: S.result.meta.note })); body.append(n); }
    { const w = modelWarning(); if (w) body.append(w); }
    if (S.result && S.result.meta.truncated) { const n = el('div', { class: 'note amber', style: 'margin-bottom:10px' }); n.append(el('span', { text: 'The model\'s answer was cut short; some points may be missing.' })); body.append(n); }
    if (!S.result && !S.running) return;
    if (S.focus) { const fcd = focusCard(); if (fcd) { body.append(fcd); return; } }
    { const rn = roundNote(); if (rn) body.append(rn); }
    if (S.viewing) { const so = secondOpinionCard(); if (so) body.append(so); const mc = memoryCard(); if (mc) body.append(mc); }
    if (S.tab === 'disclosures' && S.filter === 'all') { const cn = contradictionNote(); if (cn) body.append(cn); }
    { const fc = fixCard(); if (fc) body.append(fc); const eb = editBar(); if (eb) body.append(eb); }
    const filters = el('div', { class: 'filters' });
    const opts = S.tab === 'language' ? [['all', 'All'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']] : [['all', 'All'], ['high', 'High'], ['A', 'Required'], ['B', 'Triggered']];
    opts.forEach(([k, label]) => {
      const b = el('button', { type: 'button', 'aria-pressed': String(S.filter === k), text: label });
      b.addEventListener('click', () => { S.filter = k; renderRail(); });
      filters.append(b);
    });
    body.append(filters);
    const shown = list.filter((f) => S.filter === 'all' || (['high', 'medium', 'low'].includes(S.filter) ? f.severity === S.filter : f.tier === S.filter));
    if (!shown.length) { body.append(el('div', { class: 'empty', text: S.running ? 'Reading…' : (list.length ? 'Nothing in this filter.' : (S.tab === 'language' ? 'No language points. The wording reads as fair and balanced under the rulebook.' : 'No disclosure points.')) })); resolvedSection(body); return; }
    const certain = shown.filter((f) => Review.isCertain(f));
    const verify = shown.filter((f) => !Review.isCertain(f));
    if (S.tab === 'disclosures') {
      const req = certain.filter((f) => f.tier === 'A');
      const trig = certain.filter((f) => f.tier === 'B');
      if (req.length) { body.append(sectionHead('Required blocks', req.length)); req.forEach((f) => body.append(cardDisclosure(f))); }
      if (trig.length) { body.append(sectionHead('Triggered by the content', trig.length)); trig.forEach((f) => body.append(cardDisclosure(f))); }
      if (verify.length) { body.append(sectionHead('Awaiting your verification', verify.length, true)); body.append(verifyIntro()); verify.forEach((f) => body.append(cardDisclosure(f))); }
    } else {
      if (certain.length) { body.append(sectionHead(S.facts.lane === 'institutional' ? 'Institutional Marketing Compliance' : 'Retail Marketing Compliance', certain.length)); certain.forEach((f) => body.append(cardLanguage(f))); }
      if (verify.length) { body.append(sectionHead('Awaiting your verification', verify.length, true)); body.append(verifyIntro()); verify.forEach((f) => body.append(cardLanguage(f))); }
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
    resolvedSection(body);
  }
  function sectionHead(label, n, verify) {
    const h = el('div', { class: 'section-h' + (verify ? ' v' : '') });
    h.append(el('span', { text: label }), el('span', { class: 'line' }), el('span', { class: 'badge ' + (verify ? 'grey' : n ? 'warn' : 'grey'), text: String(n) }));
    return h;
  }
  function verifyIntro() {
    return el('div', { class: 'helper', style: 'margin:-2px 4px 10px', text: 'Possible points the pre-review was not certain enough to assert. The banker did not see them. Confirm the ones you would send, dismiss the others; each verdict trains the next pre-reviews.' });
  }
  function verifyTag() { return el('span', { class: 'tag vtag', text: 'To verify' }); }
  function carriedTag(f) { return el('span', { class: 'tag carried', title: 'This point stood on round ' + f.carried.round + ' and is still here', text: 'Still open from round ' + f.carried.round }); }
  /* a resubmission carries the reviewer's request for changes into the workspace */
  function roundNote() {
    const p = S.resubmitOf; if (!p || S.mode !== 'banker' || S.viewing) return null;
    const n = el('div', { class: 'roundnote' });
    n.append(el('b', { text: 'Round ' + ((p.round || 1) + 1) + ' · the reviewer requested changes on round ' + (p.round || 1) + (p.decision && p.decision.by ? ' (' + p.decision.by + ', ' + U.fmtDate(p.decision.at) + ')' : '') }));
    if (p.decision && p.decision.message) n.append(el('div', { class: 'q', text: p.decision.message }));
    else n.append(el('span', { text: 'No message was attached to the request; the points that stood on the previous round are marked once the pre-review has run.' }));
    if (S.sinceRound) n.append(el('div', { class: 'helper', text: 'Since round ' + S.sinceRound.round + ': ' + S.sinceRound.resolved.length + ' of ' + S.sinceRound.of + ' point' + (S.sinceRound.of === 1 ? '' : 's') + ' resolved, ' + S.sinceRound.open.length + ' still open (tagged on the cards).' }));
    return n;
  }
  /* figures that do not agree, on the disclosures tab: the summary holds the whole deal file */
  function contradictionNote() {
    const c = S.result && S.result.consistency; if (!c || !Array.isArray(c.contradictions) || !c.contradictions.length) return null;
    const n = el('div', { class: 'note amber', style: 'margin-bottom:10px;cursor:pointer' });
    n.append(svg('alert'), el('span', { class: 'grow', text: c.contradictions.length + ' figure' + (c.contradictions.length === 1 ? ' does' : 's do') + ' not agree' + ((c.deal || []).length ? ' (' + c.deal.length + ' with the deal file)' : '') + ': see the Summary tab.' }));
    n.addEventListener('click', () => { S.tab = 'summary'; renderRail(); });
    return n;
  }
  /* the deal file card: the figures the document commits to, and the contradictions found */
  function dealCard(desk) {
    const r = S.result; if (!r || !Array.isArray(r.claims)) return null;
    const c0 = r.consistency || {};
    const c = { contradictions: (Array.isArray(c0.contradictions) ? c0.contradictions : []).filter((x) => x && Array.isArray(x.values) && x.values.length >= 2), deal: Array.isArray(c0.deal) ? c0.deal : [], file: Array.isArray(c0.file) ? c0.file : [], changed: Array.isArray(c0.changed) ? c0.changed : [] };
    if (!r.claims.length && !c.contradictions.length && !c.file.length) return null;
    const card = el('div', { class: 'summary-card' });
    card.append(el('h4', { text: desk ? 'Deal file: the figures this document commits to' : 'The figures you commit to' }));
    if (c.contradictions.length) {
      c.contradictions.forEach((x) => { const d = el('div', { class: 'contra' + (x.kind === 'deal' ? ' deal' : '') }); d.append(el('b', { text: x.kind === 'deal' ? 'Differs from the deal file · ' : 'Does not agree within the document · ' }), document.createTextNode(x.text)); const go = el('button', { class: 'pgbtn', type: 'button', text: 'p. ' + x.values[0].page }); go.addEventListener('click', (e) => { e.stopPropagation(); scrollToPage(x.values[0].page); }); d.append(document.createTextNode(' '), go); card.append(d); });
      card.append(el('p', { class: 'helper', style: 'margin:4px 0 8px', text: desk ? 'A figure the banker states twice with different values, or differently from an earlier document of the same deal, is a misleading-statement risk under Rule 2210(d): ask which one is right before anything else.' : 'Reconcile these before you submit: Compliance will ask which figure is right.' }));
    } else if (r.claims.length) card.append(el('p', { class: 'helper', style: 'margin:0 0 8px', text: 'Every figure agrees with the others in the document' + ((c.file || []).length ? ' and with the ' + c.file.length + ' earlier document' + (c.file.length === 1 ? '' : 's') + ' of this deal' : '') + '.' }));
    if (r.claims.length) {
      const list = el('div', { class: 'claims' });
      r.claims.slice(0, 24).forEach((x) => { const row = el('div', { class: 'claim' }); row.append(el('span', { class: 'k', text: x.label }), el('span', { class: 'v', text: x.value }), el('span', { class: 'pg', text: 'p. ' + x.page })); row.style.cursor = 'pointer'; row.title = x.quote; row.addEventListener('click', () => scrollToPage(x.page)); list.append(row); });
      card.append(list);
      card.append(el('p', { class: 'helper', style: 'margin:8px 0 0', text: (r.claimsSource === 'model+scan' ? 'Read by the model and the text scan; every figure is quoted from its page.' : 'Read by the text scan of the pages; every figure is quoted from its page.') + (r.claims.length > 24 ? ' ' + (r.claims.length - 24) + ' more in the PDF summary.' : '') }));
    } else card.append(el('p', { class: 'helper', style: 'margin:0', text: 'No target, fee, size or track-record figure was found in the text.' }));
    (c.changed || []).forEach((x) => { const d = el('div', { class: 'contra round' }); d.append(el('b', { text: 'Changed since the previous round · ' }), document.createTextNode(x.text)); card.append(d); });
    if ((c.file || []).length) card.append(el('p', { class: 'helper', style: 'margin:8px 0 0', text: 'Compared with: ' + c.file.map((f) => f.name + ' (' + (f.at || '').slice(0, 10) + (f.thread ? ', round ' + f.round : '') + ', ' + f.figures + ' figure' + (f.figures === 1 ? '' : 's') + ')').join('; ') + '.' }));
    return card;
  }
  /* what changed since the previous round (both platforms) */
  function sinceRoundCard() {
    const sr = S.sinceRound; if (!sr || !Array.isArray(sr.open) || !Array.isArray(sr.resolved)) return null;
    const card = el('div', { class: 'summary-card' });
    card.append(el('h4', { text: 'Since round ' + sr.round }));
    const g = el('div', { class: 'grid' });
    [[String(sr.resolved.length), 'resolved', 'var(--success)'], [String(sr.open.length), 'still open', sr.open.length ? 'var(--danger)' : 'var(--success)'], [String(sr.of), 'stood on round ' + sr.round, 'var(--text-2)']].forEach(([n, l, col]) => { const st = el('div', { class: 'stat' }); st.append(el('div', { class: 'n', style: 'color:' + col, text: n }), el('div', { class: 'l', text: l })); g.append(st); });
    card.append(g);
    const goto = (id) => { const f = allFindings().find((x) => x.id === id); if (f) { S.tab = tierOfTab(f); selectFinding(f, { scrollPage: true, scrollPanel: true }); renderRail(); } };
    sr.open.forEach((x) => { const row = el('div', { class: 'sub-item', style: 'cursor:pointer' }); row.append(el('span', { class: 'tag carried', text: 'open' }), document.createTextNode(' ' + x.rule + (x.page ? ' · p. ' + x.page : '') + ' · ' + x.title)); row.addEventListener('click', () => goto(x.id)); card.append(row); });
    sr.resolved.forEach((x) => { const row = el('div', { class: 'sub-item' }); row.append(el('span', { class: 'tag ok', text: 'resolved' }), document.createTextNode(' ' + x.rule + (x.page ? ' · p. ' + x.page : '') + ' · ' + x.title)); card.append(row); });
    return card;
  }
  function verifyNote(f) {
    const n = el('div', { class: 'verify-note' });
    n.append(el('b', { text: 'Not asserted to the banker' }), document.createTextNode(f.why_verify ? ' · ' + f.why_verify + '.' : '.'));
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
    if (f.carried) row.append(carriedTag(f));
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
    if (f.carried) row.append(carriedTag(f));
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
        ai.alts.forEach((t) => {
          const li = el('li'); const cp = el('button', { class: 'btn xs', type: 'button', 'aria-label': 'Copy' }); cp.append(svg('copy')); cp.addEventListener('click', () => U.copyText(t));
          li.append(el('span', { text: t }), cp);
          if (canEdit() && f.boxes && f.boxes.length) { const use = el('button', { class: 'btn xs', type: 'button', title: 'Replace the passage in the document with this wording' }); use.append(svg('pen'), document.createTextNode('Use')); use.addEventListener('click', () => { const opt = Fix.optionsFor(Object.assign({}, f, { rewrite: t }), S.doc, S.edits, S.form).find((o) => o.key === 'replace'); if (opt) applyOption(f, opt); }); li.append(use); }
          ul.append(li);
        });
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
    lbl.append(el('span', { text: 'Your answer' }));
    if (certain && f.severity === 'high' && r.status === 'none') lbl.append(el('span', { class: 'need', text: 'Required before submission' }));
    wrap.append(lbl);
    if (canEdit()) { wrap.append(fixButton(f)); if ((S.expanded[f.id] || {}).fix) wrap.append(fixMenu(f)); }
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
    wrap.append(el('div', { class: 'said', html: resp && resp.status && resp.status !== 'none' ? '<b>Banker:</b> ' + U.esc(RESP[resp.status]) + (resp.note ? ' — ' + U.esc(resp.note) : '') : '<b>Banker:</b> ' + (certain ? 'no answer' : 'did not see this point') }));
    const v = (sub.verdicts && sub.verdicts[f.id]) || {};
    const row = el('div', { class: 'verdict' });
    row.append(el('span', { class: 'helper', style: 'margin:0', text: certain ? 'Your verdict' : 'Verification' }));
    const yes = el('button', { type: 'button', class: 'chip ' + (certain ? 'yes' : 'confirm') + (v.verdict === 'correct' ? ' on' : ''), 'data-verify': certain ? '' : 'confirm' }); yes.append(svg('check'), document.createTextNode(certain ? 'Correct flag' : 'Confirm'));
    const no = el('button', { type: 'button', class: 'chip ' + (certain ? 'no' : 'dismiss') + (v.verdict === 'incorrect' ? ' on' : ''), 'data-verify': certain ? '' : 'dismiss' }); no.append(svg('x'), document.createTextNode(certain ? 'Incorrect flag' : 'Dismiss'));
    yes.addEventListener('click', () => setVerdict(f, 'correct'));
    no.addEventListener('click', () => setVerdict(f, 'incorrect'));
    row.append(yes, no);
    if (v.verdict && v.by && S.user && v.byEmail && v.byEmail !== String(S.user.email || '').toLowerCase()) row.append(el('span', { class: 'tag grey', text: 'by ' + v.by }));
    if (!certain && !v.verdict) row.append(el('span', { class: 'tag vtag', text: 'Awaiting' }));
    if (!certain && v.verdict === 'correct') row.append(el('span', { class: 'tag ok', text: 'Confirmed as a point' }));
    if (!certain && v.verdict === 'incorrect') row.append(el('span', { class: 'tag grey', text: 'Dismissed' }));
    wrap.append(row);
    const input = el('input', { type: 'text', id: 'verdict-' + f.id, placeholder: v.verdict === 'incorrect' ? 'Why? This teaches the next pre-reviews.' : 'Comment for the banker and the AI (optional)', value: v.reason || '' });
    // saved as you type (debounced), never re-rendered from here: a click that follows the typing must land
    let timer = null;
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { const cur = (sub.verdicts && sub.verdicts[f.id]) || {}; if (cur.verdict) setVerdict(f, cur.verdict, input.value, 'comment'); else setComment(f, input.value); }, 500); });
    wrap.append(input);
    const mem = S.memory && S.memory.byFinding && S.memory.byFinding[f.id];
    const art = (score) => (score >= 96 ? 'an identical' : 'a similar');
    if (mem) {
      if (mem.mine) { const pr = el('div', { class: 'precedent' }); pr.append(el('b', { text: 'You ' + (mem.mine.entry.verdict === 'incorrect' ? 'dismissed' : 'confirmed') + ' ' + art(mem.mine.score) + ' point' + (mem.mine.entry.docName ? ' on ' + mem.mine.entry.docName.replace(/\.pdf$/i, '') : '') + (mem.mine.entry.at ? ' (' + mem.mine.entry.at.slice(0, 10) + ')' : '') }), document.createTextNode(mem.mine.entry.reason ? ': “' + mem.mine.entry.reason.slice(0, 140) + '”' : '.')); wrap.append(pr); }
      if (mem.colleagues && mem.colleagues.length) { const pr = el('div', { class: 'precedent desk' }); mem.colleagues.slice(0, 2).forEach((t, i) => { if (i) pr.append(el('br')); pr.append(el('b', { text: (t.entry.reviewer && t.entry.reviewer.name ? t.entry.reviewer.name : 'A colleague') + ' ' + (t.entry.verdict === 'incorrect' ? 'dismissed' : 'confirmed') + ' ' + art(t.score) + ' point' + (t.entry.docName ? ' on ' + t.entry.docName.replace(/\.pdf$/i, '') : '') + (t.entry.at ? ' (' + t.entry.at.slice(0, 10) + ')' : '') }), document.createTextNode(t.entry.reason ? ': “' + t.entry.reason.slice(0, 140) + '”' : '.')); }); wrap.append(pr); }
    } else if (f.precedent) { const pr = el('div', { class: 'precedent' }); pr.append(el('b', { text: (f.precedent.mine ? 'You' : (f.precedent.by || 'A reviewer')) + ' ' + (f.precedent.verdict === 'incorrect' ? 'dismissed' : 'confirmed') + ' ' + art(f.precedent.score) + ' point' + (f.precedent.at ? ' on ' + f.precedent.at.slice(0, 10) : '') }), document.createTextNode(f.precedent.reason ? ': “' + f.precedent.reason.slice(0, 160) + '”' : '.')); wrap.append(pr); }
    return wrap;
  }
  async function setVerdict(f, verdict, reason, source) {
    const sub = S.viewing;
    sub.verdicts = sub.verdicts || {};
    const cur = sub.verdicts[f.id] || {};
    if (cur.verdict === verdict && reason === undefined) { if (cur.reason) sub.verdicts[f.id] = { reason: cur.reason, at: new Date().toISOString(), by: cur.by || '', byEmail: cur.byEmail || '' }; else delete sub.verdicts[f.id]; }
    else sub.verdicts[f.id] = { verdict, reason: reason !== undefined ? reason : (cur.reason || ''), at: new Date().toISOString(), by: S.user ? S.user.name : '', byEmail: S.user ? String(S.user.email || '').toLowerCase() : '' };
    await Store.updateSubmission(sub.id, { verdicts: sub.verdicts });
    const v = sub.verdicts[f.id];
    if (v) await Learn.record(sub, f, v.verdict || null, v.reason, S.user, source || 'card'); // every verdict teaches, with or without a comment; a kept comment stays a comment
    else await Store.upsertCalibration({ id: 'cal-' + String(sub.id || 'x').replace(/[^a-z0-9]/gi, '').slice(-12) + '-' + String(f.id || 'f').replace(/[^a-z0-9]/gi, ''), type: 'withdrawn', rule: f.rule, submission: sub.id, findingId: f.id, at: new Date().toISOString() });
    scheduleMemory();
    if (source !== 'focus' && source !== 'comment') renderRail();
  }
  /* a comment on a point, with or without a verdict: it teaches the next pre-reviews and reaches the banker */
  async function setComment(f, text) {
    const sub = S.viewing;
    sub.verdicts = sub.verdicts || {};
    const cur = sub.verdicts[f.id] || {};
    sub.verdicts[f.id] = Object.assign({}, cur, { reason: text, at: new Date().toISOString(), by: S.user ? S.user.name : '', byEmail: S.user ? String(S.user.email || '').toLowerCase() : '' });
    if (!sub.verdicts[f.id].verdict && !text.trim()) delete sub.verdicts[f.id];
    await Store.updateSubmission(sub.id, { verdicts: sub.verdicts });
    await Learn.record(sub, f, cur.verdict || null, text, S.user, 'comment');
    const why = document.querySelector('#gate .why'); if (why) why.textContent = why.textContent.replace(/\d+ verdicts? recorded/, Object.keys(sub.verdicts).length + ' verdict' + (Object.keys(sub.verdicts).length === 1 ? '' : 's') + ' recorded');
  }

  /* ---------- summary tab ---------- */
  /* ---------- in-app document editing (banker platform, PDF) ---------- */
  function canEdit() { return S.mode === 'banker' && !S.viewing && S.doc && S.doc.kind === 'pdf' && !!S.doc.pdf && !!S.result && !S.running; }
  function editById(id) { return S.edits.find((e) => e.id === id) || null; }
  function pageBox(n) { return $('page-' + n); }
  function pctBox(b) { return 'left:' + (b.x * 100).toFixed(3) + '%;top:' + (b.y * 100).toFixed(3) + '%;width:' + (b.w * 100).toFixed(3) + '%;height:' + (b.h * 100).toFixed(3) + '%'; }
  function editStyle(e, page) {
    const pw = page.width || 612;
    const size = (e.size / pw) * 100; const pad = ((e.pad !== undefined ? e.pad : e.size * 0.45) / pw) * 100;
    return pctBox(e.box) + ';font-size:' + size.toFixed(3) + 'cqw;padding:' + pad.toFixed(3) + 'cqw;font-weight:' + (e.bold ? '700' : '400');
  }
  function drawEdits() {
    document.querySelectorAll('.edit, .edit-wo, .edit-outline').forEach((n) => n.remove());
    if (!S.doc || S.doc.kind !== 'pdf') return;
    if (S.viewing) {
      if (S.showOriginal) return;
      (S.changes || []).forEach((c, i) => {
        const overlay = document.querySelector('[data-overlay="' + c.page + '"]');
        if (!overlay || !c.box) return;
        const node = el('div', { class: 'edit-outline ' + (c.kind || 'text'), style: pctBox(c.box), title: c.label || c.kind, 'data-change': String(i) });
        node.append(el('span', { class: 'edit-tag', text: c.kind === 'whiteout' ? 'removed' : (c.kind === 'replace' ? 'rewritten' : 'added') }));
        overlay.append(node);
      });
      return;
    }
    S.edits.forEach((e) => {
      const overlay = document.querySelector('[data-overlay="' + e.page + '"]');
      const page = S.doc.pages.find((p) => p.number === e.page);
      if (!overlay || !page) return;
      (e.whiteout || []).forEach((b) => overlay.append(el('div', { class: 'edit-wo', style: pctBox(b) })));
      const node = el('div', { class: 'edit' + (e.kind === 'whiteout' ? ' wo' : '') + (S.editing === e.id ? ' sel' : ''), 'data-edit': e.id, style: editStyle(e, page), title: e.label, tabindex: '0' });
      if (e.kind !== 'whiteout') node.append(el('span', { class: 'edit-text', text: e.text || '' }));
      if (!e.text && e.kind !== 'whiteout') node.append(el('span', { class: 'edit-empty', text: 'Type the text in the panel' }));
      node.append(el('span', { class: 'edit-tag', text: e.kind === 'whiteout' ? 'removed' : (e.kind === 'replace' ? 'rewritten' : 'added') }));
      const hdl = el('span', { class: 'edit-hdl', title: 'Resize' });
      node.append(hdl);
      bindEditPointer(node, hdl, e);
      overlay.append(node);
    });
  }
  function bindEditPointer(node, hdl, e) {
    let drag = null;
    const start = (ev, mode) => {
      if (!canEdit()) return;
      const box = pageBox(e.page); if (!box) return;
      ev.preventDefault(); ev.stopPropagation();
      if (S.editing !== e.id) { S.editing = e.id; renderRail(); drawEdits(); }
      drag = { mode, x: ev.clientX, y: ev.clientY, box: Object.assign({}, e.box), pw: box.clientWidth, ph: box.clientHeight };
      try { node.setPointerCapture(ev.pointerId); } catch (err) { /* synthetic events */ }
      node.classList.add('dragging');
    };
    const move = (ev) => {
      if (!drag) return;
      const dx = (ev.clientX - drag.x) / drag.pw; const dy = (ev.clientY - drag.y) / drag.ph;
      if (drag.mode === 'move') { e.box.x = U.clamp(drag.box.x + dx, 0, 1 - e.box.w); e.box.y = U.clamp(drag.box.y + dy, 0, 1 - e.box.h); }
      else { e.box.w = U.clamp(drag.box.w + dx, 0.04, 1 - e.box.x); e.box.h = U.clamp(drag.box.h + dy, 0.01, 1 - e.box.y); }
      const live = document.querySelector('[data-edit="' + e.id + '"]');
      if (live) live.setAttribute('style', editStyle(e, S.doc.pages.find((p) => p.number === e.page)));
    };
    const end = () => { if (!drag) return; drag = null; node.classList.remove('dragging'); S.correctedDirty = true; renderEditCardOnly(); };
    node.addEventListener('pointerdown', (ev) => { if (ev.target === hdl) return; start(ev, 'move'); });
    hdl.addEventListener('pointerdown', (ev) => start(ev, 'resize'));
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', end);
    node.addEventListener('pointercancel', end);
    node.addEventListener('click', (ev) => { ev.stopPropagation(); if (S.editing !== e.id) { S.editing = e.id; renderRail(); drawEdits(); } });
    node.addEventListener('keydown', (ev) => { if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); removeEdit(e.id); } });
  }
  function selectEdit(id, scroll) {
    S.editing = id;
    const e = editById(id);
    if (e && scroll) { const box = pageBox(e.page); const viewer = $('viewer'); if (box && viewer) { const y = box.offsetTop + e.box.y * box.clientHeight; viewer.scrollTo({ top: Math.max(box.offsetTop - 12, y - viewer.clientHeight * 0.4), behavior: 'smooth' }); S.page = e.page; $('pg-input').value = String(e.page); } }
    renderRail(); drawEdits();
    if (e) { const node = document.querySelector('[data-edit="' + id + '"]'); if (node) node.focus({ preventScroll: true }); }
  }
  function addEdit(e, fid) {
    S.edits.push(e); S.correctedDirty = true;
    if (fid) { const r = S.responses[fid] || {}; if (r.status !== 'fixed') S.responses[fid] = Object.assign({}, r, { status: 'fixed', note: r.note || 'Edited in the app' }); }
    selectEdit(e.id, true);
    return e;
  }
  function removeEdit(id) {
    const e = editById(id); if (!e) return;
    S.edits = S.edits.filter((x) => x.id !== id); S.correctedDirty = true;
    if (S.editing === id) S.editing = null;
    if (e.fid && !S.edits.some((x) => x.fid === e.fid)) { const r = S.responses[e.fid]; if (r && r.status === 'fixed' && r.note === 'Edited in the app') S.responses[e.fid] = Object.assign({}, r, { status: 'none', note: '' }); }
    renderRail(); drawEdits(); renderHead();
  }
  function applyOption(f, opt) { const e = opt.make(); e.label = e.label || opt.label; addEdit(e, f.id); renderHead(); U.toast(opt.label + ' · drag the box to move it, use the handle to resize'); }
  function applyAllFixes() {
    if (!canEdit()) return;
    let n = 0; const skipped = [];
    currentFindings().forEach((f) => {
      if (f.resolved) return;
      if (S.edits.some((e) => e.fid === f.id)) return;
      const opt = Fix.defaultOption(f, S.doc, S.edits, S.form);
      if (opt) { const e = opt.make(); e.label = e.label || opt.label; S.edits.push(e); const r = S.responses[f.id] || {}; S.responses[f.id] = Object.assign({}, r, { status: 'fixed', note: 'Edited in the app' }); n += 1; }
      else skipped.push(f);
    });
    S.correctedDirty = true; S.editing = null;
    renderRail(); drawEdits(); renderHead();
    U.toast(n + ' fix' + (n === 1 ? '' : 'es') + ' placed in the document' + (skipped.length ? ' · ' + skipped.length + ' point' + (skipped.length === 1 ? ' needs' : 's need') + ' your input (sources, facts)' : ''));
  }
  function fixMenu(f) {
    const wrap = el('div', { class: 'fixmenu' });
    Fix.optionsFor(f, S.doc, S.edits, S.form).forEach((opt) => {
      const b = el('button', { class: 'fixopt', type: 'button' });
      b.append(el('b', { text: opt.label }), el('small', { text: opt.key === 'add' ? 'The SOP wording, placed as a text box you can move and resize' : opt.key === 'replace' ? 'The original passage is covered and the suggested rewrite is set in its place' : opt.key === 'remove' ? 'The passage is covered with a white box' : opt.key === 'source' ? 'A source line under the exhibit; complete it with the actual source' : 'An empty box to type your own wording' }));
      b.addEventListener('click', (ev) => { ev.stopPropagation(); const ex = S.expanded[f.id] || {}; ex.fix = false; S.expanded[f.id] = ex; applyOption(f, opt); });
      wrap.append(b);
    });
    return wrap;
  }
  function fixButton(f) {
    const has = S.edits.filter((e) => e.fid === f.id);
    const b = el('button', { class: 'btn sm fixbtn' + (has.length ? ' done' : ''), type: 'button' });
    b.append(svg(has.length ? 'check' : 'pen'), document.createTextNode(has.length ? (has.length === 1 ? 'Fixed in the document' : has.length + ' edits in the document') : 'Fix in the document'));
    b.addEventListener('click', (ev) => { ev.stopPropagation(); if (has.length) { selectEdit(has[0].id, true); return; } const ex = S.expanded[f.id] || {}; ex.fix = !ex.fix; S.expanded[f.id] = ex; renderRail(); });
    return b;
  }
  function renderEditCardOnly() { const card = document.querySelector('.fixcard'); if (!card) return; const fresh = fixCard(); if (fresh) card.replaceWith(fresh); }
  function fixCard() {
    const e = editById(S.editing); if (!e) return null;
    const f = allFindings().find((x) => x.id === e.fid);
    const page = S.doc.pages.find((p) => p.number === e.page);
    const c = el('div', { class: 'fixcard' });
    const top = el('div', { class: 'top' });
    top.append(svg('pen'), el('b', { text: e.kind === 'whiteout' ? 'Passage removed' : e.kind === 'replace' ? 'Passage rewritten' : 'Text added' }), el('span', { class: 'code', text: 'p. ' + e.page }), el('span', { class: 'grow' }));
    const done = el('button', { class: 'btn xs primary', type: 'button', text: 'Done' }); done.addEventListener('click', () => { S.editing = null; renderRail(); drawEdits(); });
    top.append(done);
    c.append(top);
    if (f) c.append(el('div', { class: 'helper', text: f.rule + ' · ' + f.title }));
    if (e.kind !== 'whiteout') {
      const ta = el('textarea', { rows: '4', placeholder: 'Text as it will appear in the document' });
      ta.value = e.text || '';
      ta.addEventListener('input', () => { e.text = ta.value; e.box.h = Math.max(e.box.h, Fix.autoHeight(e, page)); S.correctedDirty = true; const live = document.querySelector('[data-edit="' + e.id + '"]'); if (live) { live.setAttribute('style', editStyle(e, page)); const t = live.querySelector('.edit-text'); if (t) t.textContent = e.text; const em = live.querySelector('.edit-empty'); if (em) em.hidden = !!e.text; } });
      c.append(ta);
      const ctl = el('div', { class: 'fixctl' });
      const minus = el('button', { class: 'btn xs', type: 'button', text: '−', title: 'Smaller' }); const plus = el('button', { class: 'btn xs', type: 'button', text: '+', title: 'Larger' });
      const sz = el('span', { class: 'sz', text: e.size + ' pt' });
      const setSize = (v) => { e.size = U.clamp(Math.round(v * 2) / 2, 4, 36); sz.textContent = e.size + ' pt'; e.box.h = Math.max(e.box.h, Fix.autoHeight(e, page)); S.correctedDirty = true; const live = document.querySelector('[data-edit="' + e.id + '"]'); if (live) live.setAttribute('style', editStyle(e, page)); };
      minus.addEventListener('click', () => setSize(e.size - 0.5)); plus.addEventListener('click', () => setSize(e.size + 0.5));
      const bold = el('button', { class: 'btn xs' + (e.bold ? ' on' : ''), type: 'button', text: 'Bold', 'aria-pressed': String(!!e.bold) });
      bold.addEventListener('click', () => { e.bold = !e.bold; bold.setAttribute('aria-pressed', String(e.bold)); bold.classList.toggle('on', e.bold); S.correctedDirty = true; const live = document.querySelector('[data-edit="' + e.id + '"]'); if (live) live.setAttribute('style', editStyle(e, page)); });
      const fit = el('button', { class: 'btn xs', type: 'button', text: 'Fit height' }); fit.addEventListener('click', () => { e.box.h = Fix.autoHeight(e, page); S.correctedDirty = true; drawEdits(); });
      ctl.append(minus, sz, plus, bold, fit);
      if (S.doc.pages.length > 1) {
        const sel = el('select', { 'aria-label': 'Page' });
        S.doc.pages.forEach((p) => sel.append(el('option', { value: String(p.number), text: 'Page ' + p.number, selected: p.number === e.page ? 'selected' : null })));
        sel.addEventListener('change', () => { e.page = +sel.value; e.whiteout = []; S.correctedDirty = true; drawEdits(); selectEdit(e.id, true); });
        ctl.append(sel);
      }
      c.append(ctl);
    } else c.append(el('div', { class: 'helper', text: 'The passage is covered with a white box in the corrected file. Drag to move, use the handle to resize.' }));
    const foot = el('div', { class: 'fixfoot' });
    const del = el('button', { class: 'btn xs danger', type: 'button', text: 'Remove this edit' }); del.addEventListener('click', () => removeEdit(e.id));
    foot.append(el('span', { class: 'helper', text: 'Drag the box to move it · handle to resize · Delete key removes it' }), el('span', { class: 'grow' }), del);
    c.append(foot);
    return c;
  }
  /* points the app can fix without the banker's input (SOP text to add, a rewrite in place) and not yet edited */
  function autoFixable() { return canEdit() ? currentFindings().filter((f) => !f.resolved && !S.edits.some((e) => e.fid === f.id) && Fix.defaultOption(f, S.doc, S.edits, S.form)) : []; }
  function editBar() {
    if (S.viewing) return reviewerChanges();
    if (!S.doc || S.doc.kind !== 'pdf') return null;
    const auto = autoFixable();
    if (!S.edits.length && S.version === 1) {
      if (!auto.length) return null;
      const bar = el('div', { class: 'editbar' });
      const head = el('div', { class: 'eb-head' });
      head.append(svg('pen'), el('b', { text: auto.length + ' point' + (auto.length === 1 ? '' : 's') + ' can be fixed in the document for you' }), el('span', { class: 'grow' }));
      bar.append(head, el('div', { class: 'helper', style: 'margin:4px 0 0', text: 'The SOP wording placed on the right page, flagged passages rewritten in place. Every box stays yours to move, resize or edit.' }));
      const acts = el('div', { class: 'eb-acts' });
      const all = el('button', { class: 'btn sm primary', type: 'button', id: 'btn-apply-all' }); all.append(svg('pen'), document.createTextNode('Apply all suggested fixes'));
      all.addEventListener('click', () => applyAllFixes());
      acts.append(all); bar.append(acts);
      return bar;
    }
    const bar = el('div', { class: 'editbar' });
    const n = S.edits.length;
    const head = el('div', { class: 'eb-head' });
    head.append(svg('pen'), el('b', { text: S.version > 1 ? 'Version ' + S.version + ' · corrected in the app' : n + ' change' + (n === 1 ? '' : 's') + ' in the document' }), el('span', { class: 'grow' }));
    bar.append(head);
    if (n) {
      const list = el('div', { class: 'eb-list' });
      S.edits.forEach((e) => { const row = el('button', { class: 'eb-row' + (S.editing === e.id ? ' on' : ''), type: 'button' }); row.append(el('span', { class: 'code', text: 'p. ' + e.page }), el('span', { text: e.label || e.kind })); row.addEventListener('click', () => selectEdit(e.id, true)); list.append(row); });
      bar.append(list);
    }
    if (S.resolved && S.resolved.length) bar.append(el('div', { class: 'helper', text: S.resolved.length + ' point' + (S.resolved.length === 1 ? '' : 's') + ' resolved by the corrected version' }));
    const acts = el('div', { class: 'eb-acts' });
    if (n && canEdit()) {
      const rc = el('button', { class: 'btn sm primary', type: 'button' }); rc.append(svg('refresh'), document.createTextNode('Re-check the corrected version'));
      rc.addEventListener('click', () => recheckCorrected());
      acts.append(rc);
    }
    if (auto.length && canEdit()) {
      const more = el('button', { class: 'btn sm', type: 'button', id: 'btn-apply-all' }); more.append(svg('pen'), document.createTextNode('Apply ' + auto.length + ' more suggested fix' + (auto.length === 1 ? '' : 'es')));
      more.addEventListener('click', () => applyAllFixes());
      acts.append(more);
    }
    if (n && S.caps.downloads) {
      const dl = el('button', { class: 'btn sm', type: 'button' }); dl.append(svg('download'), document.createTextNode('Download corrected PDF'));
      dl.addEventListener('click', () => downloadCorrected(dl));
      acts.append(dl);
    }
    if (S.version > 1 && S.caps.downloads) {
      const dl2 = el('button', { class: 'btn sm', type: 'button' }); dl2.append(svg('download'), document.createTextNode('Download v' + S.version + ' (PDF)'));
      dl2.addEventListener('click', () => { S.caps.downloads.save({ filename: S.doc.name, data: S.doc.bytes }); });
      acts.append(dl2);
    }
    if (S.version > 1 && S.caps.sample && !S.running) {
      const full = el('button', { class: 'btn sm', type: 'button' }); full.append(svg('spark'), document.createTextNode('Full pre-review of v' + S.version));
      full.addEventListener('click', () => fullRerun());
      acts.append(full);
    }
    if (acts.childNodes.length) bar.append(acts);
    if (canEdit()) { const ob = officeButtons(); if (ob) { ob.prepend(el('span', { class: 'helper', style: 'align-self:center;margin:0', text: 'Export as' })); bar.append(ob); } }
    return bar;
  }
  /* reviewer platform: the two memories (personal, shared) for the open submission */
  let memoryTimer = null;
  async function refreshMemory(quiet) {
    const sub = S.viewing; if (!sub) return;
    try {
      const m = await Learn.deskMemory(sub, S.user, S.inbox);
      if (S.viewing !== sub) return;
      S.memory = m; sub.memory = { similar: m.desk.similar, hints: m.desk.hints, differs: m.desk.differs.length, personal: { missed: m.personal.missed.length, differs: m.personal.differs.length } };
      if (quiet) { const old = document.querySelector('.memcard'); const fresh = memoryCard(); if (old && fresh) old.replaceWith(fresh); else if (old && !fresh) old.remove(); }
      else renderRail();
    } catch (e) { console.warn('memory unavailable', e); }
  }
  function scheduleMemory() { clearTimeout(memoryTimer); memoryTimer = setTimeout(() => refreshMemory(true), 400); }
  function memoryCard() {
    const m = S.memory; if (!m || !S.viewing) return null;
    const p = m.personal; const d = m.desk;
    const hasPersonal = p.habits.length || p.missed.length || p.differs.length;
    const hasDesk = d.similar.length || d.hints || d.differs.length;
    const cs = S.result && S.result.consistency; const hasDeal = !!(cs && Array.isArray(cs.contradictions) && ((cs.file || []).length || cs.contradictions.length));
    if (!hasPersonal && !hasDesk && !hasDeal) return null;
    const card = el('div', { class: 'memcard' });
    const head = el('div', { class: 'mc-head' }); head.append(svg('bulb'), el('b', { text: 'Memory' }), el('span', { class: 'helper', style: 'margin:0', text: 'yours, and the reviewers\'' })); card.append(head);
    const goto = (id) => { const f = allFindings().find((x) => x.id === id); if (f) { S.tab = tierOfTab(f); selectFinding(f, { scrollPage: true, scrollPanel: true }); renderRail(); } };
    const row = (cls, html, id) => { const r = el(id ? 'button' : 'div', { class: 'mc-row ' + cls, html }); if (id) { r.type = 'button'; r.addEventListener('click', () => goto(id)); } return r; };
    const where = (x) => x.rule + (x.page ? ' p. ' + x.page : '');
    const sec = (title, sub2) => { const h = el('div', { class: 'mc-sec' }); h.append(el('b', { text: title })); if (sub2) h.append(el('span', { text: sub2 })); return h; };
    if (hasPersonal) {
      card.append(sec('For you', m.reviewer ? m.reviewer.name : ''));
      if (p.habits.length) card.append(row('', 'On these rules you ' + p.habits.slice(0, 5).map((h) => (h.correct >= h.incorrect ? 'confirm ' : 'dismiss ') + '<span class="code">' + U.esc(h.rule) + '</span> ' + (h.correct >= h.incorrect ? h.correct : h.incorrect) + '/' + h.total).join(', ') + '.'));
      p.missed.slice(0, 6).forEach((x) => card.append(row('warn', '<span class="code">' + U.esc(where(x)) + '</span> not verdicted yet, and ' + U.esc(x.why) + '.', x.id)));
      p.differs.slice(0, 6).forEach((x) => card.append(row('warn', '<span class="code">' + U.esc(where(x)) + '</span> you ' + (x.now === 'correct' ? 'confirmed' : 'dismissed') + ' it here but ' + (x.habit ? 'you usually ' + (x.before === 'correct' ? 'confirm' : 'dismiss') + ' ' + U.esc(x.rule) + ' (' + (x.before === 'correct' ? x.habit.correct : x.habit.incorrect) + '/' + x.habit.total + ')' : (x.before === 'correct' ? 'confirmed' : 'dismissed') + ' the same passage on ' + U.esc((x.at || '').slice(0, 10)) + (x.doc ? ' (' + U.esc(x.doc) + ')' : '') + (x.reason ? ': “' + U.esc(x.reason.slice(0, 120)) + '”' : '')) + '.', x.id)));
    }
    if (hasDesk) {
      card.append(sec('From the other reviewers', d.similar.length ? d.similar.length + ' similar submission' + (d.similar.length === 1 ? '' : 's') : ''));
      d.similar.slice(0, 4).forEach((x) => card.append(row('', '<b>' + U.esc(x.name) + '</b>' + (x.sameDoc ? ' <span class="tag grey">same document</span>' : ' <span class="m">' + Math.round(x.score * 100) + '% alike</span>') + ' · ' + U.esc(U.fmtDate(x.at)) + (x.reviewers.length ? ' · ' + U.esc(x.reviewers.join(', ')) : '') + (x.decision ? ' · <b>' + U.esc(STATUS_LABEL[x.status] || x.status) + '</b>' : ' · not decided') + (x.confirmed.length ? ' · confirmed ' + U.esc(Array.from(new Set(x.confirmed)).join(', ')) : '') + (x.dismissed.length ? ' · dismissed ' + U.esc(Array.from(new Set(x.dismissed)).join(', ')) : ''))));
      if (d.hints) card.append(row('', d.hints + ' point' + (d.hints === 1 ? '' : 's') + ' of this submission ' + (d.hints === 1 ? 'was' : 'were') + ' seen by colleagues on similar material; their verdicts sit under each point.'));
      d.differs.slice(0, 6).forEach((x) => card.append(row('warn', '<span class="code">' + U.esc(where(x)) + '</span> you ' + (x.now === 'correct' ? 'confirmed' : 'dismissed') + ' it, ' + U.esc(x.by) + ' ' + (x.theirs === 'correct' ? 'confirmed' : 'dismissed') + ' a similar point' + (x.doc ? ' on ' + U.esc(x.doc) : '') + (x.reason ? ': “' + U.esc(x.reason.slice(0, 120)) + '”' : '') + '. Keep yours or align; either way write why.', x.id)));
    }
    if (hasDeal) {
      card.append(sec('From the deal file', (cs.file || []).length ? (cs.file.length + ' earlier document' + (cs.file.length === 1 ? '' : 's') + ' of this deal') : ''));
      (cs.file || []).slice(0, 4).forEach((x) => card.append(row('', '<b>' + U.esc(x.name) + '</b> · ' + U.esc(U.fmtDate(x.at)) + (x.thread ? ' · round ' + U.esc(String(x.round)) : '') + ' · <b>' + U.esc(STATUS_LABEL[x.status] || 'New') + '</b> · ' + U.esc(String(x.figures)) + ' figure' + (x.figures === 1 ? '' : 's'))));
      cs.contradictions.slice(0, 6).forEach((x) => { const r = row('warn', '<b>' + U.esc(x.label) + '</b> ' + U.esc(x.text)); r.style.cursor = 'pointer'; r.addEventListener('click', () => scrollToPage(x.values[0].page)); card.append(r); });
      (cs.changed || []).slice(0, 4).forEach((x) => card.append(row('', '<b>' + U.esc(x.label) + '</b> ' + U.esc(x.text))));
      if (!cs.contradictions.length) card.append(row('', 'Every figure agrees with the earlier documents of this deal.'));
    }
    return card;
  }
  /* ---------- reviewer platform: second opinion after an approval ---------- */
  async function runSecondOpinion(sub) {
    if (!S.caps.sample || !S.viewing || S.viewing !== sub) return;
    S.secondOpinion = { busy: true, points: [], verdict: '' };
    renderGate(); renderRail();
    try {
      const r = await Ask.secondOpinion(S.caps.sample, sub, aiCtx());
      if (S.viewing !== sub) return;
      S.secondOpinion = Object.assign({ busy: false }, r);
      sub.secondOpinion = r;
      try { await Store.updateSubmission(sub.id, { secondOpinion: r }); } catch (e) { /* the opinion still shows for this session */ }
      U.toast(r.points.length ? 'Second opinion: ' + r.points.length + ' point' + (r.points.length === 1 ? '' : 's') + ' to look at' : 'Second opinion: nothing further stands out');
    } catch (e) { if (S.viewing !== sub) return; S.secondOpinion = null; U.toast('Claude could not give a second opinion' + (e && e.message ? ': ' + e.message : '')); }
    renderGate(); renderRail();
  }
  function secondOpinionCard() {
    const so = S.secondOpinion; if (!so || !S.viewing) return null;
    const card = el('div', { class: 'sop' });
    const h = el('div', { class: 'sh' }); h.append(svg('spark'), el('b', { text: so.busy ? 'Second opinion · reading the material again' : 'Second opinion after approval' }), el('span', { class: 'grow' }));
    if (!so.busy) { const x = el('button', { class: 'btn ghost icon', type: 'button', 'aria-label': 'Dismiss' }); x.append(svg('x')); x.addEventListener('click', () => { const sub = S.viewing; S.secondOpinion = null; sub.secondOpinion = null; Store.updateSubmission(sub.id, { secondOpinion: null }).catch(() => {}); renderGate(); renderRail(); }); h.append(x); }
    card.append(h);
    if (so.busy) { card.append(el('div', { class: 'helper', style: 'margin:0', text: 'A deliberately sceptical second reader looks for what could still embarrass the firm. Nothing changes unless you reopen a point.' })); return card; }
    if (so.verdict) card.append(el('div', { class: 'helper', style: 'margin:0 0 6px', text: so.verdict }));
    if (!so.points.length) card.append(el('div', { class: 'helper', style: 'margin:0', text: 'Nothing further with a verbatim passage on the page.' }));
    so.points.forEach((pt) => { const d = el('div', { class: 'pt' }); d.append(el('span', { class: 'tag ' + pt.severity, text: pt.severity }), document.createTextNode(' ' + (pt.rule ? pt.rule + ' · ' : '') + 'p. ' + pt.page + ' · ' + pt.concern + ' '), el('i', { text: '“' + pt.quote.slice(0, 120) + '”' })); d.addEventListener('click', () => scrollToPage(pt.page)); card.append(d); });
    card.append(el('div', { class: 'helper', style: 'margin:6px 0 0', text: 'Advisory. The approval stands unless you request changes; a reopened point is recorded like any decision.' }));
    return card;
  }
  /* reviewer platform: what the banker changed in the app, with a switch to the original file when it is at hand */
  function reviewerChanges() {
    const ch = S.changes || [];
    if (!ch.length && !(S.viewing && S.viewing.version > 1)) return null;
    const bar = el('div', { class: 'editbar desk' });
    const head = el('div', { class: 'eb-head' });
    head.append(svg('pen'), el('b', { text: 'Version ' + (S.viewing.version || 1) + ' · corrected by the banker in the app' }), el('span', { class: 'grow' }));
    if (S.originalDoc && S.doc.kind === 'pdf') {
      const seg = el('div', { class: 'seg xs', role: 'group' });
      const a = el('button', { type: 'button', 'aria-pressed': String(!S.showOriginal), text: 'Corrected' }); const b = el('button', { type: 'button', 'aria-pressed': String(!!S.showOriginal), text: 'Original' });
      const swap = (orig) => { if (S.showOriginal === orig) return; S.showOriginal = orig; const cur = S.doc; S.doc = orig ? Object.assign({}, S.originalDoc, { kind: 'pdf' }) : S.correctedDoc; if (orig) S.correctedDoc = cur; renderViewer(); renderHead(); renderRail(); };
      a.addEventListener('click', () => swap(false)); b.addEventListener('click', () => swap(true));
      seg.append(a, b); head.append(seg);
    }
    bar.append(head);
    if (S.showOriginal) bar.append(el('div', { class: 'helper', text: 'Original file as uploaded, before the corrections. The attention points refer to the corrected version.' }));
    const list = el('div', { class: 'eb-list' });
    ch.forEach((c) => {
      const row = el('button', { class: 'eb-row', type: 'button' });
      row.append(el('span', { class: 'code', text: 'p. ' + c.page }), el('span', { text: (c.label || c.kind) + (c.text ? ' · “' + c.text.slice(0, 70) + (c.text.length > 70 ? '…' : '') + '”' : '') }));
      row.addEventListener('click', () => { scrollToPage(c.page); const node = document.querySelector('[data-change="' + ch.indexOf(c) + '"]'); if (node) { node.classList.add('pulse'); setTimeout(() => node.classList.remove('pulse'), 2400); } });
      list.append(row);
    });
    bar.append(list);
    if (S.resolved && S.resolved.length) bar.append(el('div', { class: 'helper', text: S.resolved.length + ' point' + (S.resolved.length === 1 ? '' : 's') + ' from the first pre-review resolved by these changes; listed under each tab.' }));
    return bar;
  }
  async function buildCorrected() {
    if (!S.edits.length) return null;
    if (S.correctedBytes && !S.correctedDirty) return S.correctedBytes;
    const bytes = await Fix.corrected(S.doc, S.edits);
    S.correctedBytes = bytes; S.correctedDirty = false;
    return bytes;
  }
  /* Office exports: pages as pictures of the uploaded file, corrections as editable boxes (PowerPoint) or an
     editable change sheet (Word) */
  const MIME = { pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  async function exportOffice(kind, btn) {
    if (!S.doc || S.doc.kind !== 'pdf' || !S.doc.pdf) { U.toast('Office exports need a PDF'); return; }
    try {
      if (btn) { btn.disabled = true; }
      setStatus('Building the ' + (kind === 'pptx' ? 'PowerPoint' : 'Word') + ' file…');
      const base = S.history && S.history.length && S.history[0].doc && S.history[0].doc.pdf ? S.history[0].doc : S.doc;
      const changes = ((S.result && S.result.meta && S.result.meta.changes) || []).concat(Fix.changeLog(S.edits, allFindings()));
      const points = (S.viewing ? allFindings() : currentFindings()).concat(S.resolved || []);
      const title = (S.doc.sourceName || S.doc.name).replace(/\.pdf$/i, '');
      const bytes = kind === 'pptx' ? await Exports.pptx(base, changes, points, { title, version: S.version }) : await Exports.docx(base, changes, points, { title, version: S.version });
      const filename = title.replace(/ \(corrected v\d+\)/, '') + (changes.length ? ' (corrected)' : '') + '.' + kind;
      await S.caps.downloads.save({ filename, data: new Blob([bytes], { type: MIME[kind] }) });
      setStatus(''); U.toast((kind === 'pptx' ? 'PowerPoint' : 'Word') + ' file saved');
    } catch (e) { console.error(e); setStatus(''); U.toast('Could not build the file: ' + (e.message || e)); }
    finally { if (btn) btn.disabled = false; }
  }
  function officeButtons() {
    if (!S.caps.downloads || !S.doc || S.doc.kind !== 'pdf' || !S.doc.pdf) return null;
    const wrap = el('div', { class: 'eb-acts' });
    const pp = el('button', { class: 'btn sm', type: 'button' }); pp.append(svg('download'), document.createTextNode('PowerPoint')); pp.title = 'Every page as a slide, corrections as editable text boxes';
    pp.addEventListener('click', () => exportOffice('pptx', pp));
    const wd = el('button', { class: 'btn sm', type: 'button' }); wd.append(svg('download'), document.createTextNode('Word')); wd.title = 'Change sheet: corrected pages with editable corrections, then the attention points';
    wd.addEventListener('click', () => exportOffice('docx', wd));
    wrap.append(pp, wd);
    return wrap;
  }
  function correctedName(name, v) { return String(name || 'document.pdf').replace(/\.pdf$/i, '') + ' (corrected v' + v + ').pdf'; }
  async function downloadCorrected(btn) {
    try {
      if (btn) { btn.disabled = true; }
      const bytes = await buildCorrected();
      await S.caps.downloads.save({ filename: correctedName(S.doc.name, S.version + 1), data: bytes });
      U.toast('Corrected PDF saved');
    } catch (e) { console.error(e); U.toast('Could not build the corrected PDF: ' + (e.message || e)); }
    finally { if (btn) btn.disabled = false; }
  }
  /* corrected version becomes the working document: deterministic re-check, resolved points, new highlights */
  async function recheckCorrected() {
    if (!canEdit() || !S.edits.length) return;
    setStatus('Building the corrected version…');
    try {
      const bytes = await buildCorrected();
      const extracted = await Extract.pdf(bytes);
      const pages = Fix.maskPages(extracted.pages, S.edits);
      const sha = await U.sha256(bytes);
      const v = S.version + 1;
      S.history = S.history || [];
      S.history.push({ version: S.version, doc: S.doc, facts: S.facts, findings: S.result.findings, edits: S.edits, resolved: S.resolved || [] });
      const changes = Fix.changeLog(S.edits, allFindings());
      S.doc = Object.assign({ kind: 'pdf', name: correctedName(S.doc.name.replace(/ \(corrected v\d+\)/, ''), v), size: bytes.length, file: null, bytes, sha, sourceName: S.doc.sourceName || S.doc.name }, extracted, { pages });
      S.facts = Engine.analyze(S.doc.pages, S.form);
      const rc = Fix.recheck(S.result.findings, S.facts, S.doc.pages, S.form, S.edits);
      S.result = Object.assign({}, S.result, { findings: rc.findings, meta: Object.assign({}, S.result.meta, { version: v, recheck: 'deterministic', changes: (S.result.meta.changes || []).concat(changes.map((c) => Object.assign({ version: v }, c))) }) });
      S.resolved = (S.resolved || []).concat(rc.resolved);
      rc.resolved.forEach((f) => { S.responses[f.id] = { status: 'fixed', note: 'Resolved in v' + v + ': ' + f.resolved.how }; });
      S.version = v; S.edits = []; S.editing = null; S.correctedBytes = null; S.correctedDirty = false; S.active = null;
      S.sinceRound = S.resubmitOf ? carriedSince(S.resubmitOf, S.result.findings) : null;
      attachClaims({ claims: Deal.scan(S.doc.pages), source: 'scan' });
      renderViewer(); renderHead(); renderStatus(); renderRail();
      setStatus('');
      U.toast('Version ' + v + ' checked: ' + rc.resolved.length + ' point' + (rc.resolved.length === 1 ? '' : 's') + ' resolved, ' + rc.findings.length + ' open');
    } catch (e) { console.error(e); setStatus(''); U.toast('Could not re-check: ' + (e.message || e)); }
  }
  async function fullRerun() {
    if (!S.caps.sample || S.running) return;
    const keepResolved = S.resolved || [];
    S.result = null; S.steps = []; S.active = null; S.expanded = {}; S.ai = {}; S.responses = {}; S.ack = false; S.edits.forEach((e) => { e.fid = null; }); // the new run renumbers the points
    setStep('extract', { status: 'done', detail: S.doc.pages.length + ' pages read (version ' + S.version + ')' });
    setStep('blocks', { status: 'run' });
    S.facts = Engine.analyze(S.doc.pages, S.form);
    setStep('blocks', { status: 'done', detail: 'lane ' + S.facts.lane });
    renderHead(); renderRail();
    await runModel(true);
    S.resolved = keepResolved;
    if (S.result) S.result.meta.version = S.version;
    renderRail(); renderHead();
  }
  function readinessPill() {
    if (!S.result) return null;
    const r = Fix.readiness(allFindings(), S.viewing ? (S.viewing.responses || {}) : S.responses, { all: !!S.viewing });
    const p = el('span', { class: 'ready ' + r.band, title: r.open + ' open point' + (r.open === 1 ? '' : 's') });
    p.append(el('b', { text: String(r.score) }), document.createTextNode(' ' + r.label));
    return p;
  }
  function resolvedSection(body) {
    const list = (S.resolved || []).filter((f) => tierOfTab(f) === S.tab);
    if (!list.length) return;
    const d = el('details', { class: 'resolved', open: S.version > 1 ? '' : null });
    const sm = el('summary'); sm.append(svg('check'), document.createTextNode(list.length + ' point' + (list.length === 1 ? '' : 's') + ' resolved in this version'));
    d.append(sm);
    list.forEach((f) => { const row = el('div', { class: 'sub-item' }); row.append(el('span', { class: 'code', text: f.rule + (f.page ? ' · p. ' + f.page : '') }), document.createTextNode(' ' + f.title + ' · ' + (f.resolved ? f.resolved.how : 'fixed'))); d.append(row); });
    body.append(d);
  }
  function renderSummary(body, findings) {
    renderSteps(body);
    const r = S.result;
    if (!r) { if (!S.running) body.append(el('div', { class: 'empty', text: 'The summary is written at the end of the pre-review.' })); return; }
    if (S.viewing) renderSummaryDesk(body, findings, r); else renderSummaryBanker(body, findings, r);
  }
  function kvRow(label, value) {
    const row = el('div', { class: 'kvrow' });
    row.append(el('span', { class: 'k', text: label }), el('span', { class: 'v', text: value }));
    return row;
  }
  /* What the banker sees: their document in two lines, what Compliance will ask them, and the way out. Every
     detail (coverage map, brief, gut check, model calls) lives on the reviewer platform. */
  function renderSummaryBanker(body, findings, r) {
    const c = Review.counts(findings);
    const g = gateState();
    const st = el('div', { class: 'summary-card' });
    const h = el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:6px' });
    const ic = el('span', { style: 'display:inline-flex;color:' + (g.ok ? 'var(--success)' : 'var(--warn)') }); ic.append(svg(g.ok ? 'checkCircle' : 'alert'));
    h.append(ic, el('h4', { style: 'margin:0', text: g.ok ? 'Ready to submit' : 'Not ready to submit' }));
    st.append(h, el('p', { class: 'helper', style: 'margin:0', text: g.why }));
    if (S.caps.downloads) { const ex = el('button', { class: 'btn sm', type: 'button', style: 'margin-top:10px' }); ex.append(svg('download'), document.createTextNode('Export this summary as PDF')); ex.addEventListener('click', () => savePdf(currentSubmissionShape(), 'banker')); st.append(ex); }
    body.append(st);

    const doc = el('div', { class: 'summary-card' });
    doc.append(el('h4', { text: 'Your document' }));
    const p = r.profile || {};
    if (p.subject || p.material_kind) doc.append(el('p', { class: 'lede2', text: [p.material_kind ? p.material_kind.charAt(0).toUpperCase() + p.material_kind.slice(1) : '', p.subject].filter(Boolean).join(': ') }));
    doc.append(kvRow('File', S.doc.name + ' · ' + S.doc.pages.length + (S.doc.kind === 'pdf' ? ' pages' : S.doc.kind === 'image' ? ' image' : ' sections')));
    doc.append(kvRow('Type', Prompts.DOC_LABELS[S.form.docType] || S.form.docType));
    doc.append(kvRow('Audience', (S.facts.lane === 'institutional' ? 'Institutional' : 'Retail') + ' · ' + S.facts.laneReason));
    doc.append(kvRow('Distribution', (S.form.distribution || []).join(', ') || 'not stated'));
    body.append(doc);

    const ask = el('div', { class: 'summary-card' });
    ask.append(el('h4', { text: 'What Compliance will ask you' }));
    const highs = findings.filter((f) => f.severity === 'high' && Review.isCertain(f));
    if (!highs.length) ask.append(el('p', { class: 'helper', style: 'margin:0 0 6px', text: 'No high point to answer before you submit.' }));
    highs.forEach((f) => {
      const resp = S.responses[f.id] || { status: 'none' };
      const row = el('div', { class: 'askrow2' });
      const t = el('div', { class: 'grow' });
      t.append(el('div', { class: 't', text: f.title }));
      t.append(el('div', { class: 'm', text: (LABELS[f.rule] || f.category) + (f.page ? ' · p. ' + f.page : '') }));
      const chip = el('span', { class: 'tag ' + (resp.status !== 'none' ? 'ok' : 'high'), text: resp.status !== 'none' ? RESP[resp.status] : 'Answer needed' });
      const go = pageBtn(f);
      row.append(t, chip, go);
      row.addEventListener('click', (e) => { if (e.target.closest('button')) return; selectFinding(f, { scrollPage: true, scrollPanel: true }); });
      ask.append(row);
    });
    const others = c.certain - highs.length;
    const lines = [];
    if (others > 0) lines.push(others + ' further point' + (others === 1 ? '' : 's') + ' to read in the Compliance and Disclosures tabs (no answer required).');
    if (c.verify) lines.push(c.verify + ' further candidate' + (c.verify === 1 ? '' : 's') + ' the pre-review was not certain about ' + (c.verify === 1 ? 'goes' : 'go') + ' to the Finalis reviewer only; nothing for you to do.');
    lines.forEach((t) => ask.append(el('p', { class: 'helper', style: 'margin:8px 0 0', text: t })));
    body.append(ask);
    { const sr = sinceRoundCard(); if (sr) body.append(sr); }
    { const dc = dealCard(false); if (dc) body.append(dc); }

    const next = el('div', { class: 'summary-card' });
    next.append(el('h4', { text: 'When you submit' }));
    next.append(el('p', { class: 'helper', style: 'margin:0', text: 'Your document, these points, your answers and a machine-written brief go to the Finalis reviewer platform, a separate application you do not see. The reviewer checks the remaining candidates, then approves or requests changes; the decision comes back under My submissions. This pre-review is advisory: it is not an approval and it changes no status.' }));
    body.append(next);
    if (Calibration.isReferenceDeck(S.doc.pages) && !S.reference && S.caps.sample) {
      const b2 = el('button', { class: 'btn sm', type: 'button', text: 'Show the reference pre-review instead' });
      b2.addEventListener('click', () => { S.result = Fixture.build(S.facts, S.form, S.doc.pages); S.reference = true; S.calib = Calibration.score(S.result.findings); S.expanded = {}; S.ai = {}; finishRun(); });
      body.append(el('div', { style: 'padding:6px 4px' }, [b2]));
    }
  }
  /* What the reviewer platform sees: everything. */
  function renderSummaryDesk(body, findings, r) {
    const sub = S.viewing;
    const c = Review.counts(findings);
    { const so = secondOpinionCard(); if (so) body.append(so); }
    const st = el('div', { class: 'summary-card' });
    const h = el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:10px' });
    const ic = el('span', { style: 'display:inline-flex;color:var(--success)' }); ic.append(svg('checkCircle'));
    h.append(ic, el('h4', { style: 'margin:0', text: 'Submitted for review' }));
    st.append(h);
    if (S.caps.downloads) { const ex = el('button', { class: 'btn sm', type: 'button', style: 'margin:-4px 0 10px' }); ex.append(svg('download'), document.createTextNode('Export the full brief as PDF')); ex.addEventListener('click', () => savePdf(sub, 'desk')); st.append(ex); }
    const grid = el('div', { class: 'grid' });
    [['high', c.high, 'High'], ['medium', c.medium, 'Medium'], ['low', c.low, 'Low']].forEach(([k, n, l]) => { const s2 = el('div', { class: 'stat' }); s2.append(el('div', { class: 'n', style: 'color:var(--' + (k === 'high' ? 'danger' : k === 'medium' ? 'warn' : 'success') + ')', text: String(n) }), el('div', { class: 'l', text: l + ' risk' })); grid.append(s2); });
    st.append(grid);
    st.append(el('p', { class: 'helper', text: 'Required blocks ' + c.A + ' · triggered disclosures ' + c.B + ' · language ' + c.C + (r.suppressed && r.suppressed.length ? ' · ' + r.suppressed.length + ' candidates set aside' : '') }));
    if ((sub.round || 1) > 1) st.append(el('p', { class: 'helper', style: 'margin:0 0 6px', text: 'Round ' + sub.round + ' of this document: the banker resubmitted after the desk requested changes' + (sub.previous && sub.previous.decision && sub.previous.decision.by ? ' (' + sub.previous.decision.by + ', ' + U.fmtDate(sub.previous.decision.at) + ')' : '') + '.' }));
    { const tl = el('div', { class: 'gc', style: 'padding-top:8px' }); tl.append(el('h5', { text: 'Timeline' }), timelineBlock(sub)); st.append(tl); }
    if (!r.meta.deterministicOnly) {
      const a = el('div', { class: 'gc', style: 'padding-top:8px' });
      a.append(el('span', { class: 'tag ok', text: String(c.certain) }), el('span', { html: '<b style="font-weight:500">asserted to the banker</b> <span style="color:var(--text-3)">deterministic checks and points confirmed by the second pass with a verbatim quote located on the page</span>' }));
      const b = el('div', { class: 'gc' });
      b.append(el('span', { class: 'tag vtag', text: String(c.verify) }), el('span', { html: '<b style="font-weight:500">to verify</b> <span style="color:var(--text-3)">candidates the pre-review was not certain about; the banker did not see them</span>' }));
      st.append(a, b);
    }
    body.append(st);
    // the banker's side of the exchange
    const bk = el('div', { class: 'summary-card' });
    bk.append(el('h4', { text: 'What the banker saw and answered' }));
    const answered = Object.keys(sub.responses || {}).filter((k) => sub.responses[k].status !== 'none').length;
    const highs = findings.filter((f) => f.severity === 'high' && Review.isCertain(f)).length;
    bk.append(kvRow('Submitted by', (sub.submitter || 'unknown') + (sub.form && sub.form.bankName ? ' · ' + sub.form.bankName : '')));
    bk.append(kvRow('Asked to answer', highs + ' high point' + (highs === 1 ? '' : 's')));
    bk.append(kvRow('Answered', answered + ' point' + (answered === 1 ? '' : 's')));
    if (sub.form && sub.form.notes) bk.append(kvRow('Banker notes', sub.form.notes));
    body.append(bk);
    { const sr = sinceRoundCard(); if (sr) body.append(sr); }
    { const dc = dealCard(true); if (dc) body.append(dc); }
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
    if (r.brief) { const b = el('div', { class: 'summary-card' }); b.append(el('h4', { text: 'Brief' }), el('div', { class: 'brief', text: r.brief })); body.append(b); }
    if (r.banker_message) { const b = el('div', { class: 'summary-card' }); b.append(el('h4', { text: 'Comment to the banker' }), copyBox('Ready to paste', r.banker_message)); body.append(b); }
    if (r.meta && r.meta.learning) { const L = r.meta.learning; body.append(el('div', { class: 'helper', style: 'padding:0 4px 6px', text: 'Learning applied to this pre-review: ' + L.rules + ' learned rule' + (L.rules === 1 ? '' : 's') + (L.reviewerRules ? ' (' + L.reviewerRules + ' from the reviewer this goes to)' : '') + ', ' + L.precedents + ' precedent' + (L.precedents === 1 ? '' : 's') + ' out of ' + (L.verdicts || 0) + ' reviewer verdict' + (L.verdicts === 1 ? '' : 's') + (L.reviewer ? ', adapted to ' + L.reviewer : '') + '.' })); }
    if (r.meta && r.meta.calls && r.meta.calls.length) body.append(el('div', { class: 'helper', style: 'padding:0 4px', text: 'Model calls: ' + r.meta.calls.map((x) => x.pass + (x.batch ? ' ' + x.batch : '') + ' ' + Math.round(x.ms / 1000) + ' s, ' + Math.round(x.bytes / 1024) + ' KB' + (x.images ? ', ' + x.images + ' images' : '')).join(' · ') }));
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
    if (S.edits.length) return { ok: false, why: S.edits.length + ' correction' + (S.edits.length === 1 ? '' : 's') + ' placed in the document: re-check the corrected version (or remove them) before submitting, so the reviewer receives the corrected file.' };
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
    const prev = S.resubmitOf;
    return {
      id: S.submission ? S.submission.id : 'draft', created_at: new Date().toISOString(), status: 'draft', submitter: S.form.submitter || '',
      file: { name: S.doc.name, size: S.doc.size, sha: S.doc.sha, pages: S.doc.pages.length, kind: S.doc.kind },
      form: S.form, lane: S.facts.lane, facts: { lane: S.facts.lane, laneReason: S.facts.laneReason },
      result: { profile: S.result.profile, suppressed: S.result.suppressed, gut_check: S.result.gut_check, brief: S.result.brief, banker_message: S.result.banker_message, meta: S.result.meta },
      findings: S.result.findings, responses: S.responses,
      claims: S.result.claims || [], consistency: S.result.consistency || null,
      round: prev ? (prev.round || 1) + 1 : 1, thread: prev ? (prev.thread || prev.id) : null,
      previous: prev ? { id: prev.id, round: prev.round || 1, created_at: prev.created_at, status: prev.status, decision: prev.decision ? { kind: prev.decision.kind, message: prev.decision.message || '', by: prev.decision.by || '', at: prev.decision.at } : null, since: S.sinceRound ? { of: S.sinceRound.of, resolved: S.sinceRound.resolved, open: S.sinceRound.open } : null } : null,
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
    sub.version = S.version; sub.changes = (S.result.meta && S.result.meta.changes) || [];
    sub.resolved = (S.resolved || []).map((f) => ({ id: f.id, rule: f.rule, title: f.title, page: f.page || null, how: f.resolved ? f.resolved.how : 'fixed', version: f.resolved ? f.resolved.version : S.version }));
    sub.original = S.history && S.history.length ? { name: S.history[0].doc.name, sha: S.history[0].doc.sha, pages: S.history[0].doc.pages.length } : null;
    sub.readiness = Fix.readiness(S.result.findings, S.responses, { all: false });
    sub.submitted_by = S.user ? { name: S.user.name, email: S.user.email, firm: S.user.firm } : null;
    // rounds: a resubmission after a request for changes keeps the thread and carries what was resolved since (shape set by currentSubmissionShape)
    const prev = S.resubmitOf;
    sub.thread = sub.thread || id;
    if (S.doc.kind === 'pdf' && S.doc.bytes) DOC_CACHE.set(S.doc.sha, { pages: S.doc.pages, pdf: S.doc.pdf, bytes: S.doc.bytes, name: S.doc.name });
    (S.history || []).forEach((h) => { if (h.doc && h.doc.sha && h.doc.kind === 'pdf') DOC_CACHE.set(h.doc.sha, { pages: h.doc.pages, pdf: h.doc.pdf, bytes: h.doc.bytes, name: h.doc.name }); });
    if (S.caps.assets && S.doc.kind === 'pdf' && S.doc.bytes) {
      try { const file = S.doc.file || new File([S.doc.bytes], S.doc.name, { type: 'application/pdf' }); const up = await S.caps.assets.upload(file, { type: 'application/pdf' }); sub.file.assetId = up.id; sub.file.assetUrl = up.url || ('/_blob/' + up.id); } catch (e) { console.warn('asset upload failed', e); }
    }
    const to = (S.settings && S.settings.reviewerEmail) || '';
    const msg = Notify.compose(sub);
    sub.notification = { to, subject: msg.subject, body: msg.body, sent_at: new Date().toISOString() };
    const saved = await Store.saveSubmission(sub);
    if (prev) { try { await Store.updateSubmission(prev.id, { superseded_by: id }); } catch (e) { console.warn('previous round not linked', e); } }
    S.submission = sub;
    renderDone(sub, saved.mode);
    show('done');
    renderChrome();
    U.toast(prev ? 'Round ' + sub.round + ' submitted · the reviewer is notified' : 'Submitted · feedback sent to the reviewer');
  }
  function renderDone(sub, mode) {
    const card = $('done-card');
    card.innerHTML = '';
    const c = Review.counts(sub.findings);
    const answered = Object.keys(sub.responses).filter((k) => sub.responses[k].status !== 'none').length;
    const ic = el('div', { class: 'done-ic' }); ic.append(svg('checkCircle'));
    card.append(ic, el('h1', { style: 'font-size:20px;margin-bottom:6px', text: (sub.round || 1) > 1 ? 'Round ' + sub.round + ' sent to Finalis Compliance' : 'Sent to Finalis Compliance' }));
    card.append(el('p', { class: 'lede', text: sub.file.name + ' · ' + (sub.lane === 'institutional' ? 'Institutional' : 'Retail') + ' · ' + c.certain + ' attention point' + (c.certain === 1 ? '' : 's') + ', ' + answered + ' answered' + (c.verify ? ' · ' + c.verify + ' possible point' + (c.verify === 1 ? '' : 's') + ' left to the reviewer' : '') + '.' + (sub.readiness ? ' Readiness ' + sub.readiness.score + '/100.' : '') }));
    if ((sub.version || 1) > 1) card.append(el('p', { class: 'helper', style: 'margin:-6px 0 12px', text: 'You submitted version ' + sub.version + ', corrected in the app: ' + (sub.changes || []).length + ' change' + ((sub.changes || []).length === 1 ? '' : 's') + ', ' + (sub.resolved || []).length + ' point' + ((sub.resolved || []).length === 1 ? '' : 's') + ' resolved before submission. The reviewer sees the corrections outlined on the pages and can compare with the original.' }));
    if (sinceOf(sub)) card.append(el('p', { class: 'helper', style: 'margin:-6px 0 12px', text: 'Since round ' + (sub.previous.round || 1) + ': ' + sinceOf(sub).resolved.length + ' of ' + sinceOf(sub).of + ' point' + (sinceOf(sub).of === 1 ? '' : 's') + ' resolved, ' + sinceOf(sub).open.length + ' still open. The reviewer sees both rounds side by side.' }));
    const n = el('div', { class: 'note green', style: 'margin-bottom:16px' });
    n.append(svg('inbox'), el('span', { class: 'grow', text: 'The Finalis reviewer' + (sub.notification.to ? ' (' + sub.notification.to + ')' : '') + ' received your document, the pre-review, your answers and the brief' + (mode === 'shared' ? '.' : ' (in this browser\'s demo inbox; open this page in the Claude app to reach the shared inbox).') + ' The reviewer platform is a separate application: you will hear back from the reviewer, not from this page.' }));
    card.append(n);
    const steps = el('div', { class: 'nextsteps' });
    [['1', 'The reviewer checks the remaining candidates', c.verify ? c.verify + ' candidate' + (c.verify === 1 ? '' : 's') + ' the pre-review was not certain about ' + (c.verify === 1 ? 'goes' : 'go') + ' to the reviewer only.' : 'Nothing was left for the reviewer to verify on this document.'], ['2', 'The reviewer reads your answers', answered + ' answer' + (answered === 1 ? '' : 's') + ' travel with the submission.'], ['3', 'Approval or a request for changes', 'Comes back under My submissions on this platform, with the reviewer\'s message; a request for changes reopens the document here for the next round. This pre-review is advisory and is not an approval.']].forEach(([k, t, d]) => { const row = el('div'); row.append(el('span', { text: k }), el('div', { html: '<b>' + U.esc(t) + '</b><br>' + U.esc(d) })); steps.append(row); });
    card.append(el('div', { class: 'label', text: 'What happens next' }), steps);
    const row = el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;margin-top:18px;align-items:center' });
    const again = el('button', { class: 'btn primary', type: 'button', text: 'New submission' });
    again.addEventListener('click', () => { resetForm(); show('form'); });
    const mine = el('button', { class: 'btn', type: 'button', text: 'My submissions' });
    mine.addEventListener('click', () => renderMine());
    row.append(again, mine);
    if (S.caps.downloads && S.doc && S.doc.kind === 'pdf' && S.doc.bytes && (sub.version || 1) > 1) { const cp = el('button', { class: 'btn', type: 'button' }); cp.append(svg('download'), document.createTextNode('Corrected PDF (v' + sub.version + ')')); cp.addEventListener('click', () => S.caps.downloads.save({ filename: S.doc.name, data: S.doc.bytes })); row.append(cp); }
    { const ob = officeButtons(); if (ob) { ob.style.marginTop = '0'; row.append(ob); } }
    if (S.caps.downloads) { const ex = el('button', { class: 'btn', type: 'button' }); ex.append(svg('download'), document.createTextNode('Download my summary (PDF)')); ex.addEventListener('click', () => savePdf(sub, 'banker')); row.append(ex); }
    row.append(el('span', { style: 'flex:1' }));
    if (!lockedPlatforms()) { const inbox = el('button', { class: 'btn ghost', type: 'button', text: 'Open the reviewer platform (demo)' }); inbox.addEventListener('click', () => setMode('reviewer')); row.append(inbox); }
    card.append(row);
  }

  /* ---------- banker platform: my submissions and the next round ---------- */
  function loadSeen() { try { const v = JSON.parse(localStorage.getItem('prescreen.seen') || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
  function saveSeen() { try { localStorage.setItem('prescreen.seen', JSON.stringify(S.seen || {})); } catch (e) { /* storage unavailable */ } }
  function mineList() {
    const email = S.user && S.user.email ? String(S.user.email).toLowerCase() : '';
    if (!email) return [];
    return S.inbox.filter((x) => x && x.submitted_by && x.submitted_by.email && String(x.submitted_by.email).toLowerCase() === email).slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }
  /* decisions the banker has not opened yet (per browser) */
  function unseenDecisions() { return mineList().filter((x) => x.decision && x.decision.at && (S.seen || {})[x.id] !== x.decision.at); }
  const MINE_STATUS = { submitted: 'With the reviewer', changes: 'Changes requested', approved: 'Approved', escalated: 'Escalated to the CCO' };
  function renderMine() { S.viewing = null; show('mine'); renderMineList(); }
  /* back to whatever the banker was doing: the confirmation, the workspace, or the form */
  function leaveMine() { if (S.submission) show('done'); else if (S.doc && S.phase !== 'landing') { show('work'); renderWorkspace(); } else show('form'); }
  function renderMineList() {
    const list = $('mine-list'); list.innerHTML = '';
    const mine = mineList();
    const k = $('mine-kpis'); k.innerHTML = '';
    const open = mine.filter((x) => x.status === 'submitted').length; const approved = mine.filter((x) => x.status === 'approved').length; const changes = mine.filter((x) => x.status === 'changes').length;
    const avg = mine.length ? Math.round(mine.reduce((n, x) => n + subReadiness(x).score, 0) / mine.length) : null;
    [[mine.length, 'sent'], [open, 'with the reviewer'], [changes, 'changes requested'], [approved, 'approved'], [avg === null ? '–' : avg, 'average readiness']].forEach(([v, l]) => { const c = el('div', { class: 'kpi' }); c.append(el('b', { text: String(v) }), el('span', { text: l })); k.append(c); });
    const head = el('div', { class: 'mrow h' });
    ['Document', 'Submitted', 'Status', 'From the reviewer', ''].forEach((t) => head.append(el('span', { text: t })));
    list.append(head);
    if (!mine.length) { list.append(el('div', { class: 'empty', text: 'Nothing sent yet from this sign-in. Submit a document and it appears here with the reviewer\'s decision.' })); return; }
    const unseen = new Set(unseenDecisions().map((x) => x.id));
    mine.forEach((sub) => {
      const row = el('div', { class: 'mrow' + (unseen.has(sub.id) ? ' unseen' : '') });
      const d = el('div'); const t = el('div', { class: 't', text: sub.file.name });
      if ((sub.version || 1) > 1) t.append(el('span', { class: 'vbadge', text: 'v' + sub.version }));
      if ((sub.round || 1) > 1) t.append(el('span', { class: 'rbadge', text: 'Round ' + sub.round }));
      const c = Review.counts(sub.findings || []); const rd = subReadiness(sub);
      d.append(t, el('div', { class: 's', text: (sub.lane === 'institutional' ? 'Institutional' : 'Retail') + ' · ' + c.certain + ' point' + (c.certain === 1 ? '' : 's') + ' · readiness ' + rd.score + (sub.superseded_by ? ' · superseded by a later round' : '') }));
      const when = el('div', { class: 's', text: U.fmtDate(sub.created_at) });
      const status = el('span', { class: 'tag ' + (STATUS_TAG[sub.status] || 'info'), text: MINE_STATUS[sub.status] || 'With the reviewer' });
      const msg = el('div', { class: 'msg', text: sub.decision ? (sub.decision.message ? sub.decision.message : (STATUS_LABEL[sub.status] || 'Decided') + ' by ' + (sub.decision.by || 'the reviewer') + ', no message') : 'The reviewer has not decided yet.' });
      const acts = el('div', { class: 'acts' });
      const det = el('button', { class: 'btn sm', type: 'button', text: 'Details' }); det.addEventListener('click', () => openMineDetails(sub)); acts.append(det);
      if (S.caps.downloads) { const pdf = el('button', { class: 'btn sm', type: 'button', title: 'Download the summary as PDF' }); pdf.append(svg('download'), document.createTextNode('PDF')); pdf.addEventListener('click', () => savePdf(sub, 'banker')); acts.append(pdf); }
      if (sub.status === 'changes' && !sub.superseded_by) { const rs = el('button', { class: 'btn sm primary', type: 'button', text: 'Correct and resubmit' }); rs.addEventListener('click', () => resubmit(sub)); acts.append(rs); }
      row.append(d, when, status, msg, acts);
      list.append(row);
    });
    // opening the list is how a decision is marked as seen
    mine.forEach((x) => { if (x.decision && x.decision.at) S.seen[x.id] = x.decision.at; });
    saveSeen(); renderChrome();
  }
  function openMineDetails(sub) {
    openDialog(sub.file.name + ' · ' + (MINE_STATUS[sub.status] || 'With the reviewer'), (body) => {
      if (sub.decision) { body.append(el('h3', { text: (STATUS_LABEL[sub.status] || 'Decision') + ' by ' + (sub.decision.by || 'the reviewer') + ' · ' + U.fmtDate(sub.decision.at) })); body.append(el('div', { class: 'mailpreview', text: sub.decision.message || 'No message was attached to the decision.' })); }
      else body.append(el('p', { text: 'Submitted ' + U.fmtDate(sub.created_at) + '. The reviewer has not decided yet; you will see the decision here.' }));
      const verdicts = sub.verdicts || {};
      const stood = (sub.findings || []).filter((f) => (Review.isCertain(f) && !(verdicts[f.id] && verdicts[f.id].verdict === 'incorrect')) || (verdicts[f.id] && verdicts[f.id].verdict === 'correct'));
      if (sub.decision && stood.length) { body.append(el('h3', { text: 'Points that stood (' + stood.length + ')' })); stood.forEach((f) => body.append(el('div', { class: 'rb', html: '<b>' + U.esc(f.rule + (f.page ? ' · p. ' + f.page : '') + ' · ' + f.title) + '</b>' + U.esc(f.text_to_add ? 'Add: ' + f.text_to_add.slice(0, 240) : f.rewrite ? 'Rewrite: ' + f.rewrite.slice(0, 240) : f.issue || '') + (verdicts[f.id] && verdicts[f.id].reason ? '<div class="m" style="margin-top:4px;color:var(--text-3)">Reviewer: ' + U.esc(verdicts[f.id].reason.slice(0, 240)) + '</div>' : '') }))); }
      if (sinceOf(sub)) body.append(el('p', { text: 'Round ' + (sub.round || 2) + ': ' + sinceOf(sub).resolved.length + ' of ' + sinceOf(sub).of + ' earlier points resolved, ' + sinceOf(sub).open.length + ' still open at submission.' }));
      body.append(el('h3', { text: 'Timeline' }), timelineBlock(sub));
    });
  }
  /* the next round: reopen the document with the reviewer's message, correct it in the app, run the pre-review again, submit */
  let resubmitBusy = false;
  async function resubmit(sub) {
    if (S.mode !== 'banker' || resubmitBusy) return;
    resubmitBusy = true;
    try { await reopen(sub); } finally { resubmitBusy = false; }
  }
  async function reopen(sub) {
    let doc = null;
    const cached = DOC_CACHE.get(sub.file.sha);
    if (cached && cached.bytes) doc = { kind: 'pdf', name: sub.file.name, size: cached.bytes.length, sha: sub.file.sha, file: new File([cached.bytes], sub.file.name, { type: 'application/pdf' }), pages: cached.pages, pdf: cached.pdf, bytes: cached.bytes };
    else if (sub.file.assetId && sub.file.kind === 'pdf') {
      try { const res = await fetch(sub.file.assetUrl || ('/_blob/' + sub.file.assetId)); if (res.ok) { const bytes = new Uint8Array(await res.arrayBuffer()); const ex = await Extract.pdf(bytes); doc = Object.assign({ kind: 'pdf', name: sub.file.name, size: bytes.length, sha: sub.file.sha, file: new File([bytes], sub.file.name, { type: 'application/pdf' }), bytes }, ex); DOC_CACHE.set(sub.file.sha, { pages: ex.pages, pdf: ex.pdf, bytes, name: sub.file.name }); } } catch (e) { console.warn('file not reopened', e); }
    }
    resetForm();
    S.resubmitOf = { id: sub.id, thread: sub.thread || sub.id, round: sub.round || 1, created_at: sub.created_at, status: sub.status, decision: sub.decision || null, findings: sub.findings || [], verdicts: sub.verdicts || {}, file: sub.file };
    const f = sub.form || {};
    $('doc-type').value = f.docType || 'deal-deck'; $('doc-type-hint').textContent = DOC_HINTS[$('doc-type').value] || '';
    document.querySelectorAll('#dist-menu input').forEach((i) => { i.checked = (f.distribution || []).includes(i.value); });
    renderDistLabel();
    $('involved').value = f.involvement || ''; $('notes').value = f.notes || ''; $('notes-count').textContent = String((f.notes || '').length);
    S.prefill = { audience: f.audience || '', bankName: f.bankName || '', submitter: f.submitter || '' };
    renderRoundChip();
    if (!doc) { show('form'); updateSubmit(); U.toast('The file is not stored here: upload the corrected version'); return; }
    S.doc = doc; renderFileChip(); updateSubmit();
    await submitLanding();
    U.toast('Round ' + ((sub.round || 1) + 1) + ' · run the pre-review, then correct the document in the app');
  }

  /* ---------- reviewer inbox ---------- */
  async function openSubmission(sub) {
    S.viewing = sub; S.result = null; S.tab = 'disclosures'; S.filter = 'all'; S.active = null; S.expanded = {}; S.ai = {}; S.zoom = 1; S.page = 1;
    show('work');
    $('wh-title').textContent = sub.file.name;
    let pages = null; let pdf = null;
    if (DOC_CACHE.has(sub.file.sha)) { const c = DOC_CACHE.get(sub.file.sha); pages = c.pages; pdf = c.pdf; }
    else if (S.doc && S.doc.sha && S.doc.sha === sub.file.sha) { pages = S.doc.pages; pdf = S.doc.pdf; }
    else if (S.stash && S.stash.doc && S.stash.doc.sha === sub.file.sha) { pages = S.stash.doc.pages; pdf = S.stash.doc.pdf; }
    else if (sub.file.assetId) {
      try { const res = await fetch(sub.file.assetUrl || ('/_blob/' + sub.file.assetId)); if (res.ok) { const bytes = new Uint8Array(await res.arrayBuffer()); const ex = await Extract.pdf(bytes); pages = ex.pages; pdf = ex.pdf; } } catch (e) { console.warn('asset fetch failed', e); }
    }
    if (!pages) {
      pages = [Extract.pageFromText(1, 'The document itself was not stored with this submission (' + sub.file.name + ', ' + sub.file.pages + ' pages). The attention points quote the passages; open the file in the case to see them in place.')];
      S.doc = { kind: 'text', name: sub.file.name, pages, pdf: null, sha: sub.file.sha };
    } else S.doc = { kind: pdf ? 'pdf' : 'text', name: sub.file.name, pages, pdf, sha: sub.file.sha };
    S.form = sub.form;
    S.version = sub.version || 1; S.changes = sub.changes || []; S.edits = []; S.editing = null; S.showOriginal = false; S.chat = []; S.focus = null; S.decisionDraft = undefined; if ($('chatdock')) chatOpen(false);
    S.resolved = (sub.resolved || []).map((r) => ({ id: r.id, rule: r.rule, tier: (r.rule || 'C').charAt(0), title: r.title, page: r.page, resolved: { how: r.how, version: r.version } }));
    S.originalDoc = sub.original && DOC_CACHE.has(sub.original.sha) ? Object.assign({ kind: 'pdf', name: sub.original.name, sha: sub.original.sha }, DOC_CACHE.get(sub.original.sha)) : null;
    S.facts = Engine.analyze(pages, sub.form);
    const findings = JSON.parse(JSON.stringify(sub.findings || []));
    Review.attachBoxes(findings, pages);
    S.result = { profile: sub.result.profile, findings, suppressed: sub.result.suppressed || [], gut_check: sub.result.gut_check, brief: sub.result.brief, banker_message: sub.result.banker_message, meta: sub.result.meta || {} };
    S.steps = []; S.reference = !!(sub.result.meta && sub.result.meta.reference);
    S.calib = Calibration.isReferenceDeck(pages) && !(sub.result.meta && sub.result.meta.deterministicOnly) ? Calibration.score(findings) : null;
    S.memory = null; S.secondOpinion = sub.secondOpinion && Array.isArray(sub.secondOpinion.points) ? Object.assign({}, sub.secondOpinion, { busy: false }) : null;
    S.sinceRound = sinceOf(sub) ? Object.assign({ round: sub.previous.round || 1 }, sinceOf(sub)) : null;
    if (Array.isArray(sub.claims)) { S.result.claims = sub.claims; S.result.consistency = Deal.consistency(sub, sub.claims, S.inbox); } // desk-wide view for this session; the stored record keeps what the banker saw
    renderViewer(); renderHead(); renderStatus(); renderRail();
    refreshMemory(false);
  }
  /* ---------- reviewer platform: queue ---------- */
  const STATUS_LABEL = { submitted: 'New', changes: 'Changes requested', approved: 'Approved', escalated: 'Escalated' };
  const STATUS_TAG = { submitted: 'info', changes: 'medium', approved: 'ok', escalated: 'esc' };
  function subReadiness(sub) { return sub.readiness || Fix.readiness(sub.findings || [], sub.responses || {}, { all: false }); }
  function pendingCount(sub) { return (sub.findings || []).filter((f) => !Review.isCertain(f) && !(sub.verdicts && sub.verdicts[f.id] && sub.verdicts[f.id].verdict)).length; }
  function inboxRows() {
    const q = (S.inboxQuery || '').trim().toLowerCase();
    const flt = S.inboxFilter || 'all';
    let rows = S.inbox.filter((sub) => {
      if (flt === 'new' && sub.status !== 'submitted') return false;
      if (flt === 'verify' && !pendingCount(sub)) return false;
      if (flt === 'changes' && sub.status !== 'changes') return false;
      if (flt === 'approved' && sub.status !== 'approved') return false;
      if (flt === 'escalated' && sub.status !== 'escalated') return false;
      if (q) { const hay = [sub.file && sub.file.name, sub.submitter, sub.form && sub.form.bankName, sub.lane].join(' ').toLowerCase(); if (!hay.includes(q)) return false; }
      return true;
    });
    const sort = S.inboxSort || 'priority';
    const weight = { submitted: 0, escalated: 1, changes: 2, approved: 3 };
    rows = rows.slice().sort((a, b) => {
      if (sort === 'newest') return (b.created_at || '').localeCompare(a.created_at || '');
      if (sort === 'readiness') return subReadiness(a).score - subReadiness(b).score;
      const w = (weight[a.status] || 0) - (weight[b.status] || 0); if (w) return w;
      const r = subReadiness(a).score - subReadiness(b).score; if (r) return r;
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
    return rows;
  }
  function renderInbox() {
    const list = $('inbox-list');
    list.innerHTML = '';
    $('store-status').textContent = Store.status() === 'shared' ? 'Shared inbox: every reviewer sees it.' : 'Private inbox in this browser. Open the page in the Claude app for the shared inbox.';
    // KPIs
    const k = $('inbox-kpis'); k.innerHTML = '';
    const all = S.inbox; const fresh = all.filter((s) => s.status === 'submitted').length; const toVerify = all.reduce((n, s) => n + pendingCount(s), 0);
    const decided = all.filter((s) => s.status !== 'submitted').length; const corrected = all.filter((s) => (s.version || 1) > 1).length;
    const avg = all.length ? Math.round(all.reduce((n, s) => n + subReadiness(s).score, 0) / all.length) : null;
    [[fresh, 'new submission' + (fresh === 1 ? '' : 's')], [toVerify, 'point' + (toVerify === 1 ? '' : 's') + ' to verify'], [corrected, 'corrected in the app before submission'], [avg === null ? '–' : avg, 'average readiness at submission'], [decided, 'decided']].forEach(([v, l]) => { const c = el('div', { class: 'kpi' }); c.append(el('b', { text: String(v) }), el('span', { text: l })); k.append(c); });
    // filters
    const fl = $('inbox-filters'); fl.innerHTML = '';
    [['all', 'All'], ['new', 'New'], ['verify', 'To verify'], ['changes', 'Changes requested'], ['approved', 'Approved'], ['escalated', 'Escalated']].forEach(([key, label]) => {
      const b = el('button', { type: 'button', 'aria-pressed': String((S.inboxFilter || 'all') === key), text: label });
      b.addEventListener('click', () => { S.inboxFilter = key; renderInbox(); });
      fl.append(b);
    });
    if (!$('inbox-sort').dataset.bound) { $('inbox-sort').dataset.bound = '1'; $('inbox-sort').addEventListener('change', () => { S.inboxSort = $('inbox-sort').value; renderInbox(); }); $('inbox-search').addEventListener('input', () => { S.inboxQuery = $('inbox-search').value; renderInbox(); }); }
    const head = el('div', { class: 'trow h' });
    ['Document', 'Submitted by', 'Lane', 'Readiness', 'Points', 'Status', ''].forEach((t) => head.append(el('span', { text: t })));
    list.append(head);
    const rows = inboxRows();
    if (!S.inbox.length) { list.append(el('div', { class: 'empty', text: 'No submissions yet. Submit a pre-reviewed document as a banker to see it here.' })); return; }
    if (!rows.length) { list.append(el('div', { class: 'empty', text: 'Nothing matches this filter.' })); return; }
    rows.forEach((sub) => {
      const c = Review.counts(sub.findings || []);
      const row = el('div', { class: 'trow' });
      const d = el('div'); const t = el('div', { class: 't', text: sub.file.name }); if ((sub.version || 1) > 1) t.append(el('span', { class: 'vbadge', text: 'v' + sub.version + ' · ' + (sub.changes || []).length + ' edits' })); if ((sub.round || 1) > 1) t.append(el('span', { class: 'rbadge', text: 'Round ' + sub.round })); d.append(t, el('div', { class: 's', text: U.fmtDate(sub.created_at) + ' · ' + (sub.file.pages || 0) + ' p.' + (sub.resolved && sub.resolved.length ? ' · ' + sub.resolved.length + ' resolved before submission' : '') + (sinceOf(sub) ? ' · since round ' + (sub.previous.round || 1) + ': ' + sinceOf(sub).resolved.length + ' of ' + sinceOf(sub).of + ' resolved' : '') + (sub.superseded_by ? ' · superseded by a later round' : '') }));
      const by = el('div'); by.append(el('div', { text: sub.submitter || 'unknown', style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }), el('div', { class: 's', text: sub.form && sub.form.bankName ? sub.form.bankName : '' }));
      const lane = el('span', { class: 'tag grey', text: sub.lane === 'institutional' ? 'Institutional' : 'Retail' });
      const rd = subReadiness(sub); const rp = el('span', { class: 'ready ' + rd.band }); rp.append(el('b', { text: String(rd.score) }), document.createTextNode(' ' + rd.label));
      const pts = el('div', { class: 'pts' });
      pts.append(el('span', { class: 'tag high', text: String(c.high) }), el('span', { class: 'tag medium', text: String(c.medium) }), el('span', { class: 'tag low', text: String(c.low) }));
      const pc = pendingCount(sub); if (pc) pts.append(el('span', { class: 'tv', text: pc + ' to verify' }));
      const status = el('span', { class: 'tag ' + (STATUS_TAG[sub.status] || 'info'), text: STATUS_LABEL[sub.status] || 'New' });
      const acts = el('div', { class: 'acts' });
      const fb = el('button', { class: 'btn sm', type: 'button', text: 'Feedback' });
      fb.addEventListener('click', () => openDialog('Feedback sent to the reviewer', (body) => { body.append(el('div', { class: 'mailpreview', text: 'Subject: ' + sub.notification.subject + '\n\n' + sub.notification.body })); }));
      const open = el('button', { class: 'btn sm primary', type: 'button', text: 'Open' });
      open.addEventListener('click', () => openSubmission(sub));
      if (S.caps.downloads) { const pdf = el('button', { class: 'btn sm', type: 'button', title: 'Export the brief as PDF' }); pdf.append(svg('download'), document.createTextNode('PDF')); pdf.addEventListener('click', () => savePdf(sub, 'desk')); acts.append(pdf); }
      acts.append(fb, open);
      row.append(d, by, lane, rp, pts, status, acts);
      list.append(row);
    });
  }
  /* ---------- reviewer platform: decision bar ---------- */
  async function recordDecision(sub, kind, message) {
    const by = S.user ? S.user.name : 'Finalis reviewer';
    const at = new Date().toISOString();
    const entry = { at, by, event: kind, message: message || '' };
    sub.status = kind === 'approve' ? 'approved' : kind === 'escalate' ? 'escalated' : 'changes';
    sub.decision = { kind, message: message || '', by, at };
    sub.history = (sub.history || []).concat([entry]);
    await Store.updateSubmission(sub.id, { status: sub.status, decision: sub.decision, history: sub.history });
    U.toast(kind === 'approve' ? 'Approved · the banker is notified' : kind === 'escalate' ? 'Escalated to the CCO' : 'Changes requested · the banker is notified');
    renderGate(); renderRail();
    try { await Learn.recordDecision(sub, kind, message, S.user); } catch (e) { console.warn('decision not recorded', e); }
    autoDigest();
  }
  /* after each decision the digest reads the new comments and verdicts and updates the learned rules */
  let digestBusy = false;
  async function autoDigest() {
    if (!S.caps.sample || digestBusy) return;
    digestBusy = true;
    try { const r = await Learn.digest(S.caps.sample); if (r.changed) U.toast('Learning: ' + r.changed + ' rule' + (r.changed === 1 ? '' : 's') + ' learned from the reviewers\' comments'); }
    catch (e) { console.warn('digest failed', e); }
    finally { digestBusy = false; }
  }
  function renderReviewerGate(g) {
    const sub = S.viewing;
    g.hidden = false;
    g.innerHTML = '';
    const verdicts = Object.values(sub.verdicts || {}).filter((v) => v && v.verdict).length;
    const pending = pendingCount(sub);
    const wrap = el('div', { class: 'decision' });
    const why = el('div', { class: 'why' });
    why.textContent = (pending ? pending + ' point' + (pending === 1 ? '' : 's') + ' awaiting your verification · ' : 'Every pending point verified · ') + verdicts + ' verdict' + (verdicts === 1 ? '' : 's') + ' recorded';
    wrap.append(why);
    if (pending && !S.focus) { const fb = el('button', { class: 'btn sm', type: 'button', style: 'align-self:flex-start' }); fb.append(svg('spark'), document.createTextNode('Verify one by one (keyboard)')); fb.addEventListener('click', () => startFocus()); wrap.append(fb); }
    if (sub.decision) { const dd = el('div', { class: 'decided' }); dd.append(svg('checkCircle'), el('span', { html: '<b>' + U.esc(STATUS_LABEL[sub.status] || sub.status) + '</b> by ' + U.esc(sub.decision.by || '') + ' · ' + U.esc(U.fmtDate(sub.decision.at)) })); if (sub.status === 'approved' && S.caps.sample && S.doc && S.doc.kind !== 'text' && !(S.secondOpinion && !S.secondOpinion.busy)) { const so = el('button', { class: 'btn xs', type: 'button', style: 'margin-left:auto', id: 'btn-second' }); so.append(svg('spark'), document.createTextNode(S.secondOpinion && S.secondOpinion.busy ? 'Reading…' : 'Second opinion')); so.disabled = !!(S.secondOpinion && S.secondOpinion.busy); so.addEventListener('click', () => runSecondOpinion(sub)); dd.append(so); } wrap.append(dd); }
    const ta = el('textarea', { id: 'decision-msg', placeholder: 'Message to the banker (drafted by Claude from your verdicts, or write your own)' });
    ta.value = S.decisionDraft !== undefined ? S.decisionDraft : (sub.decision && sub.decision.message) || '';
    ta.addEventListener('input', () => { S.decisionDraft = ta.value; });
    wrap.append(ta);
    const row = el('div', { class: 'row' });
    if (S.caps.sample) {
      const draft = el('button', { class: 'btn sm', type: 'button' }); draft.append(svg('spark'), document.createTextNode('Draft with Claude'));
      draft.addEventListener('click', async () => {
        const kind = pending ? 'changes' : (Review.counts(sub.findings || []).certain ? 'changes' : 'approve');
        draft.disabled = true; ta.value = 'Drafting…';
        try { const txt = await Ask.decision(S.caps.sample, sub, kind, aiCtx()); S.decisionDraft = txt; const cur = $('decision-msg') || ta; cur.value = txt; } catch (e) { const cur = $('decision-msg') || ta; cur.value = S.decisionDraft || ''; U.toast('Claude could not draft the message'); }
        finally { draft.disabled = false; }
      });
      row.append(draft);
    }
    const copy = el('button', { class: 'btn sm', type: 'button' }); copy.append(svg('copy'), document.createTextNode('Copy'));
    copy.addEventListener('click', () => U.copyText(ta.value || sub.result.banker_message || sub.notification.body));
    row.append(copy, el('span', { class: 'grow' }));
    const esc = el('button', { class: 'btn sm', type: 'button', text: 'Escalate' }); esc.addEventListener('click', () => recordDecision(sub, 'escalate', ta.value));
    const changes = el('button', { class: 'btn sm', type: 'button', text: 'Request changes' }); changes.addEventListener('click', () => recordDecision(sub, 'changes', ta.value));
    const approve = el('button', { class: 'btn sm success', type: 'button', text: 'Approve' }); approve.title = pending ? pending + ' point(s) still pending verification' : 'Approve the material'; approve.addEventListener('click', () => recordDecision(sub, 'approve', ta.value));
    row.append(esc, changes, approve);
    wrap.append(row);
    g.append(wrap);
  }
  /* ---------- reviewer platform: focus mode (one pending point at a time, keyboard) ---------- */
  function focusIds() { const sub = S.viewing; return allFindings().filter((f) => !Review.isCertain(f) && !(sub.verdicts && sub.verdicts[f.id] && sub.verdicts[f.id].verdict)).map((f) => f.id); }
  function startFocus() {
    const ids = focusIds(); if (!ids.length) { U.toast('Nothing left to verify'); return; }
    S.focus = { ids, i: 0, done: 0 };
    const f = allFindings().find((x) => x.id === ids[0]); S.tab = tierOfTab(f);
    selectFinding(f, { scrollPage: true, scrollPanel: false });
    renderRail();
  }
  function stopFocus() { S.focus = null; renderRail(); renderGate(); }
  function focusStep(delta) {
    if (!S.focus) return;
    const ids = S.focus.ids; let i = S.focus.i + delta;
    if (i < 0) i = 0;
    if (i >= ids.length) { const d = S.focus.done; S.focus = null; renderRail(); renderGate(); U.toast(d + ' point' + (d === 1 ? '' : 's') + ' verified'); return; }
    S.focus.i = i;
    const f = allFindings().find((x) => x.id === ids[i]);
    if (f) { S.tab = tierOfTab(f); selectFinding(f, { scrollPage: true, scrollPanel: false }); }
    renderRail();
  }
  async function focusVerdict(verdict) {
    if (!S.focus) return;
    const f = allFindings().find((x) => x.id === S.focus.ids[S.focus.i]); if (!f) return;
    const note = document.getElementById('verdict-' + f.id);
    await setVerdict(f, verdict === 'confirm' ? 'correct' : verdict === 'dismiss' ? 'incorrect' : verdict, note && note.value ? note.value : '', 'focus');
    S.focus.done += 1;
    focusStep(1);
  }
  function focusCard() {
    if (!S.focus) return null;
    const f = allFindings().find((x) => x.id === S.focus.ids[S.focus.i]); if (!f) return null;
    const box = el('div', { class: 'focus' });
    const fh = el('div', { class: 'fh' }); fh.append(el('b', { text: 'Verifying ' + (S.focus.i + 1) + ' of ' + S.focus.ids.length }), el('span', { class: 'grow' }));
    const exit = el('button', { class: 'btn xs', type: 'button', text: 'Exit' }); exit.addEventListener('click', stopFocus); fh.append(exit);
    box.append(fh);
    const bar = el('div', { class: 'fbar' }); bar.append(el('i', { style: 'width:' + Math.round((S.focus.i / S.focus.ids.length) * 100) + '%' })); box.append(bar);
    box.append(f.tier === 'C' ? cardLanguage(f) : cardDisclosure(f));
    const big = el('div', { class: 'big' });
    const c = el('button', { class: 'btn success', type: 'button' }); c.append(svg('check'), document.createTextNode('Confirm · would send')); c.addEventListener('click', () => focusVerdict('confirm'));
    const d = el('button', { class: 'btn', type: 'button' }); d.append(svg('x'), document.createTextNode('Dismiss · would not send')); d.addEventListener('click', () => focusVerdict('dismiss'));
    big.append(c, d); box.append(big);
    const keys = el('div', { class: 'fkeys' }); keys.innerHTML = '<span><kbd>C</kbd> confirm</span><span><kbd>D</kbd> dismiss</span><span><kbd>J</kbd>/<kbd>K</kbd> next / previous</span><span><kbd>Esc</kbd> exit</span>';
    box.append(keys);
    return box;
  }
  function focusKeys(ev) {
    if (!S.focus || S.view !== 'work') return;
    if (ev.target && ev.target.closest && ev.target.closest('.chatdock, .fixcard, .decision')) return;
    if (ev.target && /^(input|textarea|select)$/i.test(ev.target.tagName)) return;
    const k = ev.key.toLowerCase();
    if (k === 'c') { ev.preventDefault(); focusVerdict('confirm'); }
    else if (k === 'd') { ev.preventDefault(); focusVerdict('dismiss'); }
    else if (k === 'j' || k === 'arrowright') { ev.preventDefault(); focusStep(1); }
    else if (k === 'k' || k === 'arrowleft') { ev.preventDefault(); focusStep(-1); }
    else if (k === 'escape') { ev.preventDefault(); stopFocus(); }
  }
  /* the since-round tally of a stored submission, only when it has the expected shape */
  function sinceOf(sub) { const sc = sub && sub.previous && sub.previous.since; return sc && Array.isArray(sc.resolved) && Array.isArray(sc.open) ? { of: +sc.of || 0, resolved: sc.resolved, open: sc.open } : null; }
  function timelineBlock(sub) {
    const ul = el('ul', { class: 'timeline' });
    const add = (t, s, when) => { const li = el('li'); li.append(el('b', { text: t })); if (s) li.append(document.createTextNode(' ' + s)); li.append(el('small', { text: U.fmtDate(when) })); ul.append(li); };
    if (sub.previous && typeof sub.previous === 'object') {
      const pv = sub.previous; const since = sinceOf(sub);
      add('Round ' + (pv.round || 1) + ' submitted', 'the earlier version of this document', pv.created_at);
      if (pv.decision && typeof pv.decision === 'object') add(STATUS_LABEL[pv.status] || 'Decided', 'by ' + (pv.decision.by || 'the reviewer') + (pv.decision.message ? ' · message sent' : ''), pv.decision.at);
      if (since) add('Round ' + (sub.round || 2) + ' prepared', since.resolved.length + ' of ' + since.of + ' points resolved, ' + since.open.length + ' still open', sub.created_at);
    }
    if (sub.original) add('Uploaded', sub.original.name + ' · pre-reviewed in the app', sub.created_at);
    if ((sub.version || 1) > 1) add('Corrected in the app', (sub.changes || []).length + ' edits, ' + (sub.resolved || []).length + ' points resolved, version ' + sub.version, sub.created_at);
    add('Submitted', 'by ' + (sub.submitter || 'the banker') + ' · readiness ' + (sub.readiness ? sub.readiness.score : '–'), sub.created_at);
    (sub.history || []).forEach((h) => add(STATUS_LABEL[h.event === 'approve' ? 'approved' : h.event === 'escalate' ? 'escalated' : 'changes'], 'by ' + h.by + (h.message ? ' · message sent' : ''), h.at));
    return ul;
  }
  /* ---------- document chat (both platforms) ---------- */
  function chatOpen(open) {
    const dock = $('chatdock'); dock.hidden = !open; $('btn-chat').setAttribute('aria-pressed', String(open));
    if (open) { renderChat(); $('chat-input').focus(); }
  }
  function chatFindings() { return S.viewing ? allFindings() : currentFindings(); }
  function renderChat() {
    const body = $('chat-body'); body.innerHTML = '';
    if (!S.caps.sample) { body.append(el('div', { class: 'cd-hint', text: 'Claude is not available in this view. Open the page in the Claude app or run the local server to ask questions about the document.' })); return; }
    if (!(S.chat || []).length) {
      body.append(el('div', { class: 'cd-hint', text: 'Questions are answered from the document text, the rulebook and the pre-review, with page references. Nothing you ask here changes the pre-review.' }));
      const chips = el('div', { class: 'cd-chips' });
      const sugg = S.viewing ? ['Which points would you send first and why?', 'Is anything in the disclaimers page deficient?', 'Summarise the banker\'s corrections and what is still open'] : ['What must I change before this can go out?', 'Which claims need a source?', 'Explain the institutional lane to me in two sentences'];
      sugg.forEach((q) => { const b = el('button', { type: 'button', text: q }); b.addEventListener('click', () => askChat(q)); chips.append(b); });
      body.append(chips);
    }
    (S.chat || []).forEach((m) => body.append(el('div', { class: 'cd-msg ' + m.role + (m.busy ? ' busy' : ''), text: m.text })));
    body.scrollTop = body.scrollHeight;
  }
  async function askChat(q) {
    q = String(q || '').trim(); if (!q || !S.caps.sample || !S.doc) return;
    S.chat = S.chat || [];
    const ai = { role: 'ai', text: '', busy: true };
    S.chat.push({ role: 'user', text: q }, ai);
    renderChat(); $('chat-input').value = ''; $('chat-send').disabled = true;
    try {
      const history = S.chat.slice(0, -2);
      await Ask.chat(S.caps.sample, history, aiCtx(), chatFindings(), q, (t) => { ai.text = t; const last = $('chat-body').lastElementChild; if (last) { last.textContent = t; $('chat-body').scrollTop = $('chat-body').scrollHeight; } });
      const r = ai.text; if (!r) { const last = S.chat[S.chat.length - 1]; last.text = last.text || '(no answer)'; }
    } catch (e) { ai.text = 'Claude could not answer: ' + (e && e.message ? e.message : 'error'); }
    finally { ai.busy = false; $('chat-send').disabled = false; renderChat(); }
  }
  function bindChat() {
    $('btn-chat').addEventListener('click', () => chatOpen($('chatdock').hidden));
    $('chat-close').addEventListener('click', () => chatOpen(false));
    $('chat-form').addEventListener('submit', (ev) => { ev.preventDefault(); askChat($('chat-input').value); });
    document.addEventListener('keydown', focusKeys);
  }

  /* ---------- learning view (reviewer) ---------- */
  async function renderLearning() {
    show('learning');
    const body = $('learning-body');
    body.innerHTML = '';
    body.append(el('div', { class: 'empty', text: 'Loading the learning state…' }));
    const [st, rules, verdictsAll, profiles, meta] = await Promise.all([Learn.stats(), Learn.learnedRules(), Store.listCalibration(600), Learn.profiles(), Learn.meta()]);
    const verdicts = verdictsAll.filter((e) => e && e.rule && (!e.type || e.type === 'verdict'));
    const comments = verdictsAll.filter((e) => e && ((e.reason && (!e.type || e.type === 'verdict' || e.type === 'comment')) || (e.type === 'decision' && e.message))).length;
    body.innerHTML = '';
    const grid = el('div', { class: 'lgrid' });
    const stat = (n, l) => { const c = el('div', { class: 'summary-card', style: 'margin:0' }); c.append(el('div', { class: 'n', style: 'font-size:22px;font-weight:600', text: String(n) }), el('div', { class: 'helper', style: 'margin-top:2px', text: l })); return c; };
    const rulesTracked = Object.keys(st.byRule).length;
    const demoted = Object.values(st.byRule).filter((r) => r.status !== 'active').length;
    grid.append(stat(st.total, 'verdicts recorded'), stat(comments, 'comments and decision messages read'), stat(profiles.length, 'reviewer' + (profiles.length === 1 ? '' : 's') + ' teaching'), stat(rules.length, 'learned calibration rules'), stat(rulesTracked, 'rules with a track record'), stat(demoted, 'rules demoted or set aside'));
    body.append(grid);
    // ask the desk memory
    body.append(el('div', { class: 'label', text: 'Ask the desk memory' }));
    const ms = el('form', { class: 'msearch', id: 'memory-search' });
    const mi = el('input', { type: 'search', id: 'memory-q', placeholder: 'e.g. B6 logos portfolio companies, or “track record” dismissed', 'aria-label': 'Search the desk memory' });
    const mb = el('button', { class: 'btn sm', type: 'submit', text: 'Search' });
    ms.append(mi, mb); body.append(ms);
    const mout = el('div', { class: 'table', id: 'memory-results', style: 'margin-bottom:14px' }); mout.hidden = true; body.append(mout);
    ms.addEventListener('submit', async (ev) => {
      ev.preventDefault(); const q = mi.value.trim(); mout.innerHTML = ''; mout.hidden = !q; if (!q) return;
      const hits = await Learn.search(q, 12);
      if (!hits.length) { mout.append(el('div', { class: 'empty', text: 'Nothing in the desk memory matches. Verdicts, comments and decision messages are searched by rule id and by words.' })); return; }
      hits.forEach((h) => { const e = h.entry; const item = el('div', { class: 'rule-item' }); const g = el('div', { class: 'grow' }); g.append(el('div', { html: (e.rule ? '<span class="code">' + U.esc(e.rule) + '</span> ' : '') + (e.type === 'decision' ? '<span class="tag grey">' + U.esc(e.kind === 'approve' ? 'approved' : e.kind === 'escalate' ? 'escalated' : 'changes requested') + '</span> ' : e.verdict ? '<span class="tag ' + (e.verdict === 'correct' ? 'ok' : 'high') + '">' + (e.verdict === 'correct' ? 'confirmed' : 'dismissed') + '</span> ' : '<span class="tag grey">comment</span> ') + '<i>' + U.esc((e.quote || e.title || '').slice(0, 140)) + '</i>' }), el('div', { class: 'm', text: [e.reviewer && e.reviewer.name ? e.reviewer.name : '', e.docName, e.lane, e.docType, e.page ? 'p. ' + e.page : '', e.reason ? '— ' + e.reason.slice(0, 200) : e.message ? '— ' + e.message.replace(/\s+/g, ' ').slice(0, 200) : '', U.fmtDate(e.at), 'match: ' + h.why].filter(Boolean).join(' · ') })); item.append(g); mout.append(item); });
    });
    // the desk playbook
    body.append(el('div', { class: 'label', text: 'Desk playbook (what the reviewers have taught, written up for the desk)' }));
    const pbWrap = el('div', { id: 'playbook', style: 'margin-bottom:14px' });
    body.append(pbWrap);
    renderPlaybook(pbWrap);
    // how it learns, in one paragraph, with the last digest
    const how = el('div', { class: 'note blue', style: 'margin-bottom:14px;display:block' });
    how.append(el('div', { html: '<b>How the pre-review learns.</b> Every verdict and every comment on the reviewer platform is recorded with the reviewer\'s name. Before each pre-review the closest precedents (same rule, same lane, similar passage, the reviewer the submission goes to first) are put in front of the model; an identical passage the desk dismissed is set aside before the banker sees it; a rule this reviewer keeps rejecting is left to the reviewer instead of asserted. After each decision, Claude reads the new comments and decision messages (the digest) and writes durable calibration rules, desk-wide or for one reviewer.' + (meta.lastDigestAt ? ' Last digest ' + U.esc(U.fmtDate(meta.lastDigestAt)) + (meta.lastSummary ? ': ' + U.esc(meta.lastSummary) : '') : ' No digest has run yet.') }));
    const dg = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px' });
    const digestBtn = el('button', { class: 'btn sm primary', type: 'button', id: 'btn-digest' }); digestBtn.append(svg('spark'), document.createTextNode('Digest the new comments now')); digestBtn.disabled = !S.caps.sample;
    digestBtn.addEventListener('click', async () => { digestBtn.disabled = true; digestBtn.textContent = 'Reading…'; try { const r = await Learn.digest(S.caps.sample, { all: false }); U.toast(r.skipped ? 'Nothing new since the last digest' : r.changed + ' rule' + (r.changed === 1 ? '' : 's') + ' learned from ' + r.considered + ' new entries'); } catch (e) { U.toast('The digest could not run: ' + (e && e.message ? e.message : 'error')); } renderLearning(); });
    const digestAll = el('button', { class: 'btn sm', type: 'button', text: 'Re-read everything', id: 'btn-digest-all' }); digestAll.disabled = !S.caps.sample;
    digestAll.addEventListener('click', async () => { digestAll.disabled = true; try { const r = await Learn.digest(S.caps.sample, { all: true }); U.toast(r.changed + ' rule' + (r.changed === 1 ? '' : 's') + ' learned'); } catch (e) { U.toast('The digest could not run'); } renderLearning(); });
    dg.append(digestBtn, digestAll); how.append(dg);
    body.append(how);
    // reviewer profiles
    body.append(el('div', { class: 'label', text: 'Reviewers (what each one confirms, dismisses and says; the pre-review adapts to the reviewer a submission goes to)' }));
    const pt = el('div', { class: 'table', id: 'profiles', style: 'margin-bottom:14px' });
    if (!profiles.length) pt.append(el('div', { class: 'empty', text: 'No reviewer has recorded a verdict yet. Sign in on the reviewer platform, open a submission, confirm or dismiss the points and write comments.' }));
    profiles.forEach((p) => {
      const item = el('div', { class: 'rule-item' });
      const g = el('div', { class: 'grow' });
      g.append(el('div', { html: '<b>' + U.esc(p.name || p.email) + '</b> <span class="m">' + U.esc(p.email) + ' · ' + p.verdicts + ' verdict' + (p.verdicts === 1 ? '' : 's') + ' (' + p.confirmed + ' confirmed, ' + p.dismissed + ' dismissed) · ' + p.comments + ' comment' + (p.comments === 1 ? '' : 's') + ' · ' + p.decisions + ' decision' + (p.decisions === 1 ? '' : 's') + (p.lastAt ? ' · last ' + U.esc(U.fmtDate(p.lastAt)) : '') + '</span>' }));
      if (p.topDismissed.length) g.append(el('div', { class: 'm', html: 'Keeps dismissing: ' + p.topDismissed.map((r) => '<span class="code">' + U.esc(r.rule) + '</span> ' + r.incorrect + '/' + r.total).join(' · ') + (p.topDismissed.some((r) => r.total >= 4 && r.incorrect / r.total >= 0.75) ? ' <span class="tag vtag">left to this reviewer, not asserted, on their submissions</span>' : '') }));
      if (p.topConfirmed.length) g.append(el('div', { class: 'm', html: 'Keeps confirming: ' + p.topConfirmed.map((r) => '<span class="code">' + U.esc(r.rule) + '</span> ' + r.correct + '/' + r.total).join(' · ') }));
      if (p.rules.length) g.append(el('div', { class: 'm', html: 'Rules learned from this reviewer: ' + p.rules.map((r) => '“' + U.esc(r.text) + '”').join(' · ') }));
      if (p.quotes.length) g.append(el('div', { class: 'm', html: 'Said: ' + p.quotes.slice(0, 3).map((q) => '<span class="code">' + U.esc(q.rule) + '</span> “' + U.esc(q.reason.slice(0, 110)) + '”').join(' · ') }));
      item.append(g); pt.append(item);
    });
    body.append(pt);
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
    if (!rules.length) rl.append(el('div', { class: 'empty', text: 'None yet. Rules are read from the reviewers\' comments and decisions by the digest, distilled from three or more rejections of the same rule that carry a reason, or written by hand below.' }));
    rules.forEach((r) => {
      const item = el('div', { class: 'rule-item' });
      const g = el('div', { class: 'grow' });
      g.append(el('div', { text: r.text }), el('div', { class: 'm', text: (r.rule ? r.rule + ' · ' : '') + (r.scope === 'reviewer' ? 'preference of ' + (r.reviewer || 'a reviewer') + ' · ' : 'every reviewer · ') + (r.source === 'synthesized' ? 'distilled from ' + r.evidence + ' rejection' + (r.evidence === 1 ? '' : 's') : r.source === 'digest' ? 'read from the reviewers\' comments' + (r.evidence ? ' (' + r.evidence + ')' : '') : 'written by hand') + ' · ' + U.fmtDate(r.at) }));
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
    const clear = el('button', { class: 'btn sm danger', type: 'button', text: 'Clear all learning' });
    clear.addEventListener('click', async () => { if (!window.confirm('Delete every verdict and learned rule? The next pre-reviews start from the calibration rules alone.')) return; await Learn.clearAll(); U.toast('Learning state cleared'); renderLearning(); });
    io.append(exp, imp, impInput, replay, clear);
    body.append(io);
    body.append(el('div', { id: 'replay-out' }));
    // learning log
    const log = (meta.log || []).slice().reverse();
    body.append(el('div', { class: 'label', style: 'margin-top:18px', text: 'What the pre-review learned, in order (' + log.length + ')' }));
    const lg = el('div', { class: 'table', id: 'learning-log', style: 'margin-bottom:10px' });
    if (!log.length) lg.append(el('div', { class: 'empty', text: 'Nothing yet.' }));
    log.slice(0, 30).forEach((e) => { const item = el('div', { class: 'rule-item' }); item.append(el('div', { class: 'grow', html: '<span class="code">' + U.esc(e.event || '') + '</span> ' + U.esc(e.text || '') + (e.by && e.by.name ? ' · ' + U.esc(e.by.name) : '') + ' <span class="m">' + U.esc(U.fmtDate(e.at)) + '</span>' })); lg.append(item); });
    body.append(lg);
    // recent verdicts
    body.append(el('div', { class: 'label', style: 'margin-top:18px', text: 'Recent verdicts (' + verdicts.length + ')' }));
    const vt = el('div', { class: 'table' });
    if (!verdicts.length) vt.append(el('div', { class: 'empty', text: 'No verdicts yet.' }));
    verdicts.slice(0, 40).forEach((v) => {
      const item = el('div', { class: 'rule-item' });
      const g = el('div', { class: 'grow' });
      g.append(el('div', { html: '<span class="code">' + U.esc(v.rule || '?') + '</span> <span class="tag ' + (v.verdict === 'correct' ? 'ok' : 'high') + '">' + (v.verdict === 'correct' ? 'confirmed' : 'dismissed') + '</span> <i>' + U.esc((v.quote || '').slice(0, 140)) + '</i>' }), el('div', { class: 'm', text: [v.reviewer && v.reviewer.name ? v.reviewer.name : '', v.lane, v.docType, v.page ? 'p. ' + v.page : '', v.source ? v.source : '', v.reason ? '— ' + v.reason : '', U.fmtDate(v.at)].filter(Boolean).join(' · ') }));
      item.append(g);
      vt.append(item);
    });
    body.append(vt);
  }
  async function renderPlaybook(wrap, opts) {
    wrap.innerHTML = '';
    wrap.append(el('div', { class: 'empty', text: opts && opts.model ? 'Claude is writing the playbook from the reviewer record…' : 'Loading the playbook…' }));
    let pb;
    try { pb = await Learn.playbook(opts && opts.model ? S.caps.sample : null, { rebuild: !!(opts && opts.model) }); }
    catch (e) { wrap.innerHTML = ''; wrap.append(el('div', { class: 'note red', text: 'The playbook could not be written: ' + (e && (e.message || e.code) || 'error') })); return; }
    if (opts && opts.model && pb.skipped) U.toast(pb.skipped);
    else if (opts && opts.model && pb.error) U.toast('Claude could not write the playbook (' + pb.error + '); the computed version shows');
    wrap.innerHTML = '';
    const tools = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px' });
    const write = el('button', { class: 'btn sm primary', type: 'button', id: 'btn-playbook-write' }); write.append(svg('spark'), document.createTextNode(pb.source === 'model' ? 'Rewrite with Claude' : 'Write the playbook with Claude')); write.disabled = !S.caps.sample;
    write.addEventListener('click', () => renderPlaybook(wrap, { model: true }));
    tools.append(write);
    if (pb.source === 'model') { const drop = el('button', { class: 'btn sm', type: 'button', text: 'Discard Claude\'s version', id: 'btn-playbook-discard' }); drop.addEventListener('click', async () => { await Learn.discardPlaybook(); renderPlaybook(wrap); }); tools.append(drop); }
    const exp = el('button', { class: 'btn sm', type: 'button', id: 'btn-playbook-pdf' }); exp.append(svg('download'), document.createTextNode('Export as PDF')); exp.disabled = !S.caps.downloads;
    exp.addEventListener('click', async () => { try { await S.caps.downloads.save({ filename: 'desk-playbook-' + new Date().toISOString().slice(0, 10) + '.pdf', data: PdfOut.blob({ title: 'Desk playbook', brand: 'finalis', product: 'Reviewer platform', kicker: 'Desk playbook', date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), accent: [0.06, 0.48, 0.42], footerLeft: 'Internal. Written from the reviewers\' verdicts, comments and decisions; the desk decides.', footerRight: 'Playbook', blocks: Learn.playbookBlocks(pb) }) }); U.toast('Playbook saved as PDF'); } catch (e) { if (!e || (e.code !== 'cancelled' && e.code !== 'declined')) U.toast('Could not save the PDF'); } });
    tools.append(exp, el('span', { class: 'helper', style: 'margin:0', text: (pb.source === 'model' ? 'Written by Claude' : 'Computed from the record') + (pb.at ? ' · ' + U.fmtDate(pb.at) : '') + (pb.basis ? ' · ' + pb.basis.verdicts + ' verdicts, ' + pb.basis.comments + ' comments, ' + pb.basis.decisions + ' decisions' : '') }));
    wrap.append(tools);
    const box = el('div', { class: 'playbook' });
    if (pb.summary) box.append(el('div', { class: 'note blue', style: 'display:block', text: pb.summary }));
    if (!(pb.sections || []).length) box.append(el('div', { class: 'empty', text: 'The playbook fills in as the reviewers record verdicts, comments and decisions.' }));
    (pb.sections || []).forEach((sec) => { const d = el('div', { class: 'pbs' }); d.append(el('h4', { text: sec.title })); (sec.items || []).forEach((it) => { const i = el('div', { class: 'pbi', text: it.text }); if (it.evidence) i.append(el('small', { text: 'Evidence: ' + it.evidence })); d.append(i); }); box.append(d); });
    wrap.append(box);
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

  /* ---------- reviewer platform: metrics and audit ---------- */
  async function renderMetrics() {
    S.viewing = null;
    show('metrics');
    const body = $('metrics-body');
    if (!$('metrics-stats')) { body.innerHTML = ''; body.append(el('div', { id: 'metrics-stats' }), el('div', { id: 'metrics-audit' })); renderAuditCard($('metrics-audit')); }
    await renderMetricsStats();
    renderChrome();
  }
  /* every submission the store holds, not only the queue's most recent ones */
  async function allSubmissions() { try { const all = await Store.listSubmissions(1000); return all.length >= S.inbox.length ? all : S.inbox; } catch (e) { return S.inbox; } }
  async function renderMetricsStats() {
    const subs = await allSubmissions();
    if (S.view !== 'metrics') return;
    const body = $('metrics-stats'); body.innerHTML = '';
    const m = Metrics.compute(subs);
    const k = el('div', { class: 'kpis' });
    const kpi = (v, l) => { const c = el('div', { class: 'kpi' }); c.append(el('b', { text: v === null || v === undefined ? '–' : String(v) }), el('span', { text: l })); return c; };
    k.append(kpi(m.submissions, 'submission' + (m.submissions === 1 ? '' : 's') + ' · ' + m.open + ' open'), kpi(m.firstPass.rate === null ? null : m.firstPass.rate + '%', 'approved on the first round (' + m.firstPass.approved + ' of ' + m.firstPass.decided + ' decided)'), kpi(m.readiness.avg, 'average readiness at submission'), kpi(m.corrected.rate === null ? null : m.corrected.rate + '%', 'corrected in the app before submission (' + m.corrected.edits + ' edits, ' + m.corrected.resolved + ' points resolved)'), kpi(m.rounds.rate === null ? null : m.rounds.rate + '%', 'needed a second round (' + m.rounds.multi + ' of ' + m.rounds.threads + ' threads)'), kpi(Metrics.hours(m.decisionTime.median), 'median time to decision' + (m.decisionTime.n ? ' (' + m.decisionTime.n + ' decided)' : '')), kpi(m.points.certain === null ? null : m.points.certain, 'asserted points per submission' + (m.points.pending !== null ? ' · ' + m.points.pending + ' to verify' : '')), kpi(m.answers.rate === null ? null : m.answers.rate + '%', 'high points answered by bankers (' + m.answers.answered + ' of ' + m.answers.asked + ')'), kpi(m.withContradictions, 'submission' + (m.withContradictions === 1 ? '' : 's') + ' with figures that do not agree'));
    body.append(k);
    if (!m.submissions) body.append(el('div', { class: 'empty', text: 'No submissions yet: the metrics compute from the submissions the reviewer platform holds.' }));
    const grid = el('div', { class: 'mgrid' });
    const card = (title, sub2) => { const c = el('div', { class: 'summary-card', style: 'margin:0' }); c.append(el('h4', { text: title })); if (sub2) c.append(el('p', { class: 'helper', style: 'margin:-4px 0 8px', text: sub2 })); return c; };
    const bars = (rows, opts) => { const w = el('div', { class: 'mbars' }); const max = Math.max(1, ...rows.map((r) => r.n)); rows.forEach((r) => { const b = el('div', { class: 'mbar' }); const bar = el('div', { class: 'b' }); bar.append(el('i', { class: r.cls || '', style: 'width:' + Math.round((r.n / max) * 100) + '%' })); b.append(el('span', { class: 'l', text: r.label, title: r.label }), bar, el('span', { class: 'n', text: r.text || String(r.n) })); w.append(b); }); if (!rows.length) w.append(el('div', { class: 'helper', style: 'margin:0', text: (opts && opts.empty) || 'Nothing yet.' })); return w; };
    { const c = card('Readiness at submission, by week', 'Average readiness score of the submissions received each week; the pre-review is doing its job when this rises and rounds fall.'); const t = el('div', { class: 'trendrow' }); m.trend.forEach((w) => { const d = el('div'); d.append(el('small', { text: String(w.readiness) }), el('i', { style: 'height:' + Math.max(4, Math.round((w.readiness / 100) * 64)) + 'px', title: w.week + ': readiness ' + w.readiness + ', ' + w.n + ' submission' + (w.n === 1 ? '' : 's') }), el('small', { text: w.week.slice(5) })); t.append(d); }); if (!m.trend.length) t.append(el('div', { class: 'helper', style: 'margin:0', text: 'Nothing yet.' })); c.append(t); grid.append(c); }
    { const c = card('Where the submissions stand'); c.append(bars([{ label: 'With the reviewer', n: m.status.submitted }, { label: 'Changes requested', n: m.status.changes, cls: 'warn' }, { label: 'Approved', n: m.status.approved, cls: 'ok' }, { label: 'Escalated', n: m.status.escalated }])); grid.append(c); }
    { const c = card('Rules the pre-review raises', 'Times raised across all submissions; confirmed and dismissed are the desk\'s verdicts on them.'); c.append(bars(m.rules.slice(0, 10).map((r) => ({ label: r.rule + ' ' + (RULES.CATEGORY_NAMES[r.rule] || '') + (r.confirmed || r.dismissed ? ' · ' + r.confirmed + ' confirmed, ' + r.dismissed + ' dismissed' : ''), n: r.raised })))); grid.append(c); }
    { const c = card('Decisions per reviewer'); c.append(bars(m.reviewers.map((r) => ({ label: r.name + ' · ' + r.approved + ' approved, ' + r.changes + ' changes, ' + r.escalated + ' escalated', n: r.decisions })), { empty: 'No decision recorded yet.' })); grid.append(c); }
    body.append(grid);
    body.append(el('div', { class: 'label', text: 'Per firm: volume, readiness, the rules that keep coming back' }));
    const ft = el('div', { class: 'table', style: 'margin-bottom:18px' });
    if (!m.firms.length) ft.append(el('div', { class: 'empty', text: 'Nothing yet.' }));
    m.firms.forEach((f) => { const item = el('div', { class: 'rule-item' }); const g = el('div', { class: 'grow' }); g.append(el('div', { html: '<b>' + U.esc(f.firm) + '</b> <span class="m">' + f.subs + ' submission' + (f.subs === 1 ? '' : 's') + ' · readiness ' + U.esc(String(f.readiness)) + ' · ' + f.approved + ' approved, ' + f.changes + ' changes requested</span>' })); if (f.top.length) g.append(el('div', { class: 'm', html: 'Keeps coming back: ' + f.top.map((r) => '<span class="code">' + U.esc(r.rule) + '</span> ' + r.n + '×').join(' · ') })); item.append(g); ft.append(item); });
    body.append(ft);
  }
  function renderAuditCard(wrap) {
    wrap.innerHTML = '';
    wrap.append(el('div', { class: 'label', text: 'Audit trail (books and records)' }));
    const au = el('div', { class: 'summary-card' });
    au.append(el('p', { class: 'helper', style: 'margin:0 0 10px', text: 'Every event on every submission the store holds (submitted, verdict, comment, decision), in time order, each record carrying the SHA-256 of the previous one and a seal closing the file: a record altered, removed, inserted or reordered in the exported file breaks every hash that follows. Export it to the firm\'s retention store and write down the head hash; verify any copy here from the file alone.' }));
    const row = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center' });
    const exp = el('button', { class: 'btn sm primary', type: 'button', id: 'btn-audit-export' }); exp.append(svg('download'), document.createTextNode('Export the audit trail (.json)'));
    const out = el('div', { id: 'audit-out', style: 'margin-top:10px;font-size:12.5px' });
    exp.addEventListener('click', async () => { exp.disabled = true; try { const ch = await Audit.chain(await allSubmissions(), { by: S.user ? { name: S.user.name, email: S.user.email } : null }); const text = JSON.stringify(ch, null, 2); out.innerHTML = ''; out.append(el('div', { html: '<b>' + ch.count + ' record' + (ch.count === 1 ? '' : 's') + '</b> (' + (ch.count - 1) + ' event' + (ch.count === 2 ? '' : 's') + ' and the seal) over ' + ch.submissions + ' submission' + (ch.submissions === 1 ? '' : 's') + ' · head hash <span class="hash">' + U.esc(ch.head) + '</span>' })); if (S.caps.downloads) { try { await S.caps.downloads.save({ filename: Audit.filename(), data: text }); U.toast('Audit trail exported'); } catch (e) { if (!e || (e.code !== 'cancelled' && e.code !== 'declined')) U.copyText(text); } } else U.copyText(text); } catch (e) { U.toast('The audit trail could not be built' + (e && e.message ? ': ' + e.message : '')); } exp.disabled = false; });
    const vin = el('input', { type: 'file', accept: 'application/json,.json', hidden: '', id: 'audit-file' });
    const head = el('input', { type: 'text', id: 'audit-head', placeholder: 'Head hash you wrote down (optional)', 'aria-label': 'Expected head hash', style: 'flex:1;min-width:220px;padding:6px 9px;font:12px ui-monospace, SFMono-Regular, Menlo, monospace' });
    const ver = el('button', { class: 'btn sm', type: 'button', id: 'btn-audit-verify', text: 'Verify an exported file' }); ver.addEventListener('click', () => vin.click());
    vin.addEventListener('change', async () => { const f = vin.files && vin.files[0]; if (!f) return; out.innerHTML = ''; try { const r = await Audit.verify(JSON.parse(await f.text()), head.value); out.append(el('div', { class: r.ok ? 'audit-ok' : 'audit-bad', html: (r.ok ? '<b>Chain intact</b> · ' + r.events + ' event' + (r.events === 1 ? '' : 's') + ' verified' + (head.value.trim() ? ', head as written down' : '') + ' · head <span class="hash">' + U.esc(r.head) + '</span>' : '<b>Chain broken</b> · ' + U.esc(r.error || '') + ' (' + r.checked + ' record' + (r.checked === 1 ? '' : 's') + ' verified before the break)') })); } catch (e) { out.append(el('div', { class: 'audit-bad', text: 'Not an audit export.' })); } vin.value = ''; });
    row.append(exp, ver, head, vin);
    au.append(row, out);
    wrap.append(au);
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
      if (S.view !== 'work' || S.focus) return; // focus mode has its own keys
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key === 'j' || e.key === 'ArrowDown' && e.altKey) { e.preventDefault(); stepFinding(1); }
      else if (e.key === 'k' || e.key === 'ArrowUp' && e.altKey) { e.preventDefault(); stepFinding(-1); }
      else if (e.key === 'n') { e.preventDefault(); scrollToPage(Math.min(S.doc ? S.doc.pages.length : 1, S.page + 1)); }
      else if (e.key === 'p') { e.preventDefault(); scrollToPage(Math.max(1, S.page - 1)); }
    });
    $('btn-learning').addEventListener('click', () => renderLearning());
    $('btn-learning-back').addEventListener('click', () => { renderInbox(); show('inbox'); });
    $('btn-metrics').addEventListener('click', () => renderMetrics());
    $('btn-metrics-back').addEventListener('click', () => { renderInbox(); show('inbox'); });
    $('btn-mine').addEventListener('click', () => renderMine());
    $('btn-mine-back').addEventListener('click', () => leaveMine());
    $('btn-mine-new').addEventListener('click', () => { resetForm(); show('form'); });
    $('reviewer-email').addEventListener('change', async () => { S.settings = await Store.setSettings({ reviewerEmail: $('reviewer-email').value.trim() }); });
    bindChat();
    window.addEventListener('resize', () => { if (!isMobile()) { $('rail').style.display = ''; $('viewer').style.display = ''; } if (S.view === 'work') { applyZoom(); rerenderVisible(); } });
  }
  /* ---------- sign-in ---------- */
  function initials(name) { return String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'; }
  function loadUser() { try { const u = JSON.parse(localStorage.getItem('prescreen.user') || 'null'); return u && u.email ? u : null; } catch (e) { return null; } }
  function saveUser(u) { try { if (u) localStorage.setItem('prescreen.user', JSON.stringify(u)); else localStorage.removeItem('prescreen.user'); } catch (e) { /* storage unavailable */ } }
  function signIn(user, remember) {
    S.user = user; if (remember) saveUser(user);
    if (user.role === 'banker') { S.prefill = Object.assign({}, S.prefill, { bankName: user.firm || S.prefill.bankName || '', submitter: user.name + (user.email ? ' · ' + user.email : '') }); }
    renderChrome();
    const want = user.role === 'reviewer' ? 'reviewer' : 'banker';
    if (S.mode !== want) setMode(want);
    else if (want === 'reviewer') { renderInbox(); show('inbox'); }
    else show(S.submission ? 'done' : (S.result && S.doc ? 'work' : 'form'));
    U.toast('Signed in as ' + user.name);
  }
  function signOut() {
    S.user = null; saveUser(null); $('avatar-menu').hidden = true; $('avatar').setAttribute('aria-expanded', 'false');
    if (window.claude && window.claude.local && S.health && S.health.passcode) fetch((window.PRESCREEN_API || '') + '/api/logout', { method: 'POST', headers: { 'X-Prescreen': '1' } }).catch(() => {});
    show('login'); const em = $('login-email'); if (em) em.focus();
  }
  /* on a team install (passcode set) the demo switch between the platforms is off: the platform is the role you signed in with */
  function lockedPlatforms() { return !!(window.claude && window.claude.local && S.health && S.health.passcode); }
  function bindLogin() {
    const form = $('login-form'); if (!form) return;
    const roleInputs = Array.from(form.querySelectorAll('input[name=role]'));
    const syncRole = () => { const r = (roleInputs.find((i) => i.checked) || {}).value || 'banker'; $('login-firm-field').hidden = r === 'reviewer'; $('login-pass-field').hidden = !(r === 'reviewer' && S.health && S.health.passcode); };
    roleInputs.forEach((i) => i.addEventListener('change', syncRole)); syncRole();
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const role = (roleInputs.find((i) => i.checked) || {}).value || 'banker';
      const email = $('login-email').value.trim(); const name = $('login-name').value.trim(); const firm = $('login-firm').value.trim();
      const err = $('login-err');
      const fail = (msg) => { err.textContent = msg; err.hidden = false; };
      err.hidden = true;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('Enter your work email.');
      if (!name) return fail('Enter your name.');
      const btn = $('login-submit'); btn.disabled = true; btn.textContent = 'Signing in…';
      try {
        if (window.claude && window.claude.local && S.health && S.health.passcode) {
          // a team install: every sign-in opens a server session; the reviewer role needs the passcode
          const res = await fetch((window.PRESCREEN_API || '') + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json', 'X-Prescreen': '1' }, body: JSON.stringify({ email, name, role, passcode: role === 'reviewer' ? $('login-pass').value : '' }) });
          if (!res.ok) { const j = await res.json().catch(() => ({})); return fail(j.message || 'Sign-in refused.'); }
        }
        signIn({ name, email, firm: role === 'banker' ? firm : 'Finalis Securities LLC', role, since: new Date().toISOString() }, $('login-remember').checked);
      } finally { btn.disabled = false; btn.textContent = 'Continue'; }
      return undefined;
    });
    $('avatar').addEventListener('click', (ev) => { ev.stopPropagation(); const m = $('avatar-menu'); m.hidden = !m.hidden; $('avatar').setAttribute('aria-expanded', String(!m.hidden)); });
    document.addEventListener('click', (ev) => { const m = $('avatar-menu'); if (!m.hidden && !ev.target.closest('.avatar-wrap')) { m.hidden = true; $('avatar').setAttribute('aria-expanded', 'false'); } });
    $('am-switch').addEventListener('click', () => { $('avatar-menu').hidden = true; setMode(S.mode === 'reviewer' ? 'banker' : 'reviewer'); });
    $('am-signout').addEventListener('click', signOut);
    $('login-foot').textContent = window.claude && window.claude.local ? 'Any email opens the platform for the role you choose. The reviewer platform asks for a passcode when PRESCREEN_PASSCODE is set in .env.' : 'Demo sign-in: any email opens the platform for the role you choose. On a team install the reviewer platform can require a passcode.';
  }
  function renderBrand() {
    renderChrome();
    const logo = (typeof window !== 'undefined' && window.FINALIS_LOGO) || '';
    const dark = (typeof window !== 'undefined' && window.FINALIS_LOGO_DARK) || '';
    ['brand-logo', 'brand-logo-2', 'brand-logo-3'].forEach((id) => {
      const slot = $(id);
      if (!slot) return;
      slot.innerHTML = '';
      if (logo) { slot.append(el('img', { src: logo, alt: 'Finalis', class: 'light' })); if (dark) slot.append(el('img', { src: dark, alt: '', class: 'dark', 'aria-hidden': 'true' })); }
      else slot.append(el('span', { class: 'wm', text: 'finalis' }));
    });
  }
  async function start(caps) {
    renderBrand();
    S.caps = caps;
    if (window.claude && window.claude.local) { try { const h = await fetch((window.PRESCREEN_API || '') + '/api/health'); if (h.ok) S.health = await h.json(); } catch (e) { S.health = null; } }
    await Store.init(caps);
    S.settings = await Store.getSettings();
    if (S.settings.reviewerEmail) $('reviewer-email').value = S.settings.reviewerEmail;
    S.seen = loadSeen();
    Store.watchSubmissions((list) => {
      S.inbox = list.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      const n = S.inbox.filter((s) => s.status === 'submitted').length;
      $('inbox-count').hidden = !n; $('inbox-count').textContent = String(n);
      if (S.view === 'inbox') renderInbox();
      else if (S.view === 'mine') renderMineList();
      else if (S.view === 'metrics') renderMetricsStats();
      if (S.view !== 'login') renderChrome();
    });
    if (!caps.sample) $('form-foot').textContent = 'Claude is not available in this view: the pre-review will check the required blocks only' + (typeof SAMPLE_DECK_B64 !== 'undefined' ? ', and the calibration deck shows the reference pre-review.' : '.');
    bindLogin();
    const remembered = loadUser();
    const sessionOk = !lockedPlatforms() || !!(S.health && S.health.signedIn); // a locked install needs a live server session, not only a remembered name
    if (remembered && sessionOk && !window.PRESCREEN_FORCE_LOGIN) { S.user = remembered; renderChrome(); if (remembered.role === 'reviewer' && S.mode !== 'reviewer') setMode('reviewer'); }
    else { if (remembered) { $('login-email').value = remembered.email || ''; $('login-name').value = remembered.name || ''; $('login-firm').value = remembered.firm || ''; } show('login'); }
  }
  return { bind, start, S, openRulebook, readLanding, readSetup, applyAllFixes, buildCorrected, recheckCorrected, selectEdit, removeEdit, signIn, signOut, exportOffice };
})();
