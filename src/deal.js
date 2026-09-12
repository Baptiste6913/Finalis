'use strict';
/* Deal file. The figures a marketing document commits to (target return and multiple, fund size, hard cap,
   minimum commitment, preferred return, fees, carry, GP commitment, term; the track record is listed but never
   compared) are extracted with a verbatim quote per figure, then checked for consistency inside the document
   and against the earlier documents of the same deal the desk has seen. Two extractors feed the same shape: a
   deterministic pass (regular expressions over the text layer, runs on every pre-review, covers the runs
   without a model) and the model (quick tier, strict schema) whose claims are kept only when the quoted
   passage is on the cited page and carries the figure. Nothing is inferred. */
const Deal = (() => {
  const KEYS = {
    target_return: { label: 'Target return (IRR)', unit: '%' },
    target_multiple: { label: 'Target multiple (MOIC)', unit: 'x' },
    fund_size: { label: 'Fund size / target raise', unit: 'money' },
    hard_cap: { label: 'Hard cap', unit: 'money' },
    min_commitment: { label: 'Minimum commitment', unit: 'money' },
    preferred_return: { label: 'Preferred return', unit: '%' },
    management_fee: { label: 'Management fee', unit: '%' },
    carried_interest: { label: 'Carried interest', unit: '%' },
    track_record_irr: { label: 'Track record IRR', unit: '%', compare: false }, // prior funds and vintages differ by nature
    track_record_multiple: { label: 'Track record multiple', unit: 'x', compare: false },
    gp_commitment: { label: 'GP commitment', unit: '%' },
    fund_term: { label: 'Fund term', unit: 'years' },
  };
  /* a number that is not the tail of a longer one ("1,000" never yields "000"); a range may carry the unit on
     both bounds ("18%–22%", "2.0x – 2.5x") */
  const NUM = '(?<![\\d.,])(\\d{1,3}(?:[.,]\\d{1,2})?)';
  const RANGE_PCT = NUM + '(?:\\s*%)?(?:\\s*(?:-|–|to)\\s*' + NUM + ')?';
  const RANGE_X = NUM + '(?:\\s*x)?(?:\\s*(?:-|–|to)\\s*' + NUM + ')?';
  /* money: a currency sign, digits, and a scale word, or a plain amount with thousands separators ("$250,000") */
  const MONEY = '(\\$|usd|us\\$|€|eur|£|gbp)?\\s?(\\d{1,3}(?:,\\d{3}){2,}(?:\\.\\d+)?|\\d{1,12}(?:[.,]\\d{1,3})?)\\s*(k|m|mm|mn|million|bn|b|billion|thousand)?\\b';
  const CONNECT = '\\s*(?:of|:|=|at)?\\s*';
  const LEAD = '(?:target(?:ed|s|ing)?|projected|expected|seeks?(?: to deliver)?|aims? (?:at|for))\\s+(?:a\\s+|an\\s+)?(?:net\\s+|gross\\s+)?';
  /* each pattern: key, regex (global, case-insensitive), the capture groups holding the number(s), the kind, and for
     the number-first forms the cue they need: a target figure wants "target", "projected", "expected" or "seeks" as
     the nearest cue, a track-record figure wants "realized", "historical", "delivered" or none at all (tables put the
     label after the number: "41% Gross IRR", "2.10x MOIC") */
  const PATTERNS = [
    ['target_return', '\\b' + LEAD + '(?:irr|returns?)' + CONNECT + RANGE_PCT + '\\s*%', [1, 2]],
    ['target_return', '\\b' + RANGE_PCT + '\\s*%\\s*(?:\\+\\s*)?(?:net\\s+|gross\\s+)?(?:target(?:ed)?\\s+)?(?:irr|(?:net\\s+)?returns?)\\b', [1, 2], 'number', 'target'],
    ['target_multiple', '\\b' + LEAD + '(?:moic|multiple|tvpi|return\\s+multiple)' + CONNECT + RANGE_X + '\\s*x', [1, 2]],
    ['target_multiple', '\\b' + RANGE_X + '\\s*x\\s*(?:\\+|plus)?\\s*(?:net\\s+|gross\\s+)?(?:target(?:ed)?\\s+)?(?:moic|multiple|tvpi|(?:fund\\s+)?returns?)\\b', [1, 2], 'number', 'target'],
    ['fund_size', '\\b(?:target\\s+)?(?:fund\\s+size|target\\s+raise|target\\s+fund\\s+size|capital\\s+raise|raising|target\\s+commitments?)' + CONNECT + '(?:up\\s+to\\s+)?' + MONEY, [2], 'money'],
    ['hard_cap', '\\bhard\\s*cap' + CONNECT + MONEY, [2], 'money'],
    ['min_commitment', '\\bminimum\\s+(?:commitment|investment|subscription|ticket)(?:\\s+size)?' + CONNECT + MONEY, [2], 'money'],
    ['min_commitment', '\\b(?:and|or|,)\\s*' + MONEY + '\\s+for\\s+(?:individual|retail|accredited|non-institutional|other|natural)', [2], 'money', 'minimum'], // the second tier of a minimum ("$5M for institutions and $250,000 for individuals")
    ['preferred_return', '\\b(?:preferred\\s+return|hurdle(?:\\s+rate)?|pref(?:erred)?)' + CONNECT + RANGE_PCT + '\\s*%', [1, 2]],
    ['preferred_return', '\\b' + RANGE_PCT + '\\s*%\\s*(?:preferred\\s+return|hurdle(?:\\s+rate)?|pref\\b)', [1, 2]],
    ['management_fee', '\\bmanagement\\s+fee' + CONNECT + RANGE_PCT + '\\s*%', [1, 2]],
    ['management_fee', '\\b' + RANGE_PCT + '\\s*%\\s*(?:per\\s+(?:year|annum)\\s+|annual\\s+|p\\.a\\.\\s+)?management\\s+fee', [1, 2]],
    ['carried_interest', '\\b(?:carried\\s+interest|carry|performance\\s+fee|promote)' + CONNECT + RANGE_PCT + '\\s*%', [1, 2]],
    ['carried_interest', '\\b' + RANGE_PCT + '\\s*%\\s*(?:carried\\s+interest|carry\\b|promote\\b)', [1, 2]],
    ['track_record_irr', '\\b(?:realized|realised|net|gross|historical|achieved|delivered|generated)\\s+(?:net\\s+|gross\\s+)?irr\\s*(?:of|:|=|was|is)\\s*' + RANGE_PCT + '\\s*%', [1, 2], 'number', 'record'],
    ['track_record_irr', '\\b' + RANGE_PCT + '\\s*%\\s*(?:realized|realised|net|gross|historical)\\s+irr\\b', [1, 2], 'number', 'record'],
    ['track_record_multiple', '\\b(?:realized|realised|net|gross|historical|achieved|delivered|generated)\\s+(?:net\\s+|gross\\s+)?(?:moic|multiple|tvpi|dpi)\\s*(?:of|:|=|was|is)\\s*' + RANGE_X + '\\s*x', [1, 2], 'number', 'record'],
    ['track_record_multiple', '\\b' + RANGE_X + '\\s*x\\s*(?:net\\s+|gross\\s+)?(?:moic|tvpi|dpi)\\b', [1, 2], 'number', 'record'],
    ['gp_commitment', '\\bgp\\s+commit(?:ment)?' + CONNECT + RANGE_PCT + '\\s*%', [1, 2]],
    ['fund_term', '\\b(?:fund\\s+)?term' + CONNECT + '(\\d{1,2})(?:\\s*(?:-|–|to)\\s*(\\d{1,2}))?\\s*(?:-\\s*)?years?', [1, 2]],
    ['fund_term', '\\b(\\d{1,2})\\s*-\\s*year\\s+(?:fund\\s+)?term\\b', [1], 'number'],
  ].map(([key, re, groups, kind, ctx]) => ({ key, re: new RegExp(re, 'gi'), groups, kind: kind || 'number', ctx: ctx || '' }));
  const TARGET_CUE = /\b(target(?:ed|s|ing)?|projected|projection|expected|seeks?|aims?|forecast)\b/gi;
  const RECORD_CUE = /\b(realized|realised|historical|achieved|delivered|actual|since inception|vintage|past fund|track record)\b/gi;
  const SCALE = { k: 0.001, thousand: 0.001, m: 1, mm: 1, mn: 1, million: 1, bn: 1000, b: 1000, billion: 1000 };
  const CUR = { usd: '$', 'us$': '$', eur: '€', gbp: '£' };

  const finite = (n) => (typeof n === 'number' && Number.isFinite(n) ? n : null);
  const toNum = (s) => finite(parseFloat(String(s || '').replace(',', '.')));
  /* "1,500" is fifteen hundred, "1,5" is one and a half */
  const money = (s) => finite(parseFloat(String(s || '').replace(/,(\d{1,2})$/, '.$1').replace(/,/g, '')));
  const roundTo = (n, d) => Math.round(n * d) / d;
  function fmt(c) {
    if (c.unit === 'money') { const m = c.num; const cur = c.currency || ''; return cur + (m >= 1000 ? roundTo(m / 1000, 100) + 'bn' : m < 1 ? Math.round(m * 1000) + 'k' : roundTo(m, 100) + 'm'); }
    const one = (n) => String(roundTo(n, 100));
    return one(c.num) + (c.num2 !== null && c.num2 !== undefined ? '–' + one(c.num2) : '') + (c.unit === 'years' ? ' years' : c.unit);
  }
  function interval(c) { const lo = c.num; const hi = c.num2 !== null && c.num2 !== undefined ? c.num2 : c.num; return [Math.min(lo, hi), Math.max(lo, hi)]; }
  /* two figures for the same key agree when their ranges overlap (a 20% target inside an 18–22% range is not a contradiction) */
  function agree(a, b) { const x = interval(a); const y = interval(b); return x[0] <= y[1] + 1e-9 && y[0] <= x[1] + 1e-9; }
  function normalizeClaim(c) {
    if (!c || typeof c !== 'object' || !KEYS[c.key]) return null;
    const unit = KEYS[c.key].unit;
    const num = typeof c.num === 'number' ? finite(c.num) : (unit === 'money' ? money(c.num) : toNum(c.num));
    if (num === null || num < 0) return null;
    const num2 = c.num2 === null || c.num2 === undefined || c.num2 === '' ? null : (typeof c.num2 === 'number' ? finite(c.num2) : toNum(c.num2));
    if (unit === '%' && num > 200) return null;
    if (unit === 'x' && num > 100) return null;
    if (unit === 'years' && num > 30) return null;
    if (unit === 'money' && num > 100000) return null; // over $100bn is a unit mistake, not a fund
    const page = Number.isInteger(+c.page) && +c.page > 0 ? +c.page : null;
    if (!page) return null;
    const out = { key: c.key, label: KEYS[c.key].label, unit, num, num2: num2 === null || !Number.isFinite(num2) ? null : num2, page, quote: String(c.quote || '').replace(/\s+/g, ' ').trim().slice(0, 200), source: c.source || 'model' };
    if (unit === 'money' && c.currency) out.currency = String(c.currency).slice(0, 4);
    out.value = c.value ? String(c.value).slice(0, 60) : fmt(out);
    return out;
  }

  /* ---------- deterministic extractor ---------- */
  /* runs of spaces are collapsed once so that no pattern ever backtracks over a long blank run (the text layer of a
     slide can hold thousands of spaces); line breaks are kept because the cues are read per line */
  function flatten(text) { return String(text || '').replace(/[^\S\n]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{2,}/g, '\n'); }
  function lastCue(re, s) { let last = -1; let m; re.lastIndex = 0; while ((m = re.exec(s))) last = s.length - (m.index + m[0].length); return last; } // distance from the end
  function firstCue(re, s) { re.lastIndex = 0; const m = re.exec(s); return m ? m.index : -1; } // distance from the start
  /* the nearest cue around a number-first match: on the same line first, then the tail of the line above */
  function cueAround(text, index, length) {
    const lineStart = text.lastIndexOf('\n', index - 1) + 1;
    const lineEnd = (() => { const i = text.indexOf('\n', index + length); return i === -1 ? text.length : i; })();
    const before = text.slice(Math.max(lineStart, index - 60), index);
    const after = text.slice(index + length, Math.min(lineEnd, index + length + 60));
    const cands = [];
    [[TARGET_CUE, 'target'], [RECORD_CUE, 'record']].forEach(([re, kind]) => {
      const b = lastCue(re, before); if (b >= 0) cands.push({ kind, d: b });
      const a = firstCue(re, after); if (a >= 0) cands.push({ kind, d: a + 1 });
    });
    if (!cands.length && lineStart > 0) { // a heading on the line above ("Target returns")
      const prevLine = text.slice(text.lastIndexOf('\n', lineStart - 2) + 1, lineStart - 1).slice(-60);
      [[TARGET_CUE, 'target'], [RECORD_CUE, 'record']].forEach(([re, kind]) => { const b = lastCue(re, prevLine); if (b >= 0) cands.push({ kind, d: 100 + b }); });
    }
    if (!cands.length) return '';
    cands.sort((p, q) => p.d - q.d);
    return cands[0].kind;
  }
  function scan(pages) {
    const out = [];
    (pages || []).forEach((p) => {
      if (!p || !Number.isInteger(+p.number)) return;
      const text = flatten(p.text);
      if (!text) return;
      PATTERNS.forEach((pt) => {
        pt.re.lastIndex = 0;
        let m; let guard = 0;
        while ((m = pt.re.exec(text)) && guard < 40) {
          guard += 1;
          if (pt.ctx === 'minimum') {
            if (!/\bminimum\b/i.test(text.slice(text.lastIndexOf('\n', m.index - 1) + 1, m.index).slice(-160))) continue; // only in a sentence about a minimum
          } else if (pt.ctx) {
            const cue = TARGET_CUE.test(m[0]) ? 'target' : cueAround(text, m.index, m[0].length);
            TARGET_CUE.lastIndex = 0;
            if (pt.ctx === 'target' ? cue !== 'target' : cue === 'target') continue;
          }
          let claim;
          if (pt.kind === 'money') {
            const n = money(m[2]); const scaleWord = String(m[3] || '').toLowerCase(); const sc = SCALE[scaleWord];
            if (n === null) continue;
            let millions;
            if (sc) millions = n * sc;
            else if (/,\d{3}/.test(m[2]) && n >= 1000) millions = n / 1e6; // "$250,000"
            else continue;
            const cur = m[1] ? (CUR[m[1].toLowerCase()] || m[1]) : '';
            claim = { key: pt.key, num: roundTo(millions, 1000), num2: null, currency: cur, page: +p.number, quote: quoteAround(text, m.index, m[0].length), source: 'scan' };
          } else {
            const a = toNum(m[pt.groups[0]]); const b = pt.groups[1] !== undefined && m[pt.groups[1]] ? toNum(m[pt.groups[1]]) : null;
            if (a === null) continue;
            claim = { key: pt.key, num: a, num2: b, page: +p.number, quote: quoteAround(text, m.index, m[0].length), source: 'scan' };
          }
          const n = normalizeClaim(claim);
          if (n) out.push(n);
        }
      });
    });
    return dedupe(out);
  }
  /* the phrase around a match: up to 70 characters each way, stopped at a line break, a semicolon, a bullet or a
     full stop that ends a sentence (never the point inside "2.5x") */
  function quoteAround(text, index, length) {
    const stop = (i) => { const ch = text[i]; if (ch === '\n' || ch === ';' || ch === '•') return true; const nx = text[i + 1]; return ch === '.' && (nx === undefined || /\s/.test(nx)); };
    let from = index; let to = index + length;
    while (from > 0 && index - from < 70 && !stop(from - 1)) from -= 1;
    while (to < text.length && to - (index + length) < 70 && !stop(to)) to += 1;
    return text.slice(from, to).replace(/\s+/g, ' ').trim();
  }
  function dedupe(list) {
    const seen = new Set(); const out = [];
    list.forEach((c) => { const k = c.key + '|' + c.page + '|' + c.num + '|' + c.num2; if (seen.has(k)) return; seen.add(k); out.push(c); });
    return out;
  }

  /* ---------- model extractor ---------- */
  const SCHEMA = 'Reply with ONLY one JSON object: {"claims": [{"key": "<one of ' + Object.keys(KEYS).join(' | ') + '>", "value": "as written, e.g. 20% net IRR", "num": 20, "num2": null, "unit": "%" | "x" | "money" | "years", "currency": "$", "page": 12, "quote": "verbatim passage from that page containing the figure, max 160 characters"}]}. Rules: only figures the text states; never infer, compute or convert beyond the units below; a range goes in num and num2; money in millions (num) with the currency symbol in "currency"; one entry per occurrence, even when the same figure appears on several pages; the quote must be copied verbatim from the page text so it can be located. No prose.';
  function pagesFor(pages, budgetBytes) {
    const KW = /\b(irr|moic|multiple|fund size|hard cap|commitment|preferred|hurdle|management fee|carr(y|ied)|track record|target|term|gp\b|fees?)\b/i;
    const texts = (pages || []).map((p) => ({ n: p.number, t: Prompts.cleanText(p.text || ''), hot: KW.test(p.text || '') }));
    let out = ''; let used = 0;
    texts.filter((x) => x.hot).concat(texts.filter((x) => !x.hot)).forEach((x) => {
      if (!x.t) return;
      const room = budgetBytes - used; if (room < 600) return;
      let t = x.t.slice(0, x.hot ? 3500 : 900);
      while (U.byteLength(t) > room - 24 && t.length > 200) t = t.slice(0, Math.floor(t.length * 0.8));
      out += '\n[page ' + x.n + ']\n' + t; used += U.byteLength(t) + 12;
    });
    return out;
  }
  /* the figure must be in the located passage, not only the words around it: the digits of num (or of its
     thousand/million spellings) have to appear in the span the quote covers, widened a little either way */
  function figureInSpan(claim, page, loc) {
    const text = String(page.text || '');
    const span = text.slice(Math.max(0, loc.start - 40), Math.min(text.length, loc.end + 40)).replace(/\s+/g, ' ');
    const spellings = (n) => { const base = [n, n * 1000, n / 1000, n * 100]; const out = []; base.forEach((v) => { if (!Number.isFinite(v) || v < 0.01) return; const s = String(roundTo(v, 100)); if (/^0(\.0+)?$/.test(s)) return; out.push(s); if (s.includes('.')) out.push(s.replace('.', ',')); if (Number.isInteger(v) && v >= 1000) out.push(v.toLocaleString('en-US')); }); return out; };
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const hit = (n) => spellings(n).some((s) => new RegExp('(?<![\\d.,])' + esc(s) + '(?![\\d]|[.,]\\d)').test(span)); // the whole figure, never the head or the tail of another ("2" is not "2.5x")
    return hit(claim.num) && (claim.num2 === null || hit(claim.num2));
  }
  async function extract(sample, pages, opts) {
    const o = opts || {};
    const scanned = scan(pages);
    if (!sample) return { claims: scanned, source: 'scan' };
    const prompt = 'You read one piece of investment marketing material for a compliance desk. Extract the figures the material commits to or advertises, as listed in the schema. ' + SCHEMA + '\n\nDOCUMENT TEXT BY PAGE:' + pagesFor(pages, Math.max(8000, (o.maxBytes || 65536) - 2500));
    let res = null;
    try { res = await sample.json(prompt, { modelTier: 'quick', cache: o.cache !== false, signal: o.signal }); }
    catch (e) { if (e && e.code === 'cancelled') throw e; return { claims: scanned, source: 'scan', error: e && e.code ? e.code : 'error' }; }
    const raw = res && Array.isArray(res.claims) ? res.claims : [];
    const kept = [];
    raw.forEach((c) => {
      const n = normalizeClaim(Object.assign({}, c, { source: 'model' }));
      if (!n || !n.quote) return;
      const page = (pages || []).find((p) => p.number === n.page);
      const loc = page ? Engine.locate(page, n.quote) : null;
      if (!loc || !figureInSpan(n, page, loc)) return; // a figure without its passage, or a passage without the figure, is not a claim
      const twin = scanned.find((s) => s.key === n.key && s.page === n.page && agree(s, n));
      if (twin) { twin.source = 'model+scan'; return; } // the scanner read the same figure: its number is exact, keep it
      kept.push(n);
    });
    const merged = scanned.concat(kept);
    return { claims: dedupe(merged), source: kept.length || scanned.some((s) => s.source === 'model+scan') ? 'model+scan' : 'scan' };
  }

  /* ---------- consistency ---------- */
  function docLabel(sub) { return sub && sub.file && sub.file.name ? sub.file.name : 'this document'; }
  const pick = (c, doc) => ({ value: c.value, page: c.page, quote: c.quote, doc: doc || null });
  const comparable = (c) => !!(c && KEYS[c.key] && KEYS[c.key].compare !== false && Number.isInteger(c.page) && Number.isFinite(c.num));
  /* the pages of one key, clustered by agreeing value: more than one cluster is a contradiction (two values on one
     page are tiers or share classes, and they keep the page in one cluster) */
  function clusters(list) {
    const pages = {};
    list.forEach((c) => (pages[c.page] = pages[c.page] || []).push(c));
    const out = [];
    Object.keys(pages).map(Number).sort((a, b) => a - b).forEach((pg) => {
      const group = pages[pg];
      const hit = out.find((cl) => cl.claims.some((a) => group.some((b) => agree(a, b))));
      if (hit) { hit.pages.push(pg); hit.claims = hit.claims.concat(group); }
      else out.push({ pages: [pg], claims: group.slice() });
    });
    return out;
  }
  const valuesOf = (cl) => Array.from(new Set(cl.claims.map((c) => c.value))).join(' / ');
  const pagesOf = (cl) => 'p. ' + cl.pages.join(', ');
  /* inside one document: one contradiction per figure, listing every value cluster and its pages */
  function internal(claims) {
    const byKey = {};
    (claims || []).filter(comparable).forEach((c) => (byKey[c.key] = byKey[c.key] || []).push(c));
    const out = [];
    Object.keys(byKey).forEach((key) => {
      const cl = clusters(byKey[key]);
      if (cl.length < 2) return;
      out.push({ kind: 'internal', key, label: KEYS[key].label, values: cl.map((x) => pick(x.claims[0])), text: KEYS[key].label + ' is stated as ' + cl.map((x) => valuesOf(x) + ' (' + pagesOf(x) + ')').join(' and as ') + '.' });
    });
    return out;
  }
  /* the deal file: the earlier documents of the same deal. The same thread (earlier rounds) always counts; another
     document counts when it comes from the same firm, looks alike to the desk (Learn.similarity) and shares the
     subject or the file name, so that a firm's other funds are never mistaken for this one. */
  /* the words that name a deal, without the words every fund document carries */
  const GENERIC = new Set(['fund', 'funds', 'deck', 'pitch', 'final', 'draft', 'fundraising', 'presentation', 'marketing', 'material', 'materials', 'private', 'equity', 'credit', 'capital', 'partners', 'partner', 'targeting', 'institutional', 'investors', 'investor', 'opportunities', 'opportunity', 'growth', 'income', 'venture', 'management', 'overview', 'teaser', 'summary', 'executive', 'memorandum', 'confidential', 'information', 'limited', 'partnership', 'offering', 'strategy', 'advisors', 'advisers', 'securities', 'group', 'holdings', 'company', 'placement', 'update', 'investment', 'investments', 'real', 'estate', 'infrastructure', 'debt', 'buyout', 'secondaries', 'international', 'global', 'north', 'america', 'europe', 'asia']);
  function subjectTokens(sub) {
    const p = (sub && sub.result && sub.result.profile) || {};
    const name = String((sub && sub.file && sub.file.name) || '').replace(/\.[a-z0-9]+$/i, '').replace(/\(corrected v\d+\)/i, '');
    return new Set(U.normalize(name + ' ' + (p.subject || '') + ' ' + (p.material_kind || '')).split(/[^a-z0-9]+/).filter((t) => t.length > 3 && !/^v?\d+$/.test(t) && !GENERIC.has(t)));
  }
  function subjectOverlap(a, b) { const x = subjectTokens(a); const y = subjectTokens(b); if (!x.size || !y.size) return 0; let n = 0; x.forEach((t) => { if (y.has(t)) n += 1; }); return n / Math.min(x.size, y.size); }
  function sameThread(sub, other) { return !!(sub && other && ((sub.thread && other.thread && sub.thread === other.thread) || (sub.previous && sub.previous.id === other.id))); }
  function sameDeal(sub, other) {
    if (!sub || !other || other.id === sub.id) return false;
    if (sameThread(sub, other)) return true;
    const a = sub.form || {}; const b = other.form || {};
    if (!a.bankName || !b.bankName || String(a.bankName).trim().toLowerCase() !== String(b.bankName).trim().toLowerCase()) return false;
    return Learn.similarity(sub, other) >= 0.5 && subjectOverlap(sub, other) >= 0.34;
  }
  function earlier(sub, other) { return !sub.created_at || !other.created_at || other.created_at < sub.created_at; }
  function across(sub, claims, others) {
    const out = []; const changed = []; const file = [];
    const mine = (claims || []).filter(comparable);
    (others || []).filter((o) => o && Array.isArray(o.claims) && o.claims.length && sameDeal(sub, o) && earlier(sub, o)).forEach((o) => {
      const thread = sameThread(sub, o);
      file.push({ id: o.id, name: docLabel(o), at: o.created_at || '', status: o.status || 'submitted', round: o.round || 1, thread, figures: o.claims.length });
      Array.from(new Set(mine.map((c) => c.key))).forEach((key) => {
        const ours = mine.filter((c) => c.key === key); const theirs = o.claims.filter((x) => comparable(x) && x.key === key);
        if (!theirs.length || ours.some((c) => theirs.some((x) => agree(c, x)))) return; // agrees with at least one of their values: nothing to say
        const c = ours[0]; const x = theirs[0];
        const entry = { kind: thread ? 'round' : 'deal', key, label: KEYS[key].label, values: [pick(c), pick(x, docLabel(o))] };
        if (thread) { entry.text = KEYS[key].label + ' was ' + theirs.map((v) => v.value).join(' / ') + ' in round ' + (o.round || 1) + ' (p. ' + x.page + '), now ' + ours.map((v) => v.value).join(' / ') + ' (p. ' + c.page + ').'; changed.push(entry); }
        else { entry.text = KEYS[key].label + ' is ' + ours.map((v) => v.value).join(' / ') + ' here (p. ' + c.page + ') but ' + theirs.map((v) => v.value).join(' / ') + ' in ' + docLabel(o) + ' (p. ' + x.page + ', ' + String(o.created_at || '').slice(0, 10) + ').'; out.push(entry); }
      });
    });
    return { contradictions: out, changed, file };
  }
  function consistency(sub, claims, others) {
    const inner = internal(claims);
    const deal = across(sub, claims, others);
    return { internal: inner, deal: deal.contradictions, changed: deal.changed, file: deal.file, contradictions: inner.concat(deal.contradictions), checked: (claims || []).length, at: new Date().toISOString() };
  }

  return { KEYS, scan, extract, consistency, internal, across, agree, fmt, normalizeClaim, sameDeal, flatten };
})();
