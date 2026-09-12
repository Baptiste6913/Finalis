"""PdfEdit: appends an incremental update with white boxes and Helvetica text to a PDF, on a classic xref file
(sim corpus) and on an object-stream / xref-stream file (Quartus). Checks: qpdf --check passes, pdftotext sees
the added text, pdf.js re-opens the file and reports the same page count. Usage: python3 tests/test_pdfedit.py"""
import asyncio, base64, os, subprocess, sys, json
sys.path.insert(0, os.path.dirname(__file__))
from harness import async_playwright, open_page, ROOT

DOCS = [os.path.join(ROOT, 'sim', 'corpus', 'S2_inst_gaps.pdf'), os.path.join(ROOT, 'quartus.pdf')]
OUT = os.path.join(ROOT, 'tests', 'out'); os.makedirs(OUT, exist_ok=True)

JS = r"""
async ([b64, pageNo]) => {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const ex = await Extract.pdf(bytes);
  const page = await ex.pdf.getPage(pageNo);
  const vp = page.getViewport({ scale: 1 });
  const items = [
    { kind: 'text', box: { x: 0.08, y: 0.86, w: 0.84, h: 0.08 }, text: 'ADDED DISCLOSURE: Finalis Securities LLC, Member FINRA/SIPC. The preferred return is not guaranteed and is not a projection of returns. Past performance is not indicative of future results.', size: 7.5 },
    { kind: 'replace', whiteout: [{ x: 0.1, y: 0.2, w: 0.5, h: 0.04 }], box: { x: 0.1, y: 0.2, w: 0.5, h: 0.04 }, text: 'REPLACED PASSAGE aims to deliver', size: 10, bold: true },
  ];
  const out = await PdfEdit.correct(bytes, [{ num: page.ref.num, gen: page.ref.gen, viewport: { transform: vp.transform, width: vp.width, height: vp.height }, items }]);
  const re = await Extract.pdf(out);
  const t = (await (await re.pdf.getPage(pageNo)).getTextContent()).items.map(i => i.str).join(' ');
  let b = ''; for (let i = 0; i < out.length; i += 1) b += String.fromCharCode(out[i]);
  return { pages: re.pages.length, origPages: ex.pages.length, hasText: t.includes('ADDED DISCLOSURE') && t.includes('REPLACED PASSAGE'), size: out.length, b64: btoa(b), ref: page.ref, rotate: page.rotate };
}
"""

async def main():
    ok = True
    async with async_playwright() as pw:
        browser, page = await open_page(pw, 'web/index.html')
        for path in DOCS:
            b64 = base64.b64encode(open(path, 'rb').read()).decode()
            page_no = 2
            r = await page.evaluate(JS, [b64, page_no])
            out = os.path.join(OUT, os.path.basename(path).replace('.pdf', '-edited.pdf'))
            open(out, 'wb').write(base64.b64decode(r['b64']))
            chk = subprocess.run(['qpdf', '--check', out], capture_output=True, text=True)
            txt = subprocess.run(['pdftotext', '-f', str(page_no), '-l', str(page_no), out, '-'], capture_output=True, text=True).stdout
            good = r['pages'] == r['origPages'] and r['hasText'] and chk.returncode == 0 and 'ADDED DISCLOSURE' in txt and 'REPLACED PASSAGE' in txt
            ok = ok and good
            print(('OK  ' if good else 'FAIL'), os.path.basename(path), 'pages', r['pages'], '/', r['origPages'], 'pdf.js text', r['hasText'], 'qpdf', chk.returncode, (chk.stderr or chk.stdout).strip().splitlines()[-1:] , 'pdftotext', 'ADDED DISCLOSURE' in txt, 'size', r['size'], 'ref', r['ref'])
        await browser.close()
    print('ALL OK' if ok else 'FAILURES')
    sys.exit(0 if ok else 1)

asyncio.run(main())
