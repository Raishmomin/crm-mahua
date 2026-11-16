'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCurrentProfile, hasModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { mapDbError } from '@/lib/db-errors';

export type ActionResult = { ok: true } | { ok: false; messageKey: string; detail?: string };

const DoneSchema = z.object({ id: z.string().uuid() });

/** Home "Done" on a follow-up row: fn_follow_up_done (0004) checks org and module in the database. */
export async function followUpDoneAction(input: unknown): Promise<ActionResult> {
  const parsed = DoneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, messageKey: 'msg.err.bad_payload' };

  const profile = await getCurrentProfile();
  if (!hasModule(profile, 'dashboard')) return { ok: false, messageKey: 'msg.access_denied_title' }; // Wall 2

  const supabase = createClient();
  const { error } = await supabase.rpc('fn_follow_up_done', { p_id: parsed.data.id });
  if (error) return mapDbError(error); // Wall 1 errors become label keys

  revalidatePath('/');
  return { ok: true };
}
