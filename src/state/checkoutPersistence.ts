import type { StoredBagItem } from './storefrontState'

interface PendingCheckout { orderId: string; lines: StoredBagItem[]; retryKey: string }
const key = (userId: string) => `soft-heaven:pending-checkout:${userId}`

export function rememberPendingCheckout(userId: string, orderId: string, lines: readonly StoredBagItem[], retryKey: string) {
  try { sessionStorage.setItem(key(userId), JSON.stringify({ orderId, lines, retryKey })) } catch { /* checkout remains usable without optional retry storage */ }
}

export function readPendingCheckout(userId: string): PendingCheckout | null {
  try {
    const pending = JSON.parse(sessionStorage.getItem(key(userId)) ?? 'null') as PendingCheckout | null
    if (!pending || typeof pending.orderId !== 'string' || typeof pending.retryKey !== 'string' || !Array.isArray(pending.lines)
      || pending.lines.some((line) => typeof line.slug !== 'string' || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 99)) return null
    return pending
  } catch { return null }
}

export function finishPendingCheckout(userId: string, orderId: string): StoredBagItem[] {
  const pending = readPendingCheckout(userId)
  if (!pending || pending.orderId !== orderId) return []
  try { sessionStorage.removeItem(key(userId)); sessionStorage.removeItem(pending.retryKey) } catch { /* optional storage */ }
  return pending.lines
}
