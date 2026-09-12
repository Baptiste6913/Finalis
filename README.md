# Finalis AI Prescreen

A mandatory AI pre-review that sits under the **Marketing materials** upload form: the banker fills the
usual form, presses **Submit**, and instead of the document going straight to Compliance it opens in the
Finalis AI Prescreen. The pre-review reads the whole document, checks the SOP disclosure blocks verbatim,
maps what the disclaimers already cover, reviews the wording under FINRA Rule 2210, and sends Compliance a
brief with the attention points, the banker's answers, and a short list of items for the reviewer to verify.

![The Marketing materials modal, unchanged, with a mandatory Submit](docs/screens/shot_landing.jpg)

The banker then fixes the material without leaving the platform: each attention point carries a *Fix in the
document* action that places the SOP text, rewrites the flagged passage in place or removes it, on boxes the
banker can drag, resize and edit; the corrected PDF is built in the browser on top of the original file,
re-checked on the spot, and can be downloaded as PDF, PowerPoint or Word. A readiness score follows the
work. On the reviewer platform the submissions queue by priority, the corrections are outlined on the pages
next to the original, the candidates to verify are walked with the keyboard, and the decision message is
drafted from the verdicts. Both platforms open on a sign-in screen and share one question box that answers
from the document, the rulebook and the pre-review.

The loop is closed: the reviewer's decision comes back to the banker under **My submissions**, a request for
changes reopens the document for the next round with the reviewer's message, and the reviewer sees round 2
against round 1 (what was resolved, what is still open). The pre-review also reads the **figures** the
document commits to (targets, fund size, fees, carry, minimums) and says when they do not agree, with each
other or with the earlier documents of the same deal. The desk gets a **playbook** written from its own
verdicts and comments, a search over its memory, a **second opinion** after an approval, **metrics** computed
from the submissions, and an **audit trail** exported as a SHA-256 hash chain.

Everything runs locally: one Python file serves the page and calls Claude **through your own Claude Code
login**. No API key, no install beyond Python and Claude Code. What leaves your machine is what the model
needs, sent under your own account: the document text, the form, and on the reviewer side the reviewers'
comments (section 12 lists it all).

---

## 1. What you need

| | |
|---|---|
| **Python 3.8+** | `python3 --version` — macOS and Linux already have it; Windows: https://www.python.org/downloads/ (tick "Add python.exe to PATH") |
| **Claude Code** | `npm install -g @anthropic-ai/claude-code`, then run `claude` once and sign in with your Claude account |

Nothing else. No pip install, no node_modules, no Docker. (`build.py`, only needed after editing the source,
uses node when present to refresh the mock backend's fixture and works without it.)

## 2. Install and run

```bash
git clone https://github.com/Baptiste6913/Finalis.git
cd Finalis
./run.sh            # Windows: run.cmd
```

Then open **http://127.0.0.1:8787/**

On start the server tells you exactly how it will reach Claude:

```
claude CLI: 2.x (/usr/local/bin/claude)

  Finalis AI Prescreen
  backend : cli
            Claude through your own Claude Code login (the `claude` CLI). No API key needed;
            the calls are billed to your Claude account. Text only: no page images.
  models  : complex=claude-opus-5, default=claude-sonnet-5, quick=claude-haiku-4-5-20251001
  data    : /path/to/Finalis/data
  access  : this machine only (127.0.0.1); no passcode (demo sign-in)

  Open http://127.0.0.1:8787/  (Ctrl+C to stop)
```

`python3 server.py --help` prints the options; `.env` next to `server.py` is read at start (see `.env.example`).

## 3. How the AI connects to your Claude account

The server picks a backend by itself, in this order:

1. **`ANTHROPIC_API_KEY` is set** (in your shell or in a `.env` file next to `server.py`) → the Anthropic
   API. This is the only mode that also sends page images to the model, which helps on charts and logos.
2. **The `claude` CLI is on your PATH** → every model call runs through Claude Code with *your* login.
   This is the default and the reason there is nothing to configure: if `claude` works in your terminal,
   the pre-review works. Usage is billed to your Claude plan.
3. **Neither** → mock mode: the page still opens and replays a reference pre-review of the sample deck, so
   you can click through the product without any model.

To force one of them: `PRESCREEN_BACKEND=cli|api|mock ./run.sh`. See `.env.example` for the rest
(models, port). If your Claude account cannot use `claude-opus-5`, set `MODEL_COMPLEX` and `MODEL_DEFAULT`
in `.env` to models you do have — the server also retries automatically with your account's default model.

## 4. Try it in three minutes

1. Open http://127.0.0.1:8787/ . **Sign in**: any email, your name, the firm, role *Banker*. (The reviewer
   platform can ask for a passcode on a team install: set `PRESCREEN_PASSCODE` in `.env`. The demo needs none.)
