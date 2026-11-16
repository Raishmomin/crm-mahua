'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { isLang, LANG_COOKIE } from './i18n';

/** Writes the `lang` cookie (1 year, Lax) and revalidates every page. */
export async function setLangAction(lang: unknown): Promise<{ ok: boolean }> {
  if (!isLang(lang)) return { ok: false };
  cookies().set(LANG_COOKIE, lang, {
    path: '/',
    maxAge: 31536000,
    sameSite: 'lax',
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}
