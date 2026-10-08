import { useEffect, useState } from 'react'
import { Heart, ShoppingBag } from 'lucide-react'
import type { ProductRecord } from './storefront.types'
import { ContactLink } from './ContactLink'
import { getBagEligibility } from '../state/storefrontState'
import { useStorefront } from '../state/storefrontContext'
import { getProductVariant } from '../data/catalogue'

interface WishlistToggleProps {
  product: ProductRecord
  variantId?: string
  className?: string
}

export function WishlistToggle({ product, variantId, className = '' }: WishlistToggleProps) {
  const { isWishlisted, toggleWishlist } = useStorefront()
  const selectedVariantId = product.variants?.length ? (variantId ?? getProductVariant(product)?.id) : undefined
  const pressed = isWishlisted(product.slug, selectedVariantId)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!message) return undefined
    const timeout = window.setTimeout(() => setMessage(null), 2000)
    return () => window.clearTimeout(timeout)
  }, [message])

  return (
    <span className={`wishlist-toggle-wrap ${className}`.trim()}>
      <button
        className="wishlist-toggle"
        type="button"
        aria-label={pressed ? `Remove ${product.name}${selectedVariantId ? ` in ${getProductVariant(product, selectedVariantId)?.colour}` : ''} from wishlist` : `Add ${product.name}${selectedVariantId ? ` in ${getProductVariant(product, selectedVariantId)?.colour}` : ''} to wishlist`}
        aria-pressed={pressed}
        onClick={() => {
          toggleWishlist(product, selectedVariantId)
          setMessage(pressed ? 'Removed from wishlist' : 'Saved to wishlist')
        }}
      >
        <Heart aria-hidden="true" size={18} strokeWidth={1.6} fill={pressed ? 'currentColor' : 'none'} />
      </button>
      {message && <span className="wishlist-toggle__feedback" role="status">{message}</span>}
    </span>
  )
}

interface BagActionProps {
  product: ProductRecord
  variantId?: string
}

export function ProductBagAction({ product, variantId }: BagActionProps) {
  const { addToBag } = useStorefront()
  const eligibility = getBagEligibility(product, variantId)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!message) return undefined
    const timeout = window.setTimeout(() => setMessage(null), 2200)
    return () => window.clearTimeout(timeout)
  }, [message])

  if (eligibility.eligible) {
    return (
      <div className="product-card__action-wrap">
        <button
          className="product-card__bag-action"
          type="button"
          onClick={() => {
            const result = addToBag(product, variantId)
            setMessage(result.ok ? 'Added to bag' : (result.reason ?? 'This product could not be added'))
          }}
        >
          <ShoppingBag aria-hidden="true" size={15} strokeWidth={1.6} />
          Add to bag
        </button>
        {message && <span className="product-card__action-message" role="status">{message}</span>}
      </div>
    )
  }

  return (
    <ContactLink className="product-card__enquiry-action" channel="whatsapp" context="product" product={product} variantId={variantId}>
      Contact to enquire
    </ContactLink>
  )
}
