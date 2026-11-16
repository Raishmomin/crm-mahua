'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { inputClasses } from './input';

export interface NumberUnit {
  value: string;
  label: string;
}

export interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'prefix' | 'onChange' | 'value'> {
  value: string | number;
  onChange: (value: string) => void;
  /** Currency symbol shown inside the box on the left: ₹ or $ */
  prefix?: string;
  /** Short unit text inside the box on the right when there is no unit toggle: kg */
  suffix?: string;
  /** Two 48px chips to the right (kg | MT); the parent converts and stores kg. */
  units?: NumberUnit[];
  unit?: string;
  onUnitChange?: (unit: string) => void;
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, value, onChange, prefix, suffix, units, unit, onUnitChange, ...props }, ref) => {
    return (
      <div className="flex items-stretch gap-2">
        <div className="relative flex-1">
          {prefix && (
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base text-slate-500">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/[^\d.,-]/g, ''))}
            className={cn(inputClasses, 'text-right tabular-nums', prefix && 'pl-9', suffix && 'pr-12', className)}
            {...props}
          />
          {suffix && !units && (
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-base text-slate-500">
              {suffix}
            </span>
          )}
        </div>
        {units && units.length > 0 && (
          <div role="radiogroup" className="flex gap-2">
            {units.map((u) => {
              const selected = u.value === unit;
              return (
                <button
                  key={u.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onUnitChange?.(u.value)}
                  className={cn(
                    'h-12 min-w-[56px] rounded-full border px-4 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600',
                    selected
                      ? 'border-emerald-700 bg-emerald-700 text-white'
                      : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                  )}
                >
                  {u.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }
);
NumberInput.displayName = 'NumberInput';
