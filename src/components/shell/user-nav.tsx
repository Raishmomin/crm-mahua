'use client';

import React from 'react';
import type { Profile } from '@/types/database';
import { firstName } from '@/lib/utils';
import { roleWord } from '@/lib/i18n';
import { useLang } from './lang-provider';
import { SignOutButton } from './sign-out-button';

/** Header right side on md+: first name, job word, sign-out icon button. */
export function UserNav({ profile }: { profile: Profile }) {
  const lang = useLang();
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 text-right">
        <p className="truncate text-base font-semibold text-slate-900">{firstName(profile.full_name)}</p>
        <p className="truncate text-sm text-slate-500">{roleWord(lang, profile.role)}</p>
      </div>
      <SignOutButton variant="ghost" iconOnly className="text-slate-600 hover:text-rose-700" />
    </div>
  );
}
