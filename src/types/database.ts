import { ModuleKey, UserRole } from '@/lib/labels';

export interface Organization {
  id: string;
  name: string;
  code: string;
  currency: string;
  tax_mode: 'regular_gst' | 'composition' | 'export';
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  org_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  modules: ModuleKey[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessSettings {
  id: string;
  org_id: string;
  company_name: string;
  trade_name?: string | null;
  gstin?: string | null;
  iec_code?: string | null;
  pan?: string | null;
  fssai_no?: string | null;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  bank_details: BankDetail[];
  authorized_signatory?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BankDetail {
  bank_name: string;
  account_no: string;
  ifsc: string;
  branch?: string;
  swift?: string;
  currency: string;
  is_primary: boolean;
}

export interface AppSettings {
  id: string;
  org_id: string;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  org_id: string;
  user_id?: string | null;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data?: Record<string, any> | null;
  new_data?: Record<string, any> | null;
  created_at: string;
}

export interface Product {
  id: string;
  org_id: string;
  code: string;
  name: string;
  form: 'flakes' | 'kibbled' | 'minced' | 'chopped' | 'granules' | 'powder';
  color: 'white' | 'red' | 'pink';
  moisture_max_pct: number;
  mesh?: string | null;
  grade: string;
  hsn_code: string;
  gst_rate: number;
  image_path?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Buyer {
  id: string;
  org_id: string;
  buyer_code: string;
  company_name: string;
  buyer_type: 'domestic_masala' | 'domestic_food_mfr' | 'export_importer' | 'export_agent';
  country: string;
  gstin?: string | null;
  pan?: string | null;
  incoterm: 'EXW' | 'FOB' | 'CIF';
  preferred_currency: string;
  payment_terms: string;
  credit_period_days: number;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  status: 'active' | 'inactive' | 'blacklisted';
  created_at: string;
  updated_at: string;
}
