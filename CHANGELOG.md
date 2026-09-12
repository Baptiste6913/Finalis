# Changelog

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
