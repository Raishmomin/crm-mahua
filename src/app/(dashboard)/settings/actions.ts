'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCurrentProfile, hasModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { mapDbError } from '@/lib/db-errors';
import { MAX_BANK_ACCOUNTS, SETTINGS_MAX } from './limits';

export type ActionResult = { ok: true } | { ok: false; messageKey: string; detail?: string };

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;

// SEC1-07: every text has a length cap, bank_details at most 4 accounts (also bounds the audit snapshot).
const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => text(max).optional().nullable().transform((v) => v || null);

const BankSchema = z.object({
  bank_name: text(SETTINGS_MAX.name).min(1),
  account_no: text(SETTINGS_MAX.short).min(4),
  ifsc: text(SETTINGS_MAX.short).regex(IFSC),
  branch: text(SETTINGS_MAX.name).optional(),
  swift: text(SETTINGS_MAX.short).optional(),
  currency: text(3).default('INR'),
  is_primary: z.boolean().default(false),
});

const UpdateBusinessSettingsSchema = z.object({
  company_name: text(SETTINGS_MAX.name).min(2),
  trade_name: optionalText(SETTINGS_MAX.name),
  gstin: text(SETTINGS_MAX.short).regex(GSTIN).optional().or(z.literal('')),
  iec_code: optionalText(SETTINGS_MAX.short),
  pan: optionalText(SETTINGS_MAX.short),
  fssai_no: optionalText(SETTINGS_MAX.short),
  address: text(SETTINGS_MAX.address).min(3),
  city: text(SETTINGS_MAX.name).min(2),
  state: text(SETTINGS_MAX.name).min(2),
  pincode: text(SETTINGS_MAX.short).min(6),
  country: text(SETTINGS_MAX.name).default('India'),
  contact_email: text(SETTINGS_MAX.name).email().optional().or(z.literal('')),
  contact_phone: optionalText(SETTINGS_MAX.short),
  authorized_signatory: optionalText(SETTINGS_MAX.name),
  bank_details: z.array(BankSchema).max(MAX_BANK_ACCOUNTS).default([]),
});

export type BusinessSettingsInput = z.input<typeof UpdateBusinessSettingsSchema>;

function keyForIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  const path = issue?.path.join('.') ?? '';
  if (issue?.code === 'too_big') return 'msg.error.too_long';
  if (path === 'gstin') return 'msg.error.gstin';
  if (path.endsWith('ifsc')) return 'msg.error.ifsc';
  if (path) return 'msg.error.required';
  return 'msg.err.bad_payload';
}

/** My Company save. Never throws; the form shows t(lang, messageKey). */
export async function updateBusinessSettingsAction(input: unknown): Promise<ActionResult> {
  const parsed = UpdateBusinessSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, messageKey: keyForIssue(parsed.error) };

  const profile = await getCurrentProfile();
  if (!hasModule(profile, 'settings')) return { ok: false, messageKey: 'msg.access_denied_title' }; // Wall 2

  const supabase = createClient();
  const { error } = await supabase.from('business_settings').upsert(
    {
      ...parsed.data,
      gstin: parsed.data.gstin || null,
      contact_email: parsed.data.contact_email || null,
      org_id: profile!.org_id, // org lock: always the caller's org
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'org_id' }
  );
  if (error) return mapDbError(error);

  revalidatePath('/settings');
  revalidatePath('/', 'layout'); // company name in the shell
  return { ok: true };
}
