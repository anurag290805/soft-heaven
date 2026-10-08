import { supabase, supabaseConfigured } from './supabaseClient'
import { FunctionsHttpError } from '@supabase/supabase-js'
import type { StoredWishlistItem } from '../state/storefrontState'

export interface AuthUser {
  id: string
  email: string
  name?: string
}

export interface DeliveryAddress {
  fullName: string
  phone: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
  country: 'IN'
}

export interface CheckoutLinePayload {
  slug: string
  variantId?: string
  quantity: number
}

export interface CreateOrderPayload {
  lines: CheckoutLinePayload[]
  deliveryAddress: DeliveryAddress
  clientRequestId: string
  expectedTotal: number
}

export interface CreateOrderResult {
  orderId: string
  providerOrderId?: string
  amount?: number
  currency?: 'INR'
  keyId?: string
  paid?: boolean
  environment?: 'test' | 'live'
}

export interface OrderSummary {
  id: string
  orderNumber: string
  status: 'pending-payment' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  paymentStatus: 'pending' | 'paid' | 'refunded'
  subtotal: number
  shipping: number
  total: number
  currency: 'INR'
  deliveryNote: string
  createdAt: string
}

export interface PurchaseItem {
  slug: string
  variantId: string
  name: string
  colour: string | null
  photo: string
  unitPrice: number
  quantity: number
  lineTotal: number
}

export interface CheckoutQuote {
  items: PurchaseItem[]
  subtotal: number
  shipping: number
  total: number
  currency: 'INR'
  deliveryNote: string
}

export interface OrderDetails extends OrderSummary {
  address: DeliveryAddress
  items: PurchaseItem[]
  trackingReference: string | null
}

export interface SavedAddress { id: string; address: DeliveryAddress }

export const emptyDeliveryAddress: DeliveryAddress = { fullName: '', phone: '', addressLine1: '', addressLine2: '', city: '', state: '', postalCode: '', country: 'IN' }

export function normalizeAddress(address: DeliveryAddress): DeliveryAddress {
  const phone = address.phone.replace(/[\s()-]/g, '').replace(/^91(?=[6-9][0-9]{9}$)/, '+91')
  // Stable field order keeps checkout retry hashes identical after loading
  // JSONB addresses, whose keys may be returned in a different order.
  return {
    fullName: address.fullName.trim(), phone: /^[6-9][0-9]{9}$/.test(phone) ? `+91${phone}` : phone,
    addressLine1: address.addressLine1.trim(), addressLine2: address.addressLine2.trim(),
    city: address.city.trim(), state: address.state.trim(), postalCode: address.postalCode.trim(), country: address.country,
  }
}

export function validateAddress(address: DeliveryAddress): string | null {
  const value = normalizeAddress(address)
  if (value.fullName.length < 2 || value.fullName.length > 100) return 'Enter a full name between 2 and 100 characters.'
  if (!/^(\+91)?[6-9][0-9]{9}$/.test(value.phone)) return 'Enter a valid Indian mobile number, with an optional +91 prefix.'
  if (!/^[1-9][0-9]{5}$/.test(value.postalCode)) return 'Enter a six-digit Indian PIN code.'
  if (value.addressLine1.length < 5 || value.addressLine1.length > 200 || value.addressLine2.length > 200) return 'Enter a delivery address of 5–200 characters.'
  if ([value.city, value.state].some((part) => part.length < 2 || part.length > 100) || value.country !== 'IN') return 'Enter an Indian city and state.'
  return null
}

export interface CommerceSuccess<T> {
  ok: true
  data: T
}

export interface CommerceFailure {
  ok: false
  code: 'not-configured' | 'unauthenticated' | 'request-failed' | 'invalid'
  message: string
}

export type CommerceResult<T> = CommerceSuccess<T> | CommerceFailure