2. You get the Marketing materials modal, identical to the platform's. Click **Use the calibration deck
   (Quartus AI Fund II, 28 pages)** under the upload box (or drop your own PDF, DOCX, PNG or JPEG).
3. Distribution method → *Email*. Who was involved → *Banker*. **Submit**.
4. You land in the AI Prescreen, your name and firm prefilled from the sign-in. Intended audience →
   *Institutional investors only*, depth **Thorough**, **Start the pre-review**. It takes 2 to 5 minutes
   on a 28-page deck and streams its progress.
5. Read the three tabs on the right: **Compliance** (wording), **Disclosures** (missing blocks and
   triggered disclosures), **Summary** (your document in two lines, the readiness score, the points
   Compliance will ask you to answer, and what happens when you submit). Click any point to jump to the exact
   highlighted passage; press `j` / `k` to walk the points. The chat bubble in the tab bar opens **Ask about
   this document**: questions answered from the document text, the rulebook and the pre-review, with pages.
6. **Fix in the document.** Every point carries a *Fix in the document* button: the SOP text is placed on the
   right page as a box you can drag, resize and edit, a flagged passage is rewritten in place (the suggested
   rewrite, or one of the three alternatives Claude proposes, with *Use*), a source line goes under an exhibit,
   a passage can be removed. **Apply all suggested fixes** (the bar above the points) does the unambiguous ones
   at once. Then **Re-check the
   corrected version**: the corrected PDF is built in the browser (an incremental update on the original
   file, nothing rewritten), re-read, and the points it resolves move to *N points resolved in this version*; the
   readiness score follows (the calibration deck goes from 34 to 100 once the fixes are re-checked). **Download corrected PDF**,
   **PowerPoint** (one slide per page, corrections as editable text boxes) and **Word** (an editable change
   sheet) are on the same bar. The corrected version, its change log and the resolved points travel with
   the submission (the form will not submit while corrections are placed but not re-checked).
7. Answer what is left, tick the acknowledgement, **Complete submission**. That is the whole banker side.
   **Export this summary as PDF** (Summary tab; **Download my summary (PDF)** on the confirmation page) gives the
   banker a record of what was asked, corrected and answered.
8. Sign out (avatar, top right) and sign in as a *Finalis reviewer*, or use the **Reviewer** switch: the queue
   sorts by priority (new first, lowest readiness first), with filters, search and the numbers of the day.
   Open the submission: the corrections are outlined on the pages with a **Corrected / Original** switch, the
   candidates the banker never saw wait under *Awaiting your verification*, and **Verify one by one** walks
   them with the keyboard (`C` confirm, `D` dismiss, `J`/`K`). The decision bar drafts the message to the
   banker from your verdicts (**Draft with Claude**), then **Approve**, **Request changes** or **Escalate**;
   the Brief tab shows the timeline and **Export the full brief as PDF**.
9. **Request changes** with a message, then switch back to the banker: the **My submissions** button in the
   header carries a badge, the list shows the status and the reviewer's message, **Details** the points that
   stood. **Correct and resubmit** reopens the document with the message on top: run the pre-review again,
   correct the document in the app (*Fix in the document*, then *Re-check*), and the points that stood on
   round 1 are tagged *Still open from round 1* or listed as resolved, the Summary shows *Since round 1*, and
   the submission goes out as **round 2** (when the file was not stored, the form asks for the corrected
   version and says it goes out as the next round). On the reviewer
   platform the queue shows the round badge, the brief the previous round and the tally, the timeline both
   rounds; after an **Approve**, **Second opinion** has a sceptical second reader argue what could still be
   wrong (advisory; nothing changes unless you reopen).
