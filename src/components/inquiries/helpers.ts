import { t, type Lang } from '@/lib/i18n';
import { normalisePhone } from '@/lib/phone';
import { formatQty } from '@/lib/utils';
import type { InquirySource, InquiryStatus } from '@/types/inquiries';

export interface ProductLite {
  id: string;
  name: string;
  form: string;
  color: string;
}

export interface BuyerLite {
  id: string;
  company_name: string;
  city: string | null;
  country: string;
  buyer_type: string;
  /** primary contact phone (joined in the page) */
  phone: string | null;
  contact_name?: string | null;
}

/** "White Flakes" from products.color + form (screens.md 5); falls back to the given text. */
export function productShortName(lang: Lang, product: Pick<ProductLite, 'form' | 'color'> | null | undefined, fallback?: string | null): string {
  if (product) return `${t(lang, `product.color.${product.color}`)} ${t(lang, `product.form.${product.form}`)}`;
  return fallback ?? '';
}

/** Status order for the list: New first, then the rest of the flow (screens.md 3). */
export const STATUS_ORDER: InquiryStatus[] = ['new', 'talking', 'sample_sent', 'quoted', 'won', 'lost'];

export const SOURCE_KEYS: Record<InquirySource, string> = {
  whatsapp: 'source.whatsapp',
  call: 'source.call',
  visit: 'source.visit',
  email: 'source.email',
  indiamart: 'source.indiamart',
};

/** Export buyers always get the English template (labels.md 13). */
export function templateLang(lang: Lang, country: string | null | undefined, phone: string | null | undefined): Lang {
  if (country) return country.trim().toLowerCase() === 'india' ? lang : 'en';
  const n = normalisePhone(phone);
  return !n || n.digits.startsWith('91') ? lang : 'en';
}

/** T1 wa.inquiry_reply: Namaste {buyer}, thank you for your inquiry for {product}, {qty} ... */
export function inquiryReplyMessage(
  lang: Lang,
  vars: { contact: string; product: string; qtyKg: number | null; sender: string; company: string }
): string {
  return t(lang, 'wa.inquiry_reply', {
    buyer: vars.contact,
    product: vars.product,
    qty: vars.qtyKg ? formatQty(vars.qtyKg, lang) : '',
    sender: vars.sender,
    company: vars.company,
  });
}

/** Search by name, phone digits or code (components.md 7). */
export function matchesSearch(q: string, fields: Array<string | null | undefined>): boolean {
  const term = q.trim().toLowerCase();
  if (!term) return true;
  const digits = term.replace(/\D/g, '');
  return fields.some((f) => {
    if (!f) return false;
    const v = f.toLowerCase();
    if (v.includes(term)) return true;
    if (digits.length >= 3) {
      const vd = v.replace(/\D/g, '');
      return vd.includes(digits);
    }
    return false;
  });
}
