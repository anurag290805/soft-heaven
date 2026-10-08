"""Browser-level QA for the family/variant storefront milestone."""

from __future__ import annotations

import json
import subprocess
import importlib.util
import time
from pathlib import Path

_browser_check_spec = importlib.util.spec_from_file_location('soft_heaven_browser_check', Path(__file__).with_name('browser-check.py'))
assert _browser_check_spec and _browser_check_spec.loader
browser_check = importlib.util.module_from_spec(_browser_check_spec)
_browser_check_spec.loader.exec_module(browser_check)
ChromeProtocol = browser_check.ChromeProtocol
navigate = browser_check.navigate
set_viewport = browser_check.set_viewport
wait = browser_check.wait
wait_for_debugger = browser_check.wait_for_debugger


BASE_URL = "http://127.0.0.1:5173"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE = "/tmp/soft-heaven-variant-check-profile"
PORT = 9223


def check(results: list[dict], name: str, passed: bool, detail: str = "") -> None:
    results.append({"name": name, "passed": passed, "detail": detail})
    print(f"[{'PASS' if passed else 'FAIL'}] {name}{f': {detail}' if detail else ''}")


def wait_for_selector(protocol: ChromeProtocol, expression: str, attempts: int = 20) -> None:
    for _ in range(attempts):
        if protocol.evaluate(expression):
            return
        wait(protocol, .3)


