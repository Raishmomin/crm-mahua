'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/types/database';
import { LABELS } from '@/lib/labels';

export function UserNav({ profile }: { profile: Profile }) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-right hidden sm:block">
        <p className="text-xs font-semibold text-slate-900">{profile.full_name}</p>
        <p className="text-[11px] text-slate-500 capitalize">{profile.role}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSignOut}
        title={LABELS.auth.signOut}
        className="text-slate-500 hover:text-rose-600 gap-1.5"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden md:inline text-xs">{LABELS.auth.signOut}</span>
      </Button>
    </div>
  );
}
