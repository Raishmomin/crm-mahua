import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Client } from 'pg';
import { connect, applyMigrations, actAs, resetRole, expectDbError } from './helpers/db';
import {
  advancePctFromTerms,
  defaultCurrency,
  isExportBuyer,
  matchPaymentTerms,
  pricedCurrencies,
  quoteDisplayStatus,
  quoteErrorText,
} from '../src/app/(dashboard)/quotes/helpers';
import { isExportBuyer as isExportOrderBuyer } from '../src/app/(dashboard)/orders/helpers';

// Own fixture ids (contracts.md section 9): d1 = org A, d2 = org B.
const ORG_A = 'd1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1';
const ORG_B = 'd2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2';
const OWNER_A = 'd1d1d1d1-0001-4d1d-8d1d-000000000001';
const SALES_A = 'd1d1d1d1-0002-4d1d-8d1d-000000000002';
const OPS_A = 'd1d1d1d1-0003-4d1d-8d1d-000000000003';
const OWNER_B = 'd2d2d2d2-0001-4d2d-8d2d-000000000001';
const PROD_A = 'd1d1d1d1-aaaa-4d1d-8d1d-aaaaaaaaaaaa';
const PROD_B = 'd2d2d2d2-aaaa-4d2d-8d2d-aaaaaaaaaaaa';
const PKG_A = 'd1d1d1d1-bbbb-4d1d-8d1d-bbbbbbbbbbbb';
const PKG_B = 'd2d2d2d2-bbbb-4d2d-8d2d-bbbbbbbbbbbb';
const BUYER_IN = 'd1d1d1d1-cccc-4d1d-8d1d-cccccccccc01';
const BUYER_EX = 'd1d1d1d1-cccc-4d1d-8d1d-cccccccccc02';
const BUYER_B = 'd2d2d2d2-cccc-4d2d-8d2d-cccccccccc01';
const INQ_SAMPLE = 'd1d1d1d1-dddd-4d1d-8d1d-dddddddddd01';
const INQ_QUOTE = 'd1d1d1d1-dddd-4d1d-8d1d-dddddddddd02';
const INQ_WON = 'd1d1d1d1-dddd-4d1d-8d1d-dddddddddd03';
const INQ_B = 'd2d2d2d2-dddd-4d2d-8d2d-dddddddddd01';

const ORG_IDS = [ORG_A, ORG_B];
const USER_IDS = [OWNER_A, SALES_A, OPS_A, OWNER_B];
const ALL_MODULES = [
  'dashboard', 'leads', 'buyers', 'samples', 'quotes', 'orders', 'payments',
  'catalog', 'documents', 'reports', 'users', 'settings', 'audit',
];
const SALES_MODULES = ['dashboard', 'leads', 'buyers', 'samples', 'quotes', 'orders', 'catalog'];
const OPS_MODULES = ['dashboard', 'buyers', 'samples', 'orders', 'catalog'];

