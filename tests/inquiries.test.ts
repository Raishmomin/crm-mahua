import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { Client } from 'pg';
import { connect, applyMigrations, actAs, resetRole, expectDbError } from './helpers/db';
import { safeInternalPath, whereFromPhone } from '@/components/buyers/helpers';
import { canWriteBuyers } from '@/types/buyers';
import { createBuyerAction, updateBuyerAction } from '@/app/(dashboard)/buyers/actions';
import { createInquiryAction } from '@/app/(dashboard)/inquiries/actions';

// Server-action tests (last describe): no Supabase stack, so the session and the client are faked
// and every table call is recorded. The database describe above does not use these modules.
const fake = vi.hoisted(() => ({
  profile: null as null | { id: string; org_id: string; role: string; modules: string[]; is_active: boolean },
  calls: [] as Array<{ table: string; op: string; payload?: unknown }>,
}));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
vi.mock('@/lib/auth', () => ({
  getCurrentProfile: async () => fake.profile,
  hasModule: (p: { modules: string[]; is_active: boolean } | null, m: string) => Boolean(p?.is_active && p.modules.includes(m)),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from(table: string) {
      const result = { data: { id: '00000000-0000-4000-8000-0000000000aa' }, error: null };
      const builder: Record<string, unknown> = {};
      for (const op of ['insert', 'update', 'delete', 'upsert']) {
        builder[op] = (payload?: unknown) => {
          fake.calls.push({ table, op, payload });
          return builder;
        };
      }
      for (const op of ['select', 'eq', 'order', 'limit']) builder[op] = () => builder;
      builder.single = async () => result;
      builder.maybeSingle = async () => ({ data: null, error: null });
      builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: [{ id: result.data.id }], error: null });
      return builder;
    },
    rpc: async () => ({ data: null, error: null }),
  }),
}));

// Own fixture ids (contracts.md section 9): c1c1 (org A) / c2c2 (org B).
const ORG_A = 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1';
const ORG_B = 'c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2';
const OWNER_A = 'c1c1c1c1-0001-4c1c-8c1c-000000000001';
const SALES_A = 'c1c1c1c1-0003-4c1c-8c1c-000000000003';
const OPS_A = 'c1c1c1c1-0004-4c1c-8c1c-000000000004';
const OWNER_B = 'c2c2c2c2-0001-4c2c-8c2c-000000000001';
const PRODUCT_A = 'c1c1c1c1-aaaa-4c1c-8c1c-aaaaaaaaaaaa';
const PRODUCT_B = 'c2c2c2c2-aaaa-4c2c-8c2c-aaaaaaaaaaaa';
const BUYER_A = 'c1c1c1c1-bbbb-4c1c-8c1c-bbbbbbbbbbbb';
const BUYER_B = 'c2c2c2c2-bbbb-4c2c-8c2c-bbbbbbbbbbbb';

const ORG_IDS = [ORG_A, ORG_B];
const USER_IDS = [OWNER_A, SALES_A, OPS_A, OWNER_B];
const ALL_MODULES = [
  'dashboard', 'leads', 'buyers', 'samples', 'quotes', 'orders', 'payments',
  'catalog', 'documents', 'reports', 'users', 'settings', 'audit',
];
const SALES_MODULES = ['dashboard', 'leads', 'buyers', 'samples', 'quotes', 'orders', 'catalog'];
const OPS_MODULES = ['dashboard', 'buyers', 'samples', 'orders', 'catalog']; // no leads

