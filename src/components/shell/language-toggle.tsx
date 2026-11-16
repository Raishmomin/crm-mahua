'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LANGS, t, type Lang } from '@/lib/i18n';
import { setLangAction } from '@/lib/i18n-actions';
import { useLang } from './lang-provider';

export interface LanguageToggleProps {
  /** compact = EN / ગુ (header on md+); full = English / ગુજરાતી (login, More sheet) */
  variant?: 'compact' | 'full';
  className?: string;
}

const SHORT: Record<Lang, string> = { en: 'EN', gu: 'ગુ' };
const WORD_KEY: Record<Lang, string> = { en: 'btn.lang_en', gu: 'btn.lang_gu' };

/** Segmented control, every segment at least 48px tall (gate 1 F3); writes the `lang` cookie, then refreshes. */
export function LanguageToggle({ variant = 'full', className }: LanguageToggleProps) {
  const lang = useLang();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function choose(next: Lang) {
    if (next === lang || pending) return;
    startTransition(async () => {
      await setLangAction(next);
      router.refresh();
    });
  }

  return (
    <div
      role="radiogroup"
      aria-label={t(lang, 'btn.language')}
      className={cn('inline-flex rounded-lg border border-slate-300 bg-white p-0.5', className)}
    >
      {LANGS.map((code) => {
        const selected = code === lang;
        return (
          <button
            key={code}
            type="button"
            role="radio"
            lang={code}
            aria-checked={selected}
            disabled={pending}
            onClick={() => choose(code)}
            className={cn(
              'flex min-h-[48px] min-w-[48px] items-center justify-center rounded-md px-3 text-base font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600',
              variant === 'full' && 'flex-1 px-4',
              selected ? 'bg-emerald-700 text-white' : 'text-slate-700 hover:bg-slate-100'
            )}
          >
            {variant === 'compact' ? SHORT[code] : t(code, WORD_KEY[code])}
          </button>
        );
      })}
    </div>
  );
}
