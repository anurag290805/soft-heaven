# Local storefront imagery

Only add genuine supplied Soft Heaven photography. The current seven product
photographs are stored in `public/images/products/` and the supplied logo is in
`public/images/brand/`.

## Organisation

- `public/images/brand/`: supplied brand identity assets.
- `public/images/products/`: photographs of individual confirmed products and
  the generated `optimized/` WebP delivery derivatives.

Each folder contains short placement guidance rather than fake image files. Keep
the existing starter graphics at this level until a separate cleanup is needed;
`hero.png`, `react.svg`, and `vite.svg` are not Soft Heaven imagery. The current
`public/favicon.svg` is also a starter graphic, not an approved brand asset.

Use lowercase kebab-case filenames describing the real subject and view. Reference
only files that exist in the public asset folders. Do not construct strings
pointing at missing files or copy the same photo into multiple product records.
Remove camera location metadata before publishing supplied photos, and export
web-sized files while retaining the original masters elsewhere.

## Connecting an approved product photo

`StorefrontImage` accepts an optional `StorefrontPhoto` with a public `src`,
truthful `alt`, and the original exported file's `width` and `height` in pixels.
Use `alt: ''` for a purely decorative photo. Use `fit: 'contain'` for an uncropped
product view or `fit: 'cover'` for an editorial crop, adjusting `objectPosition`
only when needed to keep the subject visible.

1. Add the supplied, approved export to `public/images/products/` using a lowercase
   kebab-case name such as `lilac-flower-bouquet-front.webp` or
   `lilac-flower-bouquet-detail.webp`. Keep original camera files and masters
   outside the repository.
2. Reference that exact file in `src/data/catalogue.ts` and set the product's
   optional `photo` field with its real dimensions and truthful alt text. Do not
   point records at guessed paths or reuse a photo for a different product.
3. Keep placeholder artwork by leaving `photo` unset until the image is genuine.
   `StorefrontImage` renders a labelled photograph-unavailable state when an
   image is absent or fails to load; it never substitutes decorative sample art.
4. Test the crop and alt text at desktop and mobile widths. Add `responsive`
   exports only when matching resized files actually exist.
5. Once the product record has owner-approved catalogue information, move its
   `publicationStatus` from `draft` to `published`. A published product may stay
   enquiry-only when price and ordering details have not been confirmed.

Homepage slots remain in `App.tsx` through `homepagePhotos` for hero, gifting,
and story placements. Collection and product photo fields are owned by the
central catalogue in `src/data/catalogue.ts`.

The frame reserves space before loading. Hero photos load eagerly with high fetch
priority; other photographs load lazily. All photographs use async decoding.
Absent or failed images render an honest labelled fallback in the same frame so
the layout remains stable without presenting a broken image or fake product art.

Only add `responsive: { srcSet, sizes }` when real resized exports exist. Import
each variant and use its actual width in `srcSet`, with `sizes` matching the layout.
Do not add guessed URLs or fake resolution variants. Check the crop and alt text
at mobile and desktop sizes once actual photos have been supplied. Temporary
Artwork is intentionally kept separate from this workflow and must not be
renamed or presented as a genuine product photograph.
