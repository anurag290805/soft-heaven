import { getLegacyVariantId, getProductBySlug, getProductPrice, getProductPriceStatus, getProductPublicationIssues, getProductVariant, isGenuinePhoto } from '../data/catalogue'
import type { ProductRecord, ProductVariant } from '../components/storefront.types'

export const WISHLIST_STORAGE_KEY = 'soft-heaven:wishlist:v1'
export const BAG_STORAGE_KEY = 'soft-heaven:bag:v1'
export const STOREFRONT_STORAGE_VERSION = 2
export const MAX_BAG_QUANTITY = 99

export interface StoredBagItem {
  slug: string
  quantity: number
  variantId?: string
}

export interface StoredWishlistItem {
  slug: string
  variantId?: string
}

interface StoredWishlist {
  version: typeof STOREFRONT_STORAGE_VERSION
  items: StoredWishlistItem[]
}

interface StoredBag {
  version: typeof STOREFRONT_STORAGE_VERSION
  items: StoredBagItem[]
}

function safeReadStorage(key: string): string | null {
  try { return window.localStorage.getItem(key) } catch { return null }
}

function safeParse(value: string | null): unknown {
  if (!value) return null
  try { return JSON.parse(value) as unknown } catch { return null }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function canonicalStoredSlug(slug: string): string | undefined {
  return getProductBySlug(slug)?.slug
}

function wishlistKey(item: StoredWishlistItem): string {
  return `${item.slug}::${item.variantId ?? ''}`
}

function bagKey(item: Pick<StoredBagItem, 'slug' | 'variantId'>): string {
  return `${item.slug}::${item.variantId ?? ''}`
}

export function getWishlistStorageKey(userId: string | null) {
  return userId ? `${WISHLIST_STORAGE_KEY}:account:${userId}` : WISHLIST_STORAGE_KEY
}

export function readWishlistItems(storageKey = WISHLIST_STORAGE_KEY): StoredWishlistItem[] {
  const parsed = safeParse(safeReadStorage(storageKey))
  const rawItems: unknown[] = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.items)
      ? parsed.items
      : isRecord(parsed) && Array.isArray(parsed.slugs)
        ? parsed.slugs
        : []

  const items = rawItems.flatMap((item): StoredWishlistItem[] => {
    const rawSlug = typeof item === 'string' ? item : isRecord(item) && typeof item.slug === 'string' ? item.slug : undefined
    if (!rawSlug) return []
    const slug = canonicalStoredSlug(rawSlug)
    if (!slug) return []
    const variantId = isRecord(item) && typeof item.variantId === 'string' ? item.variantId : getLegacyVariantId(rawSlug)
    const product = getProductBySlug(slug)
    if (variantId && !getProductVariant(product!, variantId)) return []
    return [{ slug, ...(variantId ? { variantId } : {}) }]
  })

  return [...new Map(items.map((item) => [wishlistKey(item), item])).values()]
}

/** Backwards-compatible helper for existing header integrations. */
export function readWishlistSlugs(): string[] {
  return [...new Set(readWishlistItems().map((item) => item.slug))]
}

export function readBagItems(): StoredBagItem[] {
  const parsed = safeParse(safeReadStorage(BAG_STORAGE_KEY))
  const rawItems = isRecord(parsed) && Array.isArray(parsed.items) ? parsed.items : []
  const quantities = new Map<string, StoredBagItem>()

  rawItems.forEach((item) => {
    if (!isRecord(item) || typeof item.slug !== 'string' || !isPositiveInteger(item.quantity)) return
    const slug = canonicalStoredSlug(item.slug)
    if (!slug) return
    const product = getProductBySlug(slug)
    const variantId = typeof item.variantId === 'string' ? item.variantId : getLegacyVariantId(item.slug)
    if (variantId && (!product?.variants?.some((variant) => variant.id === variantId))) return
    const normalized = { slug, quantity: item.quantity, ...(variantId ? { variantId } : {}) }
    const key = bagKey(normalized)
    const existing = quantities.get(key)
    quantities.set(key, { ...normalized, quantity: Math.min(MAX_BAG_QUANTITY, (existing?.quantity ?? 0) + item.quantity) })
  })

  return [...quantities.values()]
}

export function writeWishlistItems(items: readonly StoredWishlistItem[], storageKey = WISHLIST_STORAGE_KEY): void {
  const payload: StoredWishlist = { version: STOREFRONT_STORAGE_VERSION, items: [...new Map(items.map((item) => [wishlistKey(item), { ...item }])).values()] }
  try { window.localStorage.setItem(storageKey, JSON.stringify(payload)) } catch { /* blocked storage must not break the storefront */ }
}

export function writeWishlistSlugs(slugs: readonly string[]): void {
  writeWishlistItems(slugs.flatMap((slug) => canonicalStoredSlug(slug) ? [{ slug: canonicalStoredSlug(slug)! }] : []))
}

export function writeBagItems(items: readonly StoredBagItem[]): void {
  const payload: StoredBag = { version: STOREFRONT_STORAGE_VERSION, items: items.map((item) => ({ ...item })) }
  try { window.localStorage.setItem(BAG_STORAGE_KEY, JSON.stringify(payload)) } catch { /* blocked storage must not break the storefront */ }
}

export type BagEligibility =
  | { eligible: true; variant?: ProductVariant }
  | { eligible: false; reason: string; enquiry: 'general' | 'product'; variant?: ProductVariant }

type PublicationIssuesResolver = (product: ProductRecord) => string[]

