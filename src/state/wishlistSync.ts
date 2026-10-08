import { removeRemoteWishlist, upsertRemoteWishlist, type CommerceResult } from '../data/commerce'
import type { StoredWishlistItem } from './storefrontState'

interface Mutation extends StoredWishlistItem { operation: 'add' | 'remove'; id: string }
const queues = new Map<string, Promise<CommerceResult<null>>>()
const memory = new Map<string, Mutation[]>()
const key = (userId: string) => `soft-heaven:wishlist-pending:${userId}`
const itemKey = (item: StoredWishlistItem) => `${item.slug}::${item.variantId ?? ''}`

export function pendingWishlist(userId: string): Mutation[] {
  try {
    const raw = localStorage.getItem(key(userId))
    if (!raw) return memory.get(userId) ?? []
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value) ? value.filter((item) => item && typeof item.slug === 'string' && typeof item.id === 'string' && ['add', 'remove'].includes(item.operation)) : []
  } catch { return memory.get(userId) ?? [] }
}
function write(userId: string, mutations: Mutation[]) {
  memory.set(userId, mutations)
  try { localStorage.setItem(key(userId), JSON.stringify(mutations)) } catch { /* account API still attempts the immediate change */ }
}
export function queueWishlist(userId: string, item: StoredWishlistItem, operation: Mutation['operation']) {
  write(userId, [...pendingWishlist(userId).filter((entry) => itemKey(entry) !== itemKey(item)), { ...item, operation, id: crypto.randomUUID() }])
}
export function mergePendingWishlist(items: StoredWishlistItem[], userId: string): StoredWishlistItem[] {
  const merged = new Map(items.map((item) => [itemKey(item), item]))
  for (const mutation of pendingWishlist(userId)) {
    if (mutation.operation === 'remove') merged.delete(itemKey(mutation))
    else merged.set(itemKey(mutation), { slug: mutation.slug, ...(mutation.variantId ? { variantId: mutation.variantId } : {}) })
  }
  return [...merged.values()]
}
export function flushWishlist(userId: string): Promise<CommerceResult<null>> {
  const job: Promise<CommerceResult<null>> = (queues.get(userId) ?? Promise.resolve({ ok: true as const, data: null })).then(async () => {
    for (const mutation of pendingWishlist(userId)) {
      const result = await (mutation.operation === 'add' ? upsertRemoteWishlist(mutation, userId) : removeRemoteWishlist(mutation, userId))
      if (!result.ok) return result
      write(userId, pendingWishlist(userId).filter((entry) => entry.id !== mutation.id))
    }
    return { ok: true as const, data: null }
  }).catch(() => ({ ok: false as const, code: 'request-failed' as const, message: 'Wishlist sync was interrupted. Your selection remains saved for this account on this browser.' }))
  queues.set(userId, job)
  return job
}
