import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });
dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/onion_crm';

describe('Stage 0 Multi-Tenant RLS & 3-Wall Permissions', () => {
  let client: Client;

  const orgAId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const orgBId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const userAId = 'aaaaaaaa-1111-4aaa-8aaa-111111111111';
  const userBId = 'bbbbbbbb-1111-4bbb-8bbb-111111111111';
  const salesAId = 'aaaaaaaa-2222-4aaa-8aaa-222222222222';

  beforeAll(async () => {
    client = new Client({ connectionString });
    await client.connect();

    // Ensure schema is applied
    const mig0001 = fs.readFileSync(path.join(__dirname, '../supabase/migrations/0001_core_system.sql'), 'utf-8');
    const mig0002 = fs.readFileSync(path.join(__dirname, '../supabase/migrations/0002_catalog_and_buyers.sql'), 'utf-8');
    await client.query(mig0001);
    await client.query(mig0002);

    // Clean up any test fixtures from prior runs
    await client.query(`
      DELETE FROM audit_log WHERE org_id IN ('${orgAId}', '${orgBId}');
      DELETE FROM buyers WHERE org_id IN ('${orgAId}', '${orgBId}');
      DELETE FROM profiles WHERE org_id IN ('${orgAId}', '${orgBId}');
      DELETE FROM doc_counters WHERE org_id IN ('${orgAId}', '${orgBId}');
      DELETE FROM entity_code_counters WHERE org_id IN ('${orgAId}', '${orgBId}');
      DELETE FROM organizations WHERE id IN ('${orgAId}', '${orgBId}');
    `);

    // 1. Create Organization A and Organization B
    await client.query(`
      INSERT INTO organizations (id, name, code)
      VALUES
        ('${orgAId}', 'Tenant A Dehydrators', 'TEN-A'),
        ('${orgBId}', 'Tenant B Agro Exports', 'TEN-B')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 2. Insert auth users
    await client.query(`
      INSERT INTO auth.users (id, email)
      VALUES
        ('${userAId}', 'admin@tenant-a.com'),
        ('${userBId}', 'admin@tenant-b.com'),
        ('${salesAId}', 'sales@tenant-a.com')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 3. Profiles for tenant users
    await client.query(`
      INSERT INTO profiles (id, org_id, email, full_name, role, modules, is_active)
      VALUES
        ('${userAId}', '${orgAId}', 'admin@tenant-a.com', 'Admin A', 'owner', ARRAY['dashboard', 'orders', 'payments', 'buyers', 'settings'], true),
        ('${userBId}', '${orgBId}', 'admin@tenant-b.com', 'Admin B', 'owner', ARRAY['dashboard', 'orders', 'buyers'], true),
        ('${salesAId}', '${orgAId}', 'sales@tenant-a.com', 'Sales A', 'sales', ARRAY['dashboard', 'leads', 'buyers', 'orders'], true)
      ON CONFLICT (id) DO UPDATE SET org_id = EXCLUDED.org_id, modules = EXCLUDED.modules;
    `);

    // 4. Insert Buyer in Org A and Buyer in Org B
    await client.query(`
      INSERT INTO buyers (id, org_id, buyer_code, company_name, buyer_type)
      VALUES
        (gen_random_uuid(), '${orgAId}', 'BUY-A001', 'Tenant A Domestic Buyer', 'domestic_masala'),
        (gen_random_uuid(), '${orgBId}', 'BUY-B001', 'Tenant B Export Buyer', 'export_importer');
    `);
  });

  afterAll(async () => {
    if (client) {
      await client.query(`RESET ROLE;`);
      await client.query(`
        DELETE FROM audit_log WHERE org_id IN ('${orgAId}', '${orgBId}');
        DELETE FROM buyers WHERE org_id IN ('${orgAId}', '${orgBId}');
        DELETE FROM profiles WHERE org_id IN ('${orgAId}', '${orgBId}');
        DELETE FROM doc_counters WHERE org_id IN ('${orgAId}', '${orgBId}');
        DELETE FROM entity_code_counters WHERE org_id IN ('${orgAId}', '${orgBId}');
        DELETE FROM organizations WHERE id IN ('${orgAId}', '${orgBId}');
      `);
      await client.end();
    }
  });

  it('Tenant A session cannot read Tenant B data via RLS', async () => {
    // Switch to authenticated non-superuser role to enforce RLS
    await client.query(`SET ROLE authenticated;`);
    await client.query(`SELECT set_config('request.jwt.claim.sub', '${userAId}', false);`);

    // Org A user queries buyers: should return only Org A's buyer
    const resA = await client.query(`SELECT buyer_code, company_name FROM buyers;`);
    expect(resA.rows.length).toBe(1);
    expect(resA.rows[0].buyer_code).toBe('BUY-A001');

    // Attempt to select Org B data directly
    const resB = await client.query(`SELECT * FROM buyers WHERE org_id = '${orgBId}';`);
    expect(resB.rows.length).toBe(0);

    // Switch to Tenant B session
    await client.query(`SELECT set_config('request.jwt.claim.sub', '${userBId}', false);`);
    const resBUser = await client.query(`SELECT buyer_code, company_name FROM buyers;`);
    expect(resBUser.rows.length).toBe(1);
    expect(resBUser.rows[0].buyer_code).toBe('BUY-B001');

    await client.query(`RESET ROLE;`);
  });

  it('Tenant A session cannot update or delete Tenant B data', async () => {
    await client.query(`SET ROLE authenticated;`);
    await client.query(`SELECT set_config('request.jwt.claim.sub', '${userAId}', false);`);

    const updateRes = await client.query(`
      UPDATE buyers SET company_name = 'Hacked' WHERE org_id = '${orgBId}';
    `);
    expect(updateRes.rowCount).toBe(0);

    const deleteRes = await client.query(`
      DELETE FROM buyers WHERE org_id = '${orgBId}';
    `);
    expect(deleteRes.rowCount).toBe(0);

    await client.query(`RESET ROLE;`);
  });

  it('Database Wall: fn_require_module allows held module and rejects missing module', async () => {
    await client.query(`SET ROLE authenticated;`);
    await client.query(`SELECT set_config('request.jwt.claim.sub', '${salesAId}', false);`);

    // Sales has 'orders' module -> should succeed
    const allowed = await client.query(`SELECT fn_require_module('orders');`);
    expect(allowed.rows[0].fn_require_module).toBe(true);

    // Sales does NOT have 'payments' module -> must raise error 42501
    await expect(client.query(`SELECT fn_require_module('payments');`)).rejects.toThrow(
      /Access denied: module payments is required/
    );

    await client.query(`RESET ROLE;`);
  });

  it('Generates atomic sequential entity codes (INQ, BUY, ORD)', async () => {
    await client.query(`SET ROLE authenticated;`);
    await client.query(`SELECT set_config('request.jwt.claim.sub', '${userAId}', false);`);

    const code1 = await client.query(`SELECT fn_next_code('INQ');`);
    const code2 = await client.query(`SELECT fn_next_code('INQ');`);
    expect(code1.rows[0].fn_next_code).toBe('INQ-0001');
    expect(code2.rows[0].fn_next_code).toBe('INQ-0002');

    await client.query(`RESET ROLE;`);
  });

  it('Generates Indian Financial Year document numbers (QTN-2627-0001)', async () => {
    await client.query(`SET ROLE authenticated;`);
    await client.query(`SELECT set_config('request.jwt.claim.sub', '${userAId}', false);`);

    const docNo = await client.query(`SELECT fn_next_doc_no('QTN');`);
    expect(docNo.rows[0].fn_next_doc_no).toMatch(/^QTN-\d{4}-0001$/);

    await client.query(`RESET ROLE;`);
  });
});
