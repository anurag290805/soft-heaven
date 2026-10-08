# Preparing the Soft Heaven catalogue

`catalogue.ts` is the single source for collection and product-family records.
It contains seven families, the 19 approved product photographs, structured
colour variants, and centralized INR prices. The current seven families use
the approved starter prices and are bag-eligible; delivery and payment
arrangements remain direct-enquiry details.

`CATALOGUE_PRICING_MODE` is set to `'owner-confirmed'` for the current starter
catalogue. `priceStatus`, availability, and orderability remain explicit
per-product/per-variant fields so future owner edits can safely return a record
to enquiry-only without changing frontend components.

## Publication and availability

`ProductRecord` in `../components/storefront.types.ts` is a discriminated union.
Publication and orderability are separate explicit fields; neither has a
permissive default.

| `publicationStatus` | Meaning | Permitted availability | Storefront display |
| --- | --- | --- | --- |
| `development-fixture` | A presentation example | `development-only`; no `price` allowed | Existing labelled sample preview and sample detail routes only |
| `draft` | A genuine product being prepared | `not-orderable` | Hidden from homepage, search, collections, and direct product routes |
| `published` | A genuine product approved for public display | An explicit non-development availability | Visible only when publication checks pass |

Published availability is independent of visibility:

- `not-orderable`: display is approved, but ordering is not available.
- `ready-to-ship`: the owner has confirmed that the item is prepared for dispatch.
- `available`: the owner has confirmed that it is available to order.
- `made-to-order`: the owner has confirmed that it is made after an order.
- `custom-request`: a reviewed request and quote are needed instead of a fixed
  order. This is separate from optional personalization on a product.
- `temporarily-unavailable`: keep a genuine published item visible without
  claiming it is currently orderable. Do not invent a return date.

These fields describe verified product information. A product needs a confirmed
INR price and an orderable availability before the bag action can appear. This
site still has no checkout, payment collection, account, or automatic order
submission workflow.

## Adding a genuine product

1. Create a new record in `catalogueProducts` with a stable, unique `id`, an
   owner-approved `name`, lowercase kebab-case `slug`, descriptive `type`, and
   `shortDescription`. Use `publicationStatus: 'draft'` and
   `availability: 'not-orderable'` explicitly. Do not turn a `sample-*` fixture
   into a real product or reuse its identity.
2. Set `collectionSlug` to an existing collection and add the product's slug to
   that collection's `productSlugs`. Both ends of the relationship must agree.
3. Follow `../assets/README.md` to import owner-supplied photography into `photo`.
   A product photograph requires nonempty descriptive alt text and actual export
   dimensions. `Artwork` is a labelled temporary fallback, not a photograph or
   proof that the product exists.
4. For a family with colour choices, add a `variants[]` entry for every genuine
   colour. Each variant needs a stable `id`, customer-facing `name` and
   `colour`, actual image `photo` dimensions/alt text, and explicit
   `availability`/`orderability` when ordering is approved. Never create a
   variant from a colour label without its genuine photograph.
5. Add only the optional information that the owner has verified:
   - `description`: a longer plain-text description; line breaks are supported.
    - `price`: `{ amount, currency: 'INR' }`, in rupees (decimal paise are retained).
      Use `priceStatus: 'illustrative'` for temporary examples or
      `priceStatus: 'owner-confirmed'` only after approval. No sale price or
      guessed discount.
   - `options`: named option groups with the actual allowed `values`, such as
     owner-confirmed colour or size choices. They display as information, not an
     order form; there are no guessed option prices or stock counts.
   - `personalization`: `mode: 'available'` or `mode: 'custom-request'`, with an
     optional owner-confirmed `note`. Omission means no personalization claim.
   - `specifications`: independently optional `materials` (a list), `dimensions`
     (include units), `careInstructions`, and `productionEstimate` (include units
     and any actual conditions). A production estimate is not a delivery promise.
6. Run `getProductPublicationIssues(record)` while preparing the record. It
   checks identity, nonempty name/short description, slug format, collection
   linkage, photo source/alt/dimensions, explicit availability, and supplied INR
   price validity. Optional price and specifications do not need invented values
   to pass. These checks cannot verify the image's provenance, file contents, or
   the truth of commercial information; the owner must confirm those.
7. Only after that confirmation, change the record to
   `publicationStatus: 'published'` and explicitly choose its verified
   availability. A published record must have a `photo` at the type level and
   pass the runtime checks. Invalid published records remain hidden from all
   storefront discovery and direct product lookup.
8. Run build/lint checks and browser QA on the image, detail route, search,
   collection association, filtering, and sorting before shipping the change.

## Transitions and queries

- A fixture stays a fixture. Changing its photo or descriptive text never
  publishes it; its type prevents adding a price or orderable availability.
- A genuine `draft` becomes `published` only by an explicit edit after the above
  checks. Published products can return to `draft` to remove them from display;
  reset their availability to `not-orderable` at the same time.
- Published products can switch between verified availability states without
  changing publication. Use `temporarily-unavailable` for a visible item that
  cannot currently be ordered, rather than hiding it or inventing stock data.
- `getPublicProducts()` excludes fixtures, drafts, and invalid published records.
- `featuredProducts` is the storefront display list: it includes valid published
  products and any intentionally labelled fixtures when present. The current
  catalogue has no fixtures. It excludes drafts; do not treat enquiry-only items
  as purchasable inventory.
- `getProductBySlug()` and `getProductsForCollection()` use that same display list
  so a hidden product cannot leak through a detail URL or collection link.

Do not add fabricated products to test publication, and do not label starter
graphics or synthetic images as product photography. The current catalogue
retains illustrative amounts for owner planning but does not present them as
final storefront prices; missing or unapproved commercial information must
never be presented as final.
