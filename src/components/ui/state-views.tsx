'use client';

import React from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Inbox, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t, type Lang } from '@/lib/i18n';
import { Button, buttonVariants } from './button';
import { useLang } from '@/components/shell/lang-provider';

export function LoadingSkeleton({ rows = 3, lang, className }: { rows?: number; lang?: Lang; className?: string }) {
  const ctxLang = useLang();
  return (
    <div aria-busy="true" aria-label={t(lang ?? ctxLang, 'common.loading')} className={cn('space-y-3', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-[72px] animate-pulse rounded-xl bg-slate-100" />
      ))}
    </div>
  );
}

export interface EmptyStateProps {
  /** label key or already translated text; default msg.empty.generic */
  message?: string;
  /** 'check' shows a green tick (msg.empty.todo / msg.empty.money) */
  icon?: 'inbox' | 'check' | LucideIcon;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  lang?: Lang;
  className?: string;
}

/** One sentence, big icon, optional primary button. */
export function EmptyState({ message, icon = 'inbox', actionLabel, actionHref, onAction, lang, className }: EmptyStateProps) {
  const ctxLang = useLang();
  const l = lang ?? ctxLang;
  const text = t(l, message ?? 'msg.empty.generic');
  const Icon: LucideIcon = icon === 'inbox' ? Inbox : icon === 'check' ? CheckCircle2 : icon;
  return (
    <div className={cn('flex flex-col items-center gap-3 p-10 text-center', className)}>
      <Icon className={cn('h-10 w-10', icon === 'check' ? 'text-emerald-600' : 'text-slate-300')} aria-hidden="true" />
      <p className="text-base text-slate-600">{text}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className={buttonVariants({ className: 'mt-2' })}>
          {actionLabel}
        </Link>
      )}
      {actionLabel && !actionHref && onAction && (
        <Button onClick={onAction} className="mt-2">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export interface ErrorStateProps {
  /** label key or text; default msg.error.load. Never pass a raw error message. */
  message?: string;
  onRetry?: () => void;
  retryHref?: string;
  lang?: Lang;
  className?: string;
}

export function ErrorState({ message, onRetry, retryHref, lang, className }: ErrorStateProps) {
  const ctxLang = useLang();
  const l = lang ?? ctxLang;
  return (
    <div className={cn('flex flex-col items-center gap-3 p-10 text-center', className)}>
      <AlertCircle className="h-10 w-10 text-rose-500" aria-hidden="true" />
      <p className="text-base text-slate-600">{t(l, message ?? 'msg.error.load')}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="mt-2">
          {t(l, 'btn.retry')}
        </Button>
      )}
      {!onRetry && retryHref && (
        <Link href={retryHref} className={buttonVariants({ variant: 'outline', className: 'mt-2' })}>
          {t(l, 'btn.retry')}
        </Link>
      )}
    </div>
  );
}
