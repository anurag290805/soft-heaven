import type { CollectionRecord, ConfirmedPrice, ProductAvailability, ProductRecord, ProductVariant } from '../components/storefront.types'
import type { StorefrontPhoto } from '../components/StorefrontImage'
import { readCatalogueOverrides } from '../state/catalogueAdmin'

export type CataloguePricingMode = 'illustrative' | 'owner-confirmed'

// Keep this locked until Soft Heaven has explicitly approved final prices and
// direct ordering for each product/variant.
export const CATALOGUE_PRICING_MODE: CataloguePricingMode = 'owner-confirmed'
export const ILLUSTRATIVE_PRICE_NOTICE = 'Current catalogue pricing. Delivery is calculated from your address at checkout.'

export const ILLUSTRATIVE_PRICES = {
  flowerKeychain: { amount: 299, currency: 'INR' },
  dressKeychain: { amount: 349, currency: 'INR' },
  heartKeychain: { amount: 299, currency: 'INR' },
  sunflowerKeychain: { amount: 349, currency: 'INR' },
  blueMixFlower: { amount: 399, currency: 'INR' },
  redBlueBouquet: { amount: 1499, currency: 'INR' },
  redPinkBouquet: { amount: 1499, currency: 'INR' },
} satisfies Record<string, ConfirmedPrice>

function photo(
  src: string,
  alt: string,
  width = 1122,
  height = 1402,
): StorefrontPhoto {
  const file = src.split('/').pop() ?? src
  return {
    src,
    optimizedSrc: `/images/products/optimized/${file.replace(/\.png$/i, '.webp')}`,
    sourceAsset: file,
    angle: 'product',
    responsive: {
      srcSet: `/images/products/optimized/${file.replace(/\.png$/i, '-480.webp')} 480w, /images/products/optimized/${file.replace(/\.png$/i, '-800.webp')} 800w, /images/products/optimized/${file.replace(/\.png$/i, '.webp')} ${width}w`,
      sizes: '(max-width: 600px) 92vw, (max-width: 1100px) 45vw, 33vw',
    },
    alt,
    width,
    height,
    fit: 'contain',
  }
}

export const cataloguePhotos = {
  redBlueBouquet: photo('/images/products/Red+blue_Bouquet.png', 'Red and blue crochet flower bouquet'),
  redPinkBouquet: photo('/images/products/Red+Pink_Bouquet.png', 'Red and pink crochet flower bouquet'),
  blueMixFlower: photo('/images/products/blueMix_flower.png', 'Blue mix crochet keychain'),
  greenDress: photo('/images/products/green_dress.png', 'Sage green crochet dress keychain'),
  lavenderDress: photo('/images/products/lavendar_dress.png', 'Lavender crochet dress keychain'),
  lightBlueDress: photo('/images/products/lightblue_dress.png', 'Baby blue crochet dress keychain'),
  pinkDress: photo('/images/products/pink_dress.png', 'Blush pink crochet dress keychain'),
  redDress: photo('/images/products/red_dress.png', 'Red crochet dress keychain'),
  lightBlueFlower: photo('/images/products/lightblue_flower.png', 'Baby blue crochet flower keychain'),
  pinkFlower: photo('/images/products/pink_flower.png', 'Blush pink crochet flower keychain'),
  purpleFlower: photo('/images/products/purple_flower.png', 'Lavender crochet flower keychain'),
  whiteFlower: photo('/images/products/white_flower.png', 'White crochet flower keychain'),
  yellowFlower: photo('/images/products/yellow_flower.png', 'Butter yellow crochet flower keychain'),
  blueHeart: photo('/images/products/blue_heart.png', 'Baby blue crochet heart keychain'),
  pinkHeart: photo('/images/products/pink_heart.png', 'Blush pink crochet heart keychain'),
  purpleHeart: photo('/images/products/purple_heart.png', 'Lavender crochet heart keychain'),
  redHeart: photo('/images/products/red_heart.png', 'Red crochet heart keychain'),
  whiteHeart: photo('/images/products/white_heart.png', 'White crochet heart keychain'),
  sunflower: photo('/images/products/Sunflower.png', 'Sunflower crochet keychain', 1254, 1254),
} as const

