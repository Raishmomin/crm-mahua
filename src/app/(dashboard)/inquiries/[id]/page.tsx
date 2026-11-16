import React from 'react';
import Link from 'next/link';
import { ChevronRight, Pencil } from 'lucide-react';
import { hasModule, requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import { formatPhoneDisplay, whatsappHref } from '@/lib/phone';
import { firstName, formatDate, formatMoney, formatQty } from '@/lib/utils';
import { canWriteBuyers } from '@/types/buyers';
import { PageHeader } from '@/components/ui/back-button';
import { Status } from '@/components/ui/status-badge';
import { PhoneActions } from '@/components/ui/phone-actions';
import { EmptyState } from '@/components/ui/state-views';
import { buttonVariants } from '@/components/ui/button';
import { NotesSection } from '@/components/followups/notes-section';
import { InquiryActions, SavedToast } from '@/components/inquiries/inquiry-actions';
import { inquiryReplyMessage, productShortName, SOURCE_KEYS, templateLang } from '@/components/inquiries/helpers';
import { addFollowUpAction, followUpDoneAction } from '../actions';
import { loadInquiryDetail } from '../queries';
import { INQUIRY_LABELS } from '../labels';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Inquiry detail (screens.md 4). */
export default async function InquiryDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const profile = await requireModule('leads'); // Wall 2
  const lang = getLang();
  const tl = (key: string, vars?: Record<string, string | number>) => t(lang, key, vars, INQUIRY_LABELS);

  const supabase = createClient();
  const data = UUID.test(params.id) ? await loadInquiryDetail(supabase, params.id) : null;
  if (!data) {
    return (
      <div className="space-y-4">
        <PageHeader title={t(lang, 'title.inquiries')} backHref="/inquiries" />
        <EmptyState message={tl('inquiries.not_found')} lang={lang} actionLabel={t(lang, 'btn.go_home')} actionHref="/" />
      </div>
    );
  }

  const { inquiry, buyer, product, assignedName, followUps, sample, quote, order, companyShort } = data;
  const phone = buyer?.phone ?? inquiry.phone;
  const contactName = buyer?.contact_name || buyer?.company_name || inquiry.buyer_name;
  const productName = productShortName(lang, product, inquiry.product_text || product?.name);
  const waLang = templateLang(lang, buyer?.country, phone);
  const waText = inquiryReplyMessage(waLang, {
    contact: contactName,
    product: product?.name ?? inquiry.product_text ?? productName,
    qtyKg: inquiry.qty_kg,
    sender: firstName(profile.full_name),
    company: companyShort,
  });
  const ageDays = Math.max(0, Math.floor((Date.now() - new Date(inquiry.created_at).getTime()) / 86400000));
  const isOpen = inquiry.status !== 'won' && inquiry.status !== 'lost';
  const saved = searchParams?.saved === '1';

  const buyerLine = buyer
    ? [buyer.city, buyer.country && buyer.country !== 'India' ? buyer.country : null].filter(Boolean).join(', ')
    : null;

  return (
    <div className="space-y-4 pb-28 md:pb-0">
      <PageHeader
        title={inquiry.code}
        backHref="/inquiries"
        right={
          <div className="flex items-center gap-2">
            <Status domain="inquiry" code={inquiry.status} size="lg" lang={lang} />
            {isOpen && (
              <Link href={`/inquiries/${inquiry.id}/edit`} aria-label={t(lang, 'btn.edit')} className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
                <Pencil aria-hidden="true" />
              </Link>
            )}
          </div>
        }
      />
      {inquiry.status === 'lost' && inquiry.lost_reason && (
        <p className="-mt-2 text-base text-slate-500">{t(lang, 'msg.lost_with_reason', { reason: t(lang, `lost_reason.${inquiry.lost_reason}`) })}</p>
      )}

      {/* Buyer card */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        {buyer ? (
          <Link href={`/buyers/${buyer.id}`} className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-semibold text-slate-900">{buyer.company_name}</div>
              <div className="truncate text-base text-slate-600">{[buyerLine, buyer.contact_name].filter(Boolean).join(' · ')}</div>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
          </Link>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-semibold text-slate-900">{inquiry.buyer_name}</div>
              <div className="text-sm text-slate-500">{tl('inquiries.no_buyer_yet')}</div>
            </div>
            {hasModule(profile, 'buyers') && canWriteBuyers(profile.role) && (
              <Link href={`/buyers/new?from_inquiry=${inquiry.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                {tl('inquiries.save_as_buyer')}
              </Link>
            )}
          </div>
        )}
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-base text-slate-700">{phone ? formatPhoneDisplay(phone) : t(lang, 'common.not_set')}</span>
          <PhoneActions phone={phone} message={waText} size="full" lang={lang} className="sm:w-auto" />
        </div>
      </section>

      {/* They want */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">{t(lang, 'section.what_they_want')}</h2>
        <p className="text-xl font-bold text-slate-900">{product?.name ?? inquiry.product_text ?? t(lang, 'common.not_set')}</p>
        {inquiry.qty_kg ? (
          <p className="text-lg text-slate-800">
            {new Intl.NumberFormat('en-IN').format(Number(inquiry.qty_kg))} {t(lang, 'unit.kg')}
            {Number(inquiry.qty_kg) >= 1000 && Number(inquiry.qty_kg) % 1000 === 0 ? ` (${formatQty(inquiry.qty_kg, lang)})` : ''}
          </p>
        ) : null}
        {inquiry.needed_by && <p className="text-base text-slate-700">{tl('inquiries.needed_by', { date: formatDate(inquiry.needed_by) })}</p>}
        <p className="mt-1 text-sm text-slate-500">
          {[
            tl('inquiries.came_by', { source: t(lang, SOURCE_KEYS[inquiry.source]) }),
            ageDays === 0 ? tl('inquiries.ago_today') : tl('inquiries.ago_days', { n: ageDays }),
            assignedName ? firstName(assignedName) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {inquiry.notes && <p className="mt-2 whitespace-pre-line text-base text-slate-700">{inquiry.notes}</p>}
      </section>

      {/* Linked sample / quote */}
      {(hasModule(profile, 'samples') || hasModule(profile, 'quotes')) && (
        <section className="rounded-xl border border-slate-200 bg-white">
          {hasModule(profile, 'samples') && (
            <LinkedRow
              label={tl('inquiries.sample')}
              href={sample ? `/samples/${sample.id}` : null}
              text={sample ? [sample.code, sample.sent_on ? formatDate(sample.sent_on) : null, sample.courier].filter(Boolean).join(' · ') : '-'}
              badge={sample ? <Status domain="sample" code={sample.status} lang={lang} /> : null}
            />
          )}
          {hasModule(profile, 'quotes') && (
            <LinkedRow
              label={tl('inquiries.quote')}
              href={quote ? `/quotes/${quote.id}` : null}
              text={quote ? [quote.quote_no, formatMoney(quote.total, quote.currency)].join(' · ') : '-'}
              badge={
                quote ? (
                  <Status
                    domain="quote"
                    code={quote.status === 'sent' && quote.valid_till && quote.valid_till < new Date().toISOString().slice(0, 10) ? 'expired' : quote.status}
                    lang={lang}
                  />
                ) : null
              }
            />
          )}
        </section>
      )}

      <NotesSection
        entityType="inquiry"
        entityId={inquiry.id}
        buyerId={inquiry.buyer_id}
        items={followUps}
        canWrite
        onAdd={addFollowUpAction}
        onDone={followUpDoneAction}
      />

      <InquiryActions
        inquiryId={inquiry.id}
        status={inquiry.status}
        buyerId={inquiry.buyer_id}
        whatsappHref={whatsappHref(phone, waText)}
        isOwner={profile.role === 'owner'}
        canSamples={hasModule(profile, 'samples')}
        canQuotes={hasModule(profile, 'quotes')}
        canOrders={hasModule(profile, 'orders')}
        quoteId={quote?.id ?? null}
        orderId={order?.id ?? null}
      />

      {saved && <SavedToast code={inquiry.code} />}
    </div>
  );
}

function LinkedRow({ label, href, text, badge }: { label: string; href: string | null; text: string; badge: React.ReactNode }) {
  const body = (
    <>
      <span className="w-20 shrink-0 text-sm font-semibold text-slate-500">{label}</span>
      <span className="min-w-0 flex-1 truncate text-base text-slate-900">{text}</span>
      {badge}
      {href && <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />}
    </>
  );
  const classes = 'flex min-h-[56px] items-center gap-3 px-4 py-2 border-b border-slate-100 last:border-b-0';
  return href ? (
    <Link href={href} className={`${classes} hover:bg-slate-50`}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
