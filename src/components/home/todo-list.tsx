'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bell, ChevronRight } from 'lucide-react';
import { followupRole } from '@/lib/status';
import { formatDays } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { PhoneActions } from '@/components/ui/phone-actions';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/state-views';
import { Toast, useToast } from '@/components/ui/toast';
import { useLang, useT } from '@/components/shell/lang-provider';

export interface TodoItem {
  id: string;
  title: string;
  note: string;
  /** "INQ-0007 · due 06 Nov 2026" */
  fact: string;
  daysLate: number;
  phone: string | null;
  /** Linked inquiry / buyer / quote / order when the module is held */
  href: string | null;
}

export type DoneResult = { ok: true } | { ok: false; messageKey: string; detail?: string };

export interface TodoListProps {
  items: TodoItem[];
  /** Count before the Home limit of 5 */
  total: number;
  showAll: boolean;
  onDone: (input: { id: string }) => Promise<DoneResult>;
}

/** "To do today" rows: buyer, chip (Today / n days late), note, Call + WhatsApp, Done. */
export function TodoList({ items, total, showAll, onDone }: TodoListProps) {
  const lang = useLang();
  const tt = useT();
  const { toast, show, clear } = useToast();
  const [rows, setRows] = React.useState(items);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setRows(items);
  }, [items]);

  async function markDone(id: string) {
    setBusyId(id);
    const result = await onDone({ id });
    setBusyId(null);
    if (!result.ok) {
      show('error', tt(result.messageKey, result.detail ? { floor: result.detail } : undefined));
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  if (rows.length === 0) {
    return <EmptyState message="msg.empty.todo" icon="check" />;
  }

  return (
    <>
      <ul className="overflow-hidden rounded-xl border border-slate-200 md:space-y-2 md:overflow-visible md:rounded-none md:border-0">
        {rows.map((r) => (
          <li key={r.id} className="space-y-1.5 border-b border-slate-200 bg-white p-4 last:border-b-0 md:rounded-xl md:border">
            <div className="flex items-start justify-between gap-3">
              {r.href ? (
                <Link href={r.href} className="min-w-0 flex-1 truncate text-lg font-semibold text-slate-900 hover:underline">
                  {r.title}
                </Link>
              ) : (
                <span className="min-w-0 flex-1 truncate text-lg font-semibold text-slate-900">{r.title}</span>
              )}
              <StatusBadge
                role={followupRole(r.daysLate)}
                icon={Bell}
                word={r.daysLate > 0 ? formatDays(r.daysLate, lang, 'late') : tt('common.today')}
              />
            </div>
            <p className="truncate text-base text-slate-700">{r.note}</p>
            {r.fact && <p className="truncate text-sm text-slate-500">{r.fact}</p>}
            <div className="flex items-center justify-between gap-3 pt-1">
              <PhoneActions phone={r.phone} size="icon" />
              <Button
                variant="outline"
                onClick={() => markDone(r.id)}
                loading={busyId === r.id}
                disabled={busyId !== null && busyId !== r.id}
              >
                {tt('btn.done')}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {!showAll && total > rows.length && (
        <Link href="/?todo=all" className="flex h-12 items-center justify-center gap-1 text-base font-semibold text-emerald-800">
          {tt('btn.see_all')} {total}
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </Link>
      )}
      <Toast toast={toast} onClose={clear} />
    </>
  );
}