function variant(
  id: string,
  name: string,
  colour: string,
  productPhoto: StorefrontPhoto,
  swatch: string,
): ProductVariant {
  return {
    id,
    name,
    colour,
    photo: productPhoto,
    swatch,
    availability: 'available',
    orderability: true,
  }
}

export const flowerKeychainVariants: readonly ProductVariant[] = [
  variant('baby-blue', 'Baby Blue', 'Baby Blue', cataloguePhotos.lightBlueFlower, '#a9d5e8'),
  variant('blush-pink', 'Blush Pink', 'Blush Pink', cataloguePhotos.pinkFlower, '#e9b5bc'),
  variant('lavender', 'Lavender', 'Lavender', cataloguePhotos.purpleFlower, '#b9a3cf'),
  variant('white', 'White', 'White', cataloguePhotos.whiteFlower, '#fffdf9'),
  variant('butter-yellow', 'Butter Yellow', 'Butter Yellow', cataloguePhotos.yellowFlower, '#e8cf78'),
]

export const dressKeychainVariants: readonly ProductVariant[] = [
  variant('sage-green', 'Sage Green', 'Sage Green', cataloguePhotos.greenDress, '#aebea4'),
  variant('lavender', 'Lavender', 'Lavender', cataloguePhotos.lavenderDress, '#b9a3cf'),
  variant('baby-blue', 'Baby Blue', 'Baby Blue', cataloguePhotos.lightBlueDress, '#a9d5e8'),
  variant('blush-pink', 'Blush Pink', 'Blush Pink', cataloguePhotos.pinkDress, '#e9b5bc'),
  variant('red', 'Red', 'Red', cataloguePhotos.redDress, '#bd5d61'),
]

export const heartKeychainVariants: readonly ProductVariant[] = [
  variant('baby-blue', 'Baby Blue', 'Baby Blue', cataloguePhotos.blueHeart, '#a9d5e8'),
  variant('blush-pink', 'Blush Pink', 'Blush Pink', cataloguePhotos.pinkHeart, '#e9b5bc'),
  variant('lavender', 'Lavender', 'Lavender', cataloguePhotos.purpleHeart, '#b9a3cf'),
  variant('red', 'Red', 'Red', cataloguePhotos.redHeart, '#bd5d61'),
  variant('white', 'White', 'White', cataloguePhotos.whiteHeart, '#fffdf9'),
]

export const catalogueCollections: readonly CollectionRecord[] = [
  {
    id: 'collection-flowers',
    slug: 'flowers-bouquets',
    number: '01',
    name: 'Flowers & bouquets',
    description: 'Forever blooms for desks, bedside tables, and meaningful moments.',
    variant: 'flowers',
    photo: cataloguePhotos.redPinkBouquet,
    productSlugs: ['red-blue-crochet-flower-bouquet', 'red-pink-crochet-flower-bouquet'],
  },
  {
    id: 'collection-keychains',
    slug: 'keychains-keepsakes',
    number: '02',
    name: 'Keychains & keepsakes',
    description: 'Small crochet pieces made to carry a little softness with you.',
    variant: 'gifts',
    photo: cataloguePhotos.blueMixFlower,
    productSlugs: ['blue-mix-crochet-flower', 'crochet-sunflower-keychain', 'crochet-flower-keychain', 'cute-crochet-dress-keychain', 'crochet-heart-keychain'],
  },
]

