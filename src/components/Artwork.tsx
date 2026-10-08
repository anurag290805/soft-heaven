// Temporary decorative art only; none of these variants depict live inventory.
export type ArtworkVariant =
  | 'hero'
  | 'flowers'
  | 'plushies'
  | 'bags'
  | 'gifts'
  | 'bouquet'
  | 'plush'
  | 'bag'
  | 'keychain'
  | 'story'

export interface ArtworkProps {
  variant: ArtworkVariant
  label: string
}

export function Artwork({ variant, label }: ArtworkProps) {
  return (
    <div
      className={`artwork artwork--${variant}`}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    >
      <span className="artwork__grain" aria-hidden="true" />
      <span className="artwork__halo" aria-hidden="true" />
      <span className="artwork__orbit artwork__orbit--one" aria-hidden="true" />
      <span className="artwork__orbit artwork__orbit--two" aria-hidden="true" />
      <span className="artwork__stitch artwork__stitch--one" aria-hidden="true" />
      <span className="artwork__stitch artwork__stitch--two" aria-hidden="true" />
      <span className="artwork__stitch artwork__stitch--three" aria-hidden="true" />
      <span className="artwork__card" aria-hidden="true">
        <span className="artwork__card-kicker">soft heaven / 01</span>
        <span className="artwork__card-title">made slowly</span>
        <span className="artwork__card-line">illustrative artwork</span>
      </span>
      <span className="artwork__label">temporary art direction</span>
    </div>
  )
}
