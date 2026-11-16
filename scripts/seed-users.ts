// Creates the 4 demo logins in Supabase Auth (GoTrue) with the fixed profile UUIDs.
// Runs before scripts/seed.ts so the profiles insert can reference auth.users.
// Without Supabase keys it exits 0 and leaves the job to the SQL seed (local auth shim).
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Contracts A11 / SEC1-12: the password comes from the server env DEMO_PASSWORD (the same value
// the login page's server action uses for "Try as"); the fallback is for the local demo only.
// It is never printed.
const HAS_DEMO_PASSWORD = Boolean(process.env.DEMO_PASSWORD);
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'DemoPass123!';

// Same ids as supabase/seed/01_core.sql (profiles 2222...2221-2224).
const DEMO_USERS = [
  { id: '22222222-2222-4222-8222-222222222221', email: 'admin@mahuvacrm.com', full_name: 'Hareshbhai Mehta' },
  { id: '22222222-2222-4222-8222-222222222222', email: 'accountant@mahuvacrm.com', full_name: 'Nileshbhai Shah' },
  { id: '22222222-2222-4222-8222-222222222223', email: 'sales@mahuvacrm.com', full_name: 'Pooja Patel' },
  { id: '22222222-2222-4222-8222-222222222224', email: 'ops@mahuvacrm.com', full_name: 'Dineshbhai Vaghela' },
] as const;

function isPlaceholder(url: string | undefined, key: string | undefined): boolean {
  if (!url || !key) return true;
  if (/your-project|example\.com/i.test(url)) return true;
  if (/^your-|dummy|placeholder/i.test(key)) return true;
  return false;
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (isPlaceholder(url, serviceKey)) {
    console.log('Skipping auth users (no Supabase keys): local shim will insert them in SQL');
    return;
  }

  const supabase = createClient(url!, serviceKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // One request up front: tells us which demo users already exist and catches bad keys early.
  const { data: listed, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) {
    throw new Error(`Cannot reach Supabase Auth at ${url}: ${listError.message}`);
  }
  const byEmail = new Map(listed.users.map((u) => [u.email?.toLowerCase(), u]));

  for (const demo of DEMO_USERS) {
    const existing = byEmail.get(demo.email);
    if (existing) {
      if (existing.id !== demo.id) {
        throw new Error(
          `${demo.email} already exists in Supabase Auth with id ${existing.id}, expected ${demo.id}. ` +
            'Delete that user in the Supabase dashboard (Authentication > Users) and run npm run db:seed again.'
        );
      }
      // Keep the demo password in sync so "Try as" always works.
      const { error: updateError } = await supabase.auth.admin.updateUserById(demo.id, {
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: demo.full_name },
      });
      if (updateError) throw new Error(`${demo.email}: ${updateError.message}`);
      console.log(`ok   ${demo.email} (already registered, password refreshed)`);
      continue;
    }

    // AdminUserAttributes.id is supported by @supabase/auth-js >= 2.64 (checked in node_modules).
    const { data, error } = await supabase.auth.admin.createUser({
      id: demo.id,
      email: demo.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: demo.full_name },
    });

    if (error) {
      if (/already (been )?registered|already exists|email_exists/i.test(error.message)) {
        console.log(`ok   ${demo.email} (already registered)`);
        continue;
      }
      throw new Error(`${demo.email}: ${error.message}`);
    }

    if (data.user && data.user.id !== demo.id) {
      console.warn(
        `WARNING ${demo.email} was created with id ${data.user.id} instead of ${demo.id}; ` +
          'the installed Supabase client ignored the fixed id. The SQL seed expects the fixed id.'
      );
      continue;
    }
    console.log(`ok   ${demo.email} created`);
  }
  console.log(
    HAS_DEMO_PASSWORD
      ? 'Demo users ready. Password for all four: the DEMO_PASSWORD you set (not printed).'
      : 'Demo users ready. DEMO_PASSWORD is not set, so the local demo default was used (not printed). ' +
          'Set DEMO_PASSWORD in .env.local and run npm run db:seed again.'
  );
}

main().catch((err) => {
  console.error('Seed users failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
