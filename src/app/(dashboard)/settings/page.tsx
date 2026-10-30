import React from 'react';
import { requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { BusinessSettings } from '@/types/database';
import { LABELS } from '@/lib/labels';
import { SettingsForm } from './settings-form';

export default async function SettingsPage() {
  // Wall 2: Server-side check
  const currentProfile = await requireModule('settings');

  const supabase = createClient();
  const { data: business } = await supabase
    .from('business_settings')
    .select('*')
    .eq('org_id', currentProfile.org_id)
    .maybeSingle();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          {LABELS.settings.title}
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          {LABELS.settings.subtitle}
        </p>
      </div>

      <SettingsForm initialData={business as BusinessSettings | null} />
    </div>
  );
}
