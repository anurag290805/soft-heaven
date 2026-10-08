import { useEffect, useRef, useState } from 'react'
import { Maximize2, Sparkles, X } from 'lucide-react'
import { ButtonLink } from './ButtonLink'
import { NotFoundPage } from './NotFoundPage'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'
import { StorefrontImage } from './StorefrontImage'
import { ContactLink } from './ContactLink'
import { WishlistToggle } from './ProductActions'
import type { ProductRecord, ProductVariant } from './storefront.types'
import { getBagEligibility } from '../state/storefrontState'
import { useStorefront } from '../state/storefrontContext'
import { getCollectionBySlug, getProductBySlug, getProductGallery, getProductPriceDisplay, getProductVariant, getRelatedProducts, isDevelopmentFixture, isIllustrativePrice } from '../data/catalogue'
import { FeaturedProductCard } from './FeaturedProductCard'
import { SectionHeading } from './SectionHeading'
import { VariantPicker } from './VariantPicker'
import { storefrontNavigationLinks } from '../data/siteRoutes'
import './ProductDetailPage.css'

interface ProductDetailPageProps {
  slug: string
}

function getAvailabilityMessage(product: ProductRecord, selectedVariant?: ProductVariant) {
  if (isDevelopmentFixture(product)) return 'This is a development fixture for presentation only and is not currently available to order.'

  switch (selectedVariant?.availability ?? product.availability) {
    case 'made-to-order':
      return 'This product is made to order. Ordering is not enabled on this site.'
    case 'ready-to-ship':
      return 'This piece is ready to ship. Delivery arrangements are confirmed directly.'
    case 'custom-request':
      return 'This product requires a reviewed custom request and quote. Requests are not submitted through this site.'
    case 'temporarily-unavailable':
      return 'This product is temporarily unavailable to order.'
    case 'not-orderable':
      return 'Availability, pricing, and ordering details are confirmed directly by enquiry.'
    case 'development-only':
      return 'This is a development fixture for presentation only and is not currently available to order.'
    case 'available':
      return 'Available to add to your bag. Delivery is reviewed at checkout.'
    default:
      return 'Ordering details are not currently available.'
  }
}

function getAvailabilityLabel(product: ProductRecord, selectedVariant?: ProductVariant) {
  if (isDevelopmentFixture(product)) return 'Development preview'

  switch (selectedVariant?.availability ?? product.availability) {
    case 'ready-to-ship':
      return 'Ready to ship'
    case 'available':
      return 'Available to order'
    case 'made-to-order':
      return 'Made to order'
    case 'custom-request':
      return 'Custom request'
    case 'temporarily-unavailable':
      return 'Temporarily unavailable'
    case 'not-orderable':
      return 'Enquiry only'
    case 'development-only':
      return 'Development preview'
    default:
      return 'Availability to confirm'
  }
}

function getStatusLabel(product: ProductRecord) {
  if (product.publicationStatus === 'development-fixture') return 'Development fixture'
  if (product.publicationStatus === 'draft') return 'In preparation'
  return 'Published catalogue item'
}

