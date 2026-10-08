import { isCapturedPayment, verifyHmac } from './payment.ts'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

Deno.test('HMAC verifies raw-body integrity and rejects altered signatures', async () => {
  const secret = 'test-only-webhook-secret'
  const body = '{"event":"payment.captured"}'
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  const signature = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
  assert(await verifyHmac(secret, body, signature), 'Valid signature rejected')
  assert(!await verifyHmac(secret, `${body} `, signature), 'Altered body accepted')
  assert(!await verifyHmac('different-secret', body, signature), 'Different secret accepted')
  assert(!await verifyHmac(secret, body, 'garbage'), 'Malformed signature accepted')
})

Deno.test('only captured INR payments pass payment validation', () => {
  const payment = { id: 'pay_test', order_id: 'order_test', amount: 67800, currency: 'INR', status: 'captured' }
  assert(isCapturedPayment(payment), 'Captured payment rejected')
  for (const status of ['authorized', 'failed', 'created', 'refunded']) assert(!isCapturedPayment({ ...payment, status }), `Accepted ${status} payment`)
  assert(!isCapturedPayment({ ...payment, amount: '67800' }), 'String amount accepted')
  assert(!isCapturedPayment({ ...payment, amount: -1 }), 'Negative amount accepted')
  assert(!isCapturedPayment({ ...payment, currency: 'USD' }), 'Different currency accepted')
})
