'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock, FlaskConical, IndianRupee, MessageCircle, Pencil, Printer, Trash2 } from 'lucide-react';
import type { QuoteDetail, RejectReason } from '@/types/quotes';
import { REJECT_REASONS } from '@/types/quotes';
import { whatsappHref } from '@/lib/phone';
import { Button, buttonVariants } from '@/components/ui/button';
import { ChoiceChips } from '@/components/ui/choice-chips';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { StickyBar } from '@/components/ui/sticky-bar';
import { Toast, useToast } from '@/components/ui/toast';
import { useT } from '@/components/shell/lang-provider';
import { QUOTE_LABELS } from '@/app/(dashboard)/quotes/labels';
import { quoteErrorText } from '@/app/(dashboard)/quotes/helpers';
import { deleteQuoteAction, rejectQuoteAction, sendQuoteAction, type ActionResult } from '@/app/(dashboard)/quotes/actions';

export interface QuoteActionsProps {
  quote: QuoteDetail;
  /** prefilled wa.quote_share text */
  whatsappText: string;
  order: { id: string; order_code: string } | null;
  savedCode?: string | null;
}

type Sheet = 'sent' | 'after_wa' | 'reject' | 'delete' | null;

const REASON_ICONS = { price: IndianRupee, quality: FlaskConical, timing: Clock, no_reply: MessageCircle } as const;

/** Buttons by status (screens.md 12) with the Mark sent / Buyer rejected / Delete sheets. */
export function QuoteActions({ quote, whatsappText, order, savedCode }: QuoteActionsProps) {
  const tt = useT(QUOTE_LABELS);
  const router = useRouter();
  const { toast, show, clear } = useToast();
  const [sheet, setSheet] = React.useState<Sheet>(null);
  const [reason, setReason] = React.useState<RejectReason | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (savedCode) show('success', tt('msg.saved_code', { code: savedCode }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedCode]);

  const status = quote.display_status;
  const wa = whatsappHref(quote.buyer.phone, whatsappText);
  const printHref = `/quotes/${quote.id}/print`;
  const close = React.useCallback(() => setSheet(null), []);

  function finish(result: ActionResult, successKey: string) {
    setBusy(false);
    if (!result.ok) {
      show('error', quoteErrorText(tt, result.messageKey, result.detail, quote.currency));
      return false;
    }
    setSheet(null);
    show('success', tt(successKey));
    return true;
  }

  async function markSent() {
    setBusy(true);
    if (finish(await sendQuoteAction({ id: quote.id }), 'msg.sent')) router.refresh();
  }

  async function reject() {
    if (!reason) return;
    setBusy(true);
    if (finish(await rejectQuoteAction({ id: quote.id, reason }), 'msg.saved')) router.refresh();
  }

  async function remove() {
    setBusy(true);
    if (finish(await deleteQuoteAction({ id: quote.id }), 'msg.saved')) router.push('/quotes');
  }

  /** Draft primary: open WhatsApp, then ask "Did you send it?" when the user comes back. */
  function shareDraft() {
    if (!wa) return;
    window.open(wa, '_blank', 'noopener,noreferrer');
    setSheet('after_wa');
  }

  const printLink = (
    <Link href={printHref} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'outline' })}>
      <Printer aria-hidden="true" />
      {tt('btn.print')}
    </Link>
  );

  const whatsappLink =
    wa && status !== 'draft' ? (
      <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'whatsapp' })}>
        <MessageCircle aria-hidden="true" />
        {tt('btn.share_whatsapp')}
      </a>
    ) : null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {status === 'draft' && (
          <>
            <Link href={`/quotes/${quote.id}/edit`} className={buttonVariants({ variant: 'outline' })}>
              <Pencil aria-hidden="true" />
              {tt('btn.edit')}
            </Link>
            {printLink}
            <Button variant="outline" onClick={() => setSheet('sent')}>
              {tt('btn.mark_sent')}
            </Button>
            <Button variant="ghost" className="text-rose-700" onClick={() => setSheet('delete')}>
              <Trash2 aria-hidden="true" />
              {tt('btn.delete')}
            </Button>
          </>
        )}
        {(status === 'sent' || status === 'expired') && (
          <>
            {whatsappLink}
            {printLink}
            <Button variant="ghost" className="text-rose-700" onClick={() => setSheet('reject')}>
              {tt('btn.buyer_rejected')}
            </Button>
          </>
        )}
        {(status === 'accepted' || status === 'rejected') && printLink}
      </div>

      <StickyBar>
        {status === 'draft' && (
          <Button variant="whatsapp" fullWidth onClick={shareDraft} disabled={!wa} title={!wa ? tt('msg.whatsapp_no_phone') : undefined} className="md:w-auto">
            <MessageCircle aria-hidden="true" />
            {tt('btn.share_whatsapp')}
          </Button>
        )}
        {status === 'sent' && (
          <Link href={`/quotes/${quote.id}/accept`} className={buttonVariants({ fullWidth: true, className: 'md:w-auto' })}>
            {tt('btn.buyer_accepted')}
          </Link>
        )}
        {status === 'accepted' &&
          (order ? (
            <Link href={`/orders/${order.id}`} className={buttonVariants({ fullWidth: true, className: 'md:w-auto' })}>
              {tt('quotes.open_order', { code: order.order_code })}
            </Link>
          ) : (
            <Link href="/orders" className={buttonVariants({ variant: 'outline', fullWidth: true, className: 'md:w-auto' })}>
              {tt('nav.orders')}
            </Link>
          ))}
        {(status === 'rejected' || status === 'expired') && (
          <Link href={`/quotes/new?from=${quote.id}`} className={buttonVariants({ fullWidth: true, className: 'md:w-auto' })}>
            {tt('btn.make_new_quote')}
          </Link>
        )}
      </StickyBar>

      <ConfirmSheet
        open={sheet === 'sent' || sheet === 'after_wa'}
        title={sheet === 'after_wa' ? tt('quotes.did_you_send') : tt('quotes.mark_sent_title')}
        message={`${quote.quote_no} · ${quote.buyer.company_name}`}
        confirmLabel={sheet === 'after_wa' ? tt('quotes.yes_mark_sent') : tt('btn.mark_sent')}
        loading={busy}
        onConfirm={markSent}
        onClose={close}
      />

      <ConfirmSheet
        open={sheet === 'reject'}
        title={tt('quotes.reject_title')}
        message={`${quote.quote_no} · ${quote.buyer.company_name}`}
        confirmLabel={tt('btn.buyer_rejected')}
        destructive
        loading={busy}
        confirmDisabled={!reason}
        onConfirm={reject}
        onClose={close}
      >
        <ChoiceChips<RejectReason>
          tone="dark"
          ariaLabel={tt('field.inquiry.lost_reason')}
          value={reason}
          onChange={setReason}
          options={REJECT_REASONS.map((r) => ({ value: r, label: tt(`lost_reason.${r}`), icon: REASON_ICONS[r] }))}
        />
      </ConfirmSheet>

      <ConfirmSheet
        open={sheet === 'delete'}
        title={tt('msg.confirm_delete_quote')}
        message={quote.quote_no}
        confirmLabel={tt('btn.delete')}
        destructive
        loading={busy}
        onConfirm={remove}
        onClose={close}
      />

      <Toast toast={toast} onClose={clear} />
    </>
  );
}
