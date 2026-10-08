import { createContext, useContext } from 'react'
import type { ProductRecord } from '../components/storefront.types'
import type { CartLine, StoredBagItem, StoredWishlistItem } from './storefrontState'
import type { ProductVariant } from '../components/storefront.types'

export interface AddToBagResult {
  ok: boolean
  reason?: string
}

export interface StorefrontContextValue {
  wishlistSlugs: readonly string[]
  wishlistItems: readonly StoredWishlistItem[]
  wishlistProducts: WishlistLine[]
  wishlistSyncMessage: string | null
  isWishlisted: (slug: string, variantId?: string) => boolean
  toggleWishlist: (product: ProductRecord, variantId?: string) => void
  removeFromWishlist: (slug: string, variantId?: string) => void
  cartItems: readonly StoredBagItem[]
  cartLines: CartLine[]
  cartCount: number
  cartSubtotal: number
  cartHasUnavailableItems: boolean
  addToBag: (product: ProductRecord, variantId?: string, quantity?: number) => AddToBagResult
  bagNotice: { product: ProductRecord; variantId?: string } | null
  dismissBagNotice: () => void
  updateCartQuantity: (slug: string, quantity: number, variantId?: string) => void
  removeFromBag: (slug: string, variantId?: string) => void
  clearBag: () => void
  consumePurchasedItems: (items: readonly StoredBagItem[]) => void
}

export interface WishlistLine extends StoredWishlistItem {
  product?: ProductRecord
  variant?: ProductVariant
}

export const StorefrontContext = createContext<StorefrontContextValue | undefined>(undefined)

export function useStorefront(): StorefrontContextValue {
  const context = useContext(StorefrontContext)
  if (!context) throw new Error('useStorefront must be used within StorefrontProvider')
  return context
}
