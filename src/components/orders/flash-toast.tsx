'use client';

import * as React from 'react';
import { Toast, useToast, type ToastKind } from '@/components/ui/toast';

/** Shows one toast when the page opens (e.g. "Dispatched. Invoice INV-2627-0003." after a redirect). */
export function FlashToast({ message, kind = 'success' }: { message: string | null | undefined; kind?: ToastKind }) {
  const { toast, show, clear } = useToast();
  React.useEffect(() => {
    if (message) show(kind, message);
  }, [message, kind, show]);
  return <Toast toast={toast} onClose={clear} />;
}
