-- Prices are in paise. Customer clients may never write catalogue, orders,
-- payment references, shipping rules, or webhook events.
create function public.valid_delivery_address(value jsonb) returns boolean
language sql immutable set search_path = public as $$
  select coalesce(
    jsonb_typeof(value) = 'object'
    and not exists (
      select 1 from unnest(array['fullName', 'phone', 'addressLine1', 'addressLine2', 'city', 'state', 'postalCode', 'country']) field
      where jsonb_typeof(value->field) is distinct from 'string'
    )
    and value->>'country' = 'IN'
    and value->>'postalCode' ~ '^[1-9][0-9]{5}$'
    and value->>'phone' ~ '^([+]91)?[6-9][0-9]{9}$'
    and length(trim(value->>'fullName')) between 2 and 100
    and length(trim(value->>'addressLine1')) between 5 and 200
    and length(value->>'addressLine2') <= 200
    and length(trim(value->>'city')) between 2 and 100
    and length(trim(value->>'state')) between 2 and 100,
    false
  );
$$;
revoke all on function public.valid_delivery_address(jsonb) from public, anon;
grant execute on function public.valid_delivery_address(jsonb) to authenticated, service_role;

create table public.catalogue_variants (
  slug text not null,
  variant_id text not null default '',
  name text not null,
  colour text,
  photo text not null,
  unit_price integer not null check (unit_price > 0),
  orderable boolean not null default false,
  primary key (slug, variant_id)
);

create table public.shipping_rules (
  id uuid primary key default gen_random_uuid(),
  pin_prefix text not null unique check (pin_prefix ~ '^[1-9][0-9]{0,5}$'),
  amount integer not null check (amount >= 0),
  delivery_note text not null check (length(trim(delivery_note)) > 0),
  enabled boolean not null default false
);

-- No shipping rule is seeded: the owner must confirm the destination, charge,
-- and delivery/production estimate before taking payments.
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  address jsonb not null check (public.valid_delivery_address(address)),
  created_at timestamptz not null default now()
);

create table public.wishlist_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  variant_id text not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id, slug, variant_id),
  foreign key (slug, variant_id) references public.catalogue_variants(slug, variant_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  request_id uuid not null,
  request_fingerprint jsonb not null,
  delivery_address jsonb not null,
  subtotal integer not null check (subtotal > 0),
  shipping integer not null check (shipping >= 0),
  total integer not null check (total = subtotal + shipping),
  currency text not null default 'INR' check (currency = 'INR'),
  delivery_note text not null,
  status text not null default 'pending-payment' check (status in ('pending-payment', 'processing', 'shipped', 'delivered', 'cancelled')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'refunded')),
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  payment_setup_started_at timestamptz,
  tracking_reference text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (user_id, request_id)
);

create index orders_user_created on public.orders(user_id, created_at desc);
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  slug text not null,
  variant_id text not null,
  name text not null,
  colour text,
  photo text not null,
  unit_price integer not null check (unit_price > 0),
  quantity integer not null check (quantity between 1 and 99),
  line_total integer not null check (line_total = unit_price * quantity)
);

create table public.payment_events (
  event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);

alter table public.catalogue_variants enable row level security;
alter table public.shipping_rules enable row level security;
alter table public.addresses enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_events enable row level security;

create policy catalogue_read on public.catalogue_variants for select to anon, authenticated using (true);
create policy addresses_own on public.addresses for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy wishlist_own on public.wishlist_items for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy orders_read_own on public.orders for select to authenticated using (user_id = (select auth.uid()));
create policy order_items_read_own on public.order_items for select to authenticated using (exists (select 1 from public.orders where orders.id = order_items.order_id and orders.user_id = (select auth.uid())));

revoke all on public.catalogue_variants, public.shipping_rules, public.addresses, public.wishlist_items, public.orders, public.order_items, public.payment_events from anon, authenticated;
grant select on public.catalogue_variants to anon, authenticated;
grant select, insert, update, delete on public.addresses, public.wishlist_items to authenticated;
grant select on public.orders, public.order_items to authenticated;
grant all on public.catalogue_variants, public.shipping_rules, public.addresses, public.wishlist_items, public.orders, public.order_items, public.payment_events to service_role;

create function public.checkout_quote(p_items jsonb, p_address jsonb) returns jsonb
language plpgsql set search_path = public as $$
declare
  item jsonb;
  product public.catalogue_variants;
  rule public.shipping_rules;
  quantity integer;
  subtotal integer := 0;
  lines jsonb := '[]'::jsonb;
  seen text[] := array[]::text[];
  item_key text;
