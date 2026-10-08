// Exercise the real Edge Function handler against isolated HTTP fixtures.
// These tests do not connect to Supabase or Razorpay accounts.
const testEnv: Record<string, string> = {
  SUPABASE_URL: 'https://edge-qa.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-only-service-key',
  RAZORPAY_KEY_ID: 'rzp_test_qa', RAZORPAY_KEY_SECRET: 'edge-test-secret',
  RAZORPAY_WEBHOOK_SECRET: 'webhook-test-secret', ALLOWED_ORIGINS: 'https://store.example.test', COMMERCE_ENV: 'test',
}
for (const [key, value] of Object.entries(testEnv)) Deno.env.set(key, value)

type Handler = (request: Request) => Promise<Response>
let handle: Handler
const originalServe = Deno.serve
Object.assign(Deno, { serve: (handler: Handler) => { handle = handler } })
await import('./index.ts')
Object.assign(Deno, { serve: originalServe })

const id = 'cccccccc-cccc-4ccc-cccc-cccccccccccc'
const originalFetch = globalThis.fetch
let providerStatus = 'captured'
let providerOrder = 'order_qa'
let confirmed = 0
let providerCreations = 0
let claimed = false
let eligibilityError = false
let providerNetworkFailure = false
let order: Record<string, unknown>

