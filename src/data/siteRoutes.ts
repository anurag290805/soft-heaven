import type { NavigationLink } from '../components/storefront.types'

export const informationPagePaths = ['/contact', '/how-to-order', '/payment-information', '/shipping-delivery', '/returns-cancellations', '/privacy-policy', '/terms-conditions', '/terms-and-conditions'] as const
export type InformationPagePath = typeof informationPagePaths[number]

export const storefrontNavigationLinks: readonly NavigationLink[] = [
  { label: 'Shop', href: '/#featured' },
  { label: 'Flowers', href: '/collections/flowers-bouquets' },
  { label: 'Keychains', href: '/collections/keychains-keepsakes' },
  { label: 'Contact', href: '/contact' },
]
