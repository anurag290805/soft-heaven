import { createClient } from '@supabase/supabase-js'
import { isCapturedPayment, verifyHmac } from './payment.ts'

const required = (name: string) => {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing server configuration: ${name}`)
  return value
}
const db = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((origin) => origin.trim()).filter(Boolean)
const keyId = Deno.env.get('RAZORPAY_KEY_ID')
const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')
const commerceEnv = Deno.env.get('COMMERCE_ENV')
const paymentConfigured = Boolean(keyId && keySecret && Deno.env.get('RAZORPAY_WEBHOOK_SECRET')
  && ((commerceEnv === 'test' && keyId.startsWith('rzp_test_')) || (commerceEnv === 'live' && keyId.startsWith('rzp_live_'))))

async function razorpay(path: string, body?: Record<string, unknown>) {
  if (!keyId || !keySecret) throw new Error('Secure payment is not configured yet.')
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  })
  const data = await response.json()
  if (!response.ok) throw new Error('The payment provider could not complete the request. Try again shortly.')
  return data
}

async function confirm(payment: unknown, eventId?: string, eventType?: string) {
  if (!isCapturedPayment(payment)) throw new Error('Payment has not been captured. Check your orders before retrying payment.')
  const { data, error } = await db.rpc('confirm_payment', {
    p_provider_order: payment.order_id, p_payment: payment.id, p_amount: payment.amount,
    p_currency: payment.currency, p_event_id: eventId ?? null, p_event_type: eventType ?? 'checkout.verified',
  })
  if (error) throw new Error(error.message)
  return data
}

async function reconcile(providerOrderId: string): Promise<boolean> {
  const payments = await razorpay(`/orders/${encodeURIComponent(providerOrderId)}/payments`)
  if (!Array.isArray(payments.items)) throw new Error('Payment status is unavailable. Check again before attempting another payment.')
  const captured = payments.items.find((payment: unknown) => isCapturedPayment(payment))
  if (captured) {
    if (captured.order_id !== providerOrderId) throw new Error('Payment reference does not match the order.')
    await confirm(captured)
    return true
  }
  if (payments.items.some((payment: { status?: string }) => payment.status === 'authorized')) {
    throw new Error('Payment has been authorized and is awaiting capture. Please do not pay again; check your order shortly.')
  }
  return false
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin')
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Vary: 'Origin' }
  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type, x-client-info'
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
  }
  const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers })
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return respond({ message: 'Method not allowed.' }, 405)
  if (origin && !allowedOrigins.includes(origin)) return respond({ message: 'Origin not allowed.' }, 403)

  try {
    const reader = request.body?.getReader()
    let raw = ''
    if (reader) {
      const decoder = new TextDecoder()
      let bytes = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        bytes += value.byteLength
        if (bytes > 32000) { await reader.cancel(); return respond({ message: 'Request is too large.' }, 413) }
        raw += decoder.decode(value, { stream: true })
      }
      raw += decoder.decode()
    }
    // Webhooks use their raw body for verification, before parsing any payload.
    const signature = request.headers.get('x-razorpay-signature')
    if (signature) {
      if (!paymentConfigured) return respond({ message: 'Payment environment is not configured.' }, 503)
      const secret = required('RAZORPAY_WEBHOOK_SECRET')
      if (!await verifyHmac(secret, raw, signature)) return respond({ message: 'Invalid webhook signature.' }, 401)
      const event = JSON.parse(raw)
      const eventId = request.headers.get('x-razorpay-event-id')
      if (!eventId) return respond({ message: 'Missing webhook event reference.' }, 400)
      if (event.event === 'payment.captured' || event.event === 'order.paid') {
        await confirm(event.payload?.payment?.entity, eventId, event.event)
      }
      return respond({ received: true })
    }

    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return respond({ message: 'Sign in to continue.', code: 'unauthenticated' }, 401)
    const { data: { user }, error: authError } = await db.auth.getUser(token)
    if (authError || !user) return respond({ message: 'Your session has expired. Sign in again.', code: 'unauthenticated' }, 401)
    let body
    try { body = JSON.parse(raw) } catch { return respond({ message: 'Invalid JSON request.', code: 'invalid' }, 400) }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return respond({ message: 'Invalid checkout request.', code: 'invalid' }, 400)

    if (body.action === 'quote') {
      if (!paymentConfigured) return respond({ message: 'Secure payment is not configured for this environment yet.', code: 'not-configured' }, 503)
      const { data, error } = await db.rpc('checkout_quote', { p_items: body.lines, p_address: body.address })
      if (error) return respond({ message: error.message, code: 'invalid' }, 422)
      return respond({ data })
    }

    if (body.action === 'create-order' || body.action === 'resume-order' || body.action === 'sync-order') {
      if (!paymentConfigured || (body.environment && body.environment !== commerceEnv)) return respond({ message: 'The storefront and payment environment do not match. Contact Soft Heaven.', code: 'not-configured' }, 503)
      let orderId = body.orderId
      if (body.action === 'create-order') {
        const { data, error } = await db.rpc('prepare_order', {
          p_user: user.id, p_request: body.requestId, p_items: body.lines,
          p_address: body.address, p_expected_total: body.expectedTotal,
        })
        if (error) return respond({ message: error.message, code: 'invalid' }, 422)
        orderId = data
      }
      if (typeof orderId !== 'string' || !/^[a-f0-9-]{36}$/i.test(orderId)) return respond({ message: 'Invalid order reference.' }, 400)
      const { data: order, error: readError } = await db.from('orders').select('*').eq('id', orderId).eq('user_id', user.id).single()
      if (readError) throw new Error('The order could not be loaded.')
      if (order.payment_status === 'refunded') return respond({ message: 'This order has been refunded.' }, 422)
      if (order.payment_status === 'paid') return respond({ data: { orderId, paid: true, environment: commerceEnv } })
      if (order.razorpay_order_id && await reconcile(order.razorpay_order_id)) return respond({ data: { orderId, paid: true, environment: commerceEnv } })
      if (body.action === 'sync-order') return respond({ data: { orderId, paid: false, environment: commerceEnv } })
      const { error: eligibilityError } = await db.rpc('assert_order_payable', { p_user: user.id, p_order: orderId })
      if (eligibilityError) return respond({ message: eligibilityError.message, code: 'invalid' }, 422)
      if (order.razorpay_order_id) return respond({ data: { orderId, providerOrderId: order.razorpay_order_id, amount: order.total, currency: 'INR', keyId, environment: commerceEnv } })
      // Only one request may create the provider order. An uncertain provider
      // response stays locked for reconciliation, rather than risking duplicates.
      const { data: claimed, error: claimError } = await db.from('orders').update({ payment_setup_started_at: new Date().toISOString() })
        .eq('id', orderId).is('payment_setup_started_at', null).is('razorpay_order_id', null).select('id')
      if (claimError || !claimed?.length) return respond({ message: 'Payment setup is already in progress. Check your orders shortly or contact Soft Heaven.', code: 'request-failed' }, 409)
      const provider = await razorpay('/orders', { amount: order.total, currency: 'INR', receipt: orderId, notes: { soft_heaven_order: orderId } })
      if (typeof provider.id !== 'string' || provider.amount !== order.total || provider.currency !== 'INR') throw new Error('Unexpected payment provider response.')
      const { error: updateError } = await db.from('orders').update({ razorpay_order_id: provider.id }).eq('id', orderId)
      if (updateError) throw new Error('Payment setup needs review. Contact Soft Heaven with your order reference.')
      return respond({ data: { orderId, providerOrderId: provider.id, amount: order.total, currency: 'INR', keyId, environment: commerceEnv } })
    }

    if (body.action === 'verify-payment') {
      if (!paymentConfigured) return respond({ message: 'Payment verification is not configured.' }, 503)
      const { data: order } = await db.from('orders').select('id, razorpay_order_id').eq('id', body.orderId).eq('user_id', user.id).maybeSingle()
      if (!order?.razorpay_order_id || body.providerOrderId !== order.razorpay_order_id || typeof body.paymentId !== 'string' || !/^pay_[A-Za-z0-9]+$/.test(body.paymentId)) return respond({ message: 'Payment reference does not match your order.' }, 400)
      if (!await verifyHmac(required('RAZORPAY_KEY_SECRET'), `${order.razorpay_order_id}|${body.paymentId}`, body.signature ?? '')) return respond({ message: 'Payment signature could not be verified.' }, 401)
      // Fetch captured status from Razorpay; do not trust the browser callback.
      const payment = await razorpay(`/payments/${body.paymentId}`)
      if (payment.order_id !== order.razorpay_order_id) return respond({ message: 'Payment belongs to a different order.' }, 400)
      await confirm(payment)
      return respond({ data: { orderId: order.id, paid: true } })
    }
    return respond({ message: 'Unknown checkout action.' }, 400)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The secure store service could not complete this request.'
    return respond({ message, code: 'request-failed' }, 503)
  }
})
