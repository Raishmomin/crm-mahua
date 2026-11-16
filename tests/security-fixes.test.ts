import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { connect, applyMigrations, actAs, resetRole, expectDbError } from './helpers/db';

// Own fixture ids (contracts.md section 9): never aaaa/bbbb (rls test) or c/d/e (Sprint B files).
const ORG1 = 'f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1';
const ORG2 = 'f2f2f2f2-f2f2-4f2f-8f2f-f2f2f2f2f2f2';
const OWNER1 = 'f1f1f1f1-0001-4f1f-8f1f-000000000001';
const ACCT1 = 'f1f1f1f1-0002-4f1f-8f1f-000000000002';
const SALES1 = 'f1f1f1f1-0003-4f1f-8f1f-000000000003';
const OPS1 = 'f1f1f1f1-0004-4f1f-8f1f-000000000004';
const OWNER2 = 'f2f2f2f2-0001-4f2f-8f2f-000000000001';
const PRODUCT1 = 'f1f1f1f1-aaaa-4f1f-8f1f-aaaaaaaaaaaa';
const PRODUCT2 = 'f2f2f2f2-aaaa-4f2f-8f2f-aaaaaaaaaaaa';

const ORG_IDS = [ORG1, ORG2];
const USER_IDS = [OWNER1, ACCT1, SALES1, OPS1, OWNER2];
const ALL_MODULES = [
  'dashboard', 'leads', 'buyers', 'samples', 'quotes', 'orders', 'payments',
  'catalog', 'documents', 'reports', 'users', 'settings', 'audit',
];
// Like the seed: sales and operations hold catalog (read-only Products list), sales also users here.
const SALES_MODULES = ['dashboard', 'leads', 'buyers', 'quotes', 'catalog', 'users'];
const OPS_MODULES = ['dashboard', 'orders', 'catalog'];

