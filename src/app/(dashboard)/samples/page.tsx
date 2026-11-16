import React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import { firstName } from '@/lib/utils';
import { SAMPLE_STATUSES } from '@/types/samples';
import { PageHeader } from '@/components/ui/back-button';
import { ErrorState } from '@/components/ui/state-views';
import { StickyBar } from '@/components/ui/sticky-bar';
import { buttonVariants } from '@/components/ui/button';
import { SampleList } from '@/components/samples/sample-list';
import { loadSampleRows, sortSamples } from './data';
import { loadCompanyShort } from './company';

export default async function SamplesPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const profile = await requireModule('samples'); // Wall 2
  const lang = getLang();
  const supabase = createClient();

  const statusParam = typeof searchParams?.status === 'string' ? searchParams.status : null;
  const statusFilter = statusParam && (SAMPLE_STATUSES as string[]).includes(statusParam) ? statusParam : null;
  const saved = typeof searchParams?.saved === 'string' ? searchParams.saved : null;

  const [{ rows, error }, company] = await Promise.all([loadSampleRows(supabase, lang), loadCompanyShort(supabase, profile.org_id, lang)]);

  return (
    <div className="space-y-4 pb-28 md:pb-0">
      <PageHeader title={t(lang, 'title.samples')} subtitle={`${rows.length}`} />
      {error ? (
        <ErrorState retryHref="/samples" lang={lang} />
      ) : (
        <SampleList
          rows={sortSamples(rows)}
          statusFilter={statusFilter}
          savedCode={saved}
          company={company}
          senderName={firstName(profile.full_name)}
        />
      )}
      <StickyBar>
        <Link href="/samples/new" className={buttonVariants({ fullWidth: true, className: 'md:w-auto' })}>
          <Plus aria-hidden="true" />
          {t(lang, 'btn.send_sample')}
        </Link>
      </StickyBar>
    </div>
  );
}

export const dynamic = 'force-dynamic';
