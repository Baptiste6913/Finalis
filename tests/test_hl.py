import os, asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
QUOTES = [
 (1, 'Led by AI pioneers, technologists and seasoned operators'),
 (6, 'benefit from the trillions of dollars being poured into foundational AI infrastructure'),
 (6, 'We believe Vertical AI offers the best risk-adjusted return potential within the AI ecosystem.'),
 (17, 'Opportunities that offer attractive long-term growth potential in the US, Europe and Asia.'),
 (21, 'Investor of choice for many companies'),
 (21, 'Actively Monitor & Fortify Portfolio To Achieve 4x Plus Target Fund Returns'),
 (22, 'Investing at a lower valuation than our VC/PE peers allows for a return of capital'),
 (22, 'proven business models'),
 (27, 'Preferred Return 8%'),
 (27, '$100K for individual investors'),
 (9, '7.65x Projected TVPI'),
 (3, 'Past performance is not indicative of future results.'),
 (16, 'FOR ILLUSTRATIVE PURPOSES ONLY'),
 (23, "Funds’ Technology Stack & Service Providers"),
 (6, 'institutional-grade investment discipline to deliver strong risk-adjusted returns'),   # hyphen handling
 (15, 'We believe, they provide the best risk adjusted return within the AI ecosystem.'),
 (7, 'Former CRO of a private equity firm with $1B+ AUM'),
 (20, 'A mutual fit is critical to our ability to dramatically improve and grow our portfolio companies'),
]
async def main():
    async with async_playwright() as pw:
        browser, page = await open_page(pw, page_html='dist/prescreen.html')
        res = await page.evaluate("""async (quotes) => {
          const r = await fetch('/quartus.pdf'); const bytes = new Uint8Array(await r.arrayBuffer());
          const {pages} = await Extract.pdf(bytes);
          return quotes.map(([n, q]) => { const p = pages.find(x => x.number === n); const loc = Engine.locate(p, q); return { n, q: q.slice(0,50), found: !!loc, score: loc && loc.score, boxes: loc ? loc.boxes.length : 0, text: loc ? p.text.slice(loc.start, loc.end).replace(/\\n/g,' | ') : null }; });
        }""", QUOTES)
        for r in res: print(('OK ' if r['found'] else 'MISS'), r['n'], r['score'], 'boxes', r['boxes'], '|', r['q'], '=>', (r['text'] or '')[:90])
        await browser.close()
asyncio.run(main())
