import { useEffect, type ReactNode } from 'react'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import { storefrontNavigationLinks } from '../data/siteRoutes'
import './StorefrontPages.css'

interface StorefrontPageProps {
  title: string
  eyebrow: string
  introduction?: string
  children: ReactNode
}

export function StorefrontPage({ title, eyebrow, introduction, children }: StorefrontPageProps) {
  useEffect(() => {
    const previousTitle = document.title
    document.title = `${title} | Soft Heaven`
    return () => { document.title = previousTitle }
  }, [title])

  return (
    <div className="site-shell" id="top">
       <SiteHeader navigationLinks={storefrontNavigationLinks} homeHref="/" searchHref="/#featured" />
       <main className="storefront-page page-section" id="main-content">
        <header className="storefront-page__heading">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {introduction && <p className="storefront-page__introduction">{introduction}</p>}
        </header>
        {children}
      </main>
      <SiteFooter homePrefix="/" />
    </div>
  )
}
