#!/usr/bin/env python3
"""Synthetic simulation corpus: seven marketing communications with planted issues and planted clean
elements, plus the ground truth for each (what a reviewer would raise, what a naive scanner would wrongly
raise). PDFs are printed from HTML with Chromium (real text layer, real fonts), the post, the email and
the article are text. Run: python3 sim/corpus.py  -> sim/corpus/*.pdf|txt + sim/corpus/truth.json
"""
import asyncio
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "corpus")
os.makedirs(OUT, exist_ok=True)

FINALIS = ('The reader agrees to the provisions set forth on those certain "Disclaimers" located at https://www.finalis.com/disclaimers '
           'and the terms thereof are incorporated by reference as though fully set forth herein, and references therein to (i) "Company" '
           'means the entity in connection with this transaction (together with its affiliates, subsidiaries, successors and assigns), '
           '(ii) "Banker" means the registered representative of Finalis Securities LLC in connection with this transaction and (iii) "Bank" '
           'means Northbridge Advisors. Securities are offered through Finalis Securities, LLC member FINRA/SIPC.')

CSS = """
<style>
@page { size: 13.333in 7.5in; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Helvetica, Arial, sans-serif; color: #1f2937; }
.slide { width: 13.333in; height: 7.5in; padding: 0.7in 0.8in 0.6in; page-break-after: always; position: relative; background: #fff; }
.slide:last-child { page-break-after: auto; }
h1 { font-size: 30pt; margin: 0 0 14pt; color: #12306b; }
h2 { font-size: 20pt; margin: 0 0 10pt; color: #12306b; }
p, li { font-size: 12.5pt; line-height: 1.45; }
.small { font-size: 8.5pt; color: #4b5563; line-height: 1.35; }
.tiny { font-size: 7pt; color: #6b7280; }
.foot { position: absolute; left: 0.8in; right: 0.8in; bottom: 0.35in; font-size: 8pt; color: #6b7280; display: flex; justify-content: space-between; }
.cols { display: flex; gap: 0.4in; }
.col { flex: 1; }
table { border-collapse: collapse; width: 100%; font-size: 11pt; }
td, th { border: 1px solid #d1d5db; padding: 5pt 8pt; text-align: left; }
th { background: #eef2f7; }
.logos { display: flex; gap: 0.35in; flex-wrap: wrap; margin-top: 10pt; }
img.logo { height: 0.5in; width: auto; display: block; }
.big { font-size: 26pt; font-weight: 700; color: #12306b; }
.bar { display: flex; align-items: flex-end; gap: 14pt; height: 2.2in; margin: 14pt 0; }
.bar div { width: 0.6in; background: #3b6cf4; color: #fff; font-size: 9pt; text-align: center; padding-top: 4pt; }
.cover { background: #12306b; color: #fff; }
.cover h1, .cover h2 { color: #fff; }
.cover .small { color: #cbd5e1; }
.quote { font-style: italic; font-size: 15pt; color: #1e3a8a; border-left: 4px solid #3b6cf4; padding-left: 12pt; }
</style>
"""


import base64
import io
import re