begin
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Choose between 1 and 50 product variants.';
  end if;
  if jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'Choose between 1 and 50 product variants.';
  end if;
  if not public.valid_delivery_address(p_address) then
    raise exception 'Enter a complete Indian address, valid mobile number, and six-digit PIN code.';
  end if;

  for item in select value from jsonb_array_elements(p_items) loop
    if coalesce(item->>'quantity', '') !~ '^[0-9]{1,2}$' then raise exception 'Invalid quantity.'; end if;
    quantity := (item->>'quantity')::integer;
    if quantity not between 1 and 99 then raise exception 'Quantity must be between 1 and 99.'; end if;
    item_key := coalesce(item->>'slug', '') || '::' || coalesce(item->>'variantId', '');
    if item_key = any(seen) then raise exception 'Duplicate product variants are not allowed.'; end if;
    seen := array_append(seen, item_key);
    select * into product from public.catalogue_variants
      where slug = item->>'slug' and variant_id = coalesce(item->>'variantId', '') and orderable;
    if not found then raise exception 'A selected product or colour is no longer available for checkout.'; end if;
    subtotal := subtotal + product.unit_price * quantity;
    lines := lines || jsonb_build_array(jsonb_build_object(
      'slug', product.slug, 'variantId', product.variant_id, 'name', product.name,
      'colour', product.colour, 'photo', product.photo, 'unitPrice', product.unit_price,
      'quantity', quantity, 'lineTotal', product.unit_price * quantity
    ));
  end loop;
  select * into rule from public.shipping_rules
    where enabled and left(p_address->>'postalCode', length(pin_prefix)) = pin_prefix
    order by length(pin_prefix) desc limit 1;
  if not found then raise exception 'Delivery is not configured for this PIN code. Contact Soft Heaven before ordering.'; end if;
  return jsonb_build_object('items', lines, 'subtotal', subtotal, 'shipping', rule.amount,
    'total', subtotal + rule.amount, 'currency', 'INR', 'deliveryNote', rule.delivery_note);
end;
$$;

create function public.prepare_order(p_user uuid, p_request uuid, p_items jsonb, p_address jsonb, p_expected_total integer) returns uuid
language plpgsql set search_path = public as $$
declare
  existing public.orders;
  quote jsonb;
  order_id uuid;
  item jsonb;
  fingerprint jsonb := jsonb_build_object('items', p_items, 'address', p_address);
begin
  -- Lock concurrent retries before reading/inserting the idempotency key.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || p_request::text, 0));
  select * into existing from public.orders where user_id = p_user and request_id = p_request;
  if found then
    if existing.request_fingerprint <> fingerprint then raise exception 'This checkout reference belongs to a different selection.'; end if;
    if existing.total is distinct from p_expected_total then raise exception 'This checkout has an existing order with a different total. Review that order in your account.'; end if;
    if existing.status = 'cancelled' or existing.payment_status = 'refunded' then raise exception 'This order cannot be paid.'; end if;
    return existing.id;
  end if;
  quote := public.checkout_quote(p_items, p_address);
  if (quote->>'total')::integer is distinct from p_expected_total then raise exception 'The order total has changed. Review delivery and pricing again.'; end if;
  insert into public.orders(user_id, request_id, request_fingerprint, delivery_address, subtotal, shipping, total, delivery_note)
    values(p_user, p_request, fingerprint, p_address, (quote->>'subtotal')::integer, (quote->>'shipping')::integer,
      (quote->>'total')::integer, quote->>'deliveryNote') returning id into order_id;
  for item in select value from jsonb_array_elements(quote->'items') loop
    insert into public.order_items(order_id, slug, variant_id, name, colour, photo, unit_price, quantity, line_total)
    values(order_id, item->>'slug', item->>'variantId', item->>'name', item->>'colour', item->>'photo',
      (item->>'unitPrice')::integer, (item->>'quantity')::integer, (item->>'lineTotal')::integer);
  end loop;
  return order_id;
end;
$$;

create function public.confirm_payment(p_provider_order text, p_payment text, p_amount integer, p_currency text, p_event_id text default null, p_event_type text default 'checkout.verified') returns uuid
language plpgsql set search_path = public as $$
declare
  purchase public.orders;