describe('0005 samples and quotations', () => {
  let client: Client;
  let fy = '';

  async function cleanup() {
    await resetRole(client);
    for (const table of [
      'follow_ups', 'quotation_items', 'quotations', 'samples', 'inquiries', 'audit_log',
      'price_list_items', 'buyer_contacts', 'buyers', 'packaging_types', 'products',
      'app_settings', 'business_settings', 'profiles', 'doc_counters', 'entity_code_counters',
    ]) {
      await client.query(`DELETE FROM ${table} WHERE org_id = ANY($1::uuid[])`, [ORG_IDS]);
    }
    await client.query(`DELETE FROM organizations WHERE id = ANY($1::uuid[])`, [ORG_IDS]);
    await client.query(`DELETE FROM auth.users WHERE id = ANY($1::uuid[])`, [USER_IDS]);
  }

  beforeAll(async () => {
    client = await connect();
    await applyMigrations(client);
    await cleanup();
    fy = (await client.query('SELECT fn_current_fy() AS fy')).rows[0].fy;

    await client.query(`INSERT INTO organizations (id, name, code) VALUES ($1, 'Quote Org A', 'QTA'), ($2, 'Quote Org B', 'QTB')`, [ORG_A, ORG_B]);
    await client.query(
      `INSERT INTO auth.users (id, email) VALUES ($1, 'owner@qta.test'), ($2, 'sales@qta.test'), ($3, 'ops@qta.test'), ($4, 'owner@qtb.test')`,
      USER_IDS,
    );
    await client.query(
      `INSERT INTO profiles (id, org_id, email, full_name, role, modules, is_active) VALUES
         ($1, $5, 'owner@qta.test', 'Owner A', 'owner', $7::text[], true),
         ($2, $5, 'sales@qta.test', 'Sales A', 'sales', $8::text[], true),
         ($3, $5, 'ops@qta.test', 'Plant A', 'operations', $9::text[], true),
         ($4, $6, 'owner@qtb.test', 'Owner B', 'owner', $7::text[], true)`,
      [OWNER_A, SALES_A, OPS_A, OWNER_B, ORG_A, ORG_B, ALL_MODULES, SALES_MODULES, OPS_MODULES],
    );
    await client.query(
      `INSERT INTO products (id, org_id, code, name, form, color, mesh, gst_rate) VALUES
         ($1, $3, 'QT-P1', 'White Onion Flakes', 'flakes', 'white', '8-15 mm', 5),
         ($2, $4, 'QT-P2', 'Red Onion Powder', 'powder', 'red', NULL, 5)`,
      [PROD_A, PROD_B, ORG_A, ORG_B],
    );
    await client.query(
      `INSERT INTO packaging_types (id, org_id, name, capacity_kg) VALUES ($1, $2, '25 kg bag', 25), ($3, $4, '20 kg bag', 20)`,
      [PKG_A, ORG_A, PKG_B, ORG_B],
    );
    await client.query(
      `INSERT INTO price_list_items (org_id, product_id, tier_name, currency, unit, rate, floor_price) VALUES
         ($1, $2, 'Domestic', 'INR', 'kg', 185, 165),
         ($1, $2, 'Export', 'USD', 'MT', 2250, 2050)`,
      [ORG_A, PROD_A],
    );
    await client.query(
      `INSERT INTO buyers (id, org_id, buyer_code, company_name, buyer_type, country, incoterm, preferred_currency, payment_terms) VALUES
         ($1, $4, 'QT-B1', 'Mumbai Masala', 'domestic_masala', 'India', 'EXW', 'INR', '30 days credit'),
         ($2, $4, 'QT-B2', 'Dubai Spice', 'export_importer', 'United Arab Emirates', 'FOB', 'USD', '30% advance, 70% against BL copy'),
         ($3, $5, 'QT-B3', 'Org B Buyer', 'domestic_masala', 'India', 'EXW', 'INR', '100% advance')`,
      [BUYER_IN, BUYER_EX, BUYER_B, ORG_A, ORG_B],
    );
    await client.query(
      `INSERT INTO inquiries (id, org_id, code, buyer_id, buyer_name, product_id, qty_kg, status) VALUES
         ($1, $5, 'INQ-0001', $7, 'Mumbai Masala', $9, 500, 'new'),
         ($2, $5, 'INQ-0002', $8, 'Dubai Spice', $9, 12000, 'talking'),
         ($3, $5, 'INQ-0003', $7, 'Mumbai Masala', $9, 1000, 'won'),
         ($4, $6, 'INQ-0001', $10, 'Org B Buyer', $11, 100, 'new')`,
      [INQ_SAMPLE, INQ_QUOTE, INQ_WON, INQ_B, ORG_A, ORG_B, BUYER_IN, BUYER_EX, PROD_A, BUYER_B, PROD_B],
    );
  });

  afterAll(async () => {
    if (client) {
      await cleanup();
      await client.end();
    }
  });

  // ---------------------------------------------------------------- samples
  describe('samples', () => {
    let sampleId = '';

    it('insert as sales gets SMP-0001 from the trigger; to_send -> sent sets sent_on, inquiry -> sample_sent, follow-up +7', async () => {
      await actAs(client, SALES_A);
      const ins = await client.query(
        `INSERT INTO samples (org_id, inquiry_id, buyer_id, product_id, qty_grams, courier) VALUES ($1, $2, $3, $4, 500, 'DHL') RETURNING id, code, status`,
        [ORG_A, INQ_SAMPLE, BUYER_IN, PROD_A],
      );
      sampleId = ins.rows[0].id;
      expect(ins.rows[0].code).toBe('SMP-0001');
      expect(ins.rows[0].status).toBe('to_send');

      // status column is locked for direct writes (column grant)
      await expectDbError(client.query(`UPDATE samples SET status = 'sent' WHERE id = $1`, [sampleId]), '42501');

      await client.query(`SELECT fn_sample_set_status($1, 'sent')`, [sampleId]);
      const row = await client.query(`SELECT status, sent_on FROM samples WHERE id = $1`, [sampleId]);
      expect(row.rows[0].status).toBe('sent');
      expect(row.rows[0].sent_on).toBeInstanceOf(Date);

      const inq = await client.query(`SELECT status FROM inquiries WHERE id = $1`, [INQ_SAMPLE]);
      expect(inq.rows[0].status).toBe('sample_sent');

      const fu = await client.query(
        `SELECT entity_type, entity_id, buyer_id, note, done, due_on = CURRENT_DATE + 7 AS plus7, created_by
         FROM follow_ups WHERE org_id = $1 AND entity_type = 'inquiry' AND entity_id = $2`,
        [ORG_A, INQ_SAMPLE],
      );
      expect(fu.rows.length).toBe(1);
      expect(fu.rows[0]).toMatchObject({ buyer_id: BUYER_IN, note: 'Sample SMP-0001 sent, ask for result', done: false, plus7: true, created_by: SALES_A });
      await resetRole(client);
    });

    it('approved stores the reply and decided_on and marks the sample follow-up done; further changes are invalid_transition', async () => {
      await actAs(client, SALES_A);
      await expectDbError(client.query(`SELECT fn_sample_set_status($1, 'sent')`, [sampleId]), 'P0001', 'invalid_transition');
      await client.query(`SELECT fn_sample_set_status($1, 'approved', 'Colour OK')`, [sampleId]);
      const row = await client.query(`SELECT status, result_note, decided_on = CURRENT_DATE AS today FROM samples WHERE id = $1`, [sampleId]);
      expect(row.rows[0]).toEqual({ status: 'approved', result_note: 'Colour OK', today: true });
      const fu = await client.query(`SELECT done, done_by FROM follow_ups WHERE org_id = $1 AND entity_type = 'inquiry' AND entity_id = $2`, [ORG_A, INQ_SAMPLE]);
      expect(fu.rows[0]).toEqual({ done: true, done_by: SALES_A });
      await expectDbError(client.query(`SELECT fn_sample_set_status($1, 'rejected')`, [sampleId]), 'P0001', 'invalid_transition');
      await expectDbError(client.query(`SELECT fn_sample_set_status($1, 'to_send')`, [sampleId]), 'P0001', 'bad_payload');
      await resetRole(client);
    });

    it('plant (samples module, no inquiry) marks sent and gets a buyer follow-up', async () => {
      await actAs(client, OPS_A);
      const ins = await client.query(`INSERT INTO samples (org_id, buyer_id, product_id) VALUES ($1, $2, $3) RETURNING id, code, qty_grams`, [ORG_A, BUYER_EX, PROD_A]);
      expect(ins.rows[0].code).toBe('SMP-0002');
      expect(ins.rows[0].qty_grams).toBe(500);
      await client.query(`SELECT fn_sample_set_status($1, 'sent')`, [ins.rows[0].id]);
      const fu = await client.query(`SELECT entity_type, entity_id, buyer_id FROM follow_ups WHERE org_id = $1 AND note = 'Sample SMP-0002 sent, ask for result'`, [ORG_A]);
      expect(fu.rows).toEqual([{ entity_type: 'buyer', entity_id: BUYER_EX, buyer_id: BUYER_EX }]);
      await resetRole(client);
    });
  });

  // -------------------------------------------------------------- quotations
  describe('quotations', () => {
    let inrQuote = '';
    let usdQuote = '';

    it('draft insert as sales gets QTN-<fy>-0001; items compute amount, gst (INR 5% / USD 0) and the parent totals', async () => {
      await actAs(client, SALES_A);
      const q1 = await client.query(
        `INSERT INTO quotations (org_id, inquiry_id, buyer_id, currency, incoterm, valid_till, payment_terms)
         VALUES ($1, $2, $3, 'INR', 'EXW', CURRENT_DATE + 10, '30 days credit') RETURNING id, quote_no, status, subtotal`,
        [ORG_A, INQ_QUOTE, BUYER_IN],
      );
      inrQuote = q1.rows[0].id;
      expect(q1.rows[0].quote_no).toBe(`QTN-${fy}-0001`);
      expect(q1.rows[0].quote_no).toMatch(/^QTN-\d{4}-\d{4}$/);
      expect(q1.rows[0].status).toBe('draft');

      const item = await client.query(
        `INSERT INTO quotation_items (org_id, quotation_id, product_id, packaging_type_id, qty_kg, unit, rate)
         VALUES ($1, $2, $3, $4, 1500, 'kg', 185) RETURNING amount, gst_rate, floor_price_at_time`,
        [ORG_A, inrQuote, PROD_A, PKG_A],
      );
      expect(item.rows[0]).toEqual({ amount: '277500.00', gst_rate: '5.00', floor_price_at_time: '165.00' });
      const totals = await client.query(`SELECT subtotal, gst_amount, total FROM quotations WHERE id = $1`, [inrQuote]);
      expect(totals.rows[0]).toEqual({ subtotal: '277500.00', gst_amount: '13875.00', total: '291375.00' });

      const q2 = await client.query(
        `INSERT INTO quotations (org_id, buyer_id, currency, fx_rate, incoterm, valid_till, payment_terms)
         VALUES ($1, $2, 'USD', 84.25, 'FOB Pipavav', CURRENT_DATE + 10, '30% advance, 70% against BL copy') RETURNING id, quote_no`,
        [ORG_A, BUYER_EX],
      );
      usdQuote = q2.rows[0].id;
      expect(q2.rows[0].quote_no).toBe(`QTN-${fy}-0002`);
      const usdItem = await client.query(
        `INSERT INTO quotation_items (org_id, quotation_id, product_id, qty_kg, unit, rate) VALUES ($1, $2, $3, 12000, 'MT', 2250)
         RETURNING amount, gst_rate, floor_price_at_time`,
        [ORG_A, usdQuote, PROD_A],
      );
      expect(usdItem.rows[0]).toEqual({ amount: '27000.00', gst_rate: '0.00', floor_price_at_time: '2050.00' });
      const usdTotals = await client.query(`SELECT subtotal, gst_amount, total FROM quotations WHERE id = $1`, [usdQuote]);
      expect(usdTotals.rows[0]).toEqual({ subtotal: '27000.00', gst_amount: '0.00', total: '27000.00' });

      // a second item adds up; deleting it takes the totals back down
      const extra = await client.query(
        `INSERT INTO quotation_items (org_id, quotation_id, product_id, qty_kg, unit, rate, sort_order) VALUES ($1, $2, $3, 1000, 'kg', 2.3, 2) RETURNING id`,
        [ORG_A, usdQuote, PROD_A],
      );
      expect((await client.query(`SELECT total FROM quotations WHERE id = $1`, [usdQuote])).rows[0].total).toBe('29300.00');
      await client.query(`DELETE FROM quotation_items WHERE id = $1`, [extra.rows[0].id]);
      expect((await client.query(`SELECT total FROM quotations WHERE id = $1`, [usdQuote])).rows[0].total).toBe('27000.00');
      await resetRole(client);
    });

    it('incoterm accepts the chip texts and refuses plain FOB (CHECK)', async () => {
      await actAs(client, SALES_A);
      await expectDbError(
        client.query(`INSERT INTO quotations (org_id, buyer_id, incoterm) VALUES ($1, $2, 'FOB')`, [ORG_A, BUYER_EX]),
        '23514',
      );
      await expectDbError(
        client.query(`INSERT INTO quotations (org_id, buyer_id, status) VALUES ($1, $2, 'sent')`, [ORG_A, BUYER_EX]),
        '42501', // only drafts may be inserted (RLS)
      );
      await resetRole(client);
    });

    it('item below floor: sales gets P0001 below_floor_price with DETAIL = floor; owner may save it', async () => {
      await actAs(client, SALES_A);
      const err = await expectDbError(
        client.query(`INSERT INTO quotation_items (org_id, quotation_id, product_id, qty_kg, unit, rate) VALUES ($1, $2, $3, 100, 'kg', 150)`, [ORG_A, inrQuote, PROD_A]),
        'P0001',
        'below_floor_price',
      );
      expect(err.detail).toBe('165.00');
      // the "wrong" unit does not switch the guard off (floor converted to the rate's unit)
      const err2 = await expectDbError(
        client.query(`INSERT INTO quotation_items (org_id, quotation_id, product_id, qty_kg, unit, rate) VALUES ($1, $2, $3, 100, 'MT', 150000)`, [ORG_A, inrQuote, PROD_A]),
        'P0001',
        'below_floor_price',
      );
      expect(err2.detail).toBe('165000.00');
      // sales may not lower an existing item under the floor either
      await expectDbError(client.query(`UPDATE quotation_items SET rate = 100 WHERE quotation_id = $1`, [inrQuote]), 'P0001', 'below_floor_price');

      await actAs(client, OWNER_A);
      const ownerItem = await client.query(
        `INSERT INTO quotation_items (org_id, quotation_id, product_id, qty_kg, unit, rate, sort_order) VALUES ($1, $2, $3, 100, 'kg', 150, 2) RETURNING id, floor_price_at_time`,
        [ORG_A, inrQuote, PROD_A],
      );
      expect(ownerItem.rows[0].floor_price_at_time).toBe('165.00');
      await client.query(`DELETE FROM quotation_items WHERE id = $1`, [ownerItem.rows[0].id]);
      await resetRole(client);
    });

    it('fn_quote_send: no_items on an empty draft; otherwise sent, sent_at, inquiry quoted, follow-up at GREATEST(valid_till - 1, today)', async () => {
      await actAs(client, SALES_A);
      const empty = await client.query(`INSERT INTO quotations (org_id, buyer_id) VALUES ($1, $2) RETURNING id`, [ORG_A, BUYER_IN]);
      await expectDbError(client.query(`SELECT fn_quote_send($1)`, [empty.rows[0].id]), 'P0001', 'no_items');
      await client.query(`DELETE FROM quotations WHERE id = $1`, [empty.rows[0].id]);

      await client.query(`SELECT fn_quote_send($1)`, [inrQuote]);
      const q = await client.query(`SELECT status, sent_at, quote_no, valid_till FROM quotations WHERE id = $1`, [inrQuote]);
      expect(q.rows[0].status).toBe('sent');
      expect(q.rows[0].sent_at).toBeInstanceOf(Date);
      expect((await client.query(`SELECT status FROM inquiries WHERE id = $1`, [INQ_QUOTE])).rows[0].status).toBe('quoted');
      const fu = await client.query(
        `SELECT buyer_id, note, done, due_on = GREATEST($3::date - 1, CURRENT_DATE) AS due_ok FROM follow_ups WHERE org_id = $1 AND entity_type = 'quote' AND entity_id = $2`,
        [ORG_A, inrQuote, q.rows[0].valid_till],
      );
      expect(fu.rows).toEqual([{ buyer_id: BUYER_IN, note: `Quote ${q.rows[0].quote_no} expires tomorrow - call buyer`, done: false, due_ok: true }]);

      // a second send is invalid_transition
      await expectDbError(client.query(`SELECT fn_quote_send($1)`, [inrQuote]), 'P0001', 'invalid_transition');
      await resetRole(client);
    });

    it('after send: direct UPDATE as sales affects 0 rows, status UPDATE raises, items are frozen, delete affects 0 rows', async () => {
      await actAs(client, SALES_A);
      const upd = await client.query(`UPDATE quotations SET notes = 'late edit' WHERE id = $1`, [inrQuote]);
      expect(upd.rowCount).toBe(0);
      await expectDbError(client.query(`UPDATE quotations SET status = 'draft' WHERE id = $1`, [inrQuote]), '42501');
      await expectDbError(client.query(`UPDATE quotations SET total = 1 WHERE id = $1`, [inrQuote]), '42501');
      await expectDbError(
        client.query(`INSERT INTO quotation_items (org_id, quotation_id, product_id, qty_kg, unit, rate) VALUES ($1, $2, $3, 10, 'kg', 200)`, [ORG_A, inrQuote, PROD_A]),
        '42501',
      );
      expect((await client.query(`UPDATE quotation_items SET rate = 200 WHERE quotation_id = $1`, [inrQuote])).rowCount).toBe(0);
      expect((await client.query(`DELETE FROM quotation_items WHERE quotation_id = $1`, [inrQuote])).rowCount).toBe(0);
      expect((await client.query(`DELETE FROM quotations WHERE id = $1`, [inrQuote])).rowCount).toBe(0);
      await resetRole(client);
    });

    it('an owner-made below-floor draft cannot be sent by sales (below_floor_price) but can by the owner', async () => {
      await actAs(client, OWNER_A);
      const q = await client.query(`INSERT INTO quotations (org_id, inquiry_id, buyer_id, currency) VALUES ($1, $2, $3, 'INR') RETURNING id`, [ORG_A, INQ_WON, BUYER_IN]);
      await client.query(`INSERT INTO quotation_items (org_id, quotation_id, product_id, qty_kg, unit, rate) VALUES ($1, $2, $3, 100, 'kg', 150)`, [ORG_A, q.rows[0].id, PROD_A]);

      await actAs(client, SALES_A);
      const err = await expectDbError(client.query(`SELECT fn_quote_send($1)`, [q.rows[0].id]), 'P0001', 'below_floor_price');
      expect(err.detail).toBe('165.00');

      await actAs(client, OWNER_A);
      await client.query(`SELECT fn_quote_send($1)`, [q.rows[0].id]);
      expect((await client.query(`SELECT status FROM quotations WHERE id = $1`, [q.rows[0].id])).rows[0].status).toBe('sent');
      // a won inquiry is left alone
      expect((await client.query(`SELECT status FROM inquiries WHERE id = $1`, [INQ_WON])).rows[0].status).toBe('won');
      await resetRole(client);
    });

    it('fn_quote_reject needs a reason; rejected sets decided_at, closes the quote follow-up and leaves the inquiry quoted', async () => {
      await actAs(client, SALES_A);
      await expectDbError(client.query(`SELECT fn_quote_reject($1, NULL)`, [inrQuote]), 'P0001', 'reason_required');
      await expectDbError(client.query(`SELECT fn_quote_reject($1, 'expensive')`, [inrQuote]), 'P0001', 'reason_required');
      await expectDbError(client.query(`SELECT fn_quote_reject($1, 'price')`, [usdQuote]), 'P0001', 'invalid_transition'); // still a draft

      await client.query(`SELECT fn_quote_reject($1, 'price')`, [inrQuote]);
      const q = await client.query(`SELECT status, reject_reason, decided_at FROM quotations WHERE id = $1`, [inrQuote]);
      expect(q.rows[0].status).toBe('rejected');
      expect(q.rows[0].reject_reason).toBe('price');
      expect(q.rows[0].decided_at).toBeInstanceOf(Date);
      const fu = await client.query(`SELECT done, done_by FROM follow_ups WHERE org_id = $1 AND entity_type = 'quote' AND entity_id = $2`, [ORG_A, inrQuote]);
      expect(fu.rows).toEqual([{ done: true, done_by: SALES_A }]);
      expect((await client.query(`SELECT status FROM inquiries WHERE id = $1`, [INQ_QUOTE])).rows[0].status).toBe('quoted');
      await resetRole(client);
    });

    it('expired is a display rule: sent AND valid_till < today in the list query (and in the TS helper)', async () => {
      await actAs(client, SALES_A);
      await client.query(`SELECT fn_quote_send($1)`, [usdQuote]);
      await resetRole(client);
      await client.query(`UPDATE quotations SET valid_till = CURRENT_DATE - 1 WHERE id = $1`, [usdQuote]); // postgres: the clock moves on

      await actAs(client, SALES_A);
      const list = await client.query(
        `SELECT id, status, CASE WHEN status = 'sent' AND valid_till < CURRENT_DATE THEN 'expired' ELSE status END AS display_status
         FROM quotations WHERE id = $1`,
        [usdQuote],
      );
      expect(list.rows[0]).toEqual({ id: usdQuote, status: 'sent', display_status: 'expired' });
      const waiting = await client.query(`SELECT count(*)::int AS c FROM quotations WHERE status = 'sent' AND valid_till >= CURRENT_DATE`);
      expect(waiting.rows[0].c).toBe(1); // only the owner's INQ_WON quote is still live

      // an expired quote can still be rejected (contracts 4.3)
      await client.query(`SELECT fn_quote_reject($1, 'no_reply')`, [usdQuote]);
      expect((await client.query(`SELECT status FROM quotations WHERE id = $1`, [usdQuote])).rows[0].status).toBe('rejected');
      await resetRole(client);

      expect(quoteDisplayStatus('sent', '2026-01-01', '2026-01-02')).toBe('expired');
      expect(quoteDisplayStatus('sent', '2026-01-02', '2026-01-02')).toBe('sent');
      expect(quoteDisplayStatus('accepted', '2026-01-01', '2026-01-02')).toBe('accepted');
    });

    it('draft delete as sales cascades the items', async () => {
      await actAs(client, SALES_A);
      const q = await client.query(`INSERT INTO quotations (org_id, buyer_id) VALUES ($1, $2) RETURNING id`, [ORG_A, BUYER_IN]);
      await client.query(`INSERT INTO quotation_items (org_id, quotation_id, product_id, qty_kg, unit, rate) VALUES ($1, $2, $3, 10, 'kg', 190)`, [ORG_A, q.rows[0].id, PROD_A]);
      expect((await client.query(`DELETE FROM quotations WHERE id = $1`, [q.rows[0].id])).rowCount).toBe(1);
      expect((await client.query(`SELECT count(*)::int AS c FROM quotation_items WHERE quotation_id = $1`, [q.rows[0].id])).rows[0].c).toBe(0);
      await resetRole(client);
    });
  });

  // ------------------------------------------------------- walls and tenants
  describe('module wall and tenant wall', () => {
    it('without the quotes module: fn_quote_send / fn_quote_reject raise 42501 and quotations cannot be inserted', async () => {
      await resetRole(client);
      const target = (await client.query(`SELECT id FROM quotations WHERE org_id = $1 LIMIT 1`, [ORG_A])).rows[0].id;
      await actAs(client, OPS_A);
      await expectDbError(client.query(`SELECT fn_quote_send($1)`, [target]), '42501', /Access denied: module quotes is required/);
      await expectDbError(client.query(`SELECT fn_quote_reject($1, 'price')`, [target]), '42501');
      await expectDbError(client.query(`INSERT INTO quotations (org_id, buyer_id) VALUES ($1, $2)`, [ORG_A, BUYER_IN]), '42501');
      // reading is still org-wide (the Plant Home can count nothing, but RLS reads are by org)
      expect((await client.query(`SELECT count(*)::int AS c FROM quotations`)).rows[0].c).toBeGreaterThan(0);
      await resetRole(client);
    });

    it('cross-tenant: owner B sees 0 rows of A and the functions answer not_found (42501)', async () => {
      await resetRole(client);
      const quoteA = (await client.query(`SELECT id FROM quotations WHERE org_id = $1 LIMIT 1`, [ORG_A])).rows[0].id;
      const sampleA = (await client.query(`SELECT id FROM samples WHERE org_id = $1 AND status = 'sent' LIMIT 1`, [ORG_A])).rows[0].id;

      await actAs(client, OWNER_B);
      expect((await client.query(`SELECT count(*)::int AS c FROM quotations`)).rows[0].c).toBe(0);
      expect((await client.query(`SELECT count(*)::int AS c FROM quotation_items`)).rows[0].c).toBe(0);
      expect((await client.query(`SELECT count(*)::int AS c FROM samples`)).rows[0].c).toBe(0);
      await expectDbError(client.query(`SELECT fn_quote_send($1)`, [quoteA]), '42501', 'not_found');
      await expectDbError(client.query(`SELECT fn_quote_reject($1, 'price')`, [quoteA]), '42501', 'not_found');
      await expectDbError(client.query(`SELECT fn_sample_set_status($1, 'approved')`, [sampleA]), '42501', 'not_found');
      expect((await client.query(`UPDATE samples SET courier = 'X' WHERE id = $1`, [sampleA])).rowCount).toBe(0);
      // and B cannot smuggle a row into A (RLS insert check)
      await expectDbError(client.query(`INSERT INTO samples (org_id, buyer_id, product_id) VALUES ($1, $2, $3)`, [ORG_A, BUYER_IN, PROD_A]), '42501');
      // B's own quote numbering starts at 0001 for its org
      const qB = await client.query(`INSERT INTO quotations (org_id, inquiry_id, buyer_id) VALUES ($1, $2, $3) RETURNING quote_no`, [ORG_B, INQ_B, BUYER_B]);
      expect(qB.rows[0].quote_no).toBe(`QTN-${fy}-0001`);
      await resetRole(client);
    });
  });

  // ------------------------------------------- Sprint B fix round (gate 2 + security review 2)
  describe('fix round: floor bypasses, cross-org parents, Plant on buyers, supplied codes', () => {
    const ITEM = `INSERT INTO quotation_items (org_id, quotation_id, product_id, qty_kg, unit, rate) VALUES ($1, $2, $3, $4, $5, $6)`;

    async function draft(userId: string, currency: string, buyerId = BUYER_EX): Promise<string> {
      await actAs(client, userId);
      const q = await client.query(`INSERT INTO quotations (org_id, buyer_id, currency) VALUES ($1, $2, $3) RETURNING id`, [ORG_A, buyerId, currency]);
      return q.rows[0].id;
    }

    async function updateDraft(id: string, currency: string, items: object[]) {
      return client.query(
        `SELECT fn_quote_update_draft($1, $2, NULL, $3, NULL, 'EXW', CURRENT_DATE + 10, '100% advance', NULL, $4::jsonb) AS quote_no`,
        [id, BUYER_EX, currency, JSON.stringify(items)],
      );
    }

    it('G2-01a / SEC2-01 A: a currency with no price row (EUR) has no floor, so sales is refused (no_price); the owner may', async () => {
      const eur = await draft(SALES_A, 'EUR');
      const err = await expectDbError(client.query(ITEM, [ORG_A, eur, PROD_A, 12000, 'MT', 12]), 'P0001', 'below_floor_price');
      expect(err.detail).toBe('no_price');
      await expectDbError(client.query(ITEM, [ORG_A, eur, PROD_A, 100, 'kg', 0.01]), 'P0001', 'below_floor_price');

      await actAs(client, OWNER_A); // owner override, like below-floor
      const owned = await client.query(`${ITEM} RETURNING floor_price_at_time, gst_rate`, [ORG_A, eur, PROD_A, 12000, 'MT', 12]);
      expect(owned.rows[0]).toEqual({ floor_price_at_time: null, gst_rate: '0.00' });

      await actAs(client, SALES_A); // and sales cannot send the owner's unpriced draft
      const send = await expectDbError(client.query(`SELECT fn_quote_send($1)`, [eur]), 'P0001', 'below_floor_price');
      expect(send.detail).toBe('no_price');
      expect((await client.query(`SELECT status FROM quotations WHERE id = $1`, [eur])).rows[0].status).toBe('draft');
      await client.query(`DELETE FROM quotations WHERE id = $1`, [eur]);
      await resetRole(client);
    });

    it('G2-01b / SEC2-01 B: changing a draft currency re-runs the guard; send re-derives a stale floor', async () => {
      const usd = await draft(SALES_A, 'USD');
      await client.query(ITEM, [ORG_A, usd, PROD_A, 12000, 'MT', 2250]); // USD floor 2050 per MT

      // USD -> INR with the USD rate still on the item: INR floor 165 per kg = 165000 per MT
      const err = await expectDbError(client.query(`UPDATE quotations SET currency = 'INR' WHERE id = $1`, [usd]), 'P0001', 'below_floor_price');
      expect(err.detail).toBe('165000.00');
      expect((await client.query(`SELECT currency FROM quotations WHERE id = $1`, [usd])).rows[0].currency).toBe('USD');
      // to EUR (no price) as well
      await expectDbError(client.query(`UPDATE quotations SET currency = 'EUR' WHERE id = $1`, [usd]), 'P0001', 'below_floor_price');

      // A draft whose stored floor is stale (made before this fix): triggers off for one statement.
      await resetRole(client);
      await client.query('BEGIN');
      await client.query(`SET LOCAL session_replication_role = replica`);
      await client.query(`UPDATE quotations SET currency = 'INR' WHERE id = $1`, [usd]);
      await client.query('COMMIT');
      expect((await client.query(`SELECT floor_price_at_time, gst_rate FROM quotation_items WHERE quotation_id = $1`, [usd])).rows[0]).toEqual({
        floor_price_at_time: '2050.00',
        gst_rate: '0.00',
      });
      await actAs(client, SALES_A);
      const send = await expectDbError(client.query(`SELECT fn_quote_send($1)`, [usd]), 'P0001', 'below_floor_price');
      expect(send.detail).toBe('165000.00');
      expect((await client.query(`SELECT status FROM quotations WHERE id = $1`, [usd])).rows[0].status).toBe('draft');

      // the owner may send it, and the send stores the current floor and GST for INR
      await actAs(client, OWNER_A);
      await client.query(`SELECT fn_quote_send($1)`, [usd]);
      const item = await client.query(
        `SELECT i.floor_price_at_time, i.gst_rate, q.status, q.gst_amount FROM quotation_items i JOIN quotations q ON q.id = i.quotation_id WHERE q.id = $1`,
        [usd],
      );
      expect(item.rows[0]).toEqual({ floor_price_at_time: '165000.00', gst_rate: '5.00', status: 'sent', gst_amount: '1350.00' });
      await resetRole(client);
    });

    it('SEC2-01: fn_quote_update_draft saves header + items in one go, both ways, and a refusal changes nothing', async () => {
      const id = await draft(SALES_A, 'USD');
      await client.query(ITEM, [ORG_A, id, PROD_A, 12000, 'MT', 2250]);

      // USD -> INR with INR rates
      const toInr = await updateDraft(id, 'INR', [{ product_id: PROD_A, packaging_type_id: PKG_A, qty_kg: 1500, unit: 'kg', rate: 185, spec_text: ' 8-15 mm ' }]);
      expect(toInr.rows[0].quote_no).toMatch(/^QTN-\d{4}-\d{4}$/);
      let q = await client.query(`SELECT currency, fx_rate, subtotal, gst_amount, total FROM quotations WHERE id = $1`, [id]);
      expect(q.rows[0]).toEqual({ currency: 'INR', fx_rate: null, subtotal: '277500.00', gst_amount: '13875.00', total: '291375.00' });
      const items = await client.query(`SELECT floor_price_at_time, gst_rate, spec_text, sort_order FROM quotation_items WHERE quotation_id = $1`, [id]);
      expect(items.rows).toEqual([{ floor_price_at_time: '165.00', gst_rate: '5.00', spec_text: '8-15 mm', sort_order: 1 }]);

      // INR -> USD with USD rates (old-items-first ordering would have refused this)
      await updateDraft(id, 'USD', [{ product_id: PROD_A, qty_kg: 12000, unit: 'MT', rate: 2250 }]);
      q = await client.query(`SELECT currency, total FROM quotations WHERE id = $1`, [id]);
      expect(q.rows[0]).toEqual({ currency: 'USD', total: '27000.00' });

      // refused: below the INR floor, and no price in EUR -> header and items stay as they were
      const below = await expectDbError(updateDraft(id, 'INR', [{ product_id: PROD_A, qty_kg: 12000, unit: 'MT', rate: 2250 }]), 'P0001', 'below_floor_price');
      expect(below.detail).toBe('165000.00');
      const noPrice = await expectDbError(updateDraft(id, 'EUR', [{ product_id: PROD_A, qty_kg: 12000, unit: 'MT', rate: 2250 }]), 'P0001', 'below_floor_price');
      expect(noPrice.detail).toBe('no_price');
      await expectDbError(updateDraft(id, 'USD', []), 'P0001', 'no_items');
      await expectDbError(updateDraft(id, 'USD', [{ product_id: PROD_B, qty_kg: 10, unit: 'kg', rate: 500 }]), 'P0001', 'bad_payload');
      q = await client.query(`SELECT currency, total, (SELECT count(*)::int FROM quotation_items WHERE quotation_id = $1) AS n FROM quotations WHERE id = $1`, [id]);
      expect(q.rows[0]).toEqual({ currency: 'USD', total: '27000.00', n: 1 });

      // walls: Plant has no quotes module; org B sees no such draft; a sent quote is not a draft
      await actAs(client, OPS_A);
      await expectDbError(updateDraft(id, 'USD', [{ product_id: PROD_A, qty_kg: 12000, unit: 'MT', rate: 2250 }]), '42501');
      await actAs(client, OWNER_B);
      await expectDbError(updateDraft(id, 'USD', [{ product_id: PROD_A, qty_kg: 12000, unit: 'MT', rate: 2250 }]), '42501', 'not_found');
      await actAs(client, SALES_A);
      await client.query(`SELECT fn_quote_send($1)`, [id]);
      await expectDbError(updateDraft(id, 'USD', [{ product_id: PROD_A, qty_kg: 12000, unit: 'MT', rate: 2300 }]), 'P0001', 'invalid_transition');
      await resetRole(client);
    });

    it('SEC2-01 C / G2-03: another org\'s product, packaging, buyer or inquiry is refused on samples, quotations and items', async () => {
      const id = await draft(SALES_A, 'INR', BUYER_IN);
      // foreign product: no floor and its GST would leak -> bad_payload from the item guard (owner too)
      const prod = await expectDbError(client.query(ITEM, [ORG_A, id, PROD_B, 10, 'kg', 1]), 'P0001', 'bad_payload');
      expect(prod.detail).toBe('product_id');
      await actAs(client, OWNER_A);
      await expectDbError(client.query(ITEM, [ORG_A, id, PROD_B, 10, 'kg', 1]), 'P0001', 'bad_payload');
      await actAs(client, SALES_A);
      await expectDbError(
        client.query(`INSERT INTO quotation_items (org_id, quotation_id, product_id, packaging_type_id, qty_kg, unit, rate) VALUES ($1, $2, $3, $4, 10, 'kg', 190)`, [ORG_A, id, PROD_A, PKG_B]),
        '42501',
      );
      const own = await client.query(`${ITEM} RETURNING id`, [ORG_A, id, PROD_A, 10, 'kg', 190]);
      await expectDbError(client.query(`UPDATE quotation_items SET packaging_type_id = $2 WHERE id = $1`, [own.rows[0].id, PKG_B]), '42501');

      // quotations: buyer / inquiry of org B on insert and on update
      await expectDbError(client.query(`INSERT INTO quotations (org_id, buyer_id) VALUES ($1, $2)`, [ORG_A, BUYER_B]), '42501');
      await expectDbError(client.query(`INSERT INTO quotations (org_id, buyer_id, inquiry_id) VALUES ($1, $2, $3)`, [ORG_A, BUYER_IN, INQ_B]), '42501');
      await expectDbError(client.query(`UPDATE quotations SET buyer_id = $2 WHERE id = $1`, [id, BUYER_B]), '42501');
      await expectDbError(client.query(`UPDATE quotations SET inquiry_id = $2 WHERE id = $1`, [id, INQ_B]), '42501');

      // samples: buyer / product / inquiry of org B on insert and on update
      await expectDbError(client.query(`INSERT INTO samples (org_id, buyer_id, product_id) VALUES ($1, $2, $3)`, [ORG_A, BUYER_B, PROD_A]), '42501');
      await expectDbError(client.query(`INSERT INTO samples (org_id, buyer_id, product_id) VALUES ($1, $2, $3)`, [ORG_A, BUYER_IN, PROD_B]), '42501');
      await expectDbError(client.query(`INSERT INTO samples (org_id, buyer_id, product_id, inquiry_id) VALUES ($1, $2, $3, $4)`, [ORG_A, BUYER_IN, PROD_A, INQ_B]), '42501');
      const smp = await client.query(`INSERT INTO samples (org_id, buyer_id, product_id) VALUES ($1, $2, $3) RETURNING id`, [ORG_A, BUYER_IN, PROD_A]);
      await expectDbError(client.query(`UPDATE samples SET buyer_id = $2 WHERE id = $1`, [smp.rows[0].id, BUYER_B]), '42501');
      await expectDbError(client.query(`UPDATE samples SET product_id = $2 WHERE id = $1`, [smp.rows[0].id, PROD_B]), '42501');

      // buyer_contacts (0003): a contact on org B's buyer
      await expectDbError(client.query(`INSERT INTO buyer_contacts (org_id, buyer_id, name, phone) VALUES ($1, $2, 'X', '9800000000')`, [ORG_A, BUYER_B]), '42501');

      await client.query(`DELETE FROM samples WHERE id = $1`, [smp.rows[0].id]);
      await client.query(`DELETE FROM quotations WHERE id = $1`, [id]);
      await resetRole(client);
      // org B's rows were never pinned by org A
      expect((await client.query(`SELECT count(*)::int AS c FROM samples WHERE org_id = $1 AND buyer_id = $2`, [ORG_A, BUYER_B])).rows[0].c).toBe(0);
    });

    it('G2-02 / SEC2-03: Plant holds the buyers module but cannot write buyers or contacts; sales can', async () => {
      await resetRole(client);
      await client.query(`INSERT INTO buyer_contacts (org_id, buyer_id, name, phone, is_primary) VALUES ($1, $2, 'Amit', '9811111111', true)`, [ORG_A, BUYER_IN]);

      await actAs(client, OPS_A);
      expect((await client.query(`SELECT count(*)::int AS c FROM buyers`)).rows[0].c).toBeGreaterThan(0); // still reads
      expect((await client.query(`UPDATE buyers SET credit_period_days = 90 WHERE id = $1`, [BUYER_IN])).rowCount).toBe(0);
      expect((await client.query(`UPDATE buyer_contacts SET phone = '9000000000' WHERE buyer_id = $1`, [BUYER_IN])).rowCount).toBe(0);
      expect((await client.query(`DELETE FROM buyer_contacts WHERE buyer_id = $1`, [BUYER_IN])).rowCount).toBe(0);
      expect((await client.query(`DELETE FROM buyers WHERE id = $1`, [BUYER_EX])).rowCount).toBe(0);
      await expectDbError(
        client.query(`INSERT INTO buyers (org_id, company_name, buyer_type) VALUES ($1, 'Plant Buyer', 'domestic_masala')`, [ORG_A]),
        '42501',
      );
      await expectDbError(client.query(`INSERT INTO buyer_contacts (org_id, buyer_id, name, phone) VALUES ($1, $2, 'Y', '9822222222')`, [ORG_A, BUYER_IN]), '42501');

      await actAs(client, SALES_A);
      expect((await client.query(`UPDATE buyers SET credit_period_days = 30 WHERE id = $1`, [BUYER_IN])).rowCount).toBe(1);
      await resetRole(client);
      expect((await client.query(`SELECT credit_period_days FROM buyers WHERE id = $1`, [BUYER_IN])).rows[0].credit_period_days).toBe(30);
    });

    it('SEC2-02: a code a web session supplies is replaced, so the next number cannot be pre-claimed or forged', async () => {
      await resetRole(client);
      const counter = async (prefix: string) =>
        Number((await client.query(`SELECT current_val FROM entity_code_counters WHERE org_id = $1 AND prefix = $2`, [ORG_A, prefix])).rows[0]?.current_val ?? 0);
      const pad = (n: number) => String(n).padStart(4, '0');
      const n = await counter('SMP');

      await actAs(client, SALES_A);
      // try to pre-claim the number after next, then two normal inserts in a row
      const claim = await client.query(
        `INSERT INTO samples (org_id, code, buyer_id, product_id) VALUES ($1, $2, $3, $4) RETURNING code`,
        [ORG_A, `SMP-${pad(n + 2)}`, BUYER_IN, PROD_A],
      );
      expect(claim.rows[0].code).toBe(`SMP-${pad(n + 1)}`);
      const next1 = await client.query(`INSERT INTO samples (org_id, buyer_id, product_id) VALUES ($1, $2, $3) RETURNING code`, [ORG_A, BUYER_IN, PROD_A]);
      const next2 = await client.query(`INSERT INTO samples (org_id, buyer_id, product_id) VALUES ($1, $2, $3) RETURNING code`, [ORG_A, BUYER_IN, PROD_A]);
      expect([next1.rows[0].code, next2.rows[0].code]).toEqual([`SMP-${pad(n + 2)}`, `SMP-${pad(n + 3)}`]);

      // a forged document number is replaced by the QTN series
      const forged = await client.query(`INSERT INTO quotations (org_id, quote_no, buyer_id) VALUES ($1, 'PI-2627-0099', $2) RETURNING id, quote_no`, [ORG_A, BUYER_IN]);
      expect(forged.rows[0].quote_no).toMatch(new RegExp(`^QTN-${fy}-\\d{4}$`));
      const after = await client.query(`INSERT INTO quotations (org_id, buyer_id) VALUES ($1, $2) RETURNING id, quote_no`, [ORG_A, BUYER_IN]);
      expect(after.rows[0].quote_no).not.toBe(forged.rows[0].quote_no);

      // buyers (BUY trigger from 0004 uses the same fn_assign_code)
      const buyer = await client.query(
        `INSERT INTO buyers (org_id, buyer_code, company_name, buyer_type) VALUES ($1, 'QT-B1', 'Claim Test', 'domestic_masala') RETURNING buyer_code`,
        [ORG_A],
      );
      expect(buyer.rows[0].buyer_code).toMatch(/^BUY-\d{4}$/);

      await client.query(`DELETE FROM quotations WHERE id = ANY($1::uuid[])`, [[forged.rows[0].id, after.rows[0].id]]);
      await resetRole(client);
      // trusted callers (seeds as postgres) keep an explicit code
      const seeded = await client.query(`INSERT INTO samples (org_id, code, buyer_id, product_id) VALUES ($1, 'SMP-0900', $2, $3) RETURNING code`, [ORG_A, BUYER_IN, PROD_A]);
      expect(seeded.rows[0].code).toBe('SMP-0900');
    });
  });

  // ------------------------------------------------------------- Sprint C
  describe('Sprint C: A9 row starts, SEC2-06 same refusal, SEC2-07, G2-13 one call', () => {
    const RANDOM = '0badc0de-0000-4000-8000-00000000d1d1'; // exists nowhere
    const INQ_NEW = 'd1d1d1d1-dddd-4d1d-8d1d-dddddddddd04';
    const QUOTE_B = 'd2d2d2d2-eeee-4d2d-8d2d-eeeeeeeeee01';
    const ITEM = `INSERT INTO quotation_items (org_id, quotation_id, product_id, qty_kg, unit, rate) VALUES ($1, $2, $3, $4, $5, $6)`;

    it('A9 samples: INSERT starts as to_send, no result date, in the caller\'s name; DELETE only while to_send', async () => {
      await actAs(client, SALES_A);
      const ins = `INSERT INTO samples (org_id, buyer_id, product_id, status, decided_on, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, status, created_by`;
      for (const [status, decidedOn, author] of [
        ['approved', null, SALES_A],
        ['sent', null, SALES_A],
        ['to_send', '2026-11-01', SALES_A],
        ['to_send', null, OWNER_A], // "made by the owner"
      ]) {
        await expectDbError(client.query(ins, [ORG_A, BUYER_IN, PROD_A, status, decidedOn, author]), '42501');
      }
      const mine = (await client.query(ins, [ORG_A, BUYER_IN, PROD_A, 'to_send', null, SALES_A])).rows[0];
      expect(mine).toMatchObject({ status: 'to_send', created_by: SALES_A });
      const unsigned = (await client.query(ins, [ORG_A, BUYER_IN, PROD_A, 'to_send', null, null])).rows[0];
      expect(unsigned.created_by).toBeNull();

      // once it went out it is history: nobody deletes it, not even the owner
      await client.query(`SELECT fn_sample_set_status($1, 'sent')`, [mine.id]);
      expect((await client.query(`DELETE FROM samples WHERE id = $1`, [mine.id])).rowCount).toBe(0);
      await actAs(client, OWNER_A);
      expect((await client.query(`DELETE FROM samples WHERE id = $1`, [mine.id])).rowCount).toBe(0);
      await actAs(client, SALES_A);
      expect((await client.query(`DELETE FROM samples WHERE id = $1`, [unsigned.id])).rowCount).toBe(1);
      await resetRole(client);
      expect((await client.query(`SELECT status FROM samples WHERE id = $1`, [mine.id])).rows[0].status).toBe('sent');
    });

    it('A9 quotations: INSERT is an unsent, undecided draft in the caller\'s name; supplied totals are replaced by the item sums', async () => {
      await actAs(client, SALES_A);
      const ins = (col: string, value: unknown) =>
        client.query(`INSERT INTO quotations (org_id, buyer_id, ${col}) VALUES ($1, $2, $3) RETURNING id`, [ORG_A, BUYER_IN, value]);
      await expectDbError(ins('status', 'sent'), '42501');
      await expectDbError(ins('sent_at', new Date()), '42501');
      await expectDbError(ins('decided_at', new Date()), '42501');
      await expectDbError(ins('reject_reason', 'price'), '42501');
      await expectDbError(ins('created_by', OWNER_A), '42501');

      const q = await client.query(
        `INSERT INTO quotations (org_id, buyer_id, currency, subtotal, gst_amount, total, created_by)
         VALUES ($1, $2, 'INR', 999999, 1, 1000000, $3) RETURNING id, subtotal, gst_amount, total, status`,
        [ORG_A, BUYER_IN, SALES_A],
      );
      expect(q.rows[0]).toMatchObject({ subtotal: '0.00', gst_amount: '0.00', total: '0.00', status: 'draft' });
      const id = q.rows[0].id;
      await client.query(ITEM, [ORG_A, id, PROD_A, 1000, 'kg', 185]);
      expect((await client.query(`SELECT subtotal, gst_amount, total FROM quotations WHERE id = $1`, [id])).rows[0]).toEqual({
        subtotal: '185000.00',
        gst_amount: '9250.00',
        total: '194250.00',
      });
      await expectDbError(client.query(`UPDATE quotations SET total = 1 WHERE id = $1`, [id]), '42501'); // not in the UPDATE grant
      await client.query(`DELETE FROM quotations WHERE id = $1`, [id]);
      await resetRole(client);
    });

    it('G2-13: fn_sample_create saves, and with mark-sent sends, in one call; a refused mark-sent saves nothing', async () => {
      await resetRole(client);
      await client.query(
        `INSERT INTO inquiries (id, org_id, code, buyer_id, buyer_name, product_id, qty_kg, status)
         VALUES ($1, $2, 'INQ-0904', $3, 'Mumbai Masala', $4, 250, 'talking')`,
        [INQ_NEW, ORG_A, BUYER_IN, PROD_A],
      );
      const create = (inquiryId: string | null, lotNo: string | null, markSent: boolean) =>
        client.query(`SELECT fn_sample_create($1, $2, $3, 250, ' DHL ', NULL, $4, 'For trial', $5) AS r`, [
          BUYER_IN,
          PROD_A,
          inquiryId,
          lotNo,
          markSent,
        ]);
      const countA = async () => (await client.query(`SELECT count(*)::int AS c FROM samples WHERE org_id = $1`, [ORG_A])).rows[0].c;

      await actAs(client, SALES_A);
      const plain = (await create(null, null, false)).rows[0].r;
      expect(plain.code).toMatch(/^SMP-\d{4}$/);
      expect((await client.query(`SELECT status, courier, result_note, created_by, org_id FROM samples WHERE id = $1`, [plain.id])).rows[0]).toEqual({
        status: 'to_send',
        courier: 'DHL',
        result_note: 'For trial',
        created_by: SALES_A,
        org_id: ORG_A,
      });

      const sent = (await create(INQ_NEW, 'L-77', true)).rows[0].r;
      const row = await client.query(
        `SELECT s.status, s.sent_on IS NOT NULL AS has_sent_on, i.status AS inquiry_status,
                (SELECT count(*)::int FROM follow_ups f WHERE f.entity_type = 'inquiry' AND f.entity_id = i.id AND f.done = false
                   AND f.note = 'Sample ' || s.code || ' sent, ask for result') AS reminders
         FROM samples s JOIN inquiries i ON i.id = s.inquiry_id WHERE s.id = $1`,
        [sent.id],
      );
      expect(row.rows[0]).toEqual({ status: 'sent', has_sent_on: true, inquiry_status: 'sample_sent', reminders: 1 });

      // walls: another org's session cannot use org A's buyer; a missing buyer is bad_payload
      await actAs(client, OWNER_B);
      await expectDbError(client.query(`SELECT fn_sample_create($1, $2)`, [BUYER_IN, PROD_A]), '42501');
      await actAs(client, SALES_A);
      await expectDbError(client.query(`SELECT fn_sample_create(NULL, $1)`, [PROD_A]), 'P0001', 'bad_payload');

      // atomic: when the mark-sent step is refused the new sample is not kept either
      await resetRole(client);
      await client.query(`CREATE OR REPLACE FUNCTION zz_g213_refuse_sent() RETURNS trigger LANGUAGE plpgsql AS $f$
        BEGIN RAISE EXCEPTION 'invalid_transition' USING ERRCODE = 'P0001'; END $f$`);
      await client.query(`DROP TRIGGER IF EXISTS zz_g213_refuse_sent ON samples`);
      await client.query(`CREATE TRIGGER zz_g213_refuse_sent BEFORE UPDATE ON samples FOR EACH ROW
        WHEN (NEW.lot_no = 'G213-FAIL' AND NEW.status = 'sent') EXECUTE FUNCTION zz_g213_refuse_sent()`);
      try {
        const before = await countA();
        await actAs(client, SALES_A);
        await expectDbError(create(null, 'G213-FAIL', true), 'P0001', 'invalid_transition');
        await resetRole(client);
        expect(await countA()).toBe(before);
        expect((await client.query(`SELECT count(*)::int AS c FROM samples WHERE lot_no = 'G213-FAIL'`)).rows[0].c).toBe(0);
      } finally {
        await resetRole(client);
        await client.query(`DROP TRIGGER IF EXISTS zz_g213_refuse_sent ON samples`);
        await client.query(`DROP FUNCTION IF EXISTS zz_g213_refuse_sent()`);
      }
    });

    it('SEC2-06: another org\'s id and a random id get the same refusal on samples, quotations and items, insert and update', async () => {
      await resetRole(client);
      await client.query(`INSERT INTO quotations (id, org_id, quote_no, buyer_id) VALUES ($1, $2, 'QTN-B-0001', $3)`, [QUOTE_B, ORG_B, BUYER_B]);

      await actAs(client, SALES_A);
      const smp = (await client.query(`INSERT INTO samples (org_id, buyer_id, product_id) VALUES ($1, $2, $3) RETURNING id`, [ORG_A, BUYER_IN, PROD_A])).rows[0].id;
      const qid = (await client.query(`INSERT INTO quotations (org_id, buyer_id) VALUES ($1, $2) RETURNING id`, [ORG_A, BUYER_IN])).rows[0].id;
      const item = (await client.query(`${ITEM} RETURNING id`, [ORG_A, qid, PROD_A, 10, 'kg', 190])).rows[0].id;

      const cases: [string, string, (id: string) => Promise<unknown>][] = [
        ['samples.buyer_id insert', BUYER_B, (id) => client.query(`INSERT INTO samples (org_id, buyer_id, product_id) VALUES ($1, $2, $3)`, [ORG_A, id, PROD_A])],
        ['samples.product_id insert', PROD_B, (id) => client.query(`INSERT INTO samples (org_id, buyer_id, product_id) VALUES ($1, $2, $3)`, [ORG_A, BUYER_IN, id])],
        ['samples.inquiry_id insert', INQ_B, (id) => client.query(`INSERT INTO samples (org_id, buyer_id, product_id, inquiry_id) VALUES ($1, $2, $3, $4)`, [ORG_A, BUYER_IN, PROD_A, id])],
        ['fn_sample_create buyer', BUYER_B, (id) => client.query(`SELECT fn_sample_create($1, $2)`, [id, PROD_A])],
        ['fn_sample_create product', PROD_B, (id) => client.query(`SELECT fn_sample_create($1, $2)`, [BUYER_IN, id])],
        ['fn_sample_create inquiry', INQ_B, (id) => client.query(`SELECT fn_sample_create($1, $2, $3)`, [BUYER_IN, PROD_A, id])],
        ['samples.buyer_id update', BUYER_B, (id) => client.query(`UPDATE samples SET buyer_id = $2 WHERE id = $1`, [smp, id])],
        ['samples.product_id update', PROD_B, (id) => client.query(`UPDATE samples SET product_id = $2 WHERE id = $1`, [smp, id])],
        ['samples.inquiry_id update', INQ_B, (id) => client.query(`UPDATE samples SET inquiry_id = $2 WHERE id = $1`, [smp, id])],
        ['quotations.buyer_id insert', BUYER_B, (id) => client.query(`INSERT INTO quotations (org_id, buyer_id) VALUES ($1, $2)`, [ORG_A, id])],
        ['quotations.inquiry_id insert', INQ_B, (id) => client.query(`INSERT INTO quotations (org_id, buyer_id, inquiry_id) VALUES ($1, $2, $3)`, [ORG_A, BUYER_IN, id])],
        ['quotations.buyer_id update', BUYER_B, (id) => client.query(`UPDATE quotations SET buyer_id = $2 WHERE id = $1`, [qid, id])],
        ['quotations.inquiry_id update', INQ_B, (id) => client.query(`UPDATE quotations SET inquiry_id = $2 WHERE id = $1`, [qid, id])],
        ['items.product_id insert', PROD_B, (id) => client.query(ITEM, [ORG_A, qid, id, 10, 'kg', 1])],
        ['items.packaging_type_id insert', PKG_B, (id) =>
          client.query(`INSERT INTO quotation_items (org_id, quotation_id, product_id, packaging_type_id, qty_kg, unit, rate) VALUES ($1, $2, $3, $4, 10, 'kg', 190)`, [ORG_A, qid, PROD_A, id])],
        ['items.quotation_id insert', QUOTE_B, (id) => client.query(ITEM, [ORG_A, id, PROD_A, 10, 'kg', 1])],
        ['items.quotation_id insert in its org', QUOTE_B, (id) => client.query(ITEM, [ORG_B, id, PROD_B, 10, 'kg', 1])],
        ['items.product_id update', PROD_B, (id) => client.query(`UPDATE quotation_items SET product_id = $2 WHERE id = $1`, [item, id])],
        ['items.packaging_type_id update', PKG_B, (id) => client.query(`UPDATE quotation_items SET packaging_type_id = $2 WHERE id = $1`, [item, id])],
        ['items.quotation_id update', QUOTE_B, (id) => client.query(`UPDATE quotation_items SET quotation_id = $2 WHERE id = $1`, [item, id])],
      ];
      for (const [label, foreignId, run] of cases) {
        const foreign = await expectDbError(run(foreignId));
        const random = await expectDbError(run(RANDOM));
        expect({ code: random.code, message: random.message, detail: random.detail }, label).toEqual({
          code: foreign.code,
          message: foreign.message,
          detail: foreign.detail,
        });
        expect(foreign.code, label).not.toBe('23503'); // never the FK's "not present in table" text
        expect(String(foreign.detail ?? ''), label).not.toMatch(/\d+\.\d\d/); // no floor / GST number of org B
      }

      // the owner meets the same refusal for org B's quote (no floor wall to hide behind)
      await actAs(client, OWNER_A);
      await expectDbError(client.query(ITEM, [ORG_B, QUOTE_B, PROD_B, 10, 'kg', 1]), '42501', 'not_found');

      await client.query(`DELETE FROM quotations WHERE id = $1`, [qid]);
      await client.query(`DELETE FROM samples WHERE id = $1`, [smp]);
      await resetRole(client);
      expect((await client.query(`SELECT count(*)::int AS c FROM quotation_items WHERE quotation_id = $1`, [QUOTE_B])).rows[0].c).toBe(0);
    });

    it('SEC2-07: a web session with no role (switched off) is not the owner: the item guard refuses it; trusted scripts still seed', async () => {
      await resetRole(client);
      const qid = (await client.query(`INSERT INTO quotations (org_id, quote_no, buyer_id) VALUES ($1, 'QTN-T-0907', $2) RETURNING id`, [ORG_A, BUYER_IN])).rows[0].id;
      await client.query(`UPDATE profiles SET is_active = false WHERE id = $1`, [SALES_A]);
      try {
        await actAs(client, SALES_A);
        expect((await client.query(`SELECT fn_user_role() AS r`)).rows[0].r).toBeNull();
        await expectDbError(client.query(ITEM, [ORG_A, qid, PROD_A, 10, 'kg', 1]), '42501', 'not_found');
      } finally {
        await resetRole(client);
        await client.query(`UPDATE profiles SET is_active = true WHERE id = $1`, [SALES_A]);
      }
      // postgres (seeds, fixtures) is not a web session: it may store any rate, the floor is still recorded
      const seeded = await client.query(`${ITEM} RETURNING floor_price_at_time`, [ORG_A, qid, PROD_A, 10, 'kg', 1]);
      expect(seeded.rows[0].floor_price_at_time).toBe('165.00');
      await client.query(`DELETE FROM quotations WHERE id = $1`, [qid]);
    });
  });

  // --------------------------------------------------------- form defaults
  describe('quote form helpers (contracts 6.3)', () => {
    const prices = [
      { product_id: 'p1', currency: 'INR', unit: 'kg', rate: 185, floor_price: 165, is_active: true, effective_from: '2026-01-01' },
      { product_id: 'p1', currency: 'USD', unit: 'MT', rate: 2250, floor_price: 2050, is_active: true, effective_from: '2026-01-01' },
    ];
    const rhine = { id: 'b', company_name: 'Rhine', country: 'Germany', preferred_currency: 'EUR', incoterm: 'CIF', payment_terms: '100% Irrevocable LC at sight' };
    const dubai = { id: 'c', company_name: 'Dubai', country: 'United Arab Emirates', preferred_currency: 'USD', incoterm: 'FOB', payment_terms: '30% Advance, 70% against BL copy by email' };
    const mumbai = { id: 'd', company_name: 'Mumbai', country: 'India', preferred_currency: 'INR', incoterm: 'EXW', payment_terms: '30 days net from invoice date' };

    it('currency: preferred when priced, else USD export / INR India', () => {
      expect(defaultCurrency(rhine, prices, 'p1')).toBe('USD'); // EUR has no price row
      expect(defaultCurrency(dubai, prices, 'p1')).toBe('USD');
      expect(defaultCurrency(mumbai, prices, 'p1')).toBe('INR');
      expect(defaultCurrency({ ...mumbai, preferred_currency: 'GBP' }, prices, 'p1')).toBe('INR');
      // the buyer type decides before the country (an Indian export agent quotes in USD)
      expect(defaultCurrency({ ...mumbai, buyer_type: 'export_agent', preferred_currency: 'GBP' }, prices, 'p1')).toBe('USD');
    });

    it('export or India: buyer_type first, then country <> India (same rule as orders)', () => {
      expect(isExportBuyer({ buyer_type: 'export_importer', country: '' })).toBe(true);
      expect(isExportBuyer({ buyer_type: 'export_agent', country: 'India' })).toBe(true);
      expect(isExportBuyer({ buyer_type: 'domestic_masala', country: 'United Arab Emirates' })).toBe(false);
      expect(isExportBuyer({ buyer_type: null, country: 'Germany' })).toBe(true);
      expect(isExportBuyer({ country: ' india ' })).toBe(false);
      expect(isExportBuyer({ country: '' })).toBe(true);
      expect(isExportBuyer({ country: null })).toBe(false);
      const buyers = [
        { buyer_type: 'export_importer', country: '' },
        { buyer_type: 'export_agent', country: 'India' },
        { buyer_type: 'domestic_food_mfr', country: 'Nepal' },
        { buyer_type: null, country: 'Germany' },
        { buyer_type: null, country: 'India' },
        { buyer_type: null, country: '' },
        { buyer_type: null, country: null },
      ];
      for (const b of buyers) expect(isExportBuyer(b), JSON.stringify(b)).toBe(isExportOrderBuyer(b));
    });

    it('currency chips: only currencies priced for every picked product; no_price error text', () => {
      const withEur = [...prices, { product_id: 'p2', currency: 'EUR', unit: 'kg', rate: 3, floor_price: 2, is_active: true, effective_from: '2026-01-01' }];
      expect(pricedCurrencies(withEur, [], '2026-06-01')).toEqual(['INR', 'USD', 'EUR']);
      expect(pricedCurrencies(withEur, ['p1'], '2026-06-01')).toEqual(['INR', 'USD']);
      expect(pricedCurrencies(withEur, ['p1', 'p2'], '2026-06-01')).toEqual([]);
      expect(pricedCurrencies(prices, ['p1', ''], '2025-01-01')).toEqual([]); // not effective yet
      const tt = (key: string, vars?: Record<string, string | number>) => `${key}${vars ? JSON.stringify(vars) : ''}`;
      expect(quoteErrorText(tt, 'msg.err.below_floor_price', 'no_price', 'EUR')).toBe('quotes.no_price{"currency":"EUR"}');
      expect(quoteErrorText(tt, 'msg.err.below_floor_price', '165.00', 'INR')).toContain('165');
      expect(quoteErrorText(tt, 'msg.error.save', undefined, 'INR')).toBe('msg.error.save');
    });

    it('payment terms chips and advance % from the words', () => {
      expect(matchPaymentTerms(rhine.payment_terms)).toBe('LC at sight');
      expect(matchPaymentTerms(dubai.payment_terms)).toBe('30% advance, 70% against BL copy');
      expect(matchPaymentTerms(mumbai.payment_terms)).toBe('30 days credit');
      expect(matchPaymentTerms('50% Advance, balance against LR dispatch')).toBe('50% advance, 50% before dispatch');
      expect(advancePctFromTerms('30% advance, 70% against BL copy')).toBe(30);
      expect(advancePctFromTerms('50% advance, 50% before dispatch')).toBe(50);
      expect(advancePctFromTerms('100% advance')).toBe(100);
      expect(advancePctFromTerms('30 days credit')).toBe(0);
      expect(advancePctFromTerms('LC at sight')).toBe(0);
    });
  });
});
