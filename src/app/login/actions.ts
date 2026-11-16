'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { USER_ROLES, type UserRole } from '@/lib/labels';

/** contracts.md 6.2 result shape. */
export type ActionResult = { ok: true } | { ok: false; messageKey: string };

/** Demo logins (screens.md 1). Server-only: neither the emails nor the password reach the browser. */
const DEMO_EMAILS: Record<UserRole, string> = {
  owner: 'admin@mahuvacrm.com',
  accountant: 'accountant@mahuvacrm.com',
  sales: 'sales@mahuvacrm.com',
  operations: 'ops@mahuvacrm.com',
};

const TryAsSchema = z.object({ role: z.enum(USER_ROLES as [UserRole, ...UserRole[]]) });

/**
 * One-tap demo sign-in (A11, SEC1-06). Runs on the server with the server Supabase client, so the
 * session cookies are written server-side and the password stays in the server env.
 */
export async function tryAsAction(input: unknown): Promise<ActionResult> {
  // Same gate as login/page.tsx: server env DEMO_MODE=true and a DEMO_PASSWORD (contracts A11).
  const password = process.env.DEMO_PASSWORD;
  if (process.env.DEMO_MODE !== 'true' || !password) return { ok: false, messageKey: 'msg.access_denied_title' };
  const parsed = TryAsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, messageKey: 'msg.err.bad_payload' };

  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: DEMO_EMAILS[parsed.data.role],
      password,
    });
    if (error) {
      const offline = error.name === 'AuthRetryableFetchError' || error.status === 0 || /fetch/i.test(error.message ?? '');
      if (!offline) console.error('[login] try-as failed:', error.status, error.name);
      return { ok: false, messageKey: offline ? 'msg.error.offline' : 'msg.login_error' };
    }
    return { ok: true };
  } catch {
    return { ok: false, messageKey: 'msg.error.offline' };
  }
}