function reset() {
  providerStatus = 'none'; providerOrder = 'order_qa'; confirmed = 0; providerCreations = 0; claimed = false; eligibilityError = false; providerNetworkFailure = false
  order = { id, user_id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', payment_status: 'pending', status: 'pending-payment', total: 67800, currency: 'INR', razorpay_order_id: 'order_qa' }
}
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

async function fixtureFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : input.toString())
  const method = init?.method ?? 'GET'
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null
  const headers = new Headers(init?.headers)
  if (url.hostname === 'edge-qa.supabase.co') {
    if (url.pathname === '/auth/v1/user') return response({ id: headers.get('authorization') === 'Bearer bob-token' ? 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb' : order.user_id, email: 'qa@example.test', aud: 'authenticated', user_metadata: {}, app_metadata: {} })
    if (url.pathname === '/rest/v1/rpc/prepare_order') return response(id)
    if (url.pathname === '/rest/v1/rpc/assert_order_payable') return eligibilityError ? response({ message: 'A selected colour is no longer available for checkout.' }, 400) : response(null)
    if (url.pathname === '/rest/v1/rpc/confirm_payment') { confirmed++; order.payment_status = 'paid'; return response(id) }
    if (url.pathname === '/rest/v1/orders') {
      if (url.searchParams.has('user_id') && url.searchParams.get('user_id') !== `eq.${order.user_id}`) return response({ code: 'PGRST116', message: 'No matching order' }, 406)
      if (method === 'PATCH') {
        if (body.payment_setup_started_at) {
          if (claimed) return response([])
          claimed = true
          return response([{ id }])
        }
        Object.assign(order, body)
        return response(null)
      }
      return response(headers.get('accept')?.includes('vnd.pgrst.object') ? order : [order])
    }
  }
  if (url.hostname === 'api.razorpay.com') {
    if (providerNetworkFailure) throw new Error('Test-only network timeout')
    if (url.pathname === '/v1/orders/order_qa/payments') return response({ items: providerStatus === 'none' ? [] : [{ id: 'pay_qa', order_id: providerOrder, amount: 67800, currency: 'INR', status: providerStatus }] })
    if (url.pathname === '/v1/orders') {
      providerCreations++
      if (body.amount !== 67800 || body.receipt !== id) throw new Error('Provider amount did not come from the stored order')
      return response({ id: 'order_qa', amount: 67800, currency: 'INR' })
    }
    if (url.pathname === '/v1/payments/pay_qa') return response({ id: 'pay_qa', order_id: providerOrder, amount: 67800, currency: 'INR', status: providerStatus })
  }
  throw new Error(`Unexpected fixture request: ${method} ${url.href}`)
}

async function withFixtures(run: () => Promise<void>) {
  reset()
  globalThis.fetch = fixtureFetch
  try { await run() } finally { globalThis.fetch = originalFetch }
}
function assert(condition: boolean, message: string) { if (!condition) throw new Error(message) }
const request = (body: unknown, headers: Record<string, string> = {}) => new Request('https://edge-qa.supabase.co/functions/v1/commerce', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token', Origin: 'https://store.example.test', ...headers }, body: JSON.stringify(body) })
async function hmac(secret: string, body: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

Deno.test('Edge Function rejects unauthenticated requests, invalid origins, and invalid webhook signatures', async () => {
  await withFixtures(async () => {
    assert((await handle(request({ action: 'quote' }, { Authorization: '' }))).status === 401, 'Missing auth was accepted')
    assert((await handle(request({ action: 'quote' }, { Origin: 'https://untrusted.example.test' }))).status === 403, 'Invalid origin was accepted')
    assert((await handle(request({ event: 'payment.captured' }, { 'x-razorpay-signature': 'bad' }))).status === 401, 'Invalid webhook was accepted')
    assert(confirmed === 0, 'Invalid requests confirmed a payment')
  })
})

Deno.test('Edge callback verifies HMAC and captured provider state before confirming payment', async () => {
  await withFixtures(async () => {
    const body = { action: 'verify-payment', orderId: id, providerOrderId: 'order_qa', paymentId: 'pay_qa', signature: 'bad' }
    assert((await handle(request(body))).status === 401, 'Bad signature accepted')
    body.signature = await hmac(testEnv.RAZORPAY_KEY_SECRET, 'order_qa|pay_qa')
    providerStatus = 'authorized'
    assert((await handle(request(body))).status === 503 && confirmed === 0, 'Uncaptured payment confirmed')
    providerStatus = 'captured'; providerOrder = 'order_other'
    assert((await handle(request(body))).status === 400 && confirmed === 0, 'Wrong provider order confirmed')
    providerOrder = 'order_qa'
    assert((await handle(request(body))).status === 200 && Number(confirmed) === 1, 'Valid captured payment not confirmed')
  })
})

Deno.test('Edge provider setup uses database totals and creates one provider order on concurrent retries', async () => {
  await withFixtures(async () => {
    order.razorpay_order_id = null
    const body = { action: 'create-order', requestId: id, lines: [{ slug: 'crochet-flower-keychain', quantity: 2, unitPrice: 1 }], address: {}, expectedTotal: 1 }
    const responses = await Promise.all([handle(request(body)), handle(request(body))])
    assert(responses.some((result) => result.status === 200), 'No retry could create the order')
    assert(providerCreations === 1, 'Concurrent retries created duplicate provider orders')
    const retry = await handle(request({ action: 'resume-order', orderId: id }))
    assert(retry.status === 200 && providerCreations === 1, 'Resume created a different provider order')
  })
})

Deno.test('valid signed webhooks reach captured-payment confirmation', async () => {
  await withFixtures(async () => {
    const body = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_qa', order_id: 'order_qa', amount: 67800, currency: 'INR', status: 'captured' } } } }
    const signature = await hmac(testEnv.RAZORPAY_WEBHOOK_SECRET, JSON.stringify(body))
    const result = await handle(request(body, { Origin: '', Authorization: '', 'x-razorpay-signature': signature, 'x-razorpay-event-id': 'event_qa' }))
    assert(result.status === 200 && confirmed === 1, 'Signed captured webhook was not applied')
  })
})

Deno.test('payment refresh reconciles late capture and blocks authorized, unavailable, and wrong-account retries', async () => {
  await withFixtures(async () => {
    providerStatus = 'authorized'
    assert((await handle(request({ action: 'resume-order', orderId: id, environment: 'test' }))).status === 503, 'Authorized payment was opened again')
    assert(confirmed === 0 && providerCreations === 0, 'Authorized payment changed an order')
    providerStatus = 'captured'
    const result = await handle(request({ action: 'sync-order', orderId: id, environment: 'test' }))
    assert(result.status === 200 && (await result.json()).data.paid === true && Number(confirmed) === 1, 'Late capture was not reconciled')
    reset(); providerNetworkFailure = true
    assert((await handle(request({ action: 'resume-order', orderId: id }))).status === 503 && providerCreations === 0, 'Network uncertainty opened another payment')
    reset(); eligibilityError = true
    assert((await handle(request({ action: 'resume-order', orderId: id }))).status === 422, 'Disabled colour bypassed eligibility')
    reset()
    assert((await handle(request({ action: 'resume-order', orderId: id }, { Authorization: 'Bearer bob-token' }))).status !== 200, 'Another customer accessed the order')
    assert((await handle(request({ action: 'resume-order', orderId: id, environment: 'live' }))).status === 503, 'Environment mismatch was accepted')
  })
})

Deno.test('malformed and oversized requests fail before commerce mutation', async () => {
  await withFixtures(async () => {
    assert((await handle(request(null))).status === 400, 'Null request accepted')
    assert((await handle(request([]))).status === 400, 'Array request accepted')
    assert((await handle(request({ action: 'create-order', padding: 'x'.repeat(33000) }))).status === 413, 'Oversized request accepted')
    assert(providerCreations === 0 && confirmed === 0, 'Invalid body reached payment mutation')
  })
})
