'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

/** Auto-growing textarea, 17px text, 96px minimum. */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, onInput, ...props }, ref) => {
  const grow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  return (
    <textarea
      ref={(el) => {
        grow(el);
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      }}
      onInput={(e) => {
        grow(e.currentTarget);
        onInput?.(e);
      }}
      className={cn(
        'min-h-[96px] w-full resize-none rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-rose-500',
        className
      )}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';
