'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCurrentProfile, hasModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { mapDbError } from '@/lib/db-errors';
import { normalisePhone } from '@/lib/phone';
import { BUYER_INCOTERMS, BUYER_TYPES, canWriteBuyers } from '@/types/buyers';

/** contracts.md 6.2: a failure carries a label key, never a sentence. */
export type ActionResult = { ok: true; id?: string } | { ok: false; messageKey: string; detail?: string };

const BAD_PAYLOAD: ActionResult = { ok: false, messageKey: 'msg.err.bad_payload' };
const ACCESS_DENIED: ActionResult = { ok: false, messageKey: 'msg.access_denied_title' };
const NOT_FOUND: ActionResult = { ok: false, messageKey: 'msg.err.not_found' };

const uuid = z.string().uuid();
const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const GSTIN_SHAPE = /^[0-9A-Z]{15}$/;

const BuyerFields = z.object({
  company_name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(5).max(40),
  contact_name: optionalText(120),
  designation: optionalText(120),
  email: optionalText(200),
  city: optionalText(120),
  is_export: z.boolean(),
  country: optionalText(120),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  pan: optionalText(20),
  buyer_type: z.enum(BUYER_TYPES as [string, ...string[]]).optional().nullable(),
  address: optionalText(500),
  state: optionalText(120),
  payment_terms: optionalText(200),
  credit_period_days: z.number().int().min(0).max(365).optional().nullable(),
  incoterm: z.enum(BUYER_INCOTERMS as [string, ...string[]]).optional().nullable(),
  preferred_currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/)
    .optional()
    .nullable(),
});

const CreateBuyerSchema = BuyerFields.extend({
  /** /buyers/new?from_inquiry=<id>: link the inquiry to the new buyer (contracts 6.1) */
  from_inquiry: uuid.nullable().optional(),
});

const UpdateBuyerSchema = BuyerFields.extend({
  id: uuid,
  status: z.enum(['active', 'inactive']).optional(),
});

/** India / Export toggle defaults (screens.md 8). Explicit More-fields win over the defaults. */
function buyerRow(d: z.infer<typeof BuyerFields>) {
  const exportDefaults = {
    buyer_type: 'export_importer',
    country: d.country || '',
    preferred_currency: 'USD',
    incoterm: 'FOB',
    credit_period_days: 0,
    payment_terms: '30% advance, 70% against BL copy',
  };
  const indiaDefaults = {
    buyer_type: 'domestic_masala',
    country: 'India',
    preferred_currency: 'INR',
    incoterm: 'EXW',
    credit_period_days: 30,
    payment_terms: '30 days credit',
  };
  const base = d.is_export ? exportDefaults : indiaDefaults;
  return {
    company_name: d.company_name,
    buyer_type: d.buyer_type ?? base.buyer_type,
    country: base.country,
    gstin: d.is_export ? null : d.gstin,
    pan: d.pan,
    incoterm: d.incoterm ?? base.incoterm,
    preferred_currency: d.preferred_currency ?? base.preferred_currency,
    payment_terms: d.payment_terms ?? base.payment_terms,
    credit_period_days: d.credit_period_days ?? base.credit_period_days,
    address: d.address,
    city: d.city,
    state: d.state,
  };
}

function validateShapes(d: z.infer<typeof BuyerFields>): ActionResult | null {
  if (!normalisePhone(d.phone)) return { ok: false, messageKey: 'msg.error.phone' };
  if (!d.is_export && d.gstin && !GSTIN_SHAPE.test(d.gstin)) return { ok: false, messageKey: 'msg.error.gstin' };
  if (d.is_export && !d.country) return { ok: false, messageKey: 'msg.error.required' };
  return null;
}

/** New buyer (screen 8): buyer row (BUY-xxxx from trg_buyers_code) + primary contact. */
export async function createBuyerAction(input: unknown): Promise<ActionResult> {
  const parsed = CreateBuyerSchema.safeParse(input);
  if (!parsed.success) return BAD_PAYLOAD;
  const d = parsed.data;
  const invalid = validateShapes(d);
  if (invalid) return invalid;

  const profile = await getCurrentProfile();
  if (!hasModule(profile, 'buyers')) return ACCESS_DENIED; // Wall 2
  if (!canWriteBuyers(profile!.role)) return ACCESS_DENIED; // Plant is read only on buyers (flows.md 11)
  const orgId = profile!.org_id;
  const supabase = createClient();

  const { data: buyer, error } = await supabase
    .from('buyers')
    .insert({ org_id: orgId, ...buyerRow(d), status: 'active' }) // org lock; code from the trigger
    .select('id')
    .single();
  if (error) return mapDbError(error);
  const buyerId = buyer.id as string;

  const { error: contactError } = await supabase.from('buyer_contacts').insert({
    org_id: orgId,
    buyer_id: buyerId,
    name: d.contact_name ?? d.company_name,
    designation: d.designation,
    phone: d.phone,
    email: d.email,
    is_primary: true,
  });
  if (contactError) return mapDbError(contactError);

  if (d.from_inquiry && hasModule(profile, 'leads')) {
    const { error: linkError } = await supabase
      .from('inquiries')
      .update({ buyer_id: buyerId, updated_at: new Date().toISOString() })
      .eq('id', d.from_inquiry)
      .eq('org_id', orgId);
    if (linkError) return mapDbError(linkError);
    revalidatePath(`/inquiries/${d.from_inquiry}`);
  }

  revalidatePath('/buyers');
  return { ok: true, id: buyerId };
}

/** Edit buyer: buyer columns + the primary contact (made when missing). */
export async function updateBuyerAction(input: unknown): Promise<ActionResult> {
  const parsed = UpdateBuyerSchema.safeParse(input);
  if (!parsed.success) return BAD_PAYLOAD;
  const d = parsed.data;
  const invalid = validateShapes(d);
  if (invalid) return invalid;

  const profile = await getCurrentProfile();
  if (!hasModule(profile, 'buyers')) return ACCESS_DENIED;
  if (!canWriteBuyers(profile!.role)) return ACCESS_DENIED; // Plant is read only on buyers (flows.md 11)
  const orgId = profile!.org_id;
  const supabase = createClient();

  const { data: updated, error } = await supabase
    .from('buyers')
    .update({ ...buyerRow(d), ...(d.status ? { status: d.status } : {}), updated_at: new Date().toISOString() })
    .eq('id', d.id)
    .eq('org_id', orgId)
    .select('id');
  if (error) return mapDbError(error);
  if (!updated || updated.length === 0) return NOT_FOUND;

  const { data: primary, error: readError } = await supabase
    .from('buyer_contacts')
    .select('id')
    .eq('buyer_id', d.id)
    .eq('org_id', orgId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (readError) return mapDbError(readError);

  const contact = {
    name: d.contact_name ?? d.company_name,
    designation: d.designation,
    phone: d.phone,
    email: d.email,
    is_primary: true,
  };
  const { error: contactError } = primary
    ? await supabase.from('buyer_contacts').update({ ...contact, updated_at: new Date().toISOString() }).eq('id', primary.id).eq('org_id', orgId)
    : await supabase.from('buyer_contacts').insert({ org_id: orgId, buyer_id: d.id, ...contact });
  if (contactError) return mapDbError(contactError);

  revalidatePath('/buyers');
  revalidatePath(`/buyers/${d.id}`);
  return { ok: true, id: d.id };
}
