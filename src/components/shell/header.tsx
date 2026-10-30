import React from 'react';
import { UserNav } from './user-nav';
import { Profile } from '@/types/database';
import { Badge } from '@/components/ui/badge';

export function Header({ profile, orgName }: { profile: Profile; orgName?: string }) {
  return (
    <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-slate-800 text-sm">{orgName || 'Mahuva Processing Facility'}</span>
        <Badge variant="success" className="text-[10px] uppercase font-bold tracking-wider">
          Multi-Tenant Live
        </Badge>
      </div>
      <UserNav profile={profile} />
    </header>
  );
}
