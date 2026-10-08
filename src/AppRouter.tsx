import { useSyncExternalStore } from 'react'
import App from './App'
import { CollectionPage } from './components/CollectionPage'
import { NotFoundPage } from './components/NotFoundPage'
import { ProductDetailPage } from './components/ProductDetailPage'
import { WishlistPage } from './components/WishlistPage'
import { BagPage } from './components/BagPage'
import { InformationPage } from './components/InformationPage'
import { AdminCataloguePage } from './components/AdminCataloguePage'
import { AccountPage } from './components/AccountPage'
import { AuthPage } from './components/AuthPage'
import { CheckoutPage } from './components/CheckoutPage'
import { OrderConfirmationPage } from './components/OrderConfirmationPage'
import { OrdersPage } from './components/OrdersPage'
import { ShippingDeliveryPage } from './components/ShippingDeliveryPage'
import { informationPagePaths, type InformationPagePath } from './data/siteRoutes'

function getPathname() {
  return window.location.pathname.replace(/\/+$/, '') || '/'
}

function subscribeToHistory(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  return () => window.removeEventListener('popstate', onChange)
}

function usePathname() {
  return useSyncExternalStore(subscribeToHistory, getPathname, () => '/')
}

function getCollectionSlug(pathname: string): string | undefined {
  const match = pathname.match(/^\/collections\/([^/]+)$/)
  try {
    return match ? decodeURIComponent(match[1]) : undefined
  } catch {
    return undefined
  }
}

function getProductSlug(pathname: string): string | undefined {
  const match = pathname.match(/^\/products\/([^/]+)$/)
  try {
    return match ? decodeURIComponent(match[1]) : undefined
  } catch {
    return undefined
  }
}

export default function AppRouter() {
  const pathname = usePathname()
  const collectionSlug = getCollectionSlug(pathname)
  const productSlug = getProductSlug(pathname)

  if (pathname === '/') return <App />
  if (pathname === '/shop') return <App />
  if (pathname === '/wishlist') return <WishlistPage />
  if (pathname === '/bag') return <BagPage />
  if (pathname === '/checkout') return <CheckoutPage />
  if (pathname === '/account') return <AccountPage />
  if (pathname === '/login') return <AuthPage mode="login" />
  if (pathname === '/forgot-password') return <AuthPage mode="forgot" />
  if (pathname === '/reset-password') return <AuthPage mode="reset" />
  if (pathname === '/register') return <AuthPage mode="register" />
  if (pathname === '/orders') return <OrdersPage />
  const orderMatch = pathname.match(/^\/orders\/([a-f0-9-]{36})$/i)
  if (orderMatch) return <OrderConfirmationPage key={orderMatch[1]} id={orderMatch[1]} confirmation={false} />
  if (pathname === '/order-confirmation') return <OrderConfirmationPage />
  if (pathname === '/shipping-delivery') return <ShippingDeliveryPage />
  if (pathname === '/admin/catalogue' && import.meta.env.DEV) return <AdminCataloguePage />
  if (informationPagePaths.includes(pathname as InformationPagePath)) return <InformationPage path={pathname as InformationPagePath} />
  if (collectionSlug) return <CollectionPage slug={collectionSlug} />
  if (productSlug) return <ProductDetailPage slug={productSlug} />

  return <NotFoundPage />
}
