'use client';

import * as React from 'react';
import { Bell, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { followupRole } from '@/lib/status';
import { formatDate, formatDays } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Toast, useToast } from '@/components/ui/toast';
import { useLang, useT } from '@/components/shell/lang-provider';
import type { QuoteFollowup } from '@/app/(dashboard)/quotes/data';
import { quoteFollowUpDoneAction } from '@/app/(dashboard)/quotes/actions';
import { daysUntil } from '@/app/(dashboard)/quotes/helpers';

/** Notes and reminders on a quote (follow_ups entity quote) with Done on pending rows. */
export function QuoteFollowups({ rows }: { rows: QuoteFollowup[] }) {
  const lang = useLang();
  const tt = useT();
  const router = useRouter();
  const { toast, show, clear } = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function done(id: string) {
    setBusy(id);
    const result = await quoteFollowUpDoneAction({ id });
    setBusy(null);
    if (!result.ok) {
      show('error', tt(result.messageKey));
      return;
    }
    router.refresh();
  }

  if (rows.length === 0) return <p className="text-base text-slate-500">{tt('msg.empty.notes')}</p>;

  return (
    <>
      <ul className="divide-y divide-slate-200">
        {rows.map((r) => {
          const late = r.due_on ? -daysUntil(r.due_on) : 0;
          return (
            <li key={r.id} className="flex items-start gap-3 py-3">
              {r.done ? (
                <StatusBadge role="green" icon={Check} word={tt('status.followup.done')} />
              ) : (
                <StatusBadge role={followupRole(late)} icon={Bell} word={late > 0 ? formatDays(late, lang, 'late') : r.due_on ? formatDate(r.due_on) : tt('status.followup.pending')} />
              )}
              <p className="min-w-0 flex-1 text-base text-slate-800">{r.note}</p>
              {!r.done && (
                <Button variant="outline" size="sm" onClick={() => done(r.id)} loading={busy === r.id} disabled={busy !== null && busy !== r.id}>
                  {tt('btn.done')}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <Toast toast={toast} onClose={clear} />
    </>
  );
}