describe('0004 inquiries + follow-ups: codes, status machine, module walls, views', () => {
  let client: Client;
  let inquiryId: string;

  async function cleanup() {
    await resetRole(client);
    await client.query(`DELETE FROM follow_ups WHERE org_id = ANY($1::uuid[])`, [ORG_IDS]);
    await client.query(`DELETE FROM inquiries WHERE org_id = ANY($1::uuid[])`, [ORG_IDS]);
    await client.query(`DELETE FROM audit_log WHERE org_id = ANY($1::uuid[])`, [ORG_IDS]);
    await client.query(`DELETE FROM buyer_contacts WHERE org_id = ANY($1::uuid[])`, [ORG_IDS]);
    await client.query(`DELETE FROM buyers WHERE org_id = ANY($1::uuid[])`, [ORG_IDS]);
    await client.query(`DELETE FROM products WHERE org_id = ANY($1::uuid[])`, [ORG_IDS]);
    await client.query(`DELETE FROM profiles WHERE org_id = ANY($1::uuid[])`, [ORG_IDS]);
    await client.query(`DELETE FROM entity_code_counters WHERE org_id = ANY($1::uuid[])`, [ORG_IDS]);
    await client.query(`DELETE FROM organizations WHERE id = ANY($1::uuid[])`, [ORG_IDS]);
    await client.query(`DELETE FROM auth.users WHERE id = ANY($1::uuid[])`, [USER_IDS]);
  }

  beforeAll(async () => {
    client = await connect();
    await applyMigrations(client);
    await cleanup();

    await client.query(
      `INSERT INTO organizations (id, name, code) VALUES ($1, 'Inq Org A', 'INQ-A'), ($2, 'Inq Org B', 'INQ-B')`,
      [ORG_A, ORG_B],
    );
    await client.query(
      `INSERT INTO auth.users (id, email) VALUES
         ($1, 'owner@inq-a.test'), ($2, 'sales@inq-a.test'), ($3, 'ops@inq-a.test'), ($4, 'owner@inq-b.test')`,
      USER_IDS,
    );
    await client.query(
      `INSERT INTO profiles (id, org_id, email, full_name, role, modules, is_active) VALUES
         ($1, $5, 'owner@inq-a.test', 'Owner A', 'owner', $7::text[], true),
         ($2, $5, 'sales@inq-a.test', 'Sales A', 'sales', $8::text[], true),
         ($3, $5, 'ops@inq-a.test', 'Plant A', 'operations', $9::text[], true),
         ($4, $6, 'owner@inq-b.test', 'Owner B', 'owner', $7::text[], true)`,
      [OWNER_A, SALES_A, OPS_A, OWNER_B, ORG_A, ORG_B, ALL_MODULES, SALES_MODULES, OPS_MODULES],
    );
    await client.query(
      `INSERT INTO products (id, org_id, code, name, form, color) VALUES
         ($1, $2, 'INQ-P1', 'White Onion Flakes', 'flakes', 'white'),
         ($3, $4, 'INQ-P1', 'Other Org Flakes', 'flakes', 'white')`,
      [PRODUCT_A, ORG_A, PRODUCT_B, ORG_B],
    );
    await client.query(
      `INSERT INTO buyers (id, org_id, buyer_code, company_name, buyer_type, country, city) VALUES
         ($1, $3, 'BUY-T001', 'Test Masala Co', 'domestic_masala', 'India', 'Rajkot'),
         ($2, $4, 'BUY-T001', 'Other Org Buyer', 'domestic_masala', 'India', 'Surat')`,
      [BUYER_A, BUYER_B, ORG_A, ORG_B],
    );
    await client.query(
      `INSERT INTO buyer_contacts (org_id, buyer_id, name, phone, is_primary) VALUES
         ($1, $2, 'Secondary Person', '+91 90000 00002', false),
         ($1, $2, 'Primary Person', '+91 90000 00001', true)`,
      [ORG_A, BUYER_A],
    );
  });

  afterAll(async () => {
    if (client) {
      await cleanup();
      await client.end();
    }
  });

  // ---- happy path -----------------------------------------------------------

  it('sales inserts an inquiry and the trigger assigns INQ-0001 (counter per org)', async () => {
    await actAs(client, SALES_A);
    const res = await client.query(
      `INSERT INTO inquiries (org_id, buyer_id, buyer_name, phone, product_id, qty_kg, source, assigned_to)
       VALUES ($1, $2, 'Test Masala Co', '+91 90000 00001', $3, 500, 'call', $4)
       RETURNING id, code, status, created_by`,
      [ORG_A, BUYER_A, PRODUCT_A, SALES_A],
    );
    inquiryId = res.rows[0].id;
    expect(res.rows[0].code).toBe('INQ-0001');
    expect(res.rows[0].status).toBe('new');
    expect(res.rows[0].created_by).toBe(SALES_A);

    const second = await client.query(
      `INSERT INTO inquiries (org_id, buyer_name, product_text, source) VALUES ($1, 'Walk-in Buyer', 'Garlic flakes', 'visit') RETURNING code`,
      [ORG_A],
    );
    expect(second.rows[0].code).toBe('INQ-0002');
  });

  it('a seed-style insert with an explicit code keeps it (trigger fills only NULL)', async () => {
    await resetRole(client);
    const res = await client.query(
      `INSERT INTO inquiries (org_id, code, buyer_name, source, status, created_by)
       VALUES ($1, 'INQ-0099', 'Seeded Buyer', 'email', 'won', $2) RETURNING code`,
      [ORG_A, OWNER_A],
    );
    expect(res.rows[0].code).toBe('INQ-0099');
  });

  it('fn_inquiry_set_status: new -> talking -> quoted as sales', async () => {
    await actAs(client, SALES_A);
    await client.query(`SELECT fn_inquiry_set_status($1, 'talking')`, [inquiryId]);
    let row = await client.query(`SELECT status, closed_at FROM inquiries WHERE id = $1`, [inquiryId]);
    expect(row.rows[0].status).toBe('talking');

    await client.query(`SELECT fn_inquiry_set_status($1, 'quoted', NULL)`, [inquiryId]);
    row = await client.query(`SELECT status, closed_at FROM inquiries WHERE id = $1`, [inquiryId]);
    expect(row.rows[0].status).toBe('quoted');
    expect(row.rows[0].closed_at).toBeNull();
  });

  it("'won' and backwards moves raise invalid_transition (P0001) with the detail old -> new", async () => {
    await actAs(client, SALES_A);
    const err = await expectDbError(client.query(`SELECT fn_inquiry_set_status($1, 'won')`, [inquiryId]), 'P0001', 'invalid_transition');
    expect(err.detail).toBe('quoted -> won');
    await expectDbError(client.query(`SELECT fn_inquiry_set_status($1, 'new')`, [inquiryId]), 'P0001', 'invalid_transition');
    await expectDbError(client.query(`SELECT fn_inquiry_set_status($1, 'sample_sent')`, [inquiryId]), 'P0001', 'invalid_transition');
    await expectDbError(client.query(`SELECT fn_inquiry_set_status($1, 'bogus')`, [inquiryId]), 'P0001', 'bad_payload');
  });

  it('lost needs one of the four reasons (reason_required), then closes the inquiry and its reminders', async () => {
    await actAs(client, SALES_A);
    // a pending reminder on the inquiry
    const fu = await client.query(
      `INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on)
       VALUES ($1, 'inquiry', $2, $3, 'Call back about rate', CURRENT_DATE + 1) RETURNING id`,
      [ORG_A, inquiryId, BUYER_A],
    );
    await expectDbError(client.query(`SELECT fn_inquiry_set_status($1, 'lost')`, [inquiryId]), 'P0001', 'reason_required');
    await expectDbError(client.query(`SELECT fn_inquiry_set_status($1, 'lost', 'moved')`, [inquiryId]), 'P0001', 'reason_required');

    await client.query(`SELECT fn_inquiry_set_status($1, 'lost', 'price')`, [inquiryId]);
    const row = await client.query(`SELECT status, lost_reason, closed_at FROM inquiries WHERE id = $1`, [inquiryId]);
    expect(row.rows[0].status).toBe('lost');
    expect(row.rows[0].lost_reason).toBe('price');
    expect(row.rows[0].closed_at).not.toBeNull();

    const done = await client.query(`SELECT done, done_by, done_at FROM follow_ups WHERE id = $1`, [fu.rows[0].id]);
    expect(done.rows[0].done).toBe(true);
    expect(done.rows[0].done_by).toBe(SALES_A);
    expect(done.rows[0].done_at).not.toBeNull();
  });

  it('Reopen (lost -> talking): sales gets role_not_allowed (42501), owner succeeds and clears the reason', async () => {
    await actAs(client, SALES_A);
    await expectDbError(client.query(`SELECT fn_inquiry_set_status($1, 'talking')`, [inquiryId]), '42501', 'role_not_allowed');
    // lost cannot go anywhere else, even for the owner
    await actAs(client, OWNER_A);
    await expectDbError(client.query(`SELECT fn_inquiry_set_status($1, 'quoted')`, [inquiryId]), 'P0001', 'invalid_transition');

    await client.query(`SELECT fn_inquiry_set_status($1, 'talking')`, [inquiryId]);
    const row = await client.query(`SELECT status, lost_reason, closed_at FROM inquiries WHERE id = $1`, [inquiryId]);
    expect(row.rows[0].status).toBe('talking');
    expect(row.rows[0].lost_reason).toBeNull();
    expect(row.rows[0].closed_at).toBeNull();
  });

  // ---- column locks ---------------------------------------------------------

  it('direct UPDATE of status / lost_reason / closed_at is refused by the column grant; editable columns work', async () => {
    await actAs(client, SALES_A);
    await expectDbError(client.query(`UPDATE inquiries SET status = 'won' WHERE id = $1`, [inquiryId]), '42501');
    await expectDbError(client.query(`UPDATE inquiries SET lost_reason = 'price' WHERE id = $1`, [inquiryId]), '42501');
    await expectDbError(client.query(`UPDATE inquiries SET closed_at = now() WHERE id = $1`, [inquiryId]), '42501');

    const ok = await client.query(
      `UPDATE inquiries SET notes = 'Wants 20 bags', qty_kg = 600, updated_at = now() WHERE id = $1 RETURNING notes, qty_kg`,
      [inquiryId],
    );
    expect(ok.rowCount).toBe(1);
    expect(ok.rows[0].notes).toBe('Wants 20 bags');
    expect(Number(ok.rows[0].qty_kg)).toBe(600);
  });

  it('follow_ups: done / done_at / done_by are locked; note / due_on / buyer_id are editable', async () => {
    await actAs(client, SALES_A);
    const fu = await client.query(
      `INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on)
       VALUES ($1, 'inquiry', $2, $3, 'Send rate list', CURRENT_DATE + 2) RETURNING id`,
      [ORG_A, inquiryId, BUYER_A],
    );
    await expectDbError(client.query(`UPDATE follow_ups SET done = true WHERE id = $1`, [fu.rows[0].id]), '42501');
    const ok = await client.query(
      `UPDATE follow_ups SET note = 'Send rate list today', due_on = CURRENT_DATE, updated_at = now() WHERE id = $1 RETURNING note`,
      [fu.rows[0].id],
    );
    expect(ok.rowCount).toBe(1);
    expect(ok.rows[0].note).toBe('Send rate list today');
  });

  // ---- notes rule -----------------------------------------------------------

  it('a plain note is due_on NULL + done = true; due_on NULL + done = false fails the CHECK', async () => {
    await actAs(client, SALES_A);
    const note = await client.query(
      `INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on, done, done_at)
       VALUES ($1, 'inquiry', $2, $3, 'Buyer prefers WhatsApp after 2 pm', NULL, true, now()) RETURNING id, done`,
      [ORG_A, inquiryId, BUYER_A],
    );
    expect(note.rows[0].done).toBe(true);

    await expectDbError(
      client.query(
        `INSERT INTO follow_ups (org_id, entity_type, entity_id, note, due_on, done) VALUES ($1, 'inquiry', $2, 'No date', NULL, false)`,
        [ORG_A, inquiryId],
      ),
      '23514',
    );
    await expectDbError(
      client.query(
        `INSERT INTO follow_ups (org_id, entity_type, entity_id, note, due_on) VALUES ($1, 'inquiry', $2, '   ', CURRENT_DATE)`,
        [ORG_A, inquiryId],
      ),
      '23514',
    );
  });

  // ---- module walls ---------------------------------------------------------

  it('without the leads module (operations): fn_inquiry_set_status raises 42501, inquiries insert is refused, buyer notes still work', async () => {
    await actAs(client, OPS_A);
    await expectDbError(client.query(`SELECT fn_inquiry_set_status($1, 'quoted')`, [inquiryId]), '42501');
    await expectDbError(
      client.query(`INSERT INTO inquiries (org_id, buyer_name, source) VALUES ($1, 'Plant Lead', 'call')`, [ORG_A]),
      '42501',
    );
    // inquiry follow-up needs leads (policy maps entity_type -> module)
    await expectDbError(
      client.query(
        `INSERT INTO follow_ups (org_id, entity_type, entity_id, note, due_on) VALUES ($1, 'inquiry', $2, 'Plant note', CURRENT_DATE)`,
        [ORG_A, inquiryId],
      ),
      '42501',
    );
    // buyer follow-up needs buyers, which operations holds
    const ok = await client.query(
      `INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on)
       VALUES ($1, 'buyer', $2, $2, 'Plant: ask about bag print', CURRENT_DATE) RETURNING id`,
      [ORG_A, BUYER_A],
    );
    expect(ok.rowCount).toBe(1);
    // reading is still own-org wide
    const rows = await client.query(`SELECT count(*)::int AS n FROM inquiries`);
    expect(rows.rows[0].n).toBeGreaterThan(0);
  });

  it('fn_follow_up_done: mapped module required (ops cannot tick an inquiry reminder), then done once', async () => {
    await resetRole(client);
    const fu = await client.query(
      `INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on, created_by)
       VALUES ($1, 'inquiry', $2, $3, 'Tick me', CURRENT_DATE, $4) RETURNING id`,
      [ORG_A, inquiryId, BUYER_A, SALES_A],
    );
    const id = fu.rows[0].id;

    await actAs(client, OPS_A);
    await expectDbError(client.query(`SELECT fn_follow_up_done($1)`, [id]), '42501');

    await actAs(client, SALES_A);
    await client.query(`SELECT fn_follow_up_done($1)`, [id]);
    const row = await client.query(`SELECT done, done_by, done_at FROM follow_ups WHERE id = $1`, [id]);
    expect(row.rows[0].done).toBe(true);
    expect(row.rows[0].done_by).toBe(SALES_A);
    const firstDoneAt = row.rows[0].done_at;

    // already done: no-op, done_at unchanged
    await client.query(`SELECT fn_follow_up_done($1)`, [id]);
    const again = await client.query(`SELECT done_at FROM follow_ups WHERE id = $1`, [id]);
    expect(again.rows[0].done_at.getTime()).toBe(firstDoneAt.getTime());

    // payment rows: orders OR payments module, but never Plant (A6 / G3-03): sales (orders) ticks it
    await resetRole(client);
    const pay = await client.query(
      `INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on)
       VALUES ($1, 'payment', gen_random_uuid(), $2, 'Balance due', CURRENT_DATE) RETURNING id`,
      [ORG_A, BUYER_A],
    );
    await actAs(client, OPS_A);
    await expectDbError(client.query(`SELECT fn_follow_up_done($1)`, [pay.rows[0].id]), '42501', 'not_found');
    await actAs(client, SALES_A);
    await client.query(`SELECT fn_follow_up_done($1)`, [pay.rows[0].id]);
    const payRow = await client.query(`SELECT done FROM follow_ups WHERE id = $1`, [pay.rows[0].id]);
    expect(payRow.rows[0].done).toBe(true);
  });

  it('A6 / G3-03: Plant reads no money reminder (table, To-do view, KPI count); others still do', async () => {
    await resetRole(client);
    const orderId = '00000000-0000-4000-8000-00000000c1c1';
    const ins = await client.query(
      `INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on) VALUES
         ($1, 'payment', $3, $2, 'Balance $18,900 due', CURRENT_DATE - 6),
         ($1, 'order',   $3, $2, 'Truck for Monday', CURRENT_DATE)
       RETURNING id, entity_type`,
      [ORG_A, BUYER_A, orderId],
    );
    const payId = ins.rows.find((r) => r.entity_type === 'payment').id;
    const ordId = ins.rows.find((r) => r.entity_type === 'order').id;

    await actAs(client, OPS_A);
    const opsTable = await client.query(`SELECT id FROM follow_ups WHERE entity_id = $1`, [orderId]);
    expect(opsTable.rows.map((r) => r.id)).toEqual([ordId]);
    const opsToday = await client.query(`SELECT id FROM v_followups_today WHERE entity_id = $1`, [orderId]);
    expect(opsToday.rows.map((r) => r.id)).toEqual([ordId]);
    expect((await client.query(`SELECT count(*)::int AS n FROM follow_ups WHERE entity_type = 'payment'`)).rows[0].n).toBe(0);
    // not visible, so not updatable or deletable either
    expect((await client.query(`UPDATE follow_ups SET note = 'x' WHERE id = $1`, [payId])).rowCount).toBe(0);

    for (const who of [OWNER_A, SALES_A]) {
      await actAs(client, who);
      const seen = await client.query(`SELECT id FROM v_followups_today WHERE entity_id = $1 ORDER BY due_on`, [orderId]);
      expect(seen.rows.map((r) => r.id)).toEqual([payId, ordId]);
    }
    await resetRole(client);
    await client.query(`DELETE FROM follow_ups WHERE id = ANY($1::uuid[])`, [[payId, ordId]]);
  });

  // ---- cross tenant ---------------------------------------------------------

  it('cross-tenant: owner B sees 0 rows and gets not_found (42501) from both functions', async () => {
    await resetRole(client);
    const fu = await client.query(
      `INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on)
       VALUES ($1, 'inquiry', $2, $3, 'Org A reminder', CURRENT_DATE) RETURNING id`,
      [ORG_A, inquiryId, BUYER_A],
    );

    await actAs(client, OWNER_B);
    const inq = await client.query(`SELECT id FROM inquiries`);
    expect(inq.rows.length).toBe(0);
    const fus = await client.query(`SELECT id FROM follow_ups`);
    expect(fus.rows.length).toBe(0);
    const open = await client.query(`SELECT id FROM v_inquiries_open`);
    expect(open.rows.length).toBe(0);
    const today = await client.query(`SELECT id FROM v_followups_today`);
    expect(today.rows.length).toBe(0);

    await expectDbError(client.query(`SELECT fn_inquiry_set_status($1, 'quoted')`, [inquiryId]), '42501', 'not_found');
    await expectDbError(client.query(`SELECT fn_follow_up_done($1)`, [fu.rows[0].id]), '42501', 'not_found');

    // an insert that names org A is refused by the policy
    await expectDbError(
      client.query(`INSERT INTO inquiries (org_id, buyer_name, source) VALUES ($1, 'Sneaky', 'call')`, [ORG_A]),
      '42501',
    );
    // and a direct UPDATE touches nothing
    const upd = await client.query(`UPDATE inquiries SET notes = 'hacked' WHERE id = $1`, [inquiryId]);
    expect(upd.rowCount).toBe(0);
  });

  it("G2-03: an inquiry or follow-up cannot point at another org's buyer, product or user (insert and update)", async () => {
    await actAs(client, SALES_A);
    await expectDbError(
      client.query(`INSERT INTO inquiries (org_id, buyer_id, buyer_name, source) VALUES ($1, $2, 'Other Org Buyer', 'call')`, [ORG_A, BUYER_B]),
      '42501',
    );
    await expectDbError(
      client.query(`INSERT INTO inquiries (org_id, buyer_name, product_id, source) VALUES ($1, 'Foreign product', $2, 'call')`, [ORG_A, PRODUCT_B]),
      '42501',
    );
    await expectDbError(
      client.query(`INSERT INTO inquiries (org_id, buyer_name, assigned_to, source) VALUES ($1, 'Foreign user', $2, 'call')`, [ORG_A, OWNER_B]),
      '42501',
    );
    await expectDbError(client.query(`UPDATE inquiries SET buyer_id = $2 WHERE id = $1`, [inquiryId, BUYER_B]), '42501');
    await expectDbError(client.query(`UPDATE inquiries SET product_id = $2 WHERE id = $1`, [inquiryId, PRODUCT_B]), '42501');
    await expectDbError(client.query(`UPDATE inquiries SET assigned_to = $2 WHERE id = $1`, [inquiryId, OWNER_B]), '42501'); // SEC2-06
    await expectDbError(
      client.query(
        `INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on) VALUES ($1, 'inquiry', $2, $3, 'Foreign buyer', CURRENT_DATE)`,
        [ORG_A, inquiryId, BUYER_B],
      ),
      '42501',
    );

    // own-org references still save, and a follow-up cannot be re-pointed at org B's buyer
    const own = await client.query(
      `INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on) VALUES ($1, 'inquiry', $2, $3, 'Own buyer', CURRENT_DATE + 1) RETURNING id`,
      [ORG_A, inquiryId, BUYER_A],
    );
    await expectDbError(client.query(`UPDATE follow_ups SET buyer_id = $2 WHERE id = $1`, [own.rows[0].id, BUYER_B]), '42501');
    const ok = await client.query(`UPDATE inquiries SET buyer_id = $2, product_id = $3 WHERE id = $1`, [inquiryId, BUYER_A, PRODUCT_A]);
    expect(ok.rowCount).toBe(1);

    // the refused inserts did not burn INQ numbers or pin org B's rows
    await resetRole(client);
    const pinned = await client.query(`SELECT count(*)::int AS n FROM inquiries WHERE buyer_id = $1 OR product_id = $2`, [BUYER_B, PRODUCT_B]);
    expect(pinned.rows[0].n).toBe(0);
    await client.query(`DELETE FROM follow_ups WHERE id = $1`, [own.rows[0].id]);
  });

  // ---- views ----------------------------------------------------------------

  it('v_followups_today: due and overdue rows only, notes / done / future hidden, buyer name + primary phone', async () => {
    await resetRole(client);
    await client.query(`DELETE FROM follow_ups WHERE org_id = $1`, [ORG_A]);
    // an inquiry without a buyer, so the view falls back to inquiries.buyer_name / phone
    const noBuyer = await client.query(
      `INSERT INTO inquiries (org_id, code, buyer_name, phone, source, created_by)
       VALUES ($1, 'INQ-0077', 'Gulf Star Trading', '+971 55 234 8899', 'indiamart', $2) RETURNING id`,
      [ORG_A, SALES_A],
    );
    await client.query(
      `INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on, done, done_at, created_at) VALUES
         ($1, 'inquiry', $2, $3, 'Overdue by six', CURRENT_DATE - 6, false, NULL, now() - interval '6 days'),
         ($1, 'inquiry', $4, NULL, 'Due today, no buyer row', CURRENT_DATE, false, NULL, now()),
         ($1, 'buyer', $3, $3, 'Buyer reminder today', CURRENT_DATE, false, NULL, now() - interval '1 day'),
         ($1, 'order', gen_random_uuid(), $3, 'Balance due later', CURRENT_DATE + 3, false, NULL, now()),
         ($1, 'inquiry', $2, $3, 'Plain note', NULL, true, now(), now()),
         ($1, 'inquiry', $2, $3, 'Already done', CURRENT_DATE - 1, true, now(), now()),
         ($5, 'buyer', $6, $6, 'Org B today', CURRENT_DATE, false, NULL, now())`,
      [ORG_A, inquiryId, BUYER_A, noBuyer.rows[0].id, ORG_B, BUYER_B],
    );

    await actAs(client, SALES_A);
    const res = await client.query(`SELECT * FROM v_followups_today`);
    const notes = res.rows.map((r) => r.note);
    expect(notes).toEqual(['Overdue by six', 'Buyer reminder today', 'Due today, no buyer row']);
    expect(res.rows.every((r) => r.org_id === ORG_A)).toBe(true);

    const overdue = res.rows[0];
    expect(Number(overdue.days_late)).toBe(6);
    expect(overdue.buyer_id).toBe(BUYER_A);
    expect(overdue.buyer_name).toBe('Test Masala Co');
    expect(overdue.phone).toBe('+91 90000 00001'); // primary contact, not the secondary
    expect(overdue.inquiry_code).toBe('INQ-0001');

    const fallback = res.rows[2];
    expect(Number(fallback.days_late)).toBe(0);
    expect(fallback.buyer_id).toBeNull();
    expect(fallback.buyer_name).toBe('Gulf Star Trading');
    expect(fallback.phone).toBe('+971 55 234 8899');
    expect(fallback.inquiry_code).toBe('INQ-0077');

    const buyerRow = res.rows[1];
    expect(buyerRow.entity_type).toBe('buyer');
    expect(buyerRow.inquiry_code).toBeNull();
    expect(buyerRow.buyer_name).toBe('Test Masala Co');
  });

  it('v_inquiries_open: hides won / lost, shows product name, days_old and the next pending reminder', async () => {
    await actAs(client, SALES_A);
    const res = await client.query(`SELECT code, status, product_name, days_old, next_followup_on FROM v_inquiries_open ORDER BY code`);
    const codes = res.rows.map((r) => r.code);
    expect(codes).toContain('INQ-0001');
    expect(codes).toContain('INQ-0077');
    expect(codes).not.toContain('INQ-0099'); // won
    const first = res.rows.find((r) => r.code === 'INQ-0001')!;
    expect(first.product_name).toBe('White Onion Flakes');
    expect(Number(first.days_old)).toBe(0);
    expect(first.next_followup_on).not.toBeNull(); // the 6-days-overdue reminder
    const second = res.rows.find((r) => r.code === 'INQ-0002')!;
    expect(second.product_name).toBe('Garlic flakes'); // product_text fallback
  });

  it('buyers: insert without buyer_code gets BUY-0001 from the trigger (buyer form)', async () => {
    await actAs(client, SALES_A);
    const res = await client.query(
      `INSERT INTO buyers (org_id, company_name, buyer_type, country, city) VALUES ($1, 'New Form Buyer', 'domestic_masala', 'India', 'Mahuva') RETURNING buyer_code`,
      [ORG_A],
    );
    expect(res.rows[0].buyer_code).toBe('BUY-0001');
  });

  it('SEC2-02: buyer_code / id / org_id / created_at are locked for web sessions; editable columns save; numbering continues', async () => {
    await actAs(client, SALES_A);
    await expectDbError(client.query(`UPDATE buyers SET buyer_code = 'BUY-0002' WHERE id = $1`, [BUYER_A]), '42501');
    await expectDbError(client.query(`UPDATE buyers SET org_id = $2 WHERE id = $1`, [BUYER_A, ORG_B]), '42501');
    await expectDbError(client.query(`UPDATE buyers SET created_at = now() - interval '1 year' WHERE id = $1`, [BUYER_A]), '42501');
    const edit = await client.query(
      `UPDATE buyers SET credit_period_days = 45, payment_terms = '45 days credit', status = 'active', updated_at = now() WHERE id = $1`,
      [BUYER_A],
    );
    expect(edit.rowCount).toBe(1);
    const next = await client.query(
      `INSERT INTO buyers (org_id, company_name, buyer_type) VALUES ($1, 'Second Form Buyer', 'domestic_food_mfr') RETURNING buyer_code`,
      [ORG_A],
    );
    expect(next.rows[0].buyer_code).toBe('BUY-0002');

    // a web session cannot pre-claim the next number: the supplied code is replaced (0003 fn_assign_code)
    // and the following plain insert still saves instead of failing with 23505
    const claim = await client.query(
      `INSERT INTO buyers (org_id, buyer_code, company_name, buyer_type) VALUES ($1, 'BUY-0004', 'Claimer', 'domestic_masala') RETURNING buyer_code`,
      [ORG_A],
    );
    expect(claim.rows[0].buyer_code).toBe('BUY-0003');
    const after = await client.query(
      `INSERT INTO buyers (org_id, company_name, buyer_type) VALUES ($1, 'After Claimer', 'domestic_masala') RETURNING buyer_code`,
      [ORG_A],
    );
    expect(after.rows[0].buyer_code).toBe('BUY-0004');

    const inqClaim = await client.query(
      `INSERT INTO inquiries (org_id, code, buyer_name, source) VALUES ($1, 'INQ-0004', 'Claimer', 'call') RETURNING code`,
      [ORG_A],
    );
    expect(inqClaim.rows[0].code).toBe('INQ-0003');
    const inqAfter = await client.query(
      `INSERT INTO inquiries (org_id, buyer_name, source) VALUES ($1, 'After Claimer', 'call') RETURNING code`,
      [ORG_A],
    );
    expect(inqAfter.rows[0].code).toBe('INQ-0004');
  });

  it('G2-02 / SEC2-03: Plant (operations) holds buyers but is read only: reads work, writes are refused or touch 0 rows', async () => {
    expect(canWriteBuyers('operations')).toBe(false); // the server-action gate (buyers/actions.ts)
    expect(['owner', 'accountant', 'sales'].every((r) => canWriteBuyers(r))).toBe(true);

    await actAs(client, OPS_A);
    const read = await client.query(`SELECT credit_period_days FROM buyers WHERE id = $1`, [BUYER_A]);
    expect(read.rows.length).toBe(1);
    const before = read.rows[0].credit_period_days;

    await expectDbError(
      client.query(`INSERT INTO buyers (org_id, company_name, buyer_type) VALUES ($1, 'Plant Buyer', 'domestic_food_mfr')`, [ORG_A]),
      '42501',
    );
    const upd = await client.query(`UPDATE buyers SET credit_period_days = 90 WHERE id = $1`, [BUYER_A]);
    expect(upd.rowCount).toBe(0);
    const del = await client.query(`DELETE FROM buyers WHERE id = $1`, [BUYER_A]);
    expect(del.rowCount).toBe(0);
    await expectDbError(
      client.query(`INSERT INTO buyer_contacts (org_id, buyer_id, name, phone) VALUES ($1, $2, 'Plant contact', '+91 90000 00009')`, [ORG_A, BUYER_A]),
      '42501',
    );
    const updContact = await client.query(`UPDATE buyer_contacts SET phone = '+91 99999 99999' WHERE buyer_id = $1`, [BUYER_A]);
    expect(updContact.rowCount).toBe(0);
    const delContact = await client.query(`DELETE FROM buyer_contacts WHERE buyer_id = $1`, [BUYER_A]);
    expect(delContact.rowCount).toBe(0);

    await resetRole(client);
    const after = await client.query(`SELECT credit_period_days FROM buyers WHERE id = $1`, [BUYER_A]);
    expect(after.rows[0].credit_period_days).toBe(before);
  });

  // ---- A9: row starts and deletes (G2-05, SEC2-05, SEC2-11) ------------------
  // Last in the describe: the inserts that succeed here take INQ numbers the tests above count on.

  it('A9: an inquiry INSERT starts as New, open, in the caller\'s name; the app insert shape still saves', async () => {
    await actAs(client, SALES_A);
    const refused: Array<[string, unknown[]]> = [
      [`INSERT INTO inquiries (org_id, buyer_name, source, status, closed_at) VALUES ($1, 'Fake win', 'call', 'won', now())`, [ORG_A]],
      [`INSERT INTO inquiries (org_id, buyer_name, source, status) VALUES ($1, 'Fake quote', 'call', 'quoted')`, [ORG_A]],
      [`INSERT INTO inquiries (org_id, buyer_name, source, lost_reason) VALUES ($1, 'Fake reason', 'call', 'price')`, [ORG_A]],
      [`INSERT INTO inquiries (org_id, buyer_name, source, closed_at) VALUES ($1, 'Fake close', 'call', now())`, [ORG_A]],
      [`INSERT INTO inquiries (org_id, buyer_name, source, created_by) VALUES ($1, 'Fake author', 'call', $2)`, [ORG_A, OWNER_A]],
    ];
    for (const [sql, params] of refused) await expectDbError(client.query(sql, params), '42501');

    // createInquiryAction: status default, assigned_to + created_by = the caller
    const ok = await client.query(
      `INSERT INTO inquiries (org_id, buyer_id, buyer_name, product_id, qty_kg, source, assigned_to, created_by)
       VALUES ($1, $2, 'Test Masala Co', $3, 250, 'whatsapp', $4, $4) RETURNING status, created_by`,
      [ORG_A, BUYER_A, PRODUCT_A, SALES_A],
    );
    expect(ok.rows[0]).toEqual({ status: 'new', created_by: SALES_A });

    await resetRole(client);
    const fakes = await client.query(`SELECT count(*)::int AS n FROM inquiries WHERE org_id = $1 AND buyer_name LIKE 'Fake %'`, [ORG_A]);
    expect(fakes.rows[0].n).toBe(0);
  });

  it('A9: a follow-up INSERT is a pending reminder or a plain note, never done by someone else; app and definer shapes save', async () => {
    await actAs(client, SALES_A);
    const refused: Array<[string, unknown[]]> = [
      // done_by = the owner (SEC2-05 proof)
      [`INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on, done, done_at, done_by)
        VALUES ($1, 'buyer', $2, $2, 'Owner said ok', NULL, true, now(), $3)`, [ORG_A, BUYER_A, OWNER_A]],
      [`INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on, done_by)
        VALUES ($1, 'buyer', $2, $2, 'Pending, done by owner', CURRENT_DATE, $3)`, [ORG_A, BUYER_A, OWNER_A]],
      // a reminder that is already ticked
      [`INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on, done, done_at)
        VALUES ($1, 'buyer', $2, $2, 'Pre-ticked', CURRENT_DATE, true, now())`, [ORG_A, BUYER_A]],
      // a pending reminder with a done time
      [`INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on, done, done_at)
        VALUES ($1, 'buyer', $2, $2, 'Pending with done_at', CURRENT_DATE, false, now())`, [ORG_A, BUYER_A]],
      // written in someone else's name
      [`INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on, created_by)
        VALUES ($1, 'buyer', $2, $2, 'Owner wrote this', CURRENT_DATE, $3)`, [ORG_A, BUYER_A, OWNER_A]],
    ];
    for (const [sql, params] of refused) await expectDbError(client.query(sql, params), '42501');

    // addFollowUpAction: plain note and reminder
    const note = await client.query(
      `INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on, done, done_at, created_by)
       VALUES ($1, 'buyer', $2, $2, 'A9 app note', NULL, true, now(), $3) RETURNING id`,
      [ORG_A, BUYER_A, SALES_A],
    );
    expect(note.rowCount).toBe(1);
    const reminder = await client.query(
      `INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on, done, done_at, created_by)
       VALUES ($1, 'buyer', $2, $2, 'A9 app reminder', CURRENT_DATE + 1, false, NULL, $3) RETURNING id`,
      [ORG_A, BUYER_A, SALES_A],
    );
    expect(reminder.rowCount).toBe(1);
    // addOrderNoteAction sends no created_by (column default auth.uid())
    const orderNote = await client.query(
      `INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on, done, done_at)
       VALUES ($1, 'order', gen_random_uuid(), $2, 'A9 order note', NULL, true, now()) RETURNING created_by`,
      [ORG_A, BUYER_A],
    );
    expect(orderNote.rows[0].created_by).toBe(SALES_A);
    // the row shape every 0005 / 0006 definer inserts (done false, due_on set, created_by = auth.uid())
    const definerShape = await client.query(
      `INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on, done, created_by)
       VALUES ($1, 'order', gen_random_uuid(), $2, 'A9 Advance $8,568 due - check bank', CURRENT_DATE + 3, false, auth.uid()) RETURNING id`,
      [ORG_A, BUYER_A],
    );
    expect(definerShape.rowCount).toBe(1);
  });

  it("A9: sales cannot delete a system reminder ('Balance ... due') even after ticking it; own plain note goes; owner may delete any row", async () => {
    // As written by fn_dispatch_delivered / fn_order_dispatch when sales triggered it: created_by = sales.
    await resetRole(client);
    const sys = await client.query(
      `INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on, done, created_by)
       VALUES ($1, 'order', gen_random_uuid(), $2, 'Balance $18,900 due', CURRENT_DATE - 2, false, $3) RETURNING id`,
      [ORG_A, BUYER_A, SALES_A],
    );
    const sysId = sys.rows[0].id;

    await actAs(client, SALES_A);
    expect((await client.query(`DELETE FROM follow_ups WHERE id = $1`, [sysId])).rowCount).toBe(0);
    expect((await client.query(`DELETE FROM follow_ups WHERE note LIKE 'Balance %'`)).rowCount).toBe(0);
    // own pending reminder: also kept (only plain notes are deletable)
    const ownReminder = await client.query(
      `INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on) VALUES ($1, 'buyer', $2, $2, 'Own reminder', CURRENT_DATE) RETURNING id`,
      [ORG_A, BUYER_A],
    );
    expect((await client.query(`DELETE FROM follow_ups WHERE id = $1`, [ownReminder.rows[0].id])).rowCount).toBe(0);

    // tick it, clear the date (allowed by the UPDATE grant), try again: done_by keeps it a reminder
    await client.query(`SELECT fn_follow_up_done($1)`, [sysId]);
    const cleared = await client.query(`UPDATE follow_ups SET due_on = NULL, updated_at = now() WHERE id = $1`, [sysId]);
    expect(cleared.rowCount).toBe(1);
    expect((await client.query(`DELETE FROM follow_ups WHERE id = $1`, [sysId])).rowCount).toBe(0);

    // own plain note: deleted
    const own = await client.query(
      `INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on, done, done_at)
       VALUES ($1, 'buyer', $2, $2, 'Typo note', NULL, true, now()) RETURNING id`,
      [ORG_A, BUYER_A],
    );
    expect((await client.query(`DELETE FROM follow_ups WHERE id = $1`, [own.rows[0].id])).rowCount).toBe(1);

    // someone else's plain note (Plant wrote it on the buyer): kept
    await actAs(client, OPS_A);
    const plantNote = await client.query(
      `INSERT INTO follow_ups (org_id, entity_type, entity_id, buyer_id, note, due_on, done, done_at)
       VALUES ($1, 'buyer', $2, $2, 'Plant: bags printed', NULL, true, now()) RETURNING id`,
      [ORG_A, BUYER_A],
    );
    await actAs(client, SALES_A);
    expect((await client.query(`DELETE FROM follow_ups WHERE id = $1`, [plantNote.rows[0].id])).rowCount).toBe(0);

    // the owner may delete any row, system reminders included
    await actAs(client, OWNER_A);
    expect((await client.query(`DELETE FROM follow_ups WHERE id = ANY($1::uuid[])`, [[sysId, plantNote.rows[0].id, ownReminder.rows[0].id]])).rowCount).toBe(3);

    await resetRole(client);
    const left = await client.query(`SELECT count(*)::int AS n FROM follow_ups WHERE id = ANY($1::uuid[])`, [[sysId, plantNote.rows[0].id]]);
    expect(left.rows[0].n).toBe(0);
  });
});

