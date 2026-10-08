import { useEffect, useState } from 'react'
import { ButtonLink } from './ButtonLink'
import { StorefrontPage } from './StorefrontPage'
import { getOrders, type AuthUser, type OrderSummary } from '../data/commerce'
import { useCommerceSession } from '../state/useCommerceSession'
import { formatConfirmedPrice } from '../data/catalogue'

export function OrdersPage() {
  const { user, message } = useCommerceSession()
  return <StorefrontPage title="Your orders" eyebrow="THE DETAILS WORTH KEEPING" introduction="Your orders, payment status, and delivery updates appear here.">
    {user ? <OrderHistory key={user.id} user={user} /> : <div className="selection-empty commerce-empty"><h2>Your orders will appear here.</h2><p>{message}</p><ButtonLink href="/login?redirect=/orders">Sign in</ButtonLink></div>}
  </StorefrontPage>
}
function OrderHistory({ user }: { user: AuthUser }) {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null)
  const [message, setMessage] = useState('Loading your orders…')

  useEffect(() => {
    let active = true
    void getOrders(user.id).then((result) => {
      if (!active) return
      if (result.ok) { setOrders(result.data); setMessage('Choose a piece from the catalogue to start your first order.') }
      else setMessage(result.message)
    })
    return () => { active = false }
  }, [user.id])

  return (
    <>
      {orders && orders.length > 0 ? (
        <div className="orders-list">{orders.map((order) => <article className="order-card" key={order.id}><div><p className="eyebrow">{order.orderNumber}</p><h2>{formatConfirmedPrice({ amount: order.total, currency: order.currency })}</h2><small>{order.paymentStatus === 'paid' ? 'Payment verified' : order.paymentStatus === 'refunded' ? 'Payment refunded' : 'Payment not yet confirmed'}</small></div><div><span>{order.status === 'pending-payment' ? 'Awaiting payment' : order.status}</span><time dateTime={order.createdAt}>{new Date(order.createdAt).toLocaleDateString('en-IN')}</time><a href={`/orders/${order.id}`}>View order details</a></div></article>)}</div>
      ) : (
        <div className="selection-empty commerce-empty"><p className="eyebrow">ORDER HISTORY</p><h2>{orders ? 'No orders yet.' : 'Your orders will appear here.'}</h2><p>{message}</p><div className="selection-empty__actions"><ButtonLink href="/shop">Explore the catalogue</ButtonLink><ButtonLink href="/account" variant="text" icon="up-right">Back to account</ButtonLink></div></div>
      )}
    </>
  )
}
