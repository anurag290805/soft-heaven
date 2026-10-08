import type { ArtworkVariant } from './Artwork'
import type { StorefrontPhoto } from './StorefrontImage'

export interface NavigationLink {
  label: string
  href: string
}

export interface CollectionRecord {
  id: string
  slug: string
  number: string
  name: string
  description: string
  variant: ArtworkVariant
  photo?: StorefrontPhoto
  productSlugs: readonly string[]
}

/**
 * Publication is deliberately separate from ordering. A draft is a genuine
 * product record being prepared, while a published record is approved to
 * appear in the public catalogue. Development fixtures never become public
 * through a default value.
 */
export type ProductPublicationStatus = 'development-fixture' | 'draft' | 'published'

export type ProductAvailability =
  | 'development-only'
  | 'not-orderable'
  | 'ready-to-ship'
  | 'available'
  | 'made-to-order'
  | 'custom-request'
  | 'temporarily-unavailable'

export interface ConfirmedPrice {
  // Rupees, including paise as decimals; set only after the owner confirms it.
  amount: number
  currency: 'INR'
}

export type ProductPriceStatus = 'illustrative' | 'owner-confirmed'

export interface PersonalizationConfig {
  mode: 'available' | 'custom-request'
  note?: string
}

export interface ProductOption {
  name: string
  values: readonly string[]
}

export interface ProductSpecifications {
  // Omit each field until its content has been confirmed for this product.
  materials?: readonly string[]
  dimensions?: string
  careInstructions?: string
  productionEstimate?: string
}

/**
 * A product variant is a real purchasable/enquirable choice, never a visual
 * filter. Every published variant must carry its own genuine photograph.
 */
export interface ProductVariant {
  id: string
  name: string
  colour: string
  photo: StorefrontPhoto
  gallery?: readonly StorefrontPhoto[]
  swatch?: string
  availability?: ProductAvailability
  orderability?: boolean
  price?: ConfirmedPrice
  priceStatus?: ProductPriceStatus
}

interface ProductDetails {
  id: string
  slug: string
  name: string
  type: string
  shortDescription: string
  description?: string
  collectionSlug: string
  variant: ArtworkVariant
  photo?: StorefrontPhoto
  gallery?: readonly StorefrontPhoto[]
  variants?: readonly ProductVariant[]
  occasions?: readonly string[]
  price?: ConfirmedPrice
  priceStatus?: ProductPriceStatus
  orderability?: boolean
  personalization?: PersonalizationConfig
  options?: readonly ProductOption[]
  specifications?: ProductSpecifications
}

/** A fixture cannot acquire an orderable state or price by accident. */
export type ProductRecord = ProductDetails & (
  | {
    publicationStatus: 'development-fixture'
    availability: 'development-only'
    price?: never
  }
  | {
    publicationStatus: 'draft'
    availability: 'not-orderable'
  }
  | {
    publicationStatus: 'published'
    availability: Exclude<ProductAvailability, 'development-only'>
    photo: StorefrontPhoto
  }
)
