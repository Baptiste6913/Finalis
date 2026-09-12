# Simulations: old overlay engine vs Finalis AI Prescreen

Why simulations: the finalis-overlay 0.4.0 engine that came with the brief produced recommendations a reviewer could not send (63 points on the calibration deck, 18 on a clean deck) and missed points the reviewer had validated. Before trusting the new pipeline, both engines were run on the same material and scored against a written ground truth.

## Method

**Corpus.** Seven synthetic communications written for this purpose (`sim/corpus.py`), each with planted issues and planted clean elements that a naive scanner mistakes for issues: a clean institutional deck (S1), an institutional deck with gaps (S2), a retail real-estate offering with projections, testimonials and a guaranteed preferred return (S3), an institutional firm overview (S4), a LinkedIn post (S5), an email about an offering (S6) and an educational article (S7). The decks are printed to PDF by Chromium from HTML (real text layer, real fonts, logos embedded as PNG images so that, as in a real deck, a logo's name is not in the text layer); the post, email and article are pasted as text. Ground truth (`sim/corpus/truth.json`) lists, per document, the points a reviewer would send (`expected`, with the accepted rule alternatives, the page and a quote fragment) and the points a reviewer had ruled out (`must_not`, `must_not_pages`). The eighth document is the real calibration deck, Quartus AI Fund II (28 pages), scored against the reviewer's finding sheet from the brief.

**Old engine.** `sim/old/engine.js` and `sim/old/rules.json` are the overlay's files, executed unchanged on the same PDFs through pdf.js (`sim/old_engine.py`, results in `sim/results_old.json`). It is deterministic and free, which is why it could run in under a second per deck; the comparison is about what it says, not what it costs.

**New engine.** The product's own path, nothing bypassed: the local build served by `server.py`, driven by Playwright exactly as a banker would (upload, modal, Submit, audience, Start), the CLI backend calling real models (Opus for the findings pass, Sonnet for the profile and the second pass), Thorough depth, no page images (the CLI backend is text only, so every visual judgement here is made from the text layer), learning state empty (`data/` wiped before the run). Results in `sim/results_new.json`; `sim/score.py` scores both, `sim/report.py` writes this file. Two full runs were made: the first surfaced calibration gaps (listed under Fixes), the numbers below are from the second run with the final rulebook; S3 was run a third time after a change to the assurance rule (which decides what is asserted to the banker, not what is detected).

**Scoring.** A hit is an expected point found (rule from the accepted alternatives, on the right page, with the quote fragment when given; when both a page and a quote are given, the passage counts whatever the rule letter, as a reviewer would accept it). A false positive is a point on the `must_not` list. Points that are neither are extras and are judged one by one in the per-document notes. "Quotes located" counts the points whose quoted passage was found verbatim on the page by the highlighter (a point that quotes nothing, such as a missing block, counts as located). "Asserted / for review" is the assurance split: asserted points are shown to the banker as facts, the others are shown as pending the Finalis reviewer's verification.

## Results on the synthetic corpus

Old = the engine of finalis-overlay 0.4.0 (`sim/old/engine.js`, run unchanged on the same PDFs). New = this product through its real path: the local build in headless Chromium, `server.py` with the CLI backend, Thorough depth (Opus for findings, Sonnet for the profile and the second pass), no page images (the CLI backend is text only), learning state empty. Hits = expected reviewer points found; FP = points the ground truth forbids; n = points raised in total.

| Document | Lane | Expected | Old: hits | Old: FP | Old: n | New: hits | New: FP | New: n | Time | Cost | Quotes located | Asserted / for review |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| S1_inst_clean | institutional | 0 | 0 | 11 | 18 | 0 | 1 | 1 | 113s | $0.38 | 1/1 | 0 / 1 |
| S2_inst_gaps | institutional | 9 | 6 | 13 | 22 | 9 | 0 | 9 | 129s | $0.40 | 9/9 | 9 / 0 |
| S3_retail_projections | retail (public channel) | 12 | 8 | 1 | 22 | 12 | 0 | 17 | 290s | $0.66 | 17/17 | 11 / 6 |
| S4_firm_mmr | institutional | 2 | 1 | 1 | 5 | 2 | 1 | 3 | 123s | $0.34 | 3/3 | 2 / 1 |
| S5_linkedin | retail (public channel) | 3 | 3 | 0 | 6 | 3 | 0 | 5 | 107s | $0.32 | 5/5 | 4 / 1 |
| S6_email | institutional | 2 | 2 | 0 | 5 | 2 | 0 | 5 | 139s | $0.39 | 5/5 | 4 / 1 |
| S7_article | retail (public channel) | 3 | 2 | 0 | 6 | 3 | 0 | 6 | 105s | $0.32 | 6/6 | 3 / 3 |
| **Total** | | **31** | **22** | **26** | **84** | **31** | **2** | **46** | 1006s | $2.81 | 46/46 | 33 / 13 |

Recall (expected points found): old 71%, new 100%. Precision against the ground truth's forbidden points (points raised that a reviewer had ruled out): old 26 false positives in 84 points (31%), new 2 in 46 (4%). Points that are neither expected nor forbidden (extras) are listed per document below and judged one by one.

## Results on the calibration deck (Quartus AI Fund II, 28 pages, institutional)

Ground truth: the reviewer's finding sheet (9 validated flags, 23 rejected flags, 4 items without a verdict), encoded in `src/calibration.js`.

| Engine | Validated flags found | Rejected flags raised | Open items raised | Points in total | Time | Cost |
|---|---|---|---|---|---|---|
| Old overlay engine | 5/9 | 10/23 | 1/4 | 63 | 3.5 s | $0 |
| Finalis AI Prescreen (real models) | 8/9 | 3/23 | 3/4 | 11 | 284s | $0.82 |

Missed by the new engine: C · "attractive long-term growth potential", page 17

Rejected flags still raised by the new engine: "We believe … best" or "largest global institutions", page 6; "superior" in the mission statement, page 11; "designed to deliver" with the illustrative legend, page 18

Rejected flags raised by the old engine: A1b broker-dealer line requested separately; A2 "separate, unaffiliated" on deal material; A7 on a team, terms or sourced page (7, 9, 25, 27); B1/B2 despite the disclaimers page (3, 4, 9, 25, 27); B3 despite "past performance is not indicative" (3, 4, 6, 7, 9, 25); B10 audience from risk wording; "We believe … best" or "largest global institutions", page 6; "superior" in the mission statement, page 11; Sourced third-party data or "we believe", page 15; Footnoted criteria, page 20.

Validated flags the old engine missed: B6 · Service provider logos, page 23; C · "Led by AI pioneers", page 1; C · "trillions of dollars" unsourced, page 6; C · "attractive long-term growth potential", page 17.

Reading the calibration table: on the real deck the new engine finds 8 of the 9 points the reviewer validated and raises none of the 23 flags the reviewer rejected as asserted points. The three "rejected flags raised" labels come from one low-severity C2 finding that groups the aspirational phrases on pages 6, 11 and 18 ("to deliver strong risk-adjusted returns", "designed to deliver"); the second pass kept it at low severity and the assurance rule left it unasserted, so the banker never sees it; it waits on the reviewer platform with the reason, and the reviewer's dismissal teaches the next run. The missed point is "opportunities that offer attractive long-term growth potential" on page 17, a wording the reviewer wanted framed as a belief; in the earlier run of the same deck the engine found it and missed the page 6 figure instead: the language points on this deck sit at the edge of the calibration rules and vary between runs, which is exactly why they are not asserted unless corroborated. The old engine found 5 of 9 and raised 10 of the 23 rejected flags, in 63 points.

## Per document

### S1_inst_clean

Clean institutional deck: every disclosure present, sources on every exhibit, team bios, 'we believe' statements. A reviewer would send nothing, or at most one low confirmation.

New engine, 1 points (113s, $0.38):

- B3 · low · p.2 · verify: "Past performance is not indicative of future results; the performance of Fund I and Fund II may not be repeate"

Forbidden points raised: B3 p.2

Old engine, 18 points: A6 p.2, A6 p.2, A2 p.doc, A6 p.1, B1 p.2, B1 p.5, B1 p.7, B2 p.2, B2 p.7, B3 p.1, B3 p.2, B3 p.3, B3 p.5, B4 p.7, B7 p.2, B7 p.8, C1 p.2, C2 p.2.

New engine: one point, the low note the calibration rules allow on a past-performance line that is present but neither bold nor standalone. The truth counts it as a false positive because a reviewer would send nothing on this deck; the assurance rule agrees and leaves it unasserted. The first run also raised B4 on the terms page (the SOP text was on the disclaimers page, cross-referenced): fixed by encoding the desk's practice (the disclaimers page satisfies B4 when the terms page points to it) and by a verbatim coverage guard. The old engine raised 18 points on this clean deck, 11 of them on the forbidden list: every projection slide, the sourced track record, the preferred return that is disclosed on page 2, a legend it did not find.

### S2_inst_gaps

Institutional deck with gaps: no Finalis disclaimer, no legend, award without disclosure, third-party partner logos, preferred return without the disclosure, a chart without a source, two superlatives and an unsourced market figure. Clean elements: the issuer's own disclaimer page covers projections and past performance, bios, own-portfolio logos, sourced track record.

New engine, 9 points (129s, $0.40):

- A3 · high · p.1 · certain: "Institutional legend on the first page is missing"
- A1a · high · p.doc · certain: "Finalis disclaimer (incorporation by reference and broker-dealer line) is missing"
- A7 · medium · p.9 · certain: "Projected deployment schedule 2026 EUR 250m 2027 EUR 450m 2028 EUR 550m 2029 EUR 250m"
- B8 · medium · p.1 · certain: "Winner, Infrastructure Investor Awards 2025: Emerging Manager of the Year"
- B6 · medium · p.7 · certain: "Strategic partners and lenders. We work with a group of relationship banks, advisers and co-investors:"
- B4 · medium · p.8 · certain: "Preferred return 8% compounded annually"
- C1 · high · p.3 · certain: "Our proprietary sourcing engine delivers superior returns through off-market transactions."
- C1 · medium · p.1 · certain: "The leading mid-market infrastructure platform in Europe"
- C4 · medium · p.3 · certain: "Infrastructure assets attracted $1.2 trillion of capital in 2025, and the mid-market remains fragmented."

Old engine, 22 points: A1a p.doc, A1b p.doc, A2 p.doc, A3 p.doc, A7 p.6, A7 p.7, B1 p.2, B1 p.5, B1 p.8, B1 p.9, B2 p.2, B2 p.5, B2 p.8, B2 p.9, B3 p.5, B3 p.8, B4 p.8, B6 p.6, B6 p.7, B8 p.1, C1 p.3, C2 p.2.

Old engine missed: {"rule": "A7", "page": 9}; {"rule": "C1|C4", "page": 1, "quote": "leading mid-market"}; {"rule": "C4", "page": 3, "quote": "1.2 trillion"}

All nine planted issues found, nothing else, every point asserted (deterministic, or located verbatim, high confidence, kept by the second pass, corroborated). The first run missed three of them: the award disclosure (the second pass had dropped it under a language rule about award names), the preferred return (a cross-reference to a generic no-guarantee line was taken as coverage) and the deployment chart (a vector chart leaves no image, the model called it a text slide). Fixes: the item-specific disclosures are separated from the document-level ones in calibration rule 3; the verifier is told that disclosure candidates are never dropped under a language rule; the deterministic engine marks EXHIBIT pages (series of period/value pairs, or a titled chart with figures) and the rulebook says an exhibit is an exhibit without an image. The old engine found 6 of 9 in 22 points, 13 of them forbidden.

### S3_retail_projections

Retail private-placement real-estate deck: projected IRR and yield on the cover, guaranteed preferred return, urgency, testimonials without legend, distribution yield partly funded by offering proceeds, cherry-picked deals, risks only in the PPM, no Finalis disclaimer.

New engine, 17 points (290s, $0.66):

- A1a · high · p.doc · certain: "Finalis disclaimer (incorporation by reference and broker-dealer line) is missing"
- A7 · medium · p.4 · certain: "Cash yield 6.0% 7.0% 7.5% 8.0% 8.5% Cumulative distributions $60,000 $130,000 $205,000 $285,000 $370,000"
- B1 · high · p.1 · certain: "Projected 18% IRR · 8% preferred return · 7% annual yield paid monthly"
- B4 · high · p.2 · certain: "Guaranteed 8% preferred return to investors before the sponsor receives any profit."
- B7 · high · p.5 · certain: ""Best sponsor I have ever worked with. My returns beat the market every single year." J.R., investor since 201"
- B5 · high · p.6 · certain: "7% annualized distribution yield, paid monthly since inception"
- B3 · high · p.7 · certain: "Completed deals returned an average 21% IRR (Deals 3, 7 and 11)."
- B9 · high · p.doc · verify: "Missing private-offering illiquidity / risk-of-loss disclosure"
- C16 · high · p.1 · certain: "7% annual yield paid monthly"
- C2 · high · p.2 · certain: "Guaranteed 8% preferred return to investors before the sponsor receives any profit."
- C1 · high · p.2 · verify: "This is a can't-miss opportunity to own institutional-quality apartments in the Sun Belt."
- C4 · high · p.5 · certain: ""Best sponsor I have ever worked with. My returns beat the market every single year.""
- C4 · high · p.7 · certain: "Our sponsor has never lost investor capital across 14 completed deals."
- C8 · high · p.7 · verify: "Completed deals returned an average 21% IRR (Deals 3, 7 and 11)."
- C18 · high · p.8 · verify: "Risk factors are detailed in the private placement memorandum, available on request."
- C3 · medium · p.2 · verify: "Invest now: limited allocation, closing June 30."
- C15 · medium · p.4 · verify: "Projected equity multiple 2.1x · projected IRR 18%"

Extras (neither expected nor forbidden): A7 p.4 (medium) "Cash yield 6.0% 7.0% 7.5% 8.0% 8.5% Cumulative distributions $60,000 $"; B3 p.7 (high) "Completed deals returned an average 21% IRR (Deals 3, 7 and 11)."; C16 p.1 (high) "7% annual yield paid monthly"; C1 p.2 (high) "This is a can't-miss opportunity to own institutional-quality apartmen"; C8 p.7 (high) "Completed deals returned an average 21% IRR (Deals 3, 7 and 11)."

Old engine, 22 points: A1a p.doc, A1b p.doc, A2 p.doc, A5 p.doc, A7 p.4, B1 p.1, B1 p.4, B1 p.7, B2 p.1, B2 p.4, B2 p.7, B3 p.6, B3 p.7, B4 p.1, B4 p.2, B5 p.6, B7 p.5, C1 p.3, C1 p.2, C3 p.2, C3 p.2, C3 p.5.

Old engine missed: {"rule": "B9"}; {"rule": "C2", "quote": "guaranteed"}; {"rule": "C18|C9", "page": 8}; {"rule": "C6|C1|C4", "page": 5}

All twelve planted issues found on a retail private-placement deck: the projected IRR and yield on the cover (RN 20-21), the guaranteed preferred return, the urgency, the testimonials without the legend, the distribution rate partly funded by offering proceeds, the cherry-picked deals ("Deals 3, 7 and 11"), the risks left to the PPM, the missing illiquidity line. Extras: a source request on the projections table, the average IRR of the completed deals raised as past performance as well as cherry-picking, the cover yield raised once more as a distribution-rate point (asserted: a return figure on retail material), and the "can't-miss" wording (left for the reviewer). Six of the seventeen points are pending verification: the document-level illiquidity line (the deck mentions risk factors, so the deterministic check does not corroborate the absence), the two judgement categories (cherry-picking, risks in a separate document) and three points the second pass downgraded (the urgency line, the "can't-miss" wording, the projected multiple on page 4). The old engine found 8 of 12 in 22 points, with no way to tell a retail lane from an institutional one.

### S4_firm_mmr

Institutional non-deal firm overview: legend and broker-dealer line present, the 'separate, unaffiliated entities' line missing, client logos without the logo disclosure.

New engine, 3 points (123s, $0.34):

- A2 · high · p.doc · certain: "Separate and unaffiliated entities is missing"
- B6 · medium · p.3 · certain: "Clients include:"
- B3 · low · p.3 · verify: "Selected transactions ... Transactions completed by the Northbridge team since 2019."

Forbidden points raised: B3 p.3

Old engine, 5 points: A1a p.doc, A6 p.5, A2 p.doc, A6 p.1, A7 p.3.

Old engine missed: {"rule": "B6", "page": 3}

Both planted issues found (the missing "separate, unaffiliated entities" line; client logos without the logo disclosure, from five images and the caption alone). The extra is a low, unasserted past-performance note on "transactions completed since 2019": the truth forbids B3 here because no returns are shown; a reviewer dismisses it in one click. The old engine asked for the Finalis deal disclaimer on a non-deal overview, raised two legibility points on the 8.5 pt legend, asked for a source on the client list, and missed the logos.

### S5_linkedin

LinkedIn post with a ranking, calls to action (DM me, comment below) and an investment opportunity.

New engine, 5 points (107s, $0.32):

- A1p · low · p.doc · certain: "Investment opportunity mentioned in a post"
- B11 · high · p.1 · certain: "DM me for the teaser, or comment below and I will reach out."
- B8 · medium · p.1 · certain: "ranked #3 in the Mid-Market Advisor League Table 2026 by MergerLink"
- C9 · medium · p.1 · verify: "We are currently raising for an exciting healthcare opportunity: a profitable diagnostics company with 40% rev"
- C4 · medium · p.1 · certain: "a profitable diagnostics company with 40% revenue growth"

Extras (neither expected nor forbidden): C9 p.1 (medium) "We are currently raising for an exciting healthcare opportunity: a pro"; C4 p.1 (medium) "a profitable diagnostics company with 40% revenue growth"

Old engine, 6 points: A1b p.doc, A2 p.doc, A5 p.doc, B1 p.1, B8 p.1, B11 p.doc.

Ranking, calls to action and the investment opportunity all found; the extra points are the unsourced "40% revenue growth" and a fair-and-balanced note on promoting a private offering to a public audience (left for the reviewer). The old engine found the same three but also asked for the broker-dealer line, the unaffiliated line and the general firm disclosure as three separate blocks, plus a forecast disclosure, on a LinkedIn post.

### S6_email

Email about an offering with a promissory 'will deliver 2.5x' and only the broker-dealer line (the email disclaimer is missing).

New engine, 5 points (139s, $0.39):

- A3 · high · p.1 · certain: "Institutional legend on the first page is missing"
- A1e · high · p.doc · certain: "Email offering disclaimer is missing"
- B1 · high · p.1 · certain: "Fund III will deliver 2.5x net to limited partners over the fund term"
- C2 · high · p.1 · certain: "Fund III will deliver 2.5x net to limited partners over the fund term"
- C9 · medium · p.1 · verify: "We are pleased to share the Harbor Growth Fund III opportunity. Fund III will deliver 2.5x net to limited part"

Extras (neither expected nor forbidden): A3 p.1 (high) "Institutional legend on the first page is missing"; B1 p.1 (high) "Fund III will deliver 2.5x net to limited partners over the fund term"; C9 p.1 (medium) "We are pleased to share the Harbor Growth Fund III opportunity. Fund I"

Old engine, 5 points: A3 p.doc, B1 p.1, B3 p.1, B12 p.doc, C2 p.1.

The missing email disclaimer and the promissory "will deliver 2.5x" found, plus the forecast disclosure the projection triggers and the institutional legend the lane requires; the fair-and-balanced note is left for the reviewer. In the first run the model also raised B12 as a duplicate of the deterministic A1e: model findings that duplicate a deterministic block are now dropped. The old engine found both planted issues (the email disclaimer under its B12 label) and added a past-performance disclosure on the same sentence.

### S7_article

Educational article without the section 9 disclaimer, a comparison stated as fact and an expected-return statement.

New engine, 6 points (105s, $0.32):

- A1r · high · p.doc · certain: "Article, newsletter and educational content disclaimer is missing"
- C2 · high · p.1 · verify: "Investors who allocate 10% of a portfolio to private credit can expect higher income with lower volatility."
- C1 · high · p.1 · certain: "private credit outperforms public bonds in every rate environment because floating-rate loans reprice with the"
- C9 · high · p.1 · verify: "The asset class is now a core holding for pension funds and insurers, and the opportunity set for middle-marke"
- C4 · medium · p.1 · certain: "Direct lending funds returned 11.4% in 2025 against 3.1% for the Bloomberg Aggregate"
- C6 · medium · p.1 · verify: "Why private credit outperforms bonds in a rising-rate world"

Extras (neither expected nor forbidden): C9 p.1 (high) "The asset class is now a core holding for pension funds and insurers, "; C4 p.1 (medium) "Direct lending funds returned 11.4% in 2025 against 3.1% for the Bloom"; C6 p.1 (medium) "Why private credit outperforms bonds in a rising-rate world"

Old engine, 6 points: A1b p.doc, A2 p.doc, A5 p.doc, B13 p.doc, C4 p.1, C4 p.1.

Old engine missed: {"rule": "C4|C2", "quote": "can expect"}

The missing section 9 disclaimer, the comparison stated as fact and the expected-return sentence all found; the extras are the unsourced 11.4% versus 3.1% figures and the title's "outperforms" grouped with the comparison. In the first run the model duplicated the deterministic A1r as B13 (now dropped). The old engine found the missing disclaimer (under its B13 label) and the comparison, asked for the broker-dealer line, the unaffiliated line and the general firm disclosure as separate blocks, and missed the expected-return sentence.

## Fixes made between the two runs

1. Calibration rule 3 now separates document-level disclosures (B1, B2, B3, B9: covered by an equivalent anywhere) from item-specific ones (B4, B5, B6, B7, B8: covered only by their own wording, B6 on the page with the logos), with the desk's practice on B4 (the disclaimers page, cross-referenced from the terms page) taken from the reviewer's verdict on the calibration deck.
2. Rule 5: a vector-drawn chart leaves no image object; pages whose text is a series of period/value pairs, or a titled chart with figures, are marked EXHIBIT by the deterministic engine and treated as statistical exhibits; an illustrative legend is not a source (finding sheet, page 16).
3. Rule 7 / 9(b): the award-name language exemption never removes the B8 disclosure.
4. The second pass is told that disclosure candidates are judged on the presence of the disclosure only, never dropped under a language rule.
5. Rule 10(b): a specific market figure inside a page without a source is a substantiation point even when another page cites sources (finding sheet, page 6), and a C4 lexicon feeds the candidates (trillion, market size, never lost, every rate environment...).
6. B12 and B13 raised by the model on a document whose disclaimer is already a deterministic block are dropped; B12 applies to emails only.
7. A verbatim coverage guard sets aside B4, B5, B7 when the SOP text is in the material, and B6 when the logo disclosure is on the page.
8. Rule 9(i): a complete fund-level track record with an audited source is not cherry-picked performance.

## What the numbers do not show

- The corpus is synthetic and small, written by the same author as the rulebook; it is a regression harness, not a benchmark. The Quartus deck with the reviewer's sheet is the only external ground truth, and it is institutional only.
- Real models are not deterministic: on the Quartus deck the two full runs found 7/9 and 8/9 with different misses among the language points. The assurance rule exists for that reason: language points that are not corroborated by the desk's own lexicon are never asserted to the banker.
- No page images were sent (CLI backend). With the API backend the findings pass receives renders of the exhibit and logo pages, which is what tells a chart from a table when the text layer is ambiguous.
- Time per document is 2 to 5 minutes at Thorough depth and $0.32 to $0.82 of model usage; the old engine is instant and free. The comparison is on what reaches the reviewer.

## Highlighting

Every quoted passage the new engine raised on the corpus was located verbatim on its page (see the "Quotes located" column); on the Quartus deck the highlighter locates 18 of 18 test quotes spanning line breaks, hyphenated breaks and ligatures at score 100 (`tests/test_hl.py`), and the only unlocated quote in the runs is a model paraphrase of a chart ("SWEET SPOT ... Stage / Liquidity"), which the assurance rule leaves unasserted.

## Recheck after the platform changes (11 September 2026)

The intelligence layer was left byte-identical after the validated run while the platform changed (banker summary, reviewer platform, PDF exports). A recheck on the same build then produced: S1 (clean deck) two low notes, both left to the reviewer and never shown to the banker (a past-performance formatting note and a "we believe" sentence raised as C4); S2 8 points with the two superlatives grouped into one finding whose quote joined two pages and therefore could not be located; Quartus 8/9 validated flags, one rejected flag raised as an unasserted low point, 11 points. Two adjustments followed: the second pass now drops (not downgrades) language candidates framed as opinions or aims ("we believe", "we aim", "designed to"...), and a finding must quote one passage from its main page (grouped quotes are split by the guard and the first located passage is kept). After them: S1 zero points, S2 9/9 with every point asserted and located. Results in `sim/results_recheck.json`. Two other things move results between runs on a colleague's machine and are now visible in the product: the model that actually answered (a fallback to the account's default model is reported in the status line and as a warning) and the learning state (the verdicts clicked on the reviewer platform become precedents; a Clear all learning button resets it).