# Changelog

## 1.1 (12 September 2026) — the loop closed, the deal file, the desk's numbers

- The loop closed: **My submissions** on the banker platform (own submissions, the reviewer's decision and
  message, an unseen badge, the points that stood); **Correct and resubmit** reopens the document with the
  reviewer's message and sends the next **round** (round, thread, previous round and its tally on the
  submission; the previous round marked superseded; points still open tagged, resolved ones listed); the
  reviewer sees the round badge, *Since round 1*, both rounds in the timeline and the brief, and the decision
  draft names what is still open. On team installs bankers read back their own uploaded files.
- The deal file: the figures a document commits to (targets, fund size, hard cap, minimum, preferred return,
  fees, carry, GP commitment, term, track record) extracted by a deterministic scan plus the model (quotes
  located on the page or dropped), compared inside the document and across the other documents of the same
  deal; shown to the banker (Summary, Disclosures note) and the reviewer (Memory card, brief, brief PDF).
- The desk playbook (computed from the record, or written by Claude with the same guards as the digest; cached;
  PDF export) and *Ask the desk memory* in the Learning view.
- Second opinion after an approval (reviewer only, advisory, quotes located on the page).
- Metrics and audit view: first-pass approval, readiness by week, corrections, rounds, time to decision,
  rules per firm, decisions per reviewer; the audit trail exported as a SHA-256 hash chain, with a verifier.
- Four new tests (`test_loop`, `test_deal`, `test_playbook`, `test_dashboard`); the runner reports 21 checks.
- Review round on the above (two independent reviews, every finding fixed): scanner patterns that cannot
  backtrack, a deal-file gate that needs the subject as well as the firm, model claims checked for the figure
  itself, one contradiction per figure, the audit chain sealed and round-trip safe, the pre-review kept when
  the figures step is stopped, positional ids never used to carry points across rounds, a way back from
  My submissions, the round chip on the form, list-only re-renders on store snapshots, the playbook kept in
  its own document. Team installs: a sign-in needs a work email; the asset index is reviewer-only; files
  uploaded before 1.1 carry no owner and are not reopened for bankers.

## 1.0 (12 September 2026) — final hackathon solution

- Review round (two independent code reviews, every finding fixed): server sessions and same-origin gate,
  request limits, CLI sandbox on every attempt, store integrity; comment-only entries, rerun resets, masked
  re-check, unreadable pages, precedence and race fixes; assertions in every test, `tests/test_server.py`,
  17 checks in the runner; docs made exact against the code.

- Sign-in screen (banker / Finalis reviewer), identity on every submission, optional passcode on team installs.
- In-app correction of the document: fixes proposed per point, movable boxes, corrected PDF as an incremental
  update (no library), re-check of the corrected version, readiness score, PowerPoint and Word exports.
- Reviewer platform: queue with priority, filters and search; corrections outlined with an Original switch;
  focus mode with the keyboard; decision bar with a drafted message; timeline.
- Learning v2: every verdict and comment recorded with the reviewer's identity; decisions recorded; digest of
  the comments into desk-wide and per-reviewer rules; precedents applied before the banker sees the points.
- Memory on every submission: personal (habits, points not verdicted, own inconsistencies) and shared
  (similar submissions, colleagues' verdicts, disagreements).
- Document chat on both platforms; official logo in the app and the PDFs.
- Test suite runner (`tests/run_all.py`), module lint, fixtures moved under `tests/fixtures/`.

## 0.3 (11 September 2026)

- Banker platform shows asserted points only; reviewer platform naming; model and learning made visible.
- Desk brief and banker summary as PDF (desk-memo layout); export of the summary.

## 0.2 (10 September 2026)

- Two platforms (banker, reviewer), verification queue, permanent learning v1 (verdicts, distilled rules,
  per-rule demotion, export/import), simulations against the overlay 0.4.0 engine.

## 0.1

- Mandatory AI pre-review under the Marketing materials form: deterministic SOP checks, three model passes,
  quote location and highlighting, calibration against the reviewer's finding sheet.
