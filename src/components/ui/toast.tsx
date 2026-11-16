'use client';

import * as React from 'react';
import { AlertCircle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastKind = 'success' | 'error';
export interface ToastState {
  kind: ToastKind;
  message: string;
  id: number;
}

/** const { toast, show, clear } = useToast(); show('success', tt('msg.saved')); <Toast toast={toast} onClose={clear} /> */
export function useToast() {
  const [toast, setToast] = React.useState<ToastState | null>(null);
  const show = React.useCallback((kind: ToastKind, message: string) => {
    setToast({ kind, message, id: Date.now() });
  }, []);
  const clear = React.useCallback(() => setToast(null), []);
  return { toast, show, clear };
}

/** Bottom-centred pill above the nav; success hides after 2 s, error after 5 s; one at a time. */
export function Toast({ toast, onClose, className }: { toast: ToastState | null; onClose: () => void; className?: string }) {
  React.useEffect(() => {
    if (!toast) return;
    const ms = toast.kind === 'success' ? 2000 : 5000;
    const timer = window.setTimeout(onClose, ms);
    return () => window.clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;
  const success = toast.kind === 'success';
  return (
    <div
      role={success ? 'status' : 'alert'}
      aria-live="polite"
      className={cn(
        'fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 md:bottom-6',
        className
      )}
    >
      <button
        type="button"
        onClick={onClose}
        className={cn(
          'flex h-12 max-w-full items-center gap-2 rounded-full px-5 text-base shadow-lg',
          success ? 'bg-emerald-700 text-white' : 'bg-rose-600 text-white'
        )}
      >
        {success ? <Check className="h-5 w-5 shrink-0" aria-hidden="true" /> : <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />}
        <span className="truncate">{toast.message}</span>
      </button>
    </div>
  );
}