/** The seven customer-facing product families. */
const baseCatalogueProducts: readonly ProductRecord[] = [
  {
    id: 'product-red-blue-crochet-flower-bouquet',
    slug: 'red-blue-crochet-flower-bouquet',
    name: 'Red & Blue Crochet Flower Bouquet',
    type: 'Bouquet',
    shortDescription: 'A crochet flower bouquet in red and blue.',
    collectionSlug: 'flowers-bouquets',
    variant: 'bouquet',
    photo: cataloguePhotos.redBlueBouquet,
    gallery: [cataloguePhotos.redBlueBouquet],
    occasions: ['birthday', 'anniversary', 'keepsake'],
    price: ILLUSTRATIVE_PRICES.redBlueBouquet,
    priceStatus: 'owner-confirmed',
    orderability: true,
    publicationStatus: 'published',
    availability: 'available',
  },
  {
    id: 'product-red-pink-crochet-flower-bouquet',
    slug: 'red-pink-crochet-flower-bouquet',
    name: 'Red & Pink Crochet Flower Bouquet',
    type: 'Bouquet',
    shortDescription: 'A crochet flower bouquet in red and pink.',
    collectionSlug: 'flowers-bouquets',
    variant: 'bouquet',
    photo: cataloguePhotos.redPinkBouquet,
    gallery: [cataloguePhotos.redPinkBouquet],
    occasions: ['birthday', 'anniversary', 'keepsake'],
    price: ILLUSTRATIVE_PRICES.redPinkBouquet,
    priceStatus: 'owner-confirmed',
    orderability: true,
    publicationStatus: 'published',
    availability: 'available',
  },
  {
    id: 'product-blue-mix-crochet-flower',
    slug: 'blue-mix-crochet-flower',
    name: 'Blue Mix Crochet Keychain',
    type: 'Keychain',
    shortDescription: 'A blue mix crochet flower keychain.',
    collectionSlug: 'keychains-keepsakes',
    variant: 'flowers',
    photo: cataloguePhotos.blueMixFlower,
    gallery: [cataloguePhotos.blueMixFlower],
    occasions: ['birthday', 'keepsake'],
    price: ILLUSTRATIVE_PRICES.blueMixFlower,
    priceStatus: 'owner-confirmed',
    orderability: true,
    publicationStatus: 'published',
    availability: 'available',
  },
  {
    id: 'product-crochet-flower-keychain',
    slug: 'crochet-flower-keychain',
    name: 'Crochet Flower Keychain',
    type: 'Keychain',
    shortDescription: 'A crochet flower keychain with five genuine colour choices.',
    collectionSlug: 'keychains-keepsakes',
    variant: 'keychain',
    photo: cataloguePhotos.lightBlueFlower,
    variants: flowerKeychainVariants,
    occasions: ['birthday', 'keepsake'],
    price: ILLUSTRATIVE_PRICES.flowerKeychain,
    priceStatus: 'owner-confirmed',
    orderability: true,
    publicationStatus: 'published',
    availability: 'available',
  },
  {
    id: 'product-cute-crochet-dress-keychain',
    slug: 'cute-crochet-dress-keychain',
    name: 'Cute Crochet Dress Keychain',
    type: 'Keychain',
    shortDescription: 'A crochet dress keychain in five genuine colour choices.',
    collectionSlug: 'keychains-keepsakes',
    variant: 'keychain',
    photo: cataloguePhotos.lightBlueDress,
    variants: dressKeychainVariants,
    occasions: ['birthday', 'keepsake'],
    price: ILLUSTRATIVE_PRICES.dressKeychain,
    priceStatus: 'owner-confirmed',
    orderability: true,
    publicationStatus: 'published',
    availability: 'available',
  },
  {
    id: 'product-crochet-heart-keychain',
    slug: 'crochet-heart-keychain',
    name: 'Crochet Heart Keychain',
    type: 'Keychain',
    shortDescription: 'A crochet heart keychain in five genuine colour choices.',
    collectionSlug: 'keychains-keepsakes',
    variant: 'keychain',
    photo: cataloguePhotos.blueHeart,
    variants: heartKeychainVariants,
    occasions: ['birthday', 'anniversary', 'keepsake'],
    price: ILLUSTRATIVE_PRICES.heartKeychain,
    priceStatus: 'owner-confirmed',
    orderability: true,
    publicationStatus: 'published',
    availability: 'available',
  },
  {
    id: 'product-crochet-sunflower-keychain',
    slug: 'crochet-sunflower-keychain',
    name: 'Crochet Sunflower Keychain',
    type: 'Keychain',
    shortDescription: 'A crochet sunflower keychain in its sunny yellow design.',
    collectionSlug: 'keychains-keepsakes',
    variant: 'keychain',
    photo: cataloguePhotos.sunflower,
    variants: [variant('sunflower', 'Sunflower', 'Sunflower', cataloguePhotos.sunflower, '#e2b536')],
    occasions: ['birthday', 'keepsake'],
    price: ILLUSTRATIVE_PRICES.sunflowerKeychain,
    priceStatus: 'owner-confirmed',
    orderability: true,
    publicationStatus: 'published',
    availability: 'available',
  },
]

