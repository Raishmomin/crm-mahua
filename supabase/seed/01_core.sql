-- Seed 01: Mahuva CRM demo organization (core)
-- Org, 4 demo users, business identity, 6 onion products, packaging, price list, costs, buyers, contacts.
-- Idempotent: fixed UUIDs + ON CONFLICT (id) DO UPDATE everywhere, so `npm run db:seed` can be re-run
-- any number of times and resets the demo story.
--
-- Demo logins (password for all four: DemoPass123! - demo only):
--   admin@mahuvacrm.com (owner), accountant@mahuvacrm.com, sales@mahuvacrm.com, ops@mahuvacrm.com
--
-- Auth rows:
--   * local auth shim (plain Postgres, migration 0000): inserted here with real bcrypt hashes (pgcrypto)
--   * real Supabase (role supabase_auth_admin exists): created by scripts/seed-users.ts with the same ids;
--     this file never writes to auth.users there.

DO $$
DECLARE
  v_org_id uuid := '11111111-1111-4111-8111-111111111111';
  v_admin_id uuid := '22222222-2222-4222-8222-222222222221';
  v_accountant_id uuid := '22222222-2222-4222-8222-222222222222';
  v_sales_id uuid := '22222222-2222-4222-8222-222222222223';
  v_ops_id uuid := '22222222-2222-4222-8222-222222222224';

  v_p1_id uuid := '33333333-3333-4333-8333-333333333331';
  v_p2_id uuid := '33333333-3333-4333-8333-333333333332';
  v_p3_id uuid := '33333333-3333-4333-8333-333333333333';
  v_p4_id uuid := '33333333-3333-4333-8333-333333333334';
  v_p5_id uuid := '33333333-3333-4333-8333-333333333335';
  v_p6_id uuid := '33333333-3333-4333-8333-333333333336';

  v_pkg1_id uuid := '44444444-4444-4444-8444-444444444441';
  v_pkg2_id uuid := '44444444-4444-4444-8444-444444444442';
  v_pkg3_id uuid := '44444444-4444-4444-8444-444444444443';

  v_buyer1_id uuid := '55555555-5555-4555-8555-555555555551';
  v_buyer2_id uuid := '55555555-5555-4555-8555-555555555552';
  v_buyer3_id uuid := '55555555-5555-4555-8555-555555555553';
  v_buyer4_id uuid := '55555555-5555-4555-8555-555555555554';

  v_demo_password text := 'DemoPass123!';
  v_local_shim boolean;
