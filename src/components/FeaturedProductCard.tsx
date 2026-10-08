import { useState } from 'react'
import { StorefrontImage } from './StorefrontImage'
import type { ProductRecord } from './storefront.types'
import { getProductPhoto, getProductPriceDisplay, getProductVariant, isDevelopmentFixture } from '../data/catalogue'
import { ProductBagAction, WishlistToggle } from './ProductActions'
import { VariantPicker } from './VariantPicker'

interface FeaturedProductCardProps {
  product: ProductRecord
  initialVariantId?: string
}

export function FeaturedProductCard({ product, initialVariantId }: FeaturedProductCardProps) {
  const isFixture = isDevelopmentFixture(product)
  const [selectedVariantId, setSelectedVariantId] = useState(initialVariantId ?? getProductVariant(product)?.id)
  const selectedVariant = getProductVariant(product, selectedVariantId)
  const price = getProductPriceDisplay(product, selectedVariant)
  const selectedPhoto = getProductPhoto(product, selectedVariantId)

  return (
    <article className="product-card product-card--link">
      <div className="product-card__image">
        <a className="product-card__image-link" href={`/products/${product.slug}${selectedVariant ? `?variant=${encodeURIComponent(selectedVariant.id)}` : ''}`} aria-label={`View ${product.name}${selectedVariant ? ` in ${selectedVariant.colour}` : ''}`}>
          <StorefrontImage
            kind="product"
            photo={selectedPhoto}
             placeholder={{ variant: product.variant, label: `${product.name} product photograph` }}
          />
        </a>
        {isFixture && <span className="sample-tag">sample item</span>}
        <WishlistToggle product={product} variantId={selectedVariantId} className="product-card__wishlist" />
      </div>
      <a className="product-card__details" href={`/products/${product.slug}${selectedVariant ? `?variant=${encodeURIComponent(selectedVariant.id)}` : ''}`}>
        <div>
          <span className="product-card__type">{isFixture ? 'Development fixture' : product.type}</span>
          <h3>{product.name}</h3>
          {selectedVariant && <span className="product-card__selected-variant">{selectedVariant.colour}</span>}
        </div>
          <span className="product-card__price">
            {isFixture ? <strong>Development preview</strong> : <>
              {price.qualifier && <small>{price.qualifier}</small>}
              <strong>{price.amount}</strong>
            </>}
          </span>
      </a>
      {product.variants && product.variants.length > 1 && (
        <VariantPicker product={product} selectedVariantId={selectedVariantId} onChange={setSelectedVariantId} compact />
      )}
      <div className="product-card__actions">
        <ProductBagAction product={product} variantId={selectedVariantId} />
      </div>
    </article>
  )
}
