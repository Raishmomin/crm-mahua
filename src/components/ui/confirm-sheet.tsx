'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { useT } from '@/components/shell/lang-provider';

export interface ConfirmSheetProps {
  open: boolean;
  title: string;
  message?: string;
  /** default btn.yes */
  confirmLabel?: string;
  /** default btn.no */
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  /** disable confirm until a chip is chosen, etc. */
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  /** optional ChoiceChips (lost reason) */
  children?: React.ReactNode;
}

/** Bottom sheet on phones, centred dialog on md+. Escape and overlay close it. */
export function ConfirmSheet({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive,
  loading,
  confirmDisabled,
  onConfirm,
  onClose,
  children,
}: ConfirmSheetProps) {
  const tt = useT();

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <button type="button" aria-label={tt('btn.close')} className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div
        className={cn(
          'relative w-full max-w-lg space-y-4 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]',
          'rounded-t-2xl md:rounded-2xl md:p-6'
        )}
      >
        <h2 id="confirm-title" className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        {message && <p className="text-base text-slate-700">{message}</p>}
        {children}
        <div className="flex gap-3 pt-2">
          <Button variant="outline" fullWidth onClick={onClose} disabled={loading}>
            {cancelLabel ?? tt('btn.no')}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            fullWidth
            onClick={onConfirm}
            loading={loading}
            disabled={confirmDisabled}
          >
            {confirmLabel ?? tt('btn.yes')}
          </Button>
        </div>
      </div>
    </div>
  );
}
