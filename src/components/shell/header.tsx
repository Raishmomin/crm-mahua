'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Volume2 } from 'lucide-react';
import { MAIN_NAV } from '@/lib/labels';
import type { Profile } from '@/types/database';
import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { LanguageToggle } from './language-toggle';
import { UserNav } from './user-nav';
import { useT } from './lang-provider';

// Staff and My Company are opened from More on phones, so they get a back arrow (gate 1 F5).
const TOP_LEVEL = new Set<string>(MAIN_NAV.map((n) => n.href).filter((href) => href !== '/users' && href !== '/settings'));

/** Section words by first path segment; `new` / `edit` / sub-pages get their own title. */
const SECTION_TITLE: Record<string, { base: string; sub?: Record<string, string> }> = {
  inquiries: { base: 'title.inquiries', sub: { new: 'title.inquiry_new', edit: 'title.inquiry_edit' } },
  buyers: { base: 'title.buyers', sub: { new: 'title.buyer_new', edit: 'title.buyer_edit' } },
  samples: { base: 'title.samples', sub: { new: 'title.sample_new' } },
  quotes: { base: 'title.quotes', sub: { new: 'title.quote_new', edit: 'title.quote_edit', accept: 'title.quote_accept' } },
  orders: { base: 'title.orders', sub: { dispatch: 'title.dispatch', checklist: 'title.export_papers' } },
  payments: { base: 'title.money', sub: { new: 'title.money_received', '[id]': 'btn.view_receipt' } },
  catalog: { base: 'title.products' },
  users: { base: 'title.staff' },
  settings: { base: 'title.company' },
};

/** Label key of the screen title shown in the phone header; null = Home or unknown (company name). */
function screenTitleKey(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  const section = parts[0] ? SECTION_TITLE[parts[0]] : undefined;
  if (!section) return null;
  const last = parts[parts.length - 1];
  if (parts.length > 1 && section.sub) {
    if (section.sub[last]) return section.sub[last];
    if (parts.length === 2 && section.sub['[id]']) return section.sub['[id]'];
  }
  return section.base;
}

/**
 * Sticky top bar. Phones: back arrow below the top-level menu routes + the screen title
 * (company name on Home); md+: company name, language toggle, first name, job word, sign-out.
 * Help speaker is a disabled stub in the demo.
 */
export function Header({ profile, companyShort }: { profile: Profile; companyShort: string }) {
  const tt = useT();
  const pathname = usePathname();
  const isTopLevel = pathname === '/' || TOP_LEVEL.has(pathname);
  const titleKey = screenTitleKey(pathname);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4">
      <div className="flex min-w-0 items-center gap-1">
        {!isTopLevel && <BackButton className="-ml-2 md:hidden" />}
        <span className="truncate text-base font-semibold text-slate-900 md:hidden">{titleKey ? tt(titleKey) : companyShort}</span>
        <span className="hidden truncate text-base font-semibold text-slate-900 md:inline">{companyShort}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" size="icon" disabled aria-label={tt('btn.help')} title={tt('btn.help')} className="text-slate-500">
          <Volume2 aria-hidden="true" />
        </Button>
        <div className="hidden items-center gap-3 md:flex">
          <LanguageToggle variant="compact" />
          <UserNav profile={profile} />
        </div>
      </div>
    </header>
  );
}
