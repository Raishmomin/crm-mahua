import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
        {
          'bg-slate-900 text-white': variant === 'default',
          'bg-slate-100 text-slate-800': variant === 'secondary',
          'border border-slate-300 text-slate-800': variant === 'outline',
          'bg-emerald-100 text-emerald-800': variant === 'success',
          'bg-amber-100 text-amber-800': variant === 'warning',
          'bg-rose-100 text-rose-800': variant === 'destructive',
        },
        className
      )}
      {...props}
    />
  );
}
