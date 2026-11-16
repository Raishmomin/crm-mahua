import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Holds the one primary button of a screen.
 * Phone: fixed above the bottom nav. md+: static at the end of the form.
 * Pages using it add pb-28 on phones so content clears the bar.
 */
export function StickyBar({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-16 z-20 border-t border-slate-200 bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
        'md:static md:border-0 md:bg-transparent md:p-0',
        className
      )}
    >
      <div className="mx-auto flex w-full max-w-3xl gap-3 md:justify-end">{children}</div>
    </div>
  );
}