const googleSignInEnabled = import.meta.env.VITE_GOOGLE_SIGN_IN_ENABLED === 'true'
export const commerceEnvironment = import.meta.env.VITE_COMMERCE_ENV === 'qa' ? 'test' : import.meta.env.VITE_COMMERCE_ENV ?? 'disabled'
const unavailableMessage = 'Account and checkout services are not configured yet. Please contact Soft Heaven while the secure store service is being connected.'

export const commerceConfiguration = {
  apiConfigured: supabaseConfigured,
  googleSignInConfigured: supabaseConfigured && googleSignInEnabled,
  razorpayConfigured: supabaseConfigured && import.meta.env.VITE_RAZORPAY_ENABLED === 'true',
} as const

function failure(code: CommerceFailure['code'] = 'not-configured', message = unavailableMessage): CommerceFailure {
  return { ok: false, code, message }
}

function authUser(user: { id: string; email?: string; user_metadata?: Record<string, unknown> }): AuthUser {
  const name = user.user_metadata?.full_name
  return { id: user.id, email: user.email ?? '', ...(typeof name === 'string' && name ? { name } : {}) }
}

let sessionRequest: Promise<CommerceResult<AuthUser>> | null = null
let sessionRevision = 0
let sessionIdentity: string | null | undefined
supabase?.auth.onAuthStateChange((_event, session) => {
  const id = session?.user.id ?? null
  if (sessionIdentity !== undefined && sessionIdentity !== id) { sessionRevision++; sessionRequest = null }
  sessionIdentity = id
})
async function requireUser(): Promise<CommerceResult<AuthUser>> {
  if (!supabase) return failure()
  if (sessionRequest) return sessionRequest
  const revision = sessionRevision
  const request: Promise<CommerceResult<AuthUser>> = (async () => {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) return failure('unauthenticated', 'Sign in to continue with your Soft Heaven account.')
    if (revision !== sessionRevision) return failure('unauthenticated', 'The account session changed. Please try again.')
    return { ok: true as const, data: authUser(data.user) }
  })().catch(() => failure('request-failed', 'Your account could not be reached. Please try again.'))
  sessionRequest = request
  try { return await request } catch { return failure('request-failed', 'Your account could not be reached. Please try again.') }
  finally { if (sessionRequest === request) sessionRequest = null }
}

async function invoke<T>(body: Record<string, unknown>): Promise<CommerceResult<T>> {
  if (!supabase) return failure()
  const { data, error } = await supabase.functions.invoke('commerce', { body: { ...body, environment: commerceEnvironment }, timeout: 25000 })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      try {
        const payload = await error.context.json() as { message?: string; code?: CommerceFailure['code'] }
        return failure(payload.code ?? 'request-failed', payload.message ?? 'The secure store service could not complete that request.')
      } catch { /* use the network fallback below */ }
    }
    return failure('request-failed', 'The secure store service could not be reached. Please try again shortly.')
  }
  if (!data || typeof data !== 'object' || !('data' in data)) {
    return failure('request-failed', 'The secure store service returned an incomplete response.')
  }
  return { ok: true, data: (data as { data: T }).data }
}

export async function getCurrentSession(): Promise<CommerceResult<AuthUser>> {
  return requireUser()
}

export async function signIn(email: string, password: string): Promise<CommerceResult<AuthUser>> {
  if (!supabase) return failure()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return error || !data.user ? failure('request-failed', error?.message ?? 'Sign in could not be completed.') : { ok: true, data: authUser(data.user) }
}

export async function registerAccount(name: string, email: string, password: string): Promise<CommerceResult<{ user: AuthUser; needsConfirmation: boolean }>> {
  if (name.trim().length < 2 || name.trim().length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) return failure('invalid', 'Enter your name, a valid email, and a password with at least 8 characters.')
  if (!supabase) return failure()
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
  if (error || !data.user) return failure('request-failed', error?.message ?? 'Account creation could not be completed.')
  return { ok: true, data: { user: authUser(data.user), needsConfirmation: !data.session } }
}

