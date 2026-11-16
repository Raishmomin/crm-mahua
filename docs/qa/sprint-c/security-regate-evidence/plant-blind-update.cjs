// Re-gate side probe (rolled back): can Plant blind-UPDATE the 'payment' reminder it can no longer SELECT?
// No-WHERE UPDATE needs no SELECT rights, so only follow_ups_update USING applies (SEC3-01 territory).
const { Client } = require('pg');
const db = process.argv[2] || 'onion_crm';
const PLANT = '22222222-2222-4222-8222-222222222224';
const ROW = 'cccccccc-cccc-4ccc-8ccc-cccccccccc01';
(async () => {
  const c = new Client({ connectionString: `postgresql://postgres:postgres@127.0.0.1:5432/${db}` });
  await c.connect();
  await c.query('BEGIN');
  const before = (await c.query('SELECT due_on, note FROM follow_ups WHERE id = $1', [ROW])).rows[0];
  await c.query(`SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)`, [PLANT, JSON.stringify({ sub: PLANT, role: 'authenticated' })]);
  await c.query('SET LOCAL ROLE authenticated');
  let res;
  try { res = await c.query(`UPDATE follow_ups SET due_on = DATE '2099-01-01' WHERE id = '${ROW}'`); console.log(`plant UPDATE with WHERE id: ${res.rowCount} rows`); }
  catch (e) { console.log(`plant UPDATE with WHERE id: ${e.code} ${e.message}`); }
  await c.query('SAVEPOINT s');
  try { res = await c.query(`UPDATE follow_ups SET due_on = DATE '2099-01-01'`); console.log(`plant UPDATE without WHERE: ${res.rowCount} rows`); }
  catch (e) { console.log(`plant UPDATE without WHERE: ${e.code} ${e.message}`); await c.query('ROLLBACK TO SAVEPOINT s'); }
  await c.query('RESET ROLE');
  const after = (await c.query('SELECT due_on, note FROM follow_ups WHERE id = $1', [ROW])).rows[0];
  console.log(`balance reminder due_on before=${before.due_on.toISOString().slice(0, 10)} after=${after.due_on.toISOString().slice(0, 10)} (rolled back)`);
  await c.query('ROLLBACK');
  await c.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
