"""In-app editing on the banker platform: Fix in the document (add / replace), overlay boxes, re-check of the
corrected version (deterministic), resolved points, corrected PDF bytes valid. Usage: python3 tests/test_edit.py"""
import asyncio, sys, os, base64, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
FAKE = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'test_flow.py')).read().split('FAKE = r"""')[1].split('"""')[0]
OUT = os.path.join(ROOT, 'tests', 'out'); os.makedirs(OUT, exist_ok=True)
async def main():
    ok = True
    async with async_playwright() as pw:
        browser, page = await open_page(pw, width=1280, height=1000, init_script=FAKE)
        await page.wait_for_timeout(500)
        await page.click('#sample-slot button'); await page.wait_for_selector('#filechip:not([hidden])', timeout=30000)
        await page.click('#btn-submit-form'); await page.wait_for_selector('#btn-start'); await page.click('#btn-start')
        await page.wait_for_function("document.getElementById('wh-status-text').textContent.includes('complete')", timeout=60000)
        await page.wait_for_timeout(600)
        before = await page.evaluate("() => ({ n: UI.S.result.findings.length, certain: UI.S.result.findings.filter(f=>Review.isCertain(f)).length, fixBtns: document.querySelectorAll('.fixbtn').length, ready: document.querySelector('.ready') && document.querySelector('.ready').textContent })")
        print('BEFORE', before)
        # first card with a fix button: open the menu and take the first option
        await page.click('.fixbtn'); await page.wait_for_timeout(150)
        opts = await page.evaluate("Array.from(document.querySelectorAll('.fixopt b')).map(b=>b.textContent)")
        print('OPTIONS', opts)
        await page.click('.fixopt'); await page.wait_for_timeout(300)
        st = await page.evaluate("() => ({ edits: UI.S.edits.length, editEls: document.querySelectorAll('.edit').length, fixcard: !!document.querySelector('.fixcard'), editbar: !!document.querySelector('.editbar'), fixed: Object.values(UI.S.responses).filter(r=>r.status==='fixed').length })")
        print('AFTER ONE FIX', st); ok = ok and st['edits'] == 1 and st['editEls'] == 1 and st['fixcard']
        await page.screenshot(path=os.path.join(OUT, 'edit_one.png'))
        # apply every default fix
        n = await page.evaluate("() => { UI.applyAllFixes(); return UI.S.edits.length; }")
        print('APPLY ALL edits', n)
        await page.wait_for_timeout(300)
        await page.screenshot(path=os.path.join(OUT, 'edit_all.png'))
        # drag the selected edit by 40px right and check the box moved
        moved = await page.evaluate("""async () => { const e = UI.S.edits[0]; const node = document.querySelector('[data-edit="' + e.id + '"]'); const r = node.getBoundingClientRect(); const x0 = e.box.x; node.dispatchEvent(new PointerEvent('pointerdown', {clientX: r.left+5, clientY: r.top+5, bubbles:true, pointerId:1})); node.dispatchEvent(new PointerEvent('pointermove', {clientX: r.left+45, clientY: r.top+5, bubbles:true, pointerId:1})); node.dispatchEvent(new PointerEvent('pointerup', {clientX: r.left+45, clientY: r.top+5, bubbles:true, pointerId:1})); return { before: x0, after: e.box.x }; }""")
        print('DRAG', moved); ok = ok and moved['after'] > moved['before']
        # corrected bytes
        b64 = await page.evaluate("async () => { const b = await UI.buildCorrected(); let s=''; for (let i=0;i<b.length;i+=1) s+=String.fromCharCode(b[i]); return btoa(s); }")
        out = os.path.join(OUT, 'quartus-app-corrected.pdf'); open(out, 'wb').write(base64.b64decode(b64))
        chk = subprocess.run(['qpdf', '--check', out], capture_output=True, text=True); print('qpdf', chk.returncode)
        ok = ok and chk.returncode == 0
        # re-check
        await page.evaluate("UI.recheckCorrected()")
        await page.wait_for_function("UI.S.version === 2", timeout=60000); await page.wait_for_timeout(800)
        st2 = await page.evaluate("() => ({ version: UI.S.version, open: UI.S.result.findings.length, resolved: UI.S.resolved.map(f=>f.rule+':'+(f.resolved&&f.resolved.how)), ready: document.querySelector('.ready') && document.querySelector('.ready').textContent, name: UI.S.doc.name, changes: UI.S.result.meta.changes.length, resolvedSection: !!document.querySelector('.resolved') })")
        print('AFTER RECHECK', st2); ok = ok and st2['version'] == 2 and len(st2['resolved']) >= 1
        await page.screenshot(path=os.path.join(OUT, 'edit_v2.png'))
        # submit v2 and open on the reviewer platform
        highs = await page.evaluate("UI.S.result.findings.filter(f=>f.severity==='high' && Review.isCertain(f) && !(UI.S.responses[f.id]&&UI.S.responses[f.id].status!=='none')).map(f=>f.id)")
        for fid in highs:
            tab = await page.evaluate(f"UI.S.result.findings.find(f=>f.id==='{fid}').tier === 'C' ? 'language' : 'disclosures'")
            await page.click(f'#tab-{tab}'); await page.click(f'[data-card="{fid}"] .resp .chips button:first-child')
        await page.check('#ack'); await page.click('#btn-submit'); await page.wait_for_selector('#view-done:not([hidden])'); await page.wait_for_timeout(300)
        sub = await page.evaluate("() => ({ version: UI.S.submission.version, changes: UI.S.submission.changes.length, resolved: UI.S.submission.resolved.length, original: UI.S.submission.original, readiness: UI.S.submission.readiness })")
        print('SUBMISSION', sub); ok = ok and sub['version'] == 2 and sub['original'] is not None
        await page.click('#mode-reviewer'); await page.wait_for_timeout(400)
        await page.click('#inbox-list .trow:not(.h) .btn.primary'); await page.wait_for_timeout(1200)
        rv = await page.evaluate("() => ({ kind: UI.S.doc.kind, pages: UI.S.doc.pages.length, cards: document.querySelectorAll('[data-card]').length, name: UI.S.doc.name })")
        print('REVIEWER', rv); ok = ok and rv['kind'] == 'pdf'
        await page.screenshot(path=os.path.join(OUT, 'edit_reviewer.png'))
        for kind in ('desk', 'banker'):
            b64 = await page.evaluate("async (k) => { const b = new Uint8Array(await Notify.reportPdf(UI.S.viewing, k).arrayBuffer()); let s=''; for (let i=0;i<b.length;i+=1) s+=String.fromCharCode(b[i]); return btoa(s); }", kind)
            pdf = os.path.join(OUT, 'v2-' + kind + '.pdf'); open(pdf, 'wb').write(base64.b64decode(b64))
            chk = subprocess.run(['qpdf', '--check', pdf], capture_output=True, text=True).returncode
            txt = subprocess.run(['pdftotext', pdf, '-'], capture_output=True, text=True).stdout
            good = chk == 0 and 'Corrections' in txt and 'Version' in txt
            print('PDF', kind, 'qpdf', chk, 'corrections section', 'Corrections' in txt, 'version row', 'Version' in txt); ok = ok and good
        await browser.close()
    print('ALL OK' if ok else 'FAILURES'); sys.exit(0 if ok else 1)
asyncio.run(main())
