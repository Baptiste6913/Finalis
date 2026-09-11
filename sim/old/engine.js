/* The scan, run in the browser.
 *
 * There is no server in this path. pdf.js reads the document the reviewer is
 * already looking at, the rule library is a JSON file in the extension, and
 * every finding is produced here. That is the whole point: an extension that
 * depends on a laptop somewhere is an extension that works on one laptop.
 *
 * What this engine can do honestly:
 *   Tier A  required blocks, present / missing / forbidden / illegible
 *   Tier B  conditional disclosures, fired by what a page carries
 *   Tier C  the lexical part: superlatives, promissory wording, urgency,
 *           comparisons, emphasis, benefit-without-risk pages
 *
 * What it cannot do, and says so rather than passing silently:
 *   the judgement half of Tier C, which needs a model. When no scanner endpoint
 *   is configured the result carries llm_available:false, and the panel already
 *   renders that as "the language tier ran without the model".
 *
 * Coordinates leave here normalised to the page box (0..1), which is what the
 * annotated viewer expects, so a zoom is a multiplication and never a re-scan.
 */
(function (global) {
  'use strict';

  const ADVISORY = 'Machine-generated pre-submission scan. Not an approval.';

  // --- text normalisation ---------------------------------------------------

  /* One normaliser for the document and for the rule text, or a curly quote in
   * a deck silently fails an exact block that is actually present. */
  function normalize(text) {
    return (text || '')
      .replace(/[\u2018\u2019\u02bc]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2013\u2014\u2212]/g, '-')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /* Lowercase without changing length: every substitution is one character for
   * one character, so the collapse map below stays valid. */
  function lower(text) {
    return (text || '')
      .replace(/[\u2018\u2019\u02bc]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2013\u2014\u2212]/g, '-')
      .replace(/\u00a0/g, ' ')
      .toLowerCase();
  }

  // --- fuzzy matching -------------------------------------------------------

  /* Levenshtein over a bounded window. The rule blocks are one to three
   * sentences, so the cost is small and the exactness matters more than speed:
   * a disclaimer with one word changed is still the disclaimer, a disclaimer
   * with half of it missing is not. */
  function editDistance(a, b, cap) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    if (Math.abs(a.length - b.length) > cap) return cap + 1;
    let previous = new Array(b.length + 1);
    let current = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j += 1) previous[j] = j;
    for (let i = 1; i <= a.length; i += 1) {
      current[0] = i;
      let best = current[0];
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
        if (current[j] < best) best = current[j];
      }
      if (best > cap) return cap + 1;
      const swap = previous; previous = current; current = swap;
    }
    return previous[b.length];
  }

  function ratio(a, b) {
    if (!a.length && !b.length) return 100;
    const cap = Math.ceil(Math.max(a.length, b.length) * 0.5);
    const distance = editDistance(a, b, cap);
    return Math.max(0, 100 - (distance * 100) / Math.max(a.length, b.length));
  }

  /* Best alignment of `needle` anywhere inside `haystack`, by sliding a window
   * of the needle's length. Returns the score and where it landed, so the
   * finding can point at the text instead of only asserting it exists. */
  function partialRatio(haystack, needle) {
    if (!needle || !haystack) return { score: 0, start: -1, end: -1 };
    if (haystack.length < needle.length * 0.5) return { score: 0, start: -1, end: -1 };
    const size = needle.length;
    const step = Math.max(1, Math.floor(size / 12));
    let best = { score: 0, start: -1, end: -1 };
    const limit = Math.max(0, haystack.length - size);
    const score_ = (start) => ratio(haystack.slice(start, start + size), needle);
    for (let start = 0; start <= limit; start += step) {
      const score = score_(start);
      if (score > best.score) best = { score, start, end: start + size };
      if (score > 99) break;
    }
    if (best.start >= 0 && step > 1) {
      const from = Math.max(0, best.start - step);
      const to = Math.min(limit, best.start + step);
      for (let start = from; start <= to; start += 1) {
        const score = score_(start);
        if (score > best.score) best = { score, start, end: start + size };
      }
    }
    return best;
  }

  /* A page's text collapsed to single spaces, with a map back to the original
   * offsets. Matching happens on the collapsed text, because that is the shape
   * the rule blocks are written in; rectangles come from the map, because that
   * is the shape the spans are in. Without the map, a block broken over seven
   * lines either fails to match or highlights the wrong line. */
  function collapse(text) {
    let out = '';
    const map = [];
    let space = false;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r' || ch === '\u00a0') {
        if (out.length && !space) { out += ' '; map.push(i); space = true; }
        continue;
      }
      out += ch; map.push(i); space = false;
    }
    while (out.endsWith(' ')) { out = out.slice(0, -1); map.pop(); }
    return { text: out, map };
  }

  // --- extraction -----------------------------------------------------------

  /* One page: its text, the spans that produced it with their offsets in that
   * text, font sizes in points, bold flags, and the page box. Offsets are what
   * let a match on the normalised text come back as rectangles on the page. */
  async function extractPage(page, number) {
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const spans = [];
    const parts = [];
    let cursor = 0;

    content.items.forEach((item) => {
      const raw = item.str || '';
      if (!raw) {
        if (item.hasEOL) { parts.push(' '); cursor += 1; }
        return;
      }
      const piece = raw.replace(/\s+/g, ' ');
      const transform = item.transform || [1, 0, 0, 1, 0, 0];
      // font size in points: the vertical scale of the text matrix
      const size = Math.abs(transform[3]) || Math.hypot(transform[1], transform[3]) || 0;
      const width = item.width || 0;
      const height = item.height || size;
      const x = transform[4];
      const y = transform[5];
      const font = (item.fontName || '') + ' ' + (content.styles && content.styles[item.fontName]
        ? content.styles[item.fontName].fontFamily || '' : '');
      spans.push({
        text: piece,
        start: cursor,
        end: cursor + piece.length,
        size: Math.round(size * 10) / 10,
        bold: /bold|black|heavy|semib|demib/i.test(font),
        // normalised to the page box, origin top-left, which is what the viewer wants
        box: {
          page: number,
          x: x / viewport.width,
          y: (viewport.height - y - height) / viewport.height,
          w: width / viewport.width,
          h: (height || size) / viewport.height,
        },
      });
      parts.push(piece);
      cursor += piece.length;
      const gap = item.hasEOL ? ' ' : ' ';
      parts.push(gap);
      cursor += gap.length;
    });

    const text = parts.join('');
    const flat = collapse(lower(text));
    const operators = await page.getOperatorList().catch(() => null);
    let imageCount = 0;
    if (operators && operators.fnArray && global.pdfjsLib) {
      const OPS = global.pdfjsLib.OPS || {};
      operators.fnArray.forEach((fn) => {
        if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject
            || fn === OPS.paintJpegXObject || fn === OPS.paintImageMaskXObject) imageCount += 1;
      });
    }

    return {
      number,
      text,
      search: flat.text,
      searchMap: flat.map,
      normalized: flat.text,
      spans,
      imageCount,
      charCount: text.replace(/\s/g, '').length,
      textLayer: text.replace(/\s/g, '').length >= 50 || imageCount === 0,
      width: viewport.width,
      height: viewport.height,
    };
  }

  async function extract(bytes) {
    const doc = await global.pdfjsLib.getDocument({ data: bytes, isEvalSupported: false }).promise;
    const pages = [];
    for (let n = 1; n <= doc.numPages; n += 1) {
      /* eslint-disable no-await-in-loop */
      const page = await doc.getPage(n);
      pages.push(await extractPage(page, n));
      page.cleanup();
      /* eslint-enable no-await-in-loop */
    }
    doc.destroy();
    return pages;
  }

  // --- offsets back to rectangles -------------------------------------------

  /* The normalised text and the raw text have different offsets. Rather than
   * page.search is the collapsed lowercase text and page.searchMap maps its
   * offsets back to the raw text, which is what the spans are indexed on. */
  /* Collapsed offsets back to raw offsets, which is what the spans use. */
  function rawSpan(page, start, end) {
    const map = page.searchMap || [];
    if (!map.length) return { start, end };
    const from = map[Math.max(0, Math.min(start, map.length - 1))];
    const to = map[Math.max(0, Math.min(end - 1, map.length - 1))] + 1;
    return { start: from, end: Math.max(from + 1, to) };
  }

  function spansBetween(page, start, end) {
    return page.spans.filter((span) => span.end > start && span.start < end);
  }

  function boxesFor(page, start, end) {
    const hits = spansBetween(page, start, end);
    if (!hits.length) return [];
    // merge spans that sit on the same line
    const lines = [];
    hits.forEach((span) => {
      const line = lines.find((l) => Math.abs(l.y - span.box.y) < span.box.h * 0.6);
      if (line) {
        line.x = Math.min(line.x, span.box.x);
        line.right = Math.max(line.right, span.box.x + span.box.w);
        line.h = Math.max(line.h, span.box.h);
      } else {
        lines.push({ y: span.box.y, x: span.box.x, right: span.box.x + span.box.w, h: span.box.h });
      }
    });
    return lines.slice(0, 6).map((line) => ({
      page: page.number,
      x: Math.max(0, line.x - 0.004),
      y: Math.max(0, line.y - 0.004),
      w: Math.min(1, line.right - line.x + 0.008),
      h: Math.min(1, line.h + 0.008),
    }));
  }

  function sizesFor(page, start, end) {
    const hits = spansBetween(page, start, end).filter((s) => s.size > 0);
    if (!hits.length) return null;
    return Math.min.apply(null, hits.map((s) => s.size));
  }

  // --- finding a required block ---------------------------------------------

  function findBlock(pages, needleRaw, threshold, scope) {
    const needle = normalize(needleRaw);
    const search = scope === 'first_page' ? pages.slice(0, 1) : pages;
    let best = null;
    search.forEach((page) => {
      const hay = page.search || lower(page.text);
      const hit = partialRatio(hay, needle);
      if (!best || hit.score > best.score) {
        best = { score: hit.score, page, start: hit.start, end: hit.end };
      }
    });
    if (!best || best.score < threshold) return { found: false, best };
    const span = rawSpan(best.page, best.start, best.end);
    return {
      found: true,
      score: best.score,
      page: best.page,
      start: span.start,
      end: span.end,
      excerpt: best.page.search.slice(Math.max(0, best.start), best.end).trim().slice(0, 400),
      boxes: boxesFor(best.page, span.start, span.end),
      minSize: sizesFor(best.page, span.start, span.end),
    };
  }

  function findAny(pages, rule, scope) {
    const options = [rule.required_text].concat(rule.alternates || []).filter(Boolean);
    let best = { found: false, best: null };
    for (let i = 0; i < options.length; i += 1) {
      const hit = findBlock(pages, options[i], rule.threshold || 85, scope);
      if (hit.found) return hit;
      if (!best.best || (hit.best && hit.best.score > best.best.score)) best = hit;
    }
    return best;
  }

  // --- lanes ----------------------------------------------------------------

  function resolveLane(answers, override) {
    if (override) return { lane: override, reason: 'set by the reviewer' };
    const natural = answers.natural_persons === true;
    const more = answers.more_than_25 === true;
    const institutional = answers.institutional_only === true;
    if (natural || more) {
      let why = natural ? 'natural persons in the audience'
                        : 'more than 25 retail investors in 30 days';
      if (institutional) why += '; the questionnaire also claims institutional only, which contradicts it';
      return { lane: 'retail', reason: why };
    }
    if (institutional) return { lane: 'institutional', reason: 'institutional investors only' };
    return { lane: 'retail', reason: 'no audience answer selected, defaulting to retail' };
  }

  // --- triggers -------------------------------------------------------------

  function countMatches(text, regex) {
    const re = new RegExp(regex, 'gi');
    const seen = new Set();
    let m = re.exec(text);
    let n = 0;
    while (m) {
      const key = m[0].toLowerCase();
      if (!seen.has(key)) { seen.add(key); n += 1; }
      m = re.exec(text);
      if (n > 50) break;
    }
    return n;
  }

  function hasQuote(text) {
    return /"[^"]{60,}"/.test(text) || /\u201c[^\u201d]{60,}\u201d/.test(text);
  }

  function statisticsOn(page, config) {
    const spec = config.statistics_trigger || {};
    const density = countMatches(page.search, spec.regex || '\\d');
    return page.imageCount > 0 || density >= (spec.number_density || 8);
  }

  const RISK_WORDS = /\b(risk|risks|no assurance|may lose|illiquid|speculative|no guarantee|volatil|adverse|downside|loss of capital|subject to)\b/i;
  const BENEFIT_WORDS = /\b(growth|return|upside|opportunity|strong|leading|expand|increase|profit|margin|advantage|attractive|proven|scal)/i;

  function balanceOf(page) {
    const sentences = page.search.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 25);
    let benefit = 0;
    let risk = 0;
    sentences.forEach((s) => {
      if (RISK_WORDS.test(s)) risk += 1;
      else if (BENEFIT_WORDS.test(s)) benefit += 1;
    });
    return { benefit, risk, sentences: sentences.length };
  }

  // --- the scan -------------------------------------------------------------

  function docTypeAllows(rule, documentType) {
    if (!rule.applies_to) return true;
    if (!documentType || documentType === 'unknown') return true;
    return rule.applies_to.indexOf(documentType) !== -1;
  }

  function newFinding(rule, extra) {
    return Object.assign({
      rule_id: rule.id,
      tier: rule.tier,
      severity: rule.severity || 'medium',
      name: rule.name,
      citation: rule.citation,
      decided_by: rule.tier === 'C' ? 'lexicon' : 'text match',
      disposition: rule.action === 'escalate' ? 'escalate' : 'ask_banker',
      status: 'missing',
      page: null,
      boxes: [],
      fix: rule.fix || '',
    }, extra || {});
  }

  async function scan(input) {
    const config = input.rules;
    const pages = input.pages || await extract(input.bytes);
    const answers = input.questionnaire || {};
    const resolved = resolveLane(answers, input.laneOverride);
    const lane = resolved.lane;
    const documentType = input.documentType || 'unknown';
    const findings = [];
    const coverage = { topics: {} };
    const notes = [];
    const unreadable = pages.filter((p) => !p.textLayer).map((p) => p.number);
    const readable = pages.filter((p) => p.textLayer);

    if (unreadable.length) {
      notes.push(`${unreadable.length} of ${pages.length} pages carry no text layer `
        + `(page${unreadable.length > 1 ? 's' : ''} ${unreadable.join(', ')}). They were not read. `
        + 'Nothing below says anything about them.');
    }
    (config.not_implemented_locally || []).forEach((note) => notes.push(note));

    const rules = config.rules || [];
    const byId = {};
    rules.forEach((r) => { byId[r.id] = r; });

    // ---- Tier A and B, block presence
    rules.forEach((rule) => {
      if (rule.tier === 'C') return;
      if (rule.lane && rule.lane !== 'any' && rule.lane !== lane) return;
      if (!docTypeAllows(rule, documentType)) return;

      if (rule.scope === 'audience' || rule.scope === 'legibility') return;

      // forbidden text (the institutional legend on a retail deck)
      if (rule.forbidden_text) {
        const options = [rule.forbidden_text].concat(rule.alternates || []);
        for (let i = 0; i < options.length; i += 1) {
          const hit = findBlock(pages, options[i], rule.threshold || 88, 'document');
          if (hit.found) {
            findings.push(newFinding(rule, {
              status: 'forbidden_present', page: hit.page.number, excerpt: hit.excerpt,
              boxes: hit.boxes, measured: `match ${Math.round(hit.score)}%`,
            }));
            break;
          }
        }
        return;
      }

      // page-scoped conditional rules
      if (rule.scope === 'page') {
        readable.forEach((page) => {
          let fired = false;
          if (rule.id === 'A7') {
            fired = statisticsOn(page, config);
          } else if (rule.trigger_regex) {
            const n = countMatches(page.search, rule.trigger_regex);
            fired = n >= (rule.trigger_min || 1);
            if (fired && rule.needs_images && page.imageCount < rule.needs_images) fired = false;
            if (!fired && rule.trigger_quote && hasQuote(page.search)) fired = true;
          }
          if (!fired) return;
          const local = findBlock([page], rule.required_text, rule.threshold || 85, 'document');
          let covered = local.found;
          let where = local;
          if (!covered && rule.cross_reference) {
            const ref = findBlock([page], rule.cross_reference, 82, 'document');
            const tail = findBlock(pages.slice(-3), rule.required_text, rule.threshold || 85, 'document');
            covered = ref.found && tail.found;
            where = tail;
          }
          if (!covered && rule.alternates) {
            for (let i = 0; i < rule.alternates.length && !covered; i += 1) {
              const alt = findBlock([page], rule.alternates[i], rule.threshold || 85, 'document');
              covered = alt.found; where = alt;
            }
          }
          if (covered) {
            coverage.topics[rule.id + ':p' + page.number] = {
              state: 'covered', page: where.page ? where.page.number : page.number,
            };
            if (rule.must_be_bold && where.page) {
              const bold = spansBetween(where.page, where.start, where.end).some((s) => s.bold);
              if (!bold) {
                findings.push(newFinding(rule, {
                  status: 'present', severity: 'low', page: page.number,
                  name: rule.name + ' (not bold)', excerpt: where.excerpt, boxes: where.boxes,
                  measured: 'present but not bold and standalone, which the SOP requires',
                }));
              }
            }
            return;
          }
          findings.push(newFinding(rule, {
            status: 'missing', page: page.number,
            excerpt: firstTrigger(page, rule),
            boxes: triggerBoxes(page, rule),
            action: rule.action || '',
          }));
        });
        return;
      }

      // document-scoped rules
      if (rule.trigger_regex) {
        const firing = readable.filter((p) => countMatches(p.text, rule.trigger_regex) >= (rule.trigger_min || 1));
        if (firing.length < (rule.trigger_pages || 1)) return;
      }
      const hit = findAny(pages, rule, rule.scope === 'first_page' ? 'first_page' : 'document');
      if (hit.found) {
        coverage.topics[rule.id] = { state: 'covered', page: hit.page.number };
        if (rule.id === 'A1a' || rule.id === 'A1b' || rule.id === 'A3' || rule.id === 'A5') {
          checkLegibility(byId.A6, rule, hit, findings);
        }
        return;
      }
      findings.push(newFinding(rule, {
        status: 'missing',
        measured: hit.best && hit.best.score > 55
          ? `closest text on page ${hit.best.page.number} matches ${Math.round(hit.best.score)}%, below the bar`
          : '',
        recommended_page: rule.recommended_page === 'last' ? pages.length : (rule.recommended_page || null),
      }));
    });

    // ---- A6 legibility is folded in above; nothing to do here

    // ---- B10 audience cross-check
    const legend = findBlock(pages, 'For institutional investors only', 86, 'document');
    const retailSignals = /\b(accredited investors?|individual investors?|minimum investment of \$|your investment|you can invest)\b/i;
    const retailSignal = readable.find((p) => retailSignals.test(p.search));
    const b10 = byId.B10;
    if (b10) {
      if (lane === 'retail' && legend.found) {
        findings.push(newFinding(b10, {
          status: 'conflict', page: legend.page.number, boxes: legend.boxes,
          excerpt: legend.excerpt,
          measured: 'the questionnaire says the audience includes retail, and the deck says institutional only',
        }));
      } else if (lane === 'institutional' && retailSignal) {
        findings.push(newFinding(b10, {
          status: 'conflict', page: retailSignal.number,
          excerpt: (retailSignals.exec(retailSignal.search) || [''])[0],
          measured: 'the questionnaire says institutional only, and the deck addresses individuals',
        }));
      }
    }

    // ---- Tier C, the lexical half
    rules.filter((r) => r.tier === 'C').forEach((rule) => {
      if (rule.lane && rule.lane !== 'any' && rule.lane !== lane) return;
      if (rule.scope === 'phrase') {
        (rule.terms || []).forEach((term) => {
          const needle = normalize(term.phrase);
          if (!needle) return;
          readable.forEach((page) => {
            const hay = page.search || lower(page.text);
            let from = 0;
            let index = hay.indexOf(needle, from);
            let seen = 0;
            while (index !== -1 && seen < 4) {
              const before = hay[index - 1] || ' ';
              const after = hay[index + needle.length] || ' ';
              if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) {
                const raw = rawSpan(page, index, index + needle.length);
                findings.push(newFinding(rule, {
                  status: 'needs_review',
                  page: page.number,
                  term: term.phrase,
                  excerpt: contextAround(page.search, index, needle.length),
                  suggested: term.suggested || '',
                  boxes: boxesFor(page, raw.start, raw.end),
                }));
                seen += 1;
              }
              from = index + needle.length;
              index = hay.indexOf(needle, from);
            }
          });
        });
        return;
      }
      if (rule.scope === 'emphasis') {
        readable.forEach((page) => {
          const body = page.spans.filter((s) => s.size > 0 && s.size < 18 && s.text.trim().length > 3);
          if (body.length < 12) return;
          const bold = body.filter((s) => s.bold).length;
          const share = bold / body.length;
          if (share < (rule.threshold_ratio || 0.3)) return;
          findings.push(newFinding(rule, {
            status: 'needs_review', page: page.number,
            measured: `${Math.round(share * 100)}% of the body text on this page is bold`,
            boxes: body.filter((s) => s.bold).slice(0, 4).map((s) => s.box),
          }));
        });
        return;
      }
      if (rule.scope === 'balance') {
        readable.forEach((page) => {
          const b = balanceOf(page);
          if (b.benefit < (rule.benefit_min || 5) || b.risk > 0) return;
          findings.push(newFinding(rule, {
            status: 'needs_review', page: page.number,
            measured: `${b.benefit} benefit statements, no risk statement on this page`,
          }));
        });
      }
    });

    const counts = { A: 0, B: 0, C: 0, total: findings.length };
    findings.forEach((f) => { counts[f.tier] = (counts[f.tier] || 0) + 1; });

    return {
      scan_id: 'local-' + Date.now().toString(36),
      engine: 'local',
      lane,
      lane_reason: resolved.reason,
      document_type: documentType,
      page_count: pages.length,
      source: 'pdf',
      llm_available: false,
      counts,
      findings,
      coverage,
      notes,
      unreadable_pages: unreadable,
      disclaimer: ADVISORY,
      rules_version: config.version,
    };
  }

  function contextAround(text, index, length) {
    const from = Math.max(0, index - 90);
    const to = Math.min(text.length, index + length + 90);
    return (from > 0 ? '…' : '') + text.slice(from, to).replace(/\s+/g, ' ').trim()
      + (to < text.length ? '…' : '');
  }

  function firstTrigger(page, rule) {
    if (!rule.trigger_regex) return '';
    const m = new RegExp(rule.trigger_regex, 'i').exec(page.search);
    if (!m) return '';
    return contextAround(page.search, m.index, m[0].length);
  }

  function triggerBoxes(page, rule) {
    if (!rule.trigger_regex) return [];
    const m = new RegExp(rule.trigger_regex, 'i').exec(page.search);
    if (!m) return [];
    const raw = rawSpan(page, m.index, m.index + m[0].length);
    return boxesFor(page, raw.start, raw.end);
  }

  /* A disclaimer set in type too small to read is a finding, not a pass. It is
   * raised against the rule whose block was found, so the reviewer sees which
   * one is illegible rather than a bare A6. */
  function checkLegibility(a6, rule, hit, findings) {
    if (!a6 || !hit.minSize) return;
    if (hit.minSize >= (a6.recommended_pt || 10)) return;
    const belowFloor = hit.minSize < (a6.min_pt || 7);
    findings.push(newFinding(a6, {
      status: 'illegible',
      severity: belowFloor ? 'high' : 'low',
      name: `${rule.name} is set at ${hit.minSize} pt`,
      page: hit.page.number,
      excerpt: hit.excerpt,
      boxes: hit.boxes,
      measured: belowFloor
        ? `${hit.minSize} pt, below the ${a6.min_pt} pt floor: the reader cannot read it`
        : `${hit.minSize} pt, below the ${a6.recommended_pt} pt FINRA recommends`,
    }));
  }

  global.FinalisEngine = {
    scan, extract, normalize, partialRatio, ratio, resolveLane, findBlock, boxesFor, ADVISORY,
  };
}(typeof window !== 'undefined' ? window : globalThis));
