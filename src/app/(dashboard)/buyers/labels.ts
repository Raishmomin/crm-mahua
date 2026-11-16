import type { LabelDict } from '@/lib/i18n';

/**
 * Buyer-only words that docs/design/labels.md does not carry (contracts.md section 7).
 * Dev-3 merges them into src/lib/labels.ts after Sprint B. Keys are prefixed `buyers.`.
 */
export const BUYER_LABELS: LabelDict = {
  en: {
    'buyers.not_found': 'This buyer was not found.',
    'buyers.type_name': 'Type the company name.',
    'buyers.no_match': 'No buyer matches.',
    'buyers.more_contacts': '+ {n} more',
    'buyers.active': 'Buyer active',
    'buyers.on': 'On',
    'buyers.off': 'Off',
    'buyers.designation': 'Their job',
    'buyers.worst_order': '{code} · {days}',
    'buyers.no_money_due': 'Nothing due',
    'buyers.after_dispatch': 'after dispatch',
    'buyers.see_all': 'See all',
    'buyers.open_count': '{n} open',
    'buyers.orders': 'Orders',
    'buyers.quotes': 'Quotes',
    'buyers.inquiries': 'Inquiries',
    'buyers.country_hint': 'Country name as the buyer writes it',
  },
  gu: {
    'buyers.not_found': 'આ ગ્રાહક મળ્યો નહીં.',
    'buyers.type_name': 'કંપનીનું નામ લખો.',
    'buyers.no_match': 'કોઈ ગ્રાહક મળ્યો નહીં.',
    'buyers.more_contacts': '+ {n} વધુ',
    'buyers.active': 'ગ્રાહક ચાલુ',
    'buyers.on': 'ચાલુ',
    'buyers.off': 'બંધ',
    'buyers.designation': 'તેમનું કામ',
    'buyers.worst_order': '{code} · {days}',
    'buyers.no_money_due': 'કંઈ બાકી નથી',
    'buyers.after_dispatch': 'રવાના પછી',
    'buyers.see_all': 'બધા જુઓ',
    'buyers.open_count': '{n} ચાલુ',
    'buyers.orders': 'ઓર્ડર',
    'buyers.quotes': 'ભાવપત્ર',
    'buyers.inquiries': 'પૂછપરછ',
    'buyers.country_hint': 'દેશનું નામ ગ્રાહક લખે તેમ',
  },
};
