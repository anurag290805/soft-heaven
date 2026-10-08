import { ArrowUpRight } from 'lucide-react'
import { BrandMark } from './BrandMark'
import { ContactLink } from './ContactLink'

interface SiteFooterProps {
  homePrefix?: string
}

export function SiteFooter({ homePrefix = '' }: SiteFooterProps) {
  const homeLink = homePrefix || '#top'

  return (
    <footer className="site-footer" id="footer-note">
      <div className="footer-top">
        <div className="footer-brand">
          <BrandMark footer href={homeLink} />
          <p>Handcrafted crochet for thoughtful gifting and softer everyday moments.</p>
          </div>
          <div className="footer-links">
            <div>
              <span className="footer-label">Explore</span>
              <a href={`${homePrefix}#collections`}>Shop</a>
              <a href={`${homePrefix}#story`}>Our story</a>
              <a href={`${homePrefix}#custom`}>Custom gifting</a>
              <a href="/contact">Contact</a>
            </div>
            <div>
              <span className="footer-label">Information</span>
              <a href="/how-to-order">How to order</a>
              <a href="/payment-information">Payment information</a>
              <a href="/shipping-delivery">Shipping & delivery</a>
              <a href="/returns-cancellations">Returns & cancellations</a>
              <a href="/privacy-policy">Privacy policy</a>
              <a href="/terms-conditions">Terms & conditions</a>
            </div>
            <div>
              <span className="footer-label">Your selection</span>
              <a href="/wishlist">Wishlist</a>
              <a href="/bag">Shopping bag</a>
              <a href="/account">Account</a>
              <a href="/orders">Orders</a>
              <ContactLink channel="whatsapp" context="general" icon={false}>WhatsApp enquiry</ContactLink>
              <ContactLink channel="email" context="general" icon={false}>Email Soft Heaven</ContactLink>
            </div>
          </div>
      </div>
      <div className="footer-bottom">
        <span>© Soft Heaven</span>
         <span>Product photographs supplied by Soft Heaven. Delivery and payment are handled securely at checkout.</span>
        <a href={homeLink}>Back to top <ArrowUpRight aria-hidden="true" size={14} strokeWidth={1.6} /></a>
      </div>
    </footer>
  )
}