describe('buyer form helpers: SEC2-04 redirect guard, G2-04 country from phone', () => {
  it('safeInternalPath keeps in-app paths and refuses everything that leaves the app', () => {
    expect(safeInternalPath('/samples/new?inquiry=abc&buyer={id}')).toBe('/samples/new?inquiry=abc&buyer={id}');
    expect(safeInternalPath('/inquiries/new?buyer={id}')).toBe('/inquiries/new?buyer={id}');
    expect(safeInternalPath('/buyers')).toBe('/buyers');
    for (const bad of [
      '/\\evil.example', // /\evil.example (the finding)
      '/\t/evil.example', // tab is stripped -> //evil.example
      '/\n/evil.example',
      '//evil.example',
      '/.//evil.example', // resolves to the path //evil.example
      '/a/../..//evil.example',
      'https://evil.example',
      'javascript:alert(1)',
      'evil.example',
      '',
      null,
      undefined,
    ]) {
      expect(safeInternalPath(bad as string | null | undefined), String(bad)).toBeNull();
    }
  });

  it('whereFromPhone: Indian numbers stay India, known calling codes give Export + country, unknown codes ask', () => {
    expect(whereFromPhone('+91 98980 11223')).toEqual({ isExport: false, country: 'India' });
    expect(whereFromPhone('98980 11223')).toEqual({ isExport: false, country: 'India' });
    expect(whereFromPhone('+971 55 234 8899')).toEqual({ isExport: true, country: 'United Arab Emirates' });
    expect(whereFromPhone('+49 40 3298 1234')).toEqual({ isExport: true, country: 'Germany' });
    expect(whereFromPhone('+1 212 555 0100')).toEqual({ isExport: true, country: 'United States' });
    expect(whereFromPhone('+998 71 123 4567')).toEqual({ isExport: true, country: '' });
    expect(whereFromPhone('')).toEqual({ isExport: false, country: 'India' });
  });
});

