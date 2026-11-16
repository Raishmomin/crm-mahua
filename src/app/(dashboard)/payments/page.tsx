import React from 'react';
import { requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import { MONEY_FILTERS, type MoneyFilter } from '@/types/payments';
import { PageHeader } from '@/components/ui/back-button';
import { MoneyList } from '@/components/payments/money-list';
import { loadCompanyName } from '@/app/(dashboard)/orders/data';
import { loadBalances, loadRates } from './data';

/** Money list (screens.md 21). `?filter=due` (Home tile) = Late + Waiting; also late / waiting / paid. */
export default async function PaymentsPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const profile = await requireModule('payments'); // Wall 2
  const lang = getLang();
  const raw = typeof searchParams?.filter === 'string' ? searchParams.filter : 'all';
  const filter: MoneyFilter = (MONEY_FILTERS as string[]).includes(raw) ? (raw as MoneyFilter) : 'all';
  const supabase = createClient();
  const [rows, rates, company] = await Promise.all([loadBalances(supabase), loadRates(supabase, profile.org_id), loadCompanyName(supabase, profile.org_id)]);

  return (
    <div className="space-y-4">
      <PageHeader title={t(lang, 'title.money')} />
      <MoneyList rows={rows} filter={filter} rates={rates} company={company} />
    </div>
  );
}

export const dynamic = 'force-dynamic';
