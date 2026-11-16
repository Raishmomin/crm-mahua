'use client';

import * as React from 'react';
import { ArrowLeft } from 'lucide-react';
import { FormField } from '@/components/ui/form-field';
import { Textarea } from '@/components/ui/textarea';
import { DateInput } from '@/components/ui/date-input';
import { ChoiceChips } from '@/components/ui/choice-chips';
import { Button, buttonVariants } from '@/components/ui/button';
import { useT } from '@/components/shell/lang-provider';

export type NoteSheetResult = { ok: true; id?: string } | { ok: false; messageKey: string; detail?: string };

export interface NoteSheetInput {
  note: string;
  /** YYYY-MM-DD or null for a plain note */
  due_on: string | null;
}

export interface NoteSheetProps {
  open: boolean;
  /** 'note': date optional (Add note); 'followup': date required (Add follow-up) */
  mode: 'note' | 'followup';
  onClose: () => void;
  onSave: (input: NoteSheetInput) => Promise<NoteSheetResult>;
  /** called after a successful save (toast, refresh) */
  onSaved?: () => void;
}

function plusDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

type Quick = 'tomorrow' | '3_days' | '7_days';
const QUICK_DAYS: Record<Quick, number> = { tomorrow: 1, '3_days': 3, '7_days': 7 };

/**
 * "Add note" / "Add follow-up" sheet (screens.md 4): full screen on phones, right drawer on md+.
 * Note text + optional "Remind me on" with Tomorrow / 3 days / 7 days chips.
 */
export function NoteSheet({ open, mode, onClose, onSave, onSaved }: NoteSheetProps) {
  const tt = useT();
  const [note, setNote] = React.useState('');
  const [dueOn, setDueOn] = React.useState('');
  const [quick, setQuick] = React.useState<Quick | null>(null);
  const [errors, setErrors] = React.useState<{ note?: string; due_on?: string }>({});
  const [banner, setBanner] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setNote('');
    setDueOn('');
    setQuick(null);
    setErrors({});
    setBanner(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  function pickQuick(q: Quick) {
    setQuick(q);
    setDueOn(plusDays(QUICK_DAYS[q]));
    setErrors((e) => ({ ...e, due_on: undefined }));
  }

  async function save() {
    const next: { note?: string; due_on?: string } = {};
    if (!note.trim()) next.note = tt('msg.error.required');
    if (mode === 'followup' && !dueOn) next.due_on = tt('msg.error.date');
    setErrors(next);
    if (next.note || next.due_on) return;

    setSaving(true);
    setBanner(null);
    const result = await onSave({ note: note.trim(), due_on: dueOn || null });
    setSaving(false);
    if (!result.ok) {
      setBanner(tt(result.messageKey, result.detail ? { floor: result.detail } : undefined));
      return;
    }
    onSaved?.();
    onClose();
  }

  const title = mode === 'followup' ? tt('btn.add_followup') : tt('btn.add_note');

  return (
    <div className="fixed inset-0 z-40 bg-white md:bg-slate-900/40" role="dialog" aria-modal="true" aria-labelledby="note-sheet-title">
      <button type="button" aria-label={tt('btn.close')} className="absolute inset-0 hidden md:block" onClick={onClose} />
      <div className="relative flex h-full flex-col bg-white md:ml-auto md:w-[480px] md:shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-200 px-2 py-2">
          <button type="button" onClick={onClose} aria-label={tt('btn.back')} className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
            <ArrowLeft aria-hidden="true" />
          </button>
          <h2 id="note-sheet-title" className="min-w-0 flex-1 truncate text-xl font-bold text-slate-900">
            {title}
          </h2>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          {banner && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-base text-rose-800">
              {banner}
            </p>
          )}
          <FormField htmlFor="followup-note" label={tt('field.followup.note')} error={errors.note}>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              autoFocus
              maxLength={2000}
              disabled={saving}
            />
          </FormField>
          <FormField
            htmlFor="followup-due"
            label={tt('field.followup.remind_on')}
            hint={mode === 'note' ? tt('common.optional') : undefined}
            error={errors.due_on}
          >
            <DateInput
              value={dueOn}
              min={plusDays(0)}
              onChange={(e) => {
                setDueOn(e.target.value);
                setQuick(null);
              }}
              disabled={saving}
            />
          </FormField>
          <ChoiceChips<Quick>
            ariaLabel={tt('field.followup.remind_on')}
            value={quick}
            onChange={pickQuick}
            disabled={saving}
            options={[
              { value: 'tomorrow', label: tt('remind.tomorrow') },
              { value: '3_days', label: tt('remind.3_days') },
              { value: '7_days', label: tt('remind.7_days') },
            ]}
          />
        </div>

        <div className="border-t border-slate-200 bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <Button fullWidth onClick={save} loading={saving} loadingLabel={tt('btn.saving')}>
            {tt('btn.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
