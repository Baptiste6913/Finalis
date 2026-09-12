'use strict';
/* Fix: the banker corrects the document inside the app. An edit is a text box or a white-out placed on a
   page in page fractions (x, y, w, h of the page, y from the top), the same space as the highlight boxes.
   The module proposes the fix for each attention point (the SOP text on the right page, the rewrite in
   place of the quoted passage, a source line under an exhibit), builds the corrected PDF through PdfEdit,
   re-checks the corrected version deterministically (text under a white-out counts as removed), and
   computes the readiness score shown to the banker and used to sort the reviewer's queue. */
const Fix = (() => {
  const INK = [0.09, 0.1, 0.13];
  const COVERAGE_KEY = { B1: 'forecast', B2: 'illustration', B3: 'past_perf', B4: 'pref', B5: 'distributions', B6: 'logos', B7: 'testimonial', B9: 'real_estate' };
  const GENERIC = { B1: 'forward_generic', B2: 'forward_generic', B3: 'past_perf', B9: 'risk_generic' };
  function pageOf(doc, n) { return doc.pages.find((p) => p.number === n) || doc.pages[0]; }
  function lineHeightFrac(page, size) { return (size * 1.25) / (page.height || 792); }
  /* height of a text box from its wrapped lines, in page fractions */
  function autoHeight(edit, page) {
    const size = edit.size || 8; const pad = size * 0.45;
    const lines = PdfOut.wrap(edit.text || ' ', edit.box.w * page.width - 2 * pad, size, !!edit.bold);
    return (Math.max(1, lines.length) * size * 1.25 + 2 * pad + size * 0.1) / page.height;
  }
  function union(boxes) {
    const w0 = Math.max(...boxes.map((b) => b.w || 0)) || 0.3;
    const x = Math.min(...boxes.map((b) => b.x)); const y = Math.min(...boxes.map((b) => b.y));
    const r = Math.max(...boxes.map((b) => b.x + (b.w || w0))); const bt = Math.max(...boxes.map((b) => b.y + (b.h || 0.02)));
    return { x, y, w: r - x, h: bt - y };
  }
  function sizeFromBoxes(boxes, page) {
    const hs = boxes.map((b) => b.h * page.height / 1.02).filter((h) => h > 2);
    if (!hs.length) return 9;
    hs.sort((a, b) => a - b);
    return Math.max(5, Math.min(48, Math.round(hs[Math.floor(hs.length / 2)] * 10) / 10));
  }
  function make(doc, spec) {
    const page = pageOf(doc, spec.page);
    const e = Object.assign({ id: U.uid('ed'), kind: 'text', size: 7.5, bold: false, text: '', whiteout: [], fid: null, label: 'Text box', origin: 'custom' }, spec, { page: page.number });
    if (e.kind !== 'whiteout' && !spec.noAuto) e.box = Object.assign({}, e.box, { h: Math.max(e.box.h || 0, autoHeight(e, page)) });
    return e;
  }
  function targetPage(f, doc) {
    const last = doc.pages[doc.pages.length - 1].number;
    const pl = String(f.placement || '').toLowerCase();
    if (/first page|cover/.test(pl)) return 1;
    if (/last page|disclaimers page|footer|end of/.test(pl)) return f.page && /disclaimers page/.test(pl) ? f.page : last;
    return f.page || last;
  }
  function bandBox(page, existing, size) {
    // the lowest band of the page that carries no text and no edit yet; the bottom of the page otherwise
    const h = lineHeightFrac(page, size || 7.5) * 2.2;
    const x0 = 0.06; const x1 = 0.94;
    const blocks = (page.spans || []).map((sp) => sp.box).concat((existing || []).filter((e) => e.page === page.number && e.kind !== 'whiteout').map((e) => e.box));
    const clash = (y) => blocks.some((b) => b && b.x < x1 && b.x + (b.w || 0) > x0 && b.y < y + h && b.y + (b.h || 0) > y);
    for (let y = 0.965 - h; y >= 0.04; y -= 0.01) { if (!clash(y)) return { x: x0, y: Math.round(y * 1000) / 1000, w: x1 - x0, h }; }
    const taken = (existing || []).filter((e) => e.page === page.number && e.kind !== 'whiteout' && e.box.y > 0.6);
    const top = taken.length ? Math.min(...taken.map((e) => e.box.y)) : 0.965;
    return { x: x0, y: Math.max(0.04, top - h - 0.006), w: x1 - x0, h };
  }
  /* the ways a point can be fixed in the document; the first option is the default used by "Apply all" */
  function fillNames(text, form) {
    const bank = (form && form.bankName) || '';
    if (!bank) return text;
    return String(text || '').replace(/\{Bank Name\}|\[Firm Name\]|\[Bank Name\]|\{Firm Name\}/g, bank);
  }
  function optionsFor(f, doc, existing, form) {
    const opts = [];
    const last = doc.pages[doc.pages.length - 1].number;
    const located = f.boxes && f.boxes.length;
    const page = located ? pageOf(doc, f.boxes[0].page) : null;
    if (f.text_to_add && f.rule !== 'A4') {
      const n = targetPage(f, doc);
      const legend = f.rule === 'A3';
      opts.push({ key: 'add', label: legend ? 'Add the legend to the first page' : 'Add the disclosure to page ' + n, page: n, auto: f.action !== 'confirm',
        make: () => make(doc, { fid: f.id, origin: 'add', page: n, text: fillNames(f.text_to_add, form), size: legend ? 9 : 7, bold: legend, box: legend ? { x: 0.56, y: 0.025, w: 0.4, h: 0.03 } : bandBox(pageOf(doc, n), existing, 7), label: (legend ? 'Legend added' : 'Disclosure added') + ' · ' + f.rule }) });
    }
    if (located && f.rewrite) {
      const u = union(f.boxes.filter((b) => b.page === f.boxes[0].page));
      const size = sizeFromBoxes(f.boxes, page);
      opts.push({ key: 'replace', label: 'Replace the passage in place', page: page.number, auto: true,
        make: () => make(doc, { fid: f.id, origin: 'replace', kind: 'replace', page: page.number, text: f.rewrite, size, bold: false, whiteout: f.boxes.map((b) => ({ x: b.x - 0.002, y: b.y - 0.002, w: (b.w || u.w) + 0.004, h: (b.h || 0.02) + 0.004 })), box: { x: u.x, y: u.y, w: Math.max(u.w, 0.3), h: u.h }, pad: 0, label: 'Passage rewritten · ' + f.rule }) });
    }
    if (located && (f.action === 'remove' || f.rule === 'A4' || f.tier === 'C')) {
      opts.push({ key: 'remove', label: 'Remove the passage', page: page.number, auto: f.action === 'remove' || f.rule === 'A4',
        make: () => { const u = union(f.boxes); return make(doc, { fid: f.id, origin: 'remove', kind: 'whiteout', page: page.number, whiteout: f.boxes.map((b) => ({ x: b.x - 0.002, y: b.y - 0.002, w: (b.w || u.w) + 0.004, h: (b.h || 0.02) + 0.004 })), box: u, text: '', label: 'Passage removed · ' + f.rule }); } });
    }
    if (f.action === 'source' || f.rule === 'A7' || f.rule === 'C4') {
      const n = f.page || last; const pg = pageOf(doc, n);
      const below = located ? { x: f.boxes[0].x, y: Math.min(0.96, union(f.boxes).y + union(f.boxes).h + 0.004), w: Math.max(0.35, union(f.boxes).w), h: 0.02 } : bandBox(pg, existing, 6.5);
      opts.push({ key: 'source', label: 'Add a source line', page: n, auto: false,
        make: () => make(doc, { fid: f.id, origin: 'source', page: n, text: 'Source: ' + (f.text_to_add && /source/i.test(f.text_to_add) ? f.text_to_add.replace(/^source:\s*/i, '') : 'Information provided by Sponsoring/Issuing Company.'), size: 6.5, box: below, label: 'Source line added · ' + f.rule }) });
    }
    const n = f.page || last;
    opts.push({ key: 'custom', label: 'Add a text box on page ' + n, page: n, auto: false, make: () => make(doc, { fid: f.id, origin: 'custom', page: n, text: '', size: 8, box: bandBox(pageOf(doc, n), existing, 8), label: 'Text box · ' + f.rule }) });
    return opts;
  }
  function defaultOption(f, doc, existing, form) { return optionsFor(f, doc, existing, form).find((o) => o.auto) || null; }

  /* corrected PDF: one PdfEdit page entry per page that carries edits */
  async function corrected(doc, edits) {
    const byPage = {};
    edits.forEach((e) => { (byPage[e.page] = byPage[e.page] || []).push(e); });
    const pages = [];
    for (const n of Object.keys(byPage)) {
      const page = await doc.pdf.getPage(+n);
      const vp = page.getViewport({ scale: 1 });
      const items = byPage[n].map((e) => ({ kind: e.kind, box: e.box, whiteout: e.whiteout, text: e.kind === 'whiteout' ? '' : e.text, size: e.size, bold: e.bold, pad: e.pad, color: INK, border: e.kind === 'text' && e.border ? [0.8, 0.8, 0.8] : null }));
      pages.push({ num: page.ref.num, gen: page.ref.gen, viewport: { transform: vp.transform, width: vp.width, height: vp.height }, items });
    }
    return PdfEdit.correct(doc.bytes, pages);
  }
  /* pages of the corrected document with the white-out text removed: the file keeps the covered text in its
     content stream (the edit is an overlay), so the re-check must not read it */
  function maskPages(pages, edits) {
    return pages.map((p) => {
      const wos = edits.filter((e) => e.page === p.number && e.whiteout && e.whiteout.length).flatMap((e) => e.whiteout);
      if (!wos.length || !p.spans) return p;
      // the text the banker set in place of a passage is drawn inside the white box: it stays
      const added = edits.filter((e) => e.page === p.number && e.kind !== 'whiteout' && e.text).map((e) => U.normalize(e.text));
      const isNew = (sp) => { const t = U.normalize(sp.text || ''); return t.length >= 3 && added.some((a) => a.includes(t)); };
      const keep = p.spans.filter((sp) => { if (isNew(sp)) return true; const cx = sp.box.x + sp.box.w / 2; const cy = sp.box.y + sp.box.h / 2; return !wos.some((w) => cx >= w.x && cx <= w.x + w.w && cy >= w.y && cy <= w.y + w.h); });
      if (keep.length === p.spans.length) return p;
      let text = ''; const spans = [];
      keep.forEach((sp) => { const start = text.length; text += sp.text + (p.text.charAt(sp.end) === '\n' ? '\n' : ' '); spans.push(Object.assign({}, sp, { start, end: start + sp.text.length })); });
      const flat = U.collapse(text);
      return Object.assign({}, p, { text, search: flat.text, searchMap: flat.map, spans, charCount: text.replace(/\s/g, '').length, masked: p.spans.length - keep.length });
    });
  }
  /* deterministic re-check of the corrected version: which points are resolved, which stay open */
  function recheck(findings, facts, pages, form, edits) {
    const tierA = Review.tierAFindings(facts, form);
    const covFound = {}; (facts.coverage || []).forEach((c) => { covFound[c.key] = c.found; });
    const out = []; const resolved = [];
    // text the banker added for a point, now present on the page (disclosure, legend, source line)
    const addedFor = (f) => (edits || []).filter((e) => e.fid === f.id && e.kind === 'text' && (e.origin === 'add' || e.origin === 'source') && e.text && e.text.trim().length >= 12).some((e) => {
      const page = pages.find((p) => p.number === e.page); if (!page) return false;
      const want = f.text_to_add ? fillNames(f.text_to_add, form) : e.text; // the SOP wording (with the firm name filled) or the source line
      const hit = Engine.locate(page, want.slice(0, 200)); return !!(hit && hit.score >= 85);
    });
    findings.forEach((f) => {
      const g = Object.assign({}, f);
      if (f.tier !== 'A' && (f.text_to_add || f.action === 'source') && addedFor(f)) { resolved.push(Object.assign(g, { resolved: { how: f.action === 'source' || f.rule === 'A7' ? 'source line added' : 'disclosure added', version: 2 } })); return; }
      if (f.tier === 'A') {
        const still = tierA.find((a) => a.rule === f.rule && (a.page || null) === (f.page || null));
        if (still) { out.push(Object.assign(g, { boxes: still.boxes || g.boxes })); } else resolved.push(Object.assign(g, { resolved: { how: f.rule === 'A4' ? 'legend removed' : (f.rule === 'A6' ? 'legend reset' : 'text added'), version: 2 } }));
        return;
      }
      if (f.quote) {
        const page = pages.find((p) => p.number === (f.page || (f.boxes && f.boxes[0] && f.boxes[0].page)));
        const hit = page ? Engine.locate(page, f.quote) : null;
        if (!hit || hit.score < 80) { resolved.push(Object.assign(g, { resolved: { how: 'passage removed or rewritten', version: 2 }, boxes: [] })); return; }
        g.boxes = hit.boxes && hit.boxes.length ? hit.boxes : g.boxes; g.range = { start: hit.start, end: hit.end };
        if (f.tier === 'B' && f.text_to_add) {
          const key = COVERAGE_KEY[f.rule]; const gen = GENERIC[f.rule];
          if ((key && covFound[key]) || (gen && covFound[gen] && (f.rule === 'B1' || f.rule === 'B2' || f.rule === 'B3' || f.rule === 'B9'))) { resolved.push(Object.assign(g, { resolved: { how: 'disclosure added', version: 2 } })); return; }
        }
        out.push(g); return;
      }
      if (f.tier === 'B' && f.text_to_add) {
        const key = COVERAGE_KEY[f.rule]; const gen = GENERIC[f.rule];
        if ((key && covFound[key]) || (gen && covFound[gen])) { resolved.push(Object.assign(g, { resolved: { how: 'disclosure added', version: 2 } })); return; }
      }
      out.push(g);
    });
    // new deterministic points the corrected version may raise (a legend now too small, for instance)
    tierA.forEach((a) => { if (!out.some((f) => f.tier === 'A' && f.rule === a.rule && (f.page || null) === (a.page || null))) out.push(Object.assign({}, a, { id: a.id || U.uid('f'), assurance: a.unreadable ? 'verify' : 'certain', new_in_version: 2 })); });
    return { findings: out, resolved };
  }
  function changeLog(edits, findings) {
    return edits.map((e) => { const f = findings.find((x) => x.id === e.fid); return { page: e.page, kind: e.kind, label: e.label, text: e.kind === 'whiteout' ? '' : e.text, rule: f ? f.rule : '', point: f ? f.title : '', fid: e.fid || null, box: e.box, whiteout: e.whiteout || [] }; });
  }
  /* readiness: 100 minus the open points, weighted by severity; a missing required block weighs more */
  const WEIGHT = { high: 12, medium: 6, low: 2 };
  function readiness(findings, responses, opts) {
    const all = opts && opts.all;
    let score = 100; const rows = [];
    findings.forEach((f) => {
      if (f.resolved) return;
      if (!all && !Review.isCertain(f)) return;
      const r = responses && responses[f.id];
      if (r && (r.status === 'fixed' || r.status === 'covered')) return;
      let w = WEIGHT[f.severity] || 2;
      if (f.tier === 'A') w += 3;
      if (all && !Review.isCertain(f)) w = Math.ceil(w / 2);
      score -= w; rows.push({ id: f.id, w });
    });
    score = Math.max(0, Math.round(score));
    const band = score >= 85 ? 'b-ready' : score >= 60 ? 'b-work' : 'b-notready';
    return { score, band, label: band === 'b-ready' ? 'Ready for review' : band === 'b-work' ? 'Needs work' : 'Not ready', open: rows.length };
  }
  return { optionsFor, defaultOption, make, autoHeight, fillNames, corrected, maskPages, recheck, changeLog, readiness, union, INK };
})();
