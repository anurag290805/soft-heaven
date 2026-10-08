import { MapPin, Package, Truck } from 'lucide-react'
import { cataloguePhotos } from '../data/catalogue'
import { OWNER_REVIEW_NOTE } from '../data/contact'
import { ButtonLink } from './ButtonLink'
import { ContactLink } from './ContactLink'
import { StorefrontImage } from './StorefrontImage'
import { StorefrontPage } from './StorefrontPage'

export function ShippingDeliveryPage() {
  return (
    <StorefrontPage title="Shipping & delivery" eyebrow="FROM OUR HANDS TO YOURS" introduction="A little clarity for the journey: your address, delivery charge, and order updates.">
      <div className="shipping-editorial">
        <figure className="shipping-editorial__visual"><StorefrontImage kind="editorial" photo={cataloguePhotos.redPinkBouquet} placeholder={{ variant: 'bouquet', label: 'Red and pink crochet bouquet' }} /><figcaption>A piece chosen with care, with delivery details reviewed before payment.</figcaption></figure>
        <div className="information-content shipping-editorial__content">
          <p className="information-draft-note">{OWNER_REVIEW_NOTE}</p>
          <section><MapPin aria-hidden="true" size={22} strokeWidth={1.5} /><h2>Start with your PIN code.</h2><p>Enter a complete Indian address at checkout. Delivery is available only where Soft Heaven has configured a serviceable destination, charge, and delivery note.</p><p>If your PIN code has no confirmed delivery rule, checkout will pause before payment. Contact us to discuss the destination.</p></section>
          <section><Truck aria-hidden="true" size={22} strokeWidth={1.5} /><h2>Review the journey first.</h2><p>The order review shows the delivery charge alongside the server-confirmed product prices. No free-shipping threshold or delivery date is assumed.</p><p>For made-to-order or personalised requests, production timing is agreed separately before you decide. A saved piece or bag entry does not reserve a delivery date.</p></section>
          <section><Package aria-hidden="true" size={22} strokeWidth={1.5} /><h2>Keep the details close.</h2><p>After payment verification, your account holds the order reference and fulfilment status. A tracking reference appears there once one has been provided.</p><p>For an address correction or a delivery question, contact Soft Heaven with your order reference. Changes depend on the progress of the order.</p></section>
          <div className="commerce-actions"><ContactLink channel="whatsapp" className="button button--dark">Ask about delivery</ContactLink><ButtonLink href="/bag" variant="text" icon="up-right">Back to your bag</ButtonLink></div>
        </div>
      </div>
    </StorefrontPage>
  )
}
