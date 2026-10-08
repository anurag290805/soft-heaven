import { useState } from 'react'
import { ContactLink } from './ContactLink'
import type { GiftEnquiryDetails } from '../data/contact'

export function GiftEnquiry() {
  const [occasion, setOccasion] = useState('')
  const [giftWrapping, setGiftWrapping] = useState(false)
  const [personalNote, setPersonalNote] = useState(false)
  const details: GiftEnquiryDetails = { occasion, giftWrapping, personalNote }

  return (
    <section className="gift-enquiry" aria-labelledby="gift-enquiry-title">
      <div className="gift-enquiry__intro">
        <span className="product-page__label">Plan a gift</span>
        <h2 id="gift-enquiry-title">Add the details that make it personal.</h2>
        <p>Share the occasion and the extras you are considering. Soft Heaven will confirm what can be arranged before anything is agreed.</p>
      </div>
      <form className="gift-enquiry__form" onSubmit={(event) => event.preventDefault()}>
        <div className="gift-enquiry__field">
          <label htmlFor="gift-occasion">Recipient occasion</label>
          <input
            id="gift-occasion"
            type="text"
            value={occasion}
            onChange={(event) => setOccasion(event.target.value)}
            placeholder="For example, a birthday or anniversary"
          />
        </div>
        <fieldset>
          <legend>What would you like to ask about?</legend>
          <label>
            <input type="checkbox" checked={giftWrapping} onChange={(event) => setGiftWrapping(event.target.checked)} />
            Gift wrapping
          </label>
          <label>
            <input type="checkbox" checked={personalNote} onChange={(event) => setPersonalNote(event.target.checked)} />
            A personal note
          </label>
        </fieldset>
        <div className="gift-enquiry__actions">
          <ContactLink className="button button--dark" channel="whatsapp" context="gift" giftDetails={details}>Enquire on WhatsApp</ContactLink>
          <ContactLink className="button button--text" channel="email" context="gift" giftDetails={details}>Email this enquiry</ContactLink>
        </div>
        <p className="gift-enquiry__note">These buttons open WhatsApp or email with your choices filled in. You review and send the message yourself.</p>
      </form>
    </section>
  )
}