export async function requestPasswordReset(email: string): Promise<CommerceResult<null>> {
  if (!supabase) return failure()
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
  return error ? failure('request-failed', error.message) : { ok: true, data: null }
}

export async function updatePassword(password: string): Promise<CommerceResult<null>> {
  if (password.length < 8) return failure('invalid', 'Use at least 8 characters for your new password.')
  const user = await requireUser()
  if (!user.ok || !supabase) return user.ok ? failure() : user
  const { error } = await supabase.auth.updateUser({ password })
  return error ? failure('request-failed', error.message) : { ok: true, data: null }
}

export async function updateProfile(name: string): Promise<CommerceResult<AuthUser>> {
  if (name.trim().length < 2 || name.trim().length > 100) return failure('invalid', 'Enter a name between 2 and 100 characters.')
  const user = await requireUser()
  if (!user.ok || !supabase) return user.ok ? failure() : user
  const { data, error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } })
  return error || !data.user ? failure('request-failed', error?.message ?? 'Your profile could not be updated.') : { ok: true, data: authUser(data.user) }
}

export function getSafeRedirect(): string {
  const redirect = new URLSearchParams(window.location.search).get('redirect')
  return redirect && (['/account', '/checkout', '/orders', '/wishlist'].includes(redirect) || /^\/orders\/[a-f0-9-]{36}$/i.test(redirect)) ? redirect : '/account'
}

