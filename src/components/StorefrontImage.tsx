import { useState } from 'react'
import type { CSSProperties } from 'react'
import { ImageOff } from 'lucide-react'
import type { ArtworkProps } from './Artwork'
import './StorefrontImage.css'

export type ImageKind = 'hero' | 'collection' | 'product' | 'editorial'

// Use imported local assets, their actual pixel dimensions, and truthful alt text.
export interface StorefrontPhoto {
  src: string
  alt: string // Empty for a purely decorative photograph.
  width: number
  height: number
  fit?: 'cover' | 'contain'
  objectPosition?: CSSProperties['objectPosition']
  optimizedSrc?: string
  angle?: 'front' | 'three-quarter' | 'side' | 'back' | 'detail' | 'product'
  sourceAsset?: string
  // Supply only when these exported variants actually exist.
  responsive?: {
    srcSet: string
    sizes: string
  }
}

interface StorefrontImageProps {
  kind: ImageKind
  photo?: StorefrontPhoto
  placeholder: ArtworkProps
  sizes?: string
}

function Photograph({
  photo,
  kind,
  placeholder,
  sizes,
}: StorefrontImageProps & { photo: StorefrontPhoto }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="storefront-image__fallback" role="img" aria-label={`${placeholder.label} unavailable`}>
        <ImageOff aria-hidden="true" size={24} strokeWidth={1.4} />
        <strong>Photograph unavailable</strong>
        <span>{placeholder.label}</span>
      </div>
    )
  }

  return (
    <picture className="storefront-image__picture">
      {photo.optimizedSrc && <source srcSet={photo.responsive?.srcSet ?? photo.optimizedSrc} sizes={sizes ?? (kind === 'hero' || kind === 'collection' || kind === 'editorial' ? '(max-width: 760px) 90vw, 46vw' : photo.responsive?.sizes)} type="image/webp" />}
      <img
        className="storefront-image__photo"
        src={photo.src}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        loading={kind === 'hero' ? 'eager' : 'lazy'}
        fetchPriority={kind === 'hero' ? 'high' : undefined}
        decoding="async"
        style={{
          objectFit: photo.fit ?? (kind === 'product' ? 'contain' : 'cover'),
          objectPosition: photo.objectPosition ?? 'center',
        }}
        onError={() => setFailed(true)}
      />
    </picture>
  )
}

export function StorefrontImage({ kind, photo, placeholder, sizes }: StorefrontImageProps) {
  return (
    <div className={`storefront-image storefront-image--${kind}`}>
      {photo?.src.trim() ? (
        // A new source gets a fresh error state; a failed asset gets an honest fallback.
        <Photograph key={photo.src} photo={photo} kind={kind} placeholder={placeholder} sizes={sizes} />
      ) : (
        <div className="storefront-image__fallback" role="img" aria-label={`${placeholder.label} unavailable`}>
          <ImageOff aria-hidden="true" size={24} strokeWidth={1.4} />
          <strong>Photograph unavailable</strong>
          <span>{placeholder.label}</span>
        </div>
      )}
    </div>
  )
}
