/**
 * Label lookup shared by server and client code. Pure: no next/headers here.
 * Server helpers live in src/lib/i18n-server.ts (getLang) and
 * src/lib/i18n-actions.ts (setLangAction).
 */
import { LABELS } from './labels';

export type Lang = 'en' | 'gu';
export type LabelDict = { en: Record<string, string>; gu: Partial<Record<string, string>> };

export const LANGS: Lang[] = ['en', 'gu'];
export const LANG_COOKIE = 'lang';
export const DEFAULT_LANG: Lang = 'en';

export function isLang(value: unknown): value is Lang {
  return value === 'en' || value === 'gu';
}

/** Coerce any cookie/query value to a Lang (default 'en'). */
export function toLang(value: unknown): Lang {
  return isLang(value) ? value : DEFAULT_LANG;
}

function fill(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
  );
}

/**
 * Lookup order: local[lang] -> local.en -> LABELS[lang] -> LABELS.en -> key.
 * Placeholders `{name}` are replaced from vars as-is (never translated).
 */
export function t(
  lang: Lang,
  key: string,
  vars?: Record<string, string | number>,
  local?: LabelDict
): string {
  const text =
    local?.[lang]?.[key] ??
    local?.en?.[key] ??
    LABELS[lang]?.[key] ??
    LABELS.en[key] ??
    key;
  return fill(text, vars);
}

/** True when the key exists in the global or local dictionary (any language). */
export function hasLabel(key: string, local?: LabelDict): boolean {
  return (
    key in LABELS.en ||
    key in LABELS.gu ||
    (local ? key in local.en || key in local.gu : false)
  );
}

export function statusWord(lang: Lang, domain: string, code: string | boolean | null | undefined): string {
  if (code === null || code === undefined) return '';
  return t(lang, `status.${domain}.${String(code)}`);
}

export function roleWord(lang: Lang, role: string): string {
  return t(lang, `role.${role}`);
}

/** Menu word for a module key (dashboard -> Home, leads -> Inquiries ...). */
export function navWord(lang: Lang, moduleKey: string): string {
  const navKey = NAV_KEY_BY_MODULE[moduleKey] ?? `nav.${moduleKey}`;
  return t(lang, navKey);
}

export const NAV_KEY_BY_MODULE: Record<string, string> = {
  dashboard: 'nav.home',
  leads: 'nav.inquiries',
  buyers: 'nav.buyers',
  samples: 'nav.samples',
  quotes: 'nav.quotes',
  orders: 'nav.orders',
  payments: 'nav.money',
  catalog: 'nav.products',
  users: 'nav.staff',
  settings: 'nav.company',
  documents: 'nav.papers',
  reports: 'nav.reports',
  audit: 'nav.history',
};
