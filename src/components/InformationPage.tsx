import { ContactLink } from './ContactLink'
import { GiftEnquiry } from './GiftEnquiry'
import { StorefrontPage } from './StorefrontPage'
import { OWNER_REVIEW_NOTE, SOFT_HEAVEN_CONTACT } from '../data/contact'
import type { InformationPagePath } from '../data/siteRoutes'

const titles: Record<InformationPagePath, string> = {
  '/contact': 'Contact Soft Heaven',
  '/how-to-order': 'How to order',
  '/payment-information': 'Payment information',
  '/shipping-delivery': 'Shipping & delivery',
  '/returns-cancellations': 'Returns & cancellations',
  '/privacy-policy': 'Privacy policy',
   '/terms-conditions': 'Terms & conditions',
   '/terms-and-conditions': 'Terms & conditions',
}

export function InformationPage({ path }: { path: InformationPagePath }) {
  return (
       <StorefrontPage title={titles[path]} eyebrow={path === '/contact' ? 'LET’S TALK CROCHET' : 'CLEAR BEFORE YOU COMMIT'}>
       <div className="information-content">
         {path !== '/contact' && <p className="information-draft-note">{OWNER_REVIEW_NOTE}</p>}
         {path === '/contact' && (
          <>
            <section>
              <h2>A thoughtful conversation starts here.</h2>
              <p>Enquire about ready-made crochet products, made-to-order pieces, customisation, or pricing. Soft Heaven will confirm the details directly before an order is accepted.</p>
               <div className="contact-details">
                  <ContactLink channel="whatsapp" className="contact-detail"><span>WhatsApp</span><strong>Open an enquiry</strong></ContactLink>
                  <ContactLink channel="email" className="contact-detail"><span>Email</span><strong>{SOFT_HEAVEN_CONTACT.email}</strong></ContactLink>
               </div>
              <p>These links open WhatsApp or your email application. They do not send a message or submit an order automatically.</p>
            </section>
            <section>
              <h2>Something made for you.</h2>
              <p>For made-to-order or personalised pieces, share your idea and the details that matter to you. Specifications, pricing, production estimates where applicable, and delivery arrangements are confirmed before you decide.</p>
               <ContactLink channel="whatsapp" context="custom" className="button button--dark">Discuss a custom request</ContactLink>
             </section>
             <GiftEnquiry />
           </>
        )}
        {path === '/how-to-order' && (
          <>
            <section>
              <h2>From selection to a confirmed order.</h2>
              <p>Choose your pieces, review your bag, and continue to secure checkout when you are ready. Made-to-order and personalised requests still begin with a direct conversation so the details can be agreed carefully.</p>
              <ol className="information-steps">
                 <li><strong>Review your selection.</strong><p>Keep your chosen pieces in the shopping bag, check the selected colour and quantity, and continue to checkout.</p></li>
                 <li><strong>Add delivery details.</strong><p>Sign in securely and provide the address and phone number needed for delivery serviceability and fulfilment.</p></li>
                 <li><strong>Review and pay securely.</strong><p>The final total, delivery charge, and payment state are shown by the secure store service before an order is confirmed.</p></li>
              </ol>
            </section>
            <section>
               <h2>About saved selections.</h2>
               <p>A wishlist save does not reserve stock. An item is only ordered once checkout and payment are completed through the secure store service.</p>
            </section>
          </>
        )}
         {path === '/payment-information' && (
          <>
            <section>
              <h2>Payment, presented securely.</h2>
               <p>At checkout, the secure store service creates a payment request with the configured payment provider. Soft Heaven does not ask you to share card details, UPI credentials, or banking passwords in WhatsApp or email.</p>
               <p>Your order is only marked paid after the payment provider response is verified by the server. A browser redirect alone is never treated as proof of payment.</p>
            </section>
            <section>
              <h2>Before making a payment.</h2>
               <p>Before paying, check the product details, final INR total, delivery address, delivery charge, and applicable cancellation or return terms shown for your order.</p>
            </section>
          </>
        )}
        {path === '/shipping-delivery' && (
          <>
            <section>
              <h2>Delivery details, made clear before payment.</h2>
              <p>Enter your complete Indian delivery address at checkout. The secure store service uses the PIN code to determine whether delivery can be arranged and what charge applies.</p>
              <p>The checkout summary will show the applicable shipping charge and delivery estimate before payment. If serviceability or timing cannot be confirmed, the order will not be presented as ready to pay.</p>
            </section>
            <section>
              <h2>What happens after checkout.</h2>
              <p>Once payment is verified, your account shows the order reference and current fulfilment status. Tracking details appear when they are available from the delivery service.</p>
              <p>Made-to-order or personalised pieces may require a production estimate before delivery. That estimate is shown or confirmed before you pay.</p>
            </section>
          </>
        )}
        {path === '/returns-cancellations' && (
          <>
            <section>
              <h2>Agree on the terms before ordering.</h2>
              <p>Applicable return, exchange, refund, and cancellation terms must be confirmed directly before you commit to an order. This is particularly important for made-to-order and personalised products, where work may be specific to your request.</p>
              <p>This page does not promise a blanket return window, refund, exchange, or cancellation right. It is guidance for the enquiry process, not a substitute for a final, owner-approved policy or the terms confirmed for your order.</p>
            </section>
            <section>
              <h2>If you need to change a request.</h2>
              <p>Contact Soft Heaven to discuss the request and any work already agreed. The available options and applicable terms must be confirmed directly; this website cannot cancel or modify an order.</p>
            </section>
          </>
        )}
         {path === '/privacy-policy' && (
          <>
            <section>
              <h2>What this website stores.</h2>
               <p>Your shopping bag and a local copy of your wishlist are stored in your browser. When Supabase is connected and you sign in, wishlist product references sync to your account. You can remove saved pieces or clear your bag through the website.</p>
               <p>Supabase Auth manages registration, sign-in, and password recovery. Session tokens are stored in the browser to keep you signed in; passwords are never saved by this storefront. An opaque checkout retry reference may be kept in sessionStorage, without the delivery address or payment credentials.</p>
               <p>If you choose to save a delivery address, it is stored in your account. Orders retain the delivery details and purchase-time selection needed for fulfilment. Customers can access their own records through row-level access controls.</p>
            </section>
            <section>
              <h2>Search and contact enquiries.</h2>
              <p>Catalogue search runs against the product data loaded in this website. Search text is held in the current page’s memory and is not saved by this site or sent to a search service.</p>
               <p>Checkout collects your recipient name, mobile number, and delivery address for your order. Razorpay handles payment details in its payment window. Soft Heaven stores order and payment references and verified payment status, rather than card or UPI credentials.</p>
               <p>WhatsApp and email links open external services with a prefilled enquiry. You decide what to send; those services handle the message under their own terms and privacy practices.</p>
            </section>
            <section>
              <h2>External resources.</h2>
              <p>The website loads its fonts from Google Fonts. Your browser contacts that external service when loading them. Product artwork and application assets are served with the website. No analytics or tracking service has been added to this implementation.</p>
              <p>For questions about information you provide in a direct enquiry, contact Soft Heaven using the details below.</p>
            </section>
          </>
         )}
          {(path === '/terms-conditions' || path === '/terms-and-conditions') && (
           <>
             <section>
               <h2>Using this website.</h2>
                <p>Soft Heaven’s website lets you browse products, save a wishlist, manage your bag, and complete checkout when account, delivery, and payment services are available. Custom requests can be discussed through WhatsApp or email.</p>
               <p>Product photographs, names, descriptions, prices, availability, and ordering terms should be reviewed with Soft Heaven before you commit to a purchase.</p>
             </section>
             <section>
               <h2>Orders and product information.</h2>
                <p>Online checkout presents the server-confirmed selection, delivery charge, and total before payment. An order is marked paid only after the payment provider status is verified. Custom requests require separately agreed details and terms.</p>
               <p>Nothing in a wishlist save, bag entry, enquiry, or catalogue page reserves a product or guarantees availability.</p>
             </section>
             <section>
               <h2>Questions about these terms.</h2>
               <p>For the terms that apply to a particular request, please contact Soft Heaven before making a payment or confirming an order.</p>
               <ContactLink channel="whatsapp" className="button button--dark">Ask about the terms</ContactLink>
             </section>
           </>
         )}
        {path !== '/contact' && (
          <div className="information-contact">
            <p>Have a question about these details?</p>
            <ContactLink channel="whatsapp" className="button button--dark">Ask Soft Heaven on WhatsApp</ContactLink>
            <ContactLink channel="email" className="button button--text">Email Soft Heaven</ContactLink>
          </div>
        )}
      </div>
    </StorefrontPage>
  )
}