10. The Summary tab lists **the figures you commit to** (target return, multiple, fund size, hard cap,
   minimum, preferred return, fees, carry, term) with the page of each; when two of them do not agree, or one
   differs from an earlier document of the same deal, the banker is told before Compliance is. On the reviewer
   platform the Memory card has *From the deal file* and the brief PDF a *Deal file* section.
11. **Metrics and audit** (reviewer inbox): first-pass approval rate, readiness by week, corrections made in
   the app, rounds, time to decision, the rules that keep coming back per firm, decisions per reviewer, all
   computed from the submissions; **Export the audit trail** writes every event as a hash chain and **Verify an
   exported file** recomputes it. **Learning** has *Ask the desk memory* (a search over every verdict, comment
   and decision) and the **Desk playbook** (computed from the record, or written by Claude; exports as PDF).

The banker platform and the reviewer platform are two separate applications. This demo page hosts both behind
one switch so you can play both roles; the accent colour, the header and the tabs change with the side you
are on, and nothing reaches the reviewer before the banker submits.

![Sign-in: the role decides the platform](docs/screens/shot_login.jpg)

![Fix in the document: the SOP text placed on the page, the passage rewritten in place, every box movable](docs/screens/shot_edit.jpg)

![After Re-check: version 2, the resolved points, readiness 100](docs/screens/shot_edit_v2.jpg)

![The reviewer queue: priority, readiness, points to verify](docs/screens/shot_desk_queue.jpg)

![Verify one by one, with the keyboard](docs/screens/shot_desk_focus.jpg)

![The setup step that opens after Submit](docs/screens/shot_setup.jpg)

