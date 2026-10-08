import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { ArrowRight, LockKeyhole, MapPin } from 'lucide-react'
import { ButtonLink } from './ButtonLink'
import { DeliveryAddressFields } from './DeliveryAddressFields'
import { StorefrontImage } from './StorefrontImage'
import { StorefrontPage } from './StorefrontPage'
import { commerceConfiguration, createOrder, emptyDeliveryAddress, getCurrentSession, getAddresses, normalizeAddress, quoteCheckout, saveAddress, validateAddress, type AuthUser, type CheckoutQuote, type DeliveryAddress, type SavedAddress } from '../data/commerce'
import { openSecurePayment } from '../data/payment'
import { formatConfirmedPrice, getProductPriceDisplay } from '../data/catalogue'
import { useStorefront } from '../state/storefrontContext'
import { rememberPendingCheckout, readPendingCheckout, finishPendingCheckout } from '../state/checkoutPersistence'
import { useCommerceSession } from '../state/useCommerceSession'

const money = (paise: number) => formatConfirmedPrice({ amount: paise / 100, currency: 'INR' })

export function CheckoutPage() {
  const { user, checked } = useCommerceSession()
  return <CheckoutContent key={user?.id ?? 'guest'} user={user} sessionChecked={checked} />
}
function CheckoutContent({ user, sessionChecked }: { user: AuthUser | null; sessionChecked: boolean }) {
  const { cartLines, cartCount, cartSubtotal, cartHasUnavailableItems, consumePurchasedItems } = useStorefront()
  const [address, setAddress] = useState<DeliveryAddress>(emptyDeliveryAddress)
  const [saveDelivery, setSaveDelivery] = useState(false)
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([])
  const [status, setStatus] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [review, setReview] = useState<{ quote: CheckoutQuote; fingerprint: string } | null>(null)
  const [pendingOrder, setPendingOrder] = useState<string | null>(null)
  const request = useRef<{ fingerprint: string; id: string; storageKey: string } | null>(null)
  const eligibleLines = useMemo(() => cartLines.filter((line) => line.product && line.eligibility.eligible), [cartLines])
  const lines = eligibleLines.map((line) => ({ slug: line.slug, ...(line.variantId ? { variantId: line.variantId } : {}), quantity: line.quantity }))
  const normalized = normalizeAddress(address)
  const fingerprint = JSON.stringify({ lines, address: normalized })
  const quote = review?.fingerprint === fingerprint ? review.quote : null
  const userId = user?.id

  useEffect(() => {
    let active = true
    if (!userId) return
    void getAddresses(userId).then((saved) => {
      if (active) {
        setPendingOrder(readPendingCheckout(userId)?.orderId ?? null)
        if (active && saved.ok) {
          setSavedAddresses(saved.data)
          if (saved.data[0]) setAddress(saved.data[0].address)
        }
      }
    })
    return () => { active = false }
  }, [userId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting || !user || cartHasUnavailableItems) return
    const issue = validateAddress(normalized)
    if (issue) { setStatus(issue); return }
    setStatus(null)
    setIsSubmitting(true)
    if (!quote) {
      const result = await quoteCheckout(lines, normalized)
      setIsSubmitting(false)
      if (!result.ok) { setStatus(result.message); return }
      setReview({ quote: result.data, fingerprint })
      return
    }
    // Retain the key after cancellation/network failure; never create a fresh
    // order for retries of the same selection and delivery address.
    if (request.current?.fingerprint !== fingerprint) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint))
      const storageKey = `soft-heaven:checkout:${user.id}:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
      let id = crypto.randomUUID() as string
      try {
        const saved = sessionStorage.getItem(storageKey)
        if (saved && /^[a-f0-9-]{36}$/i.test(saved)) id = saved
        sessionStorage.setItem(storageKey, id)
      } catch { /* in-memory retries still work when storage is blocked */ }
      request.current = { fingerprint, id, storageKey }
    }
    if (saveDelivery) {
      const saved = await saveAddress(normalized)
      if (!saved.ok) { setIsSubmitting(false); setStatus(saved.message); return }
    }
    const result = await createOrder({ clientRequestId: request.current.id, deliveryAddress: normalized, expectedTotal: quote.total, lines })
    if (!result.ok) { setIsSubmitting(false); setReview(null); setStatus(result.message); return }
    rememberPendingCheckout(user.id, result.data.orderId, lines, request.current.storageKey)
    setPendingOrder(result.data.orderId)
    const paid = await openSecurePayment(result.data, user, normalized)
    setIsSubmitting(false)
    if (!paid.ok) { setStatus(paid.message); return }
    const current = await getCurrentSession()
    if (!current.ok || current.data.id !== user.id) { setStatus('The account session changed. Check this order after signing in again.'); return }
    flushSync(() => consumePurchasedItems(lines))
    finishPendingCheckout(user.id, paid.data)
    window.location.href = `/order-confirmation?order=${encodeURIComponent(paid.data)}`
  }

  if (!cartLines.length) return <StorefrontPage title="Checkout" eyebrow="YOUR ORDER"><div className="selection-empty commerce-empty"><h2>Your bag is empty.</h2><p>Choose a piece from the catalogue to begin checkout.</p><div className="selection-empty__actions"><ButtonLink href="/#featured">Explore the catalogue</ButtonLink></div></div></StorefrontPage>

  return (
    <StorefrontPage title="Checkout" eyebrow="YOUR SOFT HEAVEN ORDER" introduction="Add your address, review the confirmed total, and pay securely with Razorpay.">
      <div className="checkout-layout">
        <div className="checkout-main">
          {!sessionChecked ? <section className="commerce-panel" role="status"><p>Checking your account…</p></section> : !user ? (
            <section className="commerce-panel checkout-auth-gate">
              <span className="auth-card__icon"><LockKeyhole aria-hidden="true" size={18} strokeWidth={1.5} /></span>
              <h2>Sign in before you place an order.</h2>
              <p>Your account keeps delivery details and order history together. Passwords are handled by Supabase Auth.</p>
              {!commerceConfiguration.apiConfigured && <p className="commerce-status">Checkout is awaiting the Supabase connection. You can keep browsing and save your selection.</p>}
              <div className="commerce-actions"><ButtonLink href="/login?redirect=/checkout">Sign in to checkout</ButtonLink><ButtonLink href="/register?redirect=/checkout" variant="text" icon="up-right">Create an account</ButtonLink></div>
            </section>
          ) : (
            <form className="checkout-form" onSubmit={handleSubmit}>
              {pendingOrder && <div className="commerce-status" role="status">You have an existing order to review. If a payment was attempted, check its verified status before paying again. <a className="text-action" href={`/orders/${pendingOrder}`}>View order & payment status</a></div>}
              <fieldset disabled={isSubmitting} className="checkout-section">
                <legend>Delivery address</legend>
                <h2>Where should we send it?</h2>
                {savedAddresses.length > 0 && <label className="saved-address-picker">Use a saved address<select defaultValue={savedAddresses[0].id} onChange={(event) => setAddress(savedAddresses.find((item) => item.id === event.target.value)?.address ?? emptyDeliveryAddress)}>{savedAddresses.map((item) => <option key={item.id} value={item.id}>{item.address.fullName} · {item.address.city} · {item.address.postalCode}</option>)}<option value="">A new address</option></select></label>}
                <DeliveryAddressFields address={address} onChange={setAddress} />
                <label className="commerce-checkbox"><input type="checkbox" checked={saveDelivery} onChange={(event) => setSaveDelivery(event.target.checked)} /> Save this address to my account</label>
              </fieldset>
              <section className="checkout-section">
                <h2>Review before you pay.</h2>
                <p>{quote ? quote.deliveryNote : 'We will confirm serviceability, catalogue prices, and shipping for your PIN code before opening payment.'}</p>
                {!commerceConfiguration.razorpayConfigured && <p className="commerce-status">Razorpay is not enabled in this environment yet.</p>}
                {quote && <p role="status">Total confirmed: <strong>{money(quote.total)}</strong>. Payment is confirmed only after server verification.</p>}
              </section>
              {status && <p className="commerce-status commerce-status--error" role="alert">{status}</p>}
              {status && <a className="text-action" href={pendingOrder ? `/orders/${pendingOrder}` : '/orders'}>Check your orders before another payment</a>}
              {cartHasUnavailableItems && <p className="commerce-status" role="alert">Some items are unavailable. <a href="/bag">Review your bag</a> before continuing.</p>}
              <button className="button button--dark checkout-submit" type="submit" disabled={isSubmitting || cartHasUnavailableItems || !commerceConfiguration.razorpayConfigured}>{isSubmitting ? 'Connecting securely…' : quote ? `Pay ${money(quote.total)}` : 'Review delivery & total'}<ArrowRight aria-hidden="true" size={16} strokeWidth={1.7} /></button>
            </form>
          )}
        </div>
        <aside className="checkout-summary" aria-labelledby="checkout-summary-title">
          <h2 id="checkout-summary-title">Your selected pieces.</h2>
          <div className="checkout-summary__items">{quote ? quote.items.map((item) => (
            <div className="checkout-summary__item" key={`${item.slug}-${item.variantId}`}><img src={item.photo} alt={item.name} width="56" height="56" /><div><strong>{item.name}</strong><span>{item.colour ? `${item.colour} · ` : ''}Qty {item.quantity}</span><small>{money(item.lineTotal)}</small></div></div>
          )) : eligibleLines.map((line) => {
            const product = line.product!
            const price = getProductPriceDisplay(product, line.variant)
            return <div className="checkout-summary__item" key={`${line.slug}-${line.variantId ?? ''}`}><div className="checkout-summary__image"><StorefrontImage kind="product" photo={line.variant?.photo ?? product.photo} placeholder={{ variant: product.variant, label: product.name }} /></div><div><strong>{product.name}</strong><span>{line.variant ? `${line.variant.colour} · ` : ''}Qty {line.quantity}</span><small>{money(Math.round(price.numericAmount * 100) * line.quantity)}</small></div></div>
          })}</div>
          <div className="checkout-summary__total"><span>Subtotal · {cartCount} item{cartCount === 1 ? '' : 's'}</span><strong>{money(quote?.subtotal ?? Math.round(cartSubtotal * 100))}</strong></div>
          <div className="checkout-summary__total"><span>Shipping</span><strong>{quote ? money(quote.shipping) : 'Awaiting address'}</strong></div>
          <div className="checkout-summary__total checkout-summary__total--grand"><span>Total</span><strong>{quote ? money(quote.total) : 'Pending delivery review'}</strong></div>
          <p className="checkout-summary__note"><MapPin aria-hidden="true" size={15} strokeWidth={1.5} /> {quote ? quote.deliveryNote : 'No delivery fee or date is assumed before your address is checked.'}</p>
          <a className="text-action" href="/bag">Edit your bag</a>
        </aside>
      </div>
    </StorefrontPage>
  )
}
