import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const alice = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
const bob = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'
const requestId = 'cccccccc-cccc-4ccc-cccc-cccccccccccc'
const address = { fullName: 'Test Customer', phone: '+919876543210', addressLine1: '10 Test Street', addressLine2: '', city: 'Delhi', state: 'Delhi', postalCode: '110001', country: 'IN' }
const lines = [{ slug: 'crochet-flower-keychain', variantId: 'baby-blue', quantity: 2, unitPrice: 1 }]

async function database() {
  const db = new PGlite()
  // The test database supplies Supabase's auth schema/roles. All policies and
  // commerce functions below are the actual production migration.
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant select on auth.users to service_role;
    insert into auth.users values ('${alice}'), ('${bob}');
  `)
  const directory = new URL('../supabase/migrations/', import.meta.url)
  for (const migration of (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(migration, directory), 'utf8'))
  return db
}

async function service(db) { await db.exec('reset role; set role service_role;') }
async function customer(db, id) { await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub = '${id}';`) }
async function enableShipping(db) {
  await service(db)
  await db.query("insert into shipping_rules(pin_prefix, amount, delivery_note, enabled) values ('110001', 8000, 'Test-only delivery estimate', true)")
}
async function prepare(db, overrides = {}) {
  const { rows } = await db.query('select prepare_order($1, $2, $3::jsonb, $4::jsonb, $5) as id', [alice, overrides.requestId ?? requestId, JSON.stringify(overrides.lines ?? lines), JSON.stringify(overrides.address ?? address), overrides.total ?? 67800])
  return rows[0].id
}

test('shipping is fail-closed and server prices ignore client values', async () => {
  const db = await database()
  try {
    await service(db)
    await assert.rejects(db.query('select checkout_quote($1::jsonb, $2::jsonb)', [JSON.stringify(lines), JSON.stringify(address)]), /Delivery is not configured/)
    await enableShipping(db)
    const { rows } = await db.query('select checkout_quote($1::jsonb, $2::jsonb) as quote', [JSON.stringify(lines), JSON.stringify(address)])
    assert.equal(rows[0].quote.subtotal, 59800)
    assert.equal(rows[0].quote.shipping, 8000)
    assert.equal(rows[0].quote.total, 67800)
    assert.equal(rows[0].quote.items[0].unitPrice, 29900)
    await assert.rejects(prepare(db, { total: 2 }), /total has changed/)
    assert.equal((await db.query('select count(*)::int as count from orders')).rows[0].count, 0)
  } finally { await db.close() }
})

test('address, variant, duplicate, and quantity validation reject bad orders', async () => {
  const db = await database()
  try {
    await enableShipping(db)
    for (const phone of ['1234567890', '999', '+449876543210']) await assert.rejects(prepare(db, { address: { ...address, phone } }), /valid mobile/)
    await assert.rejects(prepare(db, { address: { ...address, postalCode: '000001' } }), /six-digit PIN/)
    await assert.rejects(prepare(db, { lines: [{ ...lines[0], variantId: 'not-real' }] }), /no longer available/)
    await assert.rejects(prepare(db, { lines: [lines[0], lines[0]] }), /Duplicate/)
    for (const quantity of [0, 100, -1, 1.2, '2.0']) await assert.rejects(prepare(db, { lines: [{ ...lines[0], quantity }] }), /[Qq]uantity/)
    for (const invalid of [null, {}, [], 'bad']) await assert.rejects(db.query('select checkout_quote($1::jsonb, $2::jsonb)', [JSON.stringify(invalid), JSON.stringify(address)]), /Choose between/)
  } finally { await db.close() }
})

test('idempotent retries keep one immutable purchase snapshot', async () => {
  const db = await database()
  try {
    await enableShipping(db)
    const id = await prepare(db)
    assert.equal(await prepare(db), id)
    await assert.rejects(prepare(db, { address: { ...address, fullName: 'Different customer' } }), /different selection/)
    await db.query("update catalogue_variants set unit_price = 99900, name = 'New name' where slug = 'crochet-flower-keychain' and variant_id = 'baby-blue'")
    assert.equal(await prepare(db), id)
    const snapshot = (await db.query('select * from order_items where order_id = $1', [id])).rows[0]
    assert.equal(snapshot.unit_price, 29900)
    assert.equal(snapshot.name, 'Crochet Flower Keychain')
    assert.equal((await db.query('select count(*)::int as count from orders')).rows[0].count, 1)
    assert.equal((await db.query('select count(*)::int as count from order_items')).rows[0].count, 1)
  } finally { await db.close() }
})

