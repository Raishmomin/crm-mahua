import React from 'react';
import { UserX } from 'lucide-react';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import { SignOutButton } from '@/components/shell/sign-out-button';

/** Reached from requireAuth when profiles.is_active is false. No requireAuth here (it would loop). */
export default function AccountInactivePage() {
  const lang = getLang();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <UserX className="h-8 w-8" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-bold text-slate-900">{t(lang, 'msg.account_inactive_title')}</h1>
      <p className="text-base text-slate-600">{t(lang, 'msg.account_inactive_desc')}</p>
      <div className="mt-3 w-full max-w-xs">
        <SignOutButton variant="default" fullWidth label={t(lang, 'btn.sign_in')} />
      </div>
    </div>
  );
}
