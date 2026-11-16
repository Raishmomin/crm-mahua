import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const inputClasses =
  'flex h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-base text-slate-900 placeholder:text-slate-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-rose-500';

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  const extra =
    type === 'tel' ? { inputMode: 'tel' as const, autoComplete: props.autoComplete ?? 'tel' } : {};
  return <input type={type} className={cn(inputClasses, className)} ref={ref} {...extra} {...props} />;
});
Input.displayName = 'Input';
