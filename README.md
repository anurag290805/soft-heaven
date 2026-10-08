# Soft Heaven

Soft Heaven is a React + TypeScript + Vite storefront for a handcrafted crochet
gift catalogue. It is designed around warm editorial presentation, genuine
product photography, Supabase-backed accounts, and verified Razorpay checkout.

## Run locally

```bash
npm install
npm run dev
```

The development server runs at `http://127.0.0.1:5173/` by default.

## Verification commands

```bash
npm run lint
npm run build
npm run preview
npm run qa:browser
npm run test:commerce
npm run qa:commerce
```

Commerce implementation is in `supabase/`: Auth, saved addresses/wishlists,
server-calculated orders, immutable purchase snapshots, RLS, and Razorpay
signature/webhook verification. Follow [Supabase setup](supabase/README.md) to
deploy it and configure the root `.env.local`. Account and payment actions stay
disabled until configured. No shipping rules or delivery promises are seeded.

The bag persists in the current browser. Signed-in customers can synchronize
wishlists and save addresses to Supabase. The seven catalogue families use the
approved starter INR prices; the server catalogue independently verifies prices
and variants before payment.

## Catalogue and assets

- `src/data/catalogue.ts` is the single source for seven published product
  families and two collections. Family colour choices live in `variants[]` and
  each published variant points to a genuine supplied photograph.
- The 19 approved source photographs are retained unchanged in
  `public/images/products/`.
- Optimized WebP delivery derivatives are in
  `public/images/products/optimized/` and are generated with
  `scripts/prepare-assets.py`.
- The supplied logo remains untouched at
  `public/images/brand/soft-heaven-logo.png`.
- The transparent website logo derivative is
  `public/images/brand/soft-heaven-logo-transparent.png`.
- `public/soft-heaven-favicon.png` is derived from the same supplied artwork.

To regenerate non-destructive image derivatives:

```bash
python3 scripts/prepare-assets.py
```

The script requires Pillow. It removes only the white canvas outside the
supplied circular logo artwork and does not redraw, recolour, or overwrite the
source logo.

The owner catalogue studio is available at `/admin/catalogue`. It supports
family editing, draft/published state, price approval, availability and
orderability, genuine image uploads for new colour variants, and local draft
persistence. It is a browser-local management adapter until a production
publishing process is connected. Its edits do not change the server catalogue
or payment amounts; approved changes must be published to the database too.

## Content and commercial rules

The storefront deliberately does not invent stock, materials,
dimensions, delivery promises, reviews, legal identity, or policy terms. The
catalogue pricing is centralized in the product data model. Product enquiry
messages include the product name, selected colour, and absolute product-page URL.

Owner review is still required for shipping fees and timelines, returns and
cancellations, legal/business details, and final policy approval. The
information pages keep visible starter-policy notes until those decisions are
confirmed.
