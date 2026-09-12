'use strict';
/* The automatic feedback to the reviewer: composed from the pre-review and the banker's answers,
   stored with the submission, shown in the inbox, and offered as a ready-to-send email. */
const Notify = (() => {
  const RESP_LABEL = { fixed: 'Fixed in the new version', covered: 'Already covered', disagree: 'Disagrees', none: 'No answer' };
  const ACTION_LABEL = { add: 'Add', rewrite: 'Rewrite', source: 'Source', remove: 'Remove', confirm: 'Confirm', escalate: 'Escalate' };

  function line(f, resp) {
    const where = f.page ? 'p.' + (f.pages && f.pages.length > 1 ? f.pages.join(', ') : f.page) : 'document';
    let s = '[' + f.severity.toUpperCase() + '] ' + f.rule + ' · ' + f.title + ' (' + where + ')';
    if (f.quote) s += '\n    "' + f.quote.slice(0, 160) + (f.quote.length > 160 ? '…' : '') + '"';
    s += '\n    ' + (ACTION_LABEL[f.action] || 'Confirm') + ': ' + (f.issue || '').slice(0, 260);
    if (f.assurance === 'verify') s += '\n    Not shown to the banker' + (f.why_verify ? ': ' + f.why_verify : '') + '. Please confirm or dismiss.';
    if (resp && resp.status && resp.status !== 'none') {
      s += '\n    Banker: ' + RESP_LABEL[resp.status] + (resp.status === 'covered' && resp.page ? ' on page ' + resp.page : '') + (resp.note ? ' — ' + resp.note.slice(0, 200) : '');
    }
    return s;
  }

  function compose(sub) {
    const r = sub.result || {};
    const findings = sub.findings || [];
    const c = Review.counts(findings);
    const certain = findings.filter((f) => Review.isCertain(f));
    const verify = findings.filter((f) => !Review.isCertain(f));
    const high = certain.filter((f) => f.severity === 'high');
    const others = certain.filter((f) => f.severity !== 'high');
    const cov = r.profile && r.profile.coverage ? Object.keys(r.profile.coverage).filter((k) => r.profile.coverage[k] && r.profile.coverage[k].covered).map((k) => k.replace(/_/g, ' ') + (r.profile.coverage[k].where ? ' (' + String(r.profile.coverage[k].where).slice(0, 60) + ')' : '')) : [];
    const subject = 'Finalis pre-review · ' + sub.file.name + ' · ' + sub.lane + ' · ' + c.total + ' attention point' + (c.total === 1 ? '' : 's') + (c.high || c.verify ? ' (' + [c.high ? c.high + ' high' : '', c.verify ? c.verify + ' to verify' : ''].filter(Boolean).join(', ') + ')' : '');
    const body = [
      'Pre-review completed ' + U.fmtDate(sub.created_at) + ' for ' + (sub.form.submitter || 'the banker') + (sub.form.bankName ? ' (' + sub.form.bankName + ')' : '') + '.',
      'Material: ' + sub.file.name + ', ' + sub.file.pages + ' page' + (sub.file.pages === 1 ? '' : 's') + ', ' + (Prompts.DOC_LABELS[sub.form.docType] || sub.form.docType) + '.',
      'Lane: ' + sub.lane + ' (' + (sub.facts && sub.facts.laneReason ? sub.facts.laneReason : '') + '). Distribution: ' + ((sub.form.distribution || []).join(', ') || 'not stated') + '. Prepared by: ' + (sub.form.involvement || 'not stated') + '.',
      r.profile && r.profile.subject ? 'Subject: ' + r.profile.subject : '',
      '',
      'ATTENTION POINTS (' + c.total + '): Tier A ' + c.A + ' · Tier B ' + c.B + ' · Tier C ' + c.C + ' · asserted to the banker ' + c.certain + ' · awaiting your verification ' + c.verify,
      ...(verify.length ? ['', 'TO VERIFY (' + verify.length + ') — not shown to the banker:', ...verify.map((f) => line(f, sub.responses && sub.responses[f.id]))] : []),
      ...(high.length ? ['', 'Asserted, high:', ...high.map((f) => line(f, sub.responses && sub.responses[f.id]))] : []),
      ...(others.length ? ['', 'Asserted, medium and low:', ...others.map((f) => line(f, sub.responses && sub.responses[f.id]))] : []),
      '',
      cov.length ? 'ALREADY COVERED IN THE MATERIAL: ' + cov.join('; ') + '.' : 'ALREADY COVERED IN THE MATERIAL: nothing mapped.',
      (r.suppressed && r.suppressed.length) ? 'SET ASIDE: ' + r.suppressed.length + ' candidate' + (r.suppressed.length === 1 ? '' : 's') + ' a naive scan would have raised (' + r.suppressed.slice(0, 6).map((s) => s.rule + ' p.' + (s.pages || []).join('/')).join(', ') + (r.suppressed.length > 6 ? ', …' : '') + ').' : '',
      r.gut_check ? 'GUT CHECK: inaccurate picture ' + (r.gut_check.inaccurate_picture.flag ? 'YES' : 'no') + ' · unsupported claims ' + (r.gut_check.unsupported_claims.flag ? 'YES' : 'no') + ' · promised results ' + (r.gut_check.promised_results.flag ? 'YES' : 'no') + '.' : '',
      sub.form.notes ? '' : '',
      sub.form.notes ? 'BANKER NOTES: ' + sub.form.notes : '',
      '',
      r.brief ? 'BRIEF\n' + r.brief : '',
      '',
      r.banker_message ? 'SUGGESTED COMMENT TO THE BANKER\n' + r.banker_message : '',
      '',
      'Finalis Compliance · machine-generated pre-submission scan, calibrated on the reviewers\' verdicts. It is advisory: it is not an approval and it does not change any status.',
    ].filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n');
    return { subject, body };
  }

  function mailto(to, subject, body) {
    return 'mailto:' + encodeURIComponent(to || '') + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body.slice(0, 1800));
  }

  function reportMarkdown(sub) {
    const { subject, body } = compose(sub);
    return '# ' + subject + '\n\n' + body + '\n';
  }


  /* ---- PDF reports: the banker's summary (what they saw and answered) and the desk's brief (everything the
     pre-review produced, laid out as a desk memo the reviewer can annotate). ---- */
  function fmtDay(iso) { try { return new Date(iso || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; } }
  function ref(sub) { const d = new Date(sub.created_at || Date.now()); const ymd = d.toISOString().slice(2, 10).replace(/-/g, ''); return 'PRS-' + ymd + '-' + String(sub.id || 'draft').replace(/^sub-?/, '').slice(-6).toUpperCase(); }
  function where(f) { return f.page ? 'p. ' + (f.pages && f.pages.length > 1 ? f.pages.join(', ') : f.page) : 'document'; }
  function resp(sub, f) { const r = sub.responses && sub.responses[f.id]; return r && r.status && r.status !== 'none' ? RESP_LABEL[r.status] + (r.note ? ': ' + r.note.slice(0, 200) : '') : ''; }
  function verdictText(sub, f) { const v = sub.verdicts && sub.verdicts[f.id]; if (!v) return ''; if (!v.verdict) return v.reason ? 'Comment: ' + v.reason.slice(0, 200) : ''; return (Review.isCertain(f) ? (v.verdict === 'correct' ? 'Correct flag' : 'Incorrect flag') : (v.verdict === 'correct' ? 'Confirmed' : 'Dismissed')) + (v.reason ? ': ' + v.reason : ''); }
  const ACTION_TEXT = { add: 'Add the disclosure', rewrite: 'Rewrite', source: 'Add a source', remove: 'Remove', confirm: 'Confirm with the banker', escalate: 'Escalate' };
  function label(f) { return (RULES.CATEGORY_NAMES[f.rule] || f.category || f.rule); }
  function metaRows(sub, desk) {
    const p = (sub.result && sub.result.profile) || {};
    const rows = [];
    rows.push(['Reference', ref(sub)]);
    rows.push(['Submitted', fmtDay(sub.created_at)]);
    rows.push(['Document type', Prompts.DOC_LABELS[sub.form.docType] || sub.form.docType]);
    rows.push(['Audience', (sub.lane === 'institutional' ? 'Institutional' : 'Retail') + (sub.facts && sub.facts.laneReason ? ' (' + sub.facts.laneReason + ')' : '')]);
    rows.push(['Distribution', (sub.form.distribution || []).join(', ') || 'not stated']);
    rows.push(['Prepared by', (Prompts.INVOLVED_LABELS && Prompts.INVOLVED_LABELS[sub.form.involvement]) || sub.form.involvement || 'not stated']);
    if ((sub.version || 1) > 1) rows.push(['Version', 'v' + sub.version + ', corrected in the app (' + (sub.changes || []).length + ' edit' + ((sub.changes || []).length === 1 ? '' : 's') + ', ' + (sub.resolved || []).length + ' point' + ((sub.resolved || []).length === 1 ? '' : 's') + ' resolved)']);
    if (sub.readiness) rows.push(['Readiness', sub.readiness.score + ' / 100 · ' + sub.readiness.label]);
    if (sub.submitted_by && sub.submitted_by.name && !desk) rows.push(['Signed in as', sub.submitted_by.name + (sub.submitted_by.email ? ', ' + sub.submitted_by.email : '')]);
    if (desk) { rows.push(['Submitted by', (sub.submitter || 'unknown') + (sub.form.bankName ? ', ' + sub.form.bankName : '')]); rows.push(['Depth', sub.form.depth === 'default' ? 'Fast (one pass)' : 'Thorough (three passes)']); }
    else if (sub.form.bankName) rows.push(['Bank / DBA', sub.form.bankName]);
    return rows;
  }
  function pointDetail(sub, f, n, desk) {
    const rows = [];
    if (f.quote) rows.push(['Passage', '“' + f.quote + '”']);
    rows.push(['Issue', f.issue || '']);
    rows.push(['Action', (ACTION_TEXT[f.action] || 'Confirm') + (f.placement ? ' — ' + f.placement : '')]);
    if (f.text_to_add) rows.push(['Text to add', f.text_to_add]);
    if (f.rewrite) rows.push(['Suggested wording', f.rewrite]);
    if (desk && f.basis) rows.push(['Basis', f.basis]);
    if (desk) rows.push(['Confidence', (f.confidence || 'medium') + (f.det ? ' (deterministic check)' : '')]);
    if (f.note) rows.push(['Note', f.note]);
    if (!Review.isCertain(f)) rows.push([desk ? 'Not asserted' : 'Why pending', (f.why_verify || 'left to the reviewer')]);
    const r = resp(sub, f);
    if (r) rows.push([desk ? 'Banker' : 'Your answer', r, { bold: true }]);
    else if (desk) rows.push(['Banker', Review.isCertain(f) ? 'no answer' : 'no comment (not asked)', { muted: true }]);
    const v = desk ? verdictText(sub, f) : '';
    if (v) rows.push(['Verification', v, { bold: true }]);
    return { t: 'detail', n, sev: Review.isCertain(f) ? f.severity : 'pending', title: f.title, where: label(f) + ' · ' + f.rule + ' · ' + where(f), rows };
  }
  function indexTable(sub, list, desk, startN) {
    return { t: 'table', size: 8.8, cols: [{ w: 0.45, label: '#' }, { w: 4.2, label: 'Point' }, { w: 1.25, label: 'Where' }, { w: 2.0, label: 'Rule' }, { w: 1.5, label: 'Severity' }, { w: desk ? 2.4 : 2.1, label: desk ? 'Banker / verification' : 'Your answer' }],
      rows: list.map((f, i) => [{ text: String(startN + i), grey: true }, f.title, where(f), f.rule + ' ' + label(f), { sev: Review.isCertain(f) ? f.severity : 'pending' }, desk ? [resp(sub, f) || '—', verdictText(sub, f)].filter(Boolean).join('\n') : (resp(sub, f) || (f.severity === 'high' && Review.isCertain(f) ? 'answer needed' : '—'))]) };
  }
  function reportBlocks(sub, kind) {
    const desk = kind === 'desk';
    const r = sub.result || {};
    const p = r.profile || {};
    const findings = sub.findings || [];
    const c = Review.counts(findings);
    const certain = findings.filter((f) => Review.isCertain(f));
    const pending = findings.filter((f) => !Review.isCertain(f));
    const highs = certain.filter((f) => f.severity === 'high');
    const others = certain.filter((f) => f.severity !== 'high');
    const answered = Object.keys(sub.responses || {}).filter((k) => sub.responses[k].status !== 'none').length;
    const b = [];
    let sec = 0;
    const section = (t) => { sec += 1; b.push({ t: 'section', n: sec, text: t }); };
    b.push({ t: 'title', text: sub.file.name.replace(/\.[^.]+$/, ''), sub: [p.material_kind ? p.material_kind.charAt(0).toUpperCase() + p.material_kind.slice(1) : (Prompts.DOC_LABELS[sub.form.docType] || 'Marketing material'), sub.file.pages + (sub.file.kind === 'pdf' ? ' pages' : sub.file.kind === 'image' ? ' image' : ' sections'), sub.file.name].join(' · '), meta: metaRows(sub, desk) });

    const changesSection = () => {
      if (!(sub.changes && sub.changes.length)) return;
      section(desk ? 'Corrections made by the banker in the app' : 'Corrections you made in the app');
      b.push({ t: 'p', text: 'The submitted file is version ' + (sub.version || 2) + ': the original was corrected in the app and re-checked; the original text stays underneath the corrections (overlay), so the reviewer can still read what was there.' + ((sub.resolved || []).length ? ' ' + sub.resolved.length + ' point' + (sub.resolved.length === 1 ? '' : 's') + ' from the first pre-review ' + (sub.resolved.length === 1 ? 'was' : 'were') + ' resolved by these corrections.' : ''), muted: false });
      b.push({ t: 'table', size: 8.8, cols: [{ w: 0.45, label: '#' }, { w: 0.9, label: 'Page' }, { w: 2.4, label: 'Correction' }, { w: 8.0, label: 'Text as it now reads' }], rows: sub.changes.map((ch, i) => [String(i + 1), 'p. ' + ch.page, (ch.label || ch.kind), ch.kind === 'whiteout' ? { text: 'Passage removed', grey: true } : String(ch.text || '').slice(0, 320)]) });
      if (sub.resolved && sub.resolved.length) b.push({ t: 'table', size: 8.8, cols: [{ w: 1.1, label: 'Rule' }, { w: 0.9, label: 'Page' }, { w: 6.2, label: 'Point resolved' }, { w: 3.5, label: 'How' }], rows: sub.resolved.map((r0) => [r0.rule, r0.page ? 'p. ' + r0.page : 'doc', r0.title, r0.how]) });
    };
    if (!desk) {
      section('What this document is');
      b.push({ t: 'p', text: p.subject ? p.subject : 'Described by the pre-review as: ' + (p.material_kind || 'a marketing communication') + '.' });
      b.push({ t: 'p', text: 'The pre-review raises ' + c.certain + ' attention point' + (c.certain === 1 ? '' : 's') + ' on this document; ' + highs.length + ' high ' + (highs.length === 1 ? 'point needs' : 'points need') + ' an answer before submission.' });
      changesSection();
      section('Points to answer before submission');
      if (highs.length) { b.push(indexTable(sub, highs, false, 1)); highs.forEach((f, i) => b.push(pointDetail(sub, f, i + 1, false))); }
      else b.push({ t: 'p', text: 'None: no high point was asserted on this document.', muted: true });
      section('Points to read');
      if (others.length) b.push(indexTable(sub, others, false, highs.length + 1)); else b.push({ t: 'p', text: 'None.', muted: true });
      others.forEach((f, i) => b.push(pointDetail(sub, f, highs.length + i + 1, false)));
      section('After submission');
      b.push({ t: 'p', text: 'The document, the attention points, your answers and a brief go to the Finalis reviewer platform, a separate application.' + (c.verify ? ' ' + c.verify + ' further candidate' + (c.verify === 1 ? '' : 's') + ' the pre-review was not certain about ' + (c.verify === 1 ? 'goes' : 'go') + ' to the reviewer only.' : '') + ' The reviewer reads your answers, then approves or requests changes through the usual Compliance channel. This pre-review is advisory: it is not an approval and it changes no status.' });
      return b;
    }

    // ---- the desk brief: everything
    changesSection();
    if (sub.memory && ((sub.memory.similar || []).length || sub.memory.hints)) {
      section('Reviewer memory');
      if ((sub.memory.similar || []).length) b.push({ t: 'table', size: 8.8, cols: [{ w: 4.2, label: 'Similar submission' }, { w: 1.2, label: 'Alike' }, { w: 2.2, label: 'Reviewed by' }, { w: 1.8, label: 'Decision' }, { w: 2.4, label: 'Confirmed / dismissed' }], rows: sub.memory.similar.slice(0, 6).map((x) => [x.name, x.sameDoc ? 'same file' : Math.round(x.score * 100) + ' %', (x.reviewers || []).join(', ') || '–', x.decision ? (x.status === 'approved' ? 'Approved' : x.status === 'escalated' ? 'Escalated' : 'Changes requested') : 'open', Array.from(new Set(x.confirmed || [])).join(', ') + (x.dismissed && x.dismissed.length ? ' / ' + Array.from(new Set(x.dismissed)).join(', ') : '')]) });
      b.push({ t: 'p', text: (sub.memory.hints ? sub.memory.hints + ' point' + (sub.memory.hints === 1 ? '' : 's') + ' of this submission carried a colleague\'s verdict on similar material. ' : '') + (sub.memory.differs ? sub.memory.differs + ' verdict' + (sub.memory.differs === 1 ? '' : 's') + ' differ from a colleague\'s on a similar point.' : 'No verdict differs from a colleague\'s.'), muted: true });
    }
    section('Overview');
    b.push({ t: 'table', size: 9, cols: [{ w: 2.2, label: 'Asserted to the banker' }, { w: 1, label: 'High', align: 'right' }, { w: 1, label: 'Medium', align: 'right' }, { w: 1, label: 'Low', align: 'right' }, { w: 1.6, label: 'Pending', align: 'right' }, { w: 1.6, label: 'Answered', align: 'right' }, { w: 1.6, label: 'Set aside', align: 'right' }],
      rows: [[String(c.certain) + ' of ' + c.total, String(highs.length), String(others.filter((f) => f.severity === 'medium').length), String(others.filter((f) => f.severity === 'low').length), String(c.verify), String(answered), String((r.suppressed || []).length)]] });
    b.push({ t: 'p', text: 'Asserted points are deterministic checks (SOP blocks matched on the text layer) or model points located verbatim on the page, rated high confidence, kept by the second pass and corroborated by an independent signal; the banker saw them and had to answer the high ones. Points to verify were not shown to the banker at all: they are candidates the pre-review was not certain about, for you to confirm or dismiss.', muted: true });
    if (r.gut_check && !(r.meta && r.meta.deterministicOnly)) {
      b.push({ t: 'table', size: 9, cols: [{ w: 1, label: 'Gut check' }, { w: 5, label: 'Question' }, { w: 5, label: 'Why' }], rows: [['inaccurate_picture', 'Could an investor walk away with an inaccurate picture?'], ['unsupported_claims', 'Claims the banker could not back up right now?'], ['promised_results', 'A result promised instead of a target?']].map(([k, q]) => { const x = r.gut_check[k] || {}; return [{ sev: x.flag ? 'flag' : 'no' }, q, { text: x.why || '', grey: !x.why }]; }) });
    }
    let n = 0;
    section('Points awaiting your verification');
    if (pending.length) { b.push(indexTable(sub, pending, true, 1)); pending.forEach((f) => { n += 1; b.push(pointDetail(sub, f, n, true)); }); }
    else b.push({ t: 'p', text: 'None: every point was asserted.', muted: true });
    section('Points asserted to the banker');
    if (certain.length) { b.push(indexTable(sub, certain, true, n + 1)); certain.forEach((f) => { n += 1; b.push(pointDetail(sub, f, n, true)); }); }
    else b.push({ t: 'p', text: 'None.', muted: true });
    section('What the material already covers');
    const cov = p.coverage || {};
    const ck = Object.keys(cov);
    if (ck.length) b.push({ t: 'table', size: 9, cols: [{ w: 2.1, label: 'Item' }, { w: 1.35, label: 'Covered' }, { w: 3.1, label: 'Where' }, { w: 4.1, label: 'Wording' }], rows: ck.map((k) => { const x = cov[k] || {}; return [k.replace(/_/g, ' '), { sev: x.covered ? 'ok' : 'no' }, x.where || '', { text: x.quote ? '“' + String(x.quote).slice(0, 220) + '”' : '', grey: true }]; }) });
    else if (sub.facts && sub.facts.required) b.push({ t: 'table', size: 9, cols: [{ w: 1, label: 'Block' }, { w: 4, label: 'Name' }, { w: 3, label: 'Status' }], rows: sub.facts.required.map((q) => [q.id, q.name, q.status === 'present' ? 'Present on page ' + q.page + ' (match ' + q.score + '%)' : q.status === 'clear' ? 'Not present, as required' : q.status]) });
    else b.push({ t: 'p', text: 'No coverage map (the model was not available for this run).', muted: true });
    section('Document map');
    const roles = p.page_roles || {};
    const rk = Object.keys(roles);
    if (rk.length) {
      const src = p.sources_on_pages || {};
      b.push({ t: 'table', size: 8.8, cols: [{ w: 0.8, label: 'Page' }, { w: 2.4, label: 'Role' }, { w: 6.8, label: 'Sources and footnotes on the page' }], rows: rk.sort((a, z) => +a - +z).map((k) => [k, roles[k], { text: src[k] || '', grey: !src[k] }]) });
    }
    if (p.lane_basis) b.push({ t: 'kv', k: 'Lane basis', v: p.lane_basis });
    if (Array.isArray(p.audience_signals) && p.audience_signals.length) b.push({ t: 'kv', k: 'Audience signals', v: p.audience_signals.join('\n') });
    if (p.third_party_prepared !== undefined && p.third_party_prepared !== null) b.push({ t: 'kv', k: 'Third-party material', v: p.third_party_prepared ? 'yes' : 'no' });
    if (Array.isArray(p.notes) && p.notes.length) b.push({ t: 'kv', k: 'Notes from the first pass', v: p.notes.join('\n') });
    section('Brief');
    b.push({ t: 'p', text: r.brief || 'No brief (the model was not available for this run).' });
    section('Suggested comment to the banker');
    b.push({ t: 'p', text: r.banker_message || 'None.' });
    section('Candidates set aside');
    if (r.suppressed && r.suppressed.length) {
      b.push({ t: 'p', text: 'What a naive scanner would have raised and why a reviewer would not; kept here so a set-aside point can be reinstated in one look.', muted: true });
      b.push({ t: 'table', size: 8.5, cols: [{ w: 0.9, label: 'Rule' }, { w: 1.1, label: 'Pages' }, { w: 3, label: 'Passage' }, { w: 5, label: 'Reason' }], rows: r.suppressed.map((x) => [x.rule, (x.pages || []).join(', ') || '—', { text: x.quote ? '“' + x.quote.slice(0, 120) + '”' : '', grey: true }, x.reason || '']) });
    } else b.push({ t: 'p', text: 'None.', muted: true });
    section('Run details');
    const meta = r.meta || {};
    const details = [];
    if (meta.calls && meta.calls.length) details.push(['Model calls', meta.calls.map((x) => x.pass + (x.batch ? ' ' + x.batch : '') + ': ' + Math.round(x.ms / 1000) + ' s, ' + Math.round(x.bytes / 1024) + ' KB' + (x.images ? ', ' + x.images + ' page images' : '')).join('; ')]);
    if (meta.learning) details.push(['Learning applied', meta.learning.rules + ' learned rule' + (meta.learning.rules === 1 ? '' : 's') + (meta.learning.reviewerRules ? ' (' + meta.learning.reviewerRules + ' from the reviewer)' : '') + ', ' + meta.learning.precedents + ' precedent' + (meta.learning.precedents === 1 ? '' : 's') + ' from ' + (meta.learning.verdicts || 0) + ' reviewer verdicts' + (meta.learning.reviewer ? ', adapted to ' + meta.learning.reviewer : '')]);
    if (meta.reference) details.push(['Source', 'Reference pre-review (the reviewer\'s verdicts on the calibration deck), not a live run']);
    if (meta.deterministicOnly) details.push(['Source', 'Deterministic checks only: the model was not available']);
    if (sub.calibration) details.push(['Calibration', sub.calibration.recall + '/' + sub.calibration.expectedTotal + ' validated flags found, ' + sub.calibration.fpCount + ' rejected flags raised']);
    if (sub.file && sub.file.sha) details.push(['File hash', String(sub.file.sha).slice(0, 16) + '…']);
    details.forEach(([k, v]) => b.push({ t: 'kv', k, v }));
    b.push({ t: 'sign' });
    return b;
  }
  function reportPdf(sub, kind) {
    const desk = kind === 'desk';
    return PdfOut.blob({
      title: (desk ? 'Reviewer brief ' : 'Pre-review summary ') + ref(sub) + ' ' + sub.file.name,
      brand: 'finalis', product: desk ? 'Reviewer platform' : 'Marketing materials',
      kicker: desk ? 'Reviewer brief' : 'Pre-review summary', date: fmtDay(sub.created_at),
      accent: desk ? [0.06, 0.48, 0.42] : [0.18, 0.37, 0.89],
      footerLeft: desk ? 'Confidential. Machine-prepared pre-review for the reviewer; the reviewer decides.' : 'Advisory pre-review. Not an approval; it changes no status.',
      footerRight: ref(sub),
      blocks: reportBlocks(sub, kind),
    });
  }
  function reportFilename(sub, kind) { return (kind === 'desk' ? 'reviewer-brief-' : 'pre-review-summary-') + String(sub.file.name || 'document').replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60) + '.pdf'; }

  return { compose, mailto, reportMarkdown, reportBlocks, reportPdf, reportFilename, RESP_LABEL, ACTION_LABEL };
})();
