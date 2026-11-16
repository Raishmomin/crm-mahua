import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLang } from '@/lib/i18n-server';
import { t, type Lang } from '@/lib/i18n';
import { LangProvider } from '@/components/shell/lang-provider';
import { Sidebar } from '@/components/shell/sidebar';
import { Header } from '@/components/shell/header';
import { BottomNav } from '@/components/shell/bottom-nav';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  const lang = getLang();

  // A switched-off login only ever reaches /account-inactive (pages redirect there): no menu for it.
  if (!profile.is_active) {
    return (
      <LangProvider lang={lang}>
        <div className="min-h-screen bg-slate-50 p-4">{children}</div>
      </LangProvider>
    );
  }

  const companyShort = await loadCompanyShort(profile.org_id, lang);

  return (
    <LangProvider lang={lang}>
      <div className="min-h-screen bg-slate-50">
        <Sidebar profile={profile} companyShort={companyShort} />
        <div className="flex min-h-screen flex-col md:ml-64">
          <Header profile={profile} companyShort={companyShort} />
          <main className="flex-1 p-4 pb-20 md:p-6">
            <div className="mx-auto w-full max-w-3xl">{children}</div>
          </main>
        </div>
        <BottomNav profile={profile} />
      </div>
    </LangProvider>
  );
}

/** app.company_short = business_settings.trade_name or company_name; falls back to the org name, then app.name. */
async function loadCompanyShort(orgId: string, lang: Lang): Promise<string> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from('business_settings')
      .select('trade_name, company_name')
      .eq('org_id', orgId)
      .maybeSingle();
    const name = data?.trade_name || data?.company_name;
    if (name) return name;
    const { data: org } = await supabase.from('organizations').select('name').eq('id', orgId).maybeSingle();
    if (org?.name) return org.name;
  } catch {
    // Unreachable database: the shell still renders.
  }
  return t(lang, 'app.name');
}
