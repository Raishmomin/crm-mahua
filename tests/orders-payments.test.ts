import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { connect, applyMigrations, actAs, resetRole, expectDbError } from './helpers/db';
import {
  checklistDoneCount,
  composeLabel,
  defaultPort,
  dispatchedText,
  fyOf,
  isExportBuyer,
  nextDocNo,
  plannedBags,
  prefillAmount,
  productShort,
  reminderText,
  waLang,
} from '../src/app/(dashboard)/orders/helpers';

// Own fixture ids (contracts.md section 9): e1 = org A, e2 = org B.
const ORG_A = 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1';
const ORG_B = 'e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e2e2';
const OWNER_A = 'e1e1e1e1-0001-4e1e-8e1e-000000000001';
const ACCT_A = 'e1e1e1e1-0002-4e1e-8e1e-000000000002';
const SALES_A = 'e1e1e1e1-0003-4e1e-8e1e-000000000003';
const OPS_A = 'e1e1e1e1-0004-4e1e-8e1e-000000000004';
const OWNER_B = 'e2e2e2e2-0001-4e2e-8e2e-000000000001';
const PROD_A = 'e1e1e1e1-aaaa-4e1e-8e1e-aaaaaaaaaaaa';
const PROD_B = 'e2e2e2e2-aaaa-4e2e-8e2e-aaaaaaaaaaaa';
const PKG_A = 'e1e1e1e1-bbbb-4e1e-8e1e-bbbbbbbbbbbb';
const BUYER_IN = 'e1e1e1e1-cccc-4e1e-8e1e-cccccccccc01';
const BUYER_EX = 'e1e1e1e1-cccc-4e1e-8e1e-cccccccccc02';
const BUYER_B = 'e2e2e2e2-cccc-4e2e-8e2e-cccccccccc01';
const INQ_1 = 'e1e1e1e1-dddd-4e1e-8e1e-dddddddddd01';
const INQ_2 = 'e1e1e1e1-dddd-4e1e-8e1e-dddddddddd02';
const INQ_NEW = 'e1e1e1e1-dddd-4e1e-8e1e-dddddddddd03';
const Q_INR = 'e1e1e1e1-eeee-4e1e-8e1e-eeeeeeeeee01';
const Q_USD = 'e1e1e1e1-eeee-4e1e-8e1e-eeeeeeeeee02';
const Q_CANCEL = 'e1e1e1e1-eeee-4e1e-8e1e-eeeeeeeeee03';
const Q_OPEN = 'e1e1e1e1-eeee-4e1e-8e1e-eeeeeeeeee04';
const Q_WAIT = 'e1e1e1e1-eeee-4e1e-8e1e-eeeeeeeeee05';
const Q_EXPIRED = 'e1e1e1e1-eeee-4e1e-8e1e-eeeeeeeeee06';
const Q_REJECTED = 'e1e1e1e1-eeee-4e1e-8e1e-eeeeeeeeee07';
const Q_B = 'e2e2e2e2-eeee-4e2e-8e2e-eeeeeeeeee01';
const FU_QUOTE = 'e1e1e1e1-ffff-4e1e-8e1e-ffffffffff01';

const ORG_IDS = [ORG_A, ORG_B];
const USER_IDS = [OWNER_A, ACCT_A, SALES_A, OPS_A, OWNER_B];
const ALL_MODULES = [
  'dashboard', 'leads', 'buyers', 'samples', 'quotes', 'orders', 'payments',
  'catalog', 'documents', 'reports', 'users', 'settings', 'audit',
];
const ACCT_MODULES = ['dashboard', 'buyers', 'quotes', 'orders', 'payments', 'catalog', 'settings'];
const SALES_MODULES = ['dashboard', 'leads', 'buyers', 'samples', 'quotes', 'orders', 'catalog'];
const OPS_MODULES = ['dashboard', 'buyers', 'samples', 'orders', 'catalog'];

const DEMO_ORG = '11111111-1111-4111-8111-111111111111';
const DEMO_OWNER = '22222222-2222-4222-8222-222222222221';
const SEED_DIR = path.resolve(__dirname, '..', 'supabase', 'seed');

const num = (v: unknown) => Number(v);

