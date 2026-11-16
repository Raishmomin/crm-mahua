// Applies every supabase/migrations/*.sql, then every supabase/seed/*.sql, in filename order.
// Safe to run any number of times (migrations and seeds are idempotent). The first seed file,
// 00_demo_reset.sql, removes what a demo added to the demo org MDPL, so every run gives day one.
// Exits non-zero on the first failing file and names it.
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { DATABASE_URL, maskDbUrl } from './db-url';

const ROOT = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
const SEED_DIR = path.join(ROOT, 'supabase', 'seed');

function sqlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, 'en'))
    .map((f) => path.join(dir, f));
}

async function applyFile(client: Client, file: string): Promise<void> {
  const label = path.relative(ROOT, file);
  const started = Date.now();
  const sql = fs.readFileSync(file, 'utf-8');
  try {
    await client.query(sql);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`FAILED ${label}: ${message}`);
    throw new Error(`${label}: ${message}`);
  }
  console.log(`ok   ${label} (${Date.now() - started} ms)`);
}

async function main(): Promise<void> {
  console.log(`Database: ${maskDbUrl(DATABASE_URL)}`);
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const migrations = sqlFiles(MIGRATIONS_DIR);
    const seeds = sqlFiles(SEED_DIR);
    if (migrations.length === 0) throw new Error('no migration files found in supabase/migrations');

    console.log(`Applying ${migrations.length} migration(s)...`);
    for (const file of migrations) await applyFile(client, file);

    console.log(`Applying ${seeds.length} seed file(s)...`);
    for (const file of seeds) await applyFile(client, file);

    console.log('Seed completed.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
