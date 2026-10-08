-- Additive launch hardening: preserve existing orders and initial migrations.
alter table public.orders add column order_number bigint generated always as identity (start with 10001);
create unique index orders_number_unique on public.orders(order_number);
create index addresses_user_created on public.addresses(user_id, created_at desc);
create index order_items_order on public.order_items(order_id);

-- Customer APIs expose fulfilment/payment state, not internal provider/setup
-- references or the private idempotency fingerprint.
revoke select on public.orders from authenticated;
grant select (id, user_id, order_number, delivery_address, subtotal, shipping, total,
  currency, delivery_note, status, payment_status, tracking_reference, created_at, paid_at)
  on public.orders to authenticated;

alter table public.payment_events add column order_id uuid references public.orders(id);
alter table public.payment_events add column payment_id text;

create or replace function public.confirm_payment(p_provider_order text, p_payment text, p_amount integer, p_currency text, p_event_id text default null, p_event_type text default 'checkout.verified') returns uuid
language plpgsql set search_path = public as $$
declare
  purchase public.orders;
  previous_event public.payment_events;
begin
  select * into purchase from public.orders where razorpay_order_id = p_provider_order for update;
  if not found then raise exception 'Unknown payment order.'; end if;
  if purchase.total <> p_amount or purchase.currency <> p_currency then raise exception 'Payment amount or currency does not match the order.'; end if;
  if purchase.razorpay_payment_id is not null and purchase.razorpay_payment_id <> p_payment then raise exception 'A different payment was already recorded.'; end if;
  if purchase.payment_status = 'refunded' then raise exception 'This payment has already been refunded.'; end if;
  if p_event_id is not null then
    insert into public.payment_events(event_id, event_type, order_id, payment_id)
      values(p_event_id, p_event_type, purchase.id, p_payment) on conflict do nothing;
    select * into previous_event from public.payment_events where event_id = p_event_id;
    if previous_event.order_id is not null and (previous_event.order_id <> purchase.id or previous_event.payment_id <> p_payment or previous_event.event_type <> p_event_type) then
      raise exception 'Webhook event reference belongs to a different payment.';
    end if;
    -- Bind legacy ledger entries when replayed during an upgrade.
    update public.payment_events set order_id = purchase.id, payment_id = p_payment where event_id = p_event_id and order_id is null;
  end if;
  if purchase.payment_status = 'pending' then
    update public.orders set payment_status = 'paid',
      status = case when status = 'cancelled' then status else 'processing' end,
      razorpay_payment_id = p_payment, paid_at = now() where id = purchase.id;
  end if;
  return purchase.id;
end;
$$;

create function public.assert_order_payable(p_user uuid, p_order uuid) returns void
language plpgsql set search_path = public as $$
declare
  purchase public.orders;
  quote jsonb;
begin
  select * into purchase from public.orders where id = p_order and user_id = p_user;
  if not found then raise exception 'This order was not found in your account.'; end if;
  if purchase.status = 'cancelled' or purchase.payment_status = 'refunded' then raise exception 'This order cannot be paid.'; end if;
  if purchase.payment_status = 'paid' then return; end if;
  quote := public.checkout_quote(purchase.request_fingerprint->'items', purchase.delivery_address);
  if (quote->>'total')::integer <> purchase.total or (quote->>'shipping')::integer <> purchase.shipping
    or exists (
      select 1 from jsonb_array_elements(quote->'items') item
      left join public.order_items snapshot on snapshot.order_id = purchase.id and snapshot.slug = item->>'slug' and snapshot.variant_id = item->>'variantId'
      where snapshot.id is null or snapshot.unit_price <> (item->>'unitPrice')::integer or snapshot.quantity <> (item->>'quantity')::integer
    ) then
    raise exception 'Pricing or delivery has changed. Review your selection with Soft Heaven before paying this order.';
  end if;
end;
$$;
revoke all on function public.assert_order_payable(uuid, uuid) from public, anon, authenticated;
grant execute on function public.assert_order_payable(uuid, uuid) to service_role;
