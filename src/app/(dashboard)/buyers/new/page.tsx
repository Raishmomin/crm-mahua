import React from 'react';
import { redirect } from 'next/navigation';
import { requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import { PageHeader } from '@/components/ui/back-button';
import { BuyerForm } from '@/components/buyers/buyer-form';
import { safeInternalPath } from '@/components/buyers/helpers';
import { canWriteBuyers } from '@/types/buyers';
import { loadInquiryPrefill } from '../queries';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function first(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] ?? '' : v ?? '';
}

/**
 * New buyer (screens.md 8). ?from_inquiry=<id> prefills name + phone and links the inquiry after save
 * (contracts 6.1 / 6.3); ?next=<path> continues the flow (e.g. /samples/new?inquiry=...);
 * ?return=inquiry_new goes back to the inquiry form with the new buyer selected.
 */
export default async function NewBuyerPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const profile = await requireModule('buyers'); // Wall 2
  if (!canWriteBuyers(profile.role)) redirect('/buyers'); // Plant: read only (screens.md 0.1)
  const lang = getLang();

  const fromInquiryId = first(searchParams?.from_inquiry);
  const nextParam = first(searchParams?.next);
  const returnParam = first(searchParams?.return);

  const supabase = createClient();
  const prefill = UUID.test(fromInquiryId) ? await loadInquiryPrefill(supabase, fromInquiryId) : null;
  // an inquiry that already has a buyer needs no second one
  if (prefill?.buyer_id) redirect(`/inquiries/${prefill.id}`);

  // SEC2-04: only an in-app path survives (no //host, /\host or /<tab>/host)
  const next = safeInternalPath(nextParam) ?? (returnParam === 'inquiry_new' ? '/inquiries/new?buyer={id}' : null);

  return (
    <div className="space-y-4">
      <PageHeader title={t(lang, 'title.buyer_new')} backHref={prefill ? `/inquiries/${prefill.id}` : '/buyers'} />
      <BuyerForm fromInquiry={prefill ? { id: prefill.id, buyer_name: prefill.buyer_name, phone: prefill.phone } : null} next={next} />
    </div>
  );
}
