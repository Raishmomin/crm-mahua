'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wheat } from 'lucide-react';
import { MAIN_NAV } from '@/lib/labels';
import type { Profile } from '@/types/database';
import { cn, initials } from '@/lib/utils';
import { roleWord } from '@/lib/i18n';
import { iconFor } from './icon-map';
import { useLang, useT } from './lang-provider';

/** md+ only. Rows 48px, icons 24px, words from nav.*; menu shows only held modules (Wall 3). */
export function Sidebar({ profile, companyShort }: { profile: Profile; companyShort: string }) {
  const lang = useLang();
  const tt = useT();
  const pathname = usePathname();
  const held = Array.isArray(profile.modules) ? profile.modules : [];
  const items = MAIN_NAV.filter((item) => held.includes(item.key));

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white">
          <Wheat className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-slate-900">{tt('app.name')}</p>
          <p className="truncate text-sm text-slate-500">{companyShort}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label={tt('nav.menu')}>
        {items.map((item) => {
          const Icon = iconFor(item.icon);
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-12 items-center gap-3 rounded-lg px-3 text-base font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600',
                active ? 'bg-emerald-700 text-white' : 'text-slate-700 hover:bg-slate-100'
              )}
            >
              <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
              <span className="truncate">{tt(item.labelKey)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3 border-t border-slate-200 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-300 bg-emerald-100 text-base font-bold text-emerald-800">
          {initials(profile.full_name)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-slate-900">{profile.full_name}</p>
          <p className="truncate text-sm text-slate-500">{roleWord(lang, profile.role)}</p>
        </div>
      </div>
    </aside>
  );
}
