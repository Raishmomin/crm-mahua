// QA gate 3: pure-logic checks of Sprint C helpers (G2-10 prefill, G2-06 WhatsApp date, quotes/orders
// export parity, SEC1-07 settings caps). Run from the repo root: npx tsx docs/qa/sprint-c/gate-3-evidence/logic-gate3.cjs
const ROOT = '/home/raish/raish/mahua-crm';
const orders = require(ROOT + '/src/app/(dashboard)/orders/helpers.ts');
const quotes = require(ROOT + '/src/app/(dashboard)/quotes/helpers.ts');
const limits = require(ROOT + '/src/app/(dashboard)/settings/limits.ts');
let pass = 0, fail = 0;
function check(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}\n      got  ${JSON.stringify(got)}${ok ? '' : `\n      want ${JSON.stringify(want)}`}`);
}

// G2-10: while the advance waits, prefill only the rest of the advance (ORD-0004 in the demo: total 28560, advance 8568)
check('G2-10 ORD-0004 new order, advance waiting -> 8568 + hint', orders.prefillAmount({ due: 28560, advance_expected: 8568, received: 0, advance_ok: false }), { amount: 8568, advance: true });
check('G2-10 part of the advance paid (3000) -> rest 5568 + hint', orders.prefillAmount({ due: 25560, advance_expected: 8568, received: 3000, advance_ok: false }), { amount: 5568, advance: true });
check('G2-10 advance OK -> full due 19992', orders.prefillAmount({ due: 19992, advance_expected: 8568, received: 8568, advance_ok: true }), { amount: 19992, advance: false });
check('G2-10 no advance (credit) -> full due', orders.prefillAmount({ due: 511875, advance_expected: 0, received: 0, advance_ok: true }), { amount: 511875, advance: false });
check('G2-10 100% advance -> full due (no hint)', orders.prefillAmount({ due: 50000, advance_expected: 50000, received: 0, advance_ok: false }), { amount: 50000, advance: false });

// G2-06: the dispatched WhatsApp text carries the dispatch date, en and gu
const d = { buyer: 'Al-Barakah', orderCode: 'ORD-0002', invoiceNo: 'INV-2627-0002', dispatchedOn: '2026-11-10', mode: 'container', containerNo: 'MSKU 482913-7', vessel: 'MSC Positano 2646W', eta: '2026-11-24', qtyKg: 9000, bags: 360, company: 'Mahuva Dehydration' };
for (const lang of ['en', 'gu']) {
  const s = orders.dispatchedText(lang, d);
  console.log(`  ${lang}: ${s}`);
  check(`G2-06 ${lang} text has '10 Nov 2026', no '{', no 'today'`, [s.includes('10 Nov 2026'), s.includes('{'), /today|આજે/i.test(s)], [true, false, false]);
}

// Quotes and orders decide export the same way (buyer_type first, then country)
const cases = [
  { buyer_type: 'export_importer', country: '' }, { buyer_type: 'export_importer', country: 'India' }, { buyer_type: 'domestic_masala', country: 'India' },
  { buyer_type: 'domestic_masala', country: 'Germany' }, { buyer_type: null, country: 'India' }, { buyer_type: null, country: 'UAE' }, { buyer_type: null, country: '' },
];
check('quotes vs orders isExportBuyer agree on 7 shapes', cases.map((c) => quotes.isExportBuyer(c) === orders.isExportBuyer(c)), cases.map(() => true));
console.log('  values: ' + JSON.stringify(cases.map((c) => [c.buyer_type, c.country, orders.isExportBuyer(c)])));

// SEC1-07 caps exist and are used by the form
check('SEC1-07 SETTINGS_MAX / MAX_BANK_ACCOUNTS', [limits.SETTINGS_MAX, limits.MAX_BANK_ACCOUNTS], [{ name: 120, address: 500, short: 32 }, 4]);
console.log(`\n${pass} pass, ${fail} fail`);
process.exitCode = fail ? 1 : 0;
