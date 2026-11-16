import * as React from 'react';
import { cn, formatDate } from '@/lib/utils';
import { inputClasses } from './input';

export interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Hide the "06 Nov 2026" hint line under the box. */
  noHint?: boolean;
}

/** Native date input (system picker on phones) with the formatted value as a hint. */
export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(({ className, noHint, value, ...props }, ref) => {
  const pretty = typeof value === 'string' && value ? formatDate(value) : '';
  return (
    <div>
      <input ref={ref} type="date" value={value} className={cn(inputClasses, 'tabular-nums', className)} {...props} />
      {!noHint && pretty && <p className="mt-1 text-sm text-slate-500">{pretty}</p>}
    </div>
  );
});
DateInput.displayName = 'DateInput';
