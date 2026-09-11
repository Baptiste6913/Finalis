'use strict';
/* Deterministic engine: lane, required blocks (fuzzy verbatim), legibility, coverage facts,
   trigger and lexicon candidates, page statistics and role hints. Produces `facts` for the UI
   and for the model. Nothing here decides a Tier B or C finding: those are candidates. */
const Engine = (() => {
  function rawSpan(page, start, end) {
    const map = page.searchMap || [];
    if (!map.length) return { start, end };
    const from = map[Math.max(0, Math.min(start, map.length - 1))];
    const to = map[Math.max(0, Math.min(end - 1, map.length - 1))] + 1;
    return { start: from, end: Math.max(from + 1, to) };
  }
  function spansBetween(page, start, end) {
    return (page.spans || []).filter((s) => s.end > start && s.start < end);
  }
  /* Approximate advance widths (em units) for proportional splitting inside a span: pdf.js gives the width
     of a whole text item, not of each glyph. Good enough to start and end a highlight mid-span. */
  const GLYPH = { ' ': 0.28, 'i': 0.26, 'j': 0.26, 'l': 0.24, "'": 0.2, '!': 0.28, '.': 0.28, ',': 0.28, ':': 0.28, ';': 0.28, '|': 0.24, 'f': 0.32, 't': 0.34, 'r': 0.36, 'I': 0.28, '(': 0.32, ')': 0.32, '-': 0.36, 'm': 0.86, 'w': 0.78, 'M': 0.88, 'W': 0.94, '%': 0.9, '$': 0.56, '0': 0.56, '1': 0.56, '2': 0.56, '3': 0.56, '4': 0.56, '5': 0.56, '6': 0.56, '7': 0.56, '8': 0.56, '9': 0.56 };
  function glyphWidth(ch) {
    if (GLYPH[ch] !== undefined) return GLYPH[ch];
    if (ch >= 'A' && ch <= 'Z') return 0.68;
    return 0.55;
  }
  function textWidth(text) { let w = 0; for (let i = 0; i < text.length; i += 1) w += glyphWidth(text[i]); return w; }
  /* Highlight boxes for a raw range: per span, only the covered part (proportional split), then merged per
     visual line. Coordinates are normalised to the page box. */
  function boxesFor(page, start, end) {
    const hits = spansBetween(page, start, end);
    if (!hits.length) return [];
    const pieces = [];
    hits.forEach((span) => {
      const len = span.text.length || 1;
      const cs = Math.max(0, start - span.start);
      const ce = Math.min(len, end - span.start);
      if (ce <= cs) return;
      const total = textWidth(span.text) || 1;
      const x0 = span.box.x + span.box.w * (textWidth(span.text.slice(0, cs)) / total);
      const x1 = span.box.x + span.box.w * (textWidth(span.text.slice(0, ce)) / total);
      pieces.push({ y: span.box.y, x: x0, right: x1, h: span.box.h, covered: (ce - cs) / len });
    });
    if (!pieces.length) return [];
    const lines = [];
    pieces.forEach((pc) => {
      const line = lines.find((l) => Math.abs(l.y - pc.y) < Math.max(l.h, pc.h, 0.004) * 0.6);
      if (line) { line.x = Math.min(line.x, pc.x); line.right = Math.max(line.right, pc.right); line.h = Math.max(line.h, pc.h); line.y = Math.min(line.y, pc.y); }
      else lines.push({ y: pc.y, x: pc.x, right: pc.right, h: pc.h });
    });
    lines.sort((a, b) => a.y - b.y);
    return lines.slice(0, 12).map((l) => ({
      page: page.number, x: Math.max(0, l.x - 0.003), y: Math.max(0, l.y - 0.004),
      w: Math.min(1, l.right - l.x + 0.006), h: Math.min(1, l.h + 0.008),
    }));
  }
  function sizesFor(page, start, end) {
    const hits = spansBetween(page, start, end).filter((s) => s.size > 0);
    if (!hits.length) return null;
    return Math.min.apply(null, hits.map((s) => s.size));
  }
  /* Find a block of text (fuzzy) in the pages. Long needles are pre-filtered with exact anchors
     (five 12-character slices): a block whose every anchor is mangled is not the block, and this keeps
     the Levenshtein pass to a few windows instead of the whole document. */
  function anchorsOf(needle) {
    const n = needle.length;
    if (n < 16) return null;
    const len = n < 40 ? 7 : 12;
    const count = n < 40 ? 3 : 5;
    const out = [];
    for (let k = 0; k < count; k += 1) {
      const at = Math.min(n - len, Math.round((k * (n - len)) / (count - 1)));
      out.push({ at, text: needle.slice(at, at + len) });
    }
    return out;
  }
  function bestInPage(hay, needle, anchors) {
    if (!hay) return { score: 0, start: -1, end: -1 };
    const exact = hay.indexOf(needle);
    if (exact !== -1) return { score: 100, start: exact, end: exact + needle.length };
    if (!anchors) return U.partialRatio(hay, needle);
    const size = needle.length;
    const starts = new Set();
    anchors.forEach((a) => {
      let idx = hay.indexOf(a.text);
      let guard = 0;
      while (idx !== -1 && guard < 12) {
        guard += 1;
        const base = idx - a.at;
        for (let d = -Math.round(size * 0.15); d <= Math.round(size * 0.15); d += 3) {
          const s = base + d;
          if (s >= 0 && s <= hay.length - Math.round(size * 0.6)) starts.add(s);
        }
        idx = hay.indexOf(a.text, idx + 1);
      }
    });
    let best = { score: 0, start: -1, end: -1 };
    starts.forEach((s) => {
      const score = U.ratio(hay.slice(s, s + size), needle);
      if (score > best.score) best = { score, start: s, end: Math.min(hay.length, s + size) };
    });
    return best;
  }
  function findBlock(pages, needleRaw, threshold, scope) {
    const needle = U.normalize(needleRaw);
    const anchors = anchorsOf(needle);
    const search = scope === 'first_page' ? pages.slice(0, 1) : pages;
    let best = null;
    search.forEach((page) => {
      const hay = page.search || '';
      if (!hay) return;
      const hit = bestInPage(hay, needle, anchors);
      if (!best || hit.score > best.score) best = { score: hit.score, page, start: hit.start, end: hit.end };
    });
    if (!best || best.start < 0 || best.score < threshold) return { found: false, best };
    const raw = rawSpan(best.page, best.start, best.end);
    return {
      found: true, score: best.score, page: best.page, start: raw.start, end: raw.end,
      excerpt: best.page.search.slice(Math.max(0, best.start), best.end).trim().slice(0, 400),
      boxes: boxesFor(best.page, raw.start, raw.end), minSize: sizesFor(best.page, raw.start, raw.end),
    };
  }
  function findAny(pages, options, threshold, scope) {
    let best = { found: false, best: null };
    for (let i = 0; i < options.length; i += 1) {
      const hit = findBlock(pages, options[i], threshold, scope);
      if (hit.found) return hit;
      if (!best.best || (hit.best && hit.best.score > best.best.score)) best = hit;
    }
    return best;
  }

  function resolveLane(form) {
    const publicChannel = (form.distribution || []).some((d) => /linkedin|website/i.test(d));
    if (form.docType === 'linkedin-post' || form.docType === 'linkedin-profile' || form.docType === 'website') return { lane: 'retail', reason: 'public channel: the audience cannot be controlled' };
    if (publicChannel) return { lane: 'retail', reason: 'distributed through a public channel, so treated as a retail communication' };
    if (form.audience === 'retail') return { lane: 'retail', reason: 'the audience includes natural persons or more than 25 retail investors' };
    if (form.audience === 'institutional') return { lane: 'institutional', reason: 'institutional investors only, controlled distribution' };
    return { lane: 'retail', reason: 'audience not confirmed, defaulting to the retail checklist' };
  }

  function countMatches(text, re) {
    const seen = new Map();
    re.lastIndex = 0;
    let m;
    let guard = 0;
    while ((m = re.exec(text)) && guard < 400) {
      guard += 1;
      const key = m[0].toLowerCase();
      seen.set(key, (seen.get(key) || 0) + 1);
      if (m[0].length === 0) re.lastIndex += 1;
    }
    return seen;
  }
  function roleHint(page, index, total) {
    const t = page.search || '';
    const head = t.slice(0, 220);
    if (!page.textLayer && page.kind === 'pdf') return 'no text layer';
    if (page.charCount < 45) return 'section divider';
    if (index === 0) return 'cover';
    if (/table of contents|\bcontents\b|\bagenda\b/.test(head) && page.charCount < 600) return 'toc';
    if (/\bdisclaimers?\b|important (?:disclosures|information)|\bdisclosures?\b/.test(head) && page.charCount > 800) return 'disclaimers';
    if (/risk factors|key risks/.test(head) && page.charCount > 600) return 'risk factors';
    if (index === total - 1 && /contact|@|thank you/.test(t)) return 'contact';
    return '';
  }
  /* Period/category labels paired with values ("2027 EUR 450m", "Year 3 7.5%", "Q2 2026 $4.2 million"):
     three or more of them on a page is the text layer of a chart or a table of figures. Charts drawn as
     vector shapes leave no image object, so this is what tells an exhibit from a text slide. */
  const SERIES_RE = /\b(?:(?:19|20)\d{2}|fy\s?'?\d{2,4}|q[1-4](?:\s?(?:19|20)?\d{2})?|h[12]\s?(?:19|20)?\d{2}|year\s?\d{1,2}|ytd|ltm|ttm)\b[^\n]{0,26}?(?:\d[\d,.]*\s?(?:%|x|m|mm|bn|b|k|million|billion)|(?:\$|eur|usd|gbp|chf|€|£)\s?\d)/g;
  function seriesCount(search) {
    const m = search.match(SERIES_RE);
    return m ? m.length : 0;
  }
  const EXHIBIT_TITLE_RE = /\b(chart|graph|schedule|timeline|bridge|breakdown|exhibit|figure|track record|performance|projection|projections|forecast|deployment|distribution|distributions|returns|growth|revenue|ebitda|market size|market opportunity|comparison|benchmark|waterfall|sensitivity|cash flow|cash flows|valuation|multiples?|pipeline)\b/;
  function exhibitHint(page, series) {
    if (!page.textLayer || page.charCount < 30) return false;
    const head = (page.search || '').slice(0, 90);
    const figures = countMatches(page.search || '', /(\d[\d,.]*\s?%|\$\s?\d|\bCAGR\b|\d+(?:\.\d+)?x\b|\bmillion\b|\bbillion\b|\bbn\b|\beur\s?\d|\busd\s?\d|\d+\s?(?:m|mm|bn)\b)/gi).size;
    if (series >= 3) return true;
    if (EXHIBIT_TITLE_RE.test(head) && figures >= 3) return true;
    return page.imageCount > 0 && figures >= 4;
  }
  function contextAround(text, index, length, radius) {
    const r = radius || 90;
    const from = Math.max(0, index - r);
    const to = Math.min(text.length, index + length + r);
    return (from > 0 ? '…' : '') + text.slice(from, to).replace(/\s+/g, ' ').trim() + (to < text.length ? '…' : '');
  }

  function analyze(pages, form) {
    const laneInfo = resolveLane(form);
    const lane = laneInfo.lane;
    const readable = pages.filter((p) => p.textLayer && p.charCount > 0);
    const unreadable = pages.filter((p) => !p.textLayer).map((p) => p.number);

    // ---- Tier A
    const required = RULES.requiredBlocks(form.docType, lane, form.involvement).map((rule) => {
      const out = Object.assign({ status: 'missing', page: null, score: 0, excerpt: '', boxes: [], minSize: null }, rule);
      out.text = (rule.text || '').replace('{Bank Name}', form.bankName ? form.bankName : '{Bank Name}').replace('[Firm Name]', form.bankName || '[Firm Name]').replace('[Insert DBA Name]', form.bankName || '[Insert DBA Name]');
      if (rule.forbidden) {
        const hit = findAny(pages, rule.forbidden, rule.threshold || 86, 'document');
        out.status = hit.found ? 'forbidden_present' : 'clear';
        if (hit.found) Object.assign(out, { page: hit.page.number, score: hit.score, excerpt: hit.excerpt, boxes: hit.boxes });
        return out;
      }
      const hit = findAny(pages, rule.match, rule.threshold || 82, rule.scope === 'first_page' ? 'first_page' : 'document');
      if (hit.found) {
        Object.assign(out, { status: 'present', page: hit.page.number, score: hit.score, excerpt: hit.excerpt, boxes: hit.boxes, minSize: hit.minSize });
        if (hit.minSize && hit.minSize < 7) out.status = 'illegible';
        else if (hit.minSize && hit.minSize < 10) out.small = true;
      } else if (rule.conditional) {
        out.status = 'conditional';
      } else if (hit.best && hit.best.score > 55) {
        out.near = 'closest text on page ' + hit.best.page.number + ' matches ' + Math.round(hit.best.score) + '%';
      }
      return out;
    });

    // ---- coverage facts (verbatim SOP wording anywhere)
    const coverage = RULES.COVERAGE.map((c) => {
      const hit = findAny(pages, c.match, c.threshold, 'document');
      return { key: c.key, label: c.label, found: hit.found, page: hit.found ? hit.page.number : null, score: hit.found ? Math.round(hit.score) : 0, excerpt: hit.found ? hit.excerpt.slice(0, 160) : '' };
    });

    // ---- page stats and role hints
    const numRe = /(\d[\d,.]*\s?%|\$\s?\d|\bCAGR\b|\d+(?:\.\d+)?x\b|\bmillion\b|\bbillion\b|\bbn\b)/gi;
    const stats = pages.map((p, i) => {
      const body = (p.spans || []).filter((s) => s.size > 0 && s.size < 18 && s.text.trim().length > 3);
      const bold = body.filter((s) => s.bold).length;
      const series = seriesCount(p.search || '');
      return {
        page: p.number, chars: p.charCount, images: p.imageCount, numbers: countMatches(p.search || '', numRe).size, series,
        boldShare: body.length >= 12 ? Math.round((bold / body.length) * 100) : null, role: roleHint(p, i, pages.length),
        exhibit: exhibitHint(p, series),
      };
    });

    // ---- Tier B / A7 trigger candidates
    const triggers = [];
    RULES.TRIGGERS.forEach((t) => {
      const firing = [];
      readable.forEach((p) => {
        const hits = countMatches(p.search || '', t.re);
        let total = 0; hits.forEach((v) => { total += v; });
        let fired = false;
        const st = stats.find((s) => s.page === p.number) || {};
        if (t.id === 'A7') fired = hits.size >= (t.density || 8) || (p.imageCount > 0 && hits.size >= 4) || (p.imageCount >= 10 && hits.size >= 2) || !!st.exhibit;
        else fired = hits.size >= 1;
        if (fired && t.needsImages && p.imageCount < t.needsImages) fired = false;
        if (fired) firing.push({ page: p.number, terms: Array.from(hits.keys()).slice(0, 8).concat(st.exhibit ? ['exhibit-like: ' + st.series + ' period/value pairs'] : []), count: total, images: p.imageCount });
      });
      if (t.minPages && firing.length < t.minPages) return;
      firing.forEach((f) => triggers.push(Object.assign({ id: t.id, name: t.name }, f)));
    });

    // ---- Tier C lexicon candidates
    const lexicon = [];
    RULES.LEXICON.forEach((rule) => {
      rule.terms.forEach((term) => {
        const needle = U.normalize(term);
        readable.forEach((p) => {
          const hay = p.search || '';
          let idx = hay.indexOf(needle);
          let seen = 0;
          while (idx !== -1 && seen < 3) {
            const before = hay[idx - 1] || ' ';
            const after = hay[idx + needle.length] || ' ';
            if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) {
              lexicon.push({ id: rule.id, name: rule.name, page: p.number, phrase: term, context: contextAround(hay, idx, needle.length, 80) });
              seen += 1;
            }
            idx = hay.indexOf(needle, idx + needle.length);
          }
        });
      });
    });

    const publicChannel = (form.distribution || []).some((d) => /linkedin|website/i.test(d));
    return { lane, laneReason: laneInfo.reason, docType: form.docType, involvement: form.involvement, publicChannel, required, coverage, stats, triggers, lexicon, unreadable, pageCount: pages.length };
  }

  /* Locate a quote on a page. Exact match on the folded text first; then anchored fuzzy windows; then the
     first and last words of the quote as a bracket (the model sometimes paraphrases the middle). Returns raw
     offsets, a score, and the highlight boxes for pdf pages. */
  function wordsOf(s) { return s.split(' ').filter((w) => w.length > 0); }
  function trimRange(hay, start, end) {
    while (start < end && /[\s.,;:!?"'()\[\]•·]/.test(hay[start])) start += 1;
    while (end > start && /[\s"'(\[•·]/.test(hay[end - 1])) end -= 1;
    return { start, end };
  }
  function locate(page, quote) {
    if (!page || !quote) return null;
    const needle = U.normalize(quote).slice(0, 260);
    if (needle.length < 4) return null;
    const hay = page.search || '';
    if (!hay) return null;
    let start = hay.indexOf(needle);
    let end = start + needle.length;
    let score = 100;
    if (start === -1) {
      const hit = bestInPage(hay, needle, anchorsOf(needle));
      if (hit.start >= 0 && hit.score >= 72) { start = hit.start; end = hit.end; score = hit.score; }
    }
    if (start === -1) {
      const words = wordsOf(needle);
      if (words.length >= 4) {
        const head = words.slice(0, Math.min(3, words.length - 2)).join(' ');
        const tail = words.slice(-Math.min(3, words.length - 2)).join(' ');
        let hs = hay.indexOf(head);
        let guard = 0;
        while (hs !== -1 && guard < 20) {
          guard += 1;
          const te = hay.indexOf(tail, hs + head.length);
          if (te !== -1 && te + tail.length - hs <= needle.length * 1.6 + 20) { start = hs; end = te + tail.length; score = 70; break; }
          hs = hay.indexOf(head, hs + 1);
        }
      }
    }
    if (start === -1) return null;
    const t = trimRange(hay, start, end);
    const raw = rawSpan(page, t.start, t.end);
    return { start: raw.start, end: raw.end, score, boxes: page.kind === 'pdf' ? boxesFor(page, raw.start, raw.end) : [] };
  }

  return { analyze, findBlock, locate, boxesFor, resolveLane };
})();