// The local editor is intentionally an opt-in override. It lets an owner add
// genuine uploaded variants and save catalogue drafts without changing this
// source file; production can replace this adapter with the existing backend.
export const catalogueProducts: readonly ProductRecord[] = readCatalogueOverrides() ?? baseCatalogueProducts

const legacyProductSlugAliases: Record<string, string> = {
  'blue-red-bouquet': 'red-blue-crochet-flower-bouquet',
  'red-pink-bouquet': 'red-pink-crochet-flower-bouquet',
  'blue-flower-keychain': 'crochet-flower-keychain',
  'white-flower-keychain': 'crochet-flower-keychain',
  'strawberry-keychain': 'cute-crochet-dress-keychain', // Legacy route only; never used as a product name.
  'pink-heart-keychain': 'crochet-heart-keychain',
  'sunflower-keychain': 'crochet-sunflower-keychain',
}

function canonicalSlug(slug: string): string {
  return legacyProductSlugAliases[slug] ?? slug
}

export function getLegacyVariantId(slug: string): string | undefined {
  return ({
    'blue-flower-keychain': 'baby-blue', 'white-flower-keychain': 'white',
    'pink-heart-keychain': 'blush-pink', 'strawberry-keychain': 'red', 'sunflower-keychain': 'sunflower',
  } as Record<string, string>)[slug]
}

export function getProductVariant(product: ProductRecord, variantId?: string): ProductVariant | undefined {
  if (!product.variants?.length) return undefined
  return variantId ? product.variants.find((item) => item.id === variantId) : product.variants.find((item) => item.colour === 'Baby Blue') ?? product.variants[0]
}

export function getProductPhoto(product: ProductRecord, variantId?: string): StorefrontPhoto | undefined {
  return getProductVariant(product, variantId)?.photo ?? product.photo
}

export function getProductGallery(product: ProductRecord, variantId?: string): readonly StorefrontPhoto[] {
  const selectedVariant = getProductVariant(product, variantId)
  const primary = selectedVariant?.photo ?? product.photo
  const additional = selectedVariant ? selectedVariant.gallery ?? [] : product.gallery ?? []
  return [...new Map([...(primary ? [primary] : []), ...additional].map((item) => [item.src, item])).values()]
}

export function getProductPrice(product: ProductRecord, selectedVariant?: ProductVariant): ConfirmedPrice | undefined {
  return selectedVariant?.price ?? product.price
}

export function getProductPriceStatus(product: ProductRecord, selectedVariant?: ProductVariant): ProductRecord['priceStatus'] {
  return selectedVariant?.price ? selectedVariant.priceStatus : product.priceStatus
}

/** Missing information blocks publication; it is never filled with defaults. */
export function isGenuinePhoto(photo: StorefrontPhoto | undefined): boolean {
  return Boolean(photo && /^(\/images\/|data:image\/(?:png|jpeg|webp);base64,|https:\/\/)/.test(photo.src) && photo.alt.trim()
    && Number.isInteger(photo.width) && photo.width > 0 && Number.isInteger(photo.height) && photo.height > 0)
}

