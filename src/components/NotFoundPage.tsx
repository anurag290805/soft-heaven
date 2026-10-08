import { useEffect } from 'react'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'
import { NotFoundPageContent } from './NotFoundPageContent'
import { storefrontNavigationLinks } from '../data/siteRoutes'
import './CollectionPage.css'

export function NotFoundPage() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Page not found | Soft Heaven'
    return () => { document.title = previousTitle }
  }, [])

  return (
    <div className="site-shell collection-page-shell" id="top">
       <SiteHeader navigationLinks={storefrontNavigationLinks} homeHref="/" searchHref="/#featured" />
      <NotFoundPageContent />
      <SiteFooter homePrefix="/" />
    </div>
  )
}
