'use strict';
/* A small PDF writer, no library: A4, Helvetica and Helvetica-Bold (standard fonts, nothing embedded), WinAnsi
   text, word wrapping from the Helvetica metrics, filled rectangles, tables that break across pages with the
   header row repeated, numbered sections, a title block and a signature block. Enough for a desk memo. */
const PdfOut = (() => {
  const W = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
  const MAP = { '‘': 0x91, '’': 0x92, '‚': 0x82, '“': 0x93, '”': 0x94, '„': 0x84, '–': 0x96, '—': 0x97, '…': 0x85, '•': 0x95, '€': 0x80, '™': 0x99, 'Š': 0x8a, 'Œ': 0x8c, 'Ž': 0x8e, 'š': 0x9a, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f, ' ': 0x20, ' ': 0x20, ' ': 0x20, '→': 0x3e, '✓': 0x2b, '✗': 0x2d, '☐': 0x5b, '□': 0x5b };
  const SEV = { high: { rgb: [0.71, 0.14, 0.09], label: 'High' }, medium: { rgb: [0.71, 0.28, 0.03], label: 'Medium' }, low: { rgb: [0.02, 0.46, 0.28], label: 'Low' }, pending: { rgb: [0.41, 0.25, 0.78], label: 'Pending' }, ok: { rgb: [0.02, 0.46, 0.28], label: 'Yes' }, no: { rgb: [0.45, 0.45, 0.45], label: 'No' }, flag: { rgb: [0.71, 0.14, 0.09], label: 'Yes' } };
  const LOGO = (typeof window !== 'undefined' && window.FINALIS_LOGO_JPG && window.FINALIS_LOGO_JPG.b64) ? window.FINALIS_LOGO_JPG : null;
  function code(ch) {
    const c = ch.charCodeAt(0);
    if (c < 0x80) return c === 0x0a ? 0x20 : c;
    if (c >= 0xa0 && c <= 0xff) return c;
    if (MAP[ch] !== undefined) return MAP[ch];
    return 0x3f;
  }
  function bytesOf(str) { const out = []; const s = String(str); for (let i = 0; i < s.length; i += 1) out.push(code(s[i])); return out; }
  function width(str, size, bold) {
    let w = 0; const s = String(str);
    for (let i = 0; i < s.length; i += 1) { const c = code(s[i]); w += c >= 32 && c <= 126 ? W[c - 32] : 556; }
    return (w * size) / 1000 * (bold ? 1.05 : 1);
  }
  function esc(bytes) {
    let s = '';
    bytes.forEach((b) => { if (b === 0x28 || b === 0x29 || b === 0x5c) s += '\\' + String.fromCharCode(b); else if (b < 32) s += ' '; else s += String.fromCharCode(b); });
    return s;
  }
  function wrap(text, maxWidth, size, bold) {
    const lines = [];
    String(text === undefined || text === null ? '' : text).split(/\r?\n/).forEach((para) => {
      const words = para.split(/\s+/).filter(Boolean);
      if (!words.length) { lines.push(''); return; }
      let cur = '';
      words.forEach((w) => {
        while (width(w, size, bold) > maxWidth) {
          let k = w.length;
          while (k > 1 && width(w.slice(0, k), size, bold) > maxWidth) k -= 1;
          if (cur) { lines.push(cur); cur = ''; }
          lines.push(w.slice(0, k)); w = w.slice(k);
        }
        const trial = cur ? cur + ' ' + w : w;
        if (width(trial, size, bold) <= maxWidth) cur = trial; else { lines.push(cur); cur = w; }
      });
      if (cur) lines.push(cur);
    });
    return lines;
  }
  const n2 = (n) => (Math.round(n * 100) / 100).toString();
  const rgb = (c) => n2(c[0]) + ' ' + n2(c[1]) + ' ' + n2(c[2]);

  function make(doc) {
    const PW = 595.28, PH = 841.89, M = 54, TOP = PH - 78, BOTTOM = 58, CW = PW - 2 * M;
    const accent = doc.accent || [0.18, 0.37, 0.89];
    const INK = [0.07, 0.09, 0.15], MUTED = [0.42, 0.45, 0.5], RULE = [0.86, 0.88, 0.91], SOFT = [0.96, 0.97, 0.98];
    const pages = [];
    let ops = [];
    let y = TOP;
    pages.push(ops);
    function newPage() { ops = []; pages.push(ops); y = TOP; }
    function need(h) { if (y - h < BOTTOM) newPage(); }
    function txt(x, yy, str, size, bold, color) { ops.push('BT /' + (bold ? 'F2' : 'F1') + ' ' + n2(size) + ' Tf ' + rgb(color || INK) + ' rg ' + n2(x) + ' ' + n2(yy) + ' Td (' + esc(bytesOf(str)) + ') Tj ET'); }
    function hline(x1, yy, x2, color, w) { ops.push(rgb(color || RULE) + ' RG ' + n2(w || 0.6) + ' w ' + n2(x1) + ' ' + n2(yy) + ' m ' + n2(x2) + ' ' + n2(yy) + ' l S'); }
    function box(x, yy, w, h, color) { ops.push(rgb(color) + ' rg ' + n2(x) + ' ' + n2(yy) + ' ' + n2(w) + ' ' + n2(h) + ' re f'); }
    function lines(str, x, maxW, size, bold, color, lh) {
      const ls = wrap(str, maxW, size, bold);
      ls.forEach((l) => { need(lh); txt(x, y - size, l, size, bold, color); y -= lh; });
      return ls.length;
    }
    function para(str, size, bold, color, indent, after) { lines(str, M + (indent || 0), CW - (indent || 0), size, bold, color, size * 1.42); y -= after === undefined ? size * 0.55 : after; }
    // a severity mark: small filled square and a label, returns the width used
    function sevMark(x, yy, key, size) {
      const s = SEV[key] || SEV.pending;
      box(x, yy - 0.5, 6, 6, s.rgb);
      txt(x + 9, yy - 1.2, s.label, size || 8.5, false, s.rgb);
      return 9 + width(s.label, size || 8.5, false) + 6;
    }
    function cellText(cell) { return typeof cell === 'object' && cell !== null ? String(cell.text === undefined ? '' : cell.text) : String(cell === undefined || cell === null ? '' : cell); }
    function table(b) {
      const size = b.size || 9, lh = size * 1.38, pad = 5;
      const totalFr = b.cols.reduce((a, c) => a + (c.w || 1), 0);
      const widths = b.cols.map((c) => (c.w || 1) / totalFr * CW);
      function rowHeight(cells, bold) {
        let h = lh;
        cells.forEach((cell, i) => { const t = cellText(cell); const sev = typeof cell === 'object' && cell && cell.sev; const n = sev && !t ? 1 : wrap(t, widths[i] - 2 * pad - (sev ? 0 : 0), size, bold || (cell && cell.bold)).length; h = Math.max(h, n * lh + (sev && t ? lh : 0)); });
        return h + 2 * pad;
      }
      function drawRow(cells, opts) {
        const h = rowHeight(cells, opts.bold);
        need(h + 1);
        if (opts.fill) box(M, y - h, CW, h, opts.fill);
        let x = M;
        cells.forEach((cell, i) => {
          const c = typeof cell === 'object' && cell !== null ? cell : { text: cell };
          let cy = y - pad;
          if (c.sev) { sevMark(x + pad, cy - 6, c.sev, size - 0.5); cy -= lh; }
          const t = cellText(c);
          if (t) {
            const ls = wrap(t, widths[i] - 2 * pad, size, opts.bold || c.bold);
            ls.forEach((l) => { const align = b.cols[i].align; const tx = align === 'right' ? x + widths[i] - pad - width(l, size, opts.bold || c.bold) : x + pad; txt(tx, cy - size, l, size, opts.bold || c.bold, c.color || (c.grey ? MUTED : (opts.color || INK))); cy -= lh; });
          }
          x += widths[i];
        });
        y -= h;
        hline(M, y, M + CW, opts.rule || RULE, 0.5);
      }
      const header = b.cols.map((c) => ({ text: (c.label || '').toUpperCase(), bold: true, color: MUTED }));
      const drawHeader = () => { drawRow(header, { bold: true, fill: SOFT, rule: [0.75, 0.78, 0.82], color: MUTED }); };
      if (b.cols.some((c) => c.label)) { need(60); drawHeader(); }
      b.rows.forEach((r) => {
        const h = rowHeight(r, false);
        if (y - h < BOTTOM) { newPage(); if (b.cols.some((c) => c.label)) drawHeader(); }
        drawRow(r, {});
      });
      y -= 8;
    }
    (doc.blocks || []).forEach((b) => {
      switch (b.t) {
        case 'title': {
          need(80);
          para(b.text, 16, true, INK, 0, 2);
          if (b.sub) para(b.sub, 9.5, false, MUTED, 0, 6);
          if (b.meta && b.meta.length) {
            const colW = CW / 2, lh = 9.5 * 1.42;
            const left = b.meta.filter((m, i) => i % 2 === 0), right = b.meta.filter((m, i) => i % 2 === 1);
            const rowsN = Math.max(left.length, right.length);
            hline(M, y, M + CW, [0.75, 0.78, 0.82], 0.8); y -= 4;
            for (let r = 0; r < rowsN; r += 1) {
              const items = [[left[r], M], [right[r], M + colW]];
              let rowH = lh;
              items.forEach(([it, x]) => { if (!it) return; const ls = wrap(it[1], colW - 96, 9.5, false); rowH = Math.max(rowH, ls.length * lh); });
              need(rowH + 6);
              items.forEach(([it, x]) => {
                if (!it) return;
                txt(x, y - 9.5 - 3, it[0], 8, false, MUTED);
                let cy = y - 3;
                wrap(it[1], colW - 96, 9.5, false).forEach((l) => { txt(x + 88, cy - 9.5, l, 9.5, false, INK); cy -= lh; });
              });
              y -= rowH + 6;
              hline(M, y + 2, M + CW, RULE, 0.5);
            }
            y -= 10;
          }
          break;
        }
        case 'section': {
          need(40); y -= 10;
          const num = b.n ? String(b.n) : '';
          if (num) txt(M, y - 11.5, num, 11.5, true, accent);
          txt(M + (num ? 22 : 0), y - 11.5, b.text, 11.5, true, INK);
          y -= 11.5 * 1.42;
          hline(M, y + 2, M + CW, [0.75, 0.78, 0.82], 0.8);
          y -= 8;
          break;
        }
        case 'p': para(b.text, 9.8, !!b.bold, b.muted ? MUTED : INK, b.indent || 0, b.after); break;
        case 'small': para(b.text, 8.3, false, MUTED, b.indent || 0, b.after === undefined ? 4 : b.after); break;
        case 'kv': {
          const lh = 9.5 * 1.42;
          const ls = wrap(b.v, CW - 110, 9.5, false);
          need(ls.length * lh + 4);
          txt(M, y - 9.5, b.k, 8, false, MUTED);
          ls.forEach((l) => { need(lh); txt(M + 110, y - 9.5, l, 9.5, false, INK); y -= lh; });
          y -= 3;
          break;
        }
        case 'table': table(b); break;
        case 'detail': {
          // a numbered point with its labelled lines and a left rule in the severity colour
          const startNeed = 44;
          need(startNeed);
          const top = y;
          const size = 9.5, lh = size * 1.42;
          const marks = [];
          let x = M + 12;
          if (b.n !== undefined) { txt(x, y - 10.5, String(b.n), 10.5, true, accent); x += 22; }
          const titleW = CW - (x - M) - 70;
          const tls = wrap(b.title || '', titleW, 10.5, true);
          tls.forEach((l, i) => { txt(x, y - 10.5, l, 10.5, true, INK); if (i === 0 && b.sev) sevMark(M + CW - 62, y - 10.5, b.sev, 8.5); y -= 10.5 * 1.42; });
          if (b.where) { txt(x, y - 8.5, b.where, 8.5, false, MUTED); y -= 8.5 * 1.42 + 2; }
          (b.rows || []).forEach(([k, v, opts]) => {
            if (v === undefined || v === null || v === '') return;
            const o = opts || {};
            const ls = wrap(v, CW - 12 - 92 - 6, size, !!o.bold);
            need(ls.length * lh + 2);
            txt(M + 12, y - size, k, 8, false, MUTED);
            ls.forEach((l) => { need(lh); txt(M + 12 + 92, y - size, l, size, !!o.bold, o.color || (o.muted ? MUTED : INK)); y -= lh; });
            y -= 2;
          });
          marks.push(top);
          const bottom = y;
          ops.push(rgb((SEV[b.sev] || { rgb: RULE }).rgb) + ' RG 1.4 w ' + n2(M + 3) + ' ' + n2(top - 2) + ' m ' + n2(M + 3) + ' ' + n2(bottom + 4) + ' l S');
          y -= 10;
          break;
        }
        case 'sign': {
          need(70); y -= 6;
          hline(M, y, M + CW, [0.75, 0.78, 0.82], 0.8); y -= 14;
          txt(M, y - 9.5, 'Reviewer decision', 8, false, MUTED);
          txt(M + 110, y - 9.5, '[  ]  Approved        [  ]  Changes requested        [  ]  Escalated', 9.5, false, INK);
          y -= 24;
          txt(M, y - 9.5, 'Reviewer', 8, false, MUTED); hline(M + 110, y - 11, M + 300, [0.6, 0.62, 0.66], 0.5);
          txt(M + 320, y - 9.5, 'Date', 8, false, MUTED); hline(M + 350, y - 11, M + CW, [0.6, 0.62, 0.66], 0.5);
          y -= 26;
          break;
        }
        case 'rule': need(8); hline(M, y - 2, M + CW); y -= 8; break;
        case 'gap': y -= b.h || 8; break;
        default: break;
      }
    });
    // running header and footer
    const total = pages.length;
    pages.forEach((p, i) => {
      const h = [];
      const brand = doc.brand || 'finalis';
      let bw;
      if (LOGO) { const lh = 15; const lw = lh * LOGO.w / LOGO.h; h.push('q ' + n2(lw) + ' 0 0 ' + n2(lh) + ' ' + n2(M) + ' ' + n2(PH - 48) + ' cm /Im1 Do Q'); bw = lw; }
      else { h.push('BT /F2 13 Tf ' + rgb(accent) + ' rg ' + n2(M) + ' ' + n2(PH - 44) + ' Td (' + esc(bytesOf(brand)) + ') Tj ET'); bw = width(brand, 13, true); }
      h.push(rgb([0.75, 0.78, 0.82]) + ' RG 0.6 w ' + n2(M + bw + 9) + ' ' + n2(PH - 47) + ' m ' + n2(M + bw + 9) + ' ' + n2(PH - 33) + ' l S');
      h.push('BT /F1 9 Tf ' + rgb(MUTED) + ' rg ' + n2(M + bw + 17) + ' ' + n2(PH - 43) + ' Td (' + esc(bytesOf(doc.product || 'Compliance')) + ') Tj ET');
      const k = doc.kicker || '';
      h.push('BT /F2 9 Tf ' + rgb(INK) + ' rg ' + n2(M + CW - width(k, 9, true)) + ' ' + n2(PH - 38) + ' Td (' + esc(bytesOf(k)) + ') Tj ET');
      const d = doc.date || '';
      h.push('BT /F1 8.5 Tf ' + rgb(MUTED) + ' rg ' + n2(M + CW - width(d, 8.5, false)) + ' ' + n2(PH - 50) + ' Td (' + esc(bytesOf(d)) + ') Tj ET');
      h.push(rgb([0.75, 0.78, 0.82]) + ' RG 0.8 w ' + n2(M) + ' ' + n2(PH - 58) + ' m ' + n2(M + CW) + ' ' + n2(PH - 58) + ' l S');
      const fl = doc.footerLeft || '';
      h.push('BT /F1 8 Tf ' + rgb(MUTED) + ' rg ' + n2(M) + ' ' + n2(36) + ' Td (' + esc(bytesOf(fl)) + ') Tj ET');
      const fr = (doc.footerRight ? doc.footerRight + '   ' : '') + 'Page ' + (i + 1) + ' of ' + total;
      h.push('BT /F1 8 Tf ' + rgb(MUTED) + ' rg ' + n2(M + CW - width(fr, 8, false)) + ' ' + n2(36) + ' Td (' + esc(bytesOf(fr)) + ') Tj ET');
      h.push(rgb(RULE) + ' RG 0.5 w ' + n2(M) + ' ' + n2(46) + ' m ' + n2(M + CW) + ' ' + n2(46) + ' l S');
      pages[i] = h.concat(p);
    });
    const objs = [];
    const add = (s) => { objs.push(s); return objs.length; };
    add('<< /Type /Catalog /Pages 2 0 R >>');
    add('');
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    let logoId = 0;
    if (LOGO) { const jpg = atob(LOGO.b64); logoId = add('<< /Type /XObject /Subtype /Image /Width ' + LOGO.w + ' /Height ' + LOGO.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>\nstream\n' + jpg + '\nendstream'); }
    const kids = [];
    pages.forEach((p) => {
      const content = p.join('\n');
      const cid = add('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream');
      const pid = add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + n2(PW) + ' ' + n2(PH) + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> ' + (logoId ? '/XObject << /Im1 ' + logoId + ' 0 R >> ' : '') + '>> /Contents ' + cid + ' 0 R >>');
      kids.push(pid + ' 0 R');
    });
    objs[1] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + kids.length + ' >>';
    const info = add('<< /Title (' + esc(bytesOf(doc.title || 'Pre-review')) + ') /Producer (Finalis AI Prescreen) /Creator (Finalis AI Prescreen) >>');
    let out = '%PDF-1.4\n%âãÏÓ\n';
    const offsets = [];
    objs.forEach((o, i) => { offsets.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
    const xref = out.length;
    out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
    offsets.forEach((o) => { out += String(o).padStart(10, '0') + ' 00000 n \n'; });
    out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i += 1) bytes[i] = out.charCodeAt(i) & 0xff;
    return bytes;
  }
  function blob(doc) { return new Blob([make(doc)], { type: 'application/pdf' }); }
  return { make, blob, wrap, width, SEV, bytesOf, esc };
})();