def logo_png(name):
    """A logo as a real image (PNG, data URI): the name set in a bordered box, the way a corporate logo lands in
    a deck. The text lives in the pixels only, so the text layer carries no company name, exactly as with real logos."""
    from PIL import Image, ImageDraw, ImageFont
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 34)
    except Exception:  # noqa: BLE001
        font = ImageFont.load_default()
    tmp = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    box = tmp.textbbox((0, 0), name, font=font)
    w, h = box[2] - box[0] + 64, box[3] - box[1] + 44
    img = Image.new("RGB", (w, h), (248, 250, 252))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w - 1, h - 1], outline=(203, 213, 225), width=2)
    hue = sum(ord(c) for c in name) % 3
    color = [(30, 58, 138), (51, 65, 85), (127, 29, 29)][hue]
    d.text((32 - box[0], 22 - box[1]), name, font=font, fill=color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def slide(inner, foot_left="CONFIDENTIAL", num=None, cls=""):
    inner = re.sub(r'<span class="logo">(.*?)</span>', lambda m: '<img class="logo" src="%s" alt="">' % logo_png(m.group(1)), inner)
    return '<div class="slide %s">%s<div class="foot"><span>%s</span><span>%s</span></div></div>' % (cls, inner, foot_left, "" if num is None else num)


# ----------------------------------------------------------------------------- S1 clean institutional deck
def s1():
    s = []
    s.append(slide('<h1>Harbor Growth Fund III</h1><h2>Growth equity for European software companies</h2><p class="small">For Institutional Investors Only</p><p class="small">Presented by Northbridge Advisors · March 2026</p>', "For Institutional Investors Only", 1, "cover"))
    s.append(slide('<h2>Disclaimers</h2><p class="small">This presentation is furnished on a confidential basis to institutional investors for discussion purposes only and does not constitute an offer to sell or a solicitation of an offer to buy any security, which may be made only through the Fund\'s offering documents. All investments involve risk, including the possible loss of the entire amount invested. Interests in the Fund are illiquid and there is no secondary market.</p><p class="small">Certain statements in this presentation are forward-looking statements, including targeted returns and projections. Such projections may not be realized. They are based on assumptions that may prove wrong and are not guarantees of future performance. Past performance is not indicative of future results; the performance of Fund I and Fund II may not be repeated by Fund III.</p><p class="small">Preferred returns are part of the deal structure and indicate the sequence of how distributions (from operations or a capital event) are disbursed. They are not guaranteed and should not be considered a financial projection. Actual cash flow projections and distributions from the sponsor may differ from the preferred return.</p><p class="small">Corporate logos do not represent endorsements.</p><p class="small">%s</p>' % FINALIS, "For Institutional Investors Only", 2))
    s.append(slide('<h2>Executive summary</h2><ul><li>We believe European growth-stage software offers attractive risk-adjusted return potential over the fund term.</li><li>Fund III targets 15 to 20 investments of EUR 15 to 40 million in companies with EUR 10 million or more of ARR.</li><li>The team has worked together for nine years across Fund I and Fund II.</li><li>We seek board seats and information rights in every investment.</li></ul>', "For Institutional Investors Only", 3))
    s.append(slide('<h2>Investment team</h2><div class="cols"><div class="col"><p><b>Clara Voss</b>, Managing Partner<br>22 years in software investing; previously partner at a pan-European growth fund with EUR 2.1 billion of assets under management; 14 exits including two IPOs.</p></div><div class="col"><p><b>Tomás Reyes</b>, Partner<br>Former CFO of a listed SaaS company; 30+ transactions reviewed per year; MBA INSEAD.</p></div><div class="col"><p><b>Ines Duarte</b>, Principal<br>Eight years at a Big Four transaction services practice; 60+ due diligence engagements.</p></div></div>', "For Institutional Investors Only", 4))
    s.append(slide('<h2>Track record: Fund I and Fund II</h2><div class="bar"><div style="height:1.2in">Fund I<br>1.9x TVPI</div><div style="height:1.6in">Fund II<br>2.3x TVPI</div><div style="height:0.9in">Fund II DPI<br>0.8x</div></div><p class="small">Source: audited financial statements of Fund I (2014 to 2022) and Fund II (2018 vintage), as of 31 December 2025. Net of fees, expenses and carried interest. Past performance is not indicative of future results.</p>', "For Institutional Investors Only", 5))
    s.append(slide('<h2>Market</h2><p>European software companies raised EUR 34 billion of growth capital in 2025, a 12% increase on 2024.</p><p>We believe the mid-market remains under-served by growth investors relative to the United States.</p><p class="small">Source: PitchBook, European Venture Report Q4 2025; Northbridge analysis.</p>', "For Institutional Investors Only", 6))
    s.append(slide('<h2>Summary of terms</h2><table><tr><th>Target fund size</th><td>EUR 400 million (hard cap EUR 500 million)</td></tr><tr><th>Target return</th><td>2.5x net TVPI (a target, not a projection; see Disclaimers on page 2)</td></tr><tr><th>Preferred return</th><td>8% (see the preferred return disclosure on page 2)</td></tr><tr><th>Management fee</th><td>2% on commitments during the investment period</td></tr><tr><th>Carried interest</th><td>20% with full catch-up</td></tr><tr><th>Term</th><td>10 years plus two one-year extensions</td></tr></table>', "For Institutional Investors Only", 7))
    s.append(slide('<h2>Contact</h2><p>Northbridge Advisors · 40 Wall Street, New York, NY 10005 · investors@northbridge.example</p><p class="small">%s</p>' % FINALIS, "For Institutional Investors Only", 8))
    return "".join(s)


# ----------------------------------------------------------------------------- S2 institutional deck with gaps
def s2():
    s = []
    s.append(slide('<h1>Meridian Infrastructure Partners IV</h1><h2>The leading mid-market infrastructure platform in Europe</h2><p class="small">Winner, Infrastructure Investor Awards 2025: Emerging Manager of the Year</p><p class="small">Prepared by Northbridge Advisors · April 2026</p>', "CONFIDENTIAL", 1, "cover"))
    s.append(slide('<h2>Important information</h2><p class="small">This presentation is provided on a confidential basis for discussion purposes only and does not constitute an offer or a solicitation. Certain information contained herein constitutes forward-looking statements, including targeted returns and projected deployment; such statements are based on assumptions and are not guarantees; actual results may differ materially. Past performance is not indicative of future results. An investment in the Fund involves a high degree of risk, including the loss of the entire investment, and is illiquid.</p>', "CONFIDENTIAL", 2))
    s.append(slide('<h2>Strategy</h2><ul><li>Our proprietary sourcing engine delivers superior returns through off-market transactions.</li><li>Infrastructure assets attracted $1.2 trillion of capital in 2025, and the mid-market remains fragmented.</li><li>We focus on energy transition, digital infrastructure and transport with contracted or regulated cash flows.</li><li>We believe disciplined entry valuations are the main driver of returns in the asset class.</li></ul>', "CONFIDENTIAL", 3))
    s.append(slide('<h2>Team</h2><div class="cols"><div class="col"><p><b>Piet van der Berg</b>, Managing Partner<br>20+ years in infrastructure; $3 billion deployed across 27 assets; former head of European infrastructure at a global asset manager.</p></div><div class="col"><p><b>Amara Okafor</b>, Partner<br>15 years in project finance; led 40+ financings totalling $9 billion.</p></div><div class="col"><p><b>Luca Bianchi</b>, Partner<br>Former CEO of a regulated utility with 2,000 employees; 12 years of operating experience.</p></div></div>', "CONFIDENTIAL", 4))
    s.append(slide('<h2>Track record</h2><div class="bar"><div style="height:1.0in">Fund II<br>11.8% net IRR</div><div style="height:1.4in">Fund III<br>14.2% net IRR</div><div style="height:0.8in">Fund III DPI<br>0.6x</div></div><p class="small">Source: audited financial statements of Funds II and III as of 31 December 2025; net of fees, expenses and carried interest. Past performance is not indicative of future results.</p>', "CONFIDENTIAL", 5))
    s.append(slide('<h2>Selected portfolio investments</h2><div class="logos"><span class="logo">NordWind Offshore</span><span class="logo">FibreLink Iberia</span><span class="logo">Alpine Rail Freight</span><span class="logo">Solaris Storage</span><span class="logo">Portus Terminals</span></div><p class="small">Portfolio companies of Funds II and III. Not all investments are shown; a full list is available on request.</p>', "CONFIDENTIAL", 6))
    s.append(slide('<h2>Strategic partners and lenders</h2><p>We work with a group of relationship banks, advisers and co-investors:</p><div class="logos"><span class="logo">Deutsche Bank</span><span class="logo">ING</span><span class="logo">KPMG</span><span class="logo">Allianz Global Investors</span><span class="logo">Macquarie Capital</span><span class="logo">Clifford Chance</span></div>', "CONFIDENTIAL", 7))
    s.append(slide('<h2>Fund terms</h2><table><tr><th>Target fund size</th><td>EUR 1.5 billion</td></tr><tr><th>Target net IRR</th><td>12% to 14% (a target; see Important information on page 2)</td></tr><tr><th>Preferred return</th><td>8% compounded annually</td></tr><tr><th>Management fee</th><td>1.5% on commitments</td></tr><tr><th>Carried interest</th><td>20% over the preferred return</td></tr><tr><th>Term</th><td>12 years</td></tr></table>', "CONFIDENTIAL", 8))
    s.append(slide('<h2>Projected deployment schedule</h2><div class="bar"><div style="height:0.6in">2026<br>EUR 250m</div><div style="height:1.1in">2027<br>EUR 450m</div><div style="height:1.4in">2028<br>EUR 550m</div><div style="height:0.7in">2029<br>EUR 250m</div></div><p>Deployment of EUR 1.5 billion over four years, weighted to 2027 and 2028.</p>', "CONFIDENTIAL", 9))
    return "".join(s)


# ----------------------------------------------------------------------------- S3 retail real-estate offering
def s3():
    s = []
    s.append(slide('<h1>Lakeside Multifamily Income Fund</h1><h2>Projected 18% IRR · 8% preferred return · 7% annual yield paid monthly</h2><p class="small">A private real estate offering for accredited investors · Northbridge Advisors · May 2026</p>', "", 1, "cover"))
    s.append(slide('<h2>Why invest now</h2><ul><li>Invest now: limited allocation, closing June 30.</li><li>Guaranteed 8% preferred return to investors before the sponsor receives any profit.</li><li>This is a can\'t-miss opportunity to own institutional-quality apartments in the Sun Belt.</li><li>Minimum investment $50,000.</li></ul>', "", 2))
    s.append(slide('<h2>Property overview</h2><table><tr><th>Units</th><td>240 garden-style apartments, built 2004</td></tr><tr><th>Occupancy</th><td>94%</td></tr><tr><th>Net operating income</th><td>$4.2 million (trailing twelve months)</td></tr><tr><th>Purchase cap rate</th><td>6.1%</td></tr><tr><th>Business plan</th><td>Value-add renovation of 180 units, rent premium of $210 per unit</td></tr></table>', "", 3))
    s.append(slide('<h2>Five-year projections</h2><table><tr><th></th><th>Year 1</th><th>Year 2</th><th>Year 3</th><th>Year 4</th><th>Year 5</th></tr><tr><td>Cash yield</td><td>6.0%</td><td>7.0%</td><td>7.5%</td><td>8.0%</td><td>8.5%</td></tr><tr><td>Cumulative distributions</td><td>$60,000</td><td>$130,000</td><td>$205,000</td><td>$285,000</td><td>$370,000</td></tr><tr><td>Exit at 5.0% cap rate</td><td></td><td></td><td></td><td></td><td>$1,740,000</td></tr></table><p class="big">Projected equity multiple 2.1x · projected IRR 18%</p>', "", 4))
    s.append(slide('<h2>What investors say</h2><p class="quote">"Best sponsor I have ever worked with. My returns beat the market every single year." J.R., investor since 2019</p><p class="quote">"They take care of everything so I can sleep at night." M.K., investor since 2021</p>', "", 5))
    s.append(slide('<h2>Distributions</h2><p class="big">7% annualized distribution yield, paid monthly since inception</p><p>Distributions have been paid every month since the first closing in 2023. A portion of the distributions in 2023 and 2024 was funded from offering proceeds.</p>', "", 6))
    s.append(slide('<h2>Sponsor track record</h2><ul><li>Our sponsor has never lost investor capital across 14 completed deals.</li><li>Completed deals returned an average 21% IRR (Deals 3, 7 and 11).</li><li>Over $600 million of multifamily assets acquired since 2012.</li></ul>', "", 7))
    s.append(slide('<h2>Next steps</h2><p>Subscription documents are available in the investor portal. Risk factors are detailed in the private placement memorandum, available on request.</p><p>Northbridge Advisors · investors@northbridge.example</p>', "", 8))
    return "".join(s)


# ----------------------------------------------------------------------------- S4 institutional firm overview (non-deal)
def s4():
    s = []
    s.append(slide('<h1>Northbridge Advisors</h1><h2>Capabilities overview</h2><p class="small">For Institutional Use Only</p>', "For Institutional Use Only", 1, "cover"))
    s.append(slide('<h2>What we do</h2><ul><li>Sell-side and buy-side M&A advisory for software and healthcare companies with EUR 20 to 300 million of enterprise value.</li><li>Growth capital raises and secondary transactions.</li><li>Independent board advisory.</li></ul>', "For Institutional Use Only", 2))
    s.append(slide('<h2>Selected transactions</h2><p>Clients include:</p><div class="logos"><span class="logo">Helix Diagnostics</span><span class="logo">Cobalt Software</span><span class="logo">Meridian Infrastructure</span><span class="logo">Verity Health</span><span class="logo">Orion Payments</span></div><p class="small">Transactions completed by the Northbridge team since 2019.</p>', "For Institutional Use Only", 3))
    s.append(slide('<h2>Team</h2><p><b>Jane Doe</b>, Managing Director: 18 years in investment banking, 45 closed transactions.<br><b>Omar Haddad</b>, Director: former software founder, 11 years in advisory.</p>', "For Institutional Use Only", 4))
    s.append(slide('<h2>Contact</h2><p>Northbridge Advisors · 40 Wall Street, New York, NY 10005</p><p class="small">Securities offered through Finalis Securities LLC Member FINRA/SIPC.</p>', "For Institutional Use Only", 5))
    return "".join(s)


S5_POST = ("Proud to share that Northbridge Advisors was ranked #3 in the Mid-Market Advisor League Table 2026 by MergerLink. "
           "Thank you to our clients and our team.\n\nWe are currently raising for an exciting healthcare opportunity: a profitable diagnostics "
           "company with 40% revenue growth. DM me for the teaser, or comment below and I will reach out.\n\n#MandA #healthcare #growth")

S6_EMAIL = ("Subject: Harbor Growth Fund III: first close in June\n\nDear investor,\n\nWe are pleased to share the Harbor Growth Fund III opportunity. "
            "Fund III will deliver 2.5x net to limited partners over the fund term, building on the 2.3x TVPI of Fund II. "
            "The first close is expected in June with EUR 250 million of commitments.\n\nThe full presentation is attached. Please let me know if you would like a call with the team.\n\n"
            "Best regards,\nJane Doe\nManaging Director, Northbridge Advisors\n\nSecurities offered through Finalis Securities LLC Member FINRA/SIPC.")

S7_ARTICLE = ("Why private credit outperforms bonds in a rising-rate world\n\nBy Jane Doe, Northbridge Advisors\n\n"
              "Private credit has become the fastest-growing corner of fixed income. Direct lending funds returned 11.4% in 2025 against 3.1% for the Bloomberg "
              "Aggregate, and private credit outperforms public bonds in every rate environment because floating-rate loans reprice with the market.\n\n"
              "Investors who allocate 10% of a portfolio to private credit can expect higher income with lower volatility. The asset class is now a core holding for "
              "pension funds and insurers, and the opportunity set for middle-market lenders keeps widening as banks retreat.\n\n"
              "Northbridge advises sponsors and lenders on private credit transactions across Europe.")

TRUTH = {
    "S1_inst_clean": {"file": "S1_inst_clean.pdf", "kind": "pdf", "docType": "deal-deck", "audience": "institutional", "distribution": ["Email", "Meeting (in person or virtual)"], "involvement": "banker", "bankName": "Northbridge Advisors",
                      "expected": [], "must_not": ["A1a", "A1b", "A2", "A3", "A7", "B1", "B2", "B3", "B4", "B6", "B8", "B9", "C13", "C12", "C9"], "note": "Clean institutional deck: every disclosure present, sources on every exhibit, team bios, 'we believe' statements. A reviewer would send nothing, or at most one low confirmation."},
    "S2_inst_gaps": {"file": "S2_inst_gaps.pdf", "kind": "pdf", "docType": "deal-deck", "audience": "institutional", "distribution": ["Email"], "involvement": "banker", "bankName": "Northbridge Advisors",
                     "expected": [{"rule": "A1a"}, {"rule": "A3"}, {"rule": "B8", "page": 1}, {"rule": "B6", "page": 7}, {"rule": "B4", "page": 8}, {"rule": "A7", "page": 9}, {"rule": "C1|C4", "page": 1, "quote": "leading mid-market"}, {"rule": "C1|C4|C2", "page": 3, "quote": "superior returns"}, {"rule": "C4", "page": 3, "quote": "1.2 trillion"}],
                     "must_not": ["B1", "B2", "B3", "B9", "C13", "C12", "A1b", "A2"], "must_not_pages": {"C4": [4], "C1": [4], "B6": [6]}, "note": "Institutional deck with gaps: no Finalis disclaimer, no legend, award without disclosure, third-party partner logos, preferred return without the disclosure, a chart without a source, two superlatives and an unsourced market figure. Clean elements: the issuer's own disclaimer page covers projections and past performance, bios, own-portfolio logos, sourced track record."},
    "S3_retail_projections": {"file": "S3_retail_projections.pdf", "kind": "pdf", "docType": "deal-deck", "audience": "retail", "distribution": ["Email", "Website"], "involvement": "banker", "bankName": "Northbridge Advisors",
                              "expected": [{"rule": "A1a"}, {"rule": "B1|B2|C15", "page": 4}, {"rule": "B4"}, {"rule": "B5|C16", "page": 6}, {"rule": "B7", "page": 5}, {"rule": "B9"}, {"rule": "C2", "quote": "guaranteed"}, {"rule": "C3", "page": 2}, {"rule": "C15|B1", "page": 1}, {"rule": "C18|C9", "page": 8}, {"rule": "C2|C1", "page": 7, "quote": "never lost"}, {"rule": "C6|C1|C4", "page": 5}],
                              "must_not": ["A3", "A2"], "note": "Retail private-placement real-estate deck: projected IRR and yield on the cover, guaranteed preferred return, urgency, testimonials without legend, distribution yield partly funded by offering proceeds, cherry-picked deals, risks only in the PPM, no Finalis disclaimer."},
    "S4_firm_mmr": {"file": "S4_firm_mmr.pdf", "kind": "pdf", "docType": "firm-marketing", "audience": "institutional", "distribution": ["Email"], "involvement": "banker", "bankName": "Northbridge Advisors",
                    "expected": [{"rule": "A2"}, {"rule": "B6", "page": 3}], "must_not": ["A1b", "A3", "A1a", "B1", "B3"], "note": "Institutional non-deal firm overview: legend and broker-dealer line present, the 'separate, unaffiliated entities' line missing, client logos without the logo disclosure."},
    "S5_linkedin": {"file": "S5_linkedin.txt", "kind": "text", "docType": "linkedin-post", "audience": "retail", "distribution": ["LinkedIn"], "involvement": "banker", "bankName": "Northbridge Advisors",
                    "expected": [{"rule": "B8"}, {"rule": "B11"}, {"rule": "A1p|B12|A5"}], "must_not": ["A3", "A1a"], "note": "LinkedIn post with a ranking, calls to action (DM me, comment below) and an investment opportunity."},
    "S6_email": {"file": "S6_email.txt", "kind": "text", "docType": "email", "audience": "institutional", "distribution": ["Email"], "involvement": "banker", "bankName": "Northbridge Advisors",
                 "expected": [{"rule": "A1e|B12"}, {"rule": "C2", "quote": "will deliver"}], "must_not": ["A1b"], "note": "Email about an offering with a promissory 'will deliver 2.5x' and only the broker-dealer line (the email disclaimer is missing)."},
    "S7_article": {"file": "S7_article.txt", "kind": "text", "docType": "article", "audience": "retail", "distribution": ["Website"], "involvement": "banker", "bankName": "Northbridge Advisors",
                   "expected": [{"rule": "A1r|B13"}, {"rule": "C6|C1|C4", "quote": "outperforms"}, {"rule": "C4|C2", "quote": "can expect"}], "must_not": ["A3"], "note": "Educational article without the section 9 disclaimer, a comparison stated as fact and an expected-return statement."},
}


async def main():
    from playwright.async_api import async_playwright
    decks = {"S1_inst_clean": s1(), "S2_inst_gaps": s2(), "S3_retail_projections": s3(), "S4_firm_mmr": s4()}
    texts = {"S5_linkedin": S5_POST, "S6_email": S6_EMAIL, "S7_article": S7_ARTICLE}
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page()
        for name, html in decks.items():
            await page.set_content("<!doctype html><html><head><meta charset='utf-8'>" + CSS + "</head><body>" + html + "</body></html>")
            await page.pdf(path=os.path.join(OUT, name + ".pdf"), width="13.333in", height="7.5in", print_background=True, margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})
            print("wrote", name + ".pdf")
        # text inputs also printed as one-page PDFs for the old engine, which only reads PDFs
        for name, text in texts.items():
            with open(os.path.join(OUT, name + ".txt"), "w", encoding="utf-8") as f:
                f.write(text)
            await page.set_content("<!doctype html><html><head><meta charset='utf-8'><style>body{font-family:Helvetica,Arial;font-size:12pt;padding:1in;white-space:pre-wrap}</style></head><body>" + text.replace("&", "&amp;").replace("<", "&lt;") + "</body></html>")
            await page.pdf(path=os.path.join(OUT, name + ".pdf"), format="Letter", print_background=True)
            print("wrote", name + ".txt and .pdf")
        await browser.close()
    with open(os.path.join(OUT, "truth.json"), "w", encoding="utf-8") as f:
        json.dump(TRUTH, f, indent=1)
    print("wrote truth.json")


if __name__ == "__main__":
    asyncio.run(main())
