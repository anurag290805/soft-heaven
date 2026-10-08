// Test-only browser service fixtures. Never imported by the storefront build.
// Database/RLS and cryptographic tests separately verify the real backend.
(() => {
  const alice = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
  const bob = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'
  const makeUser = (id, email, name) => ({ id, email, aud: 'authenticated', role: 'authenticated', user_metadata: { full_name: name }, app_metadata: { provider: 'email' }, created_at: '2026-10-08T00:00:00Z' })
  const initial = { mode: 'cancel', wishlists: [], addresses: [], orders: [], requests: [], paymentWindows: [], passwordUpdates: 0, authRequests: [], users: [makeUser(alice, 'qa@example.test', 'QA Customer'), makeUser(bob, 'bob@example.test', 'Other Customer')], unconfirmed: [] }
  const read = () => JSON.parse(sessionStorage.getItem('commerce-qa-service') || JSON.stringify(initial))
  const write = (state) => sessionStorage.setItem('commerce-qa-service', JSON.stringify(state))
  window.commerceQA = {
    state: read,
    mode: (mode) => { const state = read(); state.mode = mode; write(state) },
    confirm: (email) => { const state = read(); state.unconfirmed = state.unconfirmed.filter((value) => value !== email); write(state) },
    capture: (id) => { const state = read(); state.orders.find((order) => order.id === id).providerCaptured = true; write(state) },
  }
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
  const token = (user) => {
    const expires = Math.floor(Date.now() / 1000) + 3600
    return { access_token: `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify({ sub: user.id, exp: expires }))}.qa-signature`, token_type: 'bearer', refresh_token: 'test-refresh-token', expires_in: 3600, expires_at: expires, user }
  }
  const catalogue = {
    'red-blue-crochet-flower-bouquet': ['Red & Blue Crochet Flower Bouquet', 149900, { '': [null, 'Red+blue_Bouquet'] }],
    'red-pink-crochet-flower-bouquet': ['Red & Pink Crochet Flower Bouquet', 149900, { '': [null, 'Red+Pink_Bouquet'] }],
    'blue-mix-crochet-flower': ['Blue Mix Crochet Keychain', 39900, { '': [null, 'blueMix_flower'] }],
    'crochet-sunflower-keychain': ['Crochet Sunflower Keychain', 34900, { sunflower: ['Sunflower', 'Sunflower'] }],
    'crochet-flower-keychain': ['Crochet Flower Keychain', 29900, { 'baby-blue': ['Baby Blue', 'lightblue_flower'], 'blush-pink': ['Blush Pink', 'pink_flower'], lavender: ['Lavender', 'purple_flower'], white: ['White', 'white_flower'], 'butter-yellow': ['Butter Yellow', 'yellow_flower'] }],
    'cute-crochet-dress-keychain': ['Cute Crochet Dress Keychain', 34900, { 'baby-blue': ['Baby Blue', 'lightblue_dress'], 'blush-pink': ['Blush Pink', 'pink_dress'], lavender: ['Lavender', 'lavendar_dress'], red: ['Red', 'red_dress'], 'sage-green': ['Sage Green', 'green_dress'] }],
    'crochet-heart-keychain': ['Crochet Heart Keychain', 29900, { 'baby-blue': ['Baby Blue', 'blue_heart'], 'blush-pink': ['Blush Pink', 'pink_heart'], lavender: ['Lavender', 'purple_heart'], red: ['Red', 'red_heart'], white: ['White', 'white_heart'] }],
  }
  const quote = (lines) => {
    const items = lines.map((line) => {
      const product = catalogue[line.slug]
      const variant = product?.[2][line.variantId ?? '']
      if (!variant) throw new Error('Test selection has no published variant')
      return { ...line, variantId: line.variantId ?? '', name: product[0], colour: variant[0], photo: `/images/products/optimized/${variant[1]}.webp`, unitPrice: product[1], lineTotal: line.quantity * product[1] }
    })
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0)
    return { items, subtotal, shipping: 8000, total: subtotal + 8000, currency: 'INR', deliveryNote: 'Test-only delivery arrangement' }
  }
  const setup = (order) => ({ orderId: order.id, paid: order.payment_status === 'paid', providerOrderId: order.providerOrderId, amount: order.total, currency: 'INR', keyId: 'rzp_test_qa', environment: 'test' })
  const captured = (state, order) => { if (order.providerCaptured) { order.payment_status = 'paid'; order.status = order.status === 'cancelled' ? order.status : 'processing'; write(state) } }
  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url || input.toString(), location.href)
    if (url.origin !== 'https://qa-store.supabase.co') return originalFetch(input, init)
    const state = read()
    const method = init.method || 'GET'
    const body = init.body ? JSON.parse(init.body) : null
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined))
    let subject
    try { subject = JSON.parse(atob(headers.get('authorization').split('.')[1])).sub } catch { /* public signup/login calls have no customer token */ }
    const user = state.users.find((item) => item.id === subject)
    if (url.pathname === '/auth/v1/token') {
      state.authRequests.push({ action: 'login', email: body.email }); write(state)
      const customer = state.users.find((item) => item.email === body.email) || state.users.find((item) => item.id === alice)
      if (state.mode === 'auth-failed') return json({ error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400)
      if (state.unconfirmed.includes(customer.email)) return json({ code: 'email_not_confirmed', error_description: 'Email not confirmed' }, 400)
      return json(token(customer))
    }
    if (url.pathname === '/auth/v1/signup') {
      if (state.users.some((item) => item.email === body.email)) return json({ code: 'email_exists', msg: 'User already registered' }, 422)
      const customer = makeUser(crypto.randomUUID(), body.email, body.data?.full_name || 'New Customer')
      state.users.push(customer); state.unconfirmed.push(body.email); write(state)
      return json({ user: customer, session: null })
    }
    if (url.pathname === '/auth/v1/recover') return state.mode === 'recovery-failed' ? json({ msg: 'Recovery email could not be sent. Try again shortly.' }, 503) : json({})
    if (url.pathname === '/auth/v1/logout') return new Response(null, { status: 204 })
    if (!user) return json({ message: 'Session expired', code: 'unauthenticated' }, 401)
    if (url.pathname === '/auth/v1/user') {
      if (method === 'PUT') {
        if (body.data) Object.assign(user.user_metadata, body.data)
        if (body.password) state.passwordUpdates++
        write(state)
      }
      return json(user)
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      const table = url.pathname.split('/').pop()
      const owns = (item) => item.user_id === user.id && (!url.searchParams.has('user_id') || url.searchParams.get('user_id') === `eq.${item.user_id}`)
      if (table === 'wishlist_items') {
        if (method === 'POST') {
          if (body.user_id !== user.id) return json({ message: 'Row-level security rejected owner' }, 403)
          if (!state.wishlists.some((item) => owns(item) && item.slug === body.slug && item.variant_id === body.variant_id)) state.wishlists.push(body)
          write(state)
          return json(null)
        }
        if (method === 'DELETE') {
          state.wishlists = state.wishlists.filter((item) => !(owns(item) && url.searchParams.get('slug') === `eq.${item.slug}` && (!url.searchParams.has('variant_id') || url.searchParams.get('variant_id') === `eq.${item.variant_id}`)))
          write(state)
          return json(null)
        }
        return json(state.wishlists.filter(owns))
      }
      if (table === 'addresses') {
        if (method === 'POST') { if (body.user_id !== user.id) return json({ message: 'Wrong address owner' }, 403); state.addresses.push({ id: crypto.randomUUID(), ...body }); write(state); return json(null) }
        if (method === 'PATCH') { const item = state.addresses.find((item) => owns(item) && url.searchParams.get('id') === `eq.${item.id}`); if (item) item.address = body.address; write(state); return json(null) }
        if (method === 'DELETE') { state.addresses = state.addresses.filter((item) => !(owns(item) && url.searchParams.get('id') === `eq.${item.id}`)); write(state); return json(null) }
        return json(state.addresses.filter(owns))
      }
      if (table === 'orders') {
        const id = url.searchParams.get('id')
        return json(state.orders.filter((order) => owns(order) && (!id || `eq.${order.id}` === id)))
      }
    }
    if (url.pathname === '/functions/v1/commerce') {
      if (state.mode === 'network-failed') return json({ message: 'The secure store service is temporarily unavailable.', code: 'request-failed' }, 503)
      if (body.action === 'quote') {
        if (state.mode === 'unserviceable') return json({ message: 'Delivery is not configured for this PIN code. Contact Soft Heaven before ordering.', code: 'invalid' }, 422)
        return json({ data: quote(body.lines) })
      }
      if (body.action === 'create-order') {
        let order = state.orders.find((item) => item.user_id === user.id && item.requestId === body.requestId)
        if (!order) {
          const review = quote(body.lines)
          if (body.expectedTotal !== review.total) return json({ message: 'The order total has changed.' }, 422)
          const id = crypto.randomUUID()
          order = { id, user_id: user.id, order_number: 10001 + state.orders.length, providerOrderId: `order_${id.replaceAll('-', '')}`, requestId: body.requestId, status: 'pending-payment', payment_status: 'pending', subtotal: review.subtotal, shipping: review.shipping, total: review.total, currency: 'INR', delivery_note: review.deliveryNote, delivery_address: body.address, tracking_reference: null, created_at: '2026-10-08T00:00:00Z', order_items: review.items.map((item) => ({ slug: item.slug, variant_id: item.variantId, name: item.name, colour: item.colour, photo: item.photo, unit_price: item.unitPrice, quantity: item.quantity, line_total: item.lineTotal })) }
          state.orders.push(order)
        }
        state.requests.push(body.requestId)
        write(state)
        captured(state, order)
        return json({ data: setup(order) })
      }
      if (body.action === 'verify-payment') {
        if (state.mode === 'verification-failed') return json({ message: 'Payment signature could not be verified.', code: 'request-failed' }, 401)
        if (state.mode === 'verification-timeout') return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }))
        const order = state.orders.find((item) => item.id === body.orderId && item.user_id === user.id)
        if (!order) return json({ message: 'Order not found.' }, 404)
        order.payment_status = 'paid'
        order.status = 'processing'
        write(state)
        return json({ data: { orderId: order.id, paid: true } })
      }
      if (body.action === 'resume-order' || body.action === 'sync-order') {
        const order = state.orders.find((item) => item.id === body.orderId && item.user_id === user.id)
        if (!order) return json({ message: 'This order was not found in your account.' }, 404)
        captured(state, order)
        if (state.mode === 'eligibility-failed' && !order.providerCaptured) return json({ message: 'A selected colour is no longer available for checkout.' }, 422)
        return json({ data: body.action === 'sync-order' ? { orderId: order.id, paid: order.payment_status === 'paid' } : setup(order) })
      }
    }
    throw new Error(`Unhandled QA service endpoint: ${method} ${url.pathname}`)
  }
  window.Razorpay = class {
    constructor(options) { this.options = options }
    on(_event, callback) { this.failure = callback }
    open() {
      const state = read()
      state.paymentWindows.push({ amount: this.options.amount, orderId: this.options.order_id }); write(state)
      if (state.mode === 'cancel') this.options.modal.ondismiss()
      else if (state.mode === 'payment-failed') { this.failure(); this.options.modal.ondismiss() }
      else {
        if (state.mode === 'retry-inside') this.failure()
        if (state.mode === 'verification-timeout') window.commerceQA.capture(state.orders.find((item) => item.providerOrderId === this.options.order_id).id)
        this.options.handler({ razorpay_order_id: this.options.order_id, razorpay_payment_id: 'pay_qa', razorpay_signature: 'test-only-signature' })
      }
    }
    close() { this.options.modal.ondismiss() }
  }
})()
