import React from 'react';
import { requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import type { PaymentOrderOption } from '@/types/payments';
import { PageHeader } from '@/components/ui/back-button';
import { PaymentForm } from '@/components/payments/payment-form';
import { loadCompanyName } from '@/app/(dashboard)/orders/data';
import { loadBalances, loadRates } from '../data';

/** Money received (screens.md 22). `?order=<id>` prefills the order; `&from=order` makes Done go back to it. */
export default async function NewPaymentPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const profile = await requireModule('payments'); // Wall 2
  const lang = getLang();
  const supabase = createClient();
  const [rows, rates, company] = await Promise.all([loadBalances(supabase), loadRates(supabase, profile.org_id), loadCompanyName(supabase, profile.org_id)]);

  // Orders with money due first (Late, then Waiting), then the rest.
  const options: PaymentOrderOption[] = [...rows]
    .sort((a, b) => Number(b.due > 0) - Number(a.due > 0) || b.days_overdue - a.days_overdue || a.order_code.localeCompare(b.order_code))
    .map((r) => ({
      order_id: r.order_id,
      order_code: r.order_code,
      buyer_name: r.buyer_name,
      currency: r.currency,
      total: r.total,
      due: r.due,
      advance_expected: r.advance_expected,
      received: r.received,
      advance_ok: r.advance_ok,
      fx_rate: r.fx_rate,
      phone: r.phone,
      is_export: r.currency !== 'INR',
    }));
  const orderParam = typeof searchParams?.order === 'string' ? searchParams.order : null;
  const fromOrder = searchParams?.from === 'order';

  return (
    <div>
      <PageHeader title={t(lang, 'title.money_received')} backHref={fromOrder && orderParam ? `/orders/${orderParam}` : '/payments'} />
      <PaymentForm options={options} initialOrderId={orderParam} rates={rates} company={company} backTo={fromOrder ? 'order' : 'list'} />
    </div>
  );
}

export const dynamic = 'force-dynamic';