describe('server actions: Plant is read only on buyers (SEC2-03), inquiry "+ New buyer" makes no buyer row (G2-04)', () => {
  const ORG = '11111111-1111-4111-8111-111111111111';
  const BUYER_FORM = {
    company_name: 'Gulf Star Foodstuff Trading',
    phone: '+971 55 234 8899',
    is_export: true,
    country: 'United Arab Emirates',
  };
  const asRole = (role: string, modules: string[]) => {
    fake.profile = { id: '22222222-2222-4222-8222-222222222299', org_id: ORG, role, modules, is_active: true };
  };

  beforeEach(() => {
    fake.calls.length = 0;
  });

  it('operations (holds buyers) gets access denied from create and update, and nothing is written', async () => {
    asRole('operations', OPS_MODULES);
    expect(await createBuyerAction(BUYER_FORM)).toEqual({ ok: false, messageKey: 'msg.access_denied_title' });
    expect(await updateBuyerAction({ ...BUYER_FORM, id: BUYER_A, credit_period_days: 365 })).toEqual({
      ok: false,
      messageKey: 'msg.access_denied_title',
    });
    expect(fake.calls).toEqual([]);
  });

  it('sales may create a buyer; an export buyer without a country is refused before any write', async () => {
    asRole('sales', SALES_MODULES);
    expect(await createBuyerAction({ ...BUYER_FORM, country: '' })).toEqual({ ok: false, messageKey: 'msg.error.required' });
    expect(fake.calls).toEqual([]);
    const ok = await createBuyerAction(BUYER_FORM);
    expect(ok.ok).toBe(true);
    const buyerInsert = fake.calls.find((c) => c.table === 'buyers' && c.op === 'insert');
    expect(buyerInsert?.payload).toMatchObject({ org_id: ORG, country: 'United Arab Emirates', buyer_type: 'export_importer' });
  });

  it('"+ New buyer" on an inquiry keeps name + phone on the inquiry and writes no buyer / contact row', async () => {
    asRole('sales', SALES_MODULES);
    const res = await createInquiryAction({
      buyer_id: null,
      new_buyer: { name: 'Gulf Star Foodstuff Trading', phone: '+971 55 234 8899' },
      buyer_name: 'Gulf Star Foodstuff Trading',
      phone: '+971 55 234 8899',
      product_id: null,
      product_text: 'White flakes',
      qty_kg: 6000,
      needed_by: null,
      source: 'indiamart',
      notes: null,
    });
    expect(res.ok).toBe(true);
    expect(fake.calls.map((c) => `${c.table}.${c.op}`)).toEqual(['inquiries.insert']);
    expect(fake.calls[0].payload).toMatchObject({
      org_id: ORG,
      buyer_id: null,
      buyer_name: 'Gulf Star Foodstuff Trading',
      phone: '+971 55 234 8899',
    });
  });
});
