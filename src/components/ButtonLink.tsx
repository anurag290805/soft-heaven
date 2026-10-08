import { ArrowRight, ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'

type ButtonLinkVariant = 'dark' | 'text'
type ButtonLinkIcon = 'right' | 'up-right'

interface ButtonLinkProps {
  href: string
  children: ReactNode
  variant?: ButtonLinkVariant
  icon?: ButtonLinkIcon
}

export function ButtonLink({ href, children, variant = 'dark', icon = 'right' }: ButtonLinkProps) {
  const Icon = icon === 'up-right' ? ArrowUpRight : ArrowRight

  return (
    <a className={`button button--${variant}`} href={href}>
      {children}
      <Icon aria-hidden="true" size={16} strokeWidth={1.7} />
    </a>
  )
}
