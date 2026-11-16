import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'whatsapp';
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Shows a spinner, disables the button and swaps the label for loadingLabel when given. */
  loading?: boolean;
  loadingLabel?: string;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  default: 'bg-emerald-700 text-white hover:bg-emerald-800 shadow-sm',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
  outline: 'border border-emerald-700 bg-white text-emerald-800 hover:bg-emerald-50',
  ghost: 'text-slate-700 hover:bg-slate-100',
  destructive: 'bg-rose-600 text-white hover:bg-rose-700',
  whatsapp: 'bg-green-600 text-white hover:bg-green-700',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  default: 'h-12 px-5 text-base rounded-lg font-semibold gap-2 [&_svg]:h-5 [&_svg]:w-5',
  sm: 'h-10 px-4 text-sm rounded-lg font-semibold gap-1.5 [&_svg]:h-4 [&_svg]:w-4',
  lg: 'h-14 px-6 text-lg rounded-xl font-bold gap-2 [&_svg]:h-6 [&_svg]:w-6',
  icon: 'h-12 w-12 rounded-full p-0 [&_svg]:h-5 [&_svg]:w-5',
};

/** Class string for links styled as buttons (<Link className={buttonVariants({...})}>). */
export function buttonVariants(opts?: { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean; className?: string }) {
  const { variant = 'default', size = 'default', fullWidth = false, className } = opts ?? {};
  return cn(
    'inline-flex items-center justify-center whitespace-nowrap transition-colors select-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
    '[&_svg]:shrink-0',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    fullWidth && 'w-full',
    className
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = 'default', size = 'default', fullWidth, loading, loadingLabel, disabled, children, type, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type ?? 'button'}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={buttonVariants({ variant, size, fullWidth, className })}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
            {loadingLabel ?? children}
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);
Button.displayName = 'Button';