![The banker's Summary: the document in two lines, what Compliance will ask, nothing else](docs/screens/shot_summary_banker.jpg)

![The same submission on the reviewer platform: the full brief](docs/screens/shot_desk_brief.jpg)

![My submissions: the decision and the reviewer's message come back to the banker; Correct and resubmit opens the next round](docs/screens/shot_mine.jpg)

![Round 2 in the workspace: the reviewer's message on top, the points still open from round 1 tagged](docs/screens/shot_round2.jpg)

![The figures the document commits to, and one that does not agree](docs/screens/shot_deal.jpg)

![After an approval: the second opinion, the previous round in the brief and the timeline](docs/screens/shot_second_opinion.jpg)

![Metrics and audit: the desk's numbers computed from the submissions, the audit trail as a hash chain](docs/screens/shot_metrics.jpg)

## 5. What is asserted, and what waits for a human

The point of this build: the banker is never told something the machine is not sure of.

A point is **asserted** only when it is deterministic (an SOP block matched verbatim on the text layer) or
when the model's point survives every check: the quoted passage is located word-for-word on the page, the
findings pass rated it high confidence, the second pass kept it unchanged, and an independent signal
corroborates it (the SOP wording is genuinely absent from the document, or the quote contains a term from
the desk's language guide).

Everything else is not shown to the banker at all. It reaches the reviewer platform as candidates **to
verify**, with the reason each one was not asserted; the reviewer gets **Confirm** / **Dismiss** on each,
the feedback email lists them first, and every verdict trains the next pre-reviews. The banker only learns
that a number of further candidates went to the reviewer.

![The reviewer confirming a pending point](docs/screens/shot_verify.jpg)

## 6. It learns from the desk, and from each reviewer

Everything a reviewer does on the reviewer platform teaches the next pre-reviews, and every entry carries
the reviewer's name:

- every verdict is recorded, confirmed or dismissed, from a card or from the keyboard in focus mode, with or
  without a comment; the comment box under each point is saved as you type; a comment on a point without a
  verdict counts too; a changed verdict updates the same entry rather than adding a second one;
- every decision (Approve, Request changes, Escalate) is recorded with the message sent to the banker;
- after each decision Claude reads what is new (the digest): the comments, the decision messages, the
  confirmations and dismissals, and writes durable calibration rules, **desk-wide** when the lesson is
  general and **for one reviewer** when it is that reviewer's own practice or wording preference. The Learning
  view has *Digest the new comments now* and *Re-read everything*;
- before each pre-review the closest precedents are put in front of the model, weighted toward the reviewer
  the submission goes to (the desk's *Feedback goes to* address); an identical passage that reviewer or the
  desk dismissed is set aside before the banker sees it; a close one, or a rule that reviewer keeps rejecting
  (four verdicts, three quarters dismissed), is left to the reviewer instead of asserted; the rules learned
  from that reviewer are added to the prompts as their preferences;
- on the reviewer platform each point shows its precedent: *You dismissed an identical point on 2026-09-10:
  "…"*.

**Two memories on every submission.** When a reviewer opens a submission, a Memory card at the top of the
panel tells them two things. *For you*: what they usually do on these rules, the open points that match what
they usually confirm (or a passage they confirmed before and have not verdicted here), and their own verdicts
that differ from what they did before. *From the other reviewers*: the similar submissions the reviewers handled (same firm,
lane, document type, file, subject or points raised; the same file scores 100 %), who reviewed them and
what was decided, the colleagues' verdicts on similar points shown under each point ("Marie Curie confirmed an
identical point on Quartus AI Fund II (2026-09-10): …"), and every verdict that differs from a colleague's on a similar point.
Nothing is changed automatically: the card says where the reviewer would be inconsistent, with themselves or
with the desk, and lets them keep or align, with a comment either way. `tests/test_memory.py` drives it with
two reviewers.

![The Memory card on the reviewer platform: the desk's similar submission, a colleague's verdict, a disagreement flagged](docs/screens/shot_memory.jpg)

The **Learning** view lists the reviewers (what each one confirms, dismisses and says, the rules learned from
them), the learned rules with their scope, the track record per rule, what the pre-review learned in order,
and exports the whole state as JSON. **Ask the desk memory** searches every verdict, comment and decision
message (rule ids exactly, words over the passage, the reason, the document and the reviewer). The **Desk
playbook** writes what the desk has learned up as a document a new reviewer reads on day one: what the desk
sends and what it sets aside (with the reasons given), the standing rules and reviewer preferences, how each
reviewer works, where the reviewers differ, how decisions are worded; a computed version is always there,
*Write the playbook with Claude* turns it into prose from the same record (reviewer text is data, never
instructions; anything that would remove an SOP block is dropped), and it exports as PDF. After a week of use the state carries the desk's verdicts, comments and
decisions, and the pre-review is calibrated on them; `tests/test_learning.py` drives the whole loop with a
stubbed Claude.

![The Learning view: reviewers, what they said, the rules learned from them](docs/screens/shot_learning.jpg)

![The desk playbook, computed from the reviewers' record](docs/screens/shot_playbook.jpg)

## 7. Speed, cost, and what it costs you

A thorough pre-review is three model calls (map the document → apply the rulebook → senior second pass).
On the corpus used for the simulations: **2 to 5 minutes** and **$0.32 to $0.82** of model usage per
document, billed to whichever Claude account the backend uses. The **Fast** depth is about a minute and
one call, and then nothing is asserted to the banker without the reviewer.

## 8. Does it actually work better than the old overlay?

`docs/SIMULATIONS.md` is the full report: both engines run on the same documents, scored against a written
ground truth, with the method, the per-document detail, and the honest limits. Headline, same corpus, real
models:

| | old overlay engine | this product |
|---|---|---|
| Reviewer points found (7-document corpus) | 22 / 31 | **31 / 31** |
| Points raised that the ground truth forbids | 26 (of 84 raised) | **2 (of 46)** |
| Calibration deck vs the reviewer's finding sheet | 5/9 validated flags, 10/23 rejected flags raised, 63 points | **8/9 validated, 0 rejected flags asserted, 11 points** |
| Quoted passages located verbatim for highlighting | n/a | **46 / 46** |

Reproduce it yourself (this spends model usage on your account):

```bash
python3 sim/corpus.py       # regenerate the synthetic corpus + ground truth
python3 sim/old_engine.py   # baseline: the overlay's engine, unchanged
python3 sim/run_new.py      # this product, real models, through the product path
python3 sim/score.py && python3 sim/report.py
```

## 9. What is in this repo

```
run.sh / run.cmd     start the local server
server.py            the whole backend: static files, Claude calls, document store, assets, learning, sign-in
shell.html, src/*.js the app (one page, no framework, no build step beyond build.py)
src/pdfedit.js       the in-browser PDF editor: incremental updates on the uploaded file (xref tables and
                     xref streams with object streams), white boxes and Helvetica text, no library
src/fix.js           the fixes proposed per point, the corrected build, the re-check, the readiness score
src/exports.js       PowerPoint and Word writers (Office Open XML in a STORE zip, no library)
src/deal.js          the deal file: the figures a document commits to, and their consistency
src/audit.js         the audit trail as a SHA-256 hash chain, with its verifier
src/metrics.js       the desk metrics, derived from the submissions
build.py             assembles shell.html + src/*.js into dist/ and web/
web/index.html       the local build served by server.py        (generated)
dist/prescreen.html  the same app as a standalone claude.ai artifact page (generated)
quartus.pdf          the calibration deck used by the demo button
brand/               the official Finalis logo (transparent PNG, dark variant, JPEG for the PDF headers), inlined by build.py
docs/                SIMULATIONS.md (the evaluation), ARCHITECTURE.md (the rule pipeline), screens/
sim/                 the simulation corpus, the old engine, the runner, the scorer, the report
tests/               Playwright flows, the suite runner, the module lint, fixtures (see below)
data/                created at first run: submissions, uploaded PDFs, learning state (gitignored)
```

After editing `shell.html` or anything in `src/`, run `python3 build.py` and refresh the page.

## 10. Tests

```bash
pip install playwright && python -m playwright install chromium
python3 tests/test_local.py   # the local build against server.py in mock mode, end to end
python3 tests/test_flow.py    # banker → reviewer → learning, with a stubbed Claude, scored against the finding sheet
python3 tests/test_hl.py      # highlight location on 18 real quotes from the calibration deck
python3 tests/test_pdfedit.py # the PDF editor on a classic-xref file and on the object-stream deck (qpdf, pdftotext, pdf.js)
python3 tests/test_edit.py    # Fix in the document → Apply all → drag → corrected PDF → Re-check → v2 submission → reviewer
python3 tests/test_office.py  # PowerPoint and Word exports opened with python-pptx / python-docx and converted by LibreOffice
python3 tests/test_login.py   # sign-in, keep me signed in, prefill, sign out, reviewer role
python3 tests/test_desk.py    # reviewer queue, focus mode with the keyboard, decision, timeline, chat dock
python3 tests/test_learning.py # every verdict and comment recorded with identity, decision, digest, adaptation to the reviewer
python3 tests/test_memory.py  # personal and shared memory with two reviewers, disagreements flagged
python3 tests/test_loop.py    # My submissions, the next round, the reviewer's round view, the second opinion, the brief sections
python3 tests/test_deal.py    # the figure scanner, ranges and tiers, contradictions inside a document and across the deal file
python3 tests/test_playbook.py # the desk memory search, the computed and the written playbook, its guards, the PDF
python3 tests/test_dashboard.py # the metrics from a seeded inbox, the audit chain, tamper detection, the export
python3 tests/test_platforms.py # the banker sees asserted points only, the reviewer sees everything
python3 tests/test_landing.py # the modal: Submit disabled without a file, the setup step, back and forth
python3 tests/test_more.py    # DOCX, a pasted post, an image upload, a 400 px viewport, dark theme
python3 tests/test_engine.py  # extraction and the deterministic engine on the calibration deck
python3 tests/test_pdf.py     # the PDF exports through the local server (downloads, qpdf)
python3 tests/lint_modules.py # cross-module check: every Module.member used exists, every state key read is set
python3 tests/run_all.py      # the whole suite, one line per test; --quick skips test_office, test_pdf and test_local
```

Every test ends with `ALL OK` or `FAILURES` and a non-zero exit code; `run_all.py` reports 21/21.

None of these call a model. Beyond Chromium (`pip install -r tests/requirements.txt`, then
`python -m playwright install chromium`): `test_pdfedit`, `test_edit` and `test_pdf` need `qpdf` and
`poppler-utils`; `test_office` also needs `python-pptx`, `python-docx` and LibreOffice (`soffice`). The
server tests start their own server on port 8789/8790 with a temporary data folder, so a running `./run.sh`
and your real `data/` are left alone.

## 11. Troubleshooting

**"running in mock mode"** — the server found neither `ANTHROPIC_API_KEY` nor the `claude` CLI. Install
Claude Code, run `claude` once to sign in, restart `./run.sh`.

**"claude CLI failed: ... not logged in"** — run `claude` in a terminal, `/login`, then retry.

**"This Claude account may not have access to claude-opus-5"** — set `MODEL_COMPLEX` and `MODEL_DEFAULT`
in `.env` to models your plan includes. When the server has to fall back to your account's default model, the
workspace says so (status line and an amber note in the points panel): the pre-review was calibrated on
`claude-opus-5` for the findings and `claude-sonnet-5` for the map and the second pass, and another model
raises different points. The setup step shows which models will run before you start.

**The points changed between two runs of the same document** — three things move them: the model (see
above), the depth (Fast has no second pass and asserts only the deterministic checks), and the learning state
(every verdict you click on the reviewer platform becomes a precedent for the next runs; **Clear all learning**
in the Learning view resets it).

**Port 8787 already in use** — `PRESCREEN_PORT=8899 ./run.sh`.

**The page says "Claude is not available in this view"** — that is the artifact build (`dist/prescreen.html`)
opened as a plain file. Use the local server, or publish that file as a Claude artifact.

**A scanned PDF with no text layer** — upload it as PNG/JPEG instead: the pre-review transcribes the image
first (API backend only).

## 12. Privacy and security

What reaches the model, always under your own account and only when a model call is made: the document text
(and, on the API backend, page images), the form (document type, distribution, audience, firm name, banker
name and email, notes), and on the reviewer platform the reviewers' names, comments and decision messages
(the digest and the decision draft need them). Nothing else leaves the machine; the artifact build loads
pdf.js from cdnjs, the local build serves it from `web/vendor/`.

Submissions, the uploaded PDFs and the learning state live in `data/` next to the code (or `PRESCREEN_DATA`);
delete the folder and nothing remains. The server binds to 127.0.0.1 by default and refuses requests whose
Host is not local, cross-origin requests, and mutating requests that do not come from the page. On a shared
install set `PRESCREEN_PASSCODE`: every sign-in then opens a server session, the reviewer role needs the
passcode, every sign-in needs a work email, bankers only see their own submissions and their own uploaded files
through the API (files uploaded before version 1.1 carry no owner and are not reopened for bankers: the form
asks for the corrected version instead), and the demo switch between the platforms is off. The audit export is a hash chain over every event (submitted, verdict,
comment, decision): keep it under the firm's books-and-records retention and verify any copy from the file
alone; the chain proves the integrity of what is in the file, so write down the head hash at export time. The `claude` CLI is always run with tools off, one turn, no session and a minimal environment, so
nothing in a document can drive an action. Sign-in is an identity, not an authentication: put Finalis's own
login (SSO) in front of the server for production.

---

Built for the Finalis AI hackathon. The rulebook quotes the Finalis Disclaimer SOP, the Language Guide and
the interim Institutional MMAT Review Framework verbatim; the calibration rules encode a Finalis reviewer's
own verdicts on the Quartus deck. It is advisory: it is not an approval and it changes no status.
