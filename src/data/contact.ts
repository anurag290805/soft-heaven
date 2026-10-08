import type { ProductRecord } from '../components/storefront.types'
import { getProductVariant } from './catalogue'

export const SOFT_HEAVEN_CONTACT = {
  whatsappUrl: 'https://wa.me/919818405206',
  email: 'softheavencorner@gmail.com',
} as const

export const SOFT_HEAVEN_WHATSAPP_URL = SOFT_HEAVEN_CONTACT.whatsappUrl
export const SOFT_HEAVEN_EMAIL = SOFT_HEAVEN_CONTACT.email
export const OWNER_REVIEW_NOTE = 'These details explain how Soft Heaven currently handles orders. If you have a question about a particular request, please ask before you pay.'

export type ContactContext = 'general' | 'product' | 'custom' | 'cart' | 'gift'

export interface GiftEnquiryDetails {
  occasion?: string
  giftWrapping?: boolean
  personalNote?: boolean
}

function getProductUrl(product: ProductRecord): string {
  if (typeof window === 'undefined') return `/products/${product.slug}`
  return new URL(`/products/${product.slug}`, window.location.origin).toString()
}

export function getContactMessage(context: ContactContext = 'general', product?: ProductRecord, cartSummary?: string, giftDetails?: GiftEnquiryDetails, variantId?: string): string {
  if (context === 'product' && product) {
    const variant = getProductVariant(product, variantId)
    const selection = variant ? ` Colour: ${variant.colour}.` : ''
    return `Hello Soft Heaven, I would like to enquire about “${product.name}”.${selection} Please confirm the current availability, specifications, final price, and ordering details. Product page: ${getProductUrl(product)}`
  }

  if (context === 'custom') {
    return 'Hello Soft Heaven, I would like to enquire about a made-to-order or personalised crochet request. Please let me know what details you need from me.'
  }

  if (context === 'cart' && cartSummary) {
    return `Hello Soft Heaven, I would like to enquire about these catalogue items. Please confirm current availability, final pricing, and ordering details before I decide:\n\n${cartSummary}`
  }

  if (context === 'gift') {
    const occasion = giftDetails?.occasion?.trim() || 'Not specified yet'
    const wrapping = giftDetails?.giftWrapping ? 'Please tell me whether gift wrapping can be arranged.' : 'I do not need gift wrapping right now.'
    const personalNote = giftDetails?.personalNote ? 'Please tell me whether a personal note can be included.' : 'I do not need a personal note right now.'
    return `Hello Soft Heaven, I would like to enquire about a crochet gift. Recipient occasion: ${occasion}. ${wrapping} ${personalNote} Please confirm the available options, final price, and arrangements.`
  }

  return 'Hello Soft Heaven, I have a general enquiry about your crochet products, availability, pricing, or ordering process.'
}

export function isContactConfigured(channel: 'whatsapp' | 'email'): boolean {
  return channel === 'whatsapp' ? Boolean(SOFT_HEAVEN_CONTACT.whatsappUrl) : Boolean(SOFT_HEAVEN_CONTACT.email)
}

export function getContactHref(channel: 'whatsapp' | 'email', context: ContactContext = 'general', product?: ProductRecord, cartSummary?: string, giftDetails?: GiftEnquiryDetails, variantId?: string): string {
  const message = getContactMessage(context, product, cartSummary, giftDetails, variantId)
  if (channel === 'whatsapp') return `${SOFT_HEAVEN_WHATSAPP_URL}?text=${encodeURIComponent(message)}`

  const subject = context === 'product' && product
    ? `Product enquiry: ${product.name}`
    : context === 'custom'
      ? 'Made-to-order or personalised enquiry'
      : context === 'cart'
        ? 'Catalogue items enquiry'
        : context === 'gift'
          ? 'Gift enquiry for Soft Heaven'
        : 'General enquiry for Soft Heaven'
  return `mailto:${SOFT_HEAVEN_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`
}
