'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCurrentProfile, hasModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ALL_MODULES } from '@/lib/labels';
import { mapDbError } from '@/lib/db-errors';

/**
 * Every staff action returns this (contracts.md 6.2). A failure carries a label key, never a
 * sentence: the client shows t(lang, messageKey) so the words follow the user's language.
 */
export type ActionResult = { ok: true; id?: string } | { ok: false; messageKey: string; detail?: string };

const MODULE_KEYS = new Set<string>(ALL_MODULES.map((m) => m.key));

const UpdatePermissionsSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['owner', 'accountant', 'sales', 'operations']),
  // Known keys only, at most 13, each once (SEC1-08; fn_set_user_access applies the same rule).
  modules: z
    .array(z.string())
    .max(MODULE_KEYS.size)
    .refine((mods) => mods.every((m) => MODULE_KEYS.has(m)), 'Invalid module key supplied')
    .transform((mods) => Array.from(new Set(mods))),
});

const ToggleStatusSchema = z.object({
  userId: z.string().uuid(),
  isActive: z.boolean(),
});

// Same keys mapDbError produces for the database's own refusals (contracts.md 2.3 / 11 A4).
const BAD_PAYLOAD: ActionResult = { ok: false, messageKey: 'msg.err.bad_payload' };
const ACCESS_DENIED: ActionResult = { ok: false, messageKey: 'msg.access_denied_title' };
const SELF_CHANGE: ActionResult = { ok: false, messageKey: 'msg.err.self_change' };

/**
 * Role + modules of a staff member. The database function enforces the rules
 * (users module, same org, not yourself, owner grants owner, last owner stays).
 */
export async function updateUserPermissionsAction(input: unknown): Promise<ActionResult> {
  const parsed = UpdatePermissionsSchema.safeParse(input);
  if (!parsed.success) return BAD_PAYLOAD;

  const profile = await getCurrentProfile();
  if (!hasModule(profile, 'users')) return ACCESS_DENIED; // Wall 2
  if (profile!.id === parsed.data.userId) return SELF_CHANGE;

  const supabase = createClient();
  // Wall 1: SECURITY DEFINER function scoped to fn_current_org(); other orgs read as not_found.
  const { error } = await supabase.rpc('fn_set_user_access', {
    p_user: parsed.data.userId,
    p_role: parsed.data.role,
    p_modules: parsed.data.modules,
  });
  if (error) return mapDbError(error);

  revalidatePath('/users');
  return { ok: true };
}

/** Switch a staff member on or off. Same rules as above, enforced in the database. */
export async function toggleUserStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = ToggleStatusSchema.safeParse(input);
  if (!parsed.success) return BAD_PAYLOAD;

  const profile = await getCurrentProfile();
  if (!hasModule(profile, 'users')) return ACCESS_DENIED; // Wall 2
  if (profile!.id === parsed.data.userId) return SELF_CHANGE;

  const supabase = createClient();
  const { error } = await supabase.rpc('fn_set_user_active', {
    p_user: parsed.data.userId,
    p_active: parsed.data.isActive,
  });
  if (error) return mapDbError(error);

  revalidatePath('/users');
  return { ok: true };
}
