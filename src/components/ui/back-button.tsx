'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { buttonVariants } from './button';
import { useT } from '@/components/shell/lang-provider';

/** 48px round back arrow. With href it is a link; without it goes back in history. */
export function BackButton({ href, className }: { href?: string; className?: string }) {
  const tt = useT();
  const router = useRouter();
  const classes = buttonVariants({ variant: 'ghost', size: 'icon', className });
  if (href) {
    return (
      <Link href={href} aria-label={tt('btn.back')} className={classes}>
        <ArrowLeft aria-hidden="true" />
      </Link>
    );
  }
  return (
    <button type="button" aria-label={tt('btn.back')} className={classes} onClick={() => router.back()}>
      <ArrowLeft aria-hidden="true" />
    </button>
  );
}

/** Page header row: back arrow + 21px title (+ optional right slot). */
export function PageHeader({
  title,
  backHref,
  subtitle,
  right,
}: {
  title: string;
  backHref?: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      {backHref !== undefined && <BackButton href={backHref || undefined} className="-ml-2" />}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="truncate text-base text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