describe('0006 orders, dispatches and payments', () => {
  let client: Client;
  let fy = '';
  let orderA = ''; // INR, Q_INR, 30% advance
  let orderB = ''; // USD, Q_USD, no advance, container
  let orderC = ''; // INR, Q_CANCEL, cancelled
  let orderD = ''; // INR, Q_OPEN, stays confirmed
  let dispatchA = '';
  let dispatchB = '';

  async function cleanup() {
    await resetRole(client);
    for (const table of [
      'payments', 'dispatches', 'order_items', 'orders', 'follow_ups', 'quotation_items', 'quotations',
      'inquiries', 'audit_log', 'buyer_contacts', 'buyers', 'packaging_types', 'products',
      'app_settings', 'business_settings', 'profiles', 'doc_counters', 'entity_code_counters',
    ]) {
      await client.query(`DELETE FROM ${table} WHERE org_id = ANY($1::uuid[])`, [ORG_IDS]);
    }
    await client.query(`DELETE FROM organizations WHERE id = ANY($1::uuid[])`, [ORG_IDS]);
    await client.query(`DELETE FROM auth.users WHERE id = ANY($1::uuid[])`, [USER_IDS]);
  }

  async function asUser(userId: string) {
    await resetRole(client);
    await actAs(client, userId);
  }

  async function quote(id: string, org: string, buyer: string, inquiry: string | null, currency: string, validDays: number, status: string, qtyKg: number, unit: string, rate: number, product = PROD_A) {
    await client.query(
      `INSERT INTO quotations (id, org_id, quote_no, inquiry_id, buyer_id, currency, fx_rate, incoterm, valid_till, payment_terms, status, sent_at)
       VALUES ($1::uuid, $2, 'QTN-T-' || right($1::text, 4), $3, $4, $5, $6, $7, CURRENT_DATE + $8::int, '30% advance, 70% against BL copy', $9, now())`,
      [id, org, inquiry, buyer, currency, currency === 'INR' ? null : 84, currency === 'INR' ? 'EXW' : 'FOB Mundra', validDays, status],
    );
    await client.query(
      `INSERT INTO quotation_items (org_id, quotation_id, product_id, packaging_type_id, qty_kg, unit, rate, spec_text)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'moisture <= 5.5%')`,
      [org, id, product, org === ORG_A ? PKG_A : null, qtyKg, unit, rate],
    );
  }

  beforeAll(async () => {
    client = await connect();
    await applyMigrations(client);
    await cleanup();
    fy = (await client.query('SELECT fn_current_fy() AS fy')).rows[0].fy;

    await client.query(`INSERT INTO organizations (id, name, code) VALUES ($1, 'Orders Org A', 'ORA'), ($2, 'Orders Org B', 'ORB')`, [ORG_A, ORG_B]);
    await client.query(
      `INSERT INTO auth.users (id, email) VALUES ($1, 'owner@ora.test'), ($2, 'acct@ora.test'), ($3, 'sales@ora.test'), ($4, 'ops@ora.test'), ($5, 'owner@orb.test')`,
      USER_IDS,
    );
    await client.query(
      `INSERT INTO profiles (id, org_id, email, full_name, role, modules, is_active) VALUES
         ($1, $6, 'owner@ora.test', 'Owner A', 'owner', $8::text[], true),
         ($2, $6, 'acct@ora.test', 'Accounts A', 'accountant', $9::text[], true),
         ($3, $6, 'sales@ora.test', 'Sales A', 'sales', $10::text[], true),
         ($4, $6, 'ops@ora.test', 'Plant A', 'operations', $11::text[], true),
         ($5, $7, 'owner@orb.test', 'Owner B', 'owner', $8::text[], true)`,
      [OWNER_A, ACCT_A, SALES_A, OPS_A, OWNER_B, ORG_A, ORG_B, ALL_MODULES, ACCT_MODULES, SALES_MODULES, OPS_MODULES],
    );
    await client.query(
      `INSERT INTO app_settings (org_id, settings) VALUES ($1, '{"currency_rates": {"USD": 84}}'::jsonb)`,
      [ORG_A],
    );
    await client.query(
      `INSERT INTO products (id, org_id, code, name, form, color, mesh, gst_rate) VALUES
         ($1, $3, 'OR-P1', 'White Onion Flakes', 'flakes', 'white', '8-15 mm', 5),
         ($2, $4, 'OR-P2', 'Red Onion Powder', 'powder', 'red', NULL, 5)`,
      [PROD_A, PROD_B, ORG_A, ORG_B],
    );
    await client.query(`INSERT INTO packaging_types (id, org_id, name, capacity_kg, tare_weight_kg) VALUES ($1, $2, '25 kg bag', 25, 0.45)`, [PKG_A, ORG_A]);
    await client.query(
      `INSERT INTO buyers (id, org_id, buyer_code, company_name, buyer_type, country, incoterm, preferred_currency, payment_terms, credit_period_days) VALUES
         ($1, $4, 'OR-B1', 'Mumbai Masala', 'domestic_masala', 'India', 'EXW', 'INR', '30% advance', 15),
         ($2, $4, 'OR-B2', 'Dubai Spice', 'export_importer', 'United Arab Emirates', 'FOB', 'USD', '30% advance, 70% against BL copy', 0),
         ($3, $5, 'OR-B3', 'Org B Buyer', 'domestic_masala', 'India', 'EXW', 'INR', '100% advance', 0)`,
      [BUYER_IN, BUYER_EX, BUYER_B, ORG_A, ORG_B],
    );
    await client.query(
      `INSERT INTO inquiries (id, org_id, code, buyer_id, buyer_name, product_id, qty_kg, status) VALUES
         ($1, $4, 'INQ-0001', $5, 'Mumbai Masala', $7, 1000, 'quoted'),
         ($2, $4, 'INQ-0002', $6, 'Dubai Spice', $7, 12000, 'quoted'),
         ($3, $4, 'INQ-0003', NULL, 'Walk-in', $7, 100, 'new')`,
      [INQ_1, INQ_2, INQ_NEW, ORG_A, BUYER_IN, BUYER_EX, PROD_A],
    );

    // Quotes are written as postgres (fixture), items after the header so the totals trigger fills totals.
    await quote(Q_INR, ORG_A, BUYER_IN, INQ_1, 'INR', 5, 'sent', 1000, 'kg', 200); // 2,00,000 + 5% = 2,10,000
    await quote(Q_USD, ORG_A, BUYER_EX, INQ_2, 'USD', 5, 'sent', 12000, 'MT', 2000); // $24,000
    await quote(Q_CANCEL, ORG_A, BUYER_IN, null, 'INR', 5, 'sent', 100, 'kg', 200);
    await quote(Q_OPEN, ORG_A, BUYER_IN, null, 'INR', 5, 'sent', 500, 'kg', 100); // 50,000 + 5% = 52,500
    await quote(Q_WAIT, ORG_A, BUYER_EX, null, 'USD', 3, 'sent', 1000, 'kg', 2);
    await quote(Q_EXPIRED, ORG_A, BUYER_EX, null, 'USD', -1, 'sent', 1000, 'kg', 2);
    await quote(Q_REJECTED, ORG_A, BUYER_EX, null, 'USD', 5, 'rejected', 1000, 'kg', 2);
    await quote(Q_B, ORG_B, BUYER_B, null, 'INR', 5, 'sent', 100, 'kg', 100, PROD_B);

    await client.query(
      `INSERT INTO follow_ups (id, org_id, entity_type, entity_id, buyer_id, note, due_on, done)
       VALUES ($1, $2, 'quote', $3, $4, 'Quote expires tomorrow - call buyer', CURRENT_DATE + 4, false)`,
      [FU_QUOTE, ORG_A, Q_INR, BUYER_IN],
    );
  });

  afterAll(async () => {
    if (client) {
      await cleanup();
      await client.end();
    }
  });

  // ---------------------------------------------------------------- fn_quote_accept
  describe('fn_quote_accept', () => {
    it('owner accepts a sent quote: ORD + PI numbers, items copied, 30% advance, quote accepted, inquiry won, follow-ups', async () => {
      await asUser(OWNER_A);
      const res = await client.query(`SELECT fn_quote_accept($1, CURRENT_DATE + 7, 30) AS id`, [Q_INR]);
      orderA = res.rows[0].id;
      expect(orderA).toMatch(/^[0-9a-f-]{36}$/);

      const o = await client.query(
        `SELECT order_code, pi_no, status, currency, total, advance_expected, quotation_id, inquiry_id, buyer_id,
                incoterm, payment_terms, expected_dispatch = CURRENT_DATE + 7 AS ship_ok, created_by
         FROM orders WHERE id = $1`,
        [orderA],
      );
      expect(o.rows[0]).toMatchObject({
        order_code: 'ORD-0001',
        pi_no: `PI-${fy}-0001`,
        status: 'confirmed',
        currency: 'INR',
        quotation_id: Q_INR,
        inquiry_id: INQ_1,
        buyer_id: BUYER_IN,
        incoterm: 'EXW',
        ship_ok: true,
        created_by: OWNER_A,
      });
      expect(num(o.rows[0].total)).toBe(210000);
      expect(num(o.rows[0].advance_expected)).toBe(63000);
      const sd = await client.query(`SELECT step_dates, to_char(CURRENT_DATE, 'YYYY-MM-DD') AS today FROM orders WHERE id = $1`, [orderA]);
      expect(sd.rows[0].step_dates).toEqual({ confirmed: sd.rows[0].today }); // A7

      const items = await client.query(`SELECT product_id, packaging_type_id, qty_kg, unit, rate, amount, gst_rate, dispatched_kg, spec_text FROM order_items WHERE order_id = $1`, [orderA]);
      expect(items.rows.length).toBe(1);
      expect(items.rows[0]).toMatchObject({ product_id: PROD_A, packaging_type_id: PKG_A, unit: 'kg', spec_text: 'moisture <= 5.5%' });
      expect(num(items.rows[0].qty_kg)).toBe(1000);
      expect(num(items.rows[0].amount)).toBe(200000);
      expect(num(items.rows[0].gst_rate)).toBe(5);
      expect(num(items.rows[0].dispatched_kg)).toBe(0);

      const q = await client.query(`SELECT status, decided_at IS NOT NULL AS decided FROM quotations WHERE id = $1`, [Q_INR]);
      expect(q.rows[0]).toEqual({ status: 'accepted', decided: true });
      const inq = await client.query(`SELECT status, closed_at IS NOT NULL AS closed FROM inquiries WHERE id = $1`, [INQ_1]);
      expect(inq.rows[0]).toEqual({ status: 'won', closed: true });

      const quoteFu = await client.query(`SELECT done FROM follow_ups WHERE id = $1`, [FU_QUOTE]);
      expect(quoteFu.rows[0].done).toBe(true);
      const adv = await client.query(
        `SELECT note, buyer_id, done, due_on = CURRENT_DATE + 3 AS plus3 FROM follow_ups WHERE org_id = $1 AND entity_type = 'payment' AND entity_id = $2`,
        [ORG_A, orderA],
      );
      expect(adv.rows).toEqual([{ note: 'Advance ₹63,000 due - check bank', buyer_id: BUYER_IN, done: false, plus3: true }]);
    });

    it('accepting the same quote again is invalid_transition; rejected -> invalid_transition; expired -> quote_expired', async () => {
      await asUser(OWNER_A);
      await expectDbError(client.query(`SELECT fn_quote_accept($1, NULL, 30)`, [Q_INR]), 'P0001', 'invalid_transition');
      await expectDbError(client.query(`SELECT fn_quote_accept($1, NULL, 30)`, [Q_REJECTED]), 'P0001', 'invalid_transition');
      await expectDbError(client.query(`SELECT fn_quote_accept($1, NULL, 30)`, [Q_EXPIRED]), 'P0001', 'quote_expired');
      await expectDbError(client.query(`SELECT fn_quote_accept($1, NULL, 120)`, [Q_USD]), 'P0001', 'bad_payload');
      const q = await client.query(`SELECT status FROM quotations WHERE id = ANY($1::uuid[]) ORDER BY id`, [[Q_EXPIRED, Q_REJECTED]]);
      expect(q.rows.map((r) => r.status)).toEqual(['sent', 'rejected']);
    });

    it('sales accepts with 0% advance and default ship-by: no advance follow-up; plant cannot accept (42501)', async () => {
      await asUser(OPS_A);
      await expectDbError(client.query(`SELECT fn_quote_accept($1, NULL, 0)`, [Q_USD]), '42501');

      await asUser(SALES_A);
      orderB = (await client.query(`SELECT fn_quote_accept($1, NULL, 0) AS id`, [Q_USD])).rows[0].id;
      const o = await client.query(
        `SELECT order_code, pi_no, currency, total, advance_expected, expected_dispatch = CURRENT_DATE + 21 AS export_default FROM orders WHERE id = $1`,
        [orderB],
      );
      expect(o.rows[0]).toMatchObject({ order_code: 'ORD-0002', pi_no: `PI-${fy}-0002`, currency: 'USD', export_default: true });
      expect(num(o.rows[0].total)).toBe(24000);
      expect(num(o.rows[0].advance_expected)).toBe(0);
      const fu = await client.query(`SELECT count(*)::int AS n FROM follow_ups WHERE entity_type IN ('order', 'payment') AND entity_id = $1`, [orderB]);
      expect(fu.rows[0].n).toBe(0);

      orderC = (await client.query(`SELECT fn_quote_accept($1, NULL, 50) AS id`, [Q_CANCEL])).rows[0].id;
      orderD = (await client.query(`SELECT fn_quote_accept($1, NULL, 0) AS id`, [Q_OPEN])).rows[0].id;
      const d = await client.query(`SELECT expected_dispatch = CURRENT_DATE + 7 AS india_default FROM orders WHERE id = $1`, [orderD]);
      expect(d.rows[0].india_default).toBe(true);
    });
  });

  // ---------------------------------------------------------------- order status
  describe('fn_order_set_status / fn_order_set_packed', () => {
    it('confirmed -> in_production works without the advance (soft guard), backwards and jumps are invalid_transition', async () => {
      await asUser(OPS_A);
      await client.query(`SELECT fn_order_set_status($1, 'in_production')`, [orderA]);
      const o = await client.query(
        `SELECT status, step_dates ->> 'in_production' = to_char(CURRENT_DATE, 'YYYY-MM-DD') AS step_ok FROM orders WHERE id = $1`,
        [orderA],
      );
      expect(o.rows[0]).toEqual({ status: 'in_production', step_ok: true }); // A7

      await expectDbError(client.query(`SELECT fn_order_set_status($1, 'confirmed')`, [orderA]), 'P0001', 'invalid_transition');
      await expectDbError(client.query(`SELECT fn_order_set_status($1, 'dispatched')`, [orderA]), 'P0001', 'invalid_transition');
      await expectDbError(client.query(`SELECT fn_order_set_status($1, 'delivered')`, [orderD]), 'P0001', 'invalid_transition');
      await expectDbError(client.query(`SELECT fn_order_set_status($1, 'shipped')`, [orderA]), 'P0001', 'bad_payload');
    });

    it('fn_order_set_packed: bags must be > 0, stores packed_bags and sets ready; ready -> confirmed raises', async () => {
      await asUser(OPS_A);
      await expectDbError(client.query(`SELECT fn_order_set_packed($1, 0)`, [orderA]), 'P0001', 'bad_payload');
      await expectDbError(client.query(`SELECT fn_order_set_packed($1, 40)`, [orderD]), 'P0001', 'invalid_transition');
      await client.query(`SELECT fn_order_set_packed($1, 40)`, [orderA]);
      const o = await client.query(
        `SELECT status, packed_bags, step_dates ->> 'ready' = to_char(CURRENT_DATE, 'YYYY-MM-DD') AS step_ok FROM orders WHERE id = $1`,
        [orderA],
      );
      expect(o.rows[0]).toEqual({ status: 'ready', packed_bags: 40, step_ok: true }); // A7
      await expectDbError(client.query(`SELECT fn_order_set_status($1, 'confirmed')`, [orderA]), 'P0001', 'invalid_transition');
      await expectDbError(client.query(`SELECT fn_order_set_packed($1, 40)`, [orderA]), 'P0001', 'invalid_transition');
    });

    it('cancel: sales -> 42501 role_not_allowed, owner works and closes the order follow-ups', async () => {
      await asUser(SALES_A);
      await expectDbError(client.query(`SELECT fn_order_set_status($1, 'cancelled')`, [orderC]), '42501', 'role_not_allowed');
      await asUser(OWNER_A);
      await client.query(`SELECT fn_order_set_status($1, 'cancelled')`, [orderC]);
      const o = await client.query(`SELECT status, step_dates FROM orders WHERE id = $1`, [orderC]);
      expect(o.rows[0].status).toBe('cancelled');
      expect(Object.keys(o.rows[0].step_dates)).toEqual(['confirmed']); // A7: only the five step keys
      const fu = await client.query(`SELECT bool_and(done) AS all_done, count(*)::int AS n FROM follow_ups WHERE entity_type IN ('order', 'payment') AND entity_id = $1`, [orderC]);
      expect(fu.rows[0]).toEqual({ all_done: true, n: 1 });
      await expectDbError(client.query(`SELECT fn_order_set_status($1, 'in_production')`, [orderC]), 'P0001', 'invalid_transition');
    });
  });

  // ---------------------------------------------------------------- payments (advance)
  describe('fn_payment_record', () => {
    it('INR advance as accountant: REC number, NULL amount_inr / fx_rate, advance follow-up done, balance Waiting', async () => {
      await asUser(ACCT_A);
      const id = (await client.query(
        `SELECT fn_payment_record($1, 63000, CURRENT_DATE, 'bank', 'NEFT 1', 999, 1.5, '30% advance') AS id`,
        [orderA],
      )).rows[0].id;
      const p = await client.query(`SELECT receipt_no, currency, amount, amount_inr, fx_rate, buyer_id, mode, reference, created_by FROM payments WHERE id = $1`, [id]);
      expect(p.rows[0]).toMatchObject({ receipt_no: `REC-${fy}-0001`, currency: 'INR', amount_inr: null, fx_rate: null, buyer_id: BUYER_IN, mode: 'bank', reference: 'NEFT 1', created_by: ACCT_A });
      expect(num(p.rows[0].amount)).toBe(63000);

      const fu = await client.query(`SELECT done FROM follow_ups WHERE entity_type = 'payment' AND entity_id = $1 AND note LIKE 'Advance %'`, [orderA]);
      expect(fu.rows[0].done).toBe(true);

      const b = await client.query(`SELECT received, due, advance_ok, due_date, money_status FROM v_order_balances WHERE order_id = $1`, [orderA]);
      expect(num(b.rows[0].received)).toBe(63000);
      expect(num(b.rows[0].due)).toBe(147000);
      expect(b.rows[0]).toMatchObject({ advance_ok: true, due_date: null, money_status: 'due' });
    });

    it('rules: amount > 0, mode code, USD needs amount_inr, cancelled order refused, sales lacks payments (42501)', async () => {
      await asUser(ACCT_A);
      await expectDbError(client.query(`SELECT fn_payment_record($1, 0, CURRENT_DATE, 'bank')`, [orderA]), 'P0001', 'bad_payload');
      await expectDbError(client.query(`SELECT fn_payment_record($1, 10, CURRENT_DATE, 'paypal')`, [orderA]), 'P0001', 'bad_payload');
      await expectDbError(client.query(`SELECT fn_payment_record($1, 100, CURRENT_DATE, 'bank')`, [orderB]), 'P0001', 'bad_payload');
      await expectDbError(client.query(`SELECT fn_payment_record($1, 100, CURRENT_DATE, 'bank')`, [orderC]), 'P0001', 'invalid_transition');
      await asUser(SALES_A);
      await expectDbError(client.query(`SELECT fn_payment_record($1, 100, CURRENT_DATE, 'bank')`, [orderA]), '42501', /module payments/);
    });

    it('A8 (SEC2-08): no future date; non-owners max 110% of the due; the owner may record more', async () => {
      // order A: total 2,10,000, received 63,000 -> due 1,47,000; 110% = 1,61,700
      await asUser(ACCT_A);
      const future = await expectDbError(client.query(`SELECT fn_payment_record($1, 100, CURRENT_DATE + 1, 'bank')`, [orderA]), 'P0001', 'bad_payload');
      expect(future.detail).toBe('received_on');
      const over = await expectDbError(client.query(`SELECT fn_payment_record($1, 161700.01, CURRENT_DATE, 'bank')`, [orderA]), 'P0001', 'bad_payload');
      expect(over.detail).toBe('over_payment');
      const usdOver = await expectDbError(client.query(`SELECT fn_payment_record($1, 26400.01, CURRENT_DATE, 'bank', NULL, 2217600)`, [orderB]), 'P0001', 'bad_payload');
      expect(usdOver.detail).toBe('over_payment'); // order currency: $24,000 due -> max $26,400

      await asUser(OWNER_A);
      const ownerFuture = await expectDbError(client.query(`SELECT fn_payment_record($1, 100, CURRENT_DATE + 30, 'bank')`, [orderA]), 'P0001', 'bad_payload');
      expect(ownerFuture.detail).toBe('received_on');

      // Allowed cases run in a rolled-back transaction so the balances below stay as they are.
      await client.query('BEGIN');
      try {
        await asUser(ACCT_A);
        await client.query(`SELECT fn_payment_record($1, 161700, CURRENT_DATE - 1, 'bank')`, [orderA]); // exactly 110%, yesterday
        await asUser(OWNER_A);
        await client.query(`SELECT fn_payment_record($1, 500000, CURRENT_DATE, 'bank')`, [orderA]); // owner over-pays
        const r = await client.query(`SELECT count(*)::int AS n, sum(amount)::numeric AS s FROM payments WHERE order_id = $1`, [orderA]);
        expect(r.rows[0].n).toBe(3);
        expect(num(r.rows[0].s)).toBe(63000 + 161700 + 500000);
      } finally {
        await client.query('ROLLBACK');
      }
      await resetRole(client);
      const after = await client.query(`SELECT count(*)::int AS n FROM payments WHERE order_id = $1`, [orderA]);
      expect(after.rows[0].n).toBe(1);
    });

    it('direct writes to the function-only tables are refused for web sessions', async () => {
      await asUser(OWNER_A);
      await expectDbError(
        client.query(
          `INSERT INTO payments (org_id, receipt_no, order_id, buyer_id, amount, currency, mode) VALUES ($1, 'REC-X', $2, $3, 1, 'INR', 'cash')`,
          [ORG_A, orderA, BUYER_IN],
        ),
        '42501',
        /permission denied/,
      );
      await expectDbError(client.query(`UPDATE orders SET status = 'delivered' WHERE id = $1`, [orderA]), '42501', /permission denied/);
      await expectDbError(client.query(`UPDATE order_items SET dispatched_kg = 1 WHERE order_id = $1`, [orderA]), '42501', /permission denied/);
      await expectDbError(client.query(`DELETE FROM payments WHERE order_id = $1`, [orderA]), '42501', /permission denied/);
      await expectDbError(
        client.query(`INSERT INTO dispatches (org_id, order_id, sdn_no, invoice_no, mode, qty_kg) VALUES ($1, $2, 'S', 'I', 'truck', 1)`, [ORG_A, orderA]),
        '42501',
        /permission denied/,
      );
    });
  });

  // ---------------------------------------------------------------- dispatch
  describe('fn_order_dispatch', () => {
    it('truck: vehicle number and qty are checked; INV + SDN numbers, kg spread, order dispatched, balance follow-up at date + credit days', async () => {
      await asUser(SALES_A);
      await expectDbError(
        client.query(`SELECT fn_order_dispatch($1, 'truck', NULL, NULL, NULL, 40, 1000, NULL, NULL, NULL, NULL, NULL)`, [orderA]),
        'P0001',
        'bad_payload',
      );
      await expectDbError(
        client.query(`SELECT fn_order_dispatch($1, 'truck', 'GJ-04-1', NULL, NULL, 40, 1001, NULL, NULL, NULL, NULL, NULL)`, [orderA]),
        'P0001',
        'bad_payload',
      );
      await expectDbError(
        client.query(`SELECT fn_order_dispatch($1, 'truck', 'GJ-04-1', NULL, NULL, 40, 100, NULL, NULL, NULL, NULL, NULL)`, [orderD]),
        'P0001',
        'invalid_transition',
      );

      dispatchA = (await client.query(
        `SELECT fn_order_dispatch($1, 'truck', ' gj-04-ax-1 ', 'LR/1', 'Mahuva Transport', NULL, 1000, 'IGNORED', 'IGNORED', NULL, NULL, NULL, CURRENT_DATE - 20, 'gate 2') AS id`,
        [orderA],
      )).rows[0].id;
      const d = await client.query(
        `SELECT invoice_no, sdn_no, mode, vehicle_no, lr_no, bags_count, qty_kg, invoice_total, container_no, port, export_checklist, status,
                dispatched_on = CURRENT_DATE - 20 AS on_ok, notes
         FROM dispatches WHERE id = $1`,
        [dispatchA],
      );
      expect(d.rows[0]).toMatchObject({
        invoice_no: `INV-${fy}-0001`,
        sdn_no: `SDN-${fy}-0001`,
        mode: 'truck',
        vehicle_no: 'GJ-04-AX-1',
        lr_no: 'LR/1',
        bags_count: 40, // defaults to packed_bags
        container_no: null,
        port: null,
        export_checklist: {},
        status: 'dispatched',
        on_ok: true,
        notes: 'gate 2',
      });
      expect(num(d.rows[0].qty_kg)).toBe(1000);
      expect(num(d.rows[0].invoice_total)).toBe(210000);

      const o = await client.query(
        `SELECT status, step_dates ->> 'dispatched' = to_char(CURRENT_DATE - 20, 'YYYY-MM-DD') AS step_ok FROM orders WHERE id = $1`,
        [orderA],
      );
      expect(o.rows[0]).toEqual({ status: 'dispatched', step_ok: true }); // A7: the dispatch date, not today
      const it2 = await client.query(`SELECT dispatched_kg FROM order_items WHERE order_id = $1`, [orderA]);
      expect(num(it2.rows[0].dispatched_kg)).toBe(1000);

      const fu = await client.query(
        `SELECT note, done, due_on = CURRENT_DATE - 5 AS due_ok FROM follow_ups WHERE entity_type = 'payment' AND entity_id = $1 AND note LIKE 'Balance %'`,
        [orderA],
      );
      expect(fu.rows).toEqual([{ note: 'Balance ₹1,47,000 due', done: false, due_ok: true }]);

      // 20 days ago + 15 credit days = 5 days late
      const b = await client.query(`SELECT money_status, days_overdue, due_date = CURRENT_DATE - 5 AS due_ok FROM v_order_balances WHERE order_id = $1`, [orderA]);
      expect(b.rows[0]).toEqual({ money_status: 'overdue', days_overdue: 5, due_ok: true });

      await expectDbError(client.query(`SELECT fn_dispatch_tick($1, 'coa', true)`, [dispatchA]), 'P0001', 'bad_payload');
    });

    it('container: container no and port required; checklist with stuffing + invoice ticked, stuffing date = dispatch date', async () => {
      await asUser(SALES_A);
      await client.query(`SELECT fn_order_set_status($1, 'in_production')`, [orderB]);
      await client.query(`SELECT fn_order_set_status($1, 'ready')`, [orderB]);
      await expectDbError(
        client.query(`SELECT fn_order_dispatch($1, 'container', NULL, NULL, NULL, 480, 12000, NULL, 'Mundra', NULL, NULL, NULL)`, [orderB]),
        'P0001',
        'bad_payload',
      );
      await expectDbError(
        client.query(`SELECT fn_order_dispatch($1, 'container', NULL, NULL, NULL, 480, 12000, 'MSKU 1', NULL, NULL, NULL, NULL)`, [orderB]),
        'P0001',
        'bad_payload',
      );
      await expectDbError(
        client.query(`SELECT fn_order_dispatch($1, 'ship', NULL, NULL, NULL, 480, 12000, 'MSKU 1', 'Mundra', NULL, NULL, NULL)`, [orderB]),
        'P0001',
        'bad_payload',
      );

      dispatchB = (await client.query(
        `SELECT fn_order_dispatch($1, 'container', 'IGNORED?', NULL, 'Seabridge', 480, 12000, 'msku 482913-7', 'Mundra', 'MSC Test', NULL, CURRENT_DATE + 18) AS id`,
        [orderB],
      )).rows[0].id;
      const d = await client.query(
        `SELECT invoice_no, sdn_no, mode, container_no, port, vessel, bags_count, invoice_total, export_checklist,
                stuffing_date = CURRENT_DATE AS stuffed_today, eta = CURRENT_DATE + 18 AS eta_ok, to_char(CURRENT_DATE, 'YYYY-MM-DD') AS today
         FROM dispatches WHERE id = $1`,
        [dispatchB],
      );
      const row = d.rows[0];
      expect(row).toMatchObject({
        invoice_no: `INV-${fy}-0002`,
        sdn_no: `SDN-${fy}-0002`,
        mode: 'container',
        container_no: 'MSKU 482913-7',
        port: 'Mundra',
        vessel: 'MSC Test',
        bags_count: 480,
        stuffed_today: true,
        eta_ok: true,
      });
      expect(num(row.invoice_total)).toBe(24000);
      expect(Object.keys(row.export_checklist).sort()).toEqual(
        ['bl_received', 'coa', 'container_booked', 'coo', 'fumigation', 'invoice_packing_list', 'phyto', 'stuffing_done'],
      );
      expect(row.export_checklist.stuffing_done).toEqual({ done: true, date: row.today });
      expect(row.export_checklist.invoice_packing_list).toEqual({ done: true, date: row.today });
      expect(row.export_checklist.coo).toEqual({ done: false, date: null });

      const fu = await client.query(
        `SELECT note, due_on = CURRENT_DATE AS due_today FROM follow_ups WHERE entity_type = 'payment' AND entity_id = $1 AND note LIKE 'Balance %'`,
        [orderB],
      );
      expect(fu.rows).toEqual([{ note: 'Balance $24,000 due', due_today: true }]);
      // 0 credit days, dispatched today: Waiting today, Late from tomorrow
      const b = await client.query(`SELECT money_status, days_overdue FROM v_order_balances WHERE order_id = $1`, [orderB]);
      expect(b.rows[0]).toEqual({ money_status: 'due', days_overdue: 0 });
    });
  });

  // ---------------------------------------------------------------- checklist
  describe('fn_dispatch_tick', () => {
    it('unknown key -> bad_payload; plant may tick only stuffing / COA and never untick; untick only owner / accounts', async () => {
      await asUser(ACCT_A);
      await expectDbError(client.query(`SELECT fn_dispatch_tick($1, 'visa', true)`, [dispatchB]), 'P0001', 'bad_payload');

      await asUser(OPS_A);
      await expectDbError(client.query(`SELECT fn_dispatch_tick($1, 'phyto', true)`, [dispatchB]), '42501', 'role_not_allowed');
      await client.query(`SELECT fn_dispatch_tick($1, 'coa', true, CURRENT_DATE - 1)`, [dispatchB]);
      await expectDbError(client.query(`SELECT fn_dispatch_tick($1, 'coa', false)`, [dispatchB]), '42501', 'role_not_allowed');

      await asUser(SALES_A);
      await client.query(`SELECT fn_dispatch_tick($1, 'phyto', true)`, [dispatchB]);
      await expectDbError(client.query(`SELECT fn_dispatch_tick($1, 'phyto', false)`, [dispatchB]), '42501', 'role_not_allowed');

      await asUser(ACCT_A);
      await client.query(`SELECT fn_dispatch_tick($1, 'phyto', false, NULL)`, [dispatchB]);
      const d = await client.query(
        `SELECT export_checklist -> 'coa' AS coa, export_checklist -> 'phyto' AS phyto, to_char(CURRENT_DATE - 1, 'YYYY-MM-DD') AS yday FROM dispatches WHERE id = $1`,
        [dispatchB],
      );
      expect(d.rows[0].coa).toEqual({ done: true, date: d.rows[0].yday });
      expect(d.rows[0].phyto).toEqual({ done: false, date: null });
    });

    it('bl_received needs the BL number; with it stores bl_no and adds a follow-up due today', async () => {
      await asUser(ACCT_A);
      await expectDbError(client.query(`SELECT fn_dispatch_tick($1, 'bl_received', true, CURRENT_DATE, '  ')`, [dispatchB]), 'P0001', 'bl_required');
      await client.query(`SELECT fn_dispatch_tick($1, 'bl_received', true, CURRENT_DATE, ' MEDU123 ')`, [dispatchB]);
      const d = await client.query(`SELECT bl_no, (export_checklist -> 'bl_received' ->> 'done')::boolean AS done FROM dispatches WHERE id = $1`, [dispatchB]);
      expect(d.rows[0]).toEqual({ bl_no: 'MEDU123', done: true });
      const fu = await client.query(
        `SELECT buyer_id, done, due_on = CURRENT_DATE AS today FROM follow_ups WHERE entity_type = 'payment' AND entity_id = $1 AND note = 'BL received - send copy and ask for balance'`,
        [orderB],
      );
      expect(fu.rows).toEqual([{ buyer_id: BUYER_EX, done: false, today: true }]);
    });
  });

  // ---------------------------------------------------------------- views
  describe('views', () => {
    it('v_orders_in_production lists only open orders with planned bags', async () => {
      await asUser(OPS_A);
      const r = await client.query(`SELECT id, status, planned_bags, bag_kg, qty_kg, product_summary, buyer_name FROM v_orders_in_production`);
      expect(r.rows.length).toBe(1);
      expect(r.rows[0]).toMatchObject({ id: orderD, status: 'confirmed', planned_bags: 20, product_summary: 'White Onion Flakes', buyer_name: 'Mumbai Masala' });
      expect(num(r.rows[0].bag_kg)).toBe(25);
      expect(num(r.rows[0].qty_kg)).toBe(500);
    });

    it('v_home_kpis: one row for the caller org with counts, INR + USD due and the about-INR total', async () => {
      await asUser(OWNER_A);
      const r = await client.query(`SELECT * FROM v_home_kpis`);
      expect(r.rows.length).toBe(1);
      const k = r.rows[0];
      expect(k.org_id).toBe(ORG_A);
      expect(k.new_inquiries).toBe(1);
      expect(k.quotes_waiting).toBe(1); // Q_WAIT; the expired one is not counted
      expect(k.orders_in_production).toBe(1); // order D
      expect(num(k.money_due_inr)).toBe(147000 + 52500); // order A balance + order D
      expect(num(k.money_due_usd)).toBe(24000);
      expect(num(k.money_due_about_inr)).toBe(199500 + 24000 * 84);
      expect(k.money_overdue_count).toBe(1); // order A
      expect(k.papers_pending).toBe(1); // container B, 4 of 8 done
      await resetRole(client);
      const due = await client.query(`SELECT count(*)::int AS n FROM follow_ups WHERE org_id = $1 AND done = false AND due_on <= CURRENT_DATE`, [ORG_A]);
      expect(k.followups_today).toBe(due.rows[0].n);

      await asUser(OWNER_A);
      const m = await client.query(`SELECT buyer_id, currency, total_due, orders_due, money_status, max_days_overdue FROM v_money_due ORDER BY currency`);
      expect(m.rows.map((x) => [x.buyer_id, x.currency, num(x.total_due), x.orders_due, x.money_status, x.max_days_overdue])).toEqual([
        [BUYER_IN, 'INR', 199500, 2, 'overdue', 5],
        [BUYER_EX, 'USD', 24000, 1, 'due', 0],
      ]);
      const cancelled = await client.query(`SELECT count(*)::int AS n FROM v_order_balances WHERE order_id = $1`, [orderC]);
      expect(cancelled.rows[0].n).toBe(0);
    });

    it('A6 (SEC2-10): Plant reads no money - payments 0 rows, balance views empty, Home money 0; owner unchanged', async () => {
      await asUser(OPS_A);
      for (const rel of ['payments', 'v_order_balances', 'v_money_due']) {
        const r = await client.query(`SELECT count(*)::int AS n FROM ${rel}`);
        expect(r.rows[0].n, rel).toBe(0);
      }
      const k = (await client.query(`SELECT * FROM v_home_kpis`)).rows;
      expect(k.length).toBe(1);
      expect([num(k[0].money_due_inr), num(k[0].money_due_usd), num(k[0].money_due_about_inr), k[0].money_overdue_count]).toEqual([0, 0, 0, 0]);
      expect(k[0].orders_in_production).toBe(1); // the non-money numbers stay
      // Plant still sees orders and the packing list
      const o = await client.query(`SELECT count(*)::int AS n FROM orders`);
      expect(o.rows[0].n).toBe(4);

      // The packing card guard: yes / no only, own org, orders module
      const w = async (id: string) => (await client.query(`SELECT fn_order_advance_waiting($1) AS w`, [id])).rows[0].w;
      expect(await w(orderA)).toBe(false); // 30% advance received
      expect(await w(orderD)).toBe(false); // no advance asked
      expect(await w(orderC)).toBe(true); // 50% advance, nothing received
      await asUser(OWNER_B);
      await expectDbError(client.query(`SELECT fn_order_advance_waiting($1)`, [orderA]), '42501', 'not_found');

      await asUser(OWNER_A);
      expect((await client.query(`SELECT count(*)::int AS n FROM payments`)).rows[0].n).toBe(1);
      expect((await client.query(`SELECT count(*)::int AS n FROM v_order_balances`)).rows[0].n).toBe(3);
      expect((await client.query(`SELECT count(*)::int AS n FROM v_money_due`)).rows[0].n).toBe(2);
      expect(num((await client.query(`SELECT money_due_inr FROM v_home_kpis`)).rows[0].money_due_inr)).toBe(199500);
      await asUser(SALES_A);
      expect((await client.query(`SELECT count(*)::int AS n FROM payments`)).rows[0].n).toBe(1); // sales still sees balances
    });

    it('USD receipt keeps the rupee value and rate; paying the INR balance makes the order Paid and closes its follow-ups', async () => {
      await asUser(ACCT_A);
      const usd = (await client.query(`SELECT fn_payment_record($1, 5000, CURRENT_DATE, 'bank', 'TT 1', 421000) AS id`, [orderB])).rows[0].id;
      const p = await client.query(`SELECT receipt_no, currency, amount_inr, fx_rate FROM payments WHERE id = $1`, [usd]);
      expect(p.rows[0].receipt_no).toBe(`REC-${fy}-0002`);
      expect(p.rows[0].currency).toBe('USD');
      expect(num(p.rows[0].amount_inr)).toBe(421000);
      expect(num(p.rows[0].fx_rate)).toBe(84.2);

      await client.query(`SELECT fn_payment_record($1, 147000, CURRENT_DATE, 'upi')`, [orderA]);
      const b = await client.query(`SELECT order_id, due, money_status, days_overdue FROM v_order_balances WHERE order_id = ANY($1::uuid[]) ORDER BY total`, [[orderA, orderB]]);
      const byId = Object.fromEntries(b.rows.map((x) => [x.order_id, x]));
      expect(byId[orderA]).toMatchObject({ money_status: 'paid', days_overdue: 0 });
      expect(num(byId[orderA].due)).toBe(0);
      expect(byId[orderB].money_status).toBe('due');
      expect(num(byId[orderB].due)).toBe(19000);
      const open = await client.query(`SELECT count(*)::int AS n FROM follow_ups WHERE entity_type IN ('order', 'payment') AND entity_id = $1 AND done = false`, [orderA]);
      expect(open.rows[0].n).toBe(0);
    });
  });

  // ---------------------------------------------------------------- delivered
  describe('fn_dispatch_delivered', () => {
    it('plant -> 42501; accountant marks delivered and the fully dispatched order becomes delivered', async () => {
      await asUser(OPS_A);
      await expectDbError(client.query(`SELECT fn_dispatch_delivered($1)`, [dispatchA]), '42501', 'role_not_allowed');
      await asUser(ACCT_A);
      await client.query(`SELECT fn_dispatch_delivered($1, CURRENT_DATE - 18)`, [dispatchA]);
      const d = await client.query(`SELECT status, delivered_on = CURRENT_DATE - 18 AS on_ok FROM dispatches WHERE id = $1`, [dispatchA]);
      expect(d.rows[0]).toEqual({ status: 'delivered', on_ok: true });
      const o = await client.query(
        `SELECT status, step_dates ->> 'delivered' = to_char(CURRENT_DATE - 18, 'YYYY-MM-DD') AS step_ok, step_dates FROM orders WHERE id = $1`,
        [orderA],
      );
      expect(o.rows[0]).toMatchObject({ status: 'delivered', step_ok: true });
      expect(Object.keys(o.rows[0].step_dates).sort()).toEqual(['confirmed', 'delivered', 'dispatched', 'in_production', 'ready']); // A7
      await expectDbError(client.query(`SELECT fn_dispatch_delivered($1)`, [dispatchA]), 'P0001', 'invalid_transition');
    });
  });

  // ---------------------------------------------------------------- walls
  describe('missing module and cross-tenant', () => {
    it('plant has no payments / quotes module -> 42501', async () => {
      await asUser(OPS_A);
      await expectDbError(client.query(`SELECT fn_payment_record($1, 1, CURRENT_DATE, 'cash')`, [orderB]), '42501');
      await expectDbError(client.query(`SELECT fn_quote_accept($1, NULL, 0)`, [Q_WAIT]), '42501');
    });

    it('owner of org B sees 0 rows of org A and every function on A ids is 42501 (not_found)', async () => {
      await asUser(OWNER_B);
      for (const table of ['orders', 'order_items', 'dispatches', 'payments', 'v_order_balances', 'v_money_due', 'v_orders_in_production']) {
        const r = await client.query(`SELECT count(*)::int AS n FROM ${table} WHERE org_id = $1`, [ORG_A]);
        expect(r.rows[0].n, table).toBe(0);
      }
      const k = await client.query(`SELECT org_id, orders_in_production FROM v_home_kpis`);
      expect(k.rows).toEqual([{ org_id: ORG_B, orders_in_production: 0 }]);

      await expectDbError(client.query(`SELECT fn_quote_accept($1, NULL, 0)`, [Q_WAIT]), '42501', 'not_found');
      await expectDbError(client.query(`SELECT fn_order_set_status($1, 'in_production')`, [orderD]), '42501', 'not_found');
      await expectDbError(client.query(`SELECT fn_order_set_packed($1, 5)`, [orderD]), '42501', 'not_found');
      await expectDbError(
        client.query(`SELECT fn_order_dispatch($1, 'truck', 'X', NULL, NULL, 1, 1, NULL, NULL, NULL, NULL, NULL)`, [orderD]),
        '42501',
        'not_found',
      );
      await expectDbError(client.query(`SELECT fn_dispatch_tick($1, 'coo', true)`, [dispatchB]), '42501', 'not_found');
      await expectDbError(client.query(`SELECT fn_dispatch_delivered($1)`, [dispatchB]), '42501', 'not_found');
      await expectDbError(client.query(`SELECT fn_payment_record($1, 1, CURRENT_DATE, 'cash')`, [orderD]), '42501', 'not_found');

      // B's own quote still works for B and numbers start at B's own counters
      const own = (await client.query(`SELECT fn_quote_accept($1, NULL, 100) AS id`, [Q_B])).rows[0].id;
      const o = await client.query(`SELECT order_code, pi_no, org_id FROM orders WHERE id = $1`, [own]);
      expect(o.rows[0]).toEqual({ order_code: 'ORD-0001', pi_no: `PI-${fy}-0001`, org_id: ORG_B });
    });
  });

  // ---------------------------------------------------------------- demo seed
  describe('demo seed (sample-data.md section 10)', () => {
    it('v_home_kpis as the demo owner shows the acceptance numbers after a fresh seed (rolled back)', async (ctx) => {
      await resetRole(client);
      const seeded = await client.query(`SELECT count(*)::int AS n FROM orders WHERE id = '99999999-9999-4999-8999-999999999902'`);
      const extra = await client.query(
        `SELECT (SELECT count(*) FROM orders WHERE org_id = $1 AND id::text NOT LIKE '99999999-9999-4999-8999-9999999999%')
              + (SELECT count(*) FROM inquiries WHERE org_id = $1 AND code > 'INQ-0010')
              + (SELECT count(*) FROM quotations WHERE org_id = $1 AND quote_no > 'QTN-2627-0004') AS n`,
        [DEMO_ORG],
      );
      if (seeded.rows[0].n === 0 || Number(extra.rows[0].n) > 0) {
        ctx.skip(); // demo org not seeded, or a demo run added rows: the acceptance numbers do not apply
        return;
      }
      await client.query('BEGIN');
      try {
        for (const file of ['02_inquiries.sql', '03_samples_quotes.sql', '04_orders_money.sql']) {
          await client.query(fs.readFileSync(path.join(SEED_DIR, file), 'utf-8'));
        }
        await actAs(client, DEMO_OWNER);
        const r = await client.query(`SELECT * FROM v_home_kpis`);
        expect(r.rows.length).toBe(1);
        const k = r.rows[0];
        expect([k.new_inquiries, k.quotes_waiting, k.orders_in_production, k.money_overdue_count, k.papers_pending]).toEqual([2, 1, 1, 1, 1]);
        expect(num(k.money_due_inr)).toBe(511875);
        expect(num(k.money_due_usd)).toBe(18900);
        expect(num(k.money_due_about_inr)).toBe(2104200);
        const b = await client.query(`SELECT order_code, money_status, days_overdue FROM v_order_balances ORDER BY order_code`);
        expect(b.rows).toEqual([
          { order_code: 'ORD-0001', money_status: 'paid', days_overdue: 0 },
          { order_code: 'ORD-0002', money_status: 'overdue', days_overdue: 6 },
          { order_code: 'ORD-0003', money_status: 'due', days_overdue: 0 },
        ]);
        // A7: step dates from sample-data.md section 4 (T-n)
        const sd = await client.query(
          `SELECT order_code, (SELECT jsonb_object_agg(key, CURRENT_DATE - value::date) FROM jsonb_each_text(step_dates)) AS ago
           FROM orders ORDER BY order_code`,
        );
        expect(sd.rows).toEqual([
          { order_code: 'ORD-0001', ago: { confirmed: 46, in_production: 45, ready: 41, dispatched: 40, delivered: 38 } },
          { order_code: 'ORD-0002', ago: { confirmed: 27, in_production: 22, ready: 9, dispatched: 6 } },
          { order_code: 'ORD-0003', ago: { confirmed: 10, in_production: 2 } },
        ]);
        // A6: the demo Plant user sees the counts but no money
        await resetRole(client);
        await actAs(client, '22222222-2222-4222-8222-222222222224');
        const pk = (await client.query(`SELECT orders_in_production, money_due_inr, money_due_usd, money_overdue_count FROM v_home_kpis`)).rows[0];
        expect([pk.orders_in_production, num(pk.money_due_inr), num(pk.money_due_usd), pk.money_overdue_count]).toEqual([1, 0, 0, 0]);
        expect((await client.query(`SELECT count(*)::int AS n FROM payments`)).rows[0].n).toBe(0);
      } finally {
        await client.query('ROLLBACK');
        await resetRole(client);
      }
    });
  });
});

