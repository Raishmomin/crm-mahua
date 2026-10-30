-- Seed Script: Mahuva CRM Realistic Demo Organization
-- Includes Mahuva Dehydration Pvt Ltd, 4 role-based users, business identity, 6 onion products, packaging, price lists, product costs, domestic & export buyers, and contacts.

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
BEGIN

  -- 1. Organization
  INSERT INTO organizations (id, name, code, currency, tax_mode)
  VALUES (v_org_id, 'Mahuva Dehydration Private Limited', 'MDPL', 'INR', 'regular_gst')
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code;

  -- 2. Mock auth.users (if running in local supabase or postgres with auth schema)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    INSERT INTO auth.users (id, email, raw_user_meta_data, encrypted_password, email_confirmed_at, created_at, updated_at)
    VALUES
      (v_admin_id, 'admin@mahuvacrm.com', '{"full_name":"Hareshbhai Mehta"}'::jsonb, '$2a$10$abcdefghijklmnopqrstuvwxyzABCDEF', now(), now(), now()),
      (v_accountant_id, 'accountant@mahuvacrm.com', '{"full_name":"Nileshbhai Shah"}'::jsonb, '$2a$10$abcdefghijklmnopqrstuvwxyzABCDEF', now(), now(), now()),
      (v_sales_id, 'sales@mahuvacrm.com', '{"full_name":"Pooja Patel"}'::jsonb, '$2a$10$abcdefghijklmnopqrstuvwxyzABCDEF', now(), now(), now()),
      (v_ops_id, 'ops@mahuvacrm.com', '{"full_name":"Dineshbhai Vaghela"}'::jsonb, '$2a$10$abcdefghijklmnopqrstuvwxyzABCDEF', now(), now(), now())
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- 3. Profiles with module entitlements
  -- Owner / Admin: All 13 modules
  INSERT INTO profiles (id, org_id, email, full_name, role, modules, is_active)
  VALUES (
    v_admin_id,
    v_org_id,
    'admin@mahuvacrm.com',
    'Hareshbhai Mehta (Owner)',
    'owner',
    ARRAY['dashboard', 'leads', 'buyers', 'samples', 'quotes', 'orders', 'payments', 'catalog', 'documents', 'reports', 'users', 'settings', 'audit'],
    true
  )
  ON CONFLICT (id) DO UPDATE SET modules = EXCLUDED.modules, role = EXCLUDED.role;

  -- Accountant: Financial and reporting modules
  INSERT INTO profiles (id, org_id, email, full_name, role, modules, is_active)
  VALUES (
    v_accountant_id,
    v_org_id,
    'accountant@mahuvacrm.com',
    'Nileshbhai Shah (Finance Lead)',
    'accountant',
    ARRAY['dashboard', 'buyers', 'quotes', 'orders', 'payments', 'catalog', 'documents', 'reports', 'settings', 'audit'],
    true
  )
  ON CONFLICT (id) DO UPDATE SET modules = EXCLUDED.modules, role = EXCLUDED.role;

  -- Sales: Lead pipeline, quotes, orders, buyers (no cost data)
  INSERT INTO profiles (id, org_id, email, full_name, role, modules, is_active)
  VALUES (
    v_sales_id,
    v_org_id,
    'sales@mahuvacrm.com',
    'Pooja Patel (Export & Domestic Sales)',
    'sales',
    ARRAY['dashboard', 'leads', 'buyers', 'samples', 'quotes', 'orders', 'catalog', 'documents', 'reports'],
    true
  )
  ON CONFLICT (id) DO UPDATE SET modules = EXCLUDED.modules, role = EXCLUDED.role;

  -- Operations: Production, samples, dispatch
  INSERT INTO profiles (id, org_id, email, full_name, role, modules, is_active)
  VALUES (
    v_ops_id,
    v_org_id,
    'ops@mahuvacrm.com',
    'Dineshbhai Vaghela (Plant Operations)',
    'operations',
    ARRAY['dashboard', 'buyers', 'samples', 'orders', 'catalog', 'documents'],
    true
  )
  ON CONFLICT (id) DO UPDATE SET modules = EXCLUDED.modules, role = EXCLUDED.role;

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
    gstin = EXCLUDED.gstin,
    bank_details = EXCLUDED.bank_details;

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
  ON CONFLICT (org_id) DO UPDATE SET settings = EXCLUDED.settings;

  -- 6. Packaging Types
  INSERT INTO packaging_types (id, org_id, name, tare_weight_kg, capacity_kg)
  VALUES
    (v_pkg1_id, v_org_id, '25 kg Multi-wall Paper Bag with LDPE Poly Liner', 0.450, 25.00),
    (v_pkg2_id, v_org_id, '25 kg Heavy Duty Corrugated Carton (5-ply)', 0.850, 25.00),
    (v_pkg3_id, v_org_id, '20 kg Export Carton with Vacuum Nitrogen Flush', 0.900, 20.00)
  ON CONFLICT (id) DO NOTHING;

  -- 7. Six Realistic Dehydrated Onion Products
  INSERT INTO products (id, org_id, code, name, form, color, moisture_max_pct, mesh, grade, hsn_code, gst_rate)
  VALUES
    (v_p1_id, v_org_id, 'W-FLK-A', 'Dehydrated White Onion Flakes (A-Grade)', 'flakes', 'white', 5.50, '8-15 mm', 'A Grade', '07122000', 5.00),
    (v_p2_id, v_org_id, 'W-MIN-A', 'Dehydrated White Onion Minced', 'minced', 'white', 5.50, '1-3 mm', 'A Grade', '07122000', 5.00),
    (v_p3_id, v_org_id, 'W-POW-P', 'Dehydrated White Onion Powder (Premium 100 Mesh)', 'powder', 'white', 4.50, '100 mesh', 'Premium Export', '07122000', 5.00),
    (v_p4_id, v_org_id, 'R-FLK-C', 'Dehydrated Red Onion Flakes (Commercial)', 'flakes', 'red', 6.00, '10-20 mm', 'Commercial', '07122000', 5.00),
    (v_p5_id, v_org_id, 'R-POW-S', 'Dehydrated Red Onion Powder (Standard)', 'powder', 'red', 5.00, '80-100 mesh', 'A Grade', '07122000', 5.00),
    (v_p6_id, v_org_id, 'P-CHP-E', 'Dehydrated Pink Onion Chopped (Export Grade)', 'chopped', 'pink', 5.00, '3-5 mm', 'Premium Export', '07122000', 5.00)
  ON CONFLICT (org_id, code) DO UPDATE SET name = EXCLUDED.name, moisture_max_pct = EXCLUDED.moisture_max_pct;

  -- 8. Price List Items (Domestic INR and Export USD with Floor Prices)
  INSERT INTO price_list_items (org_id, product_id, tier_name, currency, unit, rate, floor_price)
  VALUES
    -- White Flakes A
    (v_org_id, v_p1_id, 'Domestic Standard', 'INR', 'kg', 185.00, 165.00),
    (v_org_id, v_p1_id, 'Export FOB Mundra', 'USD', 'MT', 2250.00, 2050.00),
    -- White Minced
    (v_org_id, v_p2_id, 'Domestic Standard', 'INR', 'kg', 195.00, 175.00),
    (v_org_id, v_p2_id, 'Export FOB Mundra', 'USD', 'MT', 2380.00, 2180.00),
    -- White Powder Premium
    (v_org_id, v_p3_id, 'Domestic Standard', 'INR', 'kg', 215.00, 195.00),
    (v_org_id, v_p3_id, 'Export FOB Mundra', 'USD', 'MT', 2600.00, 2400.00),
    -- Red Flakes
    (v_org_id, v_p4_id, 'Domestic Standard', 'INR', 'kg', 140.00, 125.00),
    (v_org_id, v_p4_id, 'Export FOB Mundra', 'USD', 'MT', 1700.00, 1550.00),
    -- Red Powder
    (v_org_id, v_p5_id, 'Domestic Standard', 'INR', 'kg', 160.00, 145.00),
    (v_org_id, v_p5_id, 'Export FOB Mundra', 'USD', 'MT', 1950.00, 1750.00),
    -- Pink Chopped Export
    (v_org_id, v_p6_id, 'Domestic Standard', 'INR', 'kg', 170.00, 150.00),
    (v_org_id, v_p6_id, 'Export FOB Mundra', 'USD', 'MT', 2100.00, 1900.00);

  -- 9. Product Costs (Raw onion rates, processing/fuel, packaging)
  INSERT INTO product_costs (org_id, product_id, raw_onion_rate_per_kg, processing_cost_per_kg, packaging_cost_per_kg, effective_date)
  VALUES
    (v_org_id, v_p1_id, 98.00, 32.00, 6.50, CURRENT_DATE),
    (v_org_id, v_p2_id, 98.00, 36.00, 6.50, CURRENT_DATE),
    (v_org_id, v_p3_id, 98.00, 42.00, 7.00, CURRENT_DATE),
    (v_org_id, v_p4_id, 72.00, 28.00, 6.00, CURRENT_DATE),
    (v_org_id, v_p5_id, 72.00, 34.00, 6.50, CURRENT_DATE),
    (v_org_id, v_p6_id, 82.00, 30.00, 6.50, CURRENT_DATE);

  -- 10. Domestic & Export Buyers
  INSERT INTO buyers (
    id, org_id, buyer_code, company_name, buyer_type, country, gstin, pan,
    incoterm, preferred_currency, payment_terms, credit_period_days, address, city, state, status
  )
  VALUES
    -- Domestic Masala
    (
      v_buyer1_id, v_org_id, 'BUY-0001', 'Everest Food Products Pvt Ltd', 'domestic_masala',
      'India', '27AAACE1234A1Z1', 'AAACE1234A', 'EXW', 'INR',
      '30 days net from invoice date', 30,
      'Everest House, 100 S.V. Road, Goregaon West', 'Mumbai', 'Maharashtra', 'active'
    ),
    -- Domestic Food Manufacturer
    (
      v_buyer2_id, v_org_id, 'BUY-0002', 'Haldiram Snacks Private Limited', 'domestic_food_mfr',
      'India', '09AAACH5678B1Z2', 'AAACH5678B', 'EXW', 'INR',
      '50% Advance, balance against LR dispatch', 15,
      'B-1/H-8, Mohan Co-op Industrial Estate, Mathura Road', 'Noida', 'Uttar Pradesh', 'active'
    ),
    -- Export Importer (UAE)
    (
      v_buyer3_id, v_org_id, 'BUY-0003', 'Al-Barakah Spice & Grain LLC', 'export_importer',
      'United Arab Emirates', NULL, NULL, 'FOB', 'USD',
      '30% Advance, 70% against BL copy by email', 0,
      'Warehouse 14, Al Ras Spice Souk, Deira', 'Dubai', 'Dubai', 'active'
    ),
    -- Export Food Agent (Germany)
    (
      v_buyer4_id, v_org_id, 'BUY-0004', 'Rhine Food Ingredients GmbH', 'export_agent',
      'Germany', NULL, NULL, 'CIF', 'EUR',
      '100% Irrevocable LC at sight', 0,
      'Speicherstadt Block D, Am Sandtorkai 48', 'Hamburg', 'Hamburg', 'active'
    )
  ON CONFLICT (org_id, buyer_code) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    status = EXCLUDED.status;

  -- 11. Buyer Contacts
  INSERT INTO buyer_contacts (org_id, buyer_id, name, designation, phone, email, is_primary)
  VALUES
    (v_org_id, v_buyer1_id, 'Rajesh Parekh', 'VP Procurement (Raw Spices)', '+91 98200 45678', 'rajesh.p@everestspices.com', true),
    (v_org_id, v_buyer1_id, 'Sunita Deshmukh', 'Quality Assurance Officer', '+91 98200 45679', 'sunita.d@everestspices.com', false),
    (v_org_id, v_buyer2_id, 'Manish Sharma', 'General Manager Purchases', '+91 98110 98765', 'manish.sharma@haldirams.com', true),
    (v_org_id, v_buyer3_id, 'Tariq Al-Mansoor', 'Managing Director', '+971 4 223 9876', 'tariq@albarakahspices.ae', true),
    (v_org_id, v_buyer4_id, 'Hans Weber', 'Commercial Broker', '+49 40 3298 1234', 'h.weber@rhinefood.de', true);

END $$;
