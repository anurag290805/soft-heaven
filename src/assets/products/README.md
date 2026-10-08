# Product photographs

Place photographs of actual confirmed crochet products here when supplied. Use
names describing the real product and view (for example, a front or detail view),
not development fixture names. The current supplied photographs are served from
`public/images/products/` so they can be reused by the Vite storefront without
being bundled as application modules.

Featured cards use 4:5 portrait frames. The default `contain` fit keeps the whole
product visible without cropping; use `cover` only when the supplied composition
allows it. The original PNGs remain available as source files while the
`public/images/products/optimized/` WebP derivatives are used for normal delivery.
Import the supplied file in `src/data/catalogue.ts` and set the
product's optional `photo` field with accurate alt text and actual export
dimensions. Consult `../README.md` for the full contract.

Before changing a product record to `publicationStatus: 'published'`, confirm
that the owner has supplied the real photograph, approved product name and slug,
collection, description, and any price, options, personalization, or
specifications that are being shown. Keep `photo` unset for a development
fixture; a draft may reference approved photography while remaining hidden.
A genuine image does not by itself make a product orderable.
