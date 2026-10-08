interface SectionHeadingProps {
  eyebrow: string
  title: string
  description?: string
  headingId: string
  className?: string
}

export function SectionHeading({ eyebrow, title, description, headingId, className = '' }: SectionHeadingProps) {
  return (
    <div className={`section-heading${className ? ` ${className}` : ''}`}>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={headingId}>{title}</h2>
      </div>
      {description && <p className="section-heading__body">{description}</p>}
    </div>
  )
}
