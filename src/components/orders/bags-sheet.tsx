'use client';

import * as React from 'react';
import { Minus, Plus } from 'lucide-react';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { NumberInput } from '@/components/ui/number-input';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/shell/lang-provider';
import { ORDER_LABELS } from '@/app/(dashboard)/orders/labels';

/** "How many bags?" sheet: big number box prefilled with the planned bags, -10 / +10 buttons. */
export function BagsSheet({
  open,
  planned,
  loading,
  onClose,
  onSave,
}: {
  open: boolean;
  planned: number;
  loading?: boolean;
  onClose: () => void;
  onSave: (bags: number) => void;
}) {
  const tt = useT(ORDER_LABELS);
  const [value, setValue] = React.useState(String(planned || ''));
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setValue(String(planned || ''));
      setError(null);
    }
  }, [open, planned]);

  const bags = Math.floor(Number(value.replace(/,/g, '')) || 0);
  const step = (d: number) => setValue(String(Math.max(0, bags + d)));

  function save() {
    if (bags <= 0) {
      setError(tt('orders.err.bags'));
      return;
    }
    onSave(bags);
  }

  return (
    <ConfirmSheet
      open={open}
      title={tt('orders.how_many_bags')}
      confirmLabel={tt('btn.save')}
      cancelLabel={tt('btn.cancel')}
      loading={loading}
      onConfirm={save}
      onClose={onClose}
    >
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="-10" onClick={() => step(-10)}>
          <Minus aria-hidden="true" />
        </Button>
        <NumberInput
          value={value}
          onChange={(v) => {
            setValue(v.replace(/[^\d]/g, ''));
            setError(null);
          }}
          aria-label={tt('orders.how_many_bags')}
          className="h-14 text-3xl font-bold"
          inputMode="numeric"
          suffix={tt('unit.bags')}
        />
        <Button variant="outline" size="icon" aria-label="+10" onClick={() => step(10)}>
          <Plus aria-hidden="true" />
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      )}
    </ConfirmSheet>
  );
}