test('RLS isolates customer addresses, wishlist, orders and order items', async () => {
  const db = await database()
  try {
    await enableShipping(db)
    const order = await prepare(db)
    await customer(db, alice)
    await db.query('insert into addresses(user_id, address) values ($1, $2::jsonb)', [alice, JSON.stringify(address)])
    await assert.rejects(db.query('insert into addresses(user_id, address) values ($1, $2::jsonb)', [alice, JSON.stringify({ ...address, fullName: 22 })]), /check constraint/)
    await db.query("insert into wishlist_items(user_id, slug, variant_id) values ($1, 'crochet-flower-keychain', 'baby-blue')", [alice])
    assert.equal((await db.query('select id, order_number, total, payment_status from orders')).rows.length, 1)
    for (const column of ['razorpay_order_id', 'razorpay_payment_id', 'request_fingerprint', 'payment_setup_started_at']) await assert.rejects(db.query(`select ${column} from orders`), /permission denied/)
    await assert.rejects(db.query("update orders set payment_status = 'paid' where id = $1", [order]), /permission denied/)
    await assert.rejects(db.query('insert into addresses(user_id, address) values ($1, $2::jsonb)', [bob, JSON.stringify(address)]), /row-level security/)
    await assert.rejects(prepare(db), /permission denied/)
    await customer(db, bob)
    for (const table of ['addresses', 'wishlist_items', 'orders', 'order_items']) assert.equal((await db.query(`select ${table === 'orders' ? 'id, order_number, total' : '*'} from ${table}`)).rows.length, 0, table)
    await db.query("update addresses set address = $1::jsonb where user_id = $2", [JSON.stringify({ ...address, fullName: 'Attacker' }), alice])
    await db.query('delete from wishlist_items where user_id = $1', [alice])
    await assert.rejects(db.query("insert into wishlist_items(user_id, slug, variant_id) values ($1, 'crochet-flower-keychain', 'white')", [alice]), /row-level security/)
    for (const table of ['catalogue_variants', 'shipping_rules', 'payment_events', 'order_items']) await assert.rejects(db.query(`delete from ${table}`), /permission denied/)
    await service(db)
    assert.equal((await db.query('select address from addresses where user_id = $1', [alice])).rows[0].address.fullName, address.fullName)
    assert.equal((await db.query('select * from wishlist_items where user_id = $1', [alice])).rows.length, 1)
    await customer(db, alice)
    await db.query('update addresses set address = $1::jsonb where user_id = $2', [JSON.stringify({ ...address, addressLine1: '20 Edited Street' }), alice])
    assert.equal((await db.query('select address from addresses')).rows[0].address.addressLine1, '20 Edited Street')
    await assert.rejects(db.query('select assert_order_payable($1, $2)', [alice, order]), /permission denied/)
    await db.exec('reset role; set role anon;')
    await assert.rejects(db.query('select * from orders'), /permission denied/)
    assert.equal((await db.query('select * from catalogue_variants')).rows.length, 19)
  } finally { await db.close() }
})

test('all approved prices and every colour reach immutable server snapshots', async () => {
  const db = await database()
  try {
    await enableShipping(db)
    const prices = { 'red-blue-crochet-flower-bouquet': 149900, 'red-pink-crochet-flower-bouquet': 149900, 'blue-mix-crochet-flower': 39900, 'crochet-sunflower-keychain': 34900, 'crochet-flower-keychain': 29900, 'cute-crochet-dress-keychain': 34900, 'crochet-heart-keychain': 29900 }
    const variants = (await db.query('select * from catalogue_variants order by slug, variant_id')).rows
    assert.equal(variants.length, 19)
    const selection = variants.map((variant) => ({ slug: variant.slug, variantId: variant.variant_id, quantity: 1, unitPrice: 100, shipping: 0 }))
    const quote = (await db.query('select checkout_quote($1::jsonb, $2::jsonb) as quote', [JSON.stringify(selection), JSON.stringify(address)])).rows[0].quote
    assert.equal(quote.subtotal, 848100)
    assert.equal(quote.total, 856100)
    for (const item of quote.items) { assert.equal(item.unitPrice, prices[item.slug]); assert.equal(item.lineTotal, prices[item.slug]); assert.match(item.photo, /^\/images\/products\/optimized\/.+\.webp$/) }
    const id = await prepare(db, { lines: selection, total: quote.total })
    const snapshots = (await db.query('select * from order_items where order_id = $1', [id])).rows
    assert.equal(snapshots.length, 19)
    const pink = snapshots.find((item) => item.slug === 'crochet-flower-keychain' && item.variant_id === 'blush-pink')
    assert.equal(pink.colour, 'Blush Pink'); assert.match(pink.photo, /pink_flower.webp$/)
    await db.query("update catalogue_variants set name = 'Changed', photo = '/changed.webp', colour = 'Changed', unit_price = 1")
    assert.deepEqual((await db.query('select * from order_items where order_id = $1', [id])).rows, snapshots)
    assert.equal((await db.query('select order_number from orders where id = $1', [id])).rows[0].order_number, 10001)
  } finally { await db.close() }
})

