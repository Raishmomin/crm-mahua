'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCurrentProfile, hasModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const UpdateBusinessSettingsSchema = z.object({
  company_name: z.string().min(2, 'Company name is required'),
  trade_name: z.string().optional().nullable(),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format').optional().or(z.literal('')),
  iec_code: z.string().optional().nullable(),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format').optional().or(z.literal('')),
  fssai_no: z.string().optional().nullable(),
  address: z.string().min(3, 'Address is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  pincode: z.string().min(6, 'Valid PIN code is required'),
  country: z.string().default('India'),
  contact_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  contact_phone: z.string().optional().nullable(),
  authorized_signatory: z.string().optional().nullable(),
  bank_details: z.array(
    z.object({
      bank_name: z.string().min(1, 'Bank name is required'),
      account_no: z.string().min(4, 'Account number is required'),
      ifsc: z.string().min(4, 'IFSC is required'),
      branch: z.string().optional(),
      swift: z.string().optional(),
      currency: z.string().default('INR'),
      is_primary: z.boolean().default(false),
    })
  ).default([]),
});

export async function updateBusinessSettingsAction(formData: z.infer<typeof UpdateBusinessSettingsSchema>) {
  const parsed = UpdateBusinessSettingsSchema.parse(formData);
  const profile = await getCurrentProfile();

  // Wall 2: Server-side check
  if (!hasModule(profile, 'settings')) {
    throw new Error('Unauthorized: missing settings module permission');
  }

  const supabase = createClient();

  const { error } = await supabase
    .from('business_settings')
    .upsert(
      {
        org_id: profile!.org_id,
        ...parsed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id' }
    );

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  revalidatePath('/settings');
  return { success: true };
}
