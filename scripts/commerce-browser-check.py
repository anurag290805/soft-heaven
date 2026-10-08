"""Configured-commerce UI QA with isolated test-only Supabase/Razorpay fixtures.

Runs a separate Vite instance with public fixture configuration, never changes
the owner's environment files, and never contacts a live payment service.
"""
from __future__ import annotations

import base64
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
TEMP = Path('/var/folders/x_/nfg8gb8n4t79r4l62ppznmn40000gp/T/omnirush')
BASE_URL = 'http://127.0.0.1:5189'
spec = importlib.util.spec_from_file_location('commerce_browser_helper', Path(__file__).with_name('browser-check.py'))
assert spec and spec.loader
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
helper.BASE_URL = BASE_URL
helper.PORT = 9224


def main() -> int:
    results: list[dict] = []
    env = {**os.environ, 'VITE_SUPABASE_URL': 'https://qa-store.supabase.co', 'VITE_SUPABASE_ANON_KEY': 'test-public-key', 'VITE_RAZORPAY_ENABLED': 'true', 'VITE_GOOGLE_SIGN_IN_ENABLED': 'false', 'VITE_COMMERCE_ENV': 'qa'}
    vite = subprocess.Popen(['node', 'node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5189', '--strictPort', '--mode', 'qa'], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    chrome = None
    protocol = None
    with tempfile.TemporaryDirectory(prefix='commerce-qa-', dir=TEMP) as profile:
        try:
            for _ in range(100):
                if vite.poll() is not None:
                    raise RuntimeError('The isolated commerce Vite server did not start.')
                try:
                    with urllib.request.urlopen(BASE_URL, timeout=1):
                        break
                except OSError:
                    time.sleep(.15)
            chrome = subprocess.Popen([helper.CHROME, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', f'--user-data-dir={profile}', '--remote-debugging-port=9224', '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            protocol = helper.ChromeProtocol(helper.wait_for_debugger())
            for domain in ('Page', 'Runtime', 'Network', 'Log'):
                protocol.command(f'{domain}.enable')
            protocol.command('Page.addScriptToEvaluateOnNewDocument', {'source': (ROOT / 'scripts/fixtures/commerce-browser.js').read_text()})

            def navigate(path):
                helper.navigate(protocol, path)
                for _ in range(60):
                    if protocol.evaluate("Boolean(document.querySelector('h1'))"):
                        break
                    helper.wait(protocol, .2)
                else:
                    raise RuntimeError(f'Commerce page did not render: {path}; events={protocol.events[-15:]}')
                helper.wait(protocol, .3)

            def check(name, condition, detail=''):
                helper.check(results, name, bool(condition), detail)

            def fill(selector, value):
                protocol.evaluate(f"(() => {{ const input = document.querySelector({json.dumps(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, {json.dumps(value)}); input.dispatchEvent(new Event('input', {{bubbles: true}})); }})()")

            navigate('/login?redirect=/checkout')
            fill('input[type=email]', 'qa@example.test')
            fill('input[type=password]', 'QA-password-123')
            protocol.evaluate("document.querySelector('.commerce-form').requestSubmit()")
            helper.wait(protocol, 1)
            login_state = protocol.evaluate("({path: location.pathname, status: document.querySelector('.commerce-status')?.innerText, email: document.querySelector('input[type=email]')?.value, disabled: document.querySelector('.commerce-form button')?.disabled})")
            check('login uses the provider and returns to checkout', login_state['path'] == '/checkout', str(login_state))
            check('password is never persisted', not protocol.evaluate("Object.values(localStorage).some(value => value.includes('QA-password-123'))"))
            check('bag-empty checkout has no payment action', not protocol.evaluate("Boolean(document.querySelector('.checkout-submit'))"))

            protocol.evaluate("localStorage.setItem('soft-heaven:bag:v1', JSON.stringify({version: 2, items: [{slug: 'crochet-flower-keychain', variantId: 'baby-blue', quantity: 2}]}))")
            navigate('/checkout')
            fill('input[autocomplete=name]', 'QA Customer')
            fill('input[autocomplete=tel]', '+91 98765 43210')
            fill('input[autocomplete=address-line1]', '10 Test Street')
            fill('input[autocomplete=address-level2]', 'Delhi')
            fill('input[autocomplete=address-level1]', 'Delhi')
            fill('input[autocomplete=postal-code]', '110001')
            fill('input[autocomplete=tel]', '1234567890')
            protocol.evaluate("document.querySelector('.checkout-form').requestSubmit()")
            helper.wait(protocol, .2)
            check('invalid Indian phone is rejected before creating an order', protocol.evaluate("document.body.innerText.includes('valid Indian mobile') && commerceQA.state().orders.length === 0"))
            fill('input[autocomplete=tel]', '+91 98765 43210')
            protocol.evaluate("commerceQA.mode('unserviceable'); document.querySelector('.checkout-form').requestSubmit()")
            helper.wait(protocol, .5)
            check('unserviceable shipping is shown inline without order creation', protocol.evaluate("document.body.innerText.includes('Delivery is not configured') && commerceQA.state().orders.length === 0"))
            protocol.evaluate("commerceQA.mode('cancel'); document.querySelector('.checkout-form').requestSubmit()")
            review_deadline = time.time() + 3
            while time.time() < review_deadline:
                review_ready = protocol.evaluate("Boolean(document.querySelector('.checkout-summary__total--grand')?.innerText.includes('₹678') && document.querySelector('.checkout-submit')?.innerText.includes('Pay ₹678'))")
                if review_ready:
                    break
                helper.wait(protocol, .1)
            check('review shows authoritative shipping and total before payment', protocol.evaluate("document.querySelector('.checkout-summary__total--grand').innerText.includes('₹678') && document.querySelector('.checkout-submit').innerText.includes('Pay ₹678') && commerceQA.state().orders.length === 0"))
            for width, height in [(1440, 1200), (834, 1112), (430, 932), (390, 844)]:
                helper.set_viewport(protocol, width, height, width < 900)
                helper.wait(protocol, .15)
                check(f'configured checkout has no overflow at {width}px', not protocol.evaluate('document.documentElement.scrollWidth > innerWidth + 1'))
                image = protocol.command('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False})
                (TEMP / f'soft-heaven-checkout-{width}.png').write_bytes(base64.b64decode(image['data']))

            protocol.evaluate("document.querySelector('.commerce-checkbox input').click()")
            helper.wait(protocol, .15)
            protocol.evaluate("document.querySelector('.checkout-form').requestSubmit()")
            helper.wait(protocol, .5)
            check('payment cancellation keeps the bag and order unpaid', protocol.evaluate("commerceQA.state().orders[0].payment_status === 'pending' && JSON.parse(localStorage.getItem('soft-heaven:bag:v1')).items[0].quantity === 2 && document.body.innerText.includes('Payment was closed')"))
            check('optional address saving uses account storage', protocol.evaluate('commerceQA.state().addresses.length === 1'))
            protocol.evaluate("commerceQA.mode('payment-failed'); document.querySelector('.checkout-form').requestSubmit()")
            helper.wait(protocol, .3)
            check('payment failure retains an unpaid order and a recoverable bag', protocol.evaluate("document.body.innerText.includes('Payment did not complete') && commerceQA.state().orders[0].payment_status === 'pending' && JSON.parse(localStorage.getItem('soft-heaven:bag:v1')).items.length === 1"))
            protocol.evaluate("commerceQA.mode('verification-failed'); document.querySelector('.checkout-form').requestSubmit()")
            helper.wait(protocol, .5)
            check('payment verification failure cannot confirm or clear a bag', protocol.evaluate("document.body.innerText.includes('signature could not be verified') && commerceQA.state().orders[0].payment_status === 'pending' && JSON.parse(localStorage.getItem('soft-heaven:bag:v1')).items.length === 1"))
            check('retry preserves the same order request key', protocol.evaluate('new Set(commerceQA.state().requests).size === 1 && commerceQA.state().orders.length === 1'))
            # Re-check after a full navigation, not just an in-memory retry.
            navigate('/checkout')
            fill('input[autocomplete=name]', 'QA Customer')
            fill('input[autocomplete=tel]', '+91 98765 43210')
            fill('input[autocomplete=address-line1]', '10 Test Street')
            fill('input[autocomplete=address-level2]', 'Delhi')
            fill('input[autocomplete=address-level1]', 'Delhi')
            fill('input[autocomplete=postal-code]', '110001')
            protocol.evaluate("commerceQA.mode('retry-inside'); document.querySelector('.checkout-form').requestSubmit()")
            helper.wait(protocol, .4)
            protocol.evaluate("document.querySelector('.checkout-form').requestSubmit()")
            helper.wait(protocol, 1)
            check('server-verified payment opens confirmed order details', protocol.evaluate("location.pathname === '/order-confirmation' && document.querySelector('h1').innerText === 'Order confirmed'"))
            check('a successful in-modal retry is verified after an earlier payment failure', protocol.evaluate("commerceQA.state().orders[0].payment_status === 'paid' && location.pathname === '/order-confirmation'"))
            check('verified payment consumes purchased quantities', protocol.evaluate("JSON.parse(localStorage.getItem('soft-heaven:bag:v1')).items.length === 0"))
            check('reload retry did not create another order', protocol.evaluate('new Set(commerceQA.state().requests).size === 1 && commerceQA.state().orders.length === 1'))
            check('confirmation reads snapshots and delivery from the account', protocol.evaluate("document.body.innerText.includes('Crochet Flower Keychain') && document.body.innerText.includes('10 Test Street') && document.body.innerText.includes('₹678')"))
            navigate('/order-confirmation?order=bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb')
            check('spoofed order URL never implies confirmation', protocol.evaluate("!document.body.innerText.includes('Order confirmed') && document.body.innerText.includes('not found in your account') && !document.querySelector('.confirmation-card__icon')"))

            navigate('/account')
            protocol.evaluate("[...document.querySelectorAll('button')].find(button => button.textContent === 'Add an address').click()")
            helper.wait(protocol, .2)
            for selector, value in [('name', 'QA Customer'), ('tel', '9876543210'), ('address-line1', '10 Test Street'), ('address-level2', 'Delhi'), ('address-level1', 'Delhi'), ('postal-code', '110001')]:
                fill(f'input[autocomplete={selector}]', value)
            protocol.evaluate("document.querySelector('.account-address-form').requestSubmit()")
            helper.wait(protocol, .5)
            check('account saves an address through the provider', protocol.evaluate("document.querySelectorAll('.saved-address').length === 1 && commerceQA.state().addresses.length === 1"))
            check('addresses are not stored in localStorage', not protocol.evaluate("Object.values(localStorage).some(value => value.includes('10 Test Street'))"))
            protocol.evaluate("[...document.querySelectorAll('.saved-address button')].find(button => button.textContent === 'Remove address').click()")
            helper.wait(protocol, .5)
            check('account can remove a saved address', protocol.evaluate("commerceQA.state().addresses.length === 0 && !document.querySelector('.saved-address')"))

            navigate('/products/crochet-heart-keychain')
            protocol.evaluate("document.querySelector('.product-page__save-action .wishlist-toggle').click()")
            helper.wait(protocol, .5)
            check('signed-in wishlist changes sync to Supabase', protocol.evaluate("commerceQA.state().wishlists.some(item => item.slug === 'crochet-heart-keychain')"))
            navigate('/wishlist')
            protocol.evaluate("document.querySelector('.wishlist-item__remove').click()")
            helper.wait(protocol, .5)
            check('wishlist removal updates remote storage too', protocol.evaluate('commerceQA.state().wishlists.length === 0'))
            navigate('/forgot-password')
            fill('input[type=email]', 'qa@example.test')
            protocol.evaluate("document.querySelector('.commerce-form').requestSubmit()")
            helper.wait(protocol, .3)
            check('password recovery uses the configured provider', protocol.evaluate("document.body.innerText.includes('reset link is on its way')"))
            navigate('/orders')
            check('order history shows verified paid status', protocol.evaluate("document.querySelector('.order-card').innerText.includes('Payment verified') && document.body.innerText.includes('₹678')"))
            navigate('/account')
            protocol.evaluate("[...document.querySelectorAll('button')].find(button => button.textContent === 'Sign out').click()")
            helper.wait(protocol, .5)
            check('sign-out closes access to private account data', protocol.evaluate("!document.querySelector('.account-layout') && document.body.innerText.includes('signed out')"))
            navigate('/orders')
            check('signed-out order history asks for authentication', protocol.evaluate("!document.querySelector('.order-card') && document.body.innerText.includes('Sign in to continue')"))
            navigate('/reset-password')
            check('a reset route alone cannot change a password', protocol.evaluate("document.querySelector('.commerce-form button').disabled && document.body.innerText.includes('reset link from your email')"))
            navigate('/register?redirect=/checkout')
            fill('input[autocomplete=name]', 'QA Customer')
            fill('input[type=email]', 'new@example.test')
            fill('input[type=password]', 'New-password-123')
            protocol.evaluate("(() => { const inputs = document.querySelectorAll('input[type=password]'); const input = inputs[1]; if (!input) return; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'New-password-123'); input.dispatchEvent(new Event('input', {bubbles: true})); })()")
            protocol.evaluate("document.querySelector('.commerce-form').requestSubmit()")
            helper.wait(protocol, .3)
            check('registration waits for email confirmation rather than faking sign-in', protocol.evaluate("location.pathname === '/register' && document.body.innerText.includes('Check your email to confirm')"))
            navigate('/login')
            fill('input[type=email]', 'qa@example.test')
            fill('input[type=password]', 'Wrong-password-123')
            protocol.evaluate("commerceQA.mode('auth-failed'); document.querySelector('.commerce-form').requestSubmit()")
            helper.wait(protocol, .3)
            check('provider login failure is displayed inline', protocol.evaluate("document.body.innerText.includes('Invalid login credentials') && location.pathname === '/login'"))
            for width, height in [(1440, 1200), (834, 1112), (390, 844)]:
                helper.set_viewport(protocol, width, height, width < 900)
                navigate('/shipping-delivery')
                check(f'editorial shipping page has no overflow at {width}px', not protocol.evaluate('document.documentElement.scrollWidth > innerWidth + 1'))
                image = protocol.command('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False})
                (TEMP / f'soft-heaven-shipping-{width}.png').write_bytes(base64.b64decode(image['data']))
            exceptions = [event for event in protocol.events if event.get('method') == 'Runtime.exceptionThrown']
            check('configured commerce has no uncaught browser errors', len(exceptions) == 0, str(exceptions))
            failed = [result for result in results if not result['passed']]
            print(f"\n{len(results) - len(failed)}/{len(results)} configured-commerce checks passed")
            return 1 if failed else 0
        finally:
            if protocol:
                protocol.close()
            if chrome:
                chrome.terminate()
                chrome.wait(timeout=10)
            vite.terminate()
            vite.wait(timeout=10)


if __name__ == '__main__':
    raise SystemExit(main())
