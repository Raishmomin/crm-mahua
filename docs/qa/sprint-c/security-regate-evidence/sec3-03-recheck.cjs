// Security re-gate (Sprint C fix round): SEC3-03 buyers list shows money to Plant.
// 1) Static: buyers/page.tsx and buyers/queries.ts gate every money read/render on isPlant / withMoney.
// 2) SQL as impersonated users (SET LOCAL ROLE authenticated + jwt claims, rolled back): replay what
//    loadBuyerList reads for each role with the flag the page passes, and build the fact2 / pill each card shows.
// Usage: node docs/qa/sprint-c/security-regate-evidence/sec3-03-recheck.cjs [dbname]   (default onion_crm)
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const root = path.resolve(__dirname, '../../../..');
const db = process.argv[2] || 'onion_crm';
const url = `postgresql://postgres:postgres@127.0.0.1:5432/${db}`;
const USERS = {
  owner: ['22222222-2222-4222-8222-222222222221', 'owner'],
  accountant: ['22222222-2222-4222-8222-222222222222', 'accountant'],
  sales: ['22222222-2222-4222-8222-222222222223', 'sales'],
  plant: ['22222222-2222-4222-8222-222222222224', 'operations'],
};
let bad = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) bad++; };

// ---------- 1. static ----------
const page = fs.readFileSync(path.join(root, 'src/app/(dashboard)/buyers/page.tsx'), 'utf8');
const q = fs.readFileSync(path.join(root, 'src/app/(dashboard)/buyers/queries.ts'), 'utf8');
check(/const isPlant = profile\.role === 'operations'/.test(page), "page.tsx: isPlant = profile.role === 'operations'");
check(/loadBuyerList\(supabase, \{ withMoney: !isPlant \}\)/.test(page), 'page.tsx: loadBuyerList called with withMoney: !isPlant');
check(/if \(isPlant\) return a\.company_name\.localeCompare/.test(page), 'page.tsx: Plant sort is name only (no overdue-first sort)');
check(/const due = isPlant\s*\?\s*undefined/.test(page), 'page.tsx: fact2 (money amount) is undefined for Plant');
check(/badge=\{isPlant \? undefined :/.test(page), 'page.tsx: money Status pill is undefined for Plant');
check(/fact2ClassName=\{!isPlant &&/.test(page), 'page.tsx: overdue red class is off for Plant');
// every formatMoney / Status in the list page sits behind the isPlant guard
const fm = [...page.matchAll(/formatMoney\(|<Status /g)].map((m) => m.index);
const guardStart = page.indexOf('const due = isPlant');
const guardEnd = page.indexOf('trailing={<PhoneActions');
check(fm.length === 3 && fm.every((i) => i > guardStart && i < guardEnd), `page.tsx: all ${fm.length} money renders are inside the isPlant-guarded card block`);
check(/withMoney \? guardedList<MoneyDueRow>\('v_money_due'/.test(q) && /: Promise\.resolve\(\[\] as MoneyDueRow\[\]\)/.test(q), 'queries.ts: v_money_due is only queried when withMoney is true');
{
  // every line of the component that mentions money is the isPlant line, the withMoney call, the sort after
  // the Plant early return, or inside the guarded card block
  const lines = page.split('\n');
  const at = (needle) => lines.findIndex((l) => l.includes(needle));
  const sortStart = at('if (isPlant) return a.company_name.localeCompare'), sortEnd = sortStart + 5;
  const cardStart = at('const due = isPlant'), cardEnd = at('trailing={<PhoneActions');
  const body = at('export default async function BuyersPage');
  const stray = lines.map((l, i) => [i + 1, l.replace(/\/\/.*$/, '')]).filter(([n, l]) => n - 1 > body && /money/i.test(l)
    && !/const isPlant|withMoney: !isPlant/.test(l) && !(n - 1 > sortStart && n - 1 <= sortEnd) && !(n - 1 >= cardStart && n - 1 < cardEnd));
  check(stray.length === 0, `page.tsx: no money reference outside the guarded paths${stray.length ? ' -> ' + stray.map(([n]) => n).join(',') : ''}`);
}

// ---------- 2. SQL as each role ----------
const fmt = (n, cur) => `${cur === 'USD' ? '$' : '₹'}${Number(n).toLocaleString('en-IN')}`;
(async () => {
  const c = new Client({ connectionString: url });
  await c.connect();
  const out = {};
  for (const [who, [uid, role]] of Object.entries(USERS)) {
    await c.query('BEGIN');
    await c.query(`SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)`, [uid, JSON.stringify({ sub: uid, role: 'authenticated' })]);
    await c.query('SET LOCAL ROLE authenticated');
    const r = (await c.query('SELECT fn_user_role() r')).rows[0].r;
    const isPlant = r === 'operations';
    const buyers = (await c.query('SELECT id, company_name, preferred_currency FROM buyers ORDER BY company_name')).rows;
    const mdRaw = (await c.query('SELECT buyer_id, currency, total_due, money_status FROM v_money_due')).rows; // what RLS/A6 returns if read
    const md = isPlant ? [] : mdRaw; // page passes withMoney: !isPlant
    const worst = new Map();
    for (const m of md) { const cur = worst.get(m.buyer_id); if (!cur || (m.money_status === 'overdue' && cur.money_status !== 'overdue')) worst.set(m.buyer_id, m); }
    const cards = buyers.map((b) => {
      const m = worst.get(b.id);
      return { name: b.company_name, fact2: isPlant ? null : m ? fmt(m.total_due, m.currency) : fmt(0, b.preferred_currency === 'USD' ? 'USD' : 'INR'), pill: isPlant ? null : m ? m.money_status : 'paid' };
    });
    out[who] = { role: r, buyers: buyers.length, v_money_due_rows_if_read: mdRaw.length, v_money_due_read_by_page: !isPlant, cards };
    console.log(`${who} (${r}): buyers=${buyers.length}, v_money_due rows (raw)=${mdRaw.length}, page reads v_money_due=${!isPlant}`);
    for (const k of cards) console.log(`   ${k.name} | ${k.fact2 ?? '-'} | ${k.pill ?? '-'}`);
    await c.query('ROLLBACK');
    check(r === role, `${who}: fn_user_role() = ${role}`);
  }
  const plant = out.plant, owner = out.owner;
  check(plant.buyers > 0 && plant.buyers === owner.buyers, `plant still sees the buyer list (${plant.buyers} = owner ${owner.buyers})`);
  check(plant.v_money_due_rows_if_read === 0, 'A6 holds: v_money_due returns 0 rows to operations');
  check(plant.cards.every((k) => k.fact2 === null && k.pill === null), "plant cards: no amount, no pill (no '₹0 · Paid')");
  const late = owner.cards.find((k) => k.pill === 'overdue');
  check(Boolean(late) && /\$18,900/.test(late.fact2), `owner still sees the late buyer: ${late ? `${late.name} ${late.fact2} overdue` : 'none'}`);
  check(out.accountant.cards.some((k) => k.pill === 'overdue'), 'accountant still sees the overdue pill');
  console.log(bad === 0 ? 'SEC3-03 RECHECK OK' : `SEC3-03 RECHECK FAILED (${bad})`);
  await c.end();
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
