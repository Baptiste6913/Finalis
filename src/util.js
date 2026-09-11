'use strict';
const U = (() => {
  /* Character folding shared by the document text and the quotes: curly quotes, dashes, non-breaking
     spaces, ligatures, soft hyphens and zero-width characters. Returns the folded string for ONE character
     (possibly two characters for a ligature, or nothing for an invisible character). */
  const FOLD = { '\u2018': "'", '\u2019': "'", '\u02bc': "'", '\u201c': '"', '\u201d': '"', '\u2013': '-', '\u2014': '-', '\u2212': '-', '\u2010': '-', '\u2011': '-', '\u00a0': ' ', '\u2009': ' ', '\u202f': ' ', '\u2007': ' ', '\ufb01': 'fi', '\ufb02': 'fl', '\ufb00': 'ff', '\ufb03': 'ffi', '\ufb04': 'ffl', '\u00ad': '', '\u200b': '', '\u200c': '', '\u200d': '', '\ufeff': '', '\u2026': '...' };
  function foldChar(ch) {
    const f = FOLD[ch];
    if (f !== undefined) return f;
    return ch.toLowerCase();
  }
  /* Collapse a text into its search form with a map from every search offset back to the raw offset:
     folded characters, whitespace runs to one space, no spaces around hyphens (pdf.js writes "risk - adjusted"),
     trimmed. Used for the document pages; `normalize` applies the same rules to a quote. */
  function collapse(text) {
    let out = '';
    const map = [];
    let space = false;
    for (let i = 0; i < text.length; i += 1) {
      const raw = text[i];
      const f = foldChar(raw);
      if (f === '') continue;
      for (let k = 0; k < f.length; k += 1) {
        const ch = f[k];
        if (ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r' || ch === '\f' || ch === '\v') {
          if (out.length && !space) { out += ' '; map.push(i); space = true; }
          continue;
        }
        if (ch === '-' && space && out.length > 1) { out = out.slice(0, -1); map.pop(); space = false; }
        out += ch; map.push(i);
        space = false;
        if (ch === '-') space = 'hyphen';
      }
    }
    // "space === 'hyphen'" means the last char is a hyphen: a following space is dropped by the loop above
    while (out.endsWith(' ')) { out = out.slice(0, -1); map.pop(); }
    return { text: out, map };
  }
  function normalize(text) { return collapse(String(text || '')).text; }
  /* Lowercase and unify quotes without changing string length (kept for callers that need raw offsets). */
  function lower(text) {
    return (text || '')
      .replace(/[\u2018\u2019\u02bc]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2013\u2014\u2212]/g, '-')
      .replace(/\u00a0/g, ' ')
      .toLowerCase();
  }
  function editDistance(a, b, cap) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    if (Math.abs(a.length - b.length) > cap) return cap + 1;
    let prev = new Array(b.length + 1);
    let cur = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j += 1) prev[j] = j;
    for (let i = 1; i <= a.length; i += 1) {
      cur[0] = i;
      let best = cur[0];
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
        if (cur[j] < best) best = cur[j];
      }
      if (best > cap) return cap + 1;
      const t = prev; prev = cur; cur = t;
    }
    return prev[b.length];
  }
  function ratio(a, b) {
    if (!a.length && !b.length) return 100;
    const cap = Math.ceil(Math.max(a.length, b.length) * 0.5);
    const d = editDistance(a, b, cap);
    return Math.max(0, 100 - (d * 100) / Math.max(a.length, b.length));
  }
  /* Best alignment of needle inside haystack (sliding window), returns score and position. */
  function partialRatio(haystack, needle) {
    if (!needle || !haystack) return { score: 0, start: -1, end: -1 };
    if (haystack.length < needle.length * 0.5) return { score: 0, start: -1, end: -1 };
    const size = needle.length;
    const step = Math.max(1, Math.floor(size / 12));
    let best = { score: 0, start: -1, end: -1 };
    const limit = Math.max(0, haystack.length - size);
    const sc = (s) => ratio(haystack.slice(s, s + size), needle);
    for (let s = 0; s <= limit; s += step) {
      const score = sc(s);
      if (score > best.score) best = { score, start: s, end: s + size };
      if (score > 99) break;
    }
    if (best.start >= 0 && step > 1) {
      const from = Math.max(0, best.start - step);
      const to = Math.min(limit, best.start + step);
      for (let s = from; s <= to; s += 1) {
        const score = sc(s);
        if (score > best.score) best = { score, start: s, end: s + size };
      }
    }
    return best;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmtBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso; }
  }
  function uid(prefix) {
    const t = Date.now().toString(36);
    const r = Math.random().toString(36).slice(2, 8);
    return (prefix || 'id') + '-' + t + '-' + r;
  }
  async function sha256(bytes) {
    try {
      const h = await crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) { return ''; }
  }
  function byteLength(s) { return new TextEncoder().encode(s).length; }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach((k) => {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach((c) => { if (c != null) node.append(c); });
    return node;
  }
  let toastTimer = null;
  function toast(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = el('div', { id: 'toast', class: 'toast', role: 'status' }); document.body.append(t); }
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); toast('Copied'); }
    catch (e) {
      const ta = el('textarea', { style: 'position:fixed;left:-9999px' });
      ta.value = text; document.body.append(ta); ta.select();
      try { document.execCommand('copy'); toast('Copied'); } catch (e2) { toast('Copy failed'); }
      ta.remove();
    }
  }
  return { normalize, lower, foldChar, editDistance, ratio, partialRatio, collapse, esc, fmtBytes, fmtDate, uid, sha256, byteLength, clamp, el, toast, copyText };
})();
