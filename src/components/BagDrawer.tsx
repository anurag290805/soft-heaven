import { Check, ShoppingBag, X } from 'lucide-react'
import { getProductPriceDisplay, getProductVariant } from '../data/catalogue'
import { useStorefront } from '../state/storefrontContext'
import { StorefrontImage } from './StorefrontImage'

export function BagDrawer() {
  const { bagNotice, cartCount, cartSubtotal, dismissBagNotice } = useStorefront()
  if (!bagNotice) return null

  const variant = getProductVariant(bagNotice.product, bagNotice.variantId)
  const price = getProductPriceDisplay(bagNotice.product, variant)

  return (
    <aside className="bag-drawer" role="status" aria-live="polite" aria-label="Bag update">
      <div className="bag-drawer__topline">
        <span><Check aria-hidden="true" size={15} strokeWidth={2} /> Added to your bag</span>
        <button type="button" aria-label="Dismiss bag confirmation" onClick={dismissBagNotice}><X aria-hidden="true" size={17} strokeWidth={1.7} /></button>
      </div>
      <div className="bag-drawer__item">
        <div className="bag-drawer__image"><StorefrontImage kind="product" photo={variant?.photo ?? bagNotice.product.photo} placeholder={{ variant: bagNotice.product.variant, label: `${bagNotice.product.name} product photograph` }} /></div>
        <div>
          <strong>{bagNotice.product.name}</strong>
          {variant && <span>{variant.colour}</span>}
          <small>{price.amount}</small>
        </div>
      </div>
      <div className="bag-drawer__summary"><span>{cartCount} item{cartCount === 1 ? '' : 's'} in bag</span><strong>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(cartSubtotal)}</strong></div>
      <div className="bag-drawer__actions">
        <a className="button button--dark" href="/checkout" onClick={dismissBagNotice}><ShoppingBag aria-hidden="true" size={15} /> Checkout <span>{cartCount}</span></a>
        <button className="button button--text" type="button" onClick={dismissBagNotice}>Continue shopping</button>
        <a className="button button--text" href="/bag" onClick={dismissBagNotice}>View bag</a>
      </div>
    </aside>
  )
}
