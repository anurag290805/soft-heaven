import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { Check, PackageCheck } from 'lucide-react'
import { ButtonLink } from './ButtonLink'
import { StorefrontPage } from './StorefrontPage'
import { formatConfirmedPrice } from '../data/catalogue'
import { commerceConfiguration, getCurrentSession, getOrder, resumeOrder, syncOrderPayment, type AuthUser, type OrderDetails } from '../data/commerce'
import { openSecurePayment } from '../data/payment'
import { finishPendingCheckout } from '../state/checkoutPersistence'
import { useStorefront } from '../state/storefrontContext'
import { useCommerceSession } from '../state/useCommerceSession'

const money = (amount: number) => formatConfirmedPrice({ amount, currency: 'INR' })

export function OrderConfirmationPage({ id, confirmation = true }: { id?: string; confirmation?: boolean }) {
  const orderId = id ?? new URLSearchParams(window.location.search).get('order')
  const { user, message } = useCommerceSession()
  if (user) return <CustomerOrder key={`${user.id}:${orderId}`} user={user} orderId={orderId} confirmation={confirmation} />
  return <StorefrontPage title="Your order" eyebrow="YOUR SOFT HEAVEN ORDER" introduction="Order details are visible only to the account that placed it."><div className="selection-empty commerce-empty"><h2>Sign in to view your order.</h2><p>{message}</p><ButtonLink href={`/login?redirect=${encodeURIComponent(orderId ? `/orders/${orderId}` : '/orders')}`}>Sign in</ButtonLink></div></StorefrontPage>
}

