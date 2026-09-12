import os, asyncio, json, sys, threading, http.server, socketserver, functools
from playwright.async_api import async_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP=ROOT
OVERLAY=os.path.join(ROOT,'vendor')
PORT=8765
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
    def guess_type(self, path):
        t = super().guess_type(path)
        return t + '; charset=utf-8' if t.startswith('text/') or t.endswith('javascript') else t
def serve():
    handler=functools.partial(Quiet, directory=APP)
    socketserver.TCPServer.allow_reuse_address=True
    with socketserver.TCPServer(("127.0.0.1",PORT),handler) as httpd:
        httpd.serve_forever()
threading.Thread(target=serve,daemon=True).start()

async def route_cdn(route):
    url=route.request.url
    if 'pdf.worker.min.js' in url:
        await route.fulfill(path=os.path.join(OVERLAY,'pdf.worker.min.js'), content_type='application/javascript')
    elif 'pdf.min.js' in url:
        await route.fulfill(path=os.path.join(OVERLAY,'pdf.min.js'), content_type='application/javascript')
    elif 'fonts.googleapis.com' in url or 'fonts.gstatic.com' in url:
        await route.fulfill(status=200, body='', content_type='text/css')
    else:
        await route.abort()

SEED_USER = "try{localStorage.setItem('prescreen.user', JSON.stringify({name:'Jane Doe',email:'jane.doe@northbridge.example',firm:'Northbridge Advisors',role:'banker'}))}catch(e){}"
async def open_page(pw, page_html='dist/prescreen.html', width=1400, height=900, init_script=None, fresh=False):
    browser=await pw.chromium.launch()
    ctx=await browser.new_context(viewport={'width':width,'height':height})
    page=await ctx.new_page()
    await page.route('**/*', lambda route: route_cdn(route) if not route.request.url.startswith('http://127.0.0.1') else route.continue_())
    if not fresh: await page.add_init_script(SEED_USER)  # a remembered banker sign-in, so the flows start on the form
    if init_script: await page.add_init_script(init_script)
    page.on('console', lambda m: print('[console]', m.type, m.text) if m.type in ('error','warning') else None)
    page.on('pageerror', lambda e: print('[pageerror]', e))
    await page.goto(f'http://127.0.0.1:{PORT}/{page_html}')
    return browser, page
