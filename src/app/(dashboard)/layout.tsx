import React from 'react';
import { requireAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/shell/sidebar';
import { Header } from '@/components/shell/header';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAuth();

  const supabase = createClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', profile.org_id)
    .single();

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Module-gated sidebar */}
      <Sidebar profile={profile} />

      {/* Main content body */}
      <div className="flex-1 flex flex-col ml-64 min-w-0">
        <Header profile={profile} orgName={org?.name} />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
