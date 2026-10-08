import { getCurrentSession, onAuthStateChange, verifyPayment, type AuthUser, type CommerceResult, type CreateOrderResult, type DeliveryAddress } from './commerce'

let checkoutScript: Promise<RazorpayConstructor> | undefined

function loadRazorpay(): Promise<RazorpayConstructor> {
  if (window.Razorpay) return Promise.resolve(window.Razorpay)
  if (checkoutScript) return checkoutScript
  checkoutScript = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    const timeout = window.setTimeout(() => fail(), 20000)
    function fail() {
      window.clearTimeout(timeout)
      script.remove()
      checkoutScript = undefined
      reject(new Error('Secure payment could not be loaded. Please check your connection and try again.'))
    }
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => {
      window.clearTimeout(timeout)
      if (window.Razorpay) resolve(window.Razorpay)
      else fail()
    }
    script.onerror = fail
    document.head.appendChild(script)
  })
  return checkoutScript
}

export async function openSecurePayment(order: CreateOrderResult, user: AuthUser, address: DeliveryAddress): Promise<CommerceResult<string>> {
  if (order.paid) return { ok: true, data: order.orderId }
  if (!order.providerOrderId || !order.keyId || !order.amount || order.currency !== 'INR') return { ok: false, code: 'request-failed', message: 'Payment setup is incomplete. Review your order from your account before trying again.' }
  try {
    const Razorpay = await loadRazorpay()
    const current = await getCurrentSession()
    if (!current.ok || current.data.id !== user.id) return { ok: false, code: 'unauthenticated', message: 'Your account session changed. Sign in again to continue.' }
    return await new Promise((resolve) => {
      let verifying = false
      let settled = false
      const unsubscribeRef: { current?: () => void } = {}
      const finish = (result: CommerceResult<string>) => { if (!settled) { settled = true; unsubscribeRef.current?.(); resolve(result) } }
      let failureMessage: string | null = null
      const checkout = new Razorpay({
        key: order.keyId!, amount: order.amount!, currency: 'INR', order_id: order.providerOrderId!,
        name: 'Soft Heaven', description: 'Handcrafted crochet order',
        prefill: { name: address.fullName, email: user.email, contact: address.phone },
        modal: { ondismiss: () => {
          if (!verifying) finish({ ok: false, code: 'request-failed', message: failureMessage ?? 'Payment was closed. We have not confirmed payment here. Check your order status before paying again.' })
        } },
        handler: async (response) => {
          if (verifying || settled) return
          verifying = true
          try {
            const result = await verifyPayment(order.orderId, response.razorpay_order_id, response.razorpay_payment_id, response.razorpay_signature)
            finish(result.ok && result.data.paid && result.data.orderId === order.orderId ? { ok: true, data: result.data.orderId } : result.ok ? { ok: false, code: 'request-failed', message: 'Payment is awaiting verification. Check your orders before paying again.' } : { ...result, message: `${result.message} Your payment may still be processing; check your order before paying again.` })
          } catch {
            finish({ ok: false, code: 'request-failed', message: 'Payment verification was interrupted. Your payment status is unknown here. Check your order before paying again.' })
          }
        },
      })
      // Razorpay can retry inside its modal after a failed attempt. Wait for a
      // successful handler or dismissal so that an in-modal retry is not lost.
      checkout.on('payment.failed', () => {
        failureMessage = 'Payment did not complete. Review your order details to retry. If you were charged, wait for the verified status before paying again.'
      })
      unsubscribeRef.current = onAuthStateChange((next) => {
        if (!settled && next?.id !== user.id) {
          finish({ ok: false, code: 'unauthenticated', message: 'Your account session changed. Check this order after signing in again.' })
          checkout.close()
        }
      })
      try { checkout.open() } catch { finish({ ok: false, code: 'request-failed', message: 'Payment could not be opened. Check the order in your account before retrying.' }) }
    })
  } catch {
    return { ok: false, code: 'request-failed', message: 'Secure payment could not be opened. Check the order in your account before retrying.' }
  }
}
