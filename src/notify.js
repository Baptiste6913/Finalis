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

  return { compose, mailto, reportMarkdown, RESP_LABEL, ACTION_LABEL };
})();
