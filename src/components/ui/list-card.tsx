import * as React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ListCardProps {
  href?: string;
  /** 1 line, truncated */
  title: string;
  fact1?: string;
  fact2?: string;
  /** <Status .../> */
  badge?: React.ReactNode;
  /** default chevron; or a node with at most two 48px icon buttons */
  trailing?: 'chevron' | 'none' | React.ReactNode;
  onClick?: () => void;
  className?: string;
  /** Extra class for fact2 (e.g. text-rose-700 font-semibold when late) */
  fact2ClassName?: string;
}

/** One row of every list: title 19px, up to two facts, pill on the right, chevron. */
export function ListCard({ href, title, fact1, fact2, badge, trailing = 'chevron', onClick, className, fact2ClassName }: ListCardProps) {
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <div className="truncate text-lg font-semibold text-slate-900">{title}</div>
        {fact1 && <div className="truncate text-base text-slate-700">{fact1}</div>}
        {fact2 && <div className={cn('truncate text-base text-slate-500', fact2ClassName)}>{fact2}</div>}
      </div>
      {badge && <div className="shrink-0">{badge}</div>}
      {trailing === 'chevron' && <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />}
    </>
  );

  const rowClasses = cn(
    'flex min-h-[72px] items-center gap-3 bg-white px-4 py-3',
    'border-b border-slate-200 last:border-b-0 md:rounded-xl md:border',
    className
  );

  const interactive = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 hover:bg-slate-50';

  if (trailing !== 'chevron' && trailing !== 'none') {
    // Trailing buttons sit outside the link so nothing interactive is nested.
    return (
      <div className={rowClasses}>
        {href ? (
          <Link href={href} className={cn('flex min-w-0 flex-1 items-center gap-3 -m-2 p-2 rounded-lg', interactive)}>
            {body}
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>
        )}
        <div className="flex shrink-0 items-center gap-2">{trailing}</div>
      </div>
    );
  }

  if (href) {
    return (
      <Link href={href} className={cn(rowClasses, interactive)}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(rowClasses, interactive, 'w-full text-left')}>
        {body}
      </button>
    );
  }
  return <div className={rowClasses}>{body}</div>;
}

/** Wrapper for a stack of ListCards: one bordered block on phones, spaced cards on md+. */
export function ListStack({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-slate-200 md:space-y-2 md:overflow-visible md:rounded-none md:border-0', className)}>
      {children}
    </div>
  );
}
