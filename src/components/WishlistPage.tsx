import { Heart, X } from 'lucide-react'
import { ButtonLink } from './ButtonLink'
import { FeaturedProductCard } from './FeaturedProductCard'
import { StorefrontPage } from './StorefrontPage'
import { useStorefront } from '../state/storefrontContext'

export function WishlistPage() {
  const { wishlistProducts, wishlistSyncMessage, removeFromWishlist } = useStorefront()

  return (
    <StorefrontPage
      title="Your wishlist"
      eyebrow="KEPT CLOSE"
       introduction="A little place for pieces you would like to return to. Saving an item does not reserve it or place an order."
    >
      {wishlistSyncMessage && <p className="commerce-status" role="status">{wishlistSyncMessage}</p>}
      {wishlistProducts.length === 0 ? (
        <div className="selection-empty">
          <Heart aria-hidden="true" size={25} strokeWidth={1.4} />
          <h2>A little room for favourites.</h2>
          <p>Use the heart on a product to keep it here for your next visit.</p>
           <ButtonLink href="/#featured">Browse the catalogue</ButtonLink>
        </div>
      ) : (
        <>
           <p className="selection-count" role="status">{wishlistProducts.length} saved {wishlistProducts.length === 1 ? 'piece' : 'pieces'}</p>
           <div className="product-grid wishlist-grid">
             {wishlistProducts.map((line) => line.product ? (
               <div className="wishlist-item" key={`${line.slug}-${line.variantId ?? 'default'}`}>
                 <FeaturedProductCard product={line.product} initialVariantId={line.variantId} />
                 <button className="text-action wishlist-item__remove" type="button" onClick={() => removeFromWishlist(line.slug, line.variantId)} aria-label={`Remove ${line.product.name}${line.variant ? ` in ${line.variant.colour}` : ''} from wishlist`}>
                   <X aria-hidden="true" size={14} strokeWidth={1.7} /> Remove
                 </button>
               </div>
             ) : null)}
          </div>
        </>
      )}
    </StorefrontPage>
  )
}