export function getProductPublicationIssues(product: ProductRecord, records: readonly ProductRecord[] = catalogueProducts): string[] {
  const issues: string[] = []
  const collection = getCollectionBySlug(product.collectionSlug)
  const publishableAvailability: readonly ProductAvailability[] = ['not-orderable', 'ready-to-ship', 'available', 'made-to-order', 'custom-request', 'temporarily-unavailable']

  if (!product.id.trim()) issues.push('A stable product ID is required.')
  if (!product.name.trim()) issues.push('An owner-approved product name is required.')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug)) issues.push('A lowercase kebab-case slug is required.')
  if (!product.shortDescription.trim()) issues.push('An approved short description is required.')
  if (records.filter((record) => record.id === product.id || record.slug === product.slug).length > 1) issues.push('Product IDs and slugs must be unique across the catalogue.')
  if (!collection) issues.push('Choose an existing collection.')
  if (!isGenuinePhoto(product.photo)) {
    issues.push('Genuine product photography with descriptive alt text and actual pixel dimensions is required.')
  }
  if (!publishableAvailability.includes(product.availability)) issues.push('An explicit non-development availability is required for publication.')
  if (typeof product.orderability !== 'boolean') issues.push('Owner-confirmed product orderability is required.')
  if (product.variants?.length) {
    product.variants.forEach((item) => {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id) || !item.name.trim() || !item.colour.trim() || !isGenuinePhoto(item.photo)) issues.push(`Variant ${item.name || item.id || 'without a name'} needs a genuine image and customer-facing name.`)
      if (product.variants!.filter((variant) => variant.id === item.id).length > 1) issues.push('Colour variant IDs must be unique within a product.')
      if (item.price && (!item.priceStatus || item.price.currency !== 'INR' || !Number.isFinite(item.price.amount) || item.price.amount <= 0)) issues.push(`Variant ${item.name} needs a valid price and approval status.`)
      if (item.gallery?.some((photo) => !isGenuinePhoto(photo))) issues.push(`Variant ${item.name} has an incomplete gallery image.`)
    })
  }
  if (product.price && (product.price.currency !== 'INR' || !Number.isFinite(product.price.amount) || product.price.amount <= 0)) issues.push('A supplied price must be a positive INR amount.')
  if (product.price && !product.priceStatus) issues.push('A supplied price must identify whether it is illustrative or owner-confirmed.')
  if (product.priceStatus && !product.price) issues.push('A price status requires a corresponding price.')
  if (product.gallery?.some((photo) => !isGenuinePhoto(photo))) issues.push('Each gallery image needs descriptive alt text and actual dimensions.')

  return issues
}

export function isDevelopmentFixture(product: ProductRecord): boolean {
  return product.publicationStatus === 'development-fixture'
}

export function isPubliclyListedProduct(product: ProductRecord): boolean {
  return product.publicationStatus === 'published' && getProductPublicationIssues(product).length === 0
}

function canAppearInStorefront(product: ProductRecord): boolean {
  return isDevelopmentFixture(product) || isPubliclyListedProduct(product)
}

const defaultProductOrder = [
  'red-blue-crochet-flower-bouquet',
  'red-pink-crochet-flower-bouquet',
  'blue-mix-crochet-flower',
  'crochet-sunflower-keychain',
  'crochet-flower-keychain',
  'cute-crochet-dress-keychain',
  'crochet-heart-keychain',
]

export const featuredProducts: readonly ProductRecord[] = [...catalogueProducts.filter(canAppearInStorefront)].sort(
  (firstProduct, secondProduct) => defaultProductOrder.indexOf(firstProduct.slug) - defaultProductOrder.indexOf(secondProduct.slug),
)

export function getPublicProducts(): ProductRecord[] {
  return catalogueProducts.filter(isPubliclyListedProduct)
}

export function formatConfirmedPrice(price: ConfirmedPrice): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: price.currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(price.amount)
}