export function ProductDetailPage({ slug }: ProductDetailPageProps) {
  const product = getProductBySlug(slug)
  const collection = product ? getCollectionBySlug(product.collectionSlug) : undefined
  const [bagMessage, setBagMessage] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [imageOpen, setImageOpen] = useState(false)
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0)
  const [selectedVariantId, setSelectedVariantId] = useState(() => {
    if (typeof window === 'undefined') return product ? getProductVariant(product)?.id : undefined
    const requestedVariantId = new URLSearchParams(window.location.search).get('variant') ?? undefined
    return product?.variants?.some((variant) => variant.id === requestedVariantId) ? requestedVariantId : (product ? getProductVariant(product)?.id : undefined)
  })
  const imageTriggerRef = useRef<HTMLButtonElement>(null)
  const imageCloseRef = useRef<HTMLButtonElement>(null)
  const touchStartX = useRef<number | null>(null)
  const suppressNextImageClick = useRef(false)
  const { addToBag } = useStorefront()

  useEffect(() => {
    if (!imageOpen) return undefined

    const previousActiveElement = document.activeElement as HTMLElement | null
    const triggerElement = imageTriggerRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    imageCloseRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setImageOpen(false)
        return
      }

      if (event.key === 'Tab' && document.activeElement === imageCloseRef.current) {
        event.preventDefault()
        imageCloseRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousActiveElement?.focus()
      triggerElement?.focus()
    }
  }, [imageOpen])

  useEffect(() => {
    if (!product || !collection) {
      document.title = 'Product not found | Soft Heaven'
      return undefined
    }

    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const previousTitle = document.title
    const previousDescription = description?.content

    document.title = `${product.name} | Soft Heaven`
     if (description) description.content = `${product.shortDescription} View the Soft Heaven catalogue item.`

    return () => {
      document.title = previousTitle
      if (description && previousDescription !== undefined) description.content = previousDescription
    }
  }, [collection, product])

  if (!product || !collection) return <NotFoundPage />

  const selectedVariant = getProductVariant(product, selectedVariantId)
  const price = getProductPriceDisplay(product, selectedVariant)
  const isFixture = isDevelopmentFixture(product)
  const eligibility = getBagEligibility(product, selectedVariantId)
  const galleryPhotos = getProductGallery(product, selectedVariantId)
  const selectedPhoto = galleryPhotos[selectedPhotoIndex] ?? galleryPhotos[0]
  const hasSpecifications = product.specifications && (
    product.specifications.materials?.length || product.specifications.dimensions || product.specifications.careInstructions || product.specifications.productionEstimate
  )
  const relatedProducts = getRelatedProducts(product).slice(0, 3)

  const selectVariant = (variantId: string) => {
    setSelectedVariantId(variantId)
    setSelectedPhotoIndex(0)
    const params = new URLSearchParams(window.location.search)
    params.set('variant', variantId)
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`)
  }

  const moveGallery = (direction: 1 | -1) => {
    if (galleryPhotos.length < 2) return
    setSelectedPhotoIndex((current) => (current + direction + galleryPhotos.length) % galleryPhotos.length)
  }

  const handleAddToBag = () => {
    const result = addToBag(product, selectedVariantId, quantity)
    setBagMessage(result.ok ? `Added ${quantity} ${quantity === 1 ? 'piece' : 'pieces'} to your bag.` : (result.reason ?? 'This product could not be added.'))
  }

  return (
    <div className="site-shell product-page-shell" id="top">
       <SiteHeader navigationLinks={storefrontNavigationLinks} homeHref="/" searchHref="/#featured" />

       <main id="main-content">
        <div className="product-page__breadcrumbs page-section">
          <nav aria-label="Breadcrumb">
            <ol>
              <li><a href="/">Home</a></li>
              <li aria-hidden="true">/</li>
              <li><a href={`/collections/${collection.slug}`}>{collection.name}</a></li>
              <li aria-hidden="true">/</li>
              <li aria-current="page">{product.name}</li>
            </ol>
          </nav>
        </div>

        <section className="product-page__main page-section" aria-labelledby="product-page-title">
          <div className="product-page__visual">
              {selectedPhoto ? (
                 <button
                  ref={imageTriggerRef}
                  className="product-page__image-trigger"
                  type="button"
                 aria-label={`Open a larger image of ${product.name}`}
                  onClick={() => {
                    if (suppressNextImageClick.current) {
                      suppressNextImageClick.current = false
                      return
                    }
                    setImageOpen(true)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                      event.preventDefault()
                      moveGallery(event.key === 'ArrowRight' ? 1 : -1)
                    }
                  }}
                  onTouchStart={(event) => { touchStartX.current = event.changedTouches[0]?.clientX ?? null }}
                  onTouchEnd={(event) => {
                    if (touchStartX.current === null) return
                    const delta = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current
                    if (Math.abs(delta) > 45) {
                      suppressNextImageClick.current = true
                      moveGallery(delta < 0 ? 1 : -1)
                    }
                    touchStartX.current = null
                  }}
                >
                  <StorefrontImage
                    kind="product"
                    photo={selectedPhoto}
                    placeholder={{ variant: product.variant, label: `${product.name} product photograph` }}
                  />
                 <span className="product-page__image-expand"><Maximize2 aria-hidden="true" size={15} strokeWidth={1.6} /> View larger</span>
               </button>
              ) : (
                <>
                  <StorefrontImage kind="product" placeholder={{ variant: product.variant, label: `${product.name} product image` }} />
                  <span className="product-page__image-label">product photograph not available</span>
                </>
              )}
            </div>
             {galleryPhotos.length > 1 && (
               <>
               <div className="product-page__gallery-count" aria-live="polite">Photograph {selectedPhotoIndex + 1} of {galleryPhotos.length}</div>
               <div className="product-page__gallery-controls" aria-label="More product photographs">
                 {galleryPhotos.map((photo, index) => (
                  <button
                    className={`product-page__thumbnail${index === selectedPhotoIndex ? ' product-page__thumbnail--selected' : ''}`}
                    type="button"
                     key={`${photo.src}-${index}`}
                    aria-label={`View photograph ${index + 1} of ${galleryPhotos.length}`}
                    aria-pressed={index === selectedPhotoIndex}
                    onClick={() => setSelectedPhotoIndex(index)}
                  >
                    <img src={photo.optimizedSrc ?? photo.src} alt="" width={photo.width} height={photo.height} />
                  </button>
                 ))}
               </div>
               </>
             )}

           <div className="product-page__copy">
            <p className="eyebrow">{getStatusLabel(product)}</p>
            <h1 id="product-page-title">{product.name}</h1>
             <p className="product-page__collection">From <a href={`/collections/${collection.slug}`}>{collection.name}</a></p>
             <p className="product-page__description">{product.shortDescription}</p>
            {product.description && <p className="product-page__description product-page__description--detailed">{product.description}</p>}

            <div className="product-page__save-action">
               <WishlistToggle product={product} variantId={selectedVariantId} />
              <span>Save this {isFixture ? 'preview' : 'piece'} to your wishlist</span>
            </div>

            {product.options && product.options.length > 0 && (
              <div className="product-page__details-block">
                <span className="product-page__label">Options</span>
                <ul>
                  {product.options.map((option) => <li key={option.name}><strong>{option.name}:</strong> {option.values.join(', ')}</li>)}
                </ul>
              </div>
            )}

            {hasSpecifications && product.specifications && (
              <div className="product-page__details-block">
                <span className="product-page__label">Product details</span>
                <dl>
                  {Boolean(product.specifications.materials?.length) && <><dt>Materials</dt><dd>{product.specifications.materials?.join(', ')}</dd></>}
                  {product.specifications.dimensions && <><dt>Dimensions</dt><dd>{product.specifications.dimensions}</dd></>}
                  {product.specifications.careInstructions && <><dt>Care</dt><dd>{product.specifications.careInstructions}</dd></>}
                  {product.specifications.productionEstimate && <><dt>Production estimate</dt><dd>{product.specifications.productionEstimate}</dd></>}
                </dl>
              </div>
            )}

             <div className="product-page__price-block">
               <span className="product-page__label">Price</span>
               {price.qualifier && <span className="product-page__price-qualifier">{price.qualifier}</span>}
               <strong>{price.amount}</strong>
                {isIllustrativePrice(product) ? (
                  <p>Pricing is confirmed directly by Soft Heaven before an order is discussed.</p>
               ) : !product.price ? (
                 <p>Ask Soft Heaven for the current price before deciding.</p>
               ) : null}
             </div>

              {product.variants && product.variants.length > 0 && (
               <div className="product-page__variant-selection">
                 <VariantPicker product={product} selectedVariantId={selectedVariantId} onChange={selectVariant} />
                 <p className="product-page__selection-note">The selected colour is used for your bag or enquiry.</p>
               </div>
              )}

              <div className="product-page__quantity">
                <span className="product-page__label">Quantity</span>
                <div className="quantity-stepper" aria-label="Quantity">
                  <button type="button" aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity((current) => Math.max(1, current - 1))}>−</button>
                  <span aria-live="polite">{quantity}</span>
                  <button type="button" aria-label="Increase quantity" disabled={quantity >= 99} onClick={() => setQuantity((current) => Math.min(99, current + 1))}>+</button>
                </div>
              </div>

              <div className="product-page__availability">
               <span className="product-page__label">Availability</span>
                <strong className="product-page__availability-status">{getAvailabilityLabel(product, selectedVariant)}</strong>
                <p>{getAvailabilityMessage(product, selectedVariant)}</p>
            </div>

            {product.personalization && (
              <div className="product-page__personalization">
                <span className="product-page__label">Personalisation</span>
                <p>{product.personalization.note ?? (product.personalization.mode === 'available'
                  ? 'Personalisation is available for this product.'
                  : 'Personalisation requires a reviewed custom request.')}</p>
              </div>
            )}

             <div className="product-page__notice" role="status">
               <Sparkles aria-hidden="true" size={16} strokeWidth={1.5} />
                <p>{isFixture
                  ? 'There is no purchase or order action for this development fixture.'
                  : 'Review your selection and delivery total at checkout. Payment is handled by Razorpay when the store service is configured.'}</p>
            </div>

            <div className="product-page__actions">
              {eligibility.eligible ? (
                <button
                  className="button button--dark"
                  type="button"
                   onClick={handleAddToBag}
                 >
                   Add to bag
                </button>
               ) : (
                  <ContactLink className="button button--dark" channel="whatsapp" context="product" product={product} variantId={selectedVariantId}>
                   Enquire on WhatsApp
                 </ContactLink>
               )}
               {eligibility.eligible && (
                 <ContactLink className="button button--soft" channel="whatsapp" context="product" product={product} variantId={selectedVariantId}>
                   Enquire on WhatsApp
                 </ContactLink>
               )}
               <ContactLink className="button button--text" channel="email" context="product" product={product} variantId={selectedVariantId}>
                Email about this product
              </ContactLink>
              <ButtonLink href={`/collections/${collection.slug}`} variant="text" icon="up-right">Back to {collection.name}</ButtonLink>
              <ButtonLink href="/" variant="text" icon="up-right">Return to Soft Heaven</ButtonLink>
            </div>
             {bagMessage && <p className="product-page__action-message" role="status">{bagMessage}</p>}
           </div>
         </section>
          {relatedProducts.length > 0 && (
            <section className="product-related page-section" aria-labelledby="product-related-title">
               <SectionHeading
                 eyebrow="A CONSIDERED NEXT LOOK"
                 title="Keep exploring the soft edit."
                 description="Curated pieces that sit naturally alongside this design."
                headingId="product-related-title"
              />
              <div className="product-grid">
                {relatedProducts.map((relatedProduct) => <FeaturedProductCard key={relatedProduct.slug} product={relatedProduct} />)}
              </div>
            </section>
          )}
        </main>

        {selectedPhoto && imageOpen && (
         <div
           className="product-image-lightbox"
           role="dialog"
           aria-modal="true"
           aria-label={`Larger view of ${product.name}`}
           onMouseDown={(event) => {
             if (event.target === event.currentTarget) setImageOpen(false)
           }}
         >
           <div className="product-image-lightbox__panel">
             <button
               ref={imageCloseRef}
               className="product-image-lightbox__close"
               type="button"
               aria-label="Close larger product image"
               onClick={() => setImageOpen(false)}
             >
               <X aria-hidden="true" size={20} strokeWidth={1.6} />
             </button>
              <img src={selectedPhoto.src} alt={selectedPhoto.alt} width={selectedPhoto.width} height={selectedPhoto.height} />
             <p>{product.name}</p>
           </div>
         </div>
       )}

         <div className="product-page__mobile-purchase">
           {eligibility.eligible ? (
             <button className="button button--dark" type="button" onClick={handleAddToBag}>{price.amount} · Add to bag</button>
           ) : (
             <ContactLink className="button button--dark" channel="whatsapp" context="product" product={product} variantId={selectedVariantId}>Enquire on WhatsApp</ContactLink>
           )}
         </div>
        <SiteFooter homePrefix="/" />
    </div>
  )
}
