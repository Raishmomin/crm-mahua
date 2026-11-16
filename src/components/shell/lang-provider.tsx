'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { t, type LabelDict, type Lang } from '@/lib/i18n';

const LangContext = createContext<Lang>('en');

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

/** Current language in client components (defaults to 'en' without a provider). */
export function useLang(): Lang {
  return useContext(LangContext);
}

/** Bound translator: const tt = useT(); tt('btn.save'). */
export function useT(local?: LabelDict) {
  const lang = useLang();
  return useMemo(
    () => (key: string, vars?: Record<string, string | number>) => t(lang, key, vars, local),
    [lang, local]
  );
}
