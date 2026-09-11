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
    if (f.assurance === 'verify') s += '\n    Not asserted to the banker' + (f.why_verify ? ': ' + f.why_verify : '') + '. Please confirm or dismiss.';
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
      ...(verify.length ? ['', 'AWAITING YOUR VERIFICATION (' + verify.length + ') — shown to the banker as pending, not as facts:', ...verify.map((f) => line(f, sub.responses && sub.responses[f.id]))] : []),
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
      'Finalis Compliance · machine-generated pre-submission scan, calibrated on the desk\'s verdicts. It is advisory: it is not an approval and it does not change any status.',
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


  /* ---- PDF reports: the banker's summary (what they saw, what they answered) and the desk's full brief ---- */
  function fmtDay(iso) { try { return new Date(iso || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } }
  function where(f) { return f.page ? 'p. ' + (f.pages && f.pages.length > 1 ? f.pages.join(', ') : f.page) : 'document'; }
  function sevLabel(f) { return f.severity === 'high' ? 'High' : f.severity === 'medium' ? 'Medium' : 'Low'; }
  function respText(sub, f) { const r = sub.responses && sub.responses[f.id]; return r && r.status && r.status !== 'none' ? RESP_LABEL[r.status] + (r.note ? ' (' + r.note.slice(0, 160) + ')' : '') : ''; }
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
    const laneLabel = sub.lane === 'institutional' ? 'Institutional' : 'Retail';
    const b = [];
    b.push({ t: 'h1', text: sub.file.name });
    b.push({ t: 'small', text: [laneLabel, sub.file.pages + (sub.file.kind === 'pdf' ? ' pages' : sub.file.kind === 'image' ? ' image' : ' sections'), Prompts.DOC_LABELS[sub.form.docType] || sub.form.docType, fmtDay(sub.created_at)].join(' · ') });
    b.push({ t: 'h2', text: desk ? 'Submission' : 'Your document' });
    if (p.material_kind || p.subject) b.push({ t: 'kv', k: 'What it is', v: [p.material_kind ? p.material_kind.charAt(0).toUpperCase() + p.material_kind.slice(1) : '', p.subject].filter(Boolean).join(': ') });
    if (desk) b.push({ t: 'kv', k: 'Submitted by', v: (sub.submitter || 'unknown') + (sub.form.bankName ? ' · ' + sub.form.bankName : '') });
    b.push({ t: 'kv', k: 'Audience', v: laneLabel + (sub.facts && sub.facts.laneReason ? ' · ' + sub.facts.laneReason : '') });
    b.push({ t: 'kv', k: 'Distribution', v: (sub.form.distribution || []).join(', ') || 'not stated' });
    b.push({ t: 'kv', k: 'Prepared by', v: Prompts.INVOLVED_LABELS ? (Prompts.INVOLVED_LABELS[sub.form.involvement] || sub.form.involvement || 'not stated') : (sub.form.involvement || 'not stated') });
    if (sub.form.notes) b.push({ t: 'kv', k: 'Banker notes', v: sub.form.notes });
    b.push({ t: 'h2', text: desk ? 'Attention points' : 'What Compliance will ask you' });
    b.push({ t: 'p', text: c.total + ' attention point' + (c.total === 1 ? '' : 's') + ': ' + c.certain + ' asserted' + (desk ? ' to the banker' : '') + ' (' + highs.length + ' high), ' + c.verify + ' left to the Finalis reviewer' + (desk ? ' for verification' : '') + '. ' + (answered ? answered + ' answer' + (answered === 1 ? '' : 's') + ' given by the banker.' : desk ? 'No answer from the banker yet.' : '') });
    if (highs.length) {
      if (desk) b.push({ t: 'h2', text: 'Asserted, high' });
      highs.forEach((f, i) => b.push({ t: 'li', mark: String(i + 1), bold: true, text: f.title + ' (' + f.rule + ', ' + where(f) + ')', sub: [f.quote ? '“' + f.quote.slice(0, 200) + '”' : '', (ACTION_LABEL[f.action] || 'Confirm') + ': ' + (f.issue || '').slice(0, desk ? 400 : 220), respText(sub, f) ? 'Banker: ' + respText(sub, f) : (desk ? 'Banker: no answer' : 'Your answer: none yet')].filter(Boolean).join('\n') }));
    } else b.push({ t: 'p', text: 'No high point' + (desk ? ' asserted.' : ' to answer.') });
    if (others.length) {
      b.push({ t: 'h2', text: desk ? 'Asserted, medium and low' : 'Further points (no answer required)' });
      others.forEach((f) => b.push({ t: 'li', text: '[' + sevLabel(f) + '] ' + f.title + ' (' + f.rule + ', ' + where(f) + ')', sub: [f.quote ? '“' + f.quote.slice(0, 160) + '”' : '', desk ? (ACTION_LABEL[f.action] || 'Confirm') + ': ' + (f.issue || '').slice(0, 300) : '', respText(sub, f) ? 'Banker: ' + respText(sub, f) : ''].filter(Boolean).join('\n') }));
    }
    if (pending.length) {
      b.push({ t: 'h2', text: desk ? 'Awaiting your verification' : 'Left to the Finalis reviewer' });
      if (!desk) b.push({ t: 'p', text: 'Possible points the pre-review was not certain enough to assert. The reviewer confirms or dismisses them; nothing for you to do.' });
      pending.forEach((f) => {
        const v = desk && sub.verdicts && sub.verdicts[f.id];
        b.push({ t: 'li', text: '[' + sevLabel(f) + '] ' + f.title + ' (' + f.rule + ', ' + where(f) + ')', sub: [f.quote ? '“' + f.quote.slice(0, 160) + '”' : '', desk ? (ACTION_LABEL[f.action] || 'Confirm') + ': ' + (f.issue || '').slice(0, 300) : '', 'Not asserted' + (f.why_verify ? ': ' + f.why_verify : ''), respText(sub, f) ? 'Banker: ' + respText(sub, f) : '', v ? 'Verification: ' + (v.verdict === 'correct' ? 'confirmed' : 'dismissed') + (v.reason ? ' (' + v.reason + ')' : '') : ''].filter(Boolean).join('\n') });
      });
    }
    if (!desk) {
      b.push({ t: 'h2', text: 'When you submit' });
      b.push({ t: 'p', text: 'Your document, these points, your answers and a machine-written brief go to the Finalis Compliance desk, a separate application. The reviewer verifies the pending points, then approves or requests changes through the usual Compliance channel.' });
    } else {
      const cov = p.coverage || {};
      const keys = Object.keys(cov);
      if (keys.length) {
        b.push({ t: 'h2', text: 'Already covered in the material' });
        keys.forEach((k) => { const x = cov[k] || {}; b.push({ t: 'li', mark: x.covered ? '✓' : '✗', text: k.replace(/_/g, ' ') + (x.covered ? '' : ' · not covered') + (x.where ? ' · ' + String(x.where).slice(0, 120) : ''), sub: x.quote ? '“' + String(x.quote).slice(0, 140) + '”' : '' }); });
      }
      if (r.gut_check && !(r.meta && r.meta.deterministicOnly)) {
        b.push({ t: 'h2', text: '60-second gut check' });
        [['inaccurate_picture', 'Could an investor walk away with an inaccurate picture?'], ['unsupported_claims', 'Claims the banker could not back up right now?'], ['promised_results', 'A result promised instead of a target?']].forEach(([k, q]) => { const x = r.gut_check[k] || {}; b.push({ t: 'li', mark: x.flag ? 'Yes' : 'No', text: q, sub: x.why || '' }); });
      }
      if (r.brief) { b.push({ t: 'h2', text: 'Brief' }); b.push({ t: 'p', text: r.brief }); }
      if (r.banker_message) { b.push({ t: 'h2', text: 'Comment to the banker' }); b.push({ t: 'p', text: r.banker_message }); }
      if (r.suppressed && r.suppressed.length) {
        b.push({ t: 'h2', text: 'Set aside (' + r.suppressed.length + ' candidates a naive scan would have raised)' });
        r.suppressed.slice(0, 14).forEach((s) => b.push({ t: 'small', text: s.rule + ' · p. ' + ((s.pages || []).join(', ') || '–') + (s.quote ? ' · “' + s.quote.slice(0, 80) + '”' : '') + ' · ' + (s.reason || '').slice(0, 220) }));
        if (r.suppressed.length > 14) b.push({ t: 'small', text: '… and ' + (r.suppressed.length - 14) + ' more.' });
      }
      if (r.meta && r.meta.calls && r.meta.calls.length) b.push({ t: 'small', text: 'Model calls: ' + r.meta.calls.map((x) => x.pass + (x.batch ? ' ' + x.batch : '') + ' ' + Math.round(x.ms / 1000) + ' s, ' + Math.round(x.bytes / 1024) + ' KB' + (x.images ? ', ' + x.images + ' images' : '')).join(' · ') });
    }
    b.push({ t: 'gap', h: 6 });
    b.push({ t: 'small', text: 'Finalis AI Prescreen · machine-generated pre-submission scan, calibrated on the desk\'s verdicts. Advisory: it is not an approval and it does not change any status.' });
    return b;
  }
  function reportPdf(sub, kind) {
    const desk = kind === 'desk';
    return PdfOut.blob({
      title: (desk ? 'Compliance brief · ' : 'Pre-review summary · ') + sub.file.name,
      header: 'Finalis AI Prescreen · ' + (desk ? 'Compliance desk brief' : 'Pre-review summary'),
      headerRight: fmtDay(sub.created_at),
      footer: desk ? 'Confidential · Compliance desk' : 'Advisory: not an approval',
      blocks: reportBlocks(sub, kind),
    });
  }
  function reportFilename(sub, kind) { return (kind === 'desk' ? 'compliance-brief-' : 'pre-review-summary-') + String(sub.file.name || 'document').replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60) + '.pdf'; }

  return { compose, mailto, reportMarkdown, reportBlocks, reportPdf, reportFilename, RESP_LABEL, ACTION_LABEL };
})();