def main() -> int:
    browser_check.PORT = PORT
    chrome = subprocess.Popen([
        CHROME, "--headless=new", "--no-sandbox", "--disable-gpu",
        "--disable-background-networking", "--disable-component-update",
        "--no-first-run", "--no-default-browser-check", f"--user-data-dir={PROFILE}",
        f"--remote-debugging-port={PORT}", "--remote-allow-origins=*", f"{BASE_URL}/",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    results: list[dict] = []
    protocol: ChromeProtocol | None = None
    try:
        protocol = ChromeProtocol(wait_for_debugger())
        for domain in ("Page", "Runtime", "Log", "Network"):
            protocol.command(f"{domain}.enable")

        navigate(protocol, "/")
        wait(protocol, 1.2)
        protocol.evaluate("localStorage.clear()")
        for label, width, height, mobile in (("desktop", 1440, 1200, False), ("tablet", 834, 1112, True), ("mobile", 390, 844, True)):
            set_viewport(protocol, width, height, mobile)
            navigate(protocol, "/")
            wait_for_selector(protocol, "document.querySelectorAll('.product-card').length === 7")
            protocol.evaluate("document.querySelector('#featured')?.scrollIntoView({block: 'start'})")
            wait(protocol, 1.2)
            protocol.evaluate("document.querySelector('.product-grid .product-card:last-child')?.scrollIntoView({block: 'center'})")
            wait(protocol, 1.2)
            state = protocol.evaluate("""({
              overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
              cards: document.querySelectorAll('.product-card').length,
              bagButtons: document.querySelectorAll('.product-card__bag-action').length,
              babyDefaults: [...document.querySelectorAll('.product-card__selected-variant')].filter((element) => element.textContent?.trim() === 'Baby Blue').length,
              images: [...document.querySelectorAll('.product-card img')].map((image) => image.currentSrc || image.src),
              heading: document.querySelector('h1')?.textContent?.trim() || '',
              oldTagline: document.body.innerText.includes('Little things, lovingly handmade.'),
              menu: Boolean(document.querySelector('.menu-button')),
              filters: [...document.querySelectorAll('.catalogue-control select')].map((select) => select.id),
              failedImages: [...document.images].filter((image) => image.complete && image.naturalWidth === 0).length
            })""")
            check(results, f"{label} has no horizontal overflow", not state["overflow"])
            check(results, f"{label} shows seven product families", state["cards"] == 7, str(state["cards"]))
            check(results, f"{label} exposes Add to Bag for all approved families", state["bagButtons"] == 7, str(state["bagButtons"]))
            check(results, f"{label} defaults multi-colour keychains to Baby Blue", state["babyDefaults"] == 3, str(state["babyDefaults"]))
            check(results, f"{label} has real WebP product delivery", all("/optimized/" in src for src in state["images"]), str(state["images"]))
            check(results, f"{label} removes the retired tagline", not state["oldTagline"])
            check(results, f"{label} exposes discovery filters", {"type-filter", "occasion-filter", "colour-filter", "price-filter"}.issubset(state["filters"]))
            check(results, f"{label} has no broken homepage images", state["failedImages"] == 0, str(state["failedImages"]))
            if mobile:
                check(results, f"{label} has mobile navigation", state["menu"])

        variant_routes = {
            "/products/crochet-flower-keychain": {
                "swatches": ["lightblue_flower.webp", "pink_flower.webp", "purple_flower.webp", "white_flower.webp", "yellow_flower.webp"],
                "selected": "Blush Pink",
                "variant_id": "blush-pink",
            },
            "/products/cute-crochet-dress-keychain": {
                "swatches": ["green_dress.webp", "lavendar_dress.webp", "lightblue_dress.webp", "pink_dress.webp", "red_dress.webp"],
                "selected": "Blush Pink",
                "variant_id": "blush-pink",
            },
            "/products/crochet-heart-keychain": {
                "swatches": ["blue_heart.webp", "pink_heart.webp", "purple_heart.webp", "red_heart.webp", "white_heart.webp"],
                "selected": "Blush Pink",
                "variant_id": "blush-pink",
            },
        }

        for path, expected in variant_routes.items():
            navigate(protocol, path)
            wait_for_selector(protocol, "document.querySelectorAll('.product-page__variant-selection .variant-swatch').length")
            count = protocol.evaluate("document.querySelectorAll('.product-page__variant-selection .variant-swatch').length")
            check(results, f"{path} exposes five real colour choices", count == 5, str(count))
            actual_images: list[str] = []
            for index, expected_name in enumerate(expected["swatches"]):
                protocol.evaluate(f"document.querySelectorAll('.product-page__variant-selection .variant-swatch')[{index}]?.click()")
                expected_stem = expected_name.replace('.webp', '')
                deadline = time.time() + 2
                current = ''
                while time.time() < deadline:
                    current = protocol.evaluate("document.querySelector('.product-page__visual img')?.currentSrc || ''")
                    if expected_stem in current:
                        break
                    wait(protocol, .08)
                actual_images.append(current)
            check(results, f"{path} switches through the genuine photo map", all(expected_name.replace('.webp', '') in actual for expected_name, actual in zip(expected["swatches"], actual_images)), json.dumps(actual_images))

            protocol.evaluate("document.querySelector('.product-page__variant-selection .variant-swatch[aria-label^=\"Blush Pink\"]')?.click()")
            wait(protocol, .15)
            selected_state = protocol.evaluate("""({
              colour: document.querySelector('.variant-picker__heading strong')?.textContent?.trim() || '',
              image: document.querySelector('.product-page__visual img')?.currentSrc || '',
              whatsapp: [...document.querySelectorAll('a[href^="https://wa.me/"]')].map((link) => new URL(link.href).searchParams.get('text') || ''),
              wishlistButton: document.querySelector('.product-page__save-action .wishlist-toggle')?.getAttribute('aria-pressed') || 'false'
            })""")
            check(results, f"{path} keeps selected colour visible", selected_state["colour"] == expected["selected"], str(selected_state))
            check(results, f"{path} enquiry carries selected colour", any(expected["selected"] in message for message in selected_state["whatsapp"]), str(selected_state["whatsapp"]))

            protocol.evaluate("document.querySelector('.product-page__save-action .wishlist-toggle')?.click()")
            wait(protocol, .2)
            wishlist = protocol.evaluate("JSON.parse(localStorage.getItem('soft-heaven:wishlist:v1') || '{}')")
            check(results, f"{path} persists the selected wishlist variant", any(item.get("variantId") == expected["variant_id"] for item in wishlist.get("items", [])), json.dumps(wishlist))
            if path == "/products/crochet-flower-keychain":
                check(results, "wishlist gives immediate toast feedback", bool(protocol.evaluate("Boolean(document.querySelector('.wishlist-toggle__feedback'))")))
                wait(protocol, 2.2)
                check(results, "wishlist toast disappears automatically", not bool(protocol.evaluate("Boolean(document.querySelector('.wishlist-toggle__feedback'))")))
                protocol.evaluate("document.querySelector('.product-page__image-trigger')?.click()")
                wait(protocol, .2)
                lightbox = protocol.evaluate("({open: Boolean(document.querySelector('.product-image-lightbox')), focus: document.activeElement?.getAttribute('aria-label') || ''})")
                check(results, "product image lightbox opens and receives focus", lightbox["open"] and lightbox["focus"] == "Close larger product image", str(lightbox))
                protocol.evaluate("document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}))")
                wait(protocol, .15)
                check(results, "Escape closes product image lightbox", not bool(protocol.evaluate("Boolean(document.querySelector('.product-image-lightbox'))")))

        set_viewport(protocol, 1440, 1200, False)
        navigate(protocol, "/")
        wait_for_selector(protocol, "Boolean(document.querySelector('#featured .product-card'))")
        protocol.evaluate("document.querySelector('.product-card__bag-action')?.click()")
        wait(protocol, .25)
        drawer_state = protocol.evaluate("({open: Boolean(document.querySelector('.bag-drawer')), name: document.querySelector('.bag-drawer__item strong')?.textContent?.trim() || '', viewBag: Boolean(document.querySelector('.bag-drawer a[href=\"/bag\"]'))})")
        check(results, "Add to Bag opens the mini-cart drawer", drawer_state["open"] and drawer_state["viewBag"] and bool(drawer_state["name"]), str(drawer_state))
        protocol.evaluate("document.querySelector('.bag-drawer__actions .button--text')?.click()")
        protocol.evaluate("document.querySelector('[aria-label=\"Search Soft Heaven\"]')?.click()")
        wait(protocol, .2)
        protocol.command("Input.insertText", {"text": "dress"})
        wait(protocol, .3)
        search_state = protocol.evaluate("({results: document.querySelectorAll('.search-panel__results li').length, match: document.body.innerText.includes('Cute Crochet Dress Keychain')})")
        check(results, "search finds the renamed dress keychain", search_state["results"] > 0 and search_state["match"], str(search_state))
        protocol.evaluate("document.querySelector('.search-panel__clear')?.click(); document.querySelector('[aria-label=\"Search Soft Heaven\"]')?.click()")
        protocol.evaluate("document.querySelector('#occasion-filter')?.dispatchEvent(new Event('change', {bubbles: true}))")
        protocol.evaluate("(() => { const select = document.querySelector('#occasion-filter'); if (!select) return; const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; setter?.call(select, 'birthday'); select.dispatchEvent(new Event('change', {bubbles: true})); })()")
        wait(protocol, .3)
        check(results, "occasion filtering keeps real products discoverable", int(protocol.evaluate("document.querySelectorAll('#featured .product-card').length")) > 0)

        protocol.evaluate("localStorage.setItem('soft-heaven:bag:v1', JSON.stringify({version: 2, items: [{slug: 'crochet-flower-keychain', variantId: 'blush-pink', quantity: 2}]}))")
        navigate(protocol, "/bag")
        bag_state = protocol.evaluate("({variant: document.querySelector('.bag-item__variant')?.textContent || '', quantity: document.querySelector('.quantity-stepper input')?.value || '', meter: document.querySelector('.bag-summary__meter strong')?.textContent || '', checkout: document.querySelector('.bag-summary a[href=\"/checkout\"]')?.textContent || ''})")
        check(results, "bag restores the selected variant from persistent storage", bag_state["variant"] == "Colour: Blush Pink", str(bag_state))
        check(results, "bag restores quantity and meter", bag_state["quantity"] == "2" and bag_state["meter"] == "2", str(bag_state))
        check(results, "bag exposes a secure checkout action", "checkout" in bag_state["checkout"].lower(), str(bag_state))

        navigate(protocol, "/checkout")
        wait(protocol, .5)
        checkout_state = protocol.evaluate("({heading: document.querySelector('h1')?.textContent?.trim() || '', summary: Boolean(document.querySelector('.checkout-summary')), accountGate: Boolean(document.querySelector('.checkout-auth-gate')), oldCopy: document.body.innerText.includes('There is no checkout')})")
        check(results, "checkout route keeps the bag summary", checkout_state["heading"] == "Checkout" and checkout_state["summary"], str(checkout_state))
        check(results, "checkout requires the secure account gate", checkout_state["accountGate"], str(checkout_state))
        check(results, "checkout removes enquiry-only copy", not checkout_state["oldCopy"], str(checkout_state))

        navigate(protocol, "/login?redirect=/checkout")
        wait(protocol, .35)
        auth_state = protocol.evaluate("({form: Boolean(document.querySelector('.commerce-form')), disabled: Boolean(document.querySelector('.commerce-form button[disabled]')), honest: document.body.innerText.includes('No password is stored in this browser')})")
        check(results, "login route exposes a real account form", auth_state["form"], str(auth_state))
        check(results, "login stays disabled without an API", auth_state["disabled"] and auth_state["honest"], str(auth_state))

        navigate(protocol, "/shipping-delivery")
        wait(protocol, .25)
        shipping_state = protocol.evaluate("({heading: document.querySelector('h1')?.textContent?.trim() || '', sections: document.querySelectorAll('.information-content section').length, oldCopy: document.body.innerText.includes('Delivery arrangements are part of the conversation')})")
        check(results, "shipping page exposes the checkout delivery guidance", shipping_state["heading"] == "Shipping & delivery" and shipping_state["sections"] >= 2 and not shipping_state["oldCopy"], str(shipping_state))

        set_viewport(protocol, 390, 844, True)
        navigate(protocol, "/")
        wait_for_selector(protocol, "Boolean(document.querySelector('.menu-button'))")
        protocol.evaluate("document.querySelector('.menu-button')?.click()")
        wait(protocol, .2)
        check(results, "mobile menu opens", bool(protocol.evaluate("Boolean(document.querySelector('.mobile-nav'))")))
        protocol.evaluate("document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}))")
        wait(protocol, .15)
        check(results, "Escape closes mobile menu", not bool(protocol.evaluate("Boolean(document.querySelector('.mobile-nav'))")))
        navigate(protocol, "/products/crochet-flower-keychain")
        mobile_detail = protocol.evaluate("({overflow: document.documentElement.scrollWidth > window.innerWidth + 1, sticky: getComputedStyle(document.querySelector('.product-page__mobile-purchase')).display !== 'none', add: document.querySelector('.product-page__mobile-purchase .button')?.textContent?.includes('Add to bag')})")
        check(results, "mobile variant detail has no overflow", not mobile_detail["overflow"])
        check(results, "mobile variant detail keeps WhatsApp enquiry accessible", mobile_detail["sticky"])
        check(results, "mobile variant detail exposes the primary purchase CTA", mobile_detail["add"])

        navigate(protocol, "/admin/catalogue")
        wait(protocol, 1.2)
        protocol.evaluate("document.querySelectorAll('.admin-product-list__item')[3]?.click()")
        wait(protocol, .3)
        protocol.evaluate("localStorage.removeItem('soft-heaven:bag:v1'); window.dispatchEvent(new StorageEvent('storage', {key: 'soft-heaven:bag:v1'}))")
        wait(protocol, .2)
        admin_state = protocol.evaluate("({products: document.querySelectorAll('.admin-product-list__item').length, variants: document.querySelectorAll('.admin-variant').length, addColour: document.body.innerText.includes('New genuine variant')})")
        check(results, "catalogue studio lists product families", admin_state["products"] == 7, str(admin_state))
        check(results, "catalogue studio exposes variant management", admin_state["variants"] == 5 and admin_state["addColour"], str(admin_state))

        protocol.command("DOM.enable")
        document_node = protocol.command("DOM.getDocument", {"depth": -1})["root"]["nodeId"]
        upload_node = protocol.command("DOM.querySelector", {"nodeId": document_node, "selector": ".admin-add-variant input[type=file]"})["nodeId"]
        protocol.evaluate("""(() => {
          const inputs = document.querySelectorAll('.admin-add-variant__fields input');
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          setter?.call(inputs[0], 'Owner Test Colour'); inputs[0]?.dispatchEvent(new Event('input', {bubbles: true}));
          setter?.call(inputs[1], 'Owner Test Colour'); inputs[1]?.dispatchEvent(new Event('input', {bubbles: true}));
        })()""")
        protocol.command("DOM.setFileInputFiles", {"nodeId": upload_node, "files": ["/Users/Anurag/Desktop/Products/Flower/pink_flower.png"]})
        protocol.evaluate("document.querySelector('.admin-secondary-button')?.click()")
        wait_for_selector(protocol, "document.querySelectorAll('.admin-variant').length === 6")
        uploaded_state = protocol.evaluate("({variants: document.querySelectorAll('.admin-variant').length, uploaded: [...document.querySelectorAll('.admin-variant img')].some((image) => image.src.startsWith('data:image/'))})")
        check(results, "catalogue studio adds a variant from a genuine upload", uploaded_state["variants"] == 6 and uploaded_state["uploaded"], str(uploaded_state))

        # Temporarily use the local owner editor to approve one known price and
        # one colour, then exercise the real Add to Bag path. This runs in the
        # disposable browser profile only and does not approve source data.
        protocol.evaluate("document.querySelectorAll('.admin-product-list__item')[3]?.click()")
        wait(protocol, .3)
        protocol.evaluate("""(() => {
          const setSelect = (select, value) => {
            const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
            setter?.call(select, value);
            select.dispatchEvent(new Event('change', {bubbles: true}));
          };
          const selects = document.querySelectorAll('.admin-form-grid select');
          setSelect(selects[2], 'available');
          setSelect(selects[3], 'owner-confirmed');
          const productOrderability = document.querySelector('.admin-form-grid .admin-check input');
          if (productOrderability && !productOrderability.checked) productOrderability.click();
          const variant = document.querySelectorAll('.admin-variant')[1];
          if (variant) {
            setSelect(variant.querySelector('select'), 'available');
            const checkbox = variant.querySelector('.admin-check input');
            if (checkbox && !checkbox.checked) checkbox.click();
          }
        })()""")
        protocol.evaluate("document.querySelector('.admin-save-bar .button')?.click()")
        wait_for_selector(protocol, "document.querySelectorAll('.admin-product-list__item').length")
        navigate(protocol, "/products/crochet-flower-keychain?variant=blush-pink")
        wait_for_selector(protocol, "document.querySelector('.product-page__actions button')?.textContent?.includes('Add to bag')")
        approved_detail = protocol.evaluate("({action: document.querySelector('.product-page__actions button')?.textContent?.trim() || '', price: document.querySelector('.product-page__price-block strong')?.textContent?.trim() || ''})")
        check(results, "owner-approved variant exposes Add to Bag", "Add to bag" in approved_detail["action"], str(approved_detail))
        protocol.evaluate("document.querySelector('.product-page__actions button')?.click()")
        wait(protocol, .3)
        navigate(protocol, "/bag")
        wait_for_selector(protocol, "Boolean(document.querySelector('.bag-item'))")
        approved_bag = protocol.evaluate("({variant: document.querySelector('.bag-item__variant')?.textContent || '', quantity: document.querySelector('.quantity-stepper input')?.value || ''})")
        check(results, "approved Add to Bag preserves the selected colour", approved_bag["variant"] == "Colour: Blush Pink" and approved_bag["quantity"] == "1", str(approved_bag))

        protocol.drain(.5)
        browser_errors = [event for event in protocol.events if event.get("method") == "Runtime.exceptionThrown" or (event.get("method") == "Log.entryAdded" and event.get("params", {}).get("entry", {}).get("level") == "error")]
        network_failures = [event for event in protocol.events if event.get("method") == "Network.loadingFailed" and event.get("params", {}).get("type") != "Document" and event.get("params", {}).get("errorText") not in ("net::ERR_ABORTED", "net::ERR_CACHE_MISS")]
        check(results, "browser console has no uncaught errors", not browser_errors, str(browser_errors[:2]))
        check(results, "browser has no failed asset requests", not network_failures, str(network_failures[:3]))

        failed = [item for item in results if not item["passed"]]
        print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
        if failed:
            print(json.dumps(failed, indent=2))
        return 1 if failed else 0
    finally:
        if protocol:
            protocol.close()
        chrome.terminate()
        try:
            chrome.wait(timeout=5)
        except subprocess.TimeoutExpired:
            chrome.kill()


if __name__ == "__main__":
    raise SystemExit(main())
