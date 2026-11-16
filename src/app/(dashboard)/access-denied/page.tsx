import React from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import { buttonVariants } from '@/components/ui/button';

export default async function AccessDeniedPage() {
  await requireAuth();
  const lang = getLang();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-700">
        <Lock className="h-8 w-8" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-bold text-slate-900">{t(lang, 'msg.access_denied_title')}</h1>
      <p className="text-base text-slate-600">{t(lang, 'msg.access_denied_desc')}</p>
      <Link href="/" className={buttonVariants({ className: 'mt-3 w-full max-w-xs' })}>
        {t(lang, 'btn.go_home')}
      </Link>
    </div>
  );
}
