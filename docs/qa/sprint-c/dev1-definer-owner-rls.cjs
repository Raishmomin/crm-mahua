// Dev-1 Sprint C evidence (A9): the 0005 definers that insert follow-ups still work when their
// owner does NOT bypass RLS, i.e. when the new follow_ups INSERT policy is really evaluated.
// Everything runs in ONE transaction that is rolled back (role, owner change, calls).
// Usage: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/mahua_dev1 node docs/qa/sprint-c/dev1-definer-owner-rls.cjs
const { Client } = require('pg');

const url = process.env.DATABASE_URL;
if (!url || !/\/mahua_dev1(\?|$)/.test(url)) {
  console.error('Refusing: run against the scratch database mahua_dev1 only.');
  process.exit(2);
}
const SALES = '22222222-2222-4222-8222-222222222223';
const OPS = '22222222-2222-4222-8222-222222222224';
const DRAFT_QUOTE = '88888888-8888-4888-8888-888888888804';
const TO_SEND_SAMPLE = '77777777-7777-4777-8777-777777777703';

async function step(c, label, fn) {
  await c.query('SAVEPOINT s');
  try {
    const out = await fn();
    await c.query('RELEASE SAVEPOINT s');
    console.log(`ok    ${label}${out ? ': ' + out : ''}`);
  } catch (e) {
    await c.query('ROLLBACK TO SAVEPOINT s');
    console.log(`REFUSED ${label}: ${e.code} ${e.message}`);
  }
}

(async () => {
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    await c.query('BEGIN');
    await c.query(`CREATE ROLE dev1_fn_owner NOLOGIN NOSUPERUSER NOBYPASSRLS`);
    await c.query(`GRANT USAGE ON SCHEMA public, auth TO dev1_fn_owner`);
    await c.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO dev1_fn_owner`);
    await c.query(`GRANT SELECT ON ALL TABLES IN SCHEMA auth TO dev1_fn_owner`);
    await c.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public, auth TO dev1_fn_owner`);
    await c.query(`ALTER FUNCTION fn_quote_send(uuid) OWNER TO dev1_fn_owner`);
    await c.query(`ALTER FUNCTION fn_sample_set_status(uuid, text, text) OWNER TO dev1_fn_owner`);
    const r = await c.query(`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'dev1_fn_owner'`);
    console.log('function owner dev1_fn_owner:', JSON.stringify(r.rows[0]));

    const as = async (uid) => {
      await c.query('SET LOCAL ROLE authenticated');
      await c.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [uid]);
    };
    const fu = async (like) => {
      await c.query('RESET ROLE');
      const x = await c.query(
        `SELECT note, done, done_by, created_by = $2 AS by_caller FROM follow_ups WHERE note LIKE $1 ORDER BY created_at DESC LIMIT 1`,
        [like, SALES],
      );
      return JSON.stringify(x.rows[0] ?? null);
    };

    await step(c, 'sales fn_quote_send(QTN-2627-0004) under RLS', async () => {
      await as(SALES);
      await c.query(`SELECT fn_quote_send($1)`, [DRAFT_QUOTE]);
      return fu('Quote QTN-2627-0004 expires tomorrow%');
    });
    await step(c, 'sales fn_sample_set_status(SMP-0003, sent) under RLS', async () => {
      await as(SALES);
      await c.query(`SELECT fn_sample_set_status($1, 'sent')`, [TO_SEND_SAMPLE]);
      return fu('Sample SMP-0003 sent, ask for result');
    });
  } finally {
    await c.query('ROLLBACK').catch(() => undefined);
    await c.end();
    console.log('rolled back');
  }
})().catch((e) => {
  console.error('failed:', e.code, e.message);
  process.exit(1);
});
