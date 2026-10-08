import type { CSSProperties } from 'react'
import type { ProductRecord } from './storefront.types'
import { getProductVariant } from '../data/catalogue'

interface VariantPickerProps {
  product: ProductRecord
  selectedVariantId?: string
  onChange?: (variantId: string) => void
  compact?: boolean
}

export function VariantPicker({ product, selectedVariantId, onChange, compact = false }: VariantPickerProps) {
  if (!product.variants?.length) return null

  const selectedVariant = getProductVariant(product, selectedVariantId)

  return (
    <div className={`variant-picker${compact ? ' variant-picker--compact' : ''}`}>
      <div className="variant-picker__heading">
        <span className="variant-picker__label">Colour</span>
        <strong>{selectedVariant?.colour}</strong>
      </div>
      <div className="variant-picker__swatches" role="group" aria-label={`${product.name} colour options`}>
        {product.variants.map((variant) => {
          const selected = variant.id === selectedVariant?.id
          const swatchStyle = { '--variant-swatch': variant.swatch ?? '#d8cbc1' } as CSSProperties
          return (
            <button
              className={`variant-swatch${selected ? ' variant-swatch--selected' : ''}`}
              key={variant.id}
              type="button"
              style={swatchStyle}
              title={variant.colour}
              aria-label={`${variant.colour}${selected ? ', selected' : ''}`}
              aria-pressed={selected}
              onClick={() => onChange?.(variant.id)}
            >
              <span aria-hidden="true" />
              <span className="sr-only">{variant.colour}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
