'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCurrentProfile, hasModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ALL_MODULES, ModuleKey, UserRole } from '@/lib/labels';

const UpdatePermissionsSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['owner', 'accountant', 'sales', 'operations']),
  modules: z.array(z.string()).refine((mods) => {
    const valid = new Set(ALL_MODULES.map((m) => m.key));
    return mods.every((m) => valid.has(m as ModuleKey));
  }, 'Invalid module key supplied'),
});

const ToggleStatusSchema = z.object({
  userId: z.string().uuid(),
  isActive: z.boolean(),
});

export async function updateUserPermissionsAction(input: {
  userId: string;
  role: UserRole;
  modules: string[];
}) {
  const parsed = UpdatePermissionsSchema.parse(input);
  const profile = await getCurrentProfile();

  // Wall 2: Server enforcement
  if (!hasModule(profile, 'users')) {
    throw new Error('Unauthorized: missing users module permission');
  }

  const supabase = createClient();

  const { error } = await supabase
    .from('profiles')
    .update({
      role: parsed.role,
      modules: parsed.modules,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.userId)
    .eq('org_id', profile!.org_id); // Double tenant lock

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  revalidatePath('/users');
  return { success: true };
}

export async function toggleUserStatusAction(input: { userId: string; isActive: boolean }) {
  const parsed = ToggleStatusSchema.parse(input);
  const profile = await getCurrentProfile();

  if (!hasModule(profile, 'users')) {
    throw new Error('Unauthorized: missing users module permission');
  }

  // Prevent self-deactivation
  if (profile!.id === parsed.userId && !parsed.isActive) {
    throw new Error('Cannot deactivate your own user account.');
  }

  const supabase = createClient();

  const { error } = await supabase
    .from('profiles')
    .update({
      is_active: parsed.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.userId)
    .eq('org_id', profile!.org_id);

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  revalidatePath('/users');
  return { success: true };
}
