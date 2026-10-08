import { ShoppingBag, Trash2 } from 'lucide-react'
import { ButtonLink } from './ButtonLink'
import { ContactLink } from './ContactLink'
import { StorefrontImage } from './StorefrontImage'
import { StorefrontPage } from './StorefrontPage'
import { formatConfirmedPrice, getProductPhoto, getProductPrice, getProductPriceDisplay } from '../data/catalogue'
import { useStorefront } from '../state/storefrontContext'
import { MAX_BAG_QUANTITY } from '../state/storefrontState'

export function BagPage() {
  const { cartLines, cartCount, cartSubtotal, cartHasUnavailableItems, updateCartQuantity, removeFromBag, clearBag } = useStorefront()

  return (
    <StorefrontPage
      title="Your shopping bag"
      eyebrow="A THOUGHTFUL SELECTION"
      introduction="Review your pieces, adjust quantities, and continue when you are ready to place a secure order."
    >
      {cartLines.length === 0 ? (
        <div className="selection-empty">
          <ShoppingBag aria-hidden="true" size={25} strokeWidth={1.4} />
          <h2>Your bag is waiting for a little something.</h2>
          <p>Your chosen pieces will appear here with their variant, quantity, and current catalogue price. Delivery and payment are confirmed securely at checkout.</p>
          <div className="selection-empty__actions">
            <ButtonLink href="/shop">Explore the catalogue</ButtonLink>
            <ButtonLink href="/wishlist" variant="text" icon="up-right">View wishlist</ButtonLink>
          </div>
        </div>
      ) : (
        <div className="bag-layout">
          <section className="bag-items" aria-label="Items in your shopping bag">
            {cartLines.map((line) => (
              <article className={`bag-item ${!line.eligibility.eligible ? 'bag-item--unavailable' : ''}`} key={`${line.slug}-${line.variantId ?? 'default'}`}>
                {line.product ? (
                  <a className="bag-item__image" href={`/products/${line.slug}${line.variantId ? `?variant=${encodeURIComponent(line.variantId)}` : ''}`} aria-label={`View ${line.product.name}${line.variant ? ` in ${line.variant.colour}` : ''}`}>
                    <StorefrontImage kind="product" photo={line.variant?.photo ?? getProductPhoto(line.product, line.variantId)} placeholder={{ variant: line.product.variant, label: `${line.product.name} product photograph` }} />
                  </a>
                ) : <div className="bag-item__missing"><ShoppingBag aria-hidden="true" size={20} strokeWidth={1.4} /></div>}
                <div className="bag-item__copy">
                  <h2>{line.product ? <a href={`/products/${line.slug}${line.variantId ? `?variant=${encodeURIComponent(line.variantId)}` : ''}`}>{line.product.name}</a> : 'Product no longer listed'}</h2>
                  {line.variant && <p className="bag-item__variant">Colour: {line.variant.colour}</p>}
                  {line.product?.price ? (
                    <p className="bag-item__price">
                      {(() => {
                        const display = getProductPriceDisplay(line.product, line.variant)
                        return <><strong>{display.amount}</strong> <span>each</span></>
                      })()}
                    </p>
                  ) : <p className="bag-item__price">Price on request</p>}
                  {line.product && line.eligibility.eligible && (() => {
                    const price = getProductPrice(line.product, line.variant)
                    return price ? <p className="bag-item__line-total"><span>Line total</span><strong>{formatConfirmedPrice({ amount: price.amount * line.quantity, currency: price.currency })}</strong></p> : null
                  })()}
                  {!line.eligibility.eligible && <p className="bag-item__issue" role="status">{line.eligibility.reason}</p>}
                  <div className="bag-item__controls">
                    <label htmlFor={`quantity-${line.slug}-${line.variantId ?? 'default'}`}>Quantity</label>
                    <div className="quantity-stepper">
                      <button type="button" aria-label={`Decrease quantity of ${line.product?.name ?? 'product'}`} disabled={!line.eligibility.eligible || line.quantity <= 1} onClick={() => updateCartQuantity(line.slug, line.quantity - 1, line.variantId)}>−</button>
                      <input id={`quantity-${line.slug}-${line.variantId ?? 'default'}`} type="number" min="1" max={MAX_BAG_QUANTITY} step="1" value={line.quantity} disabled={!line.eligibility.eligible} onChange={(event) => updateCartQuantity(line.slug, Number(event.target.value), line.variantId)} />
                      <button type="button" aria-label={`Increase quantity of ${line.product?.name ?? 'product'}`} disabled={!line.eligibility.eligible || line.quantity >= MAX_BAG_QUANTITY} onClick={() => updateCartQuantity(line.slug, line.quantity + 1, line.variantId)}>+</button>
                    </div>
                    <button className="text-action" type="button" onClick={() => removeFromBag(line.slug, line.variantId)} aria-label={`Remove ${line.product?.name ?? 'unlisted product'}${line.variant ? ` in ${line.variant.colour}` : ''} from bag`}><Trash2 aria-hidden="true" size={14} strokeWidth={1.6} /> Remove</button>
                  </div>
                  {!line.eligibility.eligible && <ContactLink className="text-action" channel="whatsapp" context={line.product ? 'product' : 'general'} product={line.product} variantId={line.variantId}>Enquire about this item</ContactLink>}
                </div>
              </article>
            ))}
            <button className="text-action bag-clear" type="button" onClick={() => { if (window.confirm('Clear all items from your shopping bag?')) clearBag() }}><Trash2 aria-hidden="true" size={14} strokeWidth={1.6} /> Clear shopping bag</button>
          </section>
          <aside className="bag-summary" aria-labelledby="bag-summary-title">
            <p className="eyebrow">READY WHEN YOU ARE</p>
            <h2 id="bag-summary-title">A clear next step.</h2>
            <div className="bag-summary__subtotal"><span>Subtotal · {cartCount} item{cartCount === 1 ? '' : 's'}</span><strong>{cartSubtotal > 0 ? formatConfirmedPrice({ amount: cartSubtotal, currency: 'INR' }) : 'Not available'}</strong></div>
            <div className="bag-summary__meter" aria-label={`${cartCount} item${cartCount === 1 ? '' : 's'} in bag`}><span>Bag quantity</span><strong>{cartCount}</strong><meter min="0" max="10" value={Math.min(cartCount, 10)} /></div>
            {cartHasUnavailableItems && <p className="bag-summary__issue" role="status">Some items need attention before checkout. Remove them or contact Soft Heaven to review the catalogue details.</p>}
            <p>Shipping is calculated securely from your delivery address. You will review the full order before payment.</p>
            <ButtonLink href="/checkout" variant="dark">Proceed to checkout</ButtonLink>
            <ButtonLink href="/shipping-delivery" variant="text" icon="up-right">Shipping & delivery</ButtonLink>
          </aside>
        </div>
      )}
    </StorefrontPage>
  )
}
