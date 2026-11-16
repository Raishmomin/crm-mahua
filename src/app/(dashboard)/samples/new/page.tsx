import React from 'react';
import Link from 'next/link';
import { requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import { PageHeader } from '@/components/ui/back-button';
import { buttonVariants } from '@/components/ui/button';
import { SampleForm, type SampleFormInquiry } from '@/components/samples/sample-form';

interface InquiryLite {
  id: string;
  code: string;
  buyer_id: string | null;
  buyer_name: string;
  product_id: string | null;
}

export default async function NewSamplePage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  await requireModule('samples'); // Wall 2
  const lang = getLang();
  const supabase = createClient();
  const inquiryId = typeof searchParams?.inquiry === 'string' ? searchParams.inquiry : null;

  let inquiry: InquiryLite | null = null;
  if (inquiryId) {
    const { data } = await supabase.from('inquiries').select('id, code, buyer_id, buyer_name, product_id').eq('id', inquiryId).maybeSingle();
    inquiry = (data as InquiryLite | null) ?? null;
  }

  // contracts 6.3: a sample needs a buyer row; the inquiry form sends the user to make one first.
  if (inquiry && !inquiry.buyer_id) {
    return (
      <div className="space-y-4">
        <PageHeader title={t(lang, 'title.sample_new')} backHref={`/inquiries/${inquiry.id}`} />
        <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-base text-amber-900">{t(lang, 'msg.buyer_needed')}</p>
          <Link href={`/buyers/new?from_inquiry=${inquiry.id}`} className={buttonVariants({ fullWidth: true })}>
            {t(lang, 'btn.new_buyer')}
          </Link>
        </div>
      </div>
    );
  }

  const [{ data: products }, { data: buyers }] = await Promise.all([
    supabase.from('products').select('id, name').eq('is_active', true).order('name'),
    inquiry ? Promise.resolve({ data: [] as { id: string; company_name: string }[] }) : supabase.from('buyers').select('id, company_name').order('company_name'),
  ]);

  const formInquiry: SampleFormInquiry | null = inquiry
    ? { id: inquiry.id, code: inquiry.code, buyer_id: inquiry.buyer_id as string, buyer_name: inquiry.buyer_name, product_id: inquiry.product_id }
    : null;

  return (
    <div className="space-y-4">
      <PageHeader title={t(lang, 'title.sample_new')} backHref={inquiry ? `/inquiries/${inquiry.id}` : '/samples'} />
      <SampleForm
        inquiry={formInquiry}
        buyers={(buyers ?? []) as { id: string; company_name: string }[]}
        products={(products ?? []) as { id: string; name: string }[]}
      />
    </div>
  );
}

export const dynamic = 'force-dynamic';
