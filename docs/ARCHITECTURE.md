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
   else is never shown to the banker: it waits on the reviewer platform under "Awaiting your verification",
   where the reviewer confirms or dismisses it, and the reason it was not asserted is printed on the card
   and in the brief. A fast
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

Every act on the reviewer platform is a structured example carrying the reviewer's identity, stored under
`calibration/` (one document per submission and point, upserted): verdicts (rule, tier, severity, assurance,
lane, document type, page, quote, title, issue, correct/incorrect, comment, the banker's answer, the source:
card, focus mode, comment) and decisions (kind, message to the banker, the confirmed and dismissed points,
the version and the corrections). From these the desk gets, on every new pre-review (`Learn.memoryFor`):

- precedents: the closest past verdicts (same rules and lane, lexical overlap with the material, recency, a
  comment, the reviewer the submission goes to) injected into the findings and verifier prompts;
- learned calibration rules, injected into every prompt: read from the reviewers' comments and decision
  messages by the digest (`Learn.digest`, one model call per digest, run after each decision and on demand),
  scoped to the desk or to one reviewer (whose rules are injected as "Reviewer preference" only when the
  submission goes to that reviewer); distilled from three or more rejections of the same rule that carry a
  reason (`Learn.synthesize`); or written by hand;
- a track record per rule, desk-wide (demoted at 60 % rejected over 5 verdicts, set aside at 80 % over 8)
  and per reviewer (left to the reviewer, never asserted, at 75 % rejected over 4 verdicts on that reviewer's
  submissions);
- precedents applied before the banker sees the points (`Learn.applyPrecedents`): an identical passage the
  desk dismissed is set aside with the reviewer, date and comment as the reason; a close passage (fuzzy
  ratio 80 or more) leaves the point to the reviewer; every point that has a precedent carries it, and the
  reviewer platform shows it under the point;
- reviewer profiles (`Learn.profiles`), a learning log (`learning/meta`), and an export/import of the whole
  state as JSON (verdicts, rules, log) so it outlives the page and can be shared between the artifact and
  the local build; a replay of the calibration deck scored against the reviewer's ground truth after any
  change.

Required blocks (Tier A) and deterministic points are never set aside by precedent: a reviewer preference
can lower severity or change wording, never remove an SOP disclosure. The digest treats the reviewers' text as
data (the prompt says so) and a rule that would learn an SOP block away, or that reads like an instruction to
the model, is discarded before it is saved.

