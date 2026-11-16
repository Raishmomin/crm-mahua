'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, X } from 'lucide-react';
import type { NavItem } from '@/lib/labels';
import type { Profile } from '@/types/database';
import { cn } from '@/lib/utils';
import { roleWord, t } from '@/lib/i18n';
import { iconFor } from './icon-map';
import { LanguageToggle } from './language-toggle';
import { SignOutButton } from './sign-out-button';
import { useLang } from './lang-provider';

export interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
  /** Held modules that did not fit in the bar, plus Staff / My Company */
  items: NavItem[];
  profile: Profile;
}

/** Slides up on phones: name + job, remaining menu rows, language, sign out. */
export function MoreSheet({ open, onClose, items, profile }: MoreSheetProps) {
  const lang = useLang();
  const pathname = usePathname();
  const firstRender = React.useRef(true);

  // Close on route change (skip the first render).
  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    onClose();
  }, [pathname, onClose]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end md:hidden" role="dialog" aria-modal="true" aria-label={t(lang, 'nav.more')}>
      <button type="button" aria-label={t(lang, 'btn.close')} className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-slate-900">{profile.full_name}</p>
            <p className="truncate text-sm text-slate-500">{roleWord(lang, profile.role)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(lang, 'btn.close')}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto py-1" aria-label={t(lang, 'nav.more')}>
          {items.map((item) => {
            const Icon = iconFor(item.icon);
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-14 items-center gap-3 px-4 text-base font-medium',
                  active ? 'bg-emerald-50 text-emerald-800' : 'text-slate-800 hover:bg-slate-50'
                )}
              >
                <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{t(lang, item.labelKey)}</span>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-base font-medium text-slate-700">{t(lang, 'btn.language')}</span>
            <LanguageToggle variant="full" className="flex-1" />
          </div>
          <SignOutButton variant="outline" fullWidth />
        </div>
      </div>
    </div>
  );
}
