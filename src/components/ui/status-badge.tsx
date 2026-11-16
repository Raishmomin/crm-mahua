'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t, type Lang } from '@/lib/i18n';
import { statusInfo, type ColourRole, type StatusDomain } from '@/lib/status';
import { useLang } from '@/components/shell/lang-provider';

export type { ColourRole } from '@/lib/status';

export const ROLE_CLASSES: Record<ColourRole, { soft: string; solid: string; icon: string }> = {
  green: { soft: 'bg-emerald-100 text-emerald-800 border-emerald-300', solid: 'bg-emerald-700 text-white', icon: 'text-emerald-700' },
  amber: { soft: 'bg-amber-100 text-amber-900 border-amber-300', solid: 'bg-amber-500 text-slate-900', icon: 'text-amber-700' },
  red: { soft: 'bg-rose-100 text-rose-800 border-rose-300', solid: 'bg-rose-600 text-white', icon: 'text-rose-700' },
  blue: { soft: 'bg-sky-100 text-sky-900 border-sky-300', solid: 'bg-sky-700 text-white', icon: 'text-sky-700' },
  grey: { soft: 'bg-slate-100 text-slate-700 border-slate-300', solid: 'bg-slate-500 text-white', icon: 'text-slate-500' },
};

export interface StatusBadgeProps {
  role: ColourRole;
  icon: LucideIcon;
  /** already translated word */
  word: string;
  size?: 'default' | 'lg';
  solid?: boolean;
  className?: string;
}

/** Colour + icon + one word. Never a tap target by itself. */
export function StatusBadge({ role, icon: Icon, word, size = 'default', solid = false, className }: StatusBadgeProps) {
  const classes = ROLE_CLASSES[role];
  return (
    <span
      role="status"
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-semibold',
        size === 'lg' ? 'h-10 px-4 text-base' : 'h-8 px-3 text-sm',
        solid ? cn(classes.solid, 'border-transparent') : classes.soft,
        className
      )}
    >
      <Icon className={cn(size === 'lg' ? 'h-5 w-5' : 'h-4 w-4', 'shrink-0', solid ? '' : classes.icon)} aria-hidden="true" />
      {word}
    </span>
  );
}

export interface StatusProps {
  domain: StatusDomain;
  code: string | boolean | null | undefined;
  size?: 'default' | 'lg';
  solid?: boolean;
  /** Overrides the provider language (server components pass it explicitly). */
  lang?: Lang;
  dispatchMode?: 'truck' | 'container' | null;
  className?: string;
}

/** <Status domain="order" code={order.status} /> resolves colour, icon and word. */
export function Status({ domain, code, size, solid, lang, dispatchMode, className }: StatusProps) {
  const ctxLang = useLang();
  const info = statusInfo(domain, code, { dispatchMode });
  const word = t(lang ?? ctxLang, info.labelKey);
  return <StatusBadge role={info.role} icon={info.icon} word={word} size={size} solid={solid} className={className} />;
}