test('unpaid retries recheck catalogue and longest-prefix shipping eligibility', async () => {
  const db = await database()
  try {
    await enableShipping(db)
    await db.query("insert into shipping_rules(pin_prefix, amount, delivery_note, enabled) values ('110', 3000, 'Broad test rule', true)")
    const id = await prepare(db)
    const payable = () => db.query('select assert_order_payable($1, $2)', [alice, id])
    await payable()
    await assert.rejects(db.query('select assert_order_payable($1, $2)', [bob, id]), /not found in your account/)
    await db.query("update catalogue_variants set orderable = false where slug = 'crochet-flower-keychain'")
    await assert.rejects(payable(), /no longer available/)
    await db.query("update catalogue_variants set orderable = true, unit_price = 30000 where slug = 'crochet-flower-keychain'")
    await assert.rejects(payable(), /Pricing or delivery has changed/)
    await db.query("update catalogue_variants set unit_price = 29900 where slug = 'crochet-flower-keychain'")
    await db.query("update shipping_rules set enabled = false where pin_prefix = '110001'")
    await assert.rejects(payable(), /Pricing or delivery has changed/)
    await db.query('update shipping_rules set enabled = false')
    await assert.rejects(payable(), /Delivery is not configured/)
    await db.query("update orders set status = 'cancelled' where id = $1", [id])
    await assert.rejects(payable(), /cannot be paid/)
  } finally { await db.close() }
})

test('webhook events cannot cross orders and late capture preserves cancellation', async () => {
  const db = await database()
  try {
    await enableShipping(db)
    const first = await prepare(db)
    const second = await prepare(db, { requestId: 'dddddddd-dddd-4ddd-dddd-dddddddddddd' })
    await db.query("update orders set razorpay_order_id = case when id = $1 then 'order_one' else 'order_two' end", [first])
    await db.query("select confirm_payment('order_one', 'pay_one', 67800, 'INR', 'evt_shared', 'payment.captured')")
    const paidAt = (await db.query('select paid_at from orders where id = $1', [first])).rows[0].paid_at
    await db.query("select confirm_payment('order_one', 'pay_one', 67800, 'INR', 'evt_shared', 'payment.captured')")
    assert.equal((await db.query('select paid_at from orders where id = $1', [first])).rows[0].paid_at.getTime(), paidAt.getTime())
    await assert.rejects(db.query("select confirm_payment('order_two', 'pay_two', 67800, 'INR', 'evt_shared', 'payment.captured')"), /different payment/)
    assert.equal((await db.query('select payment_status from orders where id = $1', [second])).rows[0].payment_status, 'pending')
    await db.query("update orders set status = 'cancelled' where id = $1", [second])
    await db.query("select confirm_payment('order_two', 'pay_two', 67800, 'INR', 'evt_late', 'payment.captured')")
    assert.deepEqual((await db.query('select status, payment_status from orders where id = $1', [second])).rows[0], { status: 'cancelled', payment_status: 'paid' })
    await db.query("update orders set payment_status = 'refunded' where id = $1", [second])
    await assert.rejects(db.query("select confirm_payment('order_two', 'pay_two', 67800, 'INR', 'evt_refunded', 'payment.captured')"), /already been refunded/)
  } finally { await db.close() }
})

test('captured payment transitions are idempotent and reject mismatched references', async () => {
  const db = await database()
  try {
    await enableShipping(db)
    const id = await prepare(db)
    await db.query("update orders set razorpay_order_id = 'order_test' where id = $1", [id])
    const confirm = (payment, amount = 67800, event = 'event_test') => db.query("select confirm_payment('order_test', $1, $2, 'INR', $3, 'payment.captured') as id", [payment, amount, event])
    await assert.rejects(confirm('pay_test', 1), /amount or currency/)
    assert.equal((await confirm('pay_test')).rows[0].id, id)
    await confirm('pay_test')
    await assert.rejects(confirm('pay_other'), /different payment/)
    assert.equal((await db.query('select payment_status, status from orders where id = $1', [id])).rows[0].payment_status, 'paid')
    assert.equal((await db.query('select count(*)::int as count from payment_events')).rows[0].count, 1)
    await customer(db, alice)
    await assert.rejects(confirm('pay_test'), /permission denied/)
  } finally { await db.close() }
})
