import React from 'react';
import { requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import type { Profile } from '@/types/database';
import { PageHeader } from '@/components/ui/back-button';
import { EmptyState, ErrorState } from '@/components/ui/state-views';
import { UserTable } from './user-table';

export default async function UsersPage() {
  const me = await requireModule('users'); // Wall 2
  const lang = getLang();

  const supabase = createClient();
  const { data: users, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('org_id', me.org_id)
    .order('created_at', { ascending: true });
  if (error) console.error('[users] load failed:', error.code, error.message);

  return (
    <div className="space-y-4">
      <PageHeader title={t(lang, 'title.staff')} subtitle={t(lang, 'title.staff_access')} />
      {error ? (
        <ErrorState retryHref="/users" lang={lang} />
      ) : !users || users.length === 0 ? (
        <EmptyState message="msg.empty.staff" lang={lang} />
      ) : (
        <UserTable users={users as Profile[]} currentUserId={me.id} />
      )}
    </div>
  );
}