describe('0003 security fixes: the database enforces the walls', () => {
  let client: Client;

  async function cleanup() {
    await resetRole(client);
    await client.query('DROP TABLE IF EXISTS zz_sec_codes');
    await client.query(`DELETE FROM audit_log WHERE org_id = ANY($1::uuid[])`, [ORG_IDS]);
    await client.query(`DELETE FROM price_list_items WHERE org_id = ANY($1::uuid[])`, [ORG_IDS]);
    await client.query(`DELETE FROM product_costs WHERE org_id = ANY($1::uuid[])`, [ORG_IDS]);
    await client.query(`DELETE FROM products WHERE org_id = ANY($1::uuid[])`, [ORG_IDS]);
    await client.query(`DELETE FROM business_settings WHERE org_id = ANY($1::uuid[])`, [ORG_IDS]);
    await client.query(`DELETE FROM app_settings WHERE org_id = ANY($1::uuid[])`, [ORG_IDS]);
    await client.query(`DELETE FROM buyers WHERE org_id = ANY($1::uuid[])`, [ORG_IDS]);
    await client.query(`DELETE FROM profiles WHERE org_id = ANY($1::uuid[])`, [ORG_IDS]);
    await client.query(`DELETE FROM doc_counters WHERE org_id = ANY($1::uuid[])`, [ORG_IDS]);
    await client.query(`DELETE FROM entity_code_counters WHERE org_id = ANY($1::uuid[])`, [ORG_IDS]);
    await client.query(`DELETE FROM organizations WHERE id = ANY($1::uuid[])`, [ORG_IDS]);
    await client.query(`DELETE FROM auth.users WHERE id = ANY($1::uuid[])`, [USER_IDS]);
  }

  beforeAll(async () => {
    client = await connect();
    await applyMigrations(client);
    await cleanup();

    await client.query(
      `INSERT INTO organizations (id, name, code) VALUES ($1, 'Sec Org One', 'SEC-1'), ($2, 'Sec Org Two', 'SEC-2')`,
      [ORG1, ORG2],
    );
    await client.query(
      `INSERT INTO auth.users (id, email) VALUES
         ($1, 'owner@sec-one.test'), ($2, 'acct@sec-one.test'), ($3, 'sales@sec-one.test'),
         ($4, 'ops@sec-one.test'), ($5, 'owner@sec-two.test')`,
      USER_IDS,
    );
    await client.query(
      `INSERT INTO profiles (id, org_id, email, full_name, role, modules, is_active) VALUES
         ($1, $6, 'owner@sec-one.test', 'Owner One', 'owner', $8::text[], true),
         ($2, $6, 'acct@sec-one.test', 'Munim One', 'accountant', ARRAY['dashboard','payments','catalog','users'], true),
         ($3, $6, 'sales@sec-one.test', 'Sales One', 'sales', $9::text[], true),
         ($4, $6, 'ops@sec-one.test', 'Plant One', 'operations', $10::text[], true),
         ($5, $7, 'owner@sec-two.test', 'Owner Two', 'owner', $8::text[], true)`,
      [OWNER1, ACCT1, SALES1, OPS1, OWNER2, ORG1, ORG2, ALL_MODULES, SALES_MODULES, OPS_MODULES],
    );
    await client.query(
      `INSERT INTO products (id, org_id, code, name, form, color) VALUES
         ($1, $3, 'SEC-P1', 'White Onion Flakes', 'flakes', 'white'),
         ($2, $4, 'SEC-P2', 'Red Onion Powder', 'powder', 'red')`,
      [PRODUCT1, PRODUCT2, ORG1, ORG2],
    );
    await client.query(
      `INSERT INTO product_costs (org_id, product_id, raw_onion_rate_per_kg, processing_cost_per_kg, packaging_cost_per_kg) VALUES
         ($1, $3, 98, 20, 5), ($2, $4, 60, 18, 4)`,
      [ORG1, ORG2, PRODUCT1, PRODUCT2],
    );
    await client.query(
      `INSERT INTO price_list_items (org_id, product_id, rate, floor_price) VALUES ($1, $2, 150, 140)`,
      [ORG1, PRODUCT1],
    );
    await client.query(
      `INSERT INTO business_settings (org_id, company_name, address, city, state, pincode, bank_details)
       VALUES ($1, 'Sec One Dehydration', 'GIDC Road', 'Mahuva', 'Gujarat', '364290',
               '[{"bank_name":"Test Bank","account_no":"1234567890","ifsc":"TEST0000001","currency":"INR","is_primary":true}]'::jsonb)`,
      [ORG1],
    );
    await client.query(`UPDATE business_settings SET trade_name = 'Sec One' WHERE org_id = $1`, [ORG1]);
  });

  afterAll(async () => {
    if (client) {
      await cleanup();
      await client.end();
    }
  });

  // (1) critical: self-escalation through profiles
  it('sales cannot promote themselves by updating profiles', async () => {
    await actAs(client, SALES1);
    let rowCount: number | null = null;
    let code: string | undefined;
    try {
      const res = await client.query(
        `UPDATE profiles SET role = 'owner', modules = $1::text[] WHERE id = $2`,
        [ALL_MODULES, SALES1],
      );
      rowCount = res.rowCount;
    } catch (err) {
      code = (err as { code?: string }).code;
    }
    expect(code === '42501' || rowCount === 0, `code=${code} rowCount=${rowCount}`).toBe(true);

    // Reading own org is still fine
    const visible = await client.query('SELECT id FROM profiles');
    expect(visible.rows.length).toBe(4);

    await resetRole(client);
    const after = await client.query('SELECT role, modules FROM profiles WHERE id = $1', [SALES1]);
    expect(after.rows[0].role).toBe('sales');
    expect(after.rows[0].modules).toEqual(SALES_MODULES);
  });

  // (2) critical: view bypassing RLS
  it('v_product_costs follows the caller: sales 0 rows, accountant own org only', async () => {
    await actAs(client, SALES1);
    const asSales = await client.query('SELECT * FROM v_product_costs');
    expect(asSales.rows.length).toBe(0);

    await actAs(client, ACCT1);
    const asAcct = await client.query('SELECT org_id, total_cost_per_kg FROM v_product_costs');
    expect(asAcct.rows.length).toBe(1);
    expect(asAcct.rows[0].org_id).toBe(ORG1);
    expect(Number(asAcct.rows[0].total_cost_per_kg)).toBe(123);

    await actAs(client, OWNER2);
    const asOwner2 = await client.query('SELECT org_id FROM v_product_costs');
    expect(asOwner2.rows.map((r) => r.org_id)).toEqual([ORG2]);

    await resetRole(client);
    const opts = await client.query(
      `SELECT reloptions FROM pg_class WHERE relname = 'v_product_costs' AND relnamespace = 'public'::regnamespace`,
    );
    expect(opts.rows[0].reloptions).toContain('security_invoker=true');
  });

  // (3) high: TRUNCATE is not subject to RLS
  it('TRUNCATE raises insufficient privilege for web sessions', async () => {
    await actAs(client, SALES1);
    await expectDbError(client.query('TRUNCATE audit_log'), '42501');
    await actAs(client, OWNER1);
    await expectDbError(client.query('TRUNCATE buyers'), '42501');
    await resetRole(client);
  });

  // (5 of todo): write policies check the module (and for the catalog the role), not only the org
  it('operations / sales cannot change prices or wipe bank details; owner and accountant can', async () => {
    await actAs(client, OPS1); // holds catalog, but operations may not write the catalog
    const prices = await client.query('UPDATE price_list_items SET floor_price = 1');
    expect(prices.rowCount).toBe(0);
    const bank = await client.query(`UPDATE business_settings SET bank_details = '[]'::jsonb`);
    expect(bank.rowCount).toBe(0);
    const product = await client.query(`UPDATE products SET name = 'Hacked'`);
    expect(product.rowCount).toBe(0);
    await expectDbError( // operations has no buyers module
      client.query(
        `INSERT INTO buyers (org_id, buyer_code, company_name, buyer_type) VALUES ($1, 'SEC-B-OPS', 'Should Fail', 'domestic_masala')`,
        [ORG1],
      ),
      '42501',
    );

    await actAs(client, SALES1); // holds catalog too: the floor price stays out of reach
    const salesPrices = await client.query('UPDATE price_list_items SET floor_price = 1');
    expect(salesPrices.rowCount).toBe(0);
    await expectDbError(
      client.query(`INSERT INTO price_list_items (org_id, product_id, rate, floor_price) VALUES ($1, $2, 10, 1)`, [ORG1, PRODUCT1]),
      '42501',
    );

    // sales holds buyers -> insert allowed
    const buyer = await client.query(
      `INSERT INTO buyers (org_id, buyer_code, company_name, buyer_type) VALUES ($1, 'SEC-B-001', 'Sec Buyer', 'domestic_masala') RETURNING id`,
      [ORG1],
    );
    expect(buyer.rows.length).toBe(1);

    await actAs(client, ACCT1); // accountant with catalog
    const acct = await client.query('UPDATE price_list_items SET floor_price = 130 WHERE floor_price = 140');
    expect(acct.rowCount).toBe(1);
    await actAs(client, OWNER1);
    const owner = await client.query('UPDATE price_list_items SET floor_price = 120 WHERE floor_price = 130');
    expect(owner.rowCount).toBe(1);
    await resetRole(client);
  });

  // (medium) number generators callable by anyone
  it('fn_next_code / fn_next_doc_no are not executable by web sessions', async () => {
    await actAs(client, SALES1);
    await expectDbError(client.query(`SELECT fn_next_code('X')`), '42501');
    await expectDbError(client.query(`SELECT fn_next_doc_no('QTN')`), '42501');
    await actAs(client, OWNER1);
    await expectDbError(client.query(`SELECT fn_next_code('X')`), '42501');
    await resetRole(client);
  });

  // (4) high: audit log readable by everyone
  it('audit_log is visible only with the audit module, own org only', async () => {
    await actAs(client, SALES1);
    const asSales = await client.query('SELECT count(*)::int AS c FROM audit_log');
    expect(asSales.rows[0].c).toBe(0);

    await actAs(client, OWNER1);
    const asOwner = await client.query('SELECT DISTINCT org_id FROM audit_log');
    expect(asOwner.rows.length).toBe(1);
    expect(asOwner.rows[0].org_id).toBe(ORG1);
    await resetRole(client);
  });

  // (7) staff functions
  describe('fn_set_user_access / fn_set_user_active', () => {
    it('refuses a change to your own access (self_change)', async () => {
      await actAs(client, OWNER1);
      await expectDbError(
        client.query(`SELECT fn_set_user_access($1, 'owner', $2::text[])`, [OWNER1, ALL_MODULES]),
        '42501',
        'self_change',
      );
      await expectDbError(client.query(`SELECT fn_set_user_active($1, false)`, [OWNER1]), '42501', 'self_change');
      await resetRole(client);
    });

    it('only an owner may grant owner (role_not_allowed)', async () => {
      await actAs(client, SALES1);
      await expectDbError(
        client.query(`SELECT fn_set_user_access($1, 'owner', $2::text[])`, [ACCT1, ALL_MODULES]),
        '42501',
        'role_not_allowed',
      );
      await resetRole(client);
      const acct = await client.query('SELECT role FROM profiles WHERE id = $1', [ACCT1]);
      expect(acct.rows[0].role).toBe('accountant');
    });

    it('refuses to remove or deactivate the last active owner (last_owner)', async () => {
      await actAs(client, ACCT1);
      await expectDbError(
        client.query(`SELECT fn_set_user_access($1, 'accountant', ARRAY['dashboard'])`, [OWNER1]),
        'P0001',
        'last_owner',
      );
      await expectDbError(client.query(`SELECT fn_set_user_active($1, false)`, [OWNER1]), 'P0001', 'last_owner');
      await resetRole(client);
      const owner = await client.query('SELECT role, is_active FROM profiles WHERE id = $1', [OWNER1]);
      expect(owner.rows[0]).toEqual({ role: 'owner', is_active: true });
    });

    it('rejects unknown roles and module keys (bad_payload)', async () => {
      await actAs(client, OWNER1);
      await expectDbError(
        client.query(`SELECT fn_set_user_access($1, 'superadmin', ARRAY['dashboard'])`, [SALES1]),
        'P0001',
        'bad_payload',
      );
      await expectDbError(
        client.query(`SELECT fn_set_user_access($1, 'sales', ARRAY['dashboard', 'hacker'])`, [SALES1]),
        'P0001',
        'bad_payload',
      );
      await resetRole(client);
    });

    it('hides users of other orgs (not_found) and needs the users module (42501)', async () => {
      await actAs(client, OWNER2);
      await expectDbError(
        client.query(`SELECT fn_set_user_access($1, 'sales', ARRAY['dashboard'])`, [SALES1]),
        '42501',
        'not_found',
      );
      await expectDbError(client.query(`SELECT fn_set_user_active($1, false)`, [SALES1]), '42501', 'not_found');

      await actAs(client, OPS1); // no users module
      await expectDbError(
        client.query(`SELECT fn_set_user_access($1, 'sales', ARRAY['dashboard'])`, [SALES1]),
        '42501',
        /Access denied: module users is required/,
      );
      await resetRole(client);
    });

    it('owner changes a sales user and the profile row reflects it', async () => {
      await actAs(client, OWNER1);
      await client.query(`SELECT fn_set_user_access($1, 'sales', ARRAY['dashboard', 'leads'])`, [SALES1]);
      await client.query(`SELECT fn_set_user_active($1, false)`, [SALES1]);

      // Owner sees the result through the normal (RLS) read path
      const seen = await client.query('SELECT role, modules, is_active FROM profiles WHERE id = $1', [SALES1]);
      expect(seen.rows[0]).toEqual({ role: 'sales', modules: ['dashboard', 'leads'], is_active: false });

      // Inactive user holds nothing any more
      await actAs(client, SALES1);
      const role = await client.query('SELECT fn_user_role() AS r, fn_has_module($1) AS m', ['leads']);
      expect(role.rows[0]).toEqual({ r: null, m: false });

      // Reactivate and restore the fixture
      await actAs(client, OWNER1);
      await client.query(`SELECT fn_set_user_active($1, true)`, [SALES1]);
      await client.query(`SELECT fn_set_user_access($1, 'sales', $2::text[])`, [SALES1, SALES_MODULES]);
      await resetRole(client);

      const audit = await client.query(
        `SELECT count(*)::int AS c FROM audit_log WHERE org_id = $1 AND table_name = 'profiles' AND record_id = $2 AND action = 'UPDATE'`,
        [ORG1, SALES1],
      );
      expect(audit.rows[0].c).toBeGreaterThanOrEqual(4);
    });
  });

  // (SEC1-01) a switched-off login must still read its own profile row so the app can show
  // /account-inactive instead of looping login -> / -> login; every other row stays hidden.
  it('a switched-off user reads only their own profile row and nothing else', async () => {
    await resetRole(client);
    await client.query(
      `INSERT INTO buyers (org_id, buyer_code, company_name, buyer_type)
       VALUES ($1, 'SEC-B-OFF', 'Hidden From Off User', 'domestic_masala') ON CONFLICT DO NOTHING`,
      [ORG1],
    );
    await client.query(`UPDATE profiles SET is_active = false WHERE id = $1`, [OPS1]);
    try {
      await actAs(client, OPS1);
      const own = await client.query('SELECT id, org_id, is_active FROM profiles');
      expect(own.rows).toEqual([{ id: OPS1, org_id: ORG1, is_active: false }]);

      expect((await client.query('SELECT fn_current_org() AS o')).rows[0].o).toBeNull();
      const buyers = await client.query('SELECT count(*)::int AS c FROM buyers');
      expect(buyers.rows[0].c).toBe(0);
      const orgs = await client.query('SELECT count(*)::int AS c FROM organizations');
      expect(orgs.rows[0].c).toBe(0);
      const settings = await client.query('SELECT count(*)::int AS c FROM business_settings');
      expect(settings.rows[0].c).toBe(0);
    } finally {
      await resetRole(client);
      await client.query(`UPDATE profiles SET is_active = true WHERE id = $1`, [OPS1]);
    }

    // Back on: the whole org is visible again
    await actAs(client, OPS1);
    expect((await client.query('SELECT count(*)::int AS c FROM profiles')).rows[0].c).toBe(4);
    await resetRole(client);
  });

  // (8) medium: GUC overrides
  it('session GUC overrides are ignored for web sessions, honoured for trusted scripts', async () => {
    await actAs(client, SALES1);
    await client.query(`SELECT set_config('app.current_org', $1, false)`, [ORG2]);
    const org = await client.query('SELECT fn_current_org() AS o');
    expect(org.rows[0].o).toBe(ORG1);

    await client.query(`SELECT set_config('app.override_module_check', 'true', false)`);
    await expectDbError(client.query(`SELECT fn_require_module('payments')`), '42501');
    const stillSales = await client.query('SELECT count(*)::int AS c FROM v_product_costs');
    expect(stillSales.rows[0].c).toBe(0);

    await resetRole(client); // clears both GUCs
    expect((await client.query('SELECT fn_current_org() AS o')).rows[0].o).toBeNull();

    // postgres (seed / test scripts) may still scope itself to an org
    await client.query(`SELECT set_config('app.current_org', $1, false)`, [ORG2]);
    expect((await client.query('SELECT fn_current_org() AS o')).rows[0].o).toBe(ORG2);
    await resetRole(client);
  });

  // (9) audit snapshots
  it('audit snapshots carry no bank details and no cost rows', async () => {
    const bs = await client.query(
      `SELECT action, old_data, new_data FROM audit_log WHERE org_id = $1 AND table_name = 'business_settings' ORDER BY created_at`,
      [ORG1],
    );
    expect(bs.rows.length).toBeGreaterThanOrEqual(2);
    for (const row of bs.rows) {
      for (const snapshot of [row.old_data, row.new_data]) {
        if (snapshot) {
          expect(Object.keys(snapshot)).not.toContain('bank_details');
          expect(snapshot.company_name).toBe('Sec One Dehydration');
        }
      }
    }
    const costs = await client.query(
      `SELECT count(*)::int AS c FROM audit_log WHERE org_id = $1 AND table_name = 'product_costs'`,
      [ORG1],
    );
    expect(costs.rows[0].c).toBe(0);
  });

  it('helpers: fn_has_module never raises, fn_user_role is NULL without a session', async () => {
    await actAs(client, SALES1);
    const r = await client.query(
      `SELECT fn_has_module('leads') AS a, fn_has_module('payments') AS b, fn_has_module(NULL) AS c, fn_user_role() AS r`,
    );
    expect(r.rows[0]).toEqual({ a: true, b: false, c: false, r: 'sales' });
    await resetRole(client);
    const none = await client.query(`SELECT fn_has_module('leads') AS a, fn_user_role() AS r`);
    expect(none.rows[0]).toEqual({ a: false, r: null });
  });

  it('grants: no writes on profiles / audit_log / counters / organizations, no TRUNCATE anywhere', async () => {
    const res = await client.query(`
      SELECT c.relname,
             has_table_privilege('authenticated', c.oid, 'TRUNCATE') AS can_truncate,
             has_table_privilege('authenticated', c.oid, 'UPDATE') AS can_update,
             has_table_privilege('authenticated', c.oid, 'SELECT') AS can_select
      FROM pg_class c
      WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'v')
    `);
    const byName = new Map<string, { can_truncate: boolean; can_update: boolean; can_select: boolean }>(
      res.rows.map((r) => [r.relname as string, r]),
    );
    expect(res.rows.filter((r) => r.can_truncate).map((r) => r.relname)).toEqual([]);
    for (const locked of ['profiles', 'audit_log', 'organizations', 'doc_counters', 'entity_code_counters', 'v_product_costs']) {
      expect(byName.get(locked)?.can_update, locked).toBe(false);
      expect(byName.get(locked)?.can_select, locked).toBe(true);
    }
    // buyers stays editable (at least some columns: 0004 narrows the grant to keep buyer_code locked)
    const buyersUpd = await client.query(`SELECT has_any_column_privilege('authenticated', 'buyers', 'UPDATE') AS ok`);
    expect(buyersUpd.rows[0].ok).toBe(true);
  });

  it('fn_assign_code fills codes from a BEFORE INSERT trigger even though the session cannot call fn_next_code; web sessions cannot supply one', async () => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS zz_sec_codes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        code text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_zz_sec_codes_org_id ON zz_sec_codes(org_id);
      ALTER TABLE zz_sec_codes ENABLE ROW LEVEL SECURITY;
      ALTER TABLE zz_sec_codes FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS zz_sec_codes_all ON zz_sec_codes;
      CREATE POLICY zz_sec_codes_all ON zz_sec_codes FOR ALL
        USING (org_id = fn_current_org()) WITH CHECK (org_id = fn_current_org());
      DROP TRIGGER IF EXISTS trg_zz_sec_codes_code ON zz_sec_codes;
      CREATE TRIGGER trg_zz_sec_codes_code BEFORE INSERT ON zz_sec_codes
        FOR EACH ROW EXECUTE FUNCTION fn_assign_code('SEC', 'code');
    `);

    // Default privileges from 0003: the new table has SELECT/INSERT/UPDATE/DELETE but no TRUNCATE
    const priv = await client.query(
      `SELECT has_table_privilege('authenticated', 'zz_sec_codes', 'INSERT') AS ins,
              has_table_privilege('authenticated', 'zz_sec_codes', 'TRUNCATE') AS tr`,
    );
    expect(priv.rows[0]).toEqual({ ins: true, tr: false });

    await actAs(client, OWNER1);
    const first = await client.query(`INSERT INTO zz_sec_codes (org_id) VALUES ($1) RETURNING code`, [ORG1]);
    const second = await client.query(`INSERT INTO zz_sec_codes (org_id) VALUES ($1) RETURNING code`, [ORG1]);
    // A web session never chooses its own code (SEC2-02): supplied or pre-claimed codes are replaced.
    const supplied = await client.query(
      `INSERT INTO zz_sec_codes (org_id, code) VALUES ($1, 'SEC-0004') RETURNING code`,
      [ORG1],
    );
    const fourth = await client.query(`INSERT INTO zz_sec_codes (org_id) VALUES ($1) RETURNING code`, [ORG1]);
    expect(first.rows[0].code).toBe('SEC-0001');
    expect(second.rows[0].code).toBe('SEC-0002');
    expect(supplied.rows[0].code).toBe('SEC-0003');
    expect(fourth.rows[0].code).toBe('SEC-0004');

    await resetRole(client);
    // Trusted callers (seeds / tests as postgres) keep an explicit code.
    await client.query(`SELECT set_config('app.current_org', $1, false)`, [ORG1]);
    const explicit = await client.query(
      `INSERT INTO zz_sec_codes (org_id, code) VALUES ($1, 'KEEP-ME') RETURNING code`,
      [ORG1],
    );
    expect(explicit.rows[0].code).toBe('KEEP-ME');
    await resetRole(client);
    await client.query('DROP TABLE IF EXISTS zz_sec_codes');
  });

  // ------------------------------------------------------------------ Sprint C (Dev-2)
  describe('Sprint C hardening: 0007 (A10, SEC1-03), actAs claims (SEC1-05), modules (SEC1-08)', () => {
    // What a web session reaches (0007 section 3); trigger functions, generators and internal helpers stay locked.
    const WEB_CALLABLE = [
      'fn_current_org', 'fn_has_module', 'fn_user_role', 'fn_require_module', 'fn_follow_up_module',
      'fn_set_user_access', 'fn_set_user_active', 'fn_inquiry_set_status', 'fn_follow_up_done',
      'fn_sample_create', 'fn_sample_set_status', 'fn_quote_send', 'fn_quote_reject', 'fn_quote_update_draft',
      'fn_quote_accept', 'fn_order_set_status', 'fn_order_set_packed', 'fn_order_dispatch',
      'fn_dispatch_tick', 'fn_dispatch_delivered', 'fn_payment_record', 'fn_order_advance_waiting',
    ];
    const LOCKED = ['fn_next_code', 'fn_next_doc_no', 'fn_is_active', 'fn_current_fy', 'fn_format_money', 'fn_audit', 'fn_assign_code', 'fn_assign_doc_no'];

    async function runHardening() {
      const sql = fs.readFileSync(path.resolve(__dirname, '..', 'supabase', 'migrations', '0007_hardening.sql'), 'utf-8');
      await resetRole(client);
      await client.query('BEGIN');
      try {
        await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [73_003]); // same lock as applyMigrations
        await client.query(sql);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    it('A10: PUBLIC and anon execute no public function; definers pin search_path; web sessions keep the helpers and RPCs only', async () => {
      await resetRole(client);
      const res = await client.query(`
        SELECT p.proname, p.prosecdef AS def, p.prorettype = 'trigger'::regtype AS trig,
               'search_path=public' = ANY (COALESCE(p.proconfig, '{}'::text[])) AS pins,
               has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
               has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
               EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
                       WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE') AS public_exec,
               EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e') AS ext
        FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace`);
      const rows = res.rows as { proname: string; def: boolean; trig: boolean; pins: boolean; auth: boolean; anon: boolean; public_exec: boolean; ext: boolean }[];
      expect(rows.length).toBeGreaterThan(30);
      expect(rows.filter((r) => r.anon || r.public_exec).map((r) => r.proname)).toEqual([]);
      expect(rows.filter((r) => r.def && !r.pins).map((r) => r.proname)).toEqual([]);
      expect(rows.filter((r) => r.trig && r.auth).map((r) => r.proname)).toEqual([]);
      expect(rows.filter((r) => r.ext && r.auth).map((r) => r.proname)).toEqual([]); // pgcrypto on plain Postgres
      const callable = new Set(rows.filter((r) => r.auth).map((r) => r.proname));
      for (const name of WEB_CALLABLE) expect(callable.has(name), name).toBe(true);
      for (const name of LOCKED) expect(callable.has(name), name).toBe(false);

      // as the roles themselves
      await actAs(client, SALES1);
      await expectDbError(client.query(`SELECT fn_is_active()`), '42501');
      await expectDbError(client.query(`SELECT fn_current_fy()`), '42501');
      await expectDbError(client.query(`SELECT fn_format_money(1, 'INR')`), '42501');
      await expectDbError(client.query(`SELECT public.gen_salt('bf')`), '42501');
      expect((await client.query(`SELECT fn_current_org() AS o, fn_user_role() AS r`)).rows[0]).toEqual({ o: ORG1, r: 'sales' });
      await resetRole(client);
      await client.query('SET ROLE anon');
      await expectDbError(client.query(`SELECT fn_current_org()`), '42501');
      await expectDbError(client.query(`SELECT fn_sample_set_status($1, 'sent')`, [PRODUCT1]), '42501');
      await resetRole(client);
    });

    it('A10: default privileges grant a new function to nobody (not PUBLIC, anon or authenticated)', async () => {
      await resetRole(client);
      await client.query('BEGIN');
      try {
        await client.query(`CREATE FUNCTION zz_sec_default_priv() RETURNS integer LANGUAGE sql AS 'SELECT 1'`);
        const r = await client.query(`
          SELECT has_function_privilege('authenticated', 'zz_sec_default_priv()', 'EXECUTE') AS auth,
                 has_function_privilege('anon', 'zz_sec_default_priv()', 'EXECUTE') AS anon`);
        expect(r.rows[0]).toEqual({ auth: false, anon: false });
      } finally {
        await client.query('ROLLBACK');
      }
    });

    it('SEC1-03: 0007 deletes legacy cost snapshots and strips bank details from old audit rows; a re-run is a no-op', async () => {
      await resetRole(client);
      const legacy = await client.query(
        `INSERT INTO audit_log (org_id, table_name, record_id, action, old_data, new_data) VALUES
           ($1, 'product_costs', $2, 'UPDATE', '{"raw_onion_rate_per_kg": 98}', '{"raw_onion_rate_per_kg": 99}'),
           ($1, 'business_settings', $1, 'UPDATE',
            '{"company_name": "Sec One Dehydration", "bank_details": [{"account_no": "111"}]}',
            '{"company_name": "Sec One Dehydration", "bank_details": [{"account_no": "222"}]}')
         RETURNING id`,
        [ORG1, PRODUCT1],
      );
      const ids = legacy.rows.map((r) => r.id);
      const leaks = async () =>
        (
          await client.query(`
            SELECT (SELECT count(*)::int FROM audit_log WHERE table_name = 'product_costs') AS costs,
                   (SELECT count(*)::int FROM audit_log WHERE table_name = 'business_settings'
                      AND (old_data ? 'bank_details' OR new_data ? 'bank_details')) AS bank`)
        ).rows[0];
      expect((await leaks()).costs).toBeGreaterThanOrEqual(1);

      await runHardening();
      expect(await leaks()).toEqual({ costs: 0, bank: 0 });
      const kept = await client.query(`SELECT new_data FROM audit_log WHERE id = ANY($1::uuid[])`, [ids]);
      expect(kept.rows).toEqual([{ new_data: { company_name: 'Sec One Dehydration' } }]); // the settings row stays, without bank details

      await runHardening(); // re-runnable
      expect(await leaks()).toEqual({ costs: 0, bank: 0 });
      await client.query(`DELETE FROM audit_log WHERE id = ANY($1::uuid[])`, [ids]);
    });

    it('SEC1-05: actAs sets request.jwt.claims as Supabase reads it, and resetRole clears it', async () => {
      await actAs(client, SALES1);
      const r = await client.query(`
        SELECT current_setting('request.jwt.claims', true)::jsonb AS claims,
               NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid AS supabase_uid,
               auth.uid() AS local_uid, current_user AS role`);
      expect(r.rows[0]).toEqual({ claims: { sub: SALES1, role: 'authenticated' }, supabase_uid: SALES1, local_uid: SALES1, role: 'authenticated' });
      await resetRole(client);
      const after = await client.query(`SELECT current_setting('request.jwt.claims', true) AS c, auth.uid() AS uid`);
      expect(after.rows[0]).toEqual({ c: '', uid: null });
    });

    it('SEC1-08: fn_set_user_access stores each module once, in the order given, and refuses more than 13 entries', async () => {
      await actAs(client, OWNER1);
      await client.query(`SELECT fn_set_user_access($1, 'sales', ARRAY['quotes', 'dashboard', 'quotes', 'leads', 'dashboard'])`, [SALES1]);
      expect((await client.query(`SELECT modules FROM profiles WHERE id = $1`, [SALES1])).rows[0].modules).toEqual(['quotes', 'dashboard', 'leads']);
      await expectDbError(
        client.query(`SELECT fn_set_user_access($1, 'sales', $2::text[])`, [SALES1, Array(14).fill('dashboard')]),
        'P0001',
        'bad_payload',
      );
      await client.query(`SELECT fn_set_user_access($1, 'sales', $2::text[])`, [SALES1, ALL_MODULES]); // all 13 still fit
      await client.query(`SELECT fn_set_user_access($1, 'sales', $2::text[])`, [SALES1, SALES_MODULES]); // restore the fixture
      expect((await client.query(`SELECT modules FROM profiles WHERE id = $1`, [SALES1])).rows[0].modules).toEqual(SALES_MODULES);
      await resetRole(client);
    });
  });
});
