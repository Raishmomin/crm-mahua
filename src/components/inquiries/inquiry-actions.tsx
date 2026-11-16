'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock, FileText, FlaskConical, IndianRupee, MessageCircle, RotateCcw, XCircle } from 'lucide-react';
import type { InquiryStatus, LostReason } from '@/types/inquiries';
import { LOST_REASONS } from '@/types/inquiries';
import { Button, buttonVariants } from '@/components/ui/button';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { ChoiceChips } from '@/components/ui/choice-chips';
import { StickyBar } from '@/components/ui/sticky-bar';
import { Toast, useToast } from '@/components/ui/toast';
import { useT } from '@/components/shell/lang-provider';
import { setInquiryStatusAction } from '@/app/(dashboard)/inquiries/actions';
import { INQUIRY_LABELS } from '@/app/(dashboard)/inquiries/labels';

export interface InquiryActionsProps {
  inquiryId: string;
  status: InquiryStatus;
  buyerId: string | null;
  /** wa.me link with the T1 text, null when there is no usable phone */
  whatsappHref: string | null;
  isOwner: boolean;
  canSamples: boolean;
  canQuotes: boolean;
  canOrders: boolean;
  quoteId: string | null;
  orderId: string | null;
}

const REASON_ICONS = { price: IndianRupee, quality: FlaskConical, timing: Clock, no_reply: MessageCircle } as const;

/**
 * Bottom buttons of the inquiry page by status (screens.md 4): Reply on WhatsApp / Make quote /
 * Open quote / Open order as primary; Send sample, Mark lost (+ reason sheet), Reopen as secondary.
 * Send sample / Make quote on an inquiry without a buyer first saves the buyer (contracts 6.3).
 */
