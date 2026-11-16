'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import type { SampleRow, SampleStatus } from '@/types/samples';
import { SAMPLE_STATUSES } from '@/types/samples';
import { cn, formatDate } from '@/lib/utils';
import { t, type Lang } from '@/lib/i18n';
import { phoneSearchDigits } from '@/lib/phone';
import { Status } from '@/components/ui/status-badge';
import { PhoneActions } from '@/components/ui/phone-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ChoiceChips } from '@/components/ui/choice-chips';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { EmptyState } from '@/components/ui/state-views';
import { Toast, useToast } from '@/components/ui/toast';
import { useLang, useT } from '@/components/shell/lang-provider';
import { COURIERS, SAMPLE_LABELS } from '@/app/(dashboard)/samples/labels';
import { markSampleSentAction, setSampleResultAction, type ActionResult } from '@/app/(dashboard)/samples/actions';

export interface SampleListProps {
  rows: SampleRow[];
  /** ?status= from the URL; chips are links so the code stays in the query string */
  statusFilter: string | null;
  /** SMP code just saved (toast) */
  savedCode?: string | null;
  /** Company short name for the WhatsApp template */
  company: string;
  senderName: string;
  /** Hide search + chips (detail page) */
  compact?: boolean;
}

type Sheet = { kind: 'sent'; row: SampleRow } | { kind: 'result'; row: SampleRow; status: 'approved' | 'rejected' } | null;

const OTHER = '__other__';

/** WhatsApp text T3 (wa.sample_sent); export buyers always get English. */
export function sampleWhatsappText(row: SampleRow, lang: Lang, company: string, sender: string, isExport: boolean): string {
  return t(isExport ? 'en' : lang, 'wa.sample_sent', {
    buyer: row.buyer_name,
    product: row.product_short || row.product_name,
    grams: row.qty_grams,
    courier: row.courier ?? '-',
    tracking_no: row.tracking_no ?? '-',
    sender,
    company,
  });
}

