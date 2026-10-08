import { useEffect, useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { ButtonLink } from './ButtonLink'
import { FeaturedProductCard } from './FeaturedProductCard'
import { SectionHeading } from './SectionHeading'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'
import { StorefrontImage } from './StorefrontImage'
import { getCollectionBySlug, getProductsForCollection, isDevelopmentFixture, isPubliclyListedProduct } from '../data/catalogue'
import { NotFoundPage } from './NotFoundPage'
import { storefrontNavigationLinks } from '../data/siteRoutes'
import './CollectionPage.css'

interface CollectionPageProps {
  slug: string
}

export function CollectionPage({ slug }: CollectionPageProps) {
  const collection = getCollectionBySlug(slug)
  const [sortOrder, setSortOrder] = useState<'listed' | 'alphabetical'>('listed')
  const products = useMemo(() => collection ? getProductsForCollection(collection) : [], [collection])
  const visibleProducts = useMemo(() => {
    if (sortOrder === 'listed') return products
    return [...products].sort((firstProduct, secondProduct) => firstProduct.name.localeCompare(secondProduct.name, 'en', { sensitivity: 'base' }))
  }, [products, sortOrder])

  useEffect(() => {
    if (!collection) {
      document.title = 'Collection not found | Soft Heaven'
      return undefined
    }

    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const previousTitle = document.title
    const previousDescription = description?.content

    document.title = `${collection.name} | Soft Heaven`
     if (description) description.content = `${collection.description} Browse the Soft Heaven collection.`

    return () => {
      document.title = previousTitle
      if (description && previousDescription !== undefined) description.content = previousDescription
    }
  }, [collection])

  if (!collection) return <NotFoundPage />

  const hasPublicProduct = products.some(isPubliclyListedProduct)
  const hasDevelopmentFixture = products.some(isDevelopmentFixture)

  return (
     <div className="site-shell collection-page-shell" id="top">
       <SiteHeader navigationLinks={storefrontNavigationLinks} homeHref="/" searchHref="/#featured" />

       <main id="main-content">
        <section className="collection-page__hero page-section" aria-labelledby="collection-page-title">
          <div className="collection-page__hero-copy">
             <p className="eyebrow">THE COLLECTION</p>
            <h1 id="collection-page-title">{collection.name}</h1>
            <p>{collection.description}</p>
            <ButtonLink href="/#collections" variant="text" icon="up-right">Back to all collections</ButtonLink>
          </div>
          <StorefrontImage
            kind="collection"
            photo={collection.photo}
             placeholder={{ variant: collection.variant, label: `${collection.name} product photograph` }}
          />
        </section>

        <section className="collection-page__products" aria-labelledby="collection-products-title">
          <div className="page-section">
            <SectionHeading
              eyebrow={hasPublicProduct ? 'THE SOFT HEAVEN COLLECTION' : 'A DEVELOPMENT PREVIEW'}
              title={`A closer look at ${collection.name.toLowerCase()}.`}
              description={hasPublicProduct
                ? 'A considered selection of handmade pieces. Product details and ordering terms are shown only when confirmed.'
                 : 'The collection is being prepared with care. Product information and ordering details are confirmed by enquiry.'}
              headingId="collection-products-title"
            />

            {products.length === 0 ? (
              <div className="collection-page__empty" role="status">
                <Sparkles aria-hidden="true" size={20} strokeWidth={1.5} />
                <h3>This collection is being prepared.</h3>
                <p>There are no customer-ready pieces to show yet. Please return as the collection takes shape.</p>
                <ButtonLink href="/" variant="text" icon="up-right">Return to Soft Heaven</ButtonLink>
              </div>
            ) : (
              <>
                {hasDevelopmentFixture && (
                  <div className="collection-page__status" role="status">
                    <Sparkles aria-hidden="true" size={16} strokeWidth={1.5} />
                    <p>These examples are for development only. Products, photography, pricing, and availability are still being prepared.</p>
                  </div>
                )}
                <div className="collection-page__controls" aria-label="Collection controls">
                  <label htmlFor="collection-sort">Sort products</label>
                  <select id="collection-sort" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as 'listed' | 'alphabetical')}>
                    <option value="listed">As listed</option>
                    <option value="alphabetical">Name: A–Z</option>
                  </select>
                  <span role="status">Showing {visibleProducts.length} {visibleProducts.length === 1 ? 'piece' : 'pieces'}</span>
                </div>
                <div className="product-grid">
                  {visibleProducts.map((product) => <FeaturedProductCard product={product} key={product.slug} />)}
                </div>
              </>
            )}
          </div>
        </section>
      </main>

      <SiteFooter homePrefix="/" />
    </div>
  )
}
