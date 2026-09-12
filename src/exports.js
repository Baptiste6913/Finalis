'use strict';
/* Exports: the corrected material as PowerPoint (one slide per page: the page as a picture with every
   correction as an editable text box on top, plus a closing slide with the attention points) and as Word
   (a change sheet: each corrected page with its editable corrections, then the attention points).
   Both files are written by hand (a STORE zip, Office Open XML), no library. */
const Exports = (() => {
  /* ---------- zip (STORE) ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i += 1) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  const te = new TextEncoder();
  function zip(entries) {
    const parts = []; const central = []; let offset = 0;
    const dosTime = 0x0000; const dosDate = ((2026 - 1980) << 9) | (9 << 5) | 12;
    entries.forEach((en) => {
      const name = te.encode(en.name); const data = typeof en.data === 'string' ? te.encode(en.data) : en.data;
      const crc = crc32(data);
      const h = new Uint8Array(30 + name.length); const dv = new DataView(h.buffer);
      dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true); dv.setUint16(8, 0, true); dv.setUint16(10, dosTime, true); dv.setUint16(12, dosDate, true);
      dv.setUint32(14, crc, true); dv.setUint32(18, data.length, true); dv.setUint32(22, data.length, true); dv.setUint16(26, name.length, true); dv.setUint16(28, 0, true);
      h.set(name, 30);
      parts.push(h, data);
      const c = new Uint8Array(46 + name.length); const cv = new DataView(c.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true); cv.setUint16(12, dosTime, true); cv.setUint16(14, dosDate, true);
      cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, name.length, true); cv.setUint16(30, 0, true); cv.setUint16(32, 0, true); cv.setUint16(34, 0, true); cv.setUint16(36, 0, true); cv.setUint32(38, 0, true); cv.setUint32(42, offset, true);
      c.set(name, 46);
      central.push(c);
      offset += h.length + data.length;
    });
    const cdStart = offset; let cdLen = 0; central.forEach((c) => { cdLen += c.length; });
    const eocd = new Uint8Array(22); const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(4, 0, true); ev.setUint16(6, 0, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true); ev.setUint32(12, cdLen, true); ev.setUint32(16, cdStart, true); ev.setUint16(20, 0, true);
    const total = offset + cdLen + 22; const out = new Uint8Array(total); let p = 0;
    parts.concat(central, [eocd]).forEach((b) => { out.set(b, p); p += b.length; });
    return out;
  }
  const X = (s) => String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');

  /* ---------- page pictures ---------- */
  async function pageJpeg(doc, n, width) {
    const canvas = await Extract.renderPdfPage(doc.pdf, n, width || 1400);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.86));
    return new Uint8Array(await blob.arrayBuffer());
  }

  /* ---------- PowerPoint ---------- */
  const EMU_PT = 12700;
  function pptxTheme() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Finalis"><a:themeElements><a:clrScheme name="Finalis"><a:dk1><a:srgbClr val="16181F"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F2937"/></a:dk2><a:lt2><a:srgbClr val="F3F5F9"/></a:lt2><a:accent1><a:srgbClr val="2F5FE3"/></a:accent1><a:accent2><a:srgbClr val="0F7A6B"/></a:accent2><a:accent3><a:srgbClr val="B54708"/></a:accent3><a:accent4><a:srgbClr val="B42318"/></a:accent4><a:accent5><a:srgbClr val="6941C6"/></a:accent5><a:accent6><a:srgbClr val="6B7280"/></a:accent6><a:hlink><a:srgbClr val="2F5FE3"/></a:hlink><a:folHlink><a:srgbClr val="6941C6"/></a:folHlink></a:clrScheme><a:fontScheme name="Finalis"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>';
  }
  const NS_P = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
  function pptxMaster() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster ' + NS_P + '><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="2800"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="1400"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1400"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>';
  }
  function pptxLayout() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout ' + NS_P + ' type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>';
  }
  function runs(text, size, bold, color) {
    const paras = String(text || '').split(/\r?\n/);
    return paras.map((ln) => '<a:p><a:pPr algn="l"/><a:r><a:rPr lang="en-US" sz="' + Math.round(size * 100) + '"' + (bold ? ' b="1"' : '') + ' dirty="0"><a:solidFill><a:srgbClr val="' + (color || '16181F') + '"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t>' + X(ln) + '</a:t></a:r></a:p>').join('');
  }
  function shape(id, name, x, y, w, h, fill, body, opts) {
    const o = opts || {};
    return '<p:sp><p:nvSpPr><p:cNvPr id="' + id + '" name="' + X(name) + '"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="' + Math.round(x) + '" y="' + Math.round(y) + '"/><a:ext cx="' + Math.max(1, Math.round(w)) + '" cy="' + Math.max(1, Math.round(h)) + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' + (fill ? '<a:solidFill><a:srgbClr val="' + fill + '"/></a:solidFill>' : '<a:noFill/>') + (o.line ? '<a:ln w="6350"><a:solidFill><a:srgbClr val="' + o.line + '"/></a:solidFill></a:ln>' : '<a:ln><a:noFill/></a:ln>') + '</p:spPr><p:txBody><a:bodyPr wrap="square" lIns="' + (o.ins === undefined ? 45720 : o.ins) + '" tIns="' + (o.ins === undefined ? 45720 : o.ins) + '" rIns="' + (o.ins === undefined ? 45720 : o.ins) + '" bIns="' + (o.ins === undefined ? 45720 : o.ins) + '" anchor="t"><a:noAutofit/></a:bodyPr><a:lstStyle/>' + (body || '<a:p/>') + '</p:txBody></p:sp>';
  }
  function pic(id, rId, cx, cy) {
    return '<p:pic><p:nvPicPr><p:cNvPr id="' + id + '" name="Page"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="' + rId + '"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>';
  }
  function slideXml(inner) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld ' + NS_P + '><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' + inner + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>';
  }
  /* doc: the base document (pdf.js), changes: [{page, kind, box, whiteout, text, size, bold}], points: findings for the closing slide */
  async function pptx(doc, changes, points, meta) {
    const p0 = doc.pages[0]; const ratio = (p0.height || 540) / (p0.width || 960);
    const cx = 12192000; const cy = Math.round(cx * ratio);
    const scale = cx / (p0.width || 960); // EMU per PDF point
    const files = [];
    const slides = [];
    const byPage = {}; (changes || []).forEach((c) => { (byPage[c.page] = byPage[c.page] || []).push(c); });
    for (let i = 0; i < doc.pages.length; i += 1) {
      const n = doc.pages[i].number; const pw = doc.pages[i].width || p0.width; const ph = doc.pages[i].height || p0.height;
      const img = await pageJpeg(doc, n, 1600);
      files.push({ name: 'ppt/media/page' + n + '.jpg', data: img });
      let id = 2; let inner = pic(id, 'rId2', cx, Math.round(cx * (ph / pw)));
      (byPage[n] || []).forEach((c) => {
        (c.whiteout || []).forEach((b) => { id += 1; inner += shape(id, 'White-out', b.x * pw * scale, b.y * ph * scale, b.w * pw * scale, b.h * ph * scale, 'FFFFFF', '<a:p/>', { ins: 0 }); });
        if (c.kind !== 'whiteout' && c.box) {
          id += 1;
          const pad = (c.pad !== undefined ? c.pad : (c.size || 8) * 0.45) * scale;
          inner += shape(id, c.label || 'Correction', c.box.x * pw * scale, c.box.y * ph * scale, c.box.w * pw * scale, c.box.h * ph * scale, 'FFFFFF', runs(c.text, c.size || 8, !!c.bold), { ins: Math.round(pad) });
        }
      });
      slides.push(slideXml(inner));
      files.push({ name: 'ppt/slides/_rels/slide' + (i + 1) + '.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/page' + n + '.jpg"/></Relationships>' });
    }
    // closing slide: attention points and what was changed
    const m = 457200; const lineH = 0.02 * cy;
    let inner = shape(2, 'Title', m, m * 0.8, cx - 2 * m, 600000, null, runs('AI Prescreen · ' + (meta && meta.title ? meta.title : 'attention points'), 20, true, '16181F'));
    const lines = [];
    (points || []).slice(0, 18).forEach((f, k) => { lines.push((k + 1) + '. ' + (f.rule || '') + (f.page ? ' · p. ' + f.page : '') + ' · ' + (f.title || '') + (f.resolved ? '  [resolved in the corrected version]' : '')); });
    if ((points || []).length > 18) lines.push('… ' + (points.length - 18) + ' more in the PDF brief');
    if (!lines.length) lines.push('No open attention points.');
    inner += shape(3, 'Points', m, m * 0.8 + 700000, cx - 2 * m, cy - 700000 - 2 * m, null, runs(lines.join('\n'), 11, false, '1F2937'));
    inner += shape(4, 'Foot', m, cy - m * 0.9, cx - 2 * m, 300000, null, runs('Generated by Finalis AI Prescreen · ' + new Date().toISOString().slice(0, 10) + ' · corrections are editable text boxes on each slide; the pages are pictures of the uploaded file', 9, false, '6B7280'));
    slides.push(slideXml(inner));
    files.push({ name: 'ppt/slides/_rels/slide' + slides.length + '.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>' });
    slides.forEach((xml, i) => files.push({ name: 'ppt/slides/slide' + (i + 1) + '.xml', data: xml }));
    const ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' + slides.map((_, i) => '<Override PartName="/ppt/slides/slide' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>').join('') + '</Types>';
    const pres = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation ' + NS_P + ' saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>' + slides.map((_, i) => '<p:sldId id="' + (256 + i) + '" r:id="rId' + (3 + i) + '"/>').join('') + '</p:sldIdLst><p:sldSz cx="' + cx + '" cy="' + cy + '"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>';
    const presRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>' + slides.map((_, i) => '<Relationship Id="rId' + (3 + i) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide' + (i + 1) + '.xml"/>').join('') + '</Relationships>';
    const entries = [
      { name: '[Content_Types].xml', data: ct },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>' },
      { name: 'ppt/presentation.xml', data: pres },
      { name: 'ppt/_rels/presentation.xml.rels', data: presRels },
      { name: 'ppt/slideMasters/slideMaster1.xml', data: pptxMaster() },
      { name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>' },
      { name: 'ppt/slideLayouts/slideLayout1.xml', data: pptxLayout() },
      { name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>' },
      { name: 'ppt/theme/theme1.xml', data: pptxTheme() },
    ].concat(files);
    return zip(entries);
  }

  /* ---------- Word ---------- */
  const NS_W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  function wp(text, opts) {
    const o = opts || {};
    const rpr = '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>' + (o.bold ? '<w:b/>' : '') + (o.color ? '<w:color w:val="' + o.color + '"/>' : '') + '<w:sz w:val="' + Math.round((o.size || 10) * 2) + '"/></w:rPr>';
    const ppr = '<w:pPr>' + (o.style ? '<w:pStyle w:val="' + o.style + '"/>' : '') + '<w:spacing w:before="' + (o.before || 0) + '" w:after="' + (o.after === undefined ? 120 : o.after) + '"/>' + (o.shade ? '<w:shd w:val="clear" w:color="auto" w:fill="' + o.shade + '"/>' : '') + '</w:pPr>';
    const lines = String(text || '').split(/\r?\n/);
    return '<w:p>' + ppr + lines.map((ln, i) => '<w:r>' + rpr + (i ? '<w:br/>' : '') + '<w:t xml:space="preserve">' + X(ln) + '</w:t></w:r>').join('') + '</w:p>';
  }
  function wimg(rId, id, cx, cy) {
    return '<w:p><w:pPr><w:spacing w:before="0" w:after="120"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="' + id + '" name="Page ' + id + '"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="' + id + '" name="page' + id + '.jpg"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="' + rId + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
  }
  function wtable(rows, widths) {
    const grid = widths.map((w) => '<w:gridCol w:w="' + w + '"/>').join('');
    const body = rows.map((cells, ri) => '<w:tr>' + cells.map((c, ci) => '<w:tc><w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/>' + (ri === 0 ? '<w:shd w:val="clear" w:color="auto" w:fill="EEF1F6"/>' : '') + '</w:tcPr>' + wp(c, { size: 8.5, bold: ri === 0, after: 40 }) + '</w:tc>').join('') + '</w:tr>').join('');
    return '<w:tbl><w:tblPr><w:tblW w:w="' + widths.reduce((a, b) => a + b, 0) + '" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D1D5DB"/><w:left w:val="single" w:sz="4" w:color="D1D5DB"/><w:bottom w:val="single" w:sz="4" w:color="D1D5DB"/><w:right w:val="single" w:sz="4" w:color="D1D5DB"/><w:insideH w:val="single" w:sz="4" w:color="E5E7EB"/><w:insideV w:val="single" w:sz="4" w:color="E5E7EB"/></w:tblBorders><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>' + grid + '</w:tblGrid>' + body + '</w:tbl>';
  }
  async function docx(doc, changes, points, meta) {
    const p0 = doc.pages[0]; const landscape = (p0.width || 1) > (p0.height || 1);
    const pageW = landscape ? 15840 : 12240; const pageH = landscape ? 12240 : 15840; const margin = 1080; // twips
    const contentW = pageW - 2 * margin; // twips
    const cxImg = Math.round(contentW * 635); // EMU (1 twip = 635 EMU)
    const rels = []; const media = []; let body = '';
    body += wp((meta && meta.title) || doc.name, { size: 16, bold: true, after: 60 });
    body += wp('Change sheet from Finalis AI Prescreen · ' + new Date().toISOString().slice(0, 10) + (meta && meta.version ? ' · version ' + meta.version : '') + '. The corrections below are editable; each page is shown as a picture of the file, before the corrections.', { size: 9.5, color: '6B7280', after: 200 });
    const byPage = {}; (changes || []).forEach((c) => { (byPage[c.page] = byPage[c.page] || []).push(c); });
    const pagesWithChanges = doc.pages.filter((p) => byPage[p.number]);
    const list = pagesWithChanges.length ? pagesWithChanges : doc.pages.slice(0, 0);
    let id = 1;
    for (const p of list) {
      const img = await pageJpeg(doc, p.number, 1400);
      const rId = 'rIdImg' + p.number; id += 1;
      media.push({ name: 'word/media/page' + p.number + '.jpg', data: img });
      rels.push('<Relationship Id="' + rId + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/page' + p.number + '.jpg"/>');
      body += wp('Page ' + p.number, { size: 12, bold: true, before: 240, after: 80 });
      const ratio = (p.height || p0.height) / (p.width || p0.width);
      body += wimg(rId, id, cxImg, Math.round(cxImg * ratio));
      byPage[p.number].forEach((c) => {
        body += wp((c.label || c.kind) + (c.rule ? ' (' + c.rule + ')' : ''), { size: 9, bold: true, color: '2F5FE3', after: 20 });
        if (c.kind === 'whiteout') body += wp('The passage is removed in the corrected file.', { size: 9.5, color: '6B7280' });
        else body += wp(c.text || '', { size: 10, shade: 'F3F5F9' });
      });
    }
    if (!list.length) body += wp('No corrections were made in the app; the attention points are listed below.', { size: 10, color: '6B7280' });
    body += wp('Attention points', { size: 12, bold: true, before: 360, after: 80 });
    const rows = [['#', 'Rule', 'Page', 'Point', 'Status']];
    (points || []).forEach((f, i) => rows.push([String(i + 1), f.rule || '', f.page ? String(f.page) : 'doc', f.title || '', f.resolved ? 'Resolved in the corrected version' : (f.severity ? f.severity.charAt(0).toUpperCase() + f.severity.slice(1) : '')]));
    if (rows.length === 1) rows.push(['', '', '', 'No open attention points.', '']);
    body += wtable(rows, [Math.round(contentW * 0.05), Math.round(contentW * 0.08), Math.round(contentW * 0.07), Math.round(contentW * 0.56), Math.round(contentW * 0.24)]);
    const document = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + NS_W + '><w:body>' + body + '<w:sectPr><w:pgSz w:w="' + pageW + '" w:h="' + pageH + '"' + (landscape ? ' w:orient="landscape"' : '') + '/><w:pgMar w:top="' + margin + '" w:right="' + margin + '" w:bottom="' + margin + '" w:left="' + margin + '" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>';
    const entries = [
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
      { name: 'word/document.xml', data: document },
      { name: 'word/_rels/document.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels.join('') + '</Relationships>' },
    ].concat(media);
    return zip(entries);
  }
  return { zip, crc32, pptx, docx };
})();
