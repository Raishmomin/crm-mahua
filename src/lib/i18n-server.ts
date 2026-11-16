import { cookies } from 'next/headers';
import { DEFAULT_LANG, LANG_COOKIE, toLang, type Lang } from './i18n';

/**
 * Current language for server components, from the `lang` cookie (default 'en').
 * Only import this from server code; client components receive `lang` as a prop
 * or via <LangProvider>.
 */
export function getLang(): Lang {
  try {
    return toLang(cookies().get(LANG_COOKIE)?.value);
  } catch {
    return DEFAULT_LANG;
  }
}