**Memory on a submission (`Learn.deskMemory`).** Computed when a reviewer opens a submission and refreshed
after each verdict: the personal side (habits per rule from the reviewer's own verdicts, open points matching
what they usually confirm or a passage they confirmed before, their verdicts that differ from their own
record) and the shared side (similar submissions from the inbox scored on firm, lane, document type, file
name, the pre-review's subject and the rules raised, with their reviewers and decisions; colleagues' verdicts
on similar points, fuzzy-matched on rule and passage; verdicts that differ from a colleague's). A verdict on
the open submission by another reviewer is attributed to them (`byEmail`), never presented as the reader's
own. The memory feeds the reviewer platform's Memory card, the hints under each point and the desk brief.

## Calibration against the reviewer's sheet

On the Quartus AI Fund II deck the result is scored against the finding sheet: 9 flags the reviewer
validated, 23 flags the reviewer rejected, 4 items without a verdict. The reference pre-review
(`src/fixture.js`) reproduces the validated flags and none of the rejected ones; the mocked test flow and
the mock backend replay it.

## Correcting the document in the app

The banker does not leave the platform to fix the material. An edit is a box placed on a page in page
fractions (the same space as the highlight boxes): a text box (a disclosure, a legend, a source line), a
rewrite in place (white boxes over the located passage, the new text set at the size of the original line,
measured from the text layer) or a removal (white boxes only). `src/fix.js` proposes the fix for each point
from what the pre-review already carries (`text_to_add`, `rewrite`, `action`, the located boxes), fills the
`{Bank Name}` / `[Firm Name]` placeholders from the form, and places added text in the lowest band of the
page that carries no text and no edit yet.

`src/pdfedit.js` builds the corrected file without a library, as an incremental update (ISO 32000-1 §7.5.6):
the uploaded bytes are left intact and the update appends, per edited page, a `q` stream before the original
content and a `Q` + overlay stream after it (white rectangles and Helvetica text through WinAnsi), a copy of
the page's resources with the two font objects, the redefined page object, and a cross-reference section
of the same kind as the file (a classic table, or an XRef stream when the file uses object streams). The
objects are found by scanning the file the way readers rebuild a damaged table, and object streams are
inflated with the browser's `DecompressionStream`; the page objects come from pdf.js (`page.ref`), the
geometry from the inverse of the pdf.js viewport transform, so rotated pages and offset media boxes are
handled. `tests/test_pdfedit.py` checks the result on a classic-xref file and on the object-stream calibration
deck with `qpdf --check`, `pdftotext` and a pdf.js re-read.

**Re-check.** The corrected bytes are re-read; the text under a white box is still in the content stream (an
overlay edit does not delete text), so the re-check masks the spans whose centre falls inside a white box
before running the deterministic engine again. A point is resolved when its required block is now present
(Tier A), when the text the banker added for it is located on its page (disclosures, legends, source lines),
when its quoted passage can no longer be located (rewritten or removed), or when the coverage facts now find
the SOP wording (document-level disclosures). The resolved points keep their history (`resolved.how`,
version); new deterministic points a correction may raise (a legend that became too small) are added. A full
model pre-review of the corrected version is one click away and reuses the same pipeline. The readiness
score (`Fix.readiness`) is 100 minus the open points weighted by severity (high 12, medium 6, low 2, plus 3
for a required block), counting only asserted points for the banker and pending points at half weight for
the reviewer; it sorts the reviewer's queue.

**Exports.** `src/exports.js` writes PowerPoint (every page as a picture of the uploaded file, every
correction as an editable text box at the same position, a closing slide with the points) and Word (a change
sheet: corrected pages with their editable corrections, then the points) as Office Open XML in a STORE zip.
`tests/test_office.py` opens both with python-pptx / python-docx and converts them with LibreOffice.

**Sign-in.** The page opens on a sign-in screen (email, name, firm, role); the role chooses the platform, the
identity prefills the form and travels with the submission; on a team install the reviewer platform asks for
the passcode set in `.env` (`/api/login`). The demo accepts any email.

**Reviewer platform.** The queue sorts by priority (new first, lowest readiness first) with filters and
search; a submission shows the corrections outlined on the pages with a Corrected / Original switch when the
original is at hand; focus mode walks the candidates to verify with the keyboard; the decision bar drafts
the message to the banker from the verdicts (`Ask.decision`) and records approve / request changes /
escalate with a timeline. `Ask.chat` answers document-level questions from the rulebook, the pre-review and
the relevant page texts, on both platforms.

## The loop, closed: rounds

A submission is one round of a thread. When the reviewer requests changes, the decision and the message
land under the banker's **My submissions** (their own submissions, filtered by the signed-in email; on a
team install the server filters them too), with a badge for decisions not yet seen (per browser). **Correct
and resubmit** reopens the document (from the page's cache or the stored file: `/_blob/` lets a banker read
back the files uploaded under their own sign-in, never another banker's), prefills the form, carries the
reviewer's message into the workspace, and after the new pre-review compares the points with those that
stood on the previous round (asserted, or confirmed by the reviewer; dismissed ones do not count): a point
still there is tagged *Still open from round n* (`f.carried`), a point gone is listed as resolved. The new
submission carries `round`, `thread` (the first submission's id) and `previous` (id, status, decision,
and the since-round tally); the previous one is marked `superseded_by`. The reviewer's queue shows the round
badge, the brief the previous round and the tally, the timeline both rounds, and the decision draft names
what is still open.

## The deal file: figures and consistency

`src/deal.js` extracts the figures a document commits to (target return and multiple, fund size, hard cap,
minimum commitment, preferred return, management fee, carried interest, GP commitment, term, plus the track
record) with a verbatim quote per figure. Two extractors feed one shape: a deterministic pass (regular
expressions over the text layer; number-first forms such as "20% IRR" need a target word close before them,
"41% Gross IRR" in a table is a track record) that runs on every pre-review, and the model (quick tier, strict
schema) whose claims are kept only when their quote is located on the cited page; the scan fills whatever the
model did not list. The figures are then compared: inside the document, two pages that state the same figure
with ranges that do not overlap are a contradiction (two values on one page are read as tiers, and the track
record is listed but never compared: prior funds differ by nature); across the deal file, the other
submissions of the same deal (same thread, or same firm and a similar subject: `Learn.similarity ≥ 0.5`) are
compared figure by figure, a claim agreeing with any of their values being enough. The banker sees the
figures and the contradictions in the Summary (and an amber note on the Disclosures tab); the reviewer sees
them in the brief, the Memory card (*From the deal file*, recomputed desk-wide when the submission is opened)
and the brief PDF; the decision draft asks the banker to reconcile them.

## The desk playbook, the memory search, the second opinion

`Learn.playbook` writes up what the desk has learned as a document a new reviewer reads on day one: the
rules the desk sends and the ones it sets aside (with the reasons given), the standing calibration rules and
reviewer preferences, how each reviewer works, where the reviewers differ (one mostly confirms a rule another
mostly dismisses), how the decisions are worded. A computed version is built from the record alone;
Claude writes the prose version from the same facts plus the comments and decision messages (reviewer text
is data, never instructions; an item that would remove an SOP block or reads like an instruction is dropped);
the written version is kept in its own document (`learning/playbook`), shown in the Learning view until it is
rewritten or discarded, and exported as PDF with `PdfOut`; the computed version is rebuilt on every open.
`Learn.search` answers *Ask the desk memory* lexically over every verdict, comment and decision (rule ids
exactly, words over the passage, the reason, the document and the reviewer). `Ask.secondOpinion`, reviewer
only and after an approval, has a deliberately sceptical second reader argue what could still be wrong;
only points whose quote is located on the page are shown, and nothing changes unless the reviewer reopens.

## Metrics and the audit trail

`src/metrics.js` derives the desk's numbers from the submissions themselves (no counters to keep in sync):
first-pass approval rate, readiness at submission per week, points per submission, bankers' answer rate,
time to decision, corrections made in the app, rounds per thread, the rules that recur per firm, decisions
per reviewer. `src/audit.js` lays every event on every submission (submitted, verdict, comment, decision)
out in time order as a hash chain: each record carries the SHA-256 of the previous record's hash plus its
own canonical JSON (keys sorted at every level), so a record altered, removed or inserted after the fact
breaks every hash that follows; `Audit.verify` recomputes the chain from the exported file alone. The
export is what a firm keeps under its books-and-records retention; the chain proves the integrity of what is
in the file, not that the file is complete, which is why the head hash is what to write down at export time.

## Files

- `shell.html`: markup and CSS. `build.py`: assembles the three flavours.
- `src/util.js`, `src/extract.js` (pdf.js, DOCX, text, images), `src/rules.js` (SOP texts, required
  blocks, coverage, triggers, lexicon, rulebook, schemas), `src/engine.js` (deterministic analysis and
  quote location), `src/prompts.js` (profile, findings, verifier and transcription prompts, batching),
  `src/review.js` (orchestration, guards, merge), `src/store.js` (db or localStorage), `src/pdfout.js` (a small PDF writer: Helvetica, WinAnsi, wrapping, page numbers, the logo), `src/pdfedit.js` (the incremental-update editor), `src/fix.js` (fixes, corrected build, re-check, readiness), `src/exports.js` (PowerPoint and Word), `src/notify.js`
  (feedback to the reviewer, the banker summary and desk brief as PDF), `src/calibration.js` (ground truth), `src/fixture.js` (reference
  pre-review), `src/sample_deck.js` (the calibration deck, base64), `src/ask.js` (on-demand Claude per
  point, decision draft, chat, second opinion), `src/learn.js` (learning system, memory, search, playbook),
  `src/deal.js` (the figures and their consistency), `src/audit.js` (the hash-chained audit trail),
  `src/metrics.js` (the desk metrics), `src/ui.js`, `src/boot.js`, `src/shim.js` (local runtime).
- `server.py`: local server (static, Claude proxy with api/cli/mock backends, document store, assets,
  learning export/import).
- `sim/`: the simulation corpus, the old engine, the runner, the scorer and the report generator.
- `tests/`: Playwright (Python) harness and flows: `test_engine.py` (extraction and deterministic engine),
  `test_flow.py` (modal to AI Prescreen to reviewer to learning, mocked Claude, calibration score,
  verification), `test_more.py` (DOCX, pasted post, image transcription, mobile, dark), `test_local.py`
  (the local build against `server.py` in mock mode), `test_hl.py` (quote location on the calibration
  deck), `test_landing.py` and `test_shots*.py` (screenshots), `test_pdfedit.py` (the PDF editor), `test_edit.py`
  (the in-app correction loop end to end), `test_office.py` (Office exports), `test_login.py` (sign-in),
  `test_desk.py` (reviewer queue, focus mode, decision, chat), `test_loop.py` (My submissions, the next
  round, the reviewer's round view, the second opinion, the brief sections), `test_deal.py` (the figure
  scanner and the consistency checks), `test_playbook.py` (memory search, playbook, PDF), `test_dashboard.py`
  (metrics, the audit chain and its tamper detection, the export).

    pip install playwright && python -m playwright install chromium
    python3 tests/test_local.py

## Reliability and security posture

- No framework, no build step beyond `build.py`, no runtime dependency besides pdf.js (vendored) and Python's
  standard library; the whole app is readable in an afternoon.
- `tests/run_all.py` runs 21 checks: a cross-module lint (`lint_modules.py`: every `Module.member` used is
  exported, every UI state key read is set), the deterministic engine and quote location, the PDF editor
  on two file structures (validated by qpdf, pdftotext and a pdf.js re-read), the banker and reviewer flows,
  in-app correction, sign-in, the reviewer platform, learning and memory with two reviewers, the closed loop
  (rounds), the deal file, the playbook, the metrics and the audit chain, Office exports opened by
  python-pptx / python-docx and converted by LibreOffice, and the local server end to end.
- Everything a user or a model writes is inserted as text or escaped (`U.esc`) before it reaches the DOM;
  no `innerHTML` carries unescaped input.
- The local server binds 127.0.0.1 by default and refuses requests whose Host is not local (or the configured
  `PRESCREEN_PUBLIC_HOST`), cross-origin requests, and mutating requests without the page's own `X-Prescreen`
  header (no CSRF, no DNS rebinding); bodies are size-checked before they are read; asset ids are validated,
  uploads are limited to PDF and image types and served with `nosniff` as attachments; a corrupt store is
  reported (500) and copied aside, never overwritten. With `PRESCREEN_PASSCODE` set, sign-in opens a server
  session (HttpOnly, SameSite=Strict cookie, 12 h), the reviewer role needs the passcode (constant-time compare,
  five wrong attempts per minute per client), reviewer routes refuse banker sessions and bankers read only their
  own submissions and the files uploaded under their own sign-in (the asset index records the owner). Secrets stay in `.env` (never committed). The `claude` CLI is always run with tools off, one
  turn, no session persistence, strict MCP config and a minimal environment. `tests/test_server.py` exercises
  all of this over HTTP.
- Learning data is shared state: verdicts and comments are data for the digest, never instructions; learned
  rules are capped in length, deduplicated, scoped, and cannot remove SOP blocks.
- Every write to the store is upserted by a deterministic id (one entry per submission and point), so a
  changed verdict never leaves a duplicate; the localStorage fallback is capped (600 entries).
- The audit chain is computed, never stored: it cannot drift from the records it hashes, and any copy of an
  export is verifiable offline from the file alone. Model output that becomes a claim, a second-opinion point
  or a playbook item passes the same guards as a finding: a verbatim quote located on the page where one is
  required, plausible values, no instruction-like text, no removal of an SOP block.

## Honest limits

- Sign-in is identity, not authentication: the demo accepts any email; a team install adds a passcode on the
  reviewer platform. Real SSO belongs in front of the server (Finalis's existing login).

- An in-app correction is an overlay: the original text stays in the content stream under the white box, so
  a text extractor reads both unless it masks the covered spans (the re-check does; the reviewer is told).
  The corrected PDF is a draft for the reviewer and the banker's designer, not a typeset final.
- The PowerPoint export carries the pages as pictures with the corrections as editable boxes; it does not
  reconstruct the original slides' text as editable objects.
- Fonts in the corrections are Helvetica (a standard PDF font, never embedded); the original deck's typeface
  is not matched.

- Live runs were executed through the local build with the CLI backend (see `docs/SIMULATIONS.md`); a live
  run inside the claude.ai artifact itself could not be executed from the build environment, so that path
  is exercised with a mocked Claude that replays the reference pre-review. First live run there: load the
  calibration deck, Thorough, then Summary for the score.
- The CLI backend is text only (no page images) and depends on the `claude` print mode being available on
  the machine.
- Retail-lane rules (RN 20-21 projections, distribution rates, testimonials, complexity, formatting) are
  encoded but have no reviewer ground truth yet; the Quartus sheet is institutional only.
- The figure scanner reads the text layer: a figure drawn as an image or split across text runs is not
  seen; the model extractor covers most of these but is guarded by the same text layer, so a figure only
  visible in a picture stays out of the deal file. Ranges are compared as intervals; "up to" and "at least"
  are read as the stated number.
- "Unseen decisions" on the banker platform is a per-browser mark (localStorage), not a server-side read
  receipt.
- `assets` in the artifact is writer-only: a banker with view-only access submits without the PDF; the
  reviewer then sees the quotes and page numbers, not the rendered pages. The local build stores every PDF.