function CustomerOrder({ user, orderId, confirmation }: { user: AuthUser; orderId: string | null; confirmation: boolean }) {
  const [order, setOrder] = useState<OrderDetails | null>(null)
  const [message, setMessage] = useState(orderId ? 'Checking your order…' : 'A verified order reference will appear here after checkout.')
  const [loading, setLoading] = useState(Boolean(orderId))
  const [busy, setBusy] = useState(false)
  const { consumePurchasedItems } = useStorefront()

  useEffect(() => {
    if (!orderId) return
    let active = true
    void getOrder(orderId, user.id).then(async (result) => {
      if (!active) return
      setLoading(false)
      if (!result.ok) { setMessage(result.message); return }
      setOrder(result.data)
      setMessage('')
      if (result.data.paymentStatus === 'paid') {
        const current = await getCurrentSession()
        if (active && current.ok && current.data.id === user.id) consumePurchasedItems(finishPendingCheckout(user.id, result.data.id))
      }
    })
    return () => { active = false }
  }, [orderId, consumePurchasedItems, user.id])

  async function refresh() {
    if (!orderId || busy) return
    setBusy(true)
    const synced = await syncOrderPayment(orderId)
    const result = await getOrder(orderId, user.id)
    setBusy(false)
    if (!result.ok) { setOrder(null); setMessage(result.message); return }
    setOrder(result.data)
    setMessage(synced.ok ? result.data.paymentStatus === 'pending' ? 'No captured payment has been confirmed yet. If your bank shows a charge, wait and check again before paying.' : '' : synced.message)
    if (result.data.paymentStatus === 'paid') {
      const current = await getCurrentSession()
      if (current.ok && current.data.id === user.id) consumePurchasedItems(finishPendingCheckout(user.id, result.data.id))
    }
  }

  async function retryPayment() {
    if (!order || busy) return
    setBusy(true)
    const current = await getCurrentSession()
    if (!current.ok || current.data.id !== user.id) { setOrder(null); setMessage('The account session changed. Sign in again.'); setBusy(false); return }
    const setup = await resumeOrder(order.id)
    if (!setup.ok) { setMessage(setup.message); setBusy(false); return }
    const payment = await openSecurePayment(setup.data, user, order.address)
    setBusy(false)
    if (!payment.ok) { setMessage(payment.message); return }
    const afterPayment = await getCurrentSession()
    if (!afterPayment.ok || afterPayment.data.id !== user.id) return
    flushSync(() => consumePurchasedItems(finishPendingCheckout(user.id, order.id)))
    const refreshed = await getOrder(order.id, user.id)
    if (refreshed.ok) { setOrder(refreshed.data); setMessage('') }
    else setMessage(refreshed.message)
  }

  const paid = order?.paymentStatus === 'paid'
  const confirmed = paid && order?.status !== 'cancelled'
  return (
    <StorefrontPage title={confirmation && confirmed ? 'Order confirmed' : 'Your order'} eyebrow="YOUR SOFT HEAVEN ORDER" introduction={confirmed ? 'Your order is confirmed. Payment has been verified and your details are saved in your account.' : paid ? 'Payment was received for a cancelled order. Contact Soft Heaven to review it.' : 'Order and payment status are checked against your account.'}>
      <div className="confirmation-card">
        {paid && <span className="confirmation-card__icon"><Check aria-hidden="true" size={22} strokeWidth={1.7} /></span>}
        <h2>{order?.orderNumber ?? (loading ? 'Checking securely…' : 'No verified order to show.')}</h2>
        {order && <>
          <p><time dateTime={order.createdAt}>{new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</time></p>
          <div className="order-status-row"><span>Payment: <strong>{order.paymentStatus === 'paid' ? 'Verified' : order.paymentStatus === 'refunded' ? 'Refunded' : 'Not yet confirmed'}</strong></span><span>Order: <strong>{order.status === 'pending-payment' ? 'Awaiting payment' : order.status}</strong></span></div>
          <div className="order-details-grid">
            <section><h3>Your pieces</h3>{order.items.map((item) => <div className="order-detail-item" key={`${item.slug}-${item.variantId}`}><img src={item.photo} width="64" height="80" alt={`${item.name}${item.colour ? ` in ${item.colour}` : ''}`} loading="lazy" /><div><strong>{item.name}</strong>{item.colour && <p>{item.colour}</p>}<p>Qty {item.quantity} · {money(item.unitPrice / 100)} each</p><p><strong>Line total {money(item.lineTotal / 100)}</strong></p></div></div>)}</section>
            <section><h3>Delivery details</h3><address>{order.address.fullName}<br />{order.address.addressLine1}<br />{order.address.addressLine2 && <>{order.address.addressLine2}<br /></>}{order.address.city}, {order.address.state} {order.address.postalCode}</address><p>{order.deliveryNote}</p>{order.trackingReference && <p>Tracking reference: {order.trackingReference}</p>}<dl className="order-totals"><div><dt>Subtotal</dt><dd>{money(order.subtotal)}</dd></div><div><dt>Shipping</dt><dd>{money(order.shipping)}</dd></div><div><dt>Total</dt><dd>{money(order.total)}</dd></div></dl></section>
          </div>
          {order.paymentStatus === 'pending' && <p>Your payment is not confirmed. Use “Check payment status” to verify it with the provider. If you were charged, check before attempting another payment.</p>}
        </>}
        {message && <p className="commerce-status" role="status">{message}</p>}
        {paid && <PackageCheck aria-hidden="true" className="confirmation-card__art" size={58} strokeWidth={.8} />}
        <div className="commerce-actions">
          {order?.paymentStatus === 'pending' && <button className="button button--dark" type="button" disabled={busy || !commerceConfiguration.razorpayConfigured} onClick={refresh}>{busy ? 'Checking securely…' : 'Check payment status'}</button>}
          {order?.paymentStatus === 'pending' && order.status !== 'cancelled' && <button className="button button--text" type="button" disabled={busy || !commerceConfiguration.razorpayConfigured} onClick={retryPayment}>Retry payment</button>}
          {confirmation && order && <ButtonLink href={`/orders/${order.id}`}>View order</ButtonLink>}
          {!order && <ButtonLink href={`/login?redirect=${encodeURIComponent(orderId ? `/orders/${orderId}` : '/orders')}`}>Sign in</ButtonLink>}
          <ButtonLink href="/#featured" variant="text" icon="up-right">Continue shopping</ButtonLink><ButtonLink href="/orders" variant="text">All orders</ButtonLink>
        </div>
      </div>
    </StorefrontPage>
  )
}
