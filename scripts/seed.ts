import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

async function runSeed() {
  console.log('Connecting to Postgres via:', connectionString.replace(/:[^:@]+@/, ':****@'));
  const client = new Client({ connectionString });

  try {
    await client.connect();

    // 1. Run migrations if tables don't exist
    const mig0001 = fs.readFileSync(path.join(__dirname, '../supabase/migrations/0001_core_system.sql'), 'utf-8');
    const mig0002 = fs.readFileSync(path.join(__dirname, '../supabase/migrations/0002_catalog_and_buyers.sql'), 'utf-8');

    console.log('Applying Migration 0001: Core System & Multi-tenant RLS...');
    await client.query(mig0001);

    console.log('Applying Migration 0002: Catalog & Buyers Schema...');
    await client.query(mig0002);

    // 2. Run seed
    console.log('Applying Seed Data: Mahuva Dehydration Pvt Ltd demo organization...');
    const seedSql = fs.readFileSync(path.join(__dirname, '../supabase/seed.sql'), 'utf-8');
    await client.query(seedSql);

    console.log('✅ Seed completed successfully!');
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runSeed();
