import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface FilterChip {
  key: string;
  href: string;
  label: string;
  count?: number;
  active: boolean;
}

/** Horizontal row of 48px filter chips (links), first chip usually "All" with a count. */
export function FilterChips({ chips, ariaLabel }: { chips: FilterChip[]; ariaLabel: string }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label={ariaLabel}>
      {chips.map((c) => (
        <Link
          key={c.key}
          role="tab"
          aria-selected={c.active}
          href={c.href}
          scroll={false}
          className={cn(
            'inline-flex h-12 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-base font-medium',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2',
            c.active ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
          )}
        >
          {c.label}
          {c.count !== undefined && <span className={cn('text-sm', c.active ? 'text-emerald-100' : 'text-slate-500')}>{c.count}</span>}
        </Link>
      ))}
    </div>
  );
}
