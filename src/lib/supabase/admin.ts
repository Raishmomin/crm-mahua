import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role client. It BYPASSES Row Level Security.
 *
 * Never import this from app routes (src/app/**), server actions or client components.
 * It is only for trusted scripts and background jobs. The `server-only` import above
 * makes any client-component import fail at build time; keeping it out of app routes
 * is a review rule.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase Service Role Key or URL for admin client.');
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