/** Samples list: search, status chips, card rows with Mark sent / Approved / Rejected sheets. */
export function SampleList({ rows, statusFilter, savedCode, company, senderName, compact }: SampleListProps) {
  const lang = useLang();
  const tt = useT(SAMPLE_LABELS);
  const router = useRouter();
  const { toast, show, clear } = useToast();
  const [q, setQ] = React.useState('');
  const [sheet, setSheet] = React.useState<Sheet>(null);
  const [courier, setCourier] = React.useState<string>('');
  const [courierOther, setCourierOther] = React.useState('');
  const [tracking, setTracking] = React.useState('');
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (savedCode) show('success', tt('msg.saved_code', { code: savedCode }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedCode]);

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const s of SAMPLE_STATUSES) c[s] = rows.filter((r) => r.status === s).length;
    return c;
  }, [rows]);

  const visible = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    const digits = phoneSearchDigits(term);
    return rows.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (!term) return true;
      if (r.buyer_name.toLowerCase().includes(term) || r.code.toLowerCase().includes(term)) return true;
      if (r.product_short.toLowerCase().includes(term) || r.product_name.toLowerCase().includes(term)) return true;
      if (digits && r.phone && phoneSearchDigits(r.phone).includes(digits)) return true;
      return false;
    });
  }, [rows, q, statusFilter]);

  function openSent(row: SampleRow) {
    setCourier(row.courier && (COURIERS as readonly string[]).includes(row.courier) ? row.courier : row.courier ? OTHER : '');
    setCourierOther(row.courier && !(COURIERS as readonly string[]).includes(row.courier) ? row.courier : '');
    setTracking(row.tracking_no ?? '');
    setSheet({ kind: 'sent', row });
  }

  function openResult(row: SampleRow, status: 'approved' | 'rejected') {
    setNote('');
    setSheet({ kind: 'result', row, status });
  }

  const closeSheet = React.useCallback(() => setSheet(null), []);

  async function confirm() {
    if (!sheet) return;
    setBusy(true);
    let result: ActionResult;
    if (sheet.kind === 'sent') {
      const courierText = courier === OTHER ? courierOther.trim() : courier === 'by_hand' ? tt('samples.courier_by_hand') : courier;
      result = await markSampleSentAction({ id: sheet.row.id, courier: courierText || null, tracking_no: tracking.trim() || null });
    } else {
      result = await setSampleResultAction({ id: sheet.row.id, status: sheet.status, note: note.trim() || null });
    }
    setBusy(false);
    if (!result.ok) {
      show('error', tt(result.messageKey, result.detail ? { floor: result.detail } : undefined));
      return;
    }
    show('success', sheet.kind === 'sent' ? tt('msg.sent') : tt('msg.saved'));
    setSheet(null);
    router.refresh();
  }

  const chips: { value: string | null; label: string; count: number }[] = [
    { value: null, label: tt('btn.all'), count: counts.all },
    ...SAMPLE_STATUSES.map((s) => ({ value: s, label: tt(`status.sample.${s}`), count: counts[s] })),
  ];

  return (
    <div className="space-y-4">
      {!compact && (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <Input
              type="search"
              autoComplete="off"
              aria-label={tt('btn.search')}
              placeholder={tt('common.search_placeholder')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-12"
            />
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label={tt('title.samples')}>
            {chips.map((c) => {
              const active = (statusFilter ?? null) === c.value;
              return (
                <Link
                  key={c.value ?? 'all'}
                  role="tab"
                  aria-selected={active}
                  href={c.value ? `/samples?status=${c.value}` : '/samples'}
                  className={cn(
                    'inline-flex h-12 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-base font-medium',
                    active ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-300 bg-white text-slate-800'
                  )}
                >
                  {c.label}
                  <span className={cn('text-sm', active ? 'text-emerald-100' : 'text-slate-500')}>{c.count}</span>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {visible.length === 0 ? (
        <EmptyState message={q.trim() ? 'msg.empty.search' : 'msg.empty.samples'} />
      ) : (
        <ul className="overflow-hidden rounded-xl border border-slate-200 md:space-y-2 md:overflow-visible md:rounded-none md:border-0">
          {visible.map((r) => (
            <SampleCard
              key={r.id}
              row={r}
              lang={lang}
              company={company}
              sender={senderName}
              linked={!compact}
              onMarkSent={() => openSent(r)}
              onResult={(s) => openResult(r, s)}
            />
          ))}
        </ul>
      )}

      <ConfirmSheet
        open={sheet?.kind === 'sent'}
        title={tt('samples.mark_sent_title')}
        message={sheet?.row ? `${sheet.row.code} · ${sheet.row.buyer_name}` : undefined}
        confirmLabel={tt('btn.mark_sent')}
        loading={busy}
        onConfirm={confirm}
        onClose={closeSheet}
      >
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700">{tt('field.sample.courier')}</p>
          <ChoiceChips
            ariaLabel={tt('field.sample.courier')}
            value={courier || null}
            onChange={setCourier}
            options={[
              ...COURIERS.map((c) => ({ value: c, label: c })),
              { value: 'by_hand', label: tt('samples.courier_by_hand') },
              { value: OTHER, label: tt('samples.courier_other') },
            ]}
          />
          {courier === OTHER && (
            <Input aria-label={tt('field.sample.courier')} value={courierOther} onChange={(e) => setCourierOther(e.target.value)} />
          )}
          <label htmlFor="sheet-tracking" className="block text-sm font-semibold text-slate-700">
            {tt('field.sample.tracking_no')}
          </label>
          <Input id="sheet-tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} autoComplete="off" />
        </div>
      </ConfirmSheet>

      <ConfirmSheet
        open={sheet?.kind === 'result'}
        title={sheet?.kind === 'result' ? tt(sheet.status === 'approved' ? 'samples.approved_title' : 'samples.rejected_title') : ''}
        message={sheet?.row ? `${sheet.row.code} · ${sheet.row.buyer_name}` : undefined}
        confirmLabel={sheet?.kind === 'result' ? tt(sheet.status === 'approved' ? 'btn.approved' : 'btn.rejected') : undefined}
        destructive={sheet?.kind === 'result' && sheet.status === 'rejected'}
        loading={busy}
        onConfirm={confirm}
        onClose={closeSheet}
      >
        <div className="space-y-2">
          <label htmlFor="sheet-note" className="block text-sm font-semibold text-slate-700">
            {tt('samples.result_title')}{' '}
            <span className="font-normal text-slate-500">({tt('common.optional')})</span>
          </label>
          <Textarea id="sheet-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </ConfirmSheet>

      <Toast toast={toast} onClose={clear} />
    </div>
  );
}

function SampleCard({
  row,
  lang,
  company,
  sender,
  linked,
  onMarkSent,
  onResult,
}: {
  row: SampleRow;
  lang: Lang;
  company: string;
  sender: string;
  linked: boolean;
  onMarkSent: () => void;
  onResult: (status: 'approved' | 'rejected') => void;
}) {
  const tt = useT(SAMPLE_LABELS);
  const grams = `${row.qty_grams} ${tt('unit.g')}`;
  const fact1 = `${row.product_short || row.product_name} · ${grams}`;
  const fact2 = row.sent_on
    ? tt('samples.sent_fact', { date: formatDate(row.sent_on), courier: row.courier ?? '' }).trim()
    : row.inquiry_code ?? row.code;
  const isExport = false; // the list has no country; sample messages follow the UI language (labels.md 13)
  const message = row.status === 'sent' ? sampleWhatsappText(row, lang, company, sender, isExport) : undefined;

  return (
    <li className="space-y-2 border-b border-slate-200 bg-white p-4 last:border-b-0 md:rounded-xl md:border">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {linked ? (
            <Link href={`/samples/${row.id}`} className="block truncate text-lg font-semibold text-slate-900 hover:underline">
              {row.buyer_name}
            </Link>
          ) : (
            <span className="block truncate text-lg font-semibold text-slate-900">{row.buyer_name}</span>
          )}
          <p className="truncate text-base text-slate-700">{fact1}</p>
          <p className="truncate text-base text-slate-500">{fact2}</p>
        </div>
        <Status domain="sample" code={row.status} />
      </div>
      {row.result_note && row.status !== 'to_send' && <p className="text-base italic text-slate-600">&ldquo;{row.result_note}&rdquo;</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <PhoneActions phone={row.phone} size="icon" message={message} />
        <div className="flex gap-2">
          {row.status === 'to_send' && (
            <Button variant="outline" onClick={onMarkSent}>
              {tt('btn.mark_sent')}
            </Button>
          )}
          {row.status === 'sent' && (
            <>
              <Button variant="outline" onClick={() => onResult('approved')}>
                {tt('btn.approved')}
              </Button>
              <Button variant="outline" className="border-rose-600 text-rose-700 hover:bg-rose-50" onClick={() => onResult('rejected')}>
                {tt('btn.rejected')}
              </Button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
