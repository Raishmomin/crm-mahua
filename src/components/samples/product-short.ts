import { t, type Lang } from '@/lib/i18n';

export interface ProductNameParts {
  name: string;
  color?: string | null;
  form?: string | null;
  mesh?: string | null;
}

/** "White flakes · 8-15 mm" from the catalog columns; falls back to the full name. */
export function shortProductName(p: ProductNameParts | null | undefined, lang: Lang = 'en'): string {
  if (!p) return '';
  if (!p.color || !p.form) return p.name;
  const color = t(lang, `product.color.${p.color}`);
  const form = t(lang, `product.form.${p.form}`);
  const base = lang === 'gu' ? `${color} ${form}` : `${color} ${form.toLowerCase()}`;
  return p.mesh ? `${base} ${p.mesh}` : base;
}

/** "moisture <= 5.5%, 8-15 mm" printed under the product name on a quote. */
export function defaultSpecText(p: { moisture_max_pct?: number | string | null; mesh?: string | null } | null | undefined): string {
  if (!p) return '';
  const parts: string[] = [];
  const moisture = Number(p.moisture_max_pct ?? 0);
  if (moisture > 0) parts.push(`moisture <= ${moisture}%`);
  if (p.mesh) parts.push(p.mesh);
  return parts.join(', ');
}
