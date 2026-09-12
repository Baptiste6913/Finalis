"""Sign-in screen: shown first, role decides the platform, identity prefills the setup, remember me, sign out."""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
OUT = os.path.join(ROOT, 'tests', 'out'); os.makedirs(OUT, exist_ok=True)
async def main():
    ok = True
    async with async_playwright() as pw:
        browser, page = await open_page(pw, width=1280, height=900, fresh=True)
        await page.wait_for_timeout(500)
        st = await page.evaluate("() => ({ login: !document.getElementById('view-login').hidden, appbar: getComputedStyle(document.querySelector('.appbar')).display, logo: !!document.querySelector('#brand-logo-3 img') })")
        print('LOGIN SHOWN', st); ok = ok and st['login'] and st['appbar'] == 'none' and st['logo']
        await page.screenshot(path=os.path.join(OUT, 'login.png'))
        await page.click('#login-submit'); await page.wait_for_timeout(100)
        err = await page.evaluate("document.getElementById('login-err').textContent"); print('VALIDATION', err); ok = ok and 'email' in err
        await page.fill('#login-email', 'jane.doe@northbridge.example'); await page.fill('#login-name', 'Jane Doe'); await page.fill('#login-firm', 'Northbridge Advisors')
        await page.click('#login-submit'); await page.wait_for_timeout(300)
        st2 = await page.evaluate("() => ({ view: UI.S.view, mode: UI.S.mode, avatar: document.getElementById('avatar').textContent, stored: !!localStorage.getItem('prescreen.user'), product: document.getElementById('product-name').textContent })")
        print('AFTER SIGN-IN', st2); ok = ok and st2['view'] == 'form' and st2['avatar'] == 'JD' and st2['stored']
        await page.click('#sample-slot button'); await page.wait_for_selector('#filechip:not([hidden])', timeout=30000)
        await page.click('#btn-submit-form'); await page.wait_for_selector('#btn-start')
        pre = await page.evaluate("() => ({ submitter: document.getElementById('submitter').value, bank: document.getElementById('bank-name').value })")
        print('PREFILL', pre); ok = ok and pre['submitter'].startswith('Jane Doe') and pre['bank'] == 'Northbridge Advisors'
        # reload: remembered
        await page.reload(); await page.wait_for_timeout(700)
        st3 = await page.evaluate("() => ({ login: !document.getElementById('view-login').hidden, name: UI.S.user && UI.S.user.name })")
        print('REMEMBERED', st3); ok = ok and not st3['login'] and st3['name'] == 'Jane Doe'
        # sign out via the menu, sign in as a reviewer
        await page.click('#avatar'); await page.wait_for_timeout(100); await page.click('#am-signout'); await page.wait_for_timeout(200)
        st4 = await page.evaluate("() => ({ login: !document.getElementById('view-login').hidden, stored: !!localStorage.getItem('prescreen.user') })")
        print('SIGNED OUT', st4); ok = ok and st4['login'] and not st4['stored']
        await page.check('input[name=role][value=reviewer]'); await page.fill('#login-email', 'c.officer@finalis.com'); await page.fill('#login-name', 'Compliance Officer')
        await page.click('#login-submit'); await page.wait_for_timeout(400)
        st5 = await page.evaluate("() => ({ view: UI.S.view, mode: UI.S.mode, product: document.getElementById('product-name').textContent, avatar: document.getElementById('avatar').textContent })")
        print('REVIEWER SIGN-IN', st5); ok = ok and st5['view'] == 'inbox' and st5['mode'] == 'reviewer'
        await page.screenshot(path=os.path.join(OUT, 'login_reviewer_inbox.png'))
        await browser.close()
    print('ALL OK' if ok else 'FAILURES'); sys.exit(0 if ok else 1)
asyncio.run(main())
