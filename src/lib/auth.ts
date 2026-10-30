import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import { ModuleKey } from './labels';
import { Profile } from '@/types/database';

export async function getCurrentUser() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return null;
  }
  return user;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Profile;
}

export async function requireAuth(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/login');
  }

  if (!profile.is_active) {
    redirect('/account-inactive');
  }

  return profile;
}

export function hasModule(profile: Profile | null, moduleKey: ModuleKey): boolean {
  if (!profile || !profile.is_active) return false;
  return Array.isArray(profile.modules) && profile.modules.includes(moduleKey);
}

export async function requireModule(moduleKey: ModuleKey): Promise<Profile> {
  const profile = await requireAuth();

  if (!hasModule(profile, moduleKey)) {
    redirect('/access-denied');
  }

  return profile;
}
