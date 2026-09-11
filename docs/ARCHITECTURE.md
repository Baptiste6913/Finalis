# Architecture and rule pipeline

Mandatory AI pre-review of marketing materials (MMAT) before submission to compliance, built for the
Finalis AI hackathon. The landing page is the platform's "Marketing materials" modal; its Submit button is
mandatory and opens the AI Prescreen, where the pre-review runs and the submission completes. One page,
three flavours from the same sources:

- `dist/prescreen.html`: the claude.ai artifact (Claude, shared inbox and assets come from the artifact runtime).
- `dist/prescreen-demo.html`: the same page for a public demo link (inbox stays in the viewer's browser).
- `web/index.html` + `server.py`: the local build. `server.py` is standard-library Python (no pip install):
  it serves the page, proxies Claude calls, keeps the JSON document store, the uploaded PDFs and the
  learning state on disk under `data/`.

Installing and running the local build is covered in the [README](../README.md); this file is the
engineering detail: what the pipeline does at each step, what the learning system stores, and where
everything lives.

## What happens on a submission

1. The banker fills the platform's "Marketing materials" modal (file, document type, distribution
   method, who prepared it, notes). Submit is enabled only when the form is complete, and it does not send
   anything: it opens the Finalis AI Prescreen with the document rendered, asks the two questions the
   modal does not (intended audience, which decides the lane; bank/DBA, which fills the disclaimer texts)
   and the depth, then runs the pre-review. The submission completes from the workspace.
2. Deterministic pass in the browser (pdf.js): text layer, span geometry, font sizes, image counts;
   required blocks matched verbatim (fuzzy, anchored) against the SOP wording: present, missing,
   forbidden, illegible; coverage facts; trigger and lexicon candidates; page role hints.
3. Pass 1 (Claude, balanced tier): the whole material is read and mapped: page roles, what the
   disclaimers and footnotes already cover, sources per page, audience signals.
4. Pass 2 (Claude, most capable tier by default): findings under the rulebook: the SOP texts, the language
   guide, the interim institutional framework, the public standards (FINRA Rule 2210 content standards,
   2210(a) audience definitions, Regulatory Notice 20-21 on private-placement communications, the pending
   SR-FINRA-2026-004 projections amendment) and the calibration rules distilled from the reviewer's
   verdicts on the finding sheet. Page images are attached for visual checks when the view allows them.
   Pages are batched under the 64 KiB input cap; disclaimer and risk pages are condensed in this pass
   because the coverage map already carries what they cover.
5. Guards (deterministic): a quoted passage that is not on the cited page is searched on the other pages,
   else the point is marked "quote not found" and downgraded; a triggered disclosure the coverage map says
   is already covered is set aside unless the finding argues the wording is deficient; rules the desk keeps
   rejecting are demoted (60% rejected over 5 verdicts) or set aside (80% over 8), never Tier A.
6. Pass 3 (Thorough runs, Claude balanced tier): a senior-reviewer check of every candidate against the
   calibration rules and the page context: keep, drop or downgrade, with the reason kept on the card.
7. Saifr-style workspace: page viewer with highlights, navigator and zoom; cards per point with the quoted
   text, risk level, issue label, "Why is this a potential risk?", suggestions (verbatim disclosure text or
   rewrite, plus three alternative wordings on demand), a free question to Claude scoped to the point.
8. Assurance (deterministic, after all passes): a point is asserted to the banker only when it is certain:
   a deterministic Tier A result, or a model point whose quote is located verbatim on the page, rated high
   confidence, kept unchanged by the second pass, and corroborated by an independent signal (for a
   disclosure: the SOP wording is absent from the material; for a language point: the quote contains a term
   of the desk's language guide, or an unsourced figure for substantiation; judgement categories C8 to C19
   are never asserted, except projected returns and distribution rates on retail material). Everything
   else is shown as "For Finalis review": possible, not asserted, no answer required; the reviewer confirms
   or dismisses it, and the reason it was not asserted is printed on the card and in the feedback. A fast
   run (no second pass) asserts only the deterministic points.