export async function signInWithGoogle(): Promise<CommerceResult<null>> {
  if (!supabase || !googleSignInEnabled) return failure('not-configured', 'Google sign-in is not enabled for this store.')
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}${getSafeRedirect()}` } })
  return error ? failure('request-failed', error.message) : { ok: true, data: null }
}

export async function signOut(): Promise<CommerceResult<null>> {
  if (!supabase) return failure()
  const { error } = await supabase.auth.signOut()
  return error ? failure('request-failed', error.message) : { ok: true, data: null }
}

export async function createOrder(payload: CreateOrderPayload): Promise<CommerceResult<CreateOrderResult>> {
  const result = await invoke<CreateOrderResult>({ action: 'create-order', requestId: payload.clientRequestId, lines: payload.lines, address: payload.deliveryAddress, expectedTotal: payload.expectedTotal })
  return validatePaymentSetup(result)
}

function validatePaymentSetup(result: CommerceResult<CreateOrderResult>): CommerceResult<CreateOrderResult> {
  if (!result.ok) return result
  const order = result.data
  if (!order || !/^[a-f0-9-]{36}$/i.test(order.orderId) || order.environment !== commerceEnvironment || (!order.paid && (!order.providerOrderId || !order.keyId || !Number.isSafeInteger(order.amount) || order.amount! <= 0 || order.currency !== 'INR'))) return failure('request-failed', 'Payment setup is incomplete or belongs to a different environment. Check your orders before paying.')
  return result
}

export async function quoteCheckout(lines: CheckoutLinePayload[], address: DeliveryAddress): Promise<CommerceResult<CheckoutQuote>> {
  const result = await invoke<CheckoutQuote>({ action: 'quote', lines, address })
  if (!result.ok) return result
  const quote = result.data
  if (!quote || !Array.isArray(quote.items) || quote.items.length !== lines.length || quote.currency !== 'INR'
    || !Number.isSafeInteger(quote.subtotal) || quote.subtotal <= 0 || !Number.isSafeInteger(quote.shipping) || quote.shipping < 0
    || quote.total !== quote.subtotal + quote.shipping || !quote.deliveryNote
    || quote.items.some((item) => !Number.isSafeInteger(item.quantity) || !Number.isSafeInteger(item.unitPrice) || item.unitPrice <= 0 || item.quantity < 1 || item.quantity > 99 || item.lineTotal !== item.unitPrice * item.quantity)
    || quote.items.reduce((sum, item) => sum + item.lineTotal, 0) !== quote.subtotal) return failure('request-failed', 'The order review is incomplete. Please try again before paying.')
  return result
}

export async function resumeOrder(orderId: string): Promise<CommerceResult<CreateOrderResult>> {
  return validatePaymentSetup(await invoke<CreateOrderResult>({ action: 'resume-order', orderId }))
}

export async function syncOrderPayment(orderId: string): Promise<CommerceResult<{ orderId: string; paid: boolean }>> {
  return invoke<{ orderId: string; paid: boolean }>({ action: 'sync-order', orderId })
}

export async function verifyPayment(orderId: string, providerOrderId: string, paymentId: string, signature: string): Promise<CommerceResult<{ orderId: string; paid: boolean }>> {
  return invoke<{ orderId: string; paid: boolean }>({ action: 'verify-payment', orderId, providerOrderId, paymentId, signature })
}

export async function getOrders(expectedUser?: string): Promise<CommerceResult<OrderSummary[]>> {
  const user = await requireUser()
  if (!user.ok || !supabase) return user.ok ? failure() : user
  if (expectedUser && user.data.id !== expectedUser) return failure('unauthenticated', 'The account session changed.')
  const { data, error } = await supabase.from('orders').select('id, order_number, status, payment_status, subtotal, shipping, total, currency, delivery_note, created_at').eq('user_id', user.data.id).order('created_at', { ascending: false })
  if (error) return failure('request-failed', 'Your orders could not be loaded. Please try again shortly.')
  return { ok: true, data: data.map((order) => ({ id: order.id, orderNumber: `SH-${order.order_number}`, status: order.status, paymentStatus: order.payment_status, subtotal: order.subtotal / 100, shipping: order.shipping / 100, total: order.total / 100, currency: 'INR', deliveryNote: order.delivery_note, createdAt: order.created_at })) }
}

export async function getOrder(orderId: string, expectedUser?: string): Promise<CommerceResult<OrderDetails>> {
  const user = await requireUser()
  if (!user.ok || !supabase) return user.ok ? failure() : user
  if (expectedUser && user.data.id !== expectedUser) return failure('unauthenticated', 'The account session changed.')
  if (!/^[a-f0-9-]{36}$/i.test(orderId)) return failure('invalid', 'This order reference is invalid.')
  const { data, error } = await supabase.from('orders').select('id, order_number, status, payment_status, subtotal, shipping, total, currency, delivery_note, created_at, delivery_address, tracking_reference, order_items(*)').eq('id', orderId).eq('user_id', user.data.id).maybeSingle()
  if (error) return failure('request-failed', 'This order could not be loaded.')
  if (!data) return failure('invalid', 'This order reference was not found in your account.')
  return { ok: true, data: { id: data.id, orderNumber: `SH-${data.order_number}`, status: data.status, paymentStatus: data.payment_status, subtotal: data.subtotal / 100, shipping: data.shipping / 100, total: data.total / 100, currency: 'INR', deliveryNote: data.delivery_note, createdAt: data.created_at, address: data.delivery_address as DeliveryAddress, trackingReference: data.tracking_reference, items: data.order_items.map((item) => ({ slug: item.slug, variantId: item.variant_id, name: item.name, colour: item.colour, photo: item.photo, unitPrice: item.unit_price, quantity: item.quantity, lineTotal: item.line_total })) } }
}

export async function saveAddress(address: DeliveryAddress, id?: string): Promise<CommerceResult<null>> {
  const user = await requireUser()
  if (!user.ok || !supabase) return user.ok ? failure() : user
  const issue = validateAddress(address)
  if (issue) return failure('invalid', issue)
  const normalized = normalizeAddress(address)
  if (id) {
    const { error } = await supabase.from('addresses').update({ address: normalized }).eq('id', id).eq('user_id', user.data.id)
    return error ? failure('request-failed', 'The address could not be updated.') : { ok: true, data: null }
  }
  const { data: existing } = await supabase.from('addresses').select('id, address').eq('user_id', user.data.id)
  if (existing?.some((row) => JSON.stringify(normalizeAddress(row.address as DeliveryAddress)) === JSON.stringify(normalized))) return { ok: true, data: null }
  const { error } = await supabase.from('addresses').insert({ user_id: user.data.id, address: normalized })
  return error ? failure('request-failed', 'The address could not be saved. Please try again, or continue without saving it.') : { ok: true, data: null }
}

export async function getAddresses(expectedUser?: string): Promise<CommerceResult<SavedAddress[]>> {
  const user = await requireUser()
  if (!user.ok || !supabase) return user.ok ? failure() : user
  if (expectedUser && user.data.id !== expectedUser) return failure('unauthenticated', 'The account session changed.')
  const { data, error } = await supabase.from('addresses').select('id, address').eq('user_id', user.data.id).order('created_at', { ascending: false })
  return error ? failure('request-failed', 'Saved addresses could not be loaded.') : { ok: true, data: data as SavedAddress[] }
}

export async function deleteAddress(id: string): Promise<CommerceResult<null>> {
  const user = await requireUser()
  if (!user.ok || !supabase) return user.ok ? failure() : user
  const { error } = await supabase.from('addresses').delete().eq('id', id).eq('user_id', user.data.id)
  return error ? failure('request-failed', 'The address could not be removed.') : { ok: true, data: null }
}

export async function readRemoteWishlist(expectedUser?: string): Promise<CommerceResult<StoredWishlistItem[]>> {
  const user = await requireUser()
  if (!user.ok || !supabase) return user.ok ? failure() : user
  if (expectedUser && expectedUser !== user.data.id) return failure('unauthenticated', 'The account session changed.')
  const { data, error } = await supabase.from('wishlist_items').select('slug, variant_id').eq('user_id', user.data.id)
  if (error) return failure('request-failed', 'Your saved wishlist could not be loaded.')
  return { ok: true, data: data.map((item) => ({ slug: item.slug, ...(item.variant_id ? { variantId: item.variant_id } : {}) })) }
}

export async function upsertRemoteWishlist(item: StoredWishlistItem, expectedUser?: string): Promise<CommerceResult<null>> {
  if (!supabase) return failure()
  const user = await requireUser()
  if (!user.ok) return user
  if (expectedUser && expectedUser !== user.data.id) return failure('unauthenticated', 'The account session changed.')
  const { error } = await supabase.from('wishlist_items').upsert({ user_id: user.data.id, slug: item.slug, variant_id: item.variantId ?? '' })
  return error ? failure('request-failed', 'Your selection is saved on this browser, but could not sync to your account. Only server-published variants can be synced.') : { ok: true, data: null }
}

export async function removeRemoteWishlist(item: StoredWishlistItem, expectedUser?: string): Promise<CommerceResult<null>> {
  if (!supabase) return failure()
  const user = await requireUser()
  if (!user.ok) return user
  if (expectedUser && expectedUser !== user.data.id) return failure('unauthenticated', 'The account session changed.')
  let query = supabase.from('wishlist_items').delete().eq('user_id', user.data.id).eq('slug', item.slug)
  if (item.variantId !== undefined) query = query.eq('variant_id', item.variantId)
  const { error } = await query
  return error ? failure('request-failed', 'The item was removed from this browser, but the account wishlist could not be updated. Please try again shortly.') : { ok: true, data: null }
}

export function onAuthStateChange(callback: (user: AuthUser | null) => void): (() => void) | undefined {
  if (!supabase) return undefined
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
      // Supabase auth callbacks hold a lock: defer any further SDK requests.
      setTimeout(() => callback(session?.user ? authUser(session.user) : null), 0)
    }
  })
  return () => data.subscription.unsubscribe()
}
