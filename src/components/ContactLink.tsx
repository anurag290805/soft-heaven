import { Mail, MessageCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ProductRecord } from './storefront.types'
import { getContactHref, isContactConfigured, type ContactContext, type GiftEnquiryDetails } from '../data/contact'

interface ContactLinkProps {
  channel: 'whatsapp' | 'email'
  context?: ContactContext
  product?: ProductRecord
  variantId?: string
  cartSummary?: string
  giftDetails?: GiftEnquiryDetails
  children: ReactNode
  className?: string
  icon?: boolean
}


export function ContactLink({ channel, context = 'general', product, variantId, cartSummary, giftDetails, children, className = '', icon = true }: ContactLinkProps) {
  const configured = isContactConfigured(channel)
  const href = configured ? getContactHref(channel, context, product, cartSummary, giftDetails, variantId) : undefined
  const Icon = channel === 'whatsapp' ? MessageCircle : Mail

  if (!configured) {
    return (
      <span className={`${className} contact-link--unconfigured`.trim()} role="status" aria-label={`${channel} contact is not configured`}>
        {icon && <Icon aria-hidden="true" size={16} strokeWidth={1.7} />}
        <span>{children}</span>
        <small>Owner configuration required</small>
      </span>
    )
  }

  return (
    <a className={className} href={href} target={channel === 'whatsapp' ? '_blank' : undefined} rel={channel === 'whatsapp' ? 'noreferrer' : undefined}>
      {icon && <Icon aria-hidden="true" size={16} strokeWidth={1.7} />}
      {children}
    </a>
  )
}