begin
  select * into purchase from public.orders where razorpay_order_id = p_provider_order for update;
  if not found then raise exception 'Unknown payment order.'; end if;
  if purchase.total <> p_amount or purchase.currency <> p_currency then raise exception 'Payment amount or currency does not match the order.'; end if;
  if purchase.razorpay_payment_id is not null and purchase.razorpay_payment_id <> p_payment then raise exception 'A different payment was already recorded.'; end if;
  if p_event_id is not null then
    insert into public.payment_events(event_id, event_type) values(p_event_id, p_event_type) on conflict do nothing;
  end if;
  if purchase.payment_status = 'pending' then
    update public.orders set payment_status = 'paid', status = 'processing', razorpay_payment_id = p_payment, paid_at = now() where id = purchase.id;
  end if;
  return purchase.id;
end;
$$;

revoke all on function public.checkout_quote(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.prepare_order(uuid, uuid, jsonb, jsonb, integer) from public, anon, authenticated;
revoke all on function public.confirm_payment(text, text, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.checkout_quote(jsonb, jsonb), public.prepare_order(uuid, uuid, jsonb, jsonb, integer), public.confirm_payment(text, text, integer, text, text, text) to service_role;

-- Approved starter catalogue, independent of browser-local catalogue drafts.
insert into public.catalogue_variants(slug, variant_id, name, colour, photo, unit_price, orderable) values
('red-blue-crochet-flower-bouquet', '', 'Red & Blue Crochet Flower Bouquet', null, '/images/products/optimized/Red+blue_Bouquet.webp', 149900, true),
('red-pink-crochet-flower-bouquet', '', 'Red & Pink Crochet Flower Bouquet', null, '/images/products/optimized/Red+Pink_Bouquet.webp', 149900, true),
('blue-mix-crochet-flower', '', 'Blue Mix Crochet Keychain', null, '/images/products/optimized/blueMix_flower.webp', 39900, true),
('crochet-sunflower-keychain', 'sunflower', 'Crochet Sunflower Keychain', 'Sunflower', '/images/products/optimized/Sunflower.webp', 34900, true),
('crochet-flower-keychain', 'baby-blue', 'Crochet Flower Keychain', 'Baby Blue', '/images/products/optimized/lightblue_flower.webp', 29900, true),
('crochet-flower-keychain', 'blush-pink', 'Crochet Flower Keychain', 'Blush Pink', '/images/products/optimized/pink_flower.webp', 29900, true),
('crochet-flower-keychain', 'lavender', 'Crochet Flower Keychain', 'Lavender', '/images/products/optimized/purple_flower.webp', 29900, true),
('crochet-flower-keychain', 'white', 'Crochet Flower Keychain', 'White', '/images/products/optimized/white_flower.webp', 29900, true),
('crochet-flower-keychain', 'butter-yellow', 'Crochet Flower Keychain', 'Butter Yellow', '/images/products/optimized/yellow_flower.webp', 29900, true),
('cute-crochet-dress-keychain', 'baby-blue', 'Cute Crochet Dress Keychain', 'Baby Blue', '/images/products/optimized/lightblue_dress.webp', 34900, true),
('cute-crochet-dress-keychain', 'blush-pink', 'Cute Crochet Dress Keychain', 'Blush Pink', '/images/products/optimized/pink_dress.webp', 34900, true),
('cute-crochet-dress-keychain', 'lavender', 'Cute Crochet Dress Keychain', 'Lavender', '/images/products/optimized/lavendar_dress.webp', 34900, true),
('cute-crochet-dress-keychain', 'sage-green', 'Cute Crochet Dress Keychain', 'Sage Green', '/images/products/optimized/green_dress.webp', 34900, true),
('cute-crochet-dress-keychain', 'red', 'Cute Crochet Dress Keychain', 'Red', '/images/products/optimized/red_dress.webp', 34900, true),
('crochet-heart-keychain', 'baby-blue', 'Crochet Heart Keychain', 'Baby Blue', '/images/products/optimized/blue_heart.webp', 29900, true),
('crochet-heart-keychain', 'blush-pink', 'Crochet Heart Keychain', 'Blush Pink', '/images/products/optimized/pink_heart.webp', 29900, true),
('crochet-heart-keychain', 'lavender', 'Crochet Heart Keychain', 'Lavender', '/images/products/optimized/purple_heart.webp', 29900, true),
('crochet-heart-keychain', 'red', 'Crochet Heart Keychain', 'Red', '/images/products/optimized/red_heart.webp', 29900, true),
('crochet-heart-keychain', 'white', 'Crochet Heart Keychain', 'White', '/images/products/optimized/white_heart.webp', 29900, true);
