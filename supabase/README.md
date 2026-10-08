# Supabase commerce setup

The storefront uses Supabase Auth, Postgres/RLS, and the `commerce` Edge Function
for server-calculated checkout and Razorpay verification. This code is ready to
deploy; creating or connecting a live Supabase/Razorpay account requires the
owner's project configuration.

## 1. Create and configure the project

Create a Supabase project. Copy its URL and **public anon/publishable key** into
the root `.env.local`, using `.env.example` as the template. The SDK supports
the legacy anon key and the public publishable key. Keep the service-role key
and Razorpay secret keys in Edge Function secrets only.

In Supabase Authentication:

- Enable Email with email confirmation. Configure production SMTP for email
  confirmations and recovery messages.
- Set the Site URL to the storefront's HTTPS origin.
- Allow redirect URLs for `/account`, `/checkout`, `/orders`, `/wishlist`, and
  `/reset-password` on that origin; add local equivalents while developing.
- For Google, configure the provider's client ID/secret and the Supabase
  callback URL in Google Cloud. Then set `VITE_GOOGLE_SIGN_IN_ENABLED=true`.

Supabase manages passwords and verified sessions. The browser persists session
tokens using the SDK; passwords are never persisted by the storefront. Customer
data is protected by RLS, rather than trusting a browser route guard.

## 2. Apply schema and deploy

From the project root, with the Supabase CLI installed (or through `npx`):

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npx supabase secrets set --env-file supabase/.env.local
npx supabase functions deploy commerce
```

Create `supabase/.env.local` from `supabase/.env.example`. Populate the Razorpay
test credentials, webhook secret, and exact comma-separated allowed origins.
The `config.toml` intentionally sets `verify_jwt=false` on this function so
Razorpay can call it. Customer actions still validate the bearer token through
`auth.getUser()` before using any server privileges.

The migration seeds the 19 approved variants and seven starter product prices.
Browser-local catalogue studio changes are drafts: they **never** alter the
server catalogue or the amount collected. Publish any approved changes to
`catalogue_variants` with server/database administration, keeping the public
catalogue in sync.

## 3. Configure actual shipping

There are deliberately no seeded shipping fees or delivery estimates. Insert
owner-approved rules into `shipping_rules` through the Supabase SQL editor or a
server administration process. Each rule needs:

- `pin_prefix`: a 1–6 digit PIN prefix, beginning with a nonzero digit;
- `amount`: the approved delivery charge **in paise** (zero only if approved);
- `delivery_note`: confirmed timing/arrangements, including production time
  when applicable;
- `enabled=true`: activates the rule.

The longest matching prefix wins. No matching enabled rule means **no
checkout/payment** for that PIN code. The customer sees the server-calculated
total and delivery note before opening Razorpay. Payment creation recalculates
the quote and rejects changed totals. Do not enable prefixes that have not been
confirmed serviceable.

## 4. Connect Razorpay

Use a test-mode Razorpay key ID/secret first. Configure automatic capture in
Razorpay: authorized payments remain pending until captured.

Webhook URL:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/commerce
```

Subscribe to `payment.captured` and `order.paid`, using the same webhook secret
as the Edge Function. The function verifies HMAC over the **raw request body**,
checks the order/amount/currency, and records the captured payment atomically.
The browser callback also verifies its signature and fetches payment status
directly from Razorpay. Both paths are idempotent; a repeated event cannot
change a paid order to another payment or charge a different amount.

Set `VITE_RAZORPAY_ENABLED=true` only after test-mode setup is working. The key
ID for checkout comes from the Edge Function; there is no browser secret key.
The UI flag is not a server security control: the function also requires all
provider secrets and a configured shipping rule.

## 5. Operational states

- A pending order is created with immutable purchase-time line/address/price
  snapshots. RLS permits customers to read their own orders/items only.
- Concurrent retries use a database lock and `(user_id, request_id)` uniqueness.
  The browser retains an opaque retry key in sessionStorage, keyed by a hash;
  it does not store the address there.
- One request claims provider-order creation. If Razorpay times out or saving
  its reference fails, creation stays locked to avoid creating duplicate
  provider orders. Reconcile Razorpay orders by their `receipt` (Soft Heaven's
  order UUID), then set the matching `razorpay_order_id` in the database. Clear
  `payment_setup_started_at` **only after** confirming no provider order exists.
- Cancelled/failed payment windows do not mark an order paid or clear the bag.
  Customers can resume the same pending order from its details page.
- Fulfilment/tracking updates are server/admin managed. This project does not
  invent courier tracking, stock counts, cancellation rules, or refund policy.
  Refund execution and its bookkeeping require an owner-approved operations
  process; no automatic refund/cancellation action is exposed to customers.

## Verification

```bash
npm run test:commerce
npx deno test --allow-env --config supabase/functions/commerce/deno.json supabase/functions/commerce/
npx deno check --config supabase/functions/commerce/deno.json supabase/functions/commerce/index.ts
npm run lint
npm run build
npm run qa:browser
npm run qa:commerce
```

The database tests execute the production SQL in a local PostgreSQL-compatible
PGlite instance, with Supabase auth-role fixtures. They cover RLS, authoritative
prices, unconfigured shipping, rejected variants/quantities/addresses, immutable
snapshots, idempotent orders, and payment transition constraints.

After deploying, test real email confirmation/recovery, Google redirect, saved
addresses, account wishlist sync, invalid shipping, Razorpay success/failure/
cancellation, duplicate webhook delivery, and foreign-user order access in
Razorpay **test mode**. Local tests cannot verify credentials or live provider
configuration that has not been supplied.

`qa:commerce` runs a separate Vite instance with test-only browser service
fixtures. It exercises provider errors, address validation, review-before-pay,
payment failure/cancellation, failed verification, reload-safe retries, verified
confirmation, address management, wishlist sync, and recovery/account gates.
These fixtures are outside the production application and do not prove live
provider connectivity.
