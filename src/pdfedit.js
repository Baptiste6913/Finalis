'use strict';
/* PdfEdit: edits the banker's PDF in the browser, without a library. The original file is never rewritten:
   the corrections are appended as an incremental update (ISO 32000-1 §7.5.6), so every byte of the uploaded
   file stays intact underneath and any reader shows the corrected version. Handles classic cross-reference
   tables and PDF 1.5 cross-reference streams with compressed object streams: the objects are found by
   scanning the file (the way readers rebuild a damaged table), object streams are inflated with the
   browser's DecompressionStream, and the current page objects are redefined in the update.
   Per edited page: a "q" stream before the original content and a "Q" + overlay stream after it (white
   boxes and Helvetica text), with the font added to a copy of the page's resources. */
const PdfEdit = (() => {
  /* byte-exact binary string (TextDecoder's latin1 is windows-1252 and remaps 0x80-0x9f) */
  function binStr(u8) { let out = ''; for (let i = 0; i < u8.length; i += 0x8000) out += String.fromCharCode.apply(null, u8.subarray(i, Math.min(i + 0x8000, u8.length))); return out; }
  const isWs = (c) => c === 0x20 || c === 0x0a || c === 0x0d || c === 0x09 || c === 0x0c || c === 0x00;
  const isDelim = (c) => c === 0x28 || c === 0x29 || c === 0x3c || c === 0x3e || c === 0x5b || c === 0x5d || c === 0x7b || c === 0x7d || c === 0x2f || c === 0x25;
  const isReg = (c) => !isWs(c) && !isDelim(c);

  /* ---------- object syntax ---------- */
  function Parser(s, doc) {
    function skip(pos) {
      for (;;) {
        while (pos < s.length && isWs(s.charCodeAt(pos))) pos += 1;
        if (s.charCodeAt(pos) === 0x25) { while (pos < s.length && s.charCodeAt(pos) !== 0x0a && s.charCodeAt(pos) !== 0x0d) pos += 1; } else return pos;
      }
    }
    function token(pos) { const st = pos; while (pos < s.length && isReg(s.charCodeAt(pos))) pos += 1; return { text: s.slice(st, pos), end: pos }; }
    function parse(pos, noStream) {
      pos = skip(pos);
      const c = s.charCodeAt(pos);
      if (c === 0x2f) { // name
        const t = token(pos + 1);
        return { obj: { t: 'name', v: t.text.replace(/#([0-9a-fA-F]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16))) }, end: t.end };
      }
      if (c === 0x28) { // literal string
        let depth = 0; let i = pos;
        for (; i < s.length; i += 1) {
          const ch = s.charCodeAt(i);
          if (ch === 0x5c) { i += 1; continue; }
          if (ch === 0x28) depth += 1; else if (ch === 0x29) { depth -= 1; if (depth === 0) { i += 1; break; } }
        }
        return { obj: { t: 'str', raw: s.slice(pos, i) }, end: i };
      }
      if (c === 0x3c) {
        if (s.charCodeAt(pos + 1) === 0x3c) { // dict
          const v = {}; let p = pos + 2;
          for (;;) {
            p = skip(p);
            if (s.charCodeAt(p) === 0x3e && s.charCodeAt(p + 1) === 0x3e) { p += 2; break; }
            if (p >= s.length) break;
            const k = parse(p, true); p = k.end;
            if (k.obj.t !== 'name') continue;
            const val = parse(p, true); p = val.end;
            v[k.obj.v] = val.obj;
          }
          const dict = { t: 'dict', v };
          if (!noStream) {
            const q = skip(p);
            if (s.startsWith('stream', q)) {
              let st = q + 6;
              if (s.charCodeAt(st) === 0x0d) st += 1;
              if (s.charCodeAt(st) === 0x0a) st += 1;
              let len = null;
              const L = v.Length;
              if (L && L.t === 'num') len = L.v;
              else if (L && L.t === 'ref' && doc) { const lo = doc.get(L.num); if (lo && lo.t === 'num') len = lo.v; }
              let ok = false;
              if (len !== null && len >= 0 && st + len <= s.length) { const e = skip(st + len); ok = s.startsWith('endstream', e); }
              if (!ok) { const e = s.indexOf('endstream', st); len = e < 0 ? 0 : e - st; while (len > 0 && isWs(s.charCodeAt(st + len - 1))) len -= 1; }
              const e = s.indexOf('endstream', st + len);
              return { obj: { t: 'stream', dict, start: st, len }, end: e < 0 ? s.length : e + 9 };
            }
          }
          return { obj: dict, end: p };
        }
        const e = s.indexOf('>', pos + 1); // hex string
        return { obj: { t: 'str', raw: s.slice(pos, e + 1) }, end: e + 1 };
      }
      if (c === 0x5b) { // array
        const v = []; let p = pos + 1;
        for (;;) {
          p = skip(p);
          if (s.charCodeAt(p) === 0x5d) { p += 1; break; }
          if (p >= s.length) break;
          const it = parse(p, true); p = it.end; v.push(it.obj);
        }
        return { obj: { t: 'arr', v }, end: p };
      }
      if (c === 0x5d || c === 0x3e || c === 0x29 || c === 0x7b || c === 0x7d) return { obj: { t: 'kw', v: s[pos] }, end: pos + 1 };
      const t = token(pos);
      if (!t.text) return { obj: { t: 'kw', v: '' }, end: pos + 1 };
      if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t.text)) {
        const n = { t: 'num', v: parseFloat(t.text), raw: t.text };
        if (/^\d+$/.test(t.text)) { // reference lookahead
          const m = /^\s+(\d+)\s+R(?![^\s()<>\[\]{}\/%])/.exec(s.slice(t.end, t.end + 24));
          if (m) return { obj: { t: 'ref', num: parseInt(t.text, 10), gen: parseInt(m[1], 10) }, end: t.end + m[0].length };
        }
        return { obj: n, end: t.end };
      }
      if (t.text === 'true' || t.text === 'false') return { obj: { t: 'bool', v: t.text === 'true' }, end: t.end };
      if (t.text === 'null') return { obj: { t: 'null' }, end: t.end };
      return { obj: { t: 'kw', v: t.text }, end: t.end };
    }
    return { parse, skip };
  }
  function ser(o) {
    if (!o) return 'null';
    switch (o.t) {
      case 'num': return o.raw !== undefined ? o.raw : (Number.isInteger(o.v) ? String(o.v) : o.v.toFixed(4).replace(/\.?0+$/, ''));
      case 'name': return '/' + o.v.replace(/[^!-~]|[#()<>\[\]{}\/%]/g, (ch) => '#' + ch.charCodeAt(0).toString(16).padStart(2, '0'));
      case 'str': return o.raw;
      case 'arr': return '[' + o.v.map(ser).join(' ') + ']';
      case 'dict': return '<<' + Object.keys(o.v).map((k) => ser({ t: 'name', v: k }) + ' ' + ser(o.v[k])).join(' ') + '>>';
      case 'ref': return o.num + ' ' + o.gen + ' R';
      case 'bool': return o.v ? 'true' : 'false';
      case 'null': return 'null';
      case 'stream': return ser(o.dict);
      default: return o.v || '';
    }
  }

  /* ---------- streams ---------- */
  async function inflate(u8) {
    const ds = new DecompressionStream('deflate');
    const stream = new Blob([u8]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  function unpredict(data, parms) {
    const pred = parms && parms.Predictor ? parms.Predictor.v : 1;
    if (pred < 10) return data;
    const cols = parms.Columns ? parms.Columns.v : 1; const colors = parms.Colors ? parms.Colors.v : 1; const bpc = parms.BitsPerComponent ? parms.BitsPerComponent.v : 8;
    const bpp = Math.max(1, Math.ceil(colors * bpc / 8)); const rowLen = Math.ceil(colors * bpc * cols / 8);
    const rows = Math.floor(data.length / (rowLen + 1)); const out = new Uint8Array(rows * rowLen); let prev = new Uint8Array(rowLen);
    for (let r = 0; r < rows; r += 1) {
      const ft = data[r * (rowLen + 1)]; const row = data.subarray(r * (rowLen + 1) + 1, (r + 1) * (rowLen + 1)); const cur = new Uint8Array(rowLen);
      for (let i = 0; i < rowLen; i += 1) {
        const a = i >= bpp ? cur[i - bpp] : 0; const b = prev[i]; const c = i >= bpp ? prev[i - bpp] : 0; let x = row[i];
        if (ft === 1) x += a; else if (ft === 2) x += b; else if (ft === 3) x += (a + b) >> 1; else if (ft === 4) { const p = a + b - c; const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c); x += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
        cur[i] = x & 0xff;
      }
      out.set(cur, r * rowLen); prev = cur;
    }
    return out;
  }
  function bytesOfSlice(s, start, len) { const out = new Uint8Array(len); for (let i = 0; i < len; i += 1) out[i] = s.charCodeAt(start + i); return out; }

  /* ---------- document ---------- */
  async function open(bytes) {
    const s = binStr(bytes);
    const doc = { s, bytes, index: new Map(), memo: new Map(), maxNum: 0, trailer: {}, startxref: 0, classic: false, objStms: [] };
    const P = Parser(s, doc);
    doc.get = (num) => {
      if (doc.memo.has(num)) return doc.memo.get(num);
      const e = doc.index.get(num);
      let obj = null;
      if (e) {
        try {
          if (e.stm) obj = Parser(e.stm.text, doc).parse(e.stm.first + e.off, true).obj;
          else obj = P.parse(e.pos, false).obj;
        } catch (err) { obj = null; }
      }
      doc.memo.set(num, obj);
      return obj;
    };
    doc.resolve = (o) => (o && o.t === 'ref' ? doc.get(o.num) : o);
    doc.gen = (num) => { const e = doc.index.get(num); return e ? e.gen : 0; };
    const re = /(?:^|[\s>\]}])(\d+)\s+(\d+)\s+obj(?![^\s<\[\/(])/g;
    let m;
    const headers = [];
    while ((m = re.exec(s))) {
      const num = parseInt(m[1], 10); const gen = parseInt(m[2], 10); const pos = m.index + m[0].length;
      headers.push({ num, gen, pos });
      doc.index.set(num, { gen, pos, at: pos }); // later definitions win (incremental updates append)
      if (num > doc.maxNum) doc.maxNum = num;
      const eo = s.indexOf('endobj', pos); // skip the body (stream data can look like anything)
      re.lastIndex = eo < 0 ? pos : eo;
    }
    // trailers: classic "trailer" dictionaries and cross-reference stream dictionaries, in file order
    const sources = [];
    const tre = /trailer\s*<</g;
    while ((m = tre.exec(s))) { sources.push({ at: m.index, pos: m.index + 7, classic: true }); }
    headers.forEach((h) => { const head = s.slice(h.pos, h.pos + 400); if (/\/Type\s*\/XRef\b/.test(head)) sources.push({ at: h.pos, pos: h.pos, classic: false }); });
    sources.sort((a, b) => a.at - b.at);
    sources.forEach((src) => {
      try {
        const d = P.parse(src.pos, true).obj;
        if (d && d.t === 'dict') { ['Root', 'Info', 'ID', 'Encrypt'].forEach((k) => { if (d.v[k]) doc.trailer[k] = d.v[k]; }); if (src.classic) doc.classic = true; }
      } catch (err) { /* skip */ }
    });
    if (!sources.some((x) => !x.classic)) doc.classic = true;
    const sx = /startxref\s+(\d+)/g; let last = null;
    while ((m = sx.exec(s))) last = m[1];
    doc.startxref = last ? parseInt(last, 10) : 0;
    // object streams: inflate and index the objects they carry (a later direct definition still wins)
    for (const h of headers) {
      const head = s.slice(h.pos, h.pos + 400);
      if (!/\/Type\s*\/ObjStm\b/.test(head)) continue;
      try {
        const o = P.parse(h.pos, false).obj;
        if (!o || o.t !== 'stream') continue;
        let data = bytesOfSlice(s, o.start, o.len);
        const filt = doc.resolve(o.dict.v.Filter);
        const names = filt ? (filt.t === 'arr' ? filt.v.map((x) => x.v) : [filt.v]) : [];
        if (names.includes('FlateDecode')) data = await inflate(data);
        const parms = doc.resolve(o.dict.v.DecodeParms);
        if (parms && parms.t === 'dict') data = unpredict(data, parms.v);
        const text = binStr(data);
        const n = o.dict.v.N ? o.dict.v.N.v : 0; const first = o.dict.v.First ? o.dict.v.First.v : 0;
        const nums = text.slice(0, first).trim().split(/\s+/).map((x) => parseInt(x, 10));
        const stm = { text, first, num: h.num };
        for (let i = 0; i < n; i += 1) {
          const onum = nums[2 * i]; const off = nums[2 * i + 1];
          if (!Number.isFinite(onum) || !Number.isFinite(off)) continue;
          const cur = doc.index.get(onum);
          if (cur && !cur.stm && cur.at > h.pos) continue;
          doc.index.set(onum, { gen: 0, stm, off, at: h.pos });
          if (onum > doc.maxNum) doc.maxNum = onum;
        }
      } catch (err) { /* unreadable object stream: its objects stay unavailable */ }
    }
    doc.encrypted = !!doc.trailer.Encrypt;
    return doc;
  }

  /* ---------- geometry: viewport (pdf.js, scale 1, y down) to user space ---------- */
  function invert(t) {
    const [a, b, c, d, e, f] = t; const det = a * d - b * c;
    return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
  }
  const ap = (t, x, y) => [t[0] * x + t[2] * y + t[4], t[1] * x + t[3] * y + t[5]];
  const n2 = (x) => (Math.round(x * 100) / 100).toString();
  function opsFor(viewport, items) {
    const inv = invert(viewport.transform); const vw = viewport.width; const vh = viewport.height;
    const o = ap(inv, 0, 0); const rx = ap(inv, 1, 0); const uy = ap(inv, 0, -1);
    const R = [rx[0] - o[0], rx[1] - o[1]]; const Up = [uy[0] - o[0], uy[1] - o[1]];
    const rect = (b) => { const p = ap(inv, b.x * vw, b.y * vh); const q = ap(inv, (b.x + b.w) * vw, (b.y + b.h) * vh); const x0 = Math.min(p[0], q[0]); const y0 = Math.min(p[1], q[1]); return [x0, y0, Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1])]; };
    const ops = [];
    items.forEach((it) => {
      (it.whiteout || []).forEach((b) => { const r = rect(b); ops.push('1 1 1 rg ' + r.map(n2).join(' ') + ' re f'); });
      if (it.box && it.kind !== 'whiteout') {
        const r = rect(it.box);
        ops.push((it.fill ? it.fill.map(n2).join(' ') : '1 1 1') + ' rg ' + r.map(n2).join(' ') + ' re f');
        if (it.border) ops.push(it.border.map(n2).join(' ') + ' RG 0.5 w ' + r.map(n2).join(' ') + ' re S');
      }
      if (it.text && it.box) {
        const size = it.size || 8; const pad = it.pad !== undefined ? it.pad : size * 0.45; const lh = size * 1.25;
        const lines = PdfOut.wrap(it.text, it.box.w * vw - 2 * pad, size, !!it.bold);
        const col = it.color || [0.09, 0.1, 0.13];
        ops.push('BT /' + (it.bold ? 'PxHelvB' : 'PxHelv') + ' ' + n2(size) + ' Tf ' + col.map(n2).join(' ') + ' rg');
        lines.forEach((ln, i) => {
          const vx = it.box.x * vw + pad; const vy = it.box.y * vh + pad + size * 0.92 + i * lh;
          if (vy > (it.box.y + it.box.h) * vh + size) return; // clipped by the box
          const p = ap(inv, vx, vy);
          ops.push(n2(R[0]) + ' ' + n2(R[1]) + ' ' + n2(Up[0]) + ' ' + n2(Up[1]) + ' ' + n2(p[0]) + ' ' + n2(p[1]) + ' Tm (' + PdfOut.esc(PdfOut.bytesOf(ln)) + ') Tj');
        });
        ops.push('ET');
      }
    });
    return ops.join('\n');
  }

  /* ---------- incremental update ---------- */
  function inherited(doc, dict, key) {
    let d = dict; let guard = 0;
    while (d && d.t === 'dict' && guard < 64) {
      if (d.v[key]) return d.v[key];
      d = doc.resolve(d.v.Parent); guard += 1;
    }
    return null;
  }
  function withFonts(doc, res, refs) {
    const v = res && res.t === 'dict' ? Object.assign({}, res.v) : {};
    const font = doc.resolve(v.Font);
    const fv = font && font.t === 'dict' ? Object.assign({}, font.v) : {};
    fv.PxHelv = refs[0]; fv.PxHelvB = refs[1];
    v.Font = { t: 'dict', v: fv };
    return { t: 'dict', v };
  }
  /* edits: [{ num, gen, ops }] one entry per page object. Returns the new file bytes. */
  function apply(doc, edits) {
    if (doc.encrypted) throw new Error('This PDF is encrypted: it cannot be edited in the app.');
    const chunks = [doc.bytes];
    let offset = doc.bytes.length;
    const tail = binStr(doc.bytes.subarray(Math.max(0, doc.bytes.length - 2)));
    if (!/[\r\n]$/.test(tail)) { chunks.push(new Uint8Array([0x0a])); offset += 1; }
    const enc = (str) => { const out = new Uint8Array(str.length); for (let i = 0; i < str.length; i += 1) out[i] = str.charCodeAt(i) & 0xff; return out; };
    const xref = []; // { num, gen, offset }
    let next = doc.maxNum + 1;
    const emit = (num, gen, body) => {
      const head = num + ' ' + gen + ' obj\n'; const b = typeof body === 'string' ? enc(head + body + '\nendobj\n') : body;
      xref.push({ num, gen, offset }); chunks.push(b); offset += b.length;
    };
    const streamObj = (dictExtra, data) => { const bytes = typeof data === 'string' ? enc(data) : data; return { dictExtra, bytes }; };
    const emitStream = (num, gen, so) => {
      const head = enc(num + ' ' + gen + ' obj\n<< /Length ' + so.bytes.length + (so.dictExtra || '') + ' >>\nstream\n'); const foot = enc('\nendstream\nendobj\n');
      const b = new Uint8Array(head.length + so.bytes.length + foot.length); b.set(head, 0); b.set(so.bytes, head.length); b.set(foot, head.length + so.bytes.length);
      xref.push({ num, gen, offset }); chunks.push(b); offset += b.length;
    };
    const fontRefs = [{ t: 'ref', num: next, gen: 0 }, { t: 'ref', num: next + 1, gen: 0 }];
    emit(next, 0, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    emit(next + 1, 0, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    next += 2;
    edits.forEach((ed) => {
      const page = doc.get(ed.num);
      if (!page || page.t !== 'dict') throw new Error('Page object ' + ed.num + ' not found');
      const v = Object.assign({}, page.v);
      const preNum = next; const postNum = next + 1; next += 2;
      emitStream(preNum, 0, streamObj('', 'q\n'));
      emitStream(postNum, 0, streamObj('', '\nQ\nq\n' + ed.ops + '\nQ\n'));
      const pre = { t: 'ref', num: preNum, gen: 0 }; const post = { t: 'ref', num: postNum, gen: 0 };
      const cont = v.Contents;
      if (!cont) v.Contents = { t: 'arr', v: [pre, post] };
      else if (cont.t === 'arr') v.Contents = { t: 'arr', v: [pre].concat(cont.v, [post]) };
      else if (cont.t === 'ref') { const target = doc.resolve(cont); v.Contents = { t: 'arr', v: target && target.t === 'arr' ? [pre].concat(target.v, [post]) : [pre, cont, post] }; }
      else v.Contents = { t: 'arr', v: [pre, post] };
      const resRef = inherited(doc, page, 'Resources');
      const res = doc.resolve(resRef);
      const resNum = next; next += 1;
      emit(resNum, 0, ser(withFonts(doc, res, fontRefs)));
      v.Resources = { t: 'ref', num: resNum, gen: 0 };
      emit(ed.num, ed.gen || 0, ser({ t: 'dict', v }));
    });
    // cross-reference section for the update
    const size = next;
    const tr = doc.trailer;
    const trailerEntries = ['/Size ' + (doc.classic ? size : size + 1), tr.Root ? '/Root ' + ser(tr.Root) : '', tr.Info ? '/Info ' + ser(tr.Info) : '', tr.ID ? '/ID ' + ser(tr.ID) : '', doc.startxref ? '/Prev ' + doc.startxref : ''].filter(Boolean);
    xref.sort((a, b) => a.num - b.num);
    if (doc.classic) {
      const start = offset;
      let t = 'xref\n';
      xref.forEach((e) => { t += e.num + ' 1\n' + String(e.offset).padStart(10, '0') + ' ' + String(e.gen).padStart(5, '0') + ' n \n'; });
      t += 'trailer\n<< ' + trailerEntries.join(' ') + ' >>\nstartxref\n' + start + '\n%%EOF\n';
      chunks.push(enc(t)); offset += t.length;
    } else {
      const xnum = next; const start = offset;
      const rows = xref.concat([{ num: xnum, gen: 0, offset: start }]).sort((a, b) => a.num - b.num);
      const data = new Uint8Array(rows.length * 7);
      rows.forEach((e, i) => { data[i * 7] = 1; data[i * 7 + 1] = (e.offset >>> 24) & 0xff; data[i * 7 + 2] = (e.offset >>> 16) & 0xff; data[i * 7 + 3] = (e.offset >>> 8) & 0xff; data[i * 7 + 4] = e.offset & 0xff; data[i * 7 + 5] = (e.gen >> 8) & 0xff; data[i * 7 + 6] = e.gen & 0xff; });
      const head = enc(xnum + ' 0 obj\n<< /Type /XRef /W [1 4 2] /Index [' + rows.map((e) => e.num + ' 1').join(' ') + '] ' + trailerEntries.join(' ') + ' /Length ' + data.length + ' >>\nstream\n');
      const foot = enc('\nendstream\nendobj\nstartxref\n' + start + '\n%%EOF\n');
      const b = new Uint8Array(head.length + data.length + foot.length); b.set(head, 0); b.set(data, head.length); b.set(foot, head.length + data.length);
      chunks.push(b); offset += b.length;
    }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total); let p = 0;
    chunks.forEach((c) => { out.set(c, p); p += c.length; });
    return out;
  }

  /* High level: pages = [{ num, gen, viewport, items }] from the UI; returns the corrected file. */
  async function correct(bytes, pages) {
    const doc = await open(bytes);
    const edits = pages.filter((p) => p.items && p.items.length).map((p) => ({ num: p.num, gen: p.gen || doc.gen(p.num), ops: opsFor(p.viewport, p.items) }));
    if (!edits.length) return bytes;
    return apply(doc, edits);
  }
  return { open, apply, opsFor, correct, ser, invert };
})();
