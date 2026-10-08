"""Focused Chrome smoke checks for the Soft Heaven storefront.

This intentionally uses Chrome's DevTools Protocol directly so the project does
not need a browser automation dependency just to verify the current milestone.
"""

from __future__ import annotations

import base64
import json
import os
import select
import socket
import struct
import subprocess
import time
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BASE_URL = os.environ.get("SOFT_HEAVEN_BASE_URL", "http://127.0.0.1:5173")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE = "/tmp/soft-heaven-browser-check-profile"
PORT = 9222


class ChromeProtocol:
    def __init__(self, websocket_url: str):
        parsed = urllib.parse.urlparse(websocket_url)
        self.socket = socket.create_connection((parsed.hostname, parsed.port), timeout=30)
        key = base64.b64encode(os.urandom(16)).decode()
        request = (
            f"GET {parsed.path} HTTP/1.1\r\n"
            f"Host: {parsed.hostname}:{parsed.port}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n\r\n"
        ).encode()
        self.socket.sendall(request)
        self.socket.settimeout(30)
        response = self._read_until(b"\r\n\r\n")
        if b" 101 " not in response:
            raise RuntimeError(f"WebSocket handshake failed: {response[:200]!r}")
        self.command_id = 0
        self.events: list[dict] = []
        self.socket.settimeout(0.25)

    def _read_until(self, marker: bytes) -> bytes:
        data = b""
        while marker not in data:
            data += self.socket.recv(4096)
        return data

    def _read_exact(self, count: int) -> bytes:
        data = b""
        while len(data) < count:
            data += self.socket.recv(count - len(data))
        return data

    def _read_frame(self) -> tuple[int, bytes] | None:
        try:
            header = self._read_exact(2)
        except (TimeoutError, socket.timeout):
            return None
        first, second = header
        opcode = first & 0x0F
        length = second & 0x7F
        if length == 126:
            length = struct.unpack("!H", self._read_exact(2))[0]
        elif length == 127:
            length = struct.unpack("!Q", self._read_exact(8))[0]
        masked = second & 0x80
        mask = self._read_exact(4) if masked else b""
        payload = bytearray(self._read_exact(length))
        if masked:
            for index in range(length):
                payload[index] ^= mask[index % 4]
        return opcode, bytes(payload)

    def _send_text(self, message: str) -> None:
        payload = message.encode()
        length = len(payload)
        if length < 126:
            header = bytes([0x81, 0x80 | length])
        elif length < 65536:
            header = bytes([0x81, 0x80 | 126]) + struct.pack("!H", length)
        else:
            header = bytes([0x81, 0x80 | 127]) + struct.pack("!Q", length)
        mask = os.urandom(4)
        masked = bytes(byte ^ mask[index % 4] for index, byte in enumerate(payload))
        self.socket.sendall(header + mask + masked)

    def drain(self, seconds: float = 0.25) -> None:
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            remaining = max(0, deadline - time.monotonic())
            readable, _, _ = select.select([self.socket], [], [], min(remaining, 0.1))
            if not readable:
                continue
            frame = self._read_frame()
            if not frame:
                continue
            opcode, payload = frame
            if opcode == 0x9:
                self.socket.sendall(bytes([0x8A, len(payload)]) + payload)
            elif opcode == 0x1:
                self.events.append(json.loads(payload.decode()))

    def command(self, method: str, params: dict | None = None) -> dict:
        self.command_id += 1
        command_id = self.command_id
        self._send_text(json.dumps({"id": command_id, "method": method, "params": params or {}}))
        deadline = time.monotonic() + 12
        while time.monotonic() < deadline:
            frame = self._read_frame()
            if not frame:
                continue
            opcode, payload = frame
            if opcode == 0x9:
                self.socket.sendall(bytes([0x8A, len(payload)]) + payload)
                continue
            if opcode != 0x1:
                continue
            message = json.loads(payload.decode())
            if message.get("id") == command_id:
                if "error" in message:
                    raise RuntimeError(f"{method}: {message['error']}")
                return message.get("result", {})
            self.events.append(message)
        raise TimeoutError(f"Timed out waiting for {method}")

    def evaluate(self, expression: str):
        result = self.command(
            "Runtime.evaluate",
            {"expression": expression, "returnByValue": True, "awaitPromise": True},
        )
        if "exceptionDetails" in result:
            raise RuntimeError(result["exceptionDetails"])
        return result.get("result", {}).get("value")

    def close(self) -> None:
        self.socket.close()