9. Gate: every asserted high point needs an answer (fixed / already covered / disagree) and an
   acknowledgement; pending points never block.
10. Submit: the pre-review, the answers and the auto-composed feedback reach the compliance inbox (shared
    store when available) and the feedback is ready as an email, with the points awaiting verification
    listed first; the PDF is stored when the view can write assets.
11. Reviewer: inbox, the same workspace with the banker's answers, a verification (confirm / dismiss) per
    pending point and a verdict per asserted point, approve or request changes, the rulebook, and the
    Learning view.

## Permanent learning

Every verdict (rule, lane, document type, page, quote, correct/incorrect, reason) is a structured example.
From these the desk gets, on every new pre-review:

- precedents: the closest past verdicts (same rules and lane, lexical overlap with the material, recency)
  injected into the findings and verifier prompts;
- learned calibration rules: one rule per rule id distilled by Claude from three or more rejections that
  carry a reason ("Distill rules from rejections" in the Learning view), plus rules written by hand; injected
  into every prompt as L1, L2, ...;
- a track record per rule (accuracy and Wilson confidence) that demotes or sets aside rules the reviewers
  keep rejecting;
- an export/import of the whole state as JSON (so it outlives the page and can be shared between the
  artifact and the local build), and a replay of the calibration deck scored against the reviewer's ground
  truth after any change.

## Calibration against the reviewer's sheet

On the Quartus AI Fund II deck the result is scored against the finding sheet: 9 flags the reviewer
validated, 23 flags the reviewer rejected, 4 items without a verdict. The reference pre-review
(`src/fixture.js`) reproduces the validated flags and none of the rejected ones; the mocked test flow and
the mock backend replay it.

## Files

- `shell.html`: markup and CSS. `build.py`: assembles the three flavours.
- `src/util.js`, `src/extract.js` (pdf.js, DOCX, text, images), `src/rules.js` (SOP texts, required
  blocks, coverage, triggers, lexicon, rulebook, schemas), `src/engine.js` (deterministic analysis and
  quote location), `src/prompts.js` (profile, findings, verifier and transcription prompts, batching),
  `src/review.js` (orchestration, guards, merge), `src/store.js` (db or localStorage), `src/notify.js`
  (feedback to the reviewer), `src/calibration.js` (ground truth), `src/fixture.js` (reference
  pre-review), `src/sample_deck.js` (the calibration deck, base64), `src/ask.js` (on-demand Claude per
  point), `src/learn.js` (learning system), `src/ui.js`, `src/boot.js`, `src/shim.js` (local runtime).
- `server.py`: local server (static, Claude proxy with api/cli/mock backends, document store, assets,
  learning export/import).
- `sim/`: the simulation corpus, the old engine, the runner, the scorer and the report generator.
- `tests/`: Playwright (Python) harness and flows: `test_engine.py` (extraction and deterministic engine),
  `test_flow.py` (modal to AI Prescreen to reviewer to learning, mocked Claude, calibration score,
  verification), `test_more.py` (DOCX, pasted post, image transcription, mobile, dark), `test_local.py`
  (the local build against `server.py` in mock mode), `test_hl.py` (quote location on the calibration
  deck), `test_landing.py` and `test_shots*.py` (screenshots).

    pip install playwright && python -m playwright install chromium
    python3 tests/test_local.py

## Honest limits

- Live runs were executed through the local build with the CLI backend (see `docs/SIMULATIONS.md`); a live
  run inside the claude.ai artifact itself could not be executed from the build environment, so that path
  is exercised with a mocked Claude that replays the reference pre-review. First live run there: load the
  calibration deck, Thorough, then Summary for the score.
- The CLI backend is text only (no page images) and depends on the `claude` print mode being available on
  the machine.
- Retail-lane rules (RN 20-21 projections, distribution rates, testimonials, complexity, formatting) are
  encoded but have no reviewer ground truth yet; the Quartus sheet is institutional only.
- `assets` in the artifact is writer-only: a banker with view-only access submits without the PDF; the
  reviewer then sees the quotes and page numbers, not the rendered pages. The local build stores every PDF.
