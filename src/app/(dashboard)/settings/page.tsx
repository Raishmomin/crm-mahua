import React from 'react';
import { requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import type { BusinessSettings } from '@/types/database';
import { PageHeader } from '@/components/ui/back-button';
import { ErrorState } from '@/components/ui/state-views';
import { SettingsForm } from './settings-form';

export default async function SettingsPage() {
  const profile = await requireModule('settings'); // Wall 2
  const lang = getLang();

  const supabase = createClient();
  const { data, error } = await supabase
    .from('business_settings')
    .select('*')
    .eq('org_id', profile.org_id)
    .maybeSingle();
  if (error) console.error('[settings] load failed:', error.code, error.message);

  return (
    <div className="space-y-4 pb-28 md:pb-0">
      <PageHeader title={t(lang, 'title.company')} />
      {error ? <ErrorState retryHref="/settings" lang={lang} /> : <SettingsForm initialData={data as BusinessSettings | null} />}
    </div>
  );
}
