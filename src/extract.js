'use strict';
/* Extraction: PDF (pdf.js, text layer + span geometry + image counts), DOCX (zip + inflate,
   paragraphs), pasted text, images (text arrives later from the model's transcription). */
const Extract = (() => {
  const PDFJS_WORKER = (typeof window !== 'undefined' && window.PDFJS_WORKER_SRC) || 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  function pageFromText(number, text, extra) {
    const flat = U.collapse(text);
    return Object.assign({
      number, kind: 'text', text, search: flat.text, searchMap: flat.map, spans: [], imageCount: 0,
      charCount: text.replace(/\s/g, '').length, textLayer: true, width: 1, height: 1.3,
    }, extra || {});
  }

  /* ---- PDF ---- */
  async function extractPdfPage(page, number) {
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const spans = [];
    const parts = [];
    let cursor = 0;
    let lastY = null;
    content.items.forEach((item) => {
      const raw = item.str || '';
      const transform = item.transform || [1, 0, 0, 1, 0, 0];
      const y = transform[5];
      if (!raw.trim()) {
        if (item.hasEOL) { parts.push('\n'); cursor += 1; }
        return;
      }
      // a new text line when the baseline moves
      if (lastY !== null && Math.abs(y - lastY) > 2 && parts.length && !/\s$/.test(parts[parts.length - 1])) {
        parts.push('\n'); cursor += 1;
      }
      lastY = y;
      const piece = raw.replace(/\s+/g, ' ');
      const size = Math.abs(transform[3]) || Math.hypot(transform[1], transform[3]) || 0;
      const width = item.width || 0;
      const height = item.height || size;
      const x = transform[4];
      const style = content.styles && content.styles[item.fontName];
      const font = (item.fontName || '') + ' ' + (style ? (style.fontFamily || '') : '');
      spans.push({
        text: piece, start: cursor, end: cursor + piece.length,
        size: Math.round(size * 10) / 10,
        bold: /bold|black|heavy|semib|demib/i.test(font),
        // ascent about 0.8 of the size above the baseline, descent about 0.22 below
        box: { page: number, x: x / viewport.width, y: (viewport.height - (y + 0.8 * (height || size))) / viewport.height, w: width / viewport.width, h: (1.02 * (height || size)) / viewport.height },
      });
      parts.push(piece);
      cursor += piece.length;
      const gap = item.hasEOL ? '\n' : ' ';
      parts.push(gap);
      cursor += gap.length;
    });
    const joined = parts.join('');
    const flat = U.collapse(joined);
    let imageCount = 0;
    try {
      const ops = await page.getOperatorList();
      const OPS = window.pdfjsLib.OPS || {};
      ops.fnArray.forEach((fn) => {
        if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintJpegXObject || fn === OPS.paintImageMaskXObject) imageCount += 1;
      });
    } catch (e) { /* no operator list, image count unknown */ }
    const charCount = joined.replace(/\s/g, '').length;
    return {
      number, kind: 'pdf', text: joined, search: flat.text, searchMap: flat.map, spans, imageCount, charCount,
      textLayer: charCount > 0 || imageCount === 0, width: viewport.width, height: viewport.height,
    };
  }

  async function pdf(bytes) {
    if (!window.pdfjsLib) throw new Error('pdf.js did not load');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    const doc = await window.pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
    const pages = [];
    for (let n = 1; n <= doc.numPages; n += 1) {
      const page = await doc.getPage(n);
      pages.push(await extractPdfPage(page, n));
    }
    return { pages, pdf: doc };
  }

  async function renderPdfPage(doc, number, targetWidth) {
    const page = await doc.getPage(number);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2.5, Math.max(0.6, (targetWidth || 1000) / base.width));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d', { alpha: false });
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas;
  }

  async function pageJpeg(doc, number, maxWidth) {
    const canvas = await renderPdfPage(doc, number, maxWidth || 1100);
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.82));
  }

  /* ---- DOCX (zip central directory + deflate-raw via DecompressionStream) ---- */
  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot inflate DOCX files');
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function zipEntry(bytes, wanted) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 70000); i -= 1) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Not a DOCX (zip) file');
    const count = dv.getUint16(eocd + 10, true);
    let off = dv.getUint32(eocd + 16, true);
    const td = new TextDecoder();
    for (let k = 0; k < count; k += 1) {
      if (dv.getUint32(off, true) !== 0x02014b50) break;
      const method = dv.getUint16(off + 10, true);
      const csize = dv.getUint32(off + 20, true);
      const nlen = dv.getUint16(off + 28, true);
      const elen = dv.getUint16(off + 30, true);
      const clen = dv.getUint16(off + 32, true);
      const lho = dv.getUint32(off + 42, true);
      const name = td.decode(bytes.subarray(off + 46, off + 46 + nlen));
      if (name === wanted) {
        const lnlen = dv.getUint16(lho + 26, true);
        const lelen = dv.getUint16(lho + 28, true);
        const start = lho + 30 + lnlen + lelen;
        const data = bytes.subarray(start, start + csize);
        if (method === 0) return data;
        if (method === 8) return inflateRaw(data);
        throw new Error('Unsupported zip compression');
      }
      off += 46 + nlen + elen + clen;
    }
    throw new Error('word/document.xml not found');
  }
  function decodeEntities(s) {
    return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, d) => String.fromCharCode(+d)).replace(/&amp;/g, '&');
  }
  async function docx(bytes) {
    const xmlBytes = await zipEntry(bytes, 'word/document.xml');
    const xml = new TextDecoder().decode(xmlBytes);
    const paras = [];
    const re = /<w:p[\s>][\s\S]*?<\/w:p>/g;
    let m;
    while ((m = re.exec(xml))) {
      const p = m[0];
      const pageBreak = /<w:br[^>]*w:type="page"/.test(p);
      const texts = [];
      const tre = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g;
      let t;
      while ((t = tre.exec(p))) {
        if (t[0] === '<w:tab/>') texts.push('\t');
        else if (t[0] === '<w:br/>') texts.push('\n');
        else texts.push(decodeEntities(t[1]));
      }
      const boldRuns = (p.match(/<w:b\/>|<w:b w:val="1"\/>|<w:b w:val="true"\/>/g) || []).length;
      const runs = (p.match(/<w:r[\s>]/g) || []).length;
      paras.push({ text: texts.join(''), pageBreak, boldShare: runs ? boldRuns / runs : 0 });
    }
    const pages = [];
    let buf = [];
    let chars = 0;
    const flush = () => { if (buf.length) { pages.push(buf.join('\n')); buf = []; chars = 0; } };
    paras.forEach((p) => {
      if (p.pageBreak) flush();
      buf.push(p.text);
      chars += p.text.length;
      if (chars > 3200) flush();
    });
    flush();
    if (!pages.length) pages.push('');
    return { pages: pages.map((text, i) => pageFromText(i + 1, text)) };
  }

  /* ---- pasted text ---- */
  function plain(text) {
    const chunks = text.split(/\n\s*(?:---+|\f|={3,})\s*\n/);
    return { pages: chunks.map((t, i) => pageFromText(i + 1, t.trim())) };
  }

  /* ---- image (transcribed later) ---- */
  function image(file) {
    const url = URL.createObjectURL(file);
    return { pages: [pageFromText(1, '', { kind: 'image', imageCount: 1, textLayer: false })], imageUrl: url };
  }

  return { pdf, docx, plain, image, renderPdfPage, pageJpeg, pageFromText };
})();