describe('order helpers (pure)', () => {
  it('financial year, next document number, planned bags, checklist count', () => {
    expect(fyOf(new Date(2026, 10, 16))).toBe('2627');
    expect(fyOf(new Date(2027, 2, 31))).toBe('2627');
    expect(fyOf(new Date(2027, 3, 1))).toBe('2728');
    expect(nextDocNo('INV', '2627', 2)).toBe('INV-2627-0003');
    expect(nextDocNo('SDN', '2627', null)).toBe('SDN-2627-0001');
    expect(plannedBags(5000, 25)).toBe(200);
    expect(plannedBags(1010, null)).toBe(41);
    expect(checklistDoneCount({ coa: { done: true, date: '2026-11-01' }, coo: { done: false, date: null } })).toBe(1);
    expect(checklistDoneCount({})).toBe(0);
  });

  it('words: product short name, port default, label text, export buyers get English', () => {
    expect(productShort('en', { form: 'minced', color: 'white', mesh: '1-3 mm' })).toBe('White Minced 1-3 mm');
    expect(defaultPort('FOB Pipavav')).toBe('Pipavav');
    expect(defaultPort('CIF')).toBe('Mundra');
    expect(composeLabel({ buyer: 'Haldiram', product: 'White Minced', bagKg: 25, company: 'Mahuva Dehydro Foods' })).toEqual([
      'Haldiram',
      'White Minced · Net 25 kg',
      'Mahuva Dehydro Foods, India',
    ]);
    expect(waLang('gu', true)).toBe('en');
    expect(waLang('gu', false)).toBe('gu');
    const text = reminderText('en', { buyer: 'Tariq', due: 18900, currency: 'USD', orderCode: 'ORD-0002', invoiceNo: 'INV-2627-0002', piNo: 'PI-2627-0002', dueDate: '2026-11-10', company: 'Mahuva Dehydro Foods' });
    expect(text).toContain('$18,900');
    expect(text).toContain('ORD-0002');
    expect(text).toContain('INV-2627-0002');
    expect(text).not.toMatch(/\{\w+\}/);
  });

  it('G2-06: the dispatched WhatsApp text carries the dispatch date in en and gu', () => {
    const d = { buyer: 'Tariq', orderCode: 'ORD-0002', invoiceNo: 'INV-2627-0002', dispatchedOn: '2026-11-10', mode: 'truck', vehicleNo: 'GJ-04-AX-7712', qtyKg: 3000, bags: 120, company: 'Mahuva Dehydro Foods' };
    for (const lang of ['en', 'gu'] as const) {
      const text = dispatchedText(lang, d);
      expect(text, lang).toContain('10 Nov 2026');
      expect(text, lang).not.toMatch(/\{\w+\}/);
    }
    expect(dispatchedText('en', d)).not.toContain('today');
  });

  it('G2-10: Money received prefills the rest of the advance while it is waiting, else the due', () => {
    // ORD-0004 in the demo: total $28,560, advance $8,568, nothing received
    expect(prefillAmount({ due: 28560, advance_expected: 8568, received: 0, advance_ok: false })).toEqual({ amount: 8568, advance: true });
    // part of the advance came: only the rest
    expect(prefillAmount({ due: 26560, advance_expected: 8568, received: 2000, advance_ok: false })).toEqual({ amount: 6568, advance: true });
    // advance OK or no advance: the whole due
    expect(prefillAmount({ due: 18900, advance_expected: 8100, received: 8100, advance_ok: true })).toEqual({ amount: 18900, advance: false });
    expect(prefillAmount({ due: 52500, advance_expected: 0, received: 0, advance_ok: true })).toEqual({ amount: 52500, advance: false });
    // 100% advance: the advance is the due, no hint needed
    expect(prefillAmount({ due: 1000, advance_expected: 1000, received: 0, advance_ok: false })).toEqual({ amount: 1000, advance: false });
  });

  it('export vs India: buyer type decides, country rule matches quotes when there is no type (G2-04)', () => {
    // The G2-04 buyer: '+ New buyer' from an inquiry with a +971 phone, saved before the country fix
    expect(isExportBuyer({ buyer_type: 'export_importer', country: '' })).toBe(true);
    expect(isExportBuyer({ buyer_type: 'export_agent', country: 'Germany' })).toBe(true);
    expect(isExportBuyer({ buyer_type: 'domestic_masala', country: 'India' })).toBe(false);
    expect(isExportBuyer({ buyer_type: 'domestic_food_mfr', country: 'India' })).toBe(false);
    // No type: contracts 6.3 `country <> 'India'`, the same answers as quotes/helpers.ts isExportBuyer
    expect(isExportBuyer({ country: '' })).toBe(true);
    expect(isExportBuyer({ country: 'United Arab Emirates' })).toBe(true);
    expect(isExportBuyer({ country: ' india ' })).toBe(false);
    expect(isExportBuyer({ country: null })).toBe(false);
    expect(isExportBuyer({ buyer_type: null })).toBe(false);
  });
});

describe('seeded buyers read as export / India the same way in orders and quotes (G2-04)', () => {
  let db: Client;
  beforeAll(async () => {
    db = await connect();
  });
  afterAll(async () => {
    await db.end();
  });

  it('demo org buyers: the type-based rule gives the same answer as the country rule', async () => {
    const { rows } = await db.query<{ buyer_type: string; country: string }>(
      `SELECT buyer_type, country FROM buyers WHERE org_id = '11111111-1111-4111-8111-111111111111'`
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      const byCountry = (r.country ?? 'India').trim().toLowerCase() !== 'india';
      expect(isExportBuyer(r), `${r.buyer_type} / ${r.country}`).toBe(byCountry);
      expect(isExportBuyer(r)).toBe(r.buyer_type.startsWith('export_'));
    }
  });
});
