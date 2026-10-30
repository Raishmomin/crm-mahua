import React from 'react';
import { requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Profile } from '@/types/database';
import { LABELS } from '@/lib/labels';
import { EmptyState } from '@/components/ui/state-views';
import { UserTable } from './user-table';

export default async function UsersPage() {
  // Wall 2: Server-side check
  const currentProfile = await requireModule('users');

  const supabase = createClient();
  const { data: users, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('org_id', currentProfile.org_id)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to load users: ${error.message}`);
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          {LABELS.users.title}
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          {LABELS.users.subtitle}
        </p>
      </div>

      {!users || users.length === 0 ? (
        <EmptyState
          title="No users found"
          description="There are currently no staff members registered in your organization."
        />
      ) : (
        <UserTable users={users as Profile[]} currentUserId={currentProfile.id} />
      )}
    </div>
  );
}
