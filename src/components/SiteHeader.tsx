import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Heart, Menu, Search, ShoppingBag, X } from 'lucide-react'
import { BrandMark } from './BrandMark'
import type { NavigationLink } from './storefront.types'
import { getCollectionBySlug, featuredProducts, getProductPriceDisplay, isDevelopmentFixture, isPubliclyListedProduct } from '../data/catalogue'
import { useStorefront } from '../state/storefrontContext'

interface SiteHeaderProps {
  navigationLinks: readonly NavigationLink[]
  homeHref?: string
  searchHref?: string
}

export function SiteHeader({ navigationLinks, homeHref = '#top', searchHref = '#featured' }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchButtonRef = useRef<HTMLButtonElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const mobileNavRef = useRef<HTMLElement>(null)
  const hasPublicProducts = featuredProducts.some(isPubliclyListedProduct)
  const { wishlistItems, cartCount } = useStorefront()

  const normalizedSearchQuery = searchQuery.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
  const searchResults = useMemo(() => {
    if (!normalizedSearchQuery) return []

    return featuredProducts.filter((product) => {
      const collection = getCollectionBySlug(product.collectionSlug)
      const searchableText = [
        product.name,
        product.shortDescription,
        product.description,
        ...(product.variants?.map((variant) => `${variant.name} ${variant.colour}`) ?? []),
        collection?.name,
      ].filter(Boolean).join(' ').toLocaleLowerCase()

      return searchableText.includes(normalizedSearchQuery)
    })
  }, [normalizedSearchQuery])

  useEffect(() => {
    if (!menuOpen) return undefined

    const triggerElement = menuButtonRef.current
    const navigationElement = mobileNavRef.current
    const firstLink = navigationElement?.querySelector<HTMLAnchorElement>('a[href]')
    firstLink?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        return
      }

      if (event.key !== 'Tab' || !navigationElement) return
      const focusableElements = [...navigationElement.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')]
      const firstFocusable = focusableElements[0]
      const lastFocusable = focusableElements[focusableElements.length - 1]
      if (!firstFocusable || !lastFocusable) return

      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault()
        lastFocusable.focus()
      } else if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault()
        firstFocusable.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.classList.add('menu-is-open')

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.classList.remove('menu-is-open')
      triggerElement?.focus()
    }
  }, [menuOpen])

  useEffect(() => {
    if (!searchOpen) return undefined

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSearchOpen(false)
        searchButtonRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [searchOpen])

  const closeMenu = () => setMenuOpen(false)

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
      <div className="header-inner">
        <BrandMark href={homeHref} />

        <nav className="desktop-nav" aria-label="Main navigation">
          {navigationLinks.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="header-actions">
          <button
            className="icon-button"
            type="button"
            ref={searchButtonRef}
            aria-label="Search Soft Heaven"
            aria-expanded={searchOpen}
            aria-controls="search-panel"
            onClick={() => {
              setSearchOpen((isOpen) => !isOpen)
              setMenuOpen(false)
            }}
          >
            <Search aria-hidden="true" size={18} strokeWidth={1.6} />
          </button>
           <a className="icon-button header-count-link icon-button--desktop" href="/wishlist" aria-label={`Wishlist, ${wishlistItems.length} saved ${wishlistItems.length === 1 ? 'item' : 'items'}`}>
             <Heart aria-hidden="true" size={18} strokeWidth={1.6} />
             <span className="header-count" aria-hidden="true">{wishlistItems.length}</span>
          </a>
          <a className="icon-button header-count-link icon-button--desktop" href="/bag" aria-label={`Shopping bag, ${cartCount} ${cartCount === 1 ? 'item' : 'items'}`}>
            <ShoppingBag aria-hidden="true" size={18} strokeWidth={1.6} />
            <span className="header-count" aria-hidden="true">{cartCount}</span>
          </a>
           <button
             className="menu-button"
             type="button"
             ref={menuButtonRef}
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => {
              setMenuOpen((isOpen) => !isOpen)
              setSearchOpen(false)
            }}
          >
            {menuOpen ? <X aria-hidden="true" size={20} strokeWidth={1.6} /> : <Menu aria-hidden="true" size={20} strokeWidth={1.6} />}
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="search-panel" id="search-panel" role="dialog" aria-label="Search the Soft Heaven catalogue">
          <div className="search-panel__intro">
             <span className="search-panel__eyebrow">SEARCH THE CATALOGUE</span>
             <p>Find a catalogue piece by name, description, or collection.</p>
               {hasPublicProducts && <p>Current prices are shown on each catalogue piece. Delivery is calculated securely at checkout.</p>}
          </div>
          <form
            className="search-panel__form"
            role="search"
            onSubmit={(event) => {
              event.preventDefault()
              const firstResult = searchResults[0]
              if (firstResult) window.location.href = `/products/${firstResult.slug}`
            }}
          >
            <label htmlFor="catalogue-search">Search products and collections</label>
            <div className="search-panel__input-wrap">
              <Search aria-hidden="true" size={16} strokeWidth={1.6} />
              <input
                id="catalogue-search"
                type="search"
                value={searchQuery}
                autoFocus
                placeholder="Try “bouquet” or “flowers”"
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              {searchQuery && (
                <button className="search-panel__clear" type="button" onClick={() => setSearchQuery('')}>
                  Clear
                </button>
              )}
            </div>
          </form>

          <div className="search-panel__results" aria-live="polite">
            {!normalizedSearchQuery ? (
               <p className="search-panel__message">Search is limited to the {featuredProducts.length} catalogue {featuredProducts.length === 1 ? 'piece' : 'pieces'} currently shown.</p>
            ) : searchResults.length > 0 ? (
              <>
                 <p className="search-panel__result-count">{searchResults.length} catalogue {searchResults.length === 1 ? 'result' : 'results'}</p>
                <ul>
                  {searchResults.map((product) => {
                    const collection = getCollectionBySlug(product.collectionSlug)
                     const resultLabel = isDevelopmentFixture(product) ? 'Development fixture' : 'Catalogue item'

                    return (
                      <li key={product.slug}>
                        <a href={`/products/${product.slug}`} onClick={() => setSearchOpen(false)}>
                           <span className="search-result__meta">{resultLabel} · {collection?.name ?? 'Soft Heaven catalogue'}</span>
                           <strong>{product.name}</strong>
                           {(() => {
                             const price = getProductPriceDisplay(product)
                             return <span className="search-result__price">{price.qualifier && <small>{price.qualifier}</small>}<strong>{price.amount}</strong></span>
                           })()}
                           <span>{product.shortDescription}</span>
                        </a>
                      </li>
                    )
                  })}
                </ul>
              </>
            ) : (
              <div className="search-panel__no-results">
                 <p>No catalogue pieces match “{searchQuery.trim()}”.</p>
                 <span>Try a product name, description, or collection such as “bouquets” or “keychains”.</span>
              </div>
            )}
          </div>

             <a className="search-panel__browse" href={searchHref} onClick={() => setSearchOpen(false)}>
             Browse all catalogue pieces <ArrowUpRight aria-hidden="true" size={15} strokeWidth={1.6} />
          </a>
        </div>
      )}

      {menuOpen && (
         <nav ref={mobileNavRef} className="mobile-nav" id="mobile-navigation" aria-label="Mobile navigation">
          <div className="mobile-nav__links">
            {navigationLinks.map((link) => (
              <a key={link.href} href={link.href} onClick={closeMenu}>
                <span>{link.label}</span>
                <ArrowUpRight aria-hidden="true" size={17} strokeWidth={1.5} />
              </a>
            ))}
          </div>
          <div className="mobile-nav__utilities">
            <a href="/wishlist" onClick={closeMenu}>
               <Heart aria-hidden="true" size={17} strokeWidth={1.6} /> Wishlist <span>{wishlistItems.length}</span>
            </a>
            <a href="/bag" onClick={closeMenu}>
              <ShoppingBag aria-hidden="true" size={17} strokeWidth={1.6} /> Bag <span>{cartCount}</span>
            </a>
          </div>
        </nav>
      )}
      </header>
    </>
  )
}
