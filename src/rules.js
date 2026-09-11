'use strict';
/* The rule library. Every disclosure text below is quoted from the Finalis Disclaimer SOP and the
   Language Guide; the calibration rules are quoted from the reviewer's verdicts on the finding sheet.
   Nothing is paraphrased: when a text is wrong it is wrong the way the SOP is, and Compliance fixes it here. */
const RULES = (() => {
  const SOP = {
    finalis_full: 'The reader agrees to the provisions set forth on those certain "Disclaimers" located at https://www.finalis.com/disclaimers and the terms thereof are incorporated by reference as though fully set forth herein, and references therein to (i) "Company" means the entity in connection with this transaction (together with its affiliates, subsidiaries, successors and assigns), (ii) "Banker" means the registered representative of Finalis Securities LLC in connection with this transaction and (iii) "Bank" means {Bank Name}. Securities are offered through Finalis Securities, LLC member FINRA/SIPC.',
    finalis_core: 'The reader agrees to the provisions set forth on those certain "Disclaimers" located at https://www.finalis.com/disclaimers and the terms thereof are incorporated by reference as though fully set forth herein',
    bd_line: 'Securities are offered through Finalis Securities, LLC member FINRA/SIPC',
    bd_line_alt: 'Securities offered through Finalis Securities LLC Member FINRA/SIPC',
    unaffiliated: 'and Finalis Securities LLC are separate, unaffiliated entities',
    legend: 'For institutional investors only',
    legend_alt: 'For Institutional Use Only',
    email_short: 'This communication is only intended to provide general information about a particular investment opportunity and to gather indications of interest. It does not constitute an offer of a security.',
    mmr_general: 'This communication is intended only to provide general information about potential investment opportunities and to gather indications of interest. It does not constitute an offer to sell or a solicitation of an offer to buy any security.',
    mmr_general_alt: 'This material is provided for informational purposes only and is not intended to constitute an offer or solicitation of securities. Any references to investment opportunities are general in nature and intended solely to gauge preliminary interest.',
    article: 'This material has been prepared for information and educational purposes only, and it is not intended to provide, nor should it be relied on for tax, legal, or investment advice. You should consult with your own tax, legal, and financial professionals for your specific situation. The views and opinions expressed in this article are those of the author and do not necessarily reflect the views or opinions of Finalis Securities, LLC. Securities offered through Finalis Securities LLC Member FINRA/SIPC. [Firm Name] and Finalis Securities LLC are separate, unaffiliated entities.',
    article_core: 'This material has been prepared for information and educational purposes only, and it is not intended to provide, nor should it be relied on for tax, legal, or investment advice',
    blog: 'This material is intended for information purposes only and does not constitute investment advice, a recommendation or an offer or solicitation to purchase or sell any securities to any person in any jurisdiction in which an offer, solicitation, purchase or sale would be unlawful under the securities laws of such jurisdiction.',
    blog_core: 'This material is intended for information purposes only and does not constitute investment advice, a recommendation or an offer or solicitation to purchase or sell any securities',
    linkedin_firm: 'Securities offered through Finalis Securities LLC Member FINRA / SIPC. [Insert DBA Name] and Finalis Securities LLC are separate, unaffiliated entities',
    linkedin_rr: '[Insert Name] is a Registered Representative of Finalis Securities LLC Member FINRA / SIPC.',
    linkedin_rr_core: 'is a Registered Representative of Finalis Securities LLC Member FINRA',
    linkedin_cta: 'Please note that Finalis does not permit interactive activities related to securities business on social media. Accordingly, you may not interact with this LinkedIn post for securities-related purposes.',
    forecast: 'Fundamental data and forecast supplied by management of the Company. Such projections may not be realized. Past performance may not recur, and there is no guarantee of future results.',
    illustration: 'The issuer and/or sponsor believe that the hypothetical illustration provided is reasonable based on comparable peer valuations and/or applying mathematical principles. This is an illustration only and is not intended to forecast the performance of a specific investment or strategy.',
    past_perf: 'Past performance may not recur, and there is no guarantee of future results.',
    pref: 'Preferred returns are part of the deal structure and indicate the sequence of how distributions (from operations or a capital event) are disbursed. They are not guaranteed and should not be considered a financial projection. Actual cash flow projections and distributions from the sponsor may differ from the preferred return.',
    distributions: 'Distributions are not guaranteed and may be discontinued at any time.',
    logos: 'Corporate logos do not represent endorsements.',
    logos_alt: 'The company images/logos are being displayed for illustrative purposes and there is no guarantee a business transaction can be consummated with one of these companies.',
    testimonial: 'This testimonial may not be representative of the experience of other customers. There is no guarantee of future performance or success. Each individual customer experience may differ and vary, and may not always be representative of the services paid for.',
    testimonial_paid: 'The customer featured in this testimonial was paid more than $100.',
    real_estate: 'Investments in private offerings are illiquid and speculative and you must be able to sustain a full loss of your investments.',
    source: 'Source: Information provided by Sponsoring/Issuing Company.',
  };

  /* Required blocks (Tier A) by document type and lane. `match` is the text searched for (fuzzy),
     `text` is what the banker adds. scope: document | first_page. */
  function requiredBlocks(docType, lane, involvement) {
    const A = [];
    const third = involvement === 'third-party';
    const finalis = {
      id: 'A1a', name: 'Finalis disclaimer (incorporation by reference and broker-dealer line)',
      citation: 'SOP Mandatory Disclaimers (a)(i) / (d)', scope: 'document', threshold: 80,
      match: [SOP.finalis_core], text: SOP.finalis_full, severity: third ? 'medium' : 'high',
      placement: 'the disclaimers page, or the last page',
      note: third ? 'The material was prepared by a third party: the disclaimer may go in the transmittal email instead, and that email must then also state that some or all of the attached material was prepared by a third party.' : '',
    };
    const legend = { id: 'A3', name: 'Institutional legend on the first page', citation: 'SOP Mandatory Disclaimers (d) / FINRA 2210(b)(3)', scope: 'first_page', threshold: 86, match: [SOP.legend, SOP.legend_alt], text: 'For Institutional Investors Only', severity: 'high', placement: 'a visible part of the first page' };
    const forbiddenLegend = { id: 'A4', name: 'Institutional legend on retail material', citation: 'FINRA 2210(a) / WSP 5.2', scope: 'document', threshold: 86, forbidden: [SOP.legend, SOP.legend_alt], text: 'Remove the institutional legend: the audience includes natural persons, so this is a retail communication.', severity: 'high' };
    const bd = { id: 'A1b', name: 'Broker-dealer line', citation: 'SOP Mandatory Disclaimers', scope: 'document', threshold: 86, match: [SOP.bd_line, SOP.bd_line_alt], text: SOP.bd_line_alt + '.', severity: 'high', placement: 'the disclaimers page, or the last page' };
    const unaff = { id: 'A2', name: 'Separate and unaffiliated entities', citation: 'SOP MMR institutional / 10(a)', scope: 'document', threshold: 84, match: [SOP.unaffiliated, 'are separate and unaffiliated entities'], text: '[Firm Name] and Finalis Securities LLC are separate, unaffiliated entities.', severity: 'high', placement: 'next to the broker-dealer line' };
    const mmr = { id: 'A5', name: 'General disclosure for firm marketing material', citation: 'SOP 10(a)', scope: 'document', threshold: 80, match: [SOP.mmr_general, SOP.mmr_general_alt], text: SOP.mmr_general + ' ' + SOP.bd_line_alt + '. [Firm Name] and Finalis Securities LLC are separate, unaffiliated entities.', severity: 'high', placement: 'the last page' };

    switch (docType) {
      case 'deal-deck':
        A.push(finalis);
        if (lane === 'institutional') A.push(legend); else A.push(forbiddenLegend);
        break;
      case 'firm-marketing':
        if (lane === 'institutional') { A.push(Object.assign({}, legend, { text: 'For Institutional Use Only', name: 'Institutional legend on the first page' })); A.push(bd); A.push(unaff); }
        else { A.push(mmr); A.push(forbiddenLegend); }
        break;
      case 'email':
        A.push({ id: 'A1e', name: 'Email offering disclaimer', citation: 'SOP Mandatory Disclaimers (e)', scope: 'document', threshold: 80, match: [SOP.email_short, SOP.finalis_core], text: SOP.email_short + ' ' + SOP.bd_line_alt + '.', severity: 'high', placement: 'the email footer' });
        if (lane === 'institutional') A.push(legend); else A.push(forbiddenLegend);
        break;
      case 'linkedin-post':
        A.push({ id: 'A1p', name: 'Investment opportunity mentioned in a post', citation: 'SOP 5(c)', scope: 'document', threshold: 80, match: [SOP.mmr_general], text: SOP.mmr_general, severity: 'medium', conditional: 'only when investment opportunities are mentioned', placement: 'the end of the post' });
        break;
      case 'linkedin-profile':
        A.push({ id: 'A1l', name: 'Broker-dealer disclosure on the About section', citation: 'SOP 7 / 8', scope: 'document', threshold: 82, match: [SOP.linkedin_firm, SOP.linkedin_rr_core, SOP.bd_line_alt], text: SOP.linkedin_firm + ' (firm profile) or "' + SOP.linkedin_rr + '" (registered representative)', severity: 'high', placement: 'the About section' });
        break;
      case 'article':
        A.push({ id: 'A1r', name: 'Article, newsletter and educational content disclaimer', citation: 'SOP 9', scope: 'document', threshold: 80, match: [SOP.article_core], text: SOP.article, severity: 'high', placement: 'the end of the article' });
        if (lane === 'institutional') A.push(legend);
        break;
      case 'website':
        A.push({ id: 'A1w', name: 'General blog / website disclosure', citation: 'SOP 12', scope: 'document', threshold: 80, match: [SOP.blog_core, SOP.article_core], text: SOP.blog + ' ' + SOP.bd_line_alt + '.', severity: 'high', placement: 'the page footer' });
        if (lane === 'institutional') A.push(legend);
        break;
      default:
        A.push(finalis);
        if (lane === 'institutional') A.push(legend); else A.push(forbiddenLegend);
    }
    return A;
  }

  /* Coverage facts: verbatim SOP texts searched anywhere in the material (fuzzy). */
  const COVERAGE = [
    { key: 'forecast', label: 'SOP forecast disclaimer', match: [SOP.forecast, 'Such projections may not be realized'], threshold: 82 },
    { key: 'illustration', label: 'SOP illustration disclaimer', match: [SOP.illustration, 'This is an illustration only and is not intended to forecast the performance'], threshold: 82 },
    { key: 'past_perf', label: 'SOP past performance line', match: [SOP.past_perf, 'Past performance is not indicative of future results', 'past performance is no guarantee of future results'], threshold: 84 },
    { key: 'pref', label: 'SOP preferred return disclosure', match: [SOP.pref, 'Preferred returns are part of the deal structure'], threshold: 82 },
    { key: 'distributions', label: 'SOP distributions line', match: [SOP.distributions], threshold: 84 },
    { key: 'logos', label: 'Logo disclosure', match: [SOP.logos, SOP.logos_alt, 'displayed for illustrative purposes'], threshold: 84 },
    { key: 'testimonial', label: 'Testimonial legend', match: [SOP.testimonial, 'may not be representative of the experience of other customers'], threshold: 82 },
    { key: 'real_estate', label: 'Private offering illiquidity line', match: [SOP.real_estate, 'illiquid and speculative'], threshold: 82 },
    { key: 'bd_line', label: 'Broker-dealer line', match: [SOP.bd_line, SOP.bd_line_alt], threshold: 86 },
    { key: 'unaffiliated', label: 'Separate, unaffiliated entities', match: [SOP.unaffiliated], threshold: 84 },
    { key: 'legend', label: 'Institutional legend', match: [SOP.legend, SOP.legend_alt], threshold: 86 },
    { key: 'forward_generic', label: 'Forward-looking statements language (any wording)', match: ['forward-looking statements', 'forward looking statements', 'projections may not be realized', 'no assurance that any targeted return', 'there can be no assurance'], threshold: 88 },
    { key: 'risk_generic', label: 'Risk of loss language (any wording)', match: ['may lose part or all of your investment', 'loss of their entire investment', 'you must be able to sustain a full loss', 'involves substantial investment risks', 'risk factors'], threshold: 88 },
    { key: 'illustrative_generic', label: '"For illustrative purposes only" legend', match: ['for illustrative purposes only'], threshold: 90 },
    { key: 'source_generic', label: 'A "Source:" line', match: ['source:', 'sources:'], threshold: 95 },
  ];

  /* Tier B trigger candidates (regex on the page text). The model decides; these are hints. */
  const TRIGGERS = [
    { id: 'B1', name: 'Forecast, forward-looking statement or projection', re: /\b(IRR|MOIC|TVPI|DPI|projected|projections?|forecast(?:ed)?|forward[- ]looking|expected (?:revenue|returns?|sales|growth)|target(?:ed)? (?:returns?|IRR|MOIC|TVPI)|waterfall|pro ?forma|run[- ]rate|will reach|expects to reach)\b/gi },
    { id: 'B2', name: 'Projection chart or illustration', re: /\b(projected|projections?|forecast|hypothetical|illustrative|scenario|base case)\b/gi, needsImages: 1 },
    { id: 'B3', name: 'Past or present performance', re: /\b(track record|prior fund|past fund|fund [IVX]+\b|realized (?:returns?|gains?)|historical (?:returns?|performance)|net (?:IRR|return)|gross IRR|since inception|vintage|exited|our returns|audited)\b/gi },
    { id: 'B4', name: 'Preferred return', re: /\b(pref(?:erred)? returns?|preferred equity|pref rate|\d+% pref\b|preferred distributions?|hurdle)\b/gi },
    { id: 'B5', name: 'Distributions', re: /\b(distributions? (?:of|yield|rate)|monthly distributions?|quarterly distributions?|paid distributions?|distribution history|cash distributions?|are paid quarterly|are paid monthly)\b/gi },
    { id: 'B6', name: 'Corporate logos', re: /\b(strategic partners?|our (?:partners|clients|investors)|backed by|trusted by|portfolio companies|as seen in|selected (?:clients|investors)|service providers?|co-?investors|notable (?:investors|clients)|prior work|customers)\b/gi, needsImages: 3 },
    { id: 'B7', name: 'Testimonial or endorsement', re: /\b(testimonial|endorse(?:d|ment)?|what our (?:clients|investors) say|client (?:quote|story))\b/gi },
    { id: 'B8', name: 'Award, ranking or recognition', re: /\b(awards?|awarded|ranked|ranking|top \d+|top quartile|best (?:of|in|performance)|recognized by|winner|named (?:one of|the)|verified)\b/gi },
    { id: 'B9', name: 'Real-estate private offering', re: /\b(real estate|multifamily|cap rate|NOI\b|square feet|sq\.? ?ft|property portfolio|rent roll)\b/gi, minPages: 2 },
    { id: 'B11', name: 'Social media call to action', re: /\b(comment below|send me a (?:direct message|dm)|reach out privately|dm me|message me|drop a comment)\b/gi },
    { id: 'A7', name: 'Statistical exhibit needing a source', re: /(\d[\d,.]*\s?%|\$\s?\d|\bCAGR\b|\d+(?:\.\d+)?x\b|\bmillion\b|\bbillion\b|\bbn\b)/gi, density: 8 },
  ];

  /* Tier C lexicon (Language Guide 2(a), 2(h), 3(b), 3(e), 3(f), 3(g)). Hints for the model. */
  const LEXICON = [
    { id: 'C1', name: 'Superlative or absolute', terms: ['best in class', 'best-in-class', 'world class', 'world-class', 'industry leading', 'industry-leading', 'market leading', 'market-leading', 'unmatched', 'unparalleled', 'unsurpassed', 'exceptional', 'superior', 'premium', 'unique', 'the best', 'proven', 'guaranteed', 'guarantee', 'first ever', 'the first in', 'number 1', 'number one', '#1', 'top tier', 'top-tier', 'cutting edge', 'cutting-edge', 'state of the art', 'state-of-the-art', 'de-risk', 'de-risked', 'risk free', 'risk-free', 'explosive growth', 'massive', 'revolutionary', 'game changing', 'game-changing', 'pioneers', 'pioneer', 'leading', 'largest', 'fastest-growing', 'fastest growing', 'only platform', 'investor of choice', 'best performers'] },
    { id: 'C2', name: 'Promissory language', terms: ['will deliver', 'will achieve', 'will generate', 'will double', 'will triple', 'guarantees', 'always delivers', 'mitigates the risk', 'eliminates the risk', 'downside protection', 'principal protected', 'certainly', 'historic buying opportunity', 'to achieve', 'to deliver', 'designed to deliver', 'on track to', 'expected to return', 'will return', 'no downside', "can't miss", 'cannot miss'] },
    { id: 'C3', name: 'Fear, urgency or pressure', terms: ['invest now', "don't miss", 'do not miss', 'act now', 'limited time', 'closing soon', 'last chance', 'only one of its kind', 'there are no other investments like this', 'sleep at night', "you don't want to lose out", 'minimum investment requirements are being waived', 'fewer worries', 'limited allocation'] },
    { id: 'C4', name: 'Figure or market claim to substantiate', terms: ['trillion', 'trillions', 'billions of dollars', 'market size', 'total addressable market', 'addressable market', 'market share', 'growing at', 'cagr', 'expected to grow', 'projected to grow', 'fastest-growing', 'fastest growing', 'never lost', 'has never', 'every single year', 'in every rate environment', 'core holding'] },
    { id: 'C6', name: 'Comparison', terms: ['compared to competitors', 'versus our peers', 'outperform', 'outperforms', 'outperformed', 'unlike other funds', 'better than', 'beats the market', 'than our peers', 'than our vc/pe peers', 'vs. peers', 'peer group'] },
    { id: 'C5', name: 'Disparagement', terms: ['crowded with investor fraud', 'unscrupulous', 'broken industry', 'legacy players fail', 'incumbents cannot', 'fraudsters'] },
    { id: 'C7', name: 'Legal or disciplinary history', terms: ['litigation', 'lawsuit', 'settlement with', 'arbitration', 'judgment against', 'bankruptcy', 'regulatory action', 'chapter 11'] },
  ];

  const CATEGORY_NAMES = {
    A1a: 'Finalis disclaimer', A1b: 'Broker-dealer line', A1e: 'Email disclaimer', A1p: 'Post disclosure', A1l: 'Profile disclosure', A1r: 'Article disclaimer', A1w: 'Website disclosure', A2: 'Separate entities line', A3: 'Institutional legend', A4: 'Legend on retail material', A5: 'General disclosure', A6: 'Legibility', A7: 'Source on statistics',
    B1: 'Forecast disclosure', B2: 'Illustration disclosure', B3: 'Past performance disclosure', B4: 'Preferred return disclosure', B5: 'Distributions disclosure', B6: 'Logo disclosure', B7: 'Testimonial legend', B8: 'Award disclosure', B9: 'Illiquidity disclosure', B10: 'Audience check', B11: 'Social media interaction', B12: 'Email disclaimer', B13: 'Article disclaimer',
    C1: 'Superlative or absolute', C2: 'Promissory language', C3: 'Fear or urgency', C4: 'Substantiation', C5: 'Disparagement', C6: 'Comparison', C7: 'Legal history', C8: 'Cherry-picked performance', C9: 'Misleading impression', C10: 'Third-party material', C11: 'Promissory image', C12: 'Complexity (retail)', C13: 'Emphasis (retail)', C14: 'Font size (retail)', C15: 'Projected returns (retail)', C16: 'Distribution rate', C17: 'Issuer forecast basis', C18: 'Risks in a separate document', C19: 'Target basis',
  };

  const RULEBOOK = `You are the pre-review engine of a FINRA member broker-dealer's compliance desk. A banker is about to submit a marketing communication (MMAT) for supervision. You read the whole material first, then produce the attention points a senior compliance reviewer would actually send to the banker, and nothing else. The reviewer decides; you prepare. False positives cost the desk more than misses: every point you raise is read by a human who has already told us which flags waste their time (the calibration rules below encode their verdicts).

## Standards you apply
FINRA Rule 2210: communications must be fair, balanced and not misleading; no exaggerated, unwarranted, promissory or unsubstantiated claims; projections presented as targets or assumptions with basis and context, never as expected outcomes. The firm's SOP prescribes verbatim disclosure texts (Tier A required blocks, Tier B disclosures triggered by content). The firm's language guide covers superlatives, promissory wording, fear/urgency, disparagement, comparisons, legal history, substantiation, cherry-picked performance. The interim institutional framework (MMAT Review Framework v4) says: for institutional-only material the core standard applies, but retail-only formats do not (testimonial legends, comparison disclosure format, formatting/emphasis and complexity are NOT standard items); the reviewer should be lighter, escalate close calls rather than invent new interpretations, and never ask for new slides.

## Public standards (anchors for citations)
- FINRA Rule 2210(d)(1): (A) fair dealing and good faith, a sound basis for evaluating the facts, no omission of a material fact that makes the communication misleading; (B) no false, exaggerated, unwarranted, promissory or misleading statement or claim; (D) balanced treatment of risks and potential benefits; (E) consider the nature of the audience; (F) no prediction or projection of performance, no implication that past performance will recur, no exaggerated or unwarranted claim, with exceptions only for hypothetical illustrations of mathematical principles, Rule 2214 investment analysis tools and research price targets. 2210(d)(2): a comparison must disclose all material differences (objectives, costs, liquidity, safety, guarantees, fluctuation of principal, tax features). 2210(d)(6): testimonial legends and the paid-testimonial disclosure.
- 2210(a)(3)/(a)(4)/(a)(5): institutional communication = distributed only to institutional investors (banks, insurers, registered investment companies, RIAs, persons with total assets of at least $50 million, governmental entities, plans with at least 100 participants, members and their registered persons, and persons acting solely on their behalf); a communication is NOT institutional when the member has reason to believe it will be forwarded or made available to any retail investor; retail communication = more than 25 retail investors within 30 days.
- FINRA Regulatory Notice 20-21 (private placement retail communications): retail communications about a private placement may not project or predict returns to investors (yields, income, distributions, capital appreciation percentages, IRR for new or blind-pool programs); IRR is acceptable for a completed program, for the actual performance of a specific realized holding, or when calculated consistently with GIPS together with the GIPS metrics; reasonable forecasts of issuer operating metrics (sales, revenue, customers) are acceptable when the key assumptions and the key risks are explained, the period generally does not exceed five years, and growth and margins are commensurate with the business, but forecast data may not be turned into projected investor returns; a distribution rate may not be called a yield, its components (operations, return of capital, borrowings) must be disclosed, and no annualized rate before two consecutive full quarters at that rate; risk disclosure in a separate document (a PPM) does not substitute for risks in the communication; a member is liable for third-party sales literature it distributes.
- SR-FINRA-2026-004 (filed February 2026; SEC decision pending, extended to 23 October 2026): would permit projections and targeted returns subject to written policies on audience relevance, a reasonable basis kept on record, and disclosure of the criteria and assumptions (including whether net of fees and expenses) and of the risks and limitations (why actual results may differ). Not in force: treat these elements as what a well-framed target should carry, not as a permission.

## Lanes
- retail: the audience includes natural persons, or more than 25 retail investors in 30 days, or the channel is public (LinkedIn, website, any channel where the audience cannot be controlled). Full SOP checklist applies.
- institutional: institutional investors only, controlled distribution, and no reason to believe the material will be forwarded or made available to a retail investor (otherwise retail). Lighter review. Required blocks for deal-related institutional material: the Finalis disclaimer with the broker-dealer line (one block) and the legend "For institutional investors only" on the first page. Do NOT ask for the separate "[Firm] and Finalis Securities LLC are separate, unaffiliated entities" line on deal-related material (that line belongs to non-deal firm marketing, articles and LinkedIn). Do NOT ask for the broker-dealer line separately when the Finalis disclaimer is requested: it is part of it.
- Material prepared by a third party (issuer or company, not the banker): the Finalis disclaimer may go in the transmittal email instead, which must then also state that some or all of the attached material was prepared by a third party.

## Tier A (required blocks) — computed deterministically before you run; results are given to you as facts. Do not re-detect or repeat them. You may add ONE point about placement or legibility if the facts say a block is present but set below 7 pt or hidden.

## Tier B (disclosures triggered by content). Verbatim texts from the SOP:
- B1 forecasts, forward-looking statements, projections (expected revenues, IRR/MOIC/TVPI targets, "will reach"): "${SOP.forecast}"
- B2 projection charts or illustrations, placed near the chart: "${SOP.illustration}"
- B3 historical or present performance data (fund track record charts, realized returns): "${SOP.past_perf}" (bold and standalone)
- B4 preferred returns, on each page carrying the number: "${SOP.pref}"
- B5 past distributions: "${SOP.distributions}" plus disclosure of the components of the distribution rate.
- B6 corporate logos of OTHER entities shown as strategic partners, potential investors, clients or service providers, on the page where they appear: "${SOP.logos}" (or "${SOP.logos_alt}")
- B7 testimonials or endorsements (retail legend; institutional: only if misleading about typical results): "${SOP.testimonial}" plus "${SOP.testimonial_paid}" when the person was paid over $100.
- B8 awards, rankings, recognitions: if not already in the material, disclose the awarding organization and its role in the selection, the criteria, the period covered, and whether fees were paid for participation, consideration or receipt.
- B9 real-estate private offerings (the offering itself is real estate): "${SOP.real_estate}"
- B10 audience mismatch: the questionnaire says one audience and the material explicitly addresses another (a retail deck carrying the institutional legend; an institutional-only deck stating terms for individual investors). Never infer audience from risk-disclosure wording such as "you may lose your investment".
- B11 LinkedIn calls to action ("comment below", "DM me"): "${SOP.linkedin_cta}"
- B12 email about an offering (only when the material under review is itself an email; never for the transmittal email of a deck): "${SOP.email_short}"
- B13 articles, newsletters, educational content: the SOP section 9 disclaimer (information and educational purposes only; not tax, legal or investment advice; views are the author's; broker-dealer line; separate, unaffiliated entities).
- A7 statistics: every page carrying a chart, graph or statistical exhibit must cite a source ("${SOP.source}" or the original source).

## Tier C (language and content, judgement). Categories: C1 superlatives and absolutes (best, only, leading, pioneers, proven, unique, unmatched, world-class, guaranteed); C2 promissory outcomes (will deliver/achieve/generate, guarantees, mitigates or eliminates the risk, principal protected, downside protection stated as fact); C3 fear, urgency, pressure; C4 unsubstantiated factual claims (statistics, rankings, market figures stated as fact with no source; self-endorsements); C5 disparagement of competitors, industry or regulators; C6 comparisons to other funds, investments or firms stated as fact without basis; C7 legal or disciplinary history presented incompletely; C8 cherry-picked performance (some realized holdings shown, not all); C9 material omission or misleading overall impression (upside discussed with no risks, assumptions or conflicts anywhere in the material); C10 third-party material distorted or unattributed; C11 promissory images (money trees, gold, yachts, luxury). C15 projected investor returns in a retail private-placement communication (IRR, TVPI, MOIC, target return, yield, distribution rate for a new or blind-pool program) — high, action remove or escalate, unless one of the RN 20-21 exceptions applies; C16 distribution rate presented as a yield, without its components, or annualized before two consecutive full quarters (retail); C17 issuer operating forecast without its key assumptions and key risks, beyond five years, or converted into investor returns (retail high; institutional low, confirm); C18 risks only in a separate document (retail: the communication itself must carry the key risks); C19 targeted return or projection on institutional material without the criteria, assumptions, fee treatment and reasons results may differ, anywhere in the material (low, confirm; never raised when a disclaimers page or footnotes cover these elements). Retail-only categories: C12 complexity for a retail reader, C13 indiscriminate bolding or underlining, C14 font size.

## CALIBRATION RULES (the reviewer's verdicts on earlier machine output; they override your instincts)
1. Read the whole material before flagging anything. Build the coverage map first: which disclaimer pages, risk-factor pages, footnotes, legends ("FOR ILLUSTRATIVE PURPOSES ONLY", "Sources: ...", "Company provided", "see Disclaimers on page N") exist and what they cover.
2. Never flag wording that sits on a disclaimers page or a risk-factors page, and never ask to change those pages except as the recommended place to add a missing disclosure.
3. A document-level disclosure (B1, B2, B3, B9) is NOT raised when the material already carries an equivalent disclosure anywhere: a disclaimers page saying projections are forward-looking and may not be realized covers every projection slide, especially when slide footnotes cross-reference it; "Past performance is not indicative of future results" covers B3 (if it is not bold and standalone, at most one low-severity note). Only raise the disclosure when the wording is absent or plainly deficient, and then recommend adding it to the existing disclaimers page rather than to each slide. This coverage logic applies to B1, B2, B3 and B9 only. B4 (preferred return), B5 (distributions), B6 (logos), B7 (testimonials) and B8 (awards) are item-specific disclosures: they are covered only by their own SOP wording or by an equivalent that addresses the specific item (for B4: that the preferred return is not guaranteed and is not a projection). The desk accepts the SOP preferred-return text on the disclaimers page when the terms page points to it (reviewer verdict on the calibration deck: "add to the disclaimers page"); B6 must sit on the page where the logos appear. A general "targets are not guaranteed" or forward-looking line, a risk-of-loss line, or a cross-reference to a disclaimers page that does not carry the item-specific text does not cover them: then raise the item-specific disclosure for the page that carries the number, the logos, the testimonial or the award.
4. Institutional lane: no formatting or emphasis points, no complexity points, no "add risk language to this page" points when the material has a risk-factors section. Fair-and-balanced is judged once at document level.
5. A7 fires only for an actual chart, graph, table of figures or statistical exhibit AND no source on that page. Team bios, fund terms tables, value statements, logos and text slides are not statistical exhibits. A footnote such as "Company provided and/or Sponsor projected based on its analysis", "Sources: ...", audited-statement references, or a benchmark citation counts as a source. A chart drawn as vector shapes leaves no image object, so judge by the text: a page whose title names a chart, schedule, timeline, bridge, breakdown, track record, deployment or projection, or whose text is a series of periods or categories paired with values (years with amounts, segments with percentages), IS a statistical exhibit; the deterministic facts mark such pages EXHIBIT. A7 asks for a source line on that page, not for a disclaimer, and it is raised even when the exhibit's projections are covered by the disclaimers page (B1 coverage does not supply a source). An illustrative legend ("FOR ILLUSTRATIVE PURPOSES ONLY") is not a source either: a chart that plots values or stages under that legend with no source line still gets A7, at medium severity, with "${SOP.source}" as the text to add (reviewer verdict on the calibration deck, page 16).
6. B6 (logos) fires for logos of service providers, strategic partners, potential investors or clients presented as relationships of the issuer. It does not fire for team photos, education or prior-employer logos in bios, values icons, or logos inside a list of the fund's own portfolio or target portfolio companies and their investors or clients.
7. B8 (awards) is not raised when the awarding body, criteria or period are already disclosed in a footnote; a benchmark statement with its source footnoted is not an award. Rule 9(b) is a language rule: it stops C1/C4 flags on the award's name, it never stops the B8 disclosure. An award, ranking or "winner" line with no footnote giving the awarding organization, its role in the selection, the criteria, the period and whether fees were paid is a B8 point (medium on institutional material).
8. B10 never fires on risk language. It fires only on explicit audience statements that contradict the questionnaire, and then at low severity: "confirm the audience".
9. Language: do NOT flag (a) opinions and aspirations: "we believe", "we strive", "aim", "seek", "designed to", "mission", "has the potential to", "target", "projected" when the target or projection is labelled and the material carries the forward-looking disclosure; (b) award or ranking names quoted as received (as language: the B8 disclosure still applies, see rule 7); (c) a person's biography and experience (years, AUM, exits, ventures reviewed, deal counts); (d) a claim sourced on the same page or backed by a footnote with criteria; (e) figures explicitly labelled illustrative, base case, key target metrics or potential; (f) a labelled "Past Fund" shown next to the current fund (not a comparison problem); (g) "largest", "leading" used descriptively about third parties the team worked with; (h) third-party data with sources cited; (i) a fund-level track record that shows every prior fund with an audited source and net-of-fees basis (C8 cherry-picking fires only when the material itself shows a selection: "selected investments" with returns, "representative deals", some holdings with returns while the full list is elsewhere).
10. DO flag: (a) unqualified superlatives or characterizations about the firm, team or deal stated as fact without source ("pioneers", "best-in-class", "proven", "only platform", "investor of choice"); (b) specific market or industry figures stated as fact with no source on that page, even if another page cites sources (calibration deck, page 6: "positioned to benefit from the trillions of dollars being poured into foundational AI infrastructure" is a C4 point although page 15 cites Goldman Sachs; a figure inside a sentence that also carries "we believe" is still a figure, source it or soften it); (c) outcome statements phrased as certainty ("will deliver 22% IRR", "to achieve 4x") unless the same sentence labels them as targets; (d) comparisons to peers stated as fact ("lower valuation than our VC/PE peers"): case by case, ask for the basis; (e) growth or return claims about targets stated as fact ("opportunities that offer attractive long-term growth potential").
11. Never request new slides or new material. Ask to qualify, source, soften, remove, or add a specific disclosure text.
12. Group repeated occurrences of the same issue into one finding listing the pages. Prefer fewer, sharper findings. On institutional material a clean deck yields 3 to 8 findings; a deck without a disclaimers page yields more.
13. Close calls (a projection framing, a possibly misleading omission, a new interpretation of 2210) get action "escalate" rather than an assertion.
14. Every finding quotes ONE exact passage from its main page (verbatim, at most 200 characters, no page prefixes, no " | " or "..." joining several passages) so the highlighter can find it; when the same issue recurs on other pages, list them in "pages" and keep the quote from the main page only. A missing-block finding quotes nothing.
15. C15 to C19 follow the lane strictly: on institutional material a labelled target or projection whose basis, assumptions and risks are covered by a disclaimers page or footnotes is not raised (see rules 3 and 9(e)); on retail private-placement material a projected investor return is raised once, at document level, listing the pages, with the RN 20-21 exceptions checked before raising.`;

  const PROFILE_SCHEMA = `Reply with ONLY one JSON object, no prose:
{
 "material_kind": "short description (e.g. fund pitch deck, company teaser, CIM, newsletter, LinkedIn post)",
 "subject": "what is being marketed, one line",
 "lane": "institutional" | "retail",
 "lane_basis": "one sentence: the questionnaire answer and any explicit audience statement in the material",
 "deal_related": true | false,
 "page_roles": { "<page>": "cover | toc | disclaimers | risk factors | section divider | team | performance | terms | contact | market | strategy | portfolio | other (short)" },
 "coverage": {
   "forward_looking": { "covered": true|false, "where": "page(s) and wording", "quote": "verbatim, max 160 chars" },
   "past_performance": { "covered": ..., "where": ..., "quote": ... },
   "risk_of_loss": { ... }, "targets_not_guaranteed": { ... }, "illiquidity": { ... },
   "third_party_sources": { "covered": ..., "where": "pages that cite sources", "quote": ... },
   "preferred_return": { ... }, "logos": { ... }, "awards": { ... }, "finalis_bd": { ... }
 },
 "sources_on_pages": { "<page>": "what the footnote or source line says (short)" },
 "audience_signals": ["explicit audience statements with page, or empty"],
 "third_party_prepared": true | false | null,
 "notes": ["anything the findings pass must know, e.g. footnotes that cross-reference the disclaimers page"]
}`;

  const FINDINGS_SCHEMA = `Reply with ONLY one JSON object, no prose, in this shape:
{
 "findings": [
  {
   "rule": "B4",                      // one of A6 A7 B1..B13 C1..C19
   "severity": "high" | "medium" | "low",
   "page": 27,                        // main page; null for document-level
   "pages": [27],                     // every page concerned
   "quote": "ONE verbatim passage from the main page, max 200 chars (never several passages joined), or empty",
   "title": "short reviewer-facing title (max 70 chars)",
   "issue": "what is wrong and why it matters under the rule, 1-2 sentences",
   "text_to_add": "the verbatim disclosure text to add, or empty",
   "rewrite": "a suggested rewrite of the quoted text, or empty",
   "action": "add" | "rewrite" | "source" | "remove" | "confirm" | "escalate",
   "placement": "where to add it (e.g. Disclaimers page 3), or empty",
   "confidence": "high" | "medium" | "low",
   "basis": "which rule, framework line or calibration rule supports raising this (short)"
  }
 ],
 "suppressed": [
  { "rule": "B1", "pages": [9, 25], "quote": "short", "reason": "why a reviewer would not raise it (cite the coverage)" }
 ],
 "gut_check": {
  "inaccurate_picture": { "flag": true|false, "why": "one sentence" },
  "unsupported_claims": { "flag": true|false, "why": "one sentence" },
  "promised_results": { "flag": true|false, "why": "one sentence" }
 },
 "brief": "6-10 lines for the compliance reviewer: what the material is, the lane, what is already covered, the points that matter, what to escalate. Plain text, no markdown.",
 "banker_message": "the comment to send the banker in the desk's tone (\\"Hello [Banker Name], hope you're doing well. Could you please...\\"), listing the required additions with the verbatim texts and the wording changes. Plain text."
}
Order findings: Tier A/B before C, then severity high to low, then page. Keep the suppressed list to the candidates a naive scanner would have raised (max 20 entries).`;

  return { SOP, requiredBlocks, COVERAGE, TRIGGERS, LEXICON, CATEGORY_NAMES, RULEBOOK, PROFILE_SCHEMA, FINDINGS_SCHEMA };
})();
