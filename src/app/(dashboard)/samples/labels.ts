import type { LabelDict } from '@/lib/i18n';

/** Module-local extra strings for Samples (contracts.md section 7). Global keys stay in src/lib/labels.ts. */
export const SAMPLE_LABELS: LabelDict = {
  en: {
    'samples.how_much': 'How much?',
    'samples.grams_other': 'Other',
    'samples.courier_by_hand': 'By hand',
    'samples.courier_other': 'Other',
    'samples.note': 'Note',
    'samples.pick_product': 'Pick a product.',
    'samples.pick_grams': 'Pick how much.',
    'samples.pick_buyer': 'Pick a buyer.',
    'samples.mark_sent_title': 'Sample sent?',
    'samples.result_title': 'What did they say?',
    'samples.approved_title': 'Sample passed?',
    'samples.rejected_title': 'Sample failed?',
    'samples.sent_fact': 'Sent {date} {courier}',
    'samples.send_from_inquiry': 'Send one from an inquiry or tap Send sample.',
  },
  gu: {
    'samples.how_much': 'કેટલું?',
    'samples.grams_other': 'બીજું',
    'samples.courier_by_hand': 'હાથોહાથ',
    'samples.courier_other': 'બીજું',
    'samples.note': 'નોંધ',
    'samples.pick_product': 'માલ પસંદ કરો.',
    'samples.pick_grams': 'કેટલું તે પસંદ કરો.',
    'samples.pick_buyer': 'ગ્રાહક પસંદ કરો.',
    'samples.mark_sent_title': 'સેમ્પલ મોકલ્યું?',
    'samples.result_title': 'તેમણે શું કહ્યું?',
    'samples.approved_title': 'સેમ્પલ પાસ?',
    'samples.rejected_title': 'સેમ્પલ નાપાસ?',
    'samples.sent_fact': '{date} {courier} થી મોકલ્યું',
    'samples.send_from_inquiry': 'પૂછપરછમાંથી મોકલો અથવા સેમ્પલ મોકલો દબાવો.',
  },
};

export const GRAM_CHOICES = [250, 500, 1000] as const;
export const COURIERS = ['DHL', 'DTDC', 'Blue Dart', 'Professional'] as const;
