'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t, type Lang } from '@/lib/i18n';
import { statusInfo, type ColourRole, type StatusDomain } from '@/lib/status';
import { useLang } from '@/components/shell/lang-provider';

export type { ColourRole } from '@/lib/status';

export { ROLE_CLASSES } from './role-classes';
import { ROLE_CLASSES } from './role-classes';

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
