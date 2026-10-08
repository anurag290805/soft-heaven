interface BrandMarkProps {
  footer?: boolean
  href?: string
}

export function BrandMark({ footer = false, href = '#top' }: BrandMarkProps) {
  return (
    <a className={`brand-mark${footer ? ' brand-mark--footer' : ''}`} href={href} aria-label="Soft Heaven home">
      {footer ? (
        <img
          className="brand-mark__image"
          src="/images/brand/soft-heaven-logo-transparent.png"
          alt="Soft Heaven — crocheted with love"
          width="1254"
          height="1244"
        />
      ) : (
        <span className="brand-mark__wordmark"><strong>Soft Heaven</strong><small>crocheted with love</small></span>
      )}
    </a>
  )
}
