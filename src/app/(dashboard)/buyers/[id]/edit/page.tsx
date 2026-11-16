import React from 'react';
import { redirect } from 'next/navigation';
import { requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import { canWriteBuyers, type Buyer, type BuyerContact } from '@/types/buyers';
import { PageHeader } from '@/components/ui/back-button';
import { EmptyState } from '@/components/ui/state-views';
import { BuyerForm } from '@/components/buyers/buyer-form';
import { BUYER_LABELS } from '../../labels';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Edit buyer (screens.md 8): the New buyer form prefilled, plus the Buyer active switch under More. */
export default async function EditBuyerPage({ params }: { params: { id: string } }) {
  const profile = await requireModule('buyers'); // Wall 2
  if (!canWriteBuyers(profile.role)) redirect(`/buyers/${params.id}`); // Plant: read only (screens.md 0.1)
  const lang = getLang();

  const supabase = createClient();
  const valid = UUID.test(params.id);
  const [buyerRes, contactRes] = await Promise.all([
    valid ? supabase.from('buyers').select('*').eq('id', params.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    valid
      ? supabase
          .from('buyer_contacts')
          .select('*')
          .eq('buyer_id', params.id)
          .order('is_primary', { ascending: false })
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (buyerRes.error) {
    console.error('[buyers] edit:', buyerRes.error.code, buyerRes.error.message);
    throw new Error('load failed'); // error.tsx shows the plain retry box
  }
  if (contactRes.error) console.error('[buyers] edit contact:', contactRes.error.code, contactRes.error.message);

  const buyer = buyerRes.data as Buyer | null;
  if (!buyer) {
    return (
      <div className="space-y-4">
        <PageHeader title={t(lang, 'title.buyer_edit')} backHref="/buyers" />
        <EmptyState message={t(lang, 'buyers.not_found', undefined, BUYER_LABELS)} lang={lang} actionLabel={t(lang, 'btn.go_home')} actionHref="/" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t(lang, 'title.buyer_edit')} subtitle={buyer.company_name} backHref={`/buyers/${buyer.id}`} />
      <BuyerForm initial={{ buyer, contact: (contactRes.data as BuyerContact | null) ?? null }} />
    </div>
  );
}
