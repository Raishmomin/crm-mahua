// Single place that decides which Postgres the scripts and tests talk to.
// Used by scripts/seed.ts, scripts/seed-users.ts, scripts/ci-tenant-check.ts and tests/helpers/db.ts.
// Loads .env.local first, then .env; a DATABASE_URL already in the environment wins.
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/onion_crm';

export const DATABASE_URL: string = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;

/** Hide the password so the URL is safe to print in logs. */
export function maskDbUrl(url: string = DATABASE_URL): string {
  return url.replace(/:\/\/([^:/@]+):[^@]*@/, '://$1:****@');
}