export function isIllustrativePrice(product: ProductRecord, selectedVariant?: ProductVariant): boolean {
  return Boolean(getProductPrice(product, selectedVariant) && getProductPriceStatus(product, selectedVariant) !== 'owner-confirmed')
}

export interface ProductPriceDisplay {
  amount: string
  numericAmount: number
  qualifier?: 'Illustrative'
}

export function getProductPriceDisplay(product: ProductRecord, selectedVariant?: ProductVariant): ProductPriceDisplay {
  const price = getProductPrice(product, selectedVariant)
  if (!price || getProductPriceStatus(product, selectedVariant) !== 'owner-confirmed') return { amount: 'Price on request', numericAmount: 0 }
  return { amount: formatConfirmedPrice(price), numericAmount: price.amount }
}

export function getProductPriceLabel(product: ProductRecord, selectedVariant?: ProductVariant): string {
  const display = getProductPriceDisplay(product, selectedVariant)
  return display.qualifier ? `${display.qualifier} · ${display.amount}` : display.amount
}

export interface GiftDiscoveryGroup {
  slug: string
  name: string
  description: string
  productSlugs: readonly string[]
}

export const giftDiscoveryGroups: readonly GiftDiscoveryGroup[] = [
  { slug: 'gifts-under-500', name: 'Gifts under ₹500', description: 'A thoughtful gift within your budget. Ask us for the current options.', productSlugs: ['crochet-heart-keychain', 'crochet-flower-keychain', 'cute-crochet-dress-keychain', 'crochet-sunflower-keychain'] },
  { slug: 'birthday-gifts', name: 'Birthday gifts', description: 'Sunny flowers and colourful keepsakes for their day.', productSlugs: ['cute-crochet-dress-keychain', 'crochet-sunflower-keychain', 'blue-mix-crochet-flower'] },
  { slug: 'anniversary-gifts', name: 'Anniversary gifts', description: 'Flowers to keep and a little heart to carry.', productSlugs: ['red-pink-crochet-flower-bouquet', 'red-blue-crochet-flower-bouquet', 'crochet-heart-keychain'] },
]

export function getProductsForGiftGroup(group: GiftDiscoveryGroup): ProductRecord[] {
  return group.productSlugs.flatMap((slug) => featuredProducts.filter((product) => product.slug === canonicalSlug(slug)))
}

export function getCollectionBySlug(slug: string): CollectionRecord | undefined {
  return catalogueCollections.find((collection) => collection.slug === slug)
}

export function getProductsForCollection(collection: CollectionRecord): ProductRecord[] {
  return featuredProducts.filter((product) => product.collectionSlug === collection.slug)
}

export function getProductBySlug(slug: string): ProductRecord | undefined {
  return featuredProducts.find((product) => product.slug === canonicalSlug(slug))
}

const curatedRelatedProductSlugs: Record<string, readonly string[]> = {
  'crochet-flower-keychain': ['crochet-heart-keychain', 'cute-crochet-dress-keychain', 'crochet-sunflower-keychain'],
  'cute-crochet-dress-keychain': ['crochet-flower-keychain', 'crochet-heart-keychain'],
  'crochet-heart-keychain': ['crochet-flower-keychain', 'cute-crochet-dress-keychain'],
  'crochet-sunflower-keychain': ['crochet-flower-keychain', 'crochet-heart-keychain'],
  'red-blue-crochet-flower-bouquet': ['red-pink-crochet-flower-bouquet'],
  'red-pink-crochet-flower-bouquet': ['red-blue-crochet-flower-bouquet'],
  'blue-mix-crochet-flower': ['red-pink-crochet-flower-bouquet', 'crochet-flower-keychain'],
}

export function getRelatedProducts(product: ProductRecord): ProductRecord[] {
  return (curatedRelatedProductSlugs[product.slug] ?? []).flatMap((slug) => {
    const related = getProductBySlug(slug)
    return related ? [related] : []
  })
}
