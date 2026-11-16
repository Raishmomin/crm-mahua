import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FormFieldProps {
  /** id of the control inside; also used for aria-describedby ids */
  htmlFor: string;
  label: string;
  hint?: string;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
}

/** Plain wrappers (e.g. the password box with its eye button) are not controls: never clone onto them. */
const WRAPPER_TAGS = new Set(['div', 'span', 'section', 'fieldset']);

/**
 * Label above, control, optional hint, error below (plain words, red).
 * When the child is a single control element it receives id, aria-invalid and aria-describedby.
 * A plain wrapper element is left alone: give the control inside it id={htmlFor} (and its own aria)
 * so the page never has two elements with the same id (gate 1 F2).
 */
export function FormField({ htmlFor, label, hint, error, className, children }: FormFieldProps) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const isControl = React.isValidElement(children) && !(typeof children.type === 'string' && WRAPPER_TAGS.has(children.type));
  const control = isControl
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id: (children as React.ReactElement<Record<string, unknown>>).props.id ?? htmlFor,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })
    : children;

  return (
    <div className={cn('w-full', className)}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
      </label>
      {control}
      {hint && !error && (
        <p id={hintId} className="mt-1 text-sm text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1 flex items-center gap-1 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
