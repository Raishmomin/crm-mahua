// QA gate 2 re-gate: pure-logic probes for the screen side of G2-01 and G2-04.
// Run from the repo root: npx tsx docs/qa/sprint-b/gate-2-regate-evidence/logic-check.ts [db]
// Reads the seeded price list and buyers (read-only), then calls the same helpers the forms use.
import { Client } from 'pg';
import { defaultCurrency, isExportBuyer as quoteIsExport, pricedCurrencies, type BuyerLite, type PriceRow } from '@/app/(dashboard)/quotes/helpers';
import { isExportBuyer as orderIsExport } from '@/app/(dashboard)/orders/helpers';
import { whereFromPhone } from '@/components/buyers/helpers';

const ORG = '11111111-1111-4111-8111-111111111111';
let pass = 0;
let fail = 0;
function check(label: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}\n      want ${JSON.stringify(want)}\n      got  ${JSON.stringify(got)}`);
}

async function main() {
  const db = process.argv[2] || 'onion_crm';
  const c = new Client({ connectionString: `postgresql://postgres:postgres@127.0.0.1:5432/${db}` });
  await c.connect();
  const prices: PriceRow[] = (
    await c.query(
      `SELECT product_id, currency, unit, rate, floor_price, is_active, effective_from::text AS effective_from
         FROM price_list_items WHERE org_id = $1`,
      [ORG]
    )
  ).rows;
  const products: { id: string; code: string }[] = (await c.query(`SELECT id, code FROM products WHERE org_id = $1 ORDER BY code`, [ORG])).rows;
  const buyers: (BuyerLite & { buyer_type: string })[] = (
    await c.query(
      `SELECT id, company_name, country, city, preferred_currency, incoterm, payment_terms, buyer_type
         FROM buyers WHERE org_id = $1 ORDER BY company_name`,
      [ORG]
    )
  ).rows;
  await c.end();

  console.log(`price rows: ${prices.length}; currencies in the list: ${Array.from(new Set(prices.map((p) => p.currency))).join(', ')}`);

  console.log('\n=== G2-01 (form): currency chips offer only priced currencies');
  for (const p of products) {
    check(`chips for ${p.code}`, pricedCurrencies(prices, [p.id]).includes('EUR'), false);
  }
  const rhine = buyers.find((b) => b.company_name.startsWith('Rhine'));
  const wmin = products.find((p) => p.code === 'W-MIN-A');
  if (rhine && wmin) {
    check('Rhine preferred_currency (seed)', rhine.preferred_currency, 'EUR');
    check('Rhine quote default currency with W-MIN-A (was EUR)', defaultCurrency(rhine, prices, wmin.id), 'USD');
    check('Rhine chips with W-MIN-A', pricedCurrencies(prices, [wmin.id]), ['INR', 'USD']);
  } else {
    check('seed has Rhine and W-MIN-A', false, true);
  }

  console.log('\n=== G2-04: export vs India agree in quotes and orders');
  for (const b of buyers) {
    check(`${b.company_name} (${b.buyer_type}, ${b.country}) quotes == orders`, quoteIsExport(b.country), orderIsExport(b));
  }
  // The old G2-04 row shape (quick-made buyer): export type, empty country.
  check('export_importer + country "" -> orders export', orderIsExport({ buyer_type: 'export_importer', country: '' }), true);
  check('export_importer + country "" -> quotes export', quoteIsExport(''), true);

  console.log('\n=== G2-04: Save as buyer prefills India / Export and the country from the phone');
  check('+971 50 123 4567', whereFromPhone('+971 50 123 4567'), { isExport: true, country: 'United Arab Emirates' });
  check('+91 98200 45678', whereFromPhone('+91 98200 45678'), { isExport: false, country: 'India' });
  check('+49 40 3298 1234', whereFromPhone('+49 40 3298 1234'), { isExport: true, country: 'Germany' });
  check('+92 300 1234567 (not in the map: Export, country asked)', whereFromPhone('+92 300 1234567'), { isExport: true, country: '' });

  console.log(`\n${pass} pass, ${fail} fail`);
  if (fail) process.exitCode = 1;
}

main().catch((e) => {
  console.error('SCRIPT ERROR', e);
  process.exitCode = 2;
});