export function getBagEligibility(product: ProductRecord | undefined, variantId?: string, getPublicationIssues: PublicationIssuesResolver = getProductPublicationIssues): BagEligibility {
  if (!product) return { eligible: false, reason: 'This product is no longer in the catalogue.', enquiry: 'general' }
  if (product.publicationStatus === 'development-fixture') return { eligible: false, reason: 'This is a development preview and cannot be added to a shopping bag.', enquiry: 'product' }
  if (product.publicationStatus !== 'published') return { eligible: false, reason: 'This product is still being prepared and cannot be added to a shopping bag.', enquiry: 'product' }

  const variant = product.variants?.length && variantId ? product.variants.find((item) => item.id === variantId) : undefined
  if (product.variants?.length && !variant) return { eligible: false, reason: 'Choose a colour before adding this product to your shopping bag.', enquiry: 'product' }
  if (!isGenuinePhoto(variant?.photo ?? product.photo)) return { eligible: false, reason: 'A genuine photograph is required before this item can be added.', enquiry: 'product' }
  if (variant && variant.orderability !== true) return { eligible: false, reason: 'This colour is currently enquiry-only. Soft Heaven will confirm ordering details directly.', enquiry: 'product', variant }

  if (getPublicationIssues(product).length > 0) return { eligible: false, reason: 'This product’s catalogue information is not ready for ordering. Please confirm the details directly.', enquiry: 'product', variant }
  const availability = variant ? variant.availability : product.availability
  const price = getProductPrice(product, variant)
  const priceStatus = getProductPriceStatus(product, variant)
  if (availability === 'custom-request') return { eligible: false, reason: 'This product requires a reviewed custom request rather than a direct bag item.', enquiry: 'product', variant }
  if (availability === 'temporarily-unavailable') return { eligible: false, reason: 'This product is temporarily unavailable to order.', enquiry: 'product', variant }
  if (priceStatus !== 'owner-confirmed') return { eligible: false, reason: 'An owner-confirmed price and ordering status are required before this product can be added to a shopping bag.', enquiry: 'product', variant }
  if (product.orderability !== true) return { eligible: false, reason: 'This product is currently enquiry-only. Soft Heaven will confirm ordering details directly.', enquiry: 'product', variant }
  if (availability === 'not-orderable') return { eligible: false, reason: 'This product is not currently available to order.', enquiry: 'product', variant }
  if (!availability || !['ready-to-ship', 'available', 'made-to-order'].includes(availability)) return { eligible: false, reason: 'This product is not currently available to add to a shopping bag.', enquiry: 'product', variant }
  if (!price || price.currency !== 'INR' || !Number.isFinite(price.amount) || price.amount <= 0) return { eligible: false, reason: 'A confirmed INR price is required before this product can be added to a shopping bag.', enquiry: 'product', variant }

  return { eligible: true, variant }
}

export function getCanonicalProduct(slug: string, productId?: string): ProductRecord | undefined {
  const product = getProductBySlug(slug)
  return product && (!productId || product.id === productId) ? product : undefined
}

export function getCanonicalVariant(product: ProductRecord | undefined, variantId?: string): ProductVariant | undefined {
  return product && variantId ? product.variants?.find((variant) => variant.id === variantId) : undefined
}

export interface CartLine extends StoredBagItem {
  product?: ProductRecord
  variant?: ProductVariant
  eligibility: BagEligibility
}

export function getCartLines(items: readonly StoredBagItem[], resolveProduct = getProductBySlug, getPublicationIssues: PublicationIssuesResolver = getProductPublicationIssues): CartLine[] {
  return items.map((item) => {
    const product = resolveProduct(item.slug)
    const variant = product ? getCanonicalVariant(product, item.variantId) : undefined
    return { ...item, product, variant, eligibility: getBagEligibility(product, item.variantId, getPublicationIssues) }
  })
}

export function getCartSubtotal(lines: readonly CartLine[]): number {
  const paise = lines.reduce((subtotal, line) => {
    if (!line.product || !line.eligibility.eligible) return subtotal
    const price = getProductPrice(line.product, line.variant)
    return price ? subtotal + Math.round(price.amount * 100) * line.quantity : subtotal
  }, 0)
  return paise / 100
}

export function addBagItem(items: readonly StoredBagItem[], product: ProductRecord, variantId?: string, quantity = 1, resolveProduct = getCanonicalProduct, getPublicationIssues: PublicationIssuesResolver = getProductPublicationIssues): { items: StoredBagItem[]; reason?: string } {
  const canonicalProduct = resolveProduct(product.slug, product.id)
  const eligibility = getBagEligibility(canonicalProduct, variantId, getPublicationIssues)
  if (!eligibility.eligible) return { items: [...items], reason: eligibility.reason }

  const increment = Number.isInteger(quantity) && quantity > 0 ? Math.min(MAX_BAG_QUANTITY, quantity) : 1
  const nextItem = { slug: product.slug, quantity: increment, ...(variantId ? { variantId } : {}) }
  const existing = items.some((item) => bagKey(item) === bagKey(nextItem))
  return { items: existing ? items.map((item) => bagKey(item) === bagKey(nextItem) ? { ...item, quantity: Math.min(MAX_BAG_QUANTITY, item.quantity + increment) } : item) : [...items, nextItem] }
}

export function setBagQuantity(items: readonly StoredBagItem[], slug: string, quantity: number, variantId?: string): StoredBagItem[] {
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity)) return [...items]
  const matches = (item: StoredBagItem) => item.slug === slug && item.variantId === variantId
  if (quantity <= 0) return items.filter((item) => !matches(item))
  return items.map((item) => matches(item) ? { ...item, quantity: Math.min(MAX_BAG_QUANTITY, quantity) } : item)
}

export function removeBagItem(items: readonly StoredBagItem[], slug: string, variantId?: string): StoredBagItem[] {
  return items.filter((item) => !(item.slug === slug && item.variantId === variantId))
}