BEGIN

  -- Local auth shim (no GoTrue) vs real Supabase
  v_local_shim :=
    (
      to_regclass('auth.identities') IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin')
    )
    OR COALESCE(obj_description(to_regclass('auth.users'), 'pg_class'), '') = 'mahua-crm local auth shim';

  -- 1. Organization
  INSERT INTO organizations (id, name, code, currency, tax_mode)
  VALUES (v_org_id, 'Mahuva Dehydration Private Limited', 'MDPL', 'INR', 'regular_gst')
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code;

  -- 2. Auth users (local shim only). On Supabase scripts/seed-users.ts has created them already.
  IF v_local_shim THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    )
    VALUES
      (v_admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@mahuvacrm.com',
        crypt(v_demo_password, gen_salt('bf', 10)), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Hareshbhai Mehta"}'::jsonb, now(), now()),
      (v_accountant_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'accountant@mahuvacrm.com',
        crypt(v_demo_password, gen_salt('bf', 10)), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nileshbhai Shah"}'::jsonb, now(), now()),
      (v_sales_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sales@mahuvacrm.com',
        crypt(v_demo_password, gen_salt('bf', 10)), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Pooja Patel"}'::jsonb, now(), now()),
      (v_ops_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ops@mahuvacrm.com',
        crypt(v_demo_password, gen_salt('bf', 10)), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Dineshbhai Vaghela"}'::jsonb, now(), now())
    ON CONFLICT (id) DO UPDATE SET
      instance_id = EXCLUDED.instance_id,
      aud = EXCLUDED.aud,
      role = EXCLUDED.role,
      email = EXCLUDED.email,
      encrypted_password = EXCLUDED.encrypted_password,
      email_confirmed_at = COALESCE(auth.users.email_confirmed_at, EXCLUDED.email_confirmed_at),
      raw_app_meta_data = EXCLUDED.raw_app_meta_data,
      raw_user_meta_data = EXCLUDED.raw_user_meta_data,
      updated_at = now();

    -- identities: id = user id keeps this idempotent without a unique index on (provider, provider_id)
    INSERT INTO auth.identities (id, user_id, provider, provider_id, identity_data, created_at, updated_at)
    SELECT u.id, u.id, 'email', u.id::text,
           jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
           now(), now()
    FROM auth.users u
    WHERE u.id IN (v_admin_id, v_accountant_id, v_sales_id, v_ops_id)
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      provider = EXCLUDED.provider,
      provider_id = EXCLUDED.provider_id,
      identity_data = EXCLUDED.identity_data,
      updated_at = now();
  END IF;

  -- 3. Profiles with module entitlements
  -- Owner: all 13 modules in the DB (documents / reports / audit are hidden from the menu in the demo)
  INSERT INTO profiles (id, org_id, email, full_name, role, modules, is_active)
  VALUES (
    v_admin_id,
    v_org_id,
    'admin@mahuvacrm.com',
    'Hareshbhai Mehta',
    'owner',
    ARRAY['dashboard', 'leads', 'buyers', 'samples', 'quotes', 'orders', 'payments', 'catalog', 'documents', 'reports', 'users', 'settings', 'audit'],
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    org_id = EXCLUDED.org_id, email = EXCLUDED.email, full_name = EXCLUDED.full_name,
    role = EXCLUDED.role, modules = EXCLUDED.modules, is_active = true, updated_at = now();

  -- Accounts (accountant): money, orders, quotes, settings
  INSERT INTO profiles (id, org_id, email, full_name, role, modules, is_active)
  VALUES (
    v_accountant_id,
    v_org_id,
    'accountant@mahuvacrm.com',
    'Nileshbhai Shah',
    'accountant',
    ARRAY['dashboard', 'buyers', 'quotes', 'orders', 'payments', 'catalog', 'documents', 'reports', 'settings', 'audit'],
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    org_id = EXCLUDED.org_id, email = EXCLUDED.email, full_name = EXCLUDED.full_name,
    role = EXCLUDED.role, modules = EXCLUDED.modules, is_active = true, updated_at = now();

  -- Sales: inquiries, buyers, samples, quotes, orders (no cost data)
  INSERT INTO profiles (id, org_id, email, full_name, role, modules, is_active)
  VALUES (
    v_sales_id,
    v_org_id,
    'sales@mahuvacrm.com',
    'Pooja Patel',
    'sales',
    ARRAY['dashboard', 'leads', 'buyers', 'samples', 'quotes', 'orders', 'catalog', 'documents', 'reports'],
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    org_id = EXCLUDED.org_id, email = EXCLUDED.email, full_name = EXCLUDED.full_name,
    role = EXCLUDED.role, modules = EXCLUDED.modules, is_active = true, updated_at = now();

  -- Plant (operations): samples, orders, packing, dispatch
  INSERT INTO profiles (id, org_id, email, full_name, role, modules, is_active)
  VALUES (
    v_ops_id,
    v_org_id,
    'ops@mahuvacrm.com',
    'Dineshbhai Vaghela',
    'operations',
    ARRAY['dashboard', 'buyers', 'samples', 'orders', 'catalog', 'documents'],
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    org_id = EXCLUDED.org_id, email = EXCLUDED.email, full_name = EXCLUDED.full_name,
    role = EXCLUDED.role, modules = EXCLUDED.modules, is_active = true, updated_at = now();

  -- 4. Business Settings
  INSERT INTO business_settings (
    org_id, company_name, trade_name, gstin, iec_code, pan, fssai_no,
    address, city, state, pincode, country, bank_details, authorized_signatory,
    contact_email, contact_phone
  )
  VALUES (
    v_org_id,
    'Mahuva Dehydration Private Limited',
    'Mahuva Dehydro Foods',
    '24AAACM1234F1Z5',
    '0309012345',
    'AAACM1234F',
    '10019021004321',
    'Plot 42, GIDC Industrial Estate, Nesvad Road',
    'Mahuva',
    'Gujarat',
    '364290',
    'India',
    '[
      {
        "bank_name": "State Bank of India",
        "account_no": "30491823749",
        "ifsc": "SBIN0000421",
        "branch": "Mahuva Main",
        "swift": "SBININBB421",
        "currency": "INR",
        "is_primary": true
      },
      {
        "bank_name": "HDFC Bank",
        "account_no": "50200029384712",
        "ifsc": "HDFC0000842",
        "branch": "Station Road Mahuva",
        "swift": "HDFCINBB",
        "currency": "USD",
        "is_primary": false
      }
    ]'::jsonb,
    'Hareshbhai Mehta (Director)',
    'export@mahuvacrm.com',
    '+91 98250 12345'
  )
  ON CONFLICT (org_id) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    trade_name = EXCLUDED.trade_name,
    gstin = EXCLUDED.gstin,
    bank_details = EXCLUDED.bank_details,
    updated_at = now();

  -- 5. App Settings
  INSERT INTO app_settings (org_id, settings)
  VALUES (
    v_org_id,
    '{
      "default_payment_terms": "30% Advance, 70% against BL copy",
      "default_incoterm": "FOB Mundra",
      "currency_rates": { "USD": 84.25, "EUR": 91.50, "GBP": 108.10 },
      "auto_generate_sdn": true,
      "moisture_rejection_threshold_pct": 6.5
    }'::jsonb
  )
  ON CONFLICT (org_id) DO UPDATE SET settings = EXCLUDED.settings, updated_at = now();

  -- 6. Packaging Types
  INSERT INTO packaging_types (id, org_id, name, tare_weight_kg, capacity_kg)
  VALUES
    (v_pkg1_id, v_org_id, '25 kg Multi-wall Paper Bag with LDPE Poly Liner', 0.450, 25.00),
    (v_pkg2_id, v_org_id, '25 kg Heavy Duty Corrugated Carton (5-ply)', 0.850, 25.00),
    (v_pkg3_id, v_org_id, '20 kg Export Carton with Vacuum Nitrogen Flush', 0.900, 20.00)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, tare_weight_kg = EXCLUDED.tare_weight_kg, capacity_kg = EXCLUDED.capacity_kg;

  -- 7. Six Dehydrated Onion Products
  INSERT INTO products (id, org_id, code, name, form, color, moisture_max_pct, mesh, grade, hsn_code, gst_rate)
  VALUES
    (v_p1_id, v_org_id, 'W-FLK-A', 'Dehydrated White Onion Flakes (A-Grade)', 'flakes', 'white', 5.50, '8-15 mm', 'A Grade', '07122000', 5.00),
    (v_p2_id, v_org_id, 'W-MIN-A', 'Dehydrated White Onion Minced', 'minced', 'white', 5.50, '1-3 mm', 'A Grade', '07122000', 5.00),
    (v_p3_id, v_org_id, 'W-POW-P', 'Dehydrated White Onion Powder (Premium 100 Mesh)', 'powder', 'white', 4.50, '100 mesh', 'Premium Export', '07122000', 5.00),
    (v_p4_id, v_org_id, 'R-FLK-C', 'Dehydrated Red Onion Flakes (Commercial)', 'flakes', 'red', 6.00, '10-20 mm', 'Commercial', '07122000', 5.00),
    (v_p5_id, v_org_id, 'R-POW-S', 'Dehydrated Red Onion Powder (Standard)', 'powder', 'red', 5.00, '80-100 mesh', 'A Grade', '07122000', 5.00),
    (v_p6_id, v_org_id, 'P-CHP-E', 'Dehydrated Pink Onion Chopped (Export Grade)', 'chopped', 'pink', 5.00, '3-5 mm', 'Premium Export', '07122000', 5.00)
  ON CONFLICT (org_id, code) DO UPDATE SET name = EXCLUDED.name, moisture_max_pct = EXCLUDED.moisture_max_pct;

  -- 8. Price List Items (Domestic INR per kg and Export USD per MT, with floor prices)
  INSERT INTO price_list_items (id, org_id, product_id, tier_name, currency, unit, rate, floor_price, is_active)
  VALUES
    ('66666666-6666-4666-8666-666666666601', v_org_id, v_p1_id, 'Domestic Standard', 'INR', 'kg', 185.00, 165.00, true),
    ('66666666-6666-4666-8666-666666666602', v_org_id, v_p1_id, 'Export FOB Mundra', 'USD', 'MT', 2250.00, 2050.00, true),
    ('66666666-6666-4666-8666-666666666603', v_org_id, v_p2_id, 'Domestic Standard', 'INR', 'kg', 195.00, 175.00, true),
    ('66666666-6666-4666-8666-666666666604', v_org_id, v_p2_id, 'Export FOB Mundra', 'USD', 'MT', 2380.00, 2180.00, true),
    ('66666666-6666-4666-8666-666666666605', v_org_id, v_p3_id, 'Domestic Standard', 'INR', 'kg', 215.00, 195.00, true),
    ('66666666-6666-4666-8666-666666666606', v_org_id, v_p3_id, 'Export FOB Mundra', 'USD', 'MT', 2600.00, 2400.00, true),
    ('66666666-6666-4666-8666-666666666607', v_org_id, v_p4_id, 'Domestic Standard', 'INR', 'kg', 140.00, 125.00, true),
    ('66666666-6666-4666-8666-666666666608', v_org_id, v_p4_id, 'Export FOB Mundra', 'USD', 'MT', 1700.00, 1550.00, true),
    ('66666666-6666-4666-8666-666666666609', v_org_id, v_p5_id, 'Domestic Standard', 'INR', 'kg', 160.00, 145.00, true),
    ('66666666-6666-4666-8666-666666666610', v_org_id, v_p5_id, 'Export FOB Mundra', 'USD', 'MT', 1950.00, 1750.00, true),
    ('66666666-6666-4666-8666-666666666611', v_org_id, v_p6_id, 'Domestic Standard', 'INR', 'kg', 170.00, 150.00, true),
    ('66666666-6666-4666-8666-666666666612', v_org_id, v_p6_id, 'Export FOB Mundra', 'USD', 'MT', 2100.00, 1900.00, true)
  ON CONFLICT (id) DO UPDATE SET
    product_id = EXCLUDED.product_id, tier_name = EXCLUDED.tier_name, currency = EXCLUDED.currency,
    unit = EXCLUDED.unit, rate = EXCLUDED.rate, floor_price = EXCLUDED.floor_price,
    is_active = true, updated_at = now();

  -- Remove rows left by the old seed (random ids, same product + tier) so there is one row per key
  DELETE FROM price_list_items p
  WHERE p.org_id = v_org_id
    AND p.id::text NOT LIKE '66666666-6666-4666-8666-6666666666%'
    AND EXISTS (
      SELECT 1 FROM price_list_items f
      WHERE f.org_id = v_org_id
        AND f.id::text LIKE '66666666-6666-4666-8666-6666666666%'
        AND f.product_id = p.product_id AND f.tier_name = p.tier_name
    );

  -- 9. Product Costs (raw onion, processing / fuel, packaging) - owner and accounts only
  INSERT INTO product_costs (id, org_id, product_id, raw_onion_rate_per_kg, processing_cost_per_kg, packaging_cost_per_kg, effective_date)
  VALUES
    ('77777777-7777-4777-8777-777777777701', v_org_id, v_p1_id, 98.00, 32.00, 6.50, CURRENT_DATE),
    ('77777777-7777-4777-8777-777777777702', v_org_id, v_p2_id, 98.00, 36.00, 6.50, CURRENT_DATE),
    ('77777777-7777-4777-8777-777777777703', v_org_id, v_p3_id, 98.00, 42.00, 7.00, CURRENT_DATE),
    ('77777777-7777-4777-8777-777777777704', v_org_id, v_p4_id, 72.00, 28.00, 6.00, CURRENT_DATE),
    ('77777777-7777-4777-8777-777777777705', v_org_id, v_p5_id, 72.00, 34.00, 6.50, CURRENT_DATE),
    ('77777777-7777-4777-8777-777777777706', v_org_id, v_p6_id, 82.00, 30.00, 6.50, CURRENT_DATE)
  ON CONFLICT (id) DO UPDATE SET
    product_id = EXCLUDED.product_id,
    raw_onion_rate_per_kg = EXCLUDED.raw_onion_rate_per_kg,
    processing_cost_per_kg = EXCLUDED.processing_cost_per_kg,
    packaging_cost_per_kg = EXCLUDED.packaging_cost_per_kg,
    effective_date = EXCLUDED.effective_date,
    updated_at = now();

  DELETE FROM product_costs c
  WHERE c.org_id = v_org_id
    AND c.id::text NOT LIKE '77777777-7777-4777-8777-7777777777%'
    AND EXISTS (
      SELECT 1 FROM product_costs f
      WHERE f.org_id = v_org_id
        AND f.id::text LIKE '77777777-7777-4777-8777-7777777777%'
        AND f.product_id = c.product_id
    );

  -- 10. Buyers (domestic masala / food makers, export importers and agents)
  INSERT INTO buyers (
    id, org_id, buyer_code, company_name, buyer_type, country, gstin, pan,
    incoterm, preferred_currency, payment_terms, credit_period_days, address, city, state, status
  )
  VALUES
    (
      v_buyer1_id, v_org_id, 'BUY-0001', 'Everest Food Products Pvt Ltd', 'domestic_masala',
      'India', '27AAACE1234A1Z1', 'AAACE1234A', 'EXW', 'INR',
      '30 days net from invoice date', 30,
      'Everest House, 100 S.V. Road, Goregaon West', 'Mumbai', 'Maharashtra', 'active'
    ),
    (
      v_buyer2_id, v_org_id, 'BUY-0002', 'Haldiram Snacks Private Limited', 'domestic_food_mfr',
      'India', '09AAACH5678B1Z2', 'AAACH5678B', 'EXW', 'INR',
      '50% Advance, balance against LR dispatch', 15,
      'B-1/H-8, Mohan Co-op Industrial Estate, Mathura Road', 'Noida', 'Uttar Pradesh', 'active'
    ),
    (
      v_buyer3_id, v_org_id, 'BUY-0003', 'Al-Barakah Spice & Grain LLC', 'export_importer',
      'United Arab Emirates', NULL, NULL, 'FOB', 'USD',
      '30% Advance, 70% against BL copy by email', 0,
      'Warehouse 14, Al Ras Spice Souk, Deira', 'Dubai', 'Dubai', 'active'
    ),
    (
      v_buyer4_id, v_org_id, 'BUY-0004', 'Rhine Food Ingredients GmbH', 'export_agent',
      'Germany', NULL, NULL, 'CIF', 'EUR',
      '100% Irrevocable LC at sight', 0,
      'Speicherstadt Block D, Am Sandtorkai 48', 'Hamburg', 'Hamburg', 'active'
    )
  ON CONFLICT (org_id, buyer_code) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    buyer_type = EXCLUDED.buyer_type,
    country = EXCLUDED.country,
    incoterm = EXCLUDED.incoterm,
    preferred_currency = EXCLUDED.preferred_currency,
    payment_terms = EXCLUDED.payment_terms,
    credit_period_days = EXCLUDED.credit_period_days,
    status = EXCLUDED.status,
    updated_at = now();

  -- Buyer code counter (sample-data.md section 9: BUY = 4)
  INSERT INTO entity_code_counters (org_id, prefix, current_val)
  VALUES (v_org_id, 'BUY', 4)
  ON CONFLICT (org_id, prefix) DO UPDATE
    SET current_val = GREATEST(entity_code_counters.current_val, EXCLUDED.current_val);

  -- 11. Buyer Contacts
  INSERT INTO buyer_contacts (id, org_id, buyer_id, name, designation, phone, email, is_primary)
  VALUES
    ('88888888-8888-4888-8888-888888888801', v_org_id, v_buyer1_id, 'Rajesh Parekh', 'VP Procurement (Raw Spices)', '+91 98200 45678', 'rajesh.p@everestspices.com', true),
    ('88888888-8888-4888-8888-888888888802', v_org_id, v_buyer1_id, 'Sunita Deshmukh', 'Quality Assurance Officer', '+91 98200 45679', 'sunita.d@everestspices.com', false),
    ('88888888-8888-4888-8888-888888888803', v_org_id, v_buyer2_id, 'Manish Sharma', 'General Manager Purchases', '+91 98110 98765', 'manish.sharma@haldirams.com', true),
    ('88888888-8888-4888-8888-888888888804', v_org_id, v_buyer3_id, 'Tariq Al-Mansoor', 'Managing Director', '+971 4 223 9876', 'tariq@albarakahspices.ae', true),
    ('88888888-8888-4888-8888-888888888805', v_org_id, v_buyer4_id, 'Hans Weber', 'Commercial Broker', '+49 40 3298 1234', 'h.weber@rhinefood.de', true)
  ON CONFLICT (id) DO UPDATE SET
    buyer_id = EXCLUDED.buyer_id, name = EXCLUDED.name, designation = EXCLUDED.designation,
    phone = EXCLUDED.phone, email = EXCLUDED.email, is_primary = EXCLUDED.is_primary, updated_at = now();

  DELETE FROM buyer_contacts c
  WHERE c.org_id = v_org_id
    AND c.id::text NOT LIKE '88888888-8888-4888-8888-8888888888%'
    AND EXISTS (
      SELECT 1 FROM buyer_contacts f
      WHERE f.org_id = v_org_id
        AND f.id::text LIKE '88888888-8888-4888-8888-8888888888%'
        AND f.buyer_id = c.buyer_id AND f.phone = c.phone
    );

END $$;
