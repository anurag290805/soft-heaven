import { ArrowUpRight } from 'lucide-react'
import { StorefrontImage } from './StorefrontImage'
import type { CollectionRecord } from './storefront.types'

interface CollectionTileProps {
  collection: CollectionRecord
}

export function CollectionTile({ collection }: CollectionTileProps) {
  return (
    <a className={`collection-card collection-card--${collection.variant}`} id={collection.slug} href={`/collections/${collection.slug}`}>
      <StorefrontImage
        kind="collection"
        photo={collection.photo}
         placeholder={{ variant: collection.variant, label: `${collection.name} product photograph` }}
      />
      <div className="collection-card__content">
         <h3>{collection.name}</h3>
        <p>{collection.description}</p>
        <span className="collection-card__link">
          Explore <ArrowUpRight aria-hidden="true" size={15} strokeWidth={1.6} />
        </span>
      </div>
    </a>
  )
}
