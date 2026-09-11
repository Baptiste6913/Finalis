'use strict';
/* A small PDF writer, no library: A4 pages, Helvetica and Helvetica-Bold (standard fonts, nothing embedded),
   WinAnsi text, word wrapping from the Helvetica metrics, running header and page numbers. Enough for the
   pre-review summary and the desk brief; not a general layout engine. */
const PdfOut = (() => {
  // Helvetica advance widths for codes 32..126 (AFM, 1/1000 em)
  const W = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
  const MAP = { '‘': 0x91, '’': 0x92, '‚': 0x82, '“': 0x93, '”': 0x94, '„': 0x84, '–': 0x96, '—': 0x97, '…': 0x85, '•': 0x95, '€': 0x80, '™': 0x99, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, 'Œ': 0x8c, 'Ž': 0x8e, 'š': 0x9a, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f, ' ': 0x20, ' ': 0x20, ' ': 0x20, '→': 0x3e, '✓': 0x2b, '✗': 0x2d };
  function code(ch) {
    const c = ch.charCodeAt(0);
    if (c < 0x80) return c === 0x0a ? 0x20 : c;
    if (c >= 0xa0 && c <= 0xff) return c;
    if (MAP[ch] !== undefined) return MAP[ch];
    return 0x3f;
  }
  function bytesOf(str) { const out = []; for (let i = 0; i < str.length; i += 1) out.push(code(str[i])); return out; }
  function width(str, size, bold) {
    let w = 0;
    for (let i = 0; i < str.length; i += 1) { const c = code(str[i]); w += c >= 32 && c <= 126 ? W[c - 32] : 556; }
    return (w * size) / 1000 * (bold ? 1.05 : 1);
  }
  function escapeText(bytes) {
    let s = '';
    bytes.forEach((b) => { if (b === 0x28 || b === 0x29 || b === 0x5c) s += '\\' + String.fromCharCode(b); else if (b < 32) s += ' '; else s += String.fromCharCode(b); });
    return s;
  }
  function wrap(text, maxWidth, size, bold) {
    const lines = [];
    String(text || '').split(/\r?\n/).forEach((para) => {
      const words = para.split(/\s+/).filter(Boolean);
      if (!words.length) { lines.push(''); return; }
      let cur = '';
      words.forEach((w) => {
        // break words longer than the line
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

  /* blocks: {t:'h1'|'h2'|'p'|'small'|'kv'|'li'|'rule'|'gap', text, k, v, mark} */
  function make(doc) {
    const PAGE_W = 595.28, PAGE_H = 841.89, M = 56, TOP = PAGE_H - 64, BOTTOM = 60, CW = PAGE_W - 2 * M;
    const pages = [];
    let ops = [];
    let y = TOP;
    const num = (n) => (Math.round(n * 100) / 100).toString();
    function text(x, yy, str, size, bold, grey) {
      ops.push('BT /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' + (grey ? grey + ' g ' : '0 g ') + num(x) + ' ' + num(yy) + ' Td (' + escapeText(bytesOf(str)) + ') Tj ET');
    }
    function newPage() { ops = []; pages.push(ops); y = TOP; }
    function need(h) { if (y - h < BOTTOM) newPage(); }
    function line(x1, yy, x2, grey) { ops.push((grey || '0.85') + ' G 0.6 w ' + num(x1) + ' ' + num(yy) + ' m ' + num(x2) + ' ' + num(yy) + ' l S'); }
    function para(str, size, bold, grey, indent, gapAfter) {
      const lh = size * 1.38;
      const lines = wrap(str, CW - (indent || 0), size, bold);
      lines.forEach((l) => { need(lh); text(M + (indent || 0), y - size, l, size, bold, grey); y -= lh; });
      y -= gapAfter === undefined ? size * 0.5 : gapAfter;
    }
    pages.push(ops);
    (doc.blocks || []).forEach((b) => {
      switch (b.t) {
        case 'h1': need(30); y -= 4; para(b.text, 17, true, null, 0, 6); break;
        case 'h2': need(28); y -= 8; para(b.text, 11.5, true, null, 0, 2); line(M, y + 2, M + CW, '0.8'); y -= 6; break;
        case 'p': para(b.text, 10, false, null, 0, 6); break;
        case 'small': para(b.text, 8.5, false, '0.45', 0, 5); break;
        case 'kv': {
          const lh = 10 * 1.38;
          const lines = wrap(b.v, CW - 110, 10, false);
          need(lh * lines.length + 3);
          text(M, y - 10, b.k, 9, false, '0.45');
          lines.forEach((l) => { need(lh); text(M + 110, y - 10, l, 10, false); y -= lh; });
          y -= 3;
          break;
        }
        case 'li': {
          const size = 10, lh = size * 1.38;
          const mark = b.mark || '•';
          const lines = wrap(b.text, CW - 16, size, !!b.bold);
          need(lh);
          text(M + 2, y - size, mark, size, false, '0.35');
          lines.forEach((l) => { need(lh); text(M + 16, y - size, l, size, !!b.bold); y -= lh; });
          if (b.sub) { wrap(b.sub, CW - 16, 9, false).forEach((l) => { need(9 * 1.38); text(M + 16, y - 9, l, 9, false, '0.4'); y -= 9 * 1.38; }); }
          y -= 3;
          break;
        }
        case 'rule': need(8); line(M, y - 2, M + CW); y -= 8; break;
        case 'gap': y -= b.h || 8; break;
        default: break;
      }
    });
    // header and footer on every page
    const total = pages.length;
    pages.forEach((p, i) => {
      const hdr = [];
      hdr.push('BT /F2 8.5 Tf 0.35 g ' + num(M) + ' ' + num(PAGE_H - 38) + ' Td (' + escapeText(bytesOf(doc.header || 'Finalis AI Prescreen')) + ') Tj ET');
      const right = doc.headerRight || '';
      hdr.push('BT /F1 8.5 Tf 0.45 g ' + num(M + CW - width(right, 8.5, false)) + ' ' + num(PAGE_H - 38) + ' Td (' + escapeText(bytesOf(right)) + ') Tj ET');
      hdr.push('0.85 G 0.6 w ' + num(M) + ' ' + num(PAGE_H - 46) + ' m ' + num(M + CW) + ' ' + num(PAGE_H - 46) + ' l S');
      const foot = (doc.footer || '') + (doc.footer ? '   ' : '') + 'Page ' + (i + 1) + ' of ' + total;
      hdr.push('BT /F1 8 Tf 0.5 g ' + num(M + CW - width(foot, 8, false)) + ' ' + num(36) + ' Td (' + escapeText(bytesOf(foot)) + ') Tj ET');
      pages[i] = hdr.concat(p);
    });
    // objects
    const objs = [];
    const add = (s) => { objs.push(s); return objs.length; };
    add('<< /Type /Catalog /Pages 2 0 R >>');
    add(''); // pages, filled below
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const kids = [];
    pages.forEach((p) => {
      const content = p.join('\n');
      const cid = add('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream');
      const pid = add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + num(PAGE_W) + ' ' + num(PAGE_H) + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + cid + ' 0 R >>');
      kids.push(pid + ' 0 R');
    });
    objs[1] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + kids.length + ' >>';
    const info = add('<< /Title (' + escapeText(bytesOf(doc.title || 'Pre-review')) + ') /Producer (Finalis AI Prescreen) /Creator (Finalis AI Prescreen) >>');
    let out = '%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n';
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
  return { make, blob, wrap, width };
})();
