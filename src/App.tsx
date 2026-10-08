import { useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { ButtonLink } from './components/ButtonLink'
import { CollectionTile } from './components/CollectionTile'
import { FeaturedProductCard } from './components/FeaturedProductCard'
import { SectionHeading } from './components/SectionHeading'
import { SiteFooter } from './components/SiteFooter'
import { SiteHeader } from './components/SiteHeader'
import { StorefrontImage } from './components/StorefrontImage'
import { ContactLink } from './components/ContactLink'
import { catalogueCollections, cataloguePhotos, featuredProducts, getProductBySlug, getProductPrice, getProductPriceLabel, getProductsForGiftGroup, giftDiscoveryGroups, ILLUSTRATIVE_PRICE_NOTICE } from './data/catalogue'
import { SOFT_HEAVEN_CONTACT } from './data/contact'
import { storefrontNavigationLinks } from './data/siteRoutes'
import './App.css'

const homepagePhotos = {
  hero: cataloguePhotos.redBlueBouquet,
  gifting: cataloguePhotos.pinkHeart,
  story: cataloguePhotos.whiteFlower,
}

const homepageEnquiryProduct = getProductBySlug('red-blue-crochet-flower-bouquet')

type ProductSortOrder = 'listed' | 'alphabetical'
type PriceFilter = 'all' | 'under-500' | '500-plus'

function App() {
  const [collectionFilter, setCollectionFilter] = useState('all')
  const [productSortOrder, setProductSortOrder] = useState<ProductSortOrder>('listed')
  const [typeFilter, setTypeFilter] = useState('all')
  const [occasionFilter, setOccasionFilter] = useState('all')
  const [colourFilter, setColourFilter] = useState('all')
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all')

  const visibleProducts = useMemo(() => {
    const matchingProducts = featuredProducts.filter((product) => {
      const productPrice = getProductPrice(product)?.amount
      const matchesPrice = priceFilter === 'all'
        || (priceFilter === 'under-500' && productPrice !== undefined && productPrice < 500)
        || (priceFilter === '500-plus' && productPrice !== undefined && productPrice >= 500)
      return (
        (collectionFilter === 'all' || product.collectionSlug === collectionFilter)
        && (typeFilter === 'all' || product.type === typeFilter)
        && (occasionFilter === 'all' || product.occasions?.includes(occasionFilter))
        && (colourFilter === 'all' || product.variants?.some((variant) => variant.colour === colourFilter))
        && matchesPrice
      )
    })

    if (productSortOrder !== 'alphabetical') return matchingProducts

    return [...matchingProducts].sort((firstProduct, secondProduct) => (
      firstProduct.name.localeCompare(secondProduct.name, 'en', { sensitivity: 'base' })
    ))
  }, [collectionFilter, occasionFilter, colourFilter, priceFilter, productSortOrder, typeFilter])

  return (
    <div className="site-shell" id="top">
       <SiteHeader navigationLinks={storefrontNavigationLinks} />

       <main id="main-content">
        <section className="hero-section page-section" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">THOUGHTFULLY MADE, FROM THE HEART</p>
            <h1 id="hero-title">
               Made to keep,
               <span>made with <em>love.</em></span>
            </h1>
            <p className="hero-description">
              Handcrafted crochet pieces to celebrate your people, brighten your spaces, and make everyday moments feel special.
            </p>
            <div className="hero-actions">
               <ButtonLink href="#featured">Shop all pieces</ButtonLink>
              <ButtonLink href="#custom" variant="text" icon="up-right">Discover personalised gifts</ButtonLink>
            </div>
          </div>

          <div className="hero-visual">
            <StorefrontImage
               kind="hero"
               photo={homepagePhotos.hero}
               placeholder={{ variant: 'hero', label: 'Soft Heaven crochet bouquet' }}
             />
           </div>
        </section>

        <section className="intro-strip" aria-label="Soft Heaven introduction">
          <p>For gifting, keeping, and the small rituals in between.</p>
          <span className="intro-strip__line" aria-hidden="true" />
          <p className="intro-strip__aside">Crochet, considered slowly</p>
        </section>

        <section className="collections-section page-section" id="collections" aria-labelledby="collections-title">
          <SectionHeading
            className="section-heading--wide"
            eyebrow="A SMALL WORLD OF HANDMADE"
            title="Find your little something."
            description="Pieces for celebrations, soft corners, and people who make ordinary days feel like something more."
            headingId="collections-title"
          />

          <div className="collection-grid">
            {catalogueCollections.map((collection) => <CollectionTile collection={collection} key={collection.slug} />)}
          </div>
        </section>

        <section className="featured-section page-section" id="featured" aria-labelledby="featured-title">
          <SectionHeading
             eyebrow="THE SOFT HEAVEN CATALOGUE"
             title="Made for the moments worth keeping."
              description={`Seven handmade designs, with colours to make them yours. ${ILLUSTRATIVE_PRICE_NOTICE}`}
             headingId="featured-title"
          />

             <div className="catalogue-controls" aria-label="Catalogue controls">
              <div className="catalogue-control">
               <label htmlFor="type-filter">Product type</label>
               <select id="type-filter" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                 <option value="all">All types</option>
                 {[...new Set(featuredProducts.map((product) => product.type))].map((type) => <option value={type} key={type}>{type}</option>)}
               </select>
             </div>
             <div className="catalogue-control">
               <label htmlFor="occasion-filter">Occasion</label>
               <select id="occasion-filter" value={occasionFilter} onChange={(event) => setOccasionFilter(event.target.value)}>
                 <option value="all">All occasions</option>
                 <option value="birthday">Birthday</option>
                 <option value="anniversary">Anniversary</option>
                 <option value="keepsake">Keepsake</option>
               </select>
             </div>
             <div className="catalogue-control">
               <label htmlFor="colour-filter">Colour</label>
               <select id="colour-filter" value={colourFilter} onChange={(event) => setColourFilter(event.target.value)}>
                 <option value="all">All colours</option>
                 {[...new Set(featuredProducts.flatMap((product) => product.variants?.map((variant) => variant.colour) ?? []))].map((colour) => <option value={colour} key={colour}>{colour}</option>)}
               </select>
             </div>
             <div className="catalogue-control">
               <label htmlFor="price-filter">Price guide</label>
               <select id="price-filter" value={priceFilter} onChange={(event) => setPriceFilter(event.target.value as PriceFilter)}>
                 <option value="all">All price guides</option>
                 <option value="under-500">Under ₹500</option>
                 <option value="500-plus">₹500 and above</option>
               </select>
             </div>
             <div className="catalogue-control">
               <label htmlFor="collection-filter">Collection</label>
              <select id="collection-filter" value={collectionFilter} onChange={(event) => setCollectionFilter(event.target.value)}>
                <option value="all">All collections</option>
                {catalogueCollections.map((collection) => (
                  <option value={collection.slug} key={collection.slug}>{collection.name}</option>
                ))}
              </select>
            </div>
            <div className="catalogue-control">
              <label htmlFor="product-sort">Sort products</label>
              <select id="product-sort" value={productSortOrder} onChange={(event) => setProductSortOrder(event.target.value as ProductSortOrder)}>
                <option value="listed">As listed</option>
                <option value="alphabetical">Name: A–Z</option>
              </select>
            </div>
            <p className="catalogue-controls__count" role="status" aria-live="polite">
               Showing {visibleProducts.length} of {featuredProducts.length} {featuredProducts.length === 1 ? 'piece' : 'pieces'}
            </p>
          </div>

          {visibleProducts.length > 0 ? (
            <div className="product-grid">
              {visibleProducts.map((product) => <FeaturedProductCard product={product} key={product.slug} />)}
            </div>
          ) : (
            <div className="catalogue-empty" role="status">
              <Sparkles aria-hidden="true" size={18} strokeWidth={1.5} />
               <p>No pieces are currently linked to this collection.</p>
            </div>
          )}
         </section>

         <section className="gift-discovery page-section" id="gift-discovery" aria-labelledby="gift-discovery-title">
           <SectionHeading
             eyebrow="A LITTLE HELP WITH GIFTING"
             title="Find a thoughtful direction."
             description="A few ideas for birthdays, anniversaries, and little just-because gifts. Choose a piece, or ask us about a personalised request."
             headingId="gift-discovery-title"
           />
           <div className="gift-discovery__grid">
             {giftDiscoveryGroups.map((group) => {
               const products = getProductsForGiftGroup(group)
               return (
                 <article className="gift-discovery__card" key={group.slug}>
                    <span className="gift-discovery__kicker">Gift ideas</span>
                   <h3>{group.name}</h3>
                   <p>{group.description}</p>
                   <ul>
                     {products.slice(0, 3).map((product) => (
                       <li key={product.slug}>
                         <a href={`/products/${product.slug}`}>{product.name}</a>
                         <span>{getProductPriceLabel(product)}</span>
                       </li>
                     ))}
                   </ul>
                   <ButtonLink href="#featured" variant="text" icon="up-right">Browse all pieces</ButtonLink>
                 </article>
               )
             })}
           </div>
         </section>

          <section className="custom-section page-section" id="custom" aria-labelledby="custom-title">
          <div className="custom-section__visual">
            <StorefrontImage
               kind="editorial"
               photo={homepagePhotos.gifting}
               placeholder={{ variant: 'gifts', label: 'Soft Heaven pink crochet heart keychain' }}
            />
            <div className="custom-section__stamp">made for one person</div>
          </div>
          <div className="custom-section__copy">
             <p className="eyebrow">A GIFT WITH A LITTLE MORE THOUGHT</p>
             <h2 id="custom-title">Let’s find the right little thing.</h2>
             <p>Have a colour, a character, a specific piece, or a feeling in mind? Start a direct conversation with Soft Heaven and confirm the details together.</p>
             <div className="contact-action-grid" aria-label="Soft Heaven enquiry options">
               {homepageEnquiryProduct && (
                 <ContactLink className="button button--dark" channel="whatsapp" context="product" product={homepageEnquiryProduct}>
                   Ask about the featured bouquet
                 </ContactLink>
               )}
               <ContactLink className="button button--soft" channel="whatsapp" context="custom">WhatsApp a custom idea</ContactLink>
               <ContactLink className="button button--text" channel="email" context="custom">Email a custom idea</ContactLink>
               <ButtonLink href="/contact" variant="text" icon="up-right">Plan a gift enquiry</ButtonLink>
             </div>
             <div className="custom-section__contact-details">
               <span>WhatsApp opens with a prepared enquiry for you to review.</span>
               <span>{SOFT_HEAVEN_CONTACT.email}</span>
             </div>
             <span className="custom-section__note">Opening WhatsApp or email prepares a message for you. It does not send anything automatically; pricing and arrangements are confirmed directly.</span>
           </div>
         </section>

        <section className="custom-process" id="custom-process" aria-labelledby="custom-process-title">
          <div>
            <p className="eyebrow">A DIRECT ENQUIRY, FIRST</p>
            <h2 id="custom-process-title">A thoughtful process from first idea to finished gift.</h2>
          </div>
          <ol className="process-list">
            <li>
              <span>01</span>
              <div><strong>Share the idea</strong><p>Tell us what you are imagining, including colours, occasion, or inspiration.</p></div>
            </li>
            <li>
              <span>02</span>
              <div><strong>Review and quote</strong><p>The details, timing, and quotation will be confirmed before anything begins.</p></div>
            </li>
            <li>
              <span>03</span>
              <div><strong>Make it with care</strong><p>Once approved, the piece can be made slowly and prepared for its new home.</p></div>
            </li>
          </ol>
        </section>

        <section className="story-section page-section" id="story" aria-labelledby="story-title">
          <div className="story-section__art">
            <StorefrontImage
               kind="editorial"
               photo={homepagePhotos.story}
               placeholder={{ variant: 'story', label: 'Soft Heaven white crochet flower keychain' }}
            />
          </div>
          <div className="story-section__copy">
            <p className="eyebrow">THE SOFT HEAVEN PHILOSOPHY</p>
            <h2 id="story-title">Good things take the time they take.</h2>
            <p>There is something quietly special about an object made stitch by stitch. It carries the thoughtfulness of the hands behind it, and leaves room for a little more feeling in everyday life.</p>
            <p>Soft Heaven is a place for those pieces: warm, useful, personal, and made to be kept close.</p>
            <span className="story-section__signature"><Sparkles aria-hidden="true" size={14} strokeWidth={1.6} /> Made slowly, with heart.</span>
          </div>
        </section>

        <section className="closing-section" aria-labelledby="closing-title">
          <p className="eyebrow">FOR THE LITTLE OCCASIONS</p>
          <h2 id="closing-title">Give something that feels<br /><em>like it was chosen.</em></h2>
          <div className="closing-section__actions">
            <ButtonLink href="#collections">Explore collections</ButtonLink>
            <ButtonLink href="#custom" variant="text" icon="up-right">Personalised gifting</ButtonLink>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

export default App
