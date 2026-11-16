import React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import { isMissingObjectError } from '@/lib/db-errors';
import { QUOTE_STATUSES } from '@/types/quotes';
import { PageHeader } from '@/components/ui/back-button';
import { ErrorState } from '@/components/ui/state-views';
import { StickyBar } from '@/components/ui/sticky-bar';
import { buttonVariants } from '@/components/ui/button';
import { QuoteList } from '@/components/quotes/quote-list';
import { loadQuoteList, sortQuotes } from './data';

export default async function QuotesPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  await requireModule('quotes'); // Wall 2
  const lang = getLang();
  const supabase = createClient();

  const statusParam = typeof searchParams?.status === 'string' ? searchParams.status : null;
  const statusFilter = statusParam && (QUOTE_STATUSES as string[]).includes(statusParam) ? statusParam : null;
  const saved = typeof searchParams?.saved === 'string' ? searchParams.saved : null;

  const { rows, error } = await loadQuoteList(supabase);

  // Order codes for accepted quotes (orders arrive with 0006; a missing table is not an error).
  const orderCodes: Record<string, string> = {};
  const accepted = rows.filter((r) => r.status === 'accepted').map((r) => r.id);
  if (accepted.length > 0) {
    try {
      const { data, error: ordersError } = await supabase.from('orders').select('quotation_id, order_code').in('quotation_id', accepted);
      if (ordersError) {
        if (!isMissingObjectError(ordersError)) console.error('[quotes] orders lookup failed:', ordersError.code, ordersError.message);
      } else {
        for (const o of (data ?? []) as { quotation_id: string; order_code: string }[]) orderCodes[o.quotation_id] = o.order_code;
      }
    } catch {
      // unreachable: list renders without order codes
    }
  }

  return (
    <div className="space-y-4 pb-28 md:pb-0">
      <PageHeader title={t(lang, 'title.quotes')} subtitle={`${rows.length}`} />
      {error ? <ErrorState retryHref="/quotes" lang={lang} /> : <QuoteList rows={sortQuotes(rows)} statusFilter={statusFilter} savedCode={saved} orderCodes={orderCodes} />}
      <StickyBar>
        <Link href="/quotes/new" className={buttonVariants({ fullWidth: true, className: 'md:w-auto' })}>
          <Plus aria-hidden="true" />
          {t(lang, 'btn.new_quote')}
        </Link>
      </StickyBar>
    </div>
  );
}

export const dynamic = 'force-dynamic';
