import * as React from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ColourRole } from '@/lib/status';
import { ROLE_CLASSES } from './status-badge';

export interface KpiTileProps {
  href: string;
  /** t(lang, 'kpi.money_due') */
  word: string;
  /** already formatted: "3", "₹18,40,000" */
  value: string;
  /** "$16,380" or "2 late" */
  secondary?: string;
  role: ColourRole;
  icon: LucideIcon;
  className?: string;
}

/** Whole tile is a link: big number, plain word, soft colour, icon top-right. */
export function KpiTile({ href, word, value, secondary, role, icon: Icon, className }: KpiTileProps) {
  const classes = ROLE_CLASSES[role];
  return (
    <Link
      href={href}
      aria-label={`${word}: ${value}${secondary ? `, ${secondary}` : ''}`}
      className={cn(
        'relative block min-h-[112px] rounded-xl border p-4 transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2',
        classes.soft,
        className
      )}
    >
      <Icon className={cn('absolute right-4 top-4 h-7 w-7', classes.icon)} aria-hidden="true" />
      <div className="pr-9 text-3xl font-bold leading-none tabular-nums">{value}</div>
      <div className="mt-2 text-base font-medium leading-snug">{word}</div>
      {secondary && <div className="mt-1 text-sm opacity-80">{secondary}</div>}
    </Link>
  );
}

export function KpiGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-2 gap-3 md:grid-cols-4', className)}>{children}</div>;
}
