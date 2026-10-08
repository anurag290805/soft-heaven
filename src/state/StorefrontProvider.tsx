import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getProductBySlug, getProductVariant } from '../data/catalogue'
import type { ProductRecord } from '../components/storefront.types'
import {
  BAG_STORAGE_KEY,
  WISHLIST_STORAGE_KEY,
  addBagItem,
  getCartLines,
  getCartSubtotal,
  getBagEligibility,
  getCanonicalProduct,
  readBagItems,
  readWishlistItems,
  getWishlistStorageKey,
  removeBagItem,
  writeBagItems,
  writeWishlistItems,
  setBagQuantity,
  type StoredBagItem,
  type StoredWishlistItem,
} from './storefrontState'
import { StorefrontContext, type AddToBagResult, type StorefrontContextValue, type WishlistLine } from './storefrontContext'
import { getCurrentSession, onAuthStateChange, readRemoteWishlist } from '../data/commerce'
import { flushWishlist, mergePendingWishlist, queueWishlist } from './wishlistSync'

export function StorefrontProvider({ children }: { children: ReactNode }) {
  const [wishlistItems, setWishlistItems] = useState<StoredWishlistItem[]>(readWishlistItems)
  const [cartItems, setCartItems] = useState<StoredBagItem[]>(readBagItems)
  const [bagNotice, setBagNotice] = useState<{ product: ProductRecord; variantId?: string } | null>(null)
  const account = useRef<string | null>(null)
  const [wishlistScope, setWishlistScope] = useState<string | null>(null)
  const [wishlistSyncMessage, setWishlistSyncMessage] = useState<string | null>(null)

  useEffect(() => {
    writeWishlistItems(wishlistItems, getWishlistStorageKey(wishlistScope))
  }, [wishlistItems, wishlistScope])

  useEffect(() => {
    writeBagItems(cartItems)
  }, [cartItems])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
       if (event.key === null || event.key === getWishlistStorageKey(account.current)) setWishlistItems(readWishlistItems(getWishlistStorageKey(account.current)))
      if (event.key === null || event.key === BAG_STORAGE_KEY) setCartItems(readBagItems())
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  useEffect(() => {
    let active = true
    let initialized = false
    let generation = 0
    const hydrateWishlist = async (userId: string | null) => {
      if (!active || (initialized && account.current === userId)) return
      initialized = true
      const revision = ++generation
      account.current = userId
      setWishlistScope(userId)
      setWishlistItems(readWishlistItems(getWishlistStorageKey(userId)))
      setWishlistSyncMessage(null)
      if (!userId) return
      const guestItems = readWishlistItems(WISHLIST_STORAGE_KEY)
      guestItems.forEach((item) => queueWishlist(userId, item, 'add'))
      if (guestItems.length) writeWishlistItems([], WISHLIST_STORAGE_KEY)
      const uploaded = await flushWishlist(userId)
      const remote = await readRemoteWishlist(userId)
      if (!active || revision !== generation) return
      if (remote.ok) setWishlistItems(mergePendingWishlist(remote.data, userId))
      if (!uploaded.ok || !remote.ok) setWishlistSyncMessage('Your browser copy is kept for this account. Wishlist synchronization could not finish; it will retry when you sign in again.')
    }
    void getCurrentSession().then((session) => hydrateWishlist(session.ok ? session.data.id : null))
    const unsubscribe = onAuthStateChange((user) => {
      void hydrateWishlist(user?.id ?? null)
    })
    return () => { active = false; unsubscribe?.() }
  }, [])

  const wishlistProducts = useMemo<WishlistLine[]>(
    () => wishlistItems.map((item) => {
      const product = getProductBySlug(item.slug)
      return { ...item, product, variant: product ? getProductVariant(product, item.variantId) : undefined }
    }),
    [wishlistItems],
  )
  const wishlistSlugs = useMemo(() => [...new Set(wishlistItems.map((item) => item.slug))], [wishlistItems])

  const cartLines = useMemo(() => getCartLines(cartItems), [cartItems])
  const cartSubtotal = useMemo(() => getCartSubtotal(cartLines), [cartLines])

  const toggleWishlist = (product: ProductRecord, variantId?: string) => {
    if (!getCanonicalProduct(product.slug, product.id)) return
    const selectedVariantId = product.variants?.length ? (variantId ?? getProductVariant(product)?.id) : undefined
    if (selectedVariantId && !product.variants?.some((item) => item.id === selectedVariantId)) return
    const wishlistItem = { slug: product.slug, ...(selectedVariantId ? { variantId: selectedVariantId } : {}) }
    const isSaved = wishlistItems.some((item) => item.slug === product.slug && item.variantId === selectedVariantId)
    setWishlistItems((currentItems) => {
      return isSaved
        ? currentItems.filter((item) => !(item.slug === product.slug && item.variantId === selectedVariantId))
        : [...currentItems, wishlistItem]
    })
    const userId = account.current
    if (userId) {
      queueWishlist(userId, wishlistItem, isSaved ? 'remove' : 'add')
      void flushWishlist(userId).then((result) => { if (account.current === userId) setWishlistSyncMessage(result.ok ? null : result.message) })
    }
  }

  const removeFromWishlist = (slug: string, variantId?: string) => {
    const userId = account.current
    if (userId) wishlistItems.filter((item) => item.slug === slug && (variantId === undefined || item.variantId === variantId)).forEach((item) => queueWishlist(userId, item, 'remove'))
    setWishlistItems((currentItems) => currentItems.filter((item) => !(item.slug === slug && (variantId === undefined || item.variantId === variantId))))
    if (userId) void flushWishlist(userId).then((result) => { if (account.current === userId) setWishlistSyncMessage(result.ok ? null : result.message) })
  }

  const addToBag = (product: ProductRecord, variantId?: string, quantity = 1): AddToBagResult => {
    const canonicalProduct = getCanonicalProduct(product.slug, product.id)
    const eligibility = getBagEligibility(canonicalProduct, variantId)

    if (!eligibility.eligible) return { ok: false, reason: eligibility.reason }

    setCartItems((currentItems) => addBagItem(currentItems, product, variantId, quantity).items)
    setBagNotice({ product, ...(variantId ? { variantId } : {}) })

    return { ok: true }
  }

  const updateCartQuantity = (slug: string, quantity: number, variantId?: string) => {
    if (quantity > 0 && !getBagEligibility(getCanonicalProduct(slug), variantId).eligible) return
    setCartItems((currentItems) => setBagQuantity(currentItems, slug, quantity, variantId))
  }

  const removeFromBag = (slug: string, variantId?: string) => {
    setCartItems((currentItems) => removeBagItem(currentItems, slug, variantId))
  }

  const clearBag = () => setCartItems([])

  const consumePurchasedItems = useCallback((purchased: readonly StoredBagItem[]) => {
    if (!purchased.length) return
    setCartItems((current) => current.flatMap((item) => {
      const line = purchased.find((purchase) => purchase.slug === item.slug && purchase.variantId === item.variantId)
      const quantity = item.quantity - (line?.quantity ?? 0)
      return quantity > 0 ? [{ ...item, quantity }] : []
    }))
  }, [])

  const value: StorefrontContextValue = {
    wishlistSlugs,
    wishlistItems,
    wishlistProducts,
    wishlistSyncMessage,
    isWishlisted: (slug, variantId) => wishlistItems.some((item) => item.slug === slug && (variantId === undefined || item.variantId === variantId)),
    toggleWishlist,
    removeFromWishlist,
    cartItems,
    cartLines,
    cartCount: cartItems.reduce((count, item) => count + item.quantity, 0),
    cartSubtotal,
    cartHasUnavailableItems: cartLines.some((line) => !line.eligibility.eligible),
    addToBag,
    bagNotice,
    dismissBagNotice: () => setBagNotice(null),
    updateCartQuantity,
    removeFromBag,
    clearBag,
    consumePurchasedItems,
  }

  return <StorefrontContext.Provider value={value}>{children}</StorefrontContext.Provider>
}
