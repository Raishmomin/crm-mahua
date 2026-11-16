import type { SupabaseClient } from '@supabase/supabase-js';
import { t, type Lang } from '@/lib/i18n';

/** {company} for WhatsApp templates: business_settings.trade_name or company_name, else the app name. */
export async function loadCompanyShort(supabase: SupabaseClient, orgId: string, lang: Lang): Promise<string> {
  try {
    const { data } = await supabase.from('business_settings').select('trade_name, company_name').eq('org_id', orgId).maybeSingle();
    const name = (data as { trade_name?: string | null; company_name?: string | null } | null)?.trade_name || data?.company_name;
    if (name) return name;
  } catch {
    // unreachable database: fall through
  }
  return t(lang, 'app.name');
}
