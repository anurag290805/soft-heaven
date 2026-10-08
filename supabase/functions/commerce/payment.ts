export async function verifyHmac(secret: string, message: string, signature: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  const bytes = Uint8Array.from(signature.match(/../g)!, (pair) => parseInt(pair, 16))
  return crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(message))
}

export interface ProviderPayment {
  id: string
  order_id: string
  amount: number
  currency: string
  status: string
}

export function isCapturedPayment(value: unknown): value is ProviderPayment {
  if (!value || typeof value !== 'object') return false
  const payment = value as Record<string, unknown>
  return typeof payment.id === 'string' && typeof payment.order_id === 'string'
    && Number.isSafeInteger(payment.amount) && (payment.amount as number) > 0 && payment.currency === 'INR' && payment.status === 'captured'
}
