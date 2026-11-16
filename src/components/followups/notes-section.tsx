'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, Circle, Plus } from 'lucide-react';
import { cn, formatDate, formatDays } from '@/lib/utils';
import { followupRole } from '@/lib/status';
import type { FollowUp, FollowUpEntityType } from '@/types/inquiries';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/state-views';
import { Toast, useToast } from '@/components/ui/toast';
import { useLang, useT } from '@/components/shell/lang-provider';
import { NoteSheet, type NoteSheetInput, type NoteSheetResult } from './note-sheet';

export interface NotesSectionProps {
  entityType: FollowUpEntityType;
  entityId: string;
  buyerId: string | null;
  items: FollowUp[];
  /** false when the viewer lacks the module: timeline is read-only */
  canWrite: boolean;
  onAdd: (input: {
    entity_type: FollowUpEntityType;
    entity_id: string;
    buyer_id: string | null;
    note: string;
    due_on: string | null;
  }) => Promise<NoteSheetResult>;
  onDone: (input: { id: string; entity_type: FollowUpEntityType }) => Promise<NoteSheetResult>;
  /** Show the "Add follow-up" (date required) button next to "Add note" */
  showFollowUpButton?: boolean;
  className?: string;
}

function daysLate(dueOn: string): number {
  const due = new Date(dueOn);
  const today = new Date();
  const a = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((b - a) / 86400000);
}

/**
 * "Notes and follow-ups" card (screens.md 4 / 7): timeline newest first, pending rows with a
 * Today / n days late / date chip and a Done button, done rows with a grey tick. Add note and
 * Add follow-up open the NoteSheet; saving refreshes the page.
 */
export function NotesSection({
  entityType,
  entityId,
  buyerId,
  items,
  canWrite,
  onAdd,
  onDone,
  showFollowUpButton = true,
  className,
}: NotesSectionProps) {
  const lang = useLang();
  const tt = useT();
  const router = useRouter();
  const { toast, show, clear } = useToast();
  const [sheet, setSheet] = React.useState<'note' | 'followup' | null>(null);
  const [rows, setRows] = React.useState(items);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setRows(items);
  }, [items]);

  const sorted = React.useMemo(
    () => [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [rows]
  );

  const closeSheet = React.useCallback(() => setSheet(null), []);

  async function save(input: NoteSheetInput) {
    return onAdd({ entity_type: entityType, entity_id: entityId, buyer_id: buyerId, note: input.note, due_on: input.due_on });
  }

  async function markDone(id: string) {
    setBusyId(id);
    const result = await onDone({ id, entity_type: entityType });
    setBusyId(null);
    if (!result.ok) {
      show('error', tt(result.messageKey, result.detail ? { floor: result.detail } : undefined));
      return;
    }
    const now = new Date().toISOString();
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, done: true, done_at: now } : r)));
    show('success', tt('msg.saved'));
    router.refresh();
  }

  return (
    <section className={cn('rounded-xl border border-slate-200 bg-white p-4', className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">{tt('section.notes_followups')}</h2>
        {canWrite && (
          <Button variant="outline" onClick={() => setSheet('note')}>
            <Plus aria-hidden="true" />
            {tt('btn.add_note')}
          </Button>
        )}
      </div>

      {sorted.length === 0 ? (
        <EmptyState message="msg.empty.notes" className="p-6" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {sorted.map((r) => {
            const pending = !r.done && !!r.due_on;
            const late = r.due_on ? daysLate(r.due_on) : 0;
            const when = pending ? r.due_on : r.done_at ?? r.created_at;
            return (
              <li key={r.id} className="flex min-h-[64px] items-start gap-3 py-3">
                {pending ? (
                  <Circle className="mt-1 h-6 w-6 shrink-0 text-amber-600" aria-hidden="true" />
                ) : (
                  <Check className="mt-1 h-6 w-6 shrink-0 text-slate-400" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={cn('text-base', pending ? 'text-slate-900' : 'text-slate-600')}>{r.note}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-sm text-slate-500">{formatDate(when)}</span>
                    {pending && (
                      <StatusBadge
                        role={followupRole(late)}
                        icon={Bell}
                        word={late > 0 ? formatDays(late, lang, 'late') : late === 0 ? tt('common.today') : formatDate(r.due_on)}
                      />
                    )}
                  </div>
                </div>
                {pending && canWrite && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => markDone(r.id)}
                    loading={busyId === r.id}
                    disabled={busyId !== null && busyId !== r.id}
                  >
                    {tt('btn.done')}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canWrite && showFollowUpButton && (
        <Button variant="outline" fullWidth className="mt-3" onClick={() => setSheet('followup')}>
          <Bell aria-hidden="true" />
          {tt('btn.add_followup')}
        </Button>
      )}

      <NoteSheet
        open={sheet !== null}
        mode={sheet ?? 'note'}
        onClose={closeSheet}
        onSave={save}
        onSaved={() => {
          show('success', tt('msg.saved'));
          router.refresh();
        }}
      />
      <Toast toast={toast} onClose={clear} />
    </section>
  );
}
