'use client';

import * as React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/components/shell/lang-provider';

export interface MoreFieldsProps {
  /** Custom words; default btn.more / btn.less */
  moreLabel?: string;
  lessLabel?: string;
  defaultOpen?: boolean;
  /** Set to true from the parent when a hidden field has an error on submit. */
  forceOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Ghost full-width toggle that reveals optional fields. */
export function MoreFields({ moreLabel, lessLabel, defaultOpen = false, forceOpen, className, children }: MoreFieldsProps) {
  const tt = useT();
  const [open, setOpen] = React.useState(defaultOpen);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [forceOpen]);

  return (
    <div ref={ref} className={cn('w-full', className)}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-full items-center justify-between rounded-lg px-3 text-base font-semibold text-emerald-800 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
      >
        <span>{open ? lessLabel ?? tt('btn.less') : moreLabel ?? tt('btn.more')}</span>
        {open ? <ChevronUp className="h-5 w-5" aria-hidden="true" /> : <ChevronDown className="h-5 w-5" aria-hidden="true" />}
      </button>
      {open && <div className="mt-3 space-y-4">{children}</div>}
    </div>
  );
}
