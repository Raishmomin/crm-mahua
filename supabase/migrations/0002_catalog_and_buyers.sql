-- Migration 0002: Catalog, Packaging, Price Lists, Product Costs, Buyers & Contacts
-- Phase 1 Data Model prerequisites for realistic seed and B2B workflow

-- 1. Products (Dehydrated onion varieties, grades, HSN and GST)
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  form text NOT NULL CHECK (form IN ('flakes', 'kibbled', 'minced', 'chopped', 'granules', 'powder')),
  color text NOT NULL CHECK (color IN ('white', 'red', 'pink')),
  moisture_max_pct numeric(5,2) NOT NULL DEFAULT 6.00,
  mesh text,
  grade text NOT NULL DEFAULT 'A Grade', -- 'Commercial', 'A Grade', 'Premium Export'
  hsn_code text NOT NULL DEFAULT '07122000',
  gst_rate numeric(5,2) NOT NULL DEFAULT 5.00,
  image_path text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_products_org_code UNIQUE (org_id, code)
);

CREATE INDEX IF NOT EXISTS idx_products_org_id ON products(org_id);
CREATE INDEX IF NOT EXISTS idx_products_form_color ON products(org_id, form, color);

-- 2. Packaging Types (25 kg bags or cartons, tare weights)
CREATE TABLE IF NOT EXISTS packaging_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  tare_weight_kg numeric(6,3) NOT NULL DEFAULT 0.500,
  capacity_kg numeric(6,2) NOT NULL DEFAULT 25.00,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_packaging_types_org_id ON packaging_types(org_id);

-- 3. Price List Items (Tiers, floor prices, currencies, kg or MT)
CREATE TABLE IF NOT EXISTS price_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tier_name text NOT NULL DEFAULT 'Standard Domestic', -- 'Standard Domestic', 'Export FOB Mundra', 'Contract Bulk'
  currency text NOT NULL DEFAULT 'INR',
  unit text NOT NULL DEFAULT 'kg' CHECK (unit IN ('kg', 'MT')),
  rate numeric(12,2) NOT NULL,
  floor_price numeric(12,2) NOT NULL,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_floor_price CHECK (floor_price <= rate)
);

CREATE INDEX IF NOT EXISTS idx_price_list_items_org_id ON price_list_items(org_id);
CREATE INDEX IF NOT EXISTS idx_price_list_items_product ON price_list_items(org_id, product_id);

-- 4. Product Costs (Visible only to admin and accountant; sales sees price and floor price, never cost)
CREATE TABLE IF NOT EXISTS product_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  raw_onion_rate_per_kg numeric(10,2) NOT NULL,
  processing_cost_per_kg numeric(10,2) NOT NULL,
  packaging_cost_per_kg numeric(10,2) NOT NULL,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_costs_org_id ON product_costs(org_id);
CREATE INDEX IF NOT EXISTS idx_product_costs_product ON product_costs(org_id, product_id);

-- 5. Buyers (Domestic masala makers, export importers, food corporations)
CREATE TABLE IF NOT EXISTS buyers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  buyer_code text NOT NULL,
  company_name text NOT NULL,
  buyer_type text NOT NULL CHECK (buyer_type IN ('domestic_masala', 'domestic_food_mfr', 'export_importer', 'export_agent')),
  country text NOT NULL DEFAULT 'India',
  gstin text,
  pan text,
  incoterm text NOT NULL DEFAULT 'EXW' CHECK (incoterm IN ('EXW', 'FOB', 'CIF')),
  preferred_currency text NOT NULL DEFAULT 'INR',
  payment_terms text NOT NULL DEFAULT '100% against dispatch',
  credit_period_days integer NOT NULL DEFAULT 0,
  address text,
  city text,
  state text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blacklisted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_buyers_org_code UNIQUE (org_id, buyer_code)
);

CREATE INDEX IF NOT EXISTS idx_buyers_org_id ON buyers(org_id);
CREATE INDEX IF NOT EXISTS idx_buyers_type ON buyers(org_id, buyer_type);

-- 6. Buyer Contacts
CREATE TABLE IF NOT EXISTS buyer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  name text NOT NULL,
  designation text,
  phone text NOT NULL,
  email text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_buyer_contacts_org_id ON buyer_contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_buyer_contacts_buyer ON buyer_contacts(org_id, buyer_id);

