'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid } from 'lucide-react';
import { BAR_ORDER, MAIN_NAV, type ModuleKey, type NavItem } from '@/lib/labels';
import type { Profile } from '@/types/database';
import { cn } from '@/lib/utils';
import { iconFor } from './icon-map';
import { useT } from './lang-provider';
import { MoreSheet } from './more-sheet';

const NAV_BY_KEY = new Map<ModuleKey, NavItem>(MAIN_NAV.map((n) => [n.key, n]));
const MORE_ONLY: ModuleKey[] = ['users', 'settings'];

/**
 * Slots 1-4 are filled in BAR_ORDER from the held modules; the rest, then Staff and
 * My Company (when held), go into the More sheet (components.md section 9).
 */
export function splitNav(modules: ModuleKey[]): { bar: NavItem[]; more: NavItem[] } {
  const held = BAR_ORDER.filter((k) => modules.includes(k))
    .map((k) => NAV_BY_KEY.get(k))
    .filter((n): n is NavItem => Boolean(n));
  const extra = MORE_ONLY.filter((k) => modules.includes(k))
    .map((k) => NAV_BY_KEY.get(k))
    .filter((n): n is NavItem => Boolean(n));
  return { bar: held.slice(0, 4), more: [...held.slice(4), ...extra] };
}

function isActive(href: string, pathname: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

/** Phone-only bar: always 5 slots, the 5th is More. Hidden on md and up. */
export function BottomNav({ profile }: { profile: Profile }) {
  const tt = useT();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  const modules = React.useMemo(() => (Array.isArray(profile.modules) ? profile.modules : []), [profile.modules]);
  const { bar, more } = React.useMemo(() => splitNav(modules), [modules]);
  const moreActive = open || more.some((i) => isActive(i.href, pathname));

  const cell = (active: boolean) =>
    cn(
      'flex min-w-0 flex-col items-center justify-center gap-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600',
      active ? 'font-semibold text-emerald-800' : 'text-slate-500'
    );
  const pill = (active: boolean) => cn('rounded-full px-4 py-0.5', active && 'bg-emerald-100');

  return (
    <>
      <nav
        aria-label={tt('nav.menu')}
        className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {bar.map((item) => {
          const Icon = iconFor(item.icon);
          const active = !open && isActive(item.href, pathname);
          return (
            <Link key={item.key} href={item.href} aria-current={active ? 'page' : undefined} className={cell(active)}>
              <span className={pill(active)}>
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="max-w-full truncate text-xs font-medium">{tt(item.labelKey)}</span>
            </Link>
          );
        })}
        <button type="button" onClick={() => setOpen(true)} aria-expanded={open} className={cn(cell(moreActive), 'col-start-5')}>
          <span className={pill(moreActive)}>
            <LayoutGrid className="h-6 w-6" aria-hidden="true" />
          </span>
          <span className="max-w-full truncate text-xs font-medium">{tt('nav.more')}</span>
        </button>
      </nav>
      <MoreSheet open={open} onClose={close} items={more} profile={profile} />
    </>
  );
}