def wait_for_debugger() -> str:
    # Chrome can take longer to initialize headless GPU/display services on
    # macOS before its DevTools endpoint becomes reachable.
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json", timeout=1) as response:
                targets = json.load(response)
            page_targets = [target for target in targets if target.get("type") == "page"]
            if page_targets:
                return page_targets[0]["webSocketDebuggerUrl"]
        except (OSError, ValueError):
            pass
        time.sleep(.2)
    raise RuntimeError("Chrome remote debugger did not start")


def check(results: list[dict], name: str, passed: bool, detail: str = "") -> None:
    results.append({"name": name, "passed": passed, "detail": detail})
    marker = "PASS" if passed else "FAIL"
    print(f"[{marker}] {name}{f': {detail}' if detail else ''}")


def wait(protocol: ChromeProtocol, seconds: float = .7) -> None:
    time.sleep(seconds)
    protocol.drain(.2)


def navigate(protocol: ChromeProtocol, path: str) -> None:
    protocol.command("Page.navigate", {"url": f"{BASE_URL}{path}"})
    wait(protocol)


def set_viewport(protocol: ChromeProtocol, width: int, height: int, mobile: bool) -> None:
    protocol.command(
        "Emulation.setDeviceMetricsOverride",
        {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": mobile},
    )


def main() -> int:
    chrome = subprocess.Popen(
        [
            CHROME,
            "--headless=new",
            "--no-sandbox",
            "--disable-gpu",
            "--disable-background-networking",
            "--disable-component-update",
            "--no-first-run",
            "--no-default-browser-check",
            f"--user-data-dir={PROFILE}",
            f"--remote-debugging-port={PORT}",
            "--remote-allow-origins=*",
            f"{BASE_URL}/",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    results: list[dict] = []
    protocol: ChromeProtocol | None = None
    try:
        protocol = ChromeProtocol(wait_for_debugger())
        for domain in ("Page", "Runtime", "Log", "Network"):
            protocol.command(f"{domain}.enable")

        # Desktop, tablet, and mobile layout checks.
        for label, width, height, mobile in (
            ("desktop", 1440, 1200, False),
            ("tablet", 834, 1112, True),
            ("mobile", 390, 844, True),
        ):
            set_viewport(protocol, width, height, mobile)
            navigate(protocol, "/")
            top_screenshot = protocol.command(
                "Page.captureScreenshot",
                {"format": "png", "captureBeyondViewport": False},
            )
            Path(f"/tmp/soft-heaven-{label}-top.png").write_bytes(base64.b64decode(top_screenshot["data"]))
            protocol.evaluate("document.querySelector('#featured')?.scrollIntoView({block: 'start'})")
            wait(protocol, .5)
            metrics = protocol.evaluate(
                """({
                  overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
                  productCards: document.querySelectorAll('.product-card').length,
                  productImages: [...document.querySelectorAll('.product-card img')].map((image) => image.currentSrc || image.src),
                  productPrices: [...document.querySelectorAll('.product-card__price')].map((price) => price.textContent || ''),
                  logo: document.querySelector('.brand-mark__image')?.currentSrc || '',
                  heading: document.querySelector('h1')?.textContent?.trim() || '',
                  menuButton: Boolean(document.querySelector('.menu-button')),
                  searchButton: Boolean(document.querySelector('[aria-label="Search Soft Heaven"]')),
                  whatsappNumberVisible: (() => {
                    const href = document.querySelector('a[href^="https://wa.me/"]')?.getAttribute('href') || ''
                    const number = href.split('/')[3]?.split('?')[0] || ''
                    return Boolean(number && document.body.innerText.includes(number))
                  })(),
                  priceNotice: document.body.innerText.includes('Illustrative prices for planning only'),
                  giftGroups: document.querySelectorAll('.gift-discovery__card').length,
                  productFrame: getComputedStyle(document.querySelector('.storefront-image--product')).aspectRatio,
                  artificialBackdrop: Boolean(document.querySelector('.storefront-image__backdrop')),
                  imageSurface: getComputedStyle(document.querySelector('.storefront-image--product')).backgroundColor
                })"""
            )
            check(results, f"{label} layout has no horizontal overflow", not metrics["overflow"])
            check(results, f"{label} homepage shows all seven products", metrics["productCards"] == 7, str(metrics["productCards"]))
            check(results, f"{label} logo uses transparent supplied derivative", metrics["logo"].endswith("soft-heaven-logo-transparent.png"))
            check(results, f"{label} product delivery uses WebP", all("/optimized/" in source for source in metrics["productImages"]))
            check(results, f"{label} shows seven illustrative prices", len(metrics["productPrices"]) == 7 and all("Illustrative" in price for price in metrics["productPrices"]))
            check(results, f"{label} makes sample pricing obvious", metrics["priceNotice"])
            check(results, f"{label} does not print the WhatsApp number", not metrics["whatsappNumberVisible"])
            check(results, f"{label} uses 4:5 product frames", metrics["productFrame"] in ("0.8 / 1", "4 / 5"), metrics["productFrame"])
            check(results, f"{label} has no artificial image backdrop", not metrics["artificialBackdrop"])
            check(results, f"{label} uses a warm image surface", metrics["imageSurface"] not in ("rgb(128, 128, 128)", "rgb(211, 211, 211)"), metrics["imageSurface"])
            check(results, f"{label} shows three gift discovery edits", metrics["giftGroups"] == 3, str(metrics["giftGroups"]))
            if mobile:
                check(results, f"{label} navigation controls are present", metrics["menuButton"] and metrics["searchButton"])
            screenshot = protocol.command(
                "Page.captureScreenshot",
                {"format": "png", "captureBeyondViewport": False},
            )
            Path(f"/tmp/soft-heaven-{label}-check.png").write_bytes(base64.b64decode(screenshot["data"]))

        # Mobile menu keyboard cycle.
        set_viewport(protocol, 390, 844, True)
        navigate(protocol, "/")
        protocol.evaluate("document.querySelector('.menu-button')?.click()")
        wait(protocol)
        menu_state = protocol.evaluate(
            """({open: Boolean(document.querySelector('.mobile-nav')), locked: document.body.classList.contains('menu-is-open'), active: document.activeElement?.tagName})"""
        )
        check(results, "mobile menu opens and locks page scroll", menu_state["open"] and menu_state["locked"])
        check(results, "mobile menu moves focus into navigation", menu_state["active"] == "A", menu_state["active"])
        protocol.evaluate("document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}))")
        wait(protocol, .3)
        menu_closed = protocol.evaluate("({closed: !document.querySelector('.mobile-nav'), active: document.activeElement?.className || ''})")
        check(results, "Escape closes mobile menu", menu_closed["closed"])
        check(results, "mobile menu restores focus to trigger", "menu-button" in menu_closed["active"], menu_closed["active"])

        # Search results and useful no-result feedback.
        set_viewport(protocol, 1440, 1200, False)
        navigate(protocol, "/")
        protocol.evaluate("document.querySelector('[aria-label=\"Search Soft Heaven\"]')?.click()")
        wait(protocol, .2)
        protocol.command("Input.insertText", {"text": "bouquet"})
        wait(protocol, .4)
        search_state = protocol.evaluate(
            """({results: document.querySelectorAll('.search-panel__results li').length, noResults: Boolean(document.querySelector('.search-panel__no-results')), prices: [...document.querySelectorAll('.search-result__price')].map((price) => price.textContent || '')})"""
        )
        check(results, "search returns bouquet results", search_state["results"] >= 2 and not search_state["noResults"], str(search_state))
        check(results, "search results display illustrative prices", len(search_state["prices"]) >= 2 and all("Illustrative" in price for price in search_state["prices"]), str(search_state["prices"]))
        protocol.evaluate("document.querySelector('.search-panel__clear')?.click()")
        wait(protocol, .2)
        protocol.command("Input.insertText", {"text": "not-a-soft-heaven-piece"})
        wait(protocol, .3)
        check(results, "search gives a no-results state", bool(protocol.evaluate("Boolean(document.querySelector('.search-panel__no-results'))")))

        # Product pricing is visible but remains explicitly illustrative and ineligible for the bag.
        navigate(protocol, "/products/blue-flower-keychain")
        price_state = protocol.evaluate("({price: document.querySelector('.product-page__price-block strong')?.textContent || '', qualifier: document.querySelector('.product-page__price-qualifier')?.textContent || '', notice: document.querySelector('.product-page__price-block p')?.textContent || '', bag: Boolean([...document.querySelectorAll('.product-page__actions a, .product-page__actions button')].find((element) => element.textContent?.includes('Add to shopping bag')))})")
        check(results, "product detail displays an illustrative INR price", price_state["qualifier"] == "Illustrative" and "₹299" in price_state["price"], str(price_state))
        check(results, "product detail explains sample pricing", "Example pricing only" in price_state["notice"], price_state["notice"])
        check(results, "illustrative pricing does not enable bag purchase", not price_state["bag"])
        related_state = protocol.evaluate("({cards: document.querySelectorAll('.product-related .product-card').length, status: document.querySelector('.product-page__availability-status')?.textContent || ''})")
        check(results, "product detail shows related same-collection products", related_state["cards"] > 0, str(related_state))
        check(results, "product detail shows explicit enquiry-only status", related_state["status"] == "Enquiry only", related_state["status"])

        # Product detail, real image, enquiry URL, lightbox, Escape, and focus restoration.
        navigate(protocol, "/products/blue-flower-keychain")
        detail_state = protocol.evaluate(
            """({
              title: document.title,
              image: document.querySelector('.product-page__visual img')?.currentSrc || '',
              alt: document.querySelector('.product-page__visual img')?.alt || '',
              whatsapp: [...document.querySelectorAll('a[href^="https://wa.me/"]')].map((link) => new URL(link.href).searchParams.get('text') || ''),
              email: [...document.querySelectorAll('a[href^="mailto:"]')].map((link) => link.href)
            })"""
        )
        check(results, "product detail loads the real product image", "/optimized/" in detail_state["image"] and bool(detail_state["alt"]))
        check(results, "product WhatsApp enquiry includes name and URL", any("Blue Crochet Flower Keychain" in message and "/products/blue-flower-keychain" in message for message in detail_state["whatsapp"]))
        check(results, "product email enquiry includes the product", any("blue-flower-keychain" in link for link in detail_state["email"]))
        protocol.evaluate("document.querySelector('.product-page__image-trigger')?.click()")
        wait(protocol, .2)
        dialog_state = protocol.evaluate("({dialog: Boolean(document.querySelector('.product-image-lightbox')), active: document.activeElement?.getAttribute('aria-label') || ''})")
        check(results, "product image dialog opens", dialog_state["dialog"])
        check(results, "product image dialog focuses close control", dialog_state["active"] == "Close larger product image", dialog_state["active"])
        protocol.evaluate("document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}))")
        wait(protocol, .2)
        lightbox_closed = protocol.evaluate("({closed: !document.querySelector('.product-image-lightbox'), active: document.activeElement?.className || ''})")
        check(results, "Escape closes product image dialog", lightbox_closed["closed"])
        check(results, "image dialog restores focus to trigger", "product-page__image-trigger" in lightbox_closed["active"], lightbox_closed["active"])

        set_viewport(protocol, 390, 844, True)
        navigate(protocol, "/products/blue-flower-keychain")
        mobile_product_state = protocol.evaluate("({overflow: document.documentElement.scrollWidth > window.innerWidth + 1, sticky: getComputedStyle(document.querySelector('.product-page__mobile-enquiry')).display !== 'none'})")
        check(results, "mobile product detail has no overflow", not mobile_product_state["overflow"])
        check(results, "mobile product detail exposes sticky WhatsApp enquiry", mobile_product_state["sticky"])
        set_viewport(protocol, 1440, 1200, False)

        # Wishlist persistence and removal.
        protocol.evaluate("localStorage.clear()")
        navigate(protocol, "/")
        protocol.evaluate("document.querySelector('.product-card .wishlist-toggle')?.click()")
        wait(protocol, .3)
        wishlist_state = protocol.evaluate(
            """({
              pressed: document.querySelector('.product-card .wishlist-toggle')?.getAttribute('aria-pressed'),
              stored: localStorage.getItem('soft-heaven:wishlist:v1') || '',
              header: document.querySelector('.header-count-link[aria-label^="Wishlist"]')?.getAttribute('aria-label') || ''
            })"""
        )
        check(results, "wishlist add gives pressed feedback", wishlist_state["pressed"] == "true")
        check(results, "wishlist persists the canonical product", "red-pink-bouquet" in wishlist_state["stored"])
        check(results, "wishlist count updates in header", "1 saved item" in wishlist_state["header"])
        navigate(protocol, "/wishlist")
        wishlist_rendered = protocol.evaluate("({item: Boolean(document.querySelector('.wishlist-item')), price: document.querySelector('.wishlist-item .product-card__price')?.textContent || ''})")
        check(results, "wishlist route renders saved product", wishlist_rendered["item"])
        check(results, "wishlist displays illustrative price consistently", "Illustrative" in wishlist_rendered["price"], wishlist_rendered["price"])
        navigate(protocol, "/")
        protocol.command("Page.reload")
        wait(protocol)
        check(results, "wishlist survives a refresh", "1 saved item" in protocol.evaluate("document.querySelector('.header-count-link[aria-label^=\"Wishlist\"]')?.getAttribute('aria-label') || ''"))
        protocol.evaluate("document.querySelector('.product-card .wishlist-toggle')?.click()")
        wait(protocol, .2)
        check(results, "wishlist removal updates local state", "0 saved items" in protocol.evaluate("document.querySelector('.header-count-link[aria-label^=\"Wishlist\"]')?.getAttribute('aria-label') || ''"))

        protocol.evaluate("localStorage.setItem('soft-heaven:wishlist:v1', '{not valid json')")
        navigate(protocol, "/")
        check(results, "malformed wishlist storage fails safely", "0 saved items" in protocol.evaluate("document.querySelector('.header-count-link[aria-label^=\"Wishlist\"]')?.getAttribute('aria-label') || ''"))
        protocol.evaluate("localStorage.setItem('soft-heaven:wishlist:v1', JSON.stringify(['red-pink-bouquet', 'red-pink-bouquet', 'unknown-slug']))")
        navigate(protocol, "/")
        check(results, "wishlist storage deduplicates and filters unknown slugs", "1 saved item" in protocol.evaluate("document.querySelector('.header-count-link[aria-label^=\"Wishlist\"]')?.getAttribute('aria-label') || ''"))

        # Bag stale-item filtering and clear confirmation without inventing a price.
        protocol.evaluate(
            "localStorage.setItem('soft-heaven:bag:v1', JSON.stringify({version: 1, items: [{slug: 'stale-item', quantity: 2}, {slug: 'blue-flower-keychain', quantity: 60}, {slug: 'blue-flower-keychain', quantity: 60}]}))"
        )
        navigate(protocol, "/bag")
        bag_state = protocol.evaluate("({items: document.querySelectorAll('.bag-item').length, stale: document.body.innerText.includes('stale-item'), sample: document.body.innerText.includes('illustrative price'), price: document.querySelector('.bag-item__price')?.textContent || '', quantity: document.querySelector('.quantity-stepper input')?.value || ''})")
        check(results, "bag removes stale stored products", bag_state["items"] == 1 and not bag_state["stale"])
        check(results, "bag keeps honest illustrative-price state", bag_state["sample"])
        check(results, "bag displays illustrative price consistently", "Illustrative" in bag_state["price"], bag_state["price"])
        check(results, "bag clamps duplicate stored quantities safely", bag_state["quantity"] == "99", bag_state["quantity"])
        protocol.evaluate("window.confirm = () => true; document.querySelector('.bag-clear')?.click()")
        wait(protocol, .3)
        check(results, "bag clear confirmation removes stored items", protocol.evaluate("JSON.parse(localStorage.getItem('soft-heaven:bag:v1') || '{\"items\":[]}').items.length === 0"))

        # Direct routes, all seven product images, policy links, and history.
        product_paths = (
            "/products/red-pink-bouquet",
            "/products/blue-red-bouquet",
            "/products/blue-flower-keychain",
            "/products/white-flower-keychain",
            "/products/strawberry-keychain",
            "/products/pink-heart-keychain",
            "/products/sunflower-keychain",
        )
        for path in product_paths:
            navigate(protocol, path)
            state = protocol.evaluate("({title: document.title, image: document.querySelector('.product-page__visual img')?.currentSrc || '', h1: document.querySelector('h1')?.textContent || '', price: document.querySelector('.product-page__price-block strong')?.textContent || '', qualifier: document.querySelector('.product-page__price-qualifier')?.textContent || ''})")
            check(results, f"direct product route loads {path.rsplit('/', 1)[-1]}", state["title"].endswith("| Soft Heaven") and bool(state["image"]) and bool(state["h1"]))
            check(results, f"direct product route shows illustrative price {path.rsplit('/', 1)[-1]}", state["qualifier"] == "Illustrative" and "₹" in state["price"], str(state))

        for path in ("/collections/flowers-bouquets", "/collections/keychains-keepsakes"):
            navigate(protocol, path)
            collection_state = protocol.evaluate("({title: document.title, heading: document.querySelector('h1')?.textContent || '', cards: document.querySelectorAll('.product-card').length})")
            check(results, f"direct collection route loads {path.rsplit('/', 1)[-1]}", collection_state["title"].endswith("| Soft Heaven") and bool(collection_state["heading"]) and collection_state["cards"] > 0)

        policy_paths = ("/contact", "/how-to-order", "/payment-information", "/shipping-delivery", "/returns-cancellations", "/privacy-policy", "/terms-conditions", "/not-a-route")
        for path in policy_paths:
            navigate(protocol, path)
            check(results, f"direct route loads {path}", bool(protocol.evaluate("Boolean(document.querySelector('main#main-content h1, main#main-content h2'))")))

        navigate(protocol, "/contact")
        protocol.evaluate("document.querySelector('#gift-occasion')?.focus()")
        protocol.command("Input.insertText", {"text": "birthday"})
        protocol.evaluate("[...document.querySelectorAll('.gift-enquiry fieldset input')].forEach((input) => input.click())")
        wait(protocol, .3)
        gift_state = protocol.evaluate("new URL(document.querySelector('.gift-enquiry a[href^=\"https://wa.me/\"]')?.href || 'https://example.com').searchParams.get('text') || ''")
        check(results, "gift enquiry includes occasion and selected extras", "birthday" in gift_state and "gift wrapping" in gift_state and "personal note" in gift_state, gift_state)
        contact_number_visible = protocol.evaluate("(() => { const href = document.querySelector('a[href^=\"https://wa.me/\"]')?.getAttribute('href') || ''; const number = href.split('/')[3]?.split('?')[0] || ''; return Boolean(number && document.body.innerText.includes(number)); })()")
        check(results, "contact page does not print the WhatsApp number", not contact_number_visible)

        navigate(protocol, "/")
        footer_links = protocol.evaluate("[...document.querySelectorAll('footer a')].map((link) => link.getAttribute('href')).filter(Boolean)")
        check(results, "footer links all have destinations", len(footer_links) >= 12 and all(href not in ('#', '') for href in footer_links), str(footer_links))
        homepage_enquiry = protocol.evaluate("new URL(document.querySelector('.contact-action-grid a')?.href || 'https://example.com').searchParams.get('text') || ''")
        check(results, "homepage product enquiry includes product page context", "Blue & Red Crochet Flower Bouquet" in homepage_enquiry and "/products/blue-red-bouquet" in homepage_enquiry)
        navigate(protocol, "/collections/flowers-bouquets")
        history = protocol.command("Page.getNavigationHistory")
        previous_entry = history["entries"][history["currentIndex"] - 1]
        protocol.command("Page.navigateToHistoryEntry", {"entryId": previous_entry["id"]})
        wait(protocol)
        check(results, "browser back returns to homepage", protocol.evaluate("location.pathname") == "/")

        protocol.drain(.5)
        browser_errors = [
            event for event in protocol.events
            if (event.get("method") == "Runtime.exceptionThrown")
            or (event.get("method") == "Log.entryAdded" and event.get("params", {}).get("entry", {}).get("level") == "error")
        ]
        network_failures = [
            event for event in protocol.events
            if event.get("method") == "Network.loadingFailed"
            and event.get("params", {}).get("type") != "Document"
            and event.get("params", {}).get("errorText") not in ("net::ERR_ABORTED", "net::ERR_CACHE_MISS")
        ]
        check(results, "browser console has no uncaught errors", not browser_errors, str(browser_errors[:2]))
        check(results, "browser has no failed asset requests", not network_failures, str(network_failures[:3]))

        failed = [result for result in results if not result["passed"]]
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
