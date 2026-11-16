import type { LabelDict } from '@/lib/i18n';

/** Module-local extra strings for Products (contracts.md section 7). */
export const CATALOG_LABELS: LabelDict = {
  en: {
    'catalog.search': 'Search product',
    'catalog.empty': 'No products yet. Ask the owner to add products.',
    'catalog.grade': 'Grade: {grade}',
    'catalog.moisture': 'Moisture max {pct}%',
    'catalog.hsn_gst': 'HSN {hsn} · GST {gst}%',
    'catalog.cost_line': 'Cost {cost}/kg',
  },
  gu: {
    'catalog.search': 'માલ શોધો',
    'catalog.empty': 'હજુ કોઈ માલ નથી. માલિકને માલ ઉમેરવા કહો.',
    'catalog.grade': 'ગ્રેડ: {grade}',
    'catalog.moisture': 'ભેજ વધુમાં વધુ {pct}%',
    'catalog.hsn_gst': 'HSN {hsn} · GST {gst}%',
    'catalog.cost_line': 'ખર્ચ {cost}/કિલો',
  },
};
