import React from 'react';
import Link from 'next/link';
import { ChevronRight, MessageCircle, Pencil, Plus } from 'lucide-react';
import { hasModule, requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import { formatPhoneDisplay, whatsappHref } from '@/lib/phone';
import { formatDate, formatDays, formatMoney, formatQty } from '@/lib/utils';
import { canWriteBuyers, isExportType } from '@/types/buyers';
import { PageHeader } from '@/components/ui/back-button';
import { Status } from '@/components/ui/status-badge';
import { PhoneActions } from '@/components/ui/phone-actions';
import { EmptyState } from '@/components/ui/state-views';
import { StickyBar } from '@/components/ui/sticky-bar';
import { buttonVariants } from '@/components/ui/button';
import { NotesSection } from '@/components/followups/notes-section';
import { templateLang } from '@/components/inquiries/helpers';
import { addFollowUpAction, followUpDoneAction } from '@/app/(dashboard)/inquiries/actions';
import { loadBuyerDetail } from '../queries';
import { BUYER_LABELS } from '../labels';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Buyer detail (screens.md 7). Plant (operations) sees no money card and no quotes block. */
export default async function BuyerDetailPage({ params }: { params: { id: string } }) {
  const profile = await requireModule('buyers'); // Wall 2
  const lang = getLang();
  const tl = (key: string, vars?: Record<string, string | number>) => t(lang, key, vars, BUYER_LABELS);

  const supabase = createClient();
  const data = UUID.test(params.id) ? await loadBuyerDetail(supabase, params.id) : null;
  if (!data) {
    return (
      <div className="space-y-4">
        <PageHeader title={t(lang, 'title.buyers')} backHref="/buyers" />
        <EmptyState message={tl('buyers.not_found')} lang={lang} actionLabel={t(lang, 'btn.go_home')} actionHref="/" />
      </div>
    );
  }

  const { buyer, contacts, money, worstOrder, worstInvoiceNo, openInquiries, openInquiryCount, quotes, orders, followUps, companyShort } = data;
  const isPlant = profile.role === 'operations';
  const canEdit = canWriteBuyers(profile.role);
  const canLeads = hasModule(profile, 'leads');
  const primary = contacts[0] ?? null;
  const isExport = isExportType(buyer.buyer_type);
  const headerLine = [
    t(lang, isExport ? 'field.buyer.export' : 'field.buyer.india'),
    [buyer.city, isExport || buyer.country !== 'India' ? buyer.country : null].filter(Boolean).join(', ') || null,
    buyer.preferred_currency,
    buyer.incoterm,
  ]
    .filter(Boolean)
    .join(' · ');

  const worstMoney = money.find((m) => m.money_status === 'overdue') ?? money[0] ?? null;
  const remindText = worstMoney
    ? t(templateLang(lang, buyer.country, primary?.phone), 'wa.payment_reminder', {
        buyer: primary?.name ?? buyer.company_name,
        amount: formatMoney(worstMoney.total_due, worstMoney.currency),
        order_code: worstOrder?.order_code ?? '-',
        invoice_no: worstInvoiceNo ?? '-',
        due_date: worstOrder?.due_date ? formatDate(worstOrder.due_date) : worstMoney.oldest_due_date ? formatDate(worstMoney.oldest_due_date) : '-',
        company: companyShort,
      })
    : null;
  const remindHref = remindText ? whatsappHref(primary?.phone, remindText) : null;

  const sectionClass = 'rounded-xl border border-slate-200 bg-white p-4';

  return (
    <div className="space-y-4 pb-28 md:pb-0">
      <PageHeader
        title={buyer.company_name}
        subtitle={headerLine}
        backHref="/buyers"
        right={
          canEdit ? (
            <Link href={`/buyers/${buyer.id}/edit`} aria-label={t(lang, 'btn.edit')} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <Pencil aria-hidden="true" />
              {t(lang, 'btn.edit')}
            </Link>
          ) : undefined
        }
      />

      {/* Contacts */}
      <section className={sectionClass}>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">{t(lang, 'section.contacts')}</h2>
        {primary ? (
          <>
            <p className="text-base text-slate-900">{[primary.name, primary.designation].filter(Boolean).join(' · ')}</p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-base text-slate-700">{formatPhoneDisplay(primary.phone)}</span>
              <PhoneActions phone={primary.phone} size="full" lang={lang} className="sm:w-auto" />
            </div>
            {contacts.length > 1 && (
              <details className="mt-3">
                <summary className="flex h-12 cursor-pointer list-none items-center text-base font-semibold text-emerald-800">
                  {tl('buyers.more_contacts', { n: contacts.length - 1 })}
                </summary>
                <ul className="divide-y divide-slate-100">
                  {contacts.slice(1).map((c) => (
                    <li key={c.id} className="flex min-h-[64px] items-center gap-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base text-slate-900">{[c.name, c.designation].filter(Boolean).join(' · ')}</p>
                        <p className="truncate text-sm text-slate-500">{formatPhoneDisplay(c.phone)}</p>
                      </div>
                      <PhoneActions phone={c.phone} size="icon" lang={lang} />
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        ) : (
          <p className="text-base text-slate-500">{t(lang, 'msg.whatsapp_no_phone')}</p>
        )}
      </section>

      {/* Money due (not for Plant) */}
      {!isPlant && (
        <section className={sectionClass}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">{t(lang, 'field.buyer.money_due')}</h2>
            <Status domain="money" code={worstMoney?.money_status ?? 'paid'} lang={lang} />
          </div>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${worstMoney?.money_status === 'overdue' ? 'text-rose-700' : 'text-slate-900'}`}>
            {money.length > 0 ? money.map((m) => formatMoney(m.total_due, m.currency)).join(' + ') : formatMoney(0, buyer.preferred_currency === 'USD' ? 'USD' : 'INR')}
          </p>
          {worstOrder && (
            <p className="text-base text-slate-600">
              {worstOrder.order_code} ·{' '}
              {Number(worstOrder.days_overdue) > 0
                ? formatDays(Number(worstOrder.days_overdue), lang, 'late')
                : worstOrder.due_date
                  ? t(lang, 'common.due_on', { date: formatDate(worstOrder.due_date) })
                  : t(lang, 'common.after_dispatch')}
            </p>
          )}
          {remindHref && (
            <a href={remindHref} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'whatsapp', fullWidth: true, className: 'mt-3' })}>
              <MessageCircle aria-hidden="true" />
              {t(lang, 'btn.remind_whatsapp')}
            </a>
          )}
        </section>
      )}

      {/* Inquiries */}
      {canLeads && (
        <section className={sectionClass}>
          <SectionHeader title={`${t(lang, 'section.open_inquiries')} (${openInquiryCount})`} href={openInquiryCount > 3 ? `/inquiries?q=${encodeURIComponent(buyer.company_name)}` : null} />
          {openInquiries.length === 0 ? (
            <p className="text-base text-slate-500">{t(lang, 'msg.empty.inquiries')}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {openInquiries.map((i) => (
                <li key={i.id}>
                  <Link href={`/inquiries/${i.id}`} className="flex min-h-[56px] items-center gap-3 py-2 hover:bg-slate-50">
                    <span className="min-w-0 flex-1 truncate text-base text-slate-900">
                      {i.code} {i.product_name ?? ''} {i.qty_kg ? formatQty(i.qty_kg, lang) : ''}
                    </span>
                    <Status domain="inquiry" code={i.status} lang={lang} />
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Quotes (not for Plant) */}
      {!isPlant && hasModule(profile, 'quotes') && (
        <section className={sectionClass}>
          <SectionHeader title={`${t(lang, 'section.open_quotes')} (${quotes.length})`} href={quotes.length > 0 ? `/quotes?buyer=${buyer.id}` : null} />
          {quotes.length === 0 ? (
            <p className="text-base text-slate-500">{t(lang, 'msg.empty.quotes')}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {quotes.map((qt) => (
                <li key={qt.id}>
                  <Link href={`/quotes/${qt.id}`} className="flex min-h-[56px] items-center gap-3 py-2 hover:bg-slate-50">
                    <span className="min-w-0 flex-1 truncate text-base text-slate-900">
                      {qt.quote_no} · {formatMoney(qt.total, qt.currency)}
                    </span>
                    <Status
                      domain="quote"
                      code={qt.status === 'sent' && qt.valid_till && qt.valid_till < new Date().toISOString().slice(0, 10) ? 'expired' : qt.status}
                      lang={lang}
                    />
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Orders */}
      {hasModule(profile, 'orders') && (
        <section className={sectionClass}>
          <SectionHeader title={`${t(lang, 'section.last_orders')} (${orders.length})`} href={orders.length > 0 ? `/orders?buyer=${buyer.id}` : null} />
          {orders.length === 0 ? (
            <p className="text-base text-slate-500">{t(lang, 'msg.empty.orders')}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/orders/${o.id}`} className="flex min-h-[56px] items-center gap-3 py-2 hover:bg-slate-50">
                    <span className="min-w-0 flex-1 truncate text-base text-slate-900">
                      {o.order_code}
                      {!isPlant ? ` · ${formatMoney(o.total, o.currency)}` : ''}
                    </span>
                    <Status domain="order" code={o.status} lang={lang} />
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <NotesSection entityType="buyer" entityId={buyer.id} buyerId={buyer.id} items={followUps} canWrite onAdd={addFollowUpAction} onDone={followUpDoneAction} />

      {canLeads && (
        <StickyBar>
          <Link href={`/inquiries/new?buyer=${buyer.id}`} className={buttonVariants({ fullWidth: true })}>
            <Plus aria-hidden="true" />
            {t(lang, 'btn.new_inquiry')}
          </Link>
        </StickyBar>
      )}
    </div>
  );
}

function SectionHeader({ title, href }: { title: string; href: string | null }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {href && (
        <Link href={href} aria-label={title} className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
          <ChevronRight aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
