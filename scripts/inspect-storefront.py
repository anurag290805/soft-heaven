"""Visible Chrome inspection controller; separate from automated pass/fail QA.

Start, navigate, scroll and interact with the actual rendered application.
Optional fixtures are explicitly isolated from provider/deployment verification.
"""
import argparse
import base64
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
TEMP = Path('/var/folders/x_/nfg8gb8n4t79r4l62ppznmn40000gp/T/omnirush')
STATE = TEMP / 'soft-heaven-inspection.json'
spec = importlib.util.spec_from_file_location('inspection_helper', ROOT / 'scripts/browser-check.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
helper.PORT = 9235


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['start', 'inspect', 'eval', 'close'])
    parser.add_argument('--fixture', action='store_true')
    parser.add_argument('--path')
    parser.add_argument('--width', type=int, default=1440)
    parser.add_argument('--height', type=int, default=1200)
    parser.add_argument('--scroll', type=int)
    parser.add_argument('--js')
    parser.add_argument('--name', default='inspection')
    args = parser.parse_args()
    if args.action == 'start':
        base_url = 'http://127.0.0.1:5191' if args.fixture else 'http://127.0.0.1:5173'
        vite = None
        if args.fixture:
            env = {**os.environ, 'VITE_SUPABASE_URL': 'https://qa-store.supabase.co', 'VITE_SUPABASE_ANON_KEY': 'test-public-key', 'VITE_RAZORPAY_ENABLED': 'true', 'VITE_GOOGLE_SIGN_IN_ENABLED': 'false', 'VITE_COMMERCE_ENV': 'qa'}
            vite = subprocess.Popen(['node', 'node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5191', '--strictPort', '--mode', 'qa'], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
            for _ in range(100):
                try:
                    with urllib.request.urlopen(base_url, timeout=1):
                        break
                except OSError:
                    time.sleep(.15)
        chrome = subprocess.Popen([helper.CHROME, '--no-first-run', '--no-default-browser-check', f'--user-data-dir={TEMP / "soft-heaven-visible-profile"}', '--remote-debugging-port=9235', '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        STATE.write_text(json.dumps({'base_url': base_url, 'chrome': chrome.pid, 'vite': vite.pid if vite else None, 'fixture': args.fixture}))
    state = json.loads(STATE.read_text())
    if args.action == 'close':
        for key in ['chrome', 'vite']:
            if state[key]:
                try:
                    os.kill(state[key], signal.SIGTERM)
                except ProcessLookupError:
                    pass
        STATE.unlink()
        return
    helper.BASE_URL = state['base_url']
    protocol = helper.ChromeProtocol(helper.wait_for_debugger())
    try:
        for domain in ['Page', 'Runtime', 'Network']:
            protocol.command(f'{domain}.enable')
        if args.action == 'start' and args.fixture:
            protocol.command('Page.addScriptToEvaluateOnNewDocument', {'source': (ROOT / 'scripts/fixtures/commerce-browser.js').read_text()})
        helper.set_viewport(protocol, args.width, args.height, args.width < 900)
        if args.path or args.action == 'start':
            helper.navigate(protocol, args.path or '/')
            helper.wait(protocol, 1)
        if args.js:
            print(json.dumps(protocol.evaluate(args.js), ensure_ascii=False, indent=2))
            helper.wait(protocol, .5)
        if args.scroll is not None:
            protocol.evaluate(f'window.scrollTo({{top: {args.scroll}, behavior: "instant"}})')
            helper.wait(protocol, .5)
        metrics = protocol.evaluate("({path:location.pathname, scrollY, viewport:[innerWidth,innerHeight], pageHeight:document.documentElement.scrollHeight, heading:document.querySelector('h1')?.innerText, visibleHeadings:[...document.querySelectorAll('h2,h3')].filter(e=>e.getBoundingClientRect().top<innerHeight && e.getBoundingClientRect().bottom>0).map(e=>e.innerText), overflow:document.documentElement.scrollWidth>innerWidth+1, brokenImages:[...document.images].filter(e=>e.complete&&e.naturalWidth===0).map(e=>e.getAttribute('src'))})")
        print(json.dumps({'source': 'local fixture services' if state['fixture'] else 'actual local unconfigured store', **metrics}, ensure_ascii=False, indent=2))
        screenshot = protocol.command('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False})
        destination = TEMP / f'soft-heaven-{args.name}.png'
        destination.write_bytes(base64.b64decode(screenshot['data']))
        print(str(destination))
    finally:
        protocol.close()


if __name__ == '__main__':
    main()