export function InquiryActions({
  inquiryId,
  status,
  buyerId,
  whatsappHref,
  isOwner,
  canSamples,
  canQuotes,
  canOrders,
  quoteId,
  orderId,
}: InquiryActionsProps) {
  const tt = useT(INQUIRY_LABELS);
  const router = useRouter();
  const { toast, show, clear } = useToast();
  const [lostOpen, setLostOpen] = React.useState(false);
  const [reason, setReason] = React.useState<LostReason | null>(null);
  const [needBuyerNext, setNeedBuyerNext] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const sampleHref = `/samples/new?inquiry=${inquiryId}`;
  const quoteHref = `/quotes/new?inquiry=${inquiryId}${buyerId ? `&buyer=${buyerId}` : ''}`;

  function go(next: string) {
    if (!buyerId) {
      // contracts 6.3: save the buyer first, then continue with ?inquiry=&buyer= ({id} = the new buyer, filled by BuyerForm)
      setNeedBuyerNext(`${next}&buyer={id}`);
      return;
    }
    router.push(next);
  }

  async function setStatus(next: InquiryStatus, lostReason: LostReason | null = null) {
    setBusy(true);
    const result = await setInquiryStatusAction({ id: inquiryId, status: next, reason: lostReason });
    setBusy(false);
    if (!result.ok) {
      show('error', tt(result.messageKey, result.detail ? { floor: result.detail } : undefined));
      return false;
    }
    show('success', tt('msg.saved'));
    router.refresh();
    return true;
  }

  async function markLost() {
    if (!reason) return;
    const ok = await setStatus('lost', reason);
    if (ok) setLostOpen(false);
  }

  /** Reply on WhatsApp: the link opens in a new tab; coming back the inquiry is Talking. */
  function onReply() {
    if (status === 'new') void setStatus('talking');
  }

  const open = status !== 'won' && status !== 'lost';
  const sampleBtn = canSamples && open && (
    <Button variant="outline" fullWidth onClick={() => go(sampleHref)} disabled={busy}>
      <FlaskConical aria-hidden="true" />
      {tt('btn.send_sample')}
    </Button>
  );
  const lostBtn = open && (
    <Button variant="outline" fullWidth className="border-rose-300 text-rose-700 hover:bg-rose-50" onClick={() => setLostOpen(true)} disabled={busy}>
      <XCircle aria-hidden="true" />
      {tt('btn.mark_lost')}
    </Button>
  );

  let primary: React.ReactNode = null;
  let secondary: React.ReactNode = null;

  if (status === 'new') {
    primary = whatsappHref ? (
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onReply}
        className={buttonVariants({ variant: 'whatsapp', fullWidth: true })}
      >
        <MessageCircle aria-hidden="true" />
        {tt('btn.reply_whatsapp')}
      </a>
    ) : (
      <Button fullWidth onClick={() => setStatus('talking')} loading={busy}>
        <MessageCircle aria-hidden="true" />
        {tt('btn.mark_talking')}
      </Button>
    );
    secondary = (
      <>
        {sampleBtn}
        {canQuotes && (
          <Button variant="outline" fullWidth onClick={() => go(quoteHref)} disabled={busy}>
            <FileText aria-hidden="true" />
            {tt('btn.make_quote')}
          </Button>
        )}
        {lostBtn}
      </>
    );
  } else if (status === 'talking' || status === 'sample_sent') {
    primary = canQuotes ? (
      <Button fullWidth onClick={() => go(quoteHref)} disabled={busy}>
        <FileText aria-hidden="true" />
        {tt('btn.make_quote')}
      </Button>
    ) : canSamples ? (
      <Button fullWidth onClick={() => go(sampleHref)} disabled={busy}>
        <FlaskConical aria-hidden="true" />
        {tt('btn.send_sample')}
      </Button>
    ) : null;
    secondary = (
      <>
        {canQuotes && sampleBtn}
        {lostBtn}
      </>
    );
  } else if (status === 'quoted') {
    primary = canQuotes ? (
      <Link href={quoteId ? `/quotes/${quoteId}` : quoteHref} className={buttonVariants({ fullWidth: true })}>
        <FileText aria-hidden="true" />
        {tt('inquiries.open_quote')}
      </Link>
    ) : null;
    secondary = lostBtn;
  } else if (status === 'won') {
    primary = canOrders ? (
      <Link href={orderId ? `/orders/${orderId}` : '/orders'} className={buttonVariants({ fullWidth: true })}>
        {tt('inquiries.open_order')}
      </Link>
    ) : null;
  } else if (status === 'lost') {
    secondary = isOwner ? (
      <Button variant="outline" fullWidth onClick={() => setStatus('talking')} loading={busy}>
        <RotateCcw aria-hidden="true" />
        {tt('btn.reopen')}
      </Button>
    ) : null;
  }

  return (
    <>
      {secondary && <div className="flex flex-col gap-3 sm:flex-row">{secondary}</div>}
      {primary && <StickyBar>{primary}</StickyBar>}

      <ConfirmSheet
        open={lostOpen}
        title={tt('inquiries.why_lost')}
        message={tt('msg.confirm_lost')}
        confirmLabel={tt('btn.mark_lost')}
        destructive
        loading={busy}
        confirmDisabled={!reason}
        onConfirm={markLost}
        onClose={() => setLostOpen(false)}
      >
        <ChoiceChips<LostReason>
          tone="dark"
          ariaLabel={tt('field.inquiry.lost_reason')}
          value={reason}
          onChange={setReason}
          options={LOST_REASONS.map((r) => ({ value: r, label: tt(`lost_reason.${r}`), icon: REASON_ICONS[r] }))}
        />
      </ConfirmSheet>

      <ConfirmSheet
        open={needBuyerNext !== null}
        title={tt('btn.new_buyer')}
        message={tt('msg.buyer_needed')}
        confirmLabel={tt('btn.new_buyer')}
        onConfirm={() => {
          const next = needBuyerNext ?? '';
          setNeedBuyerNext(null);
          router.push(`/buyers/new?from_inquiry=${inquiryId}&next=${encodeURIComponent(next)}`);
        }}
        onClose={() => setNeedBuyerNext(null)}
      />

      <Toast toast={toast} onClose={clear} />
    </>
  );
}

/** Green "INQ-0011 saved" toast after a redirect with ?saved=1. */
export function SavedToast({ code }: { code: string }) {
  const tt = useT();
  const { toast, show, clear } = useToast();
  React.useEffect(() => {
    show('success', tt('msg.saved_code', { code }));
  }, [code, show, tt]);
  return <Toast toast={toast} onClose={clear} />;
}