--------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
--------------------------------------------------------------------------------

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS products_tenant_policy ON products;
CREATE POLICY products_tenant_policy ON products
  FOR ALL USING (org_id = fn_current_org()) WITH CHECK (org_id = fn_current_org());

ALTER TABLE packaging_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE packaging_types FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS packaging_types_tenant_policy ON packaging_types;
CREATE POLICY packaging_types_tenant_policy ON packaging_types
  FOR ALL USING (org_id = fn_current_org()) WITH CHECK (org_id = fn_current_org());

ALTER TABLE price_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_list_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS price_list_items_tenant_policy ON price_list_items;
CREATE POLICY price_list_items_tenant_policy ON price_list_items
  FOR ALL USING (org_id = fn_current_org()) WITH CHECK (org_id = fn_current_org());

-- product_costs: Rule 5 - Cost data visible only to admin (owner) and accountant
ALTER TABLE product_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_costs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_costs_tenant_policy ON product_costs;
CREATE POLICY product_costs_tenant_policy ON product_costs
  FOR ALL
  USING (
    org_id = fn_current_org() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_active = true AND role IN ('owner', 'accountant')
    )
  )
  WITH CHECK (
    org_id = fn_current_org() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_active = true AND role IN ('owner', 'accountant')
    )
  );

ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyers FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS buyers_tenant_policy ON buyers;
CREATE POLICY buyers_tenant_policy ON buyers
  FOR ALL USING (org_id = fn_current_org()) WITH CHECK (org_id = fn_current_org());

ALTER TABLE buyer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_contacts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS buyer_contacts_tenant_policy ON buyer_contacts;
CREATE POLICY buyer_contacts_tenant_policy ON buyer_contacts
  FOR ALL USING (org_id = fn_current_org()) WITH CHECK (org_id = fn_current_org());

--------------------------------------------------------------------------------
-- VIEWS
--------------------------------------------------------------------------------

-- v_product_costs: Security-definer view with total cost calculation for owner/accountant
CREATE OR REPLACE VIEW v_product_costs AS
SELECT
  pc.id,
  pc.org_id,
  pc.product_id,
  p.code AS product_code,
  p.name AS product_name,
  p.form,
  p.color,
  pc.raw_onion_rate_per_kg,
  pc.processing_cost_per_kg,
  pc.packaging_cost_per_kg,
  (pc.raw_onion_rate_per_kg + pc.processing_cost_per_kg + pc.packaging_cost_per_kg) AS total_cost_per_kg,
  pc.effective_date,
  pc.updated_at
FROM product_costs pc
JOIN products p ON pc.product_id = p.id;

--------------------------------------------------------------------------------
-- AUDIT TRIGGERS
--------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_audit_products ON products;
CREATE TRIGGER trg_audit_products
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION fn_audit();

DROP TRIGGER IF EXISTS trg_audit_packaging_types ON packaging_types;
CREATE TRIGGER trg_audit_packaging_types
  AFTER INSERT OR UPDATE OR DELETE ON packaging_types
  FOR EACH ROW EXECUTE FUNCTION fn_audit();

DROP TRIGGER IF EXISTS trg_audit_price_list_items ON price_list_items;
CREATE TRIGGER trg_audit_price_list_items
  AFTER INSERT OR UPDATE OR DELETE ON price_list_items
  FOR EACH ROW EXECUTE FUNCTION fn_audit();

DROP TRIGGER IF EXISTS trg_audit_product_costs ON product_costs;
CREATE TRIGGER trg_audit_product_costs
  AFTER INSERT OR UPDATE OR DELETE ON product_costs
  FOR EACH ROW EXECUTE FUNCTION fn_audit();

DROP TRIGGER IF EXISTS trg_audit_buyers ON buyers;
CREATE TRIGGER trg_audit_buyers
  AFTER INSERT OR UPDATE OR DELETE ON buyers
  FOR EACH ROW EXECUTE FUNCTION fn_audit();

DROP TRIGGER IF EXISTS trg_audit_buyer_contacts ON buyer_contacts;
CREATE TRIGGER trg_audit_buyer_contacts
  AFTER INSERT OR UPDATE OR DELETE ON buyer_contacts
  FOR EACH ROW EXECUTE FUNCTION fn_audit();
