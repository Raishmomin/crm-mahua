'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChoiceOption<V extends string = string> {
  value: V;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
}

export interface ChoiceChipsProps<V extends string = string> {
  options: ChoiceOption<V>[];
  value: V | null | undefined;
  onChange: (value: V) => void;
  /** Group label for screen readers */
  ariaLabel?: string;
  /** 'dark' = selected chip is slate-800 (lost reasons); default emerald */
  tone?: 'emerald' | 'dark';
  /** Make every chip stretch to equal width (2 x 2 job buttons) */
  grid?: boolean;
  size?: 'default' | 'lg';
  className?: string;
  disabled?: boolean;
}

/** Single-select chips for 2-6 options; radio-group semantics, 48px tall. */
export function ChoiceChips<V extends string = string>({
  options,
  value,
  onChange,
  ariaLabel,
  tone = 'emerald',
  grid = false,
  size = 'default',
  className,
  disabled,
}: ChoiceChipsProps<V>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(grid ? 'grid grid-cols-2 gap-2' : 'flex flex-wrap gap-2', className)}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled || opt.disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center justify-center gap-2 border text-base font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              size === 'lg' ? 'h-[72px] rounded-xl px-4 text-lg font-semibold' : 'h-12 min-w-[88px] rounded-full px-4',
              selected
                ? tone === 'dark'
                  ? 'border-slate-800 bg-slate-800 text-white'
                  : 'border-emerald-700 bg-emerald-700 text-white'
                : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
            )}
          >
            {Icon && <Icon className={cn(size === 'lg' ? 'h-6 w-6' : 'h-5 w-5', 'shrink-0')} aria-hidden="true" />}
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
