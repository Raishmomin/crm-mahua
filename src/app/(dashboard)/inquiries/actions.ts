'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCurrentProfile, hasModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { mapDbError } from '@/lib/db-errors';
import { normalisePhone } from '@/lib/phone';
import type { ModuleKey } from '@/lib/labels';
import { INQUIRY_SOURCES, INQUIRY_STATUSES, LOST_REASONS, type FollowUpEntityType } from '@/types/inquiries';

/** contracts.md 6.2: a failure carries a label key, never a sentence. */
export type ActionResult = { ok: true; id?: string } | { ok: false; messageKey: string; detail?: string };

const BAD_PAYLOAD: ActionResult = { ok: false, messageKey: 'msg.err.bad_payload' };
const ACCESS_DENIED: ActionResult = { ok: false, messageKey: 'msg.access_denied_title' };
const NOT_FOUND: ActionResult = { ok: false, messageKey: 'msg.err.not_found' };

const uuid = z.string().uuid();
const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

const InquiryFields = z.object({
  buyer_id: uuid.nullable(),
  /** "+ New buyer": name + phone stay on the inquiry; the buyer row comes later via "Save as buyer" (screens.md 5) */
  new_buyer: z.object({ name: z.string().trim().min(1).max(200), phone: z.string().trim().min(5).max(40) }).nullable().optional(),
  buyer_name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(40).optional().nullable().transform((v) => (v ? v : null)),
  product_id: uuid.nullable(),
  product_text: optionalText,
  qty_kg: z.number().positive().max(999_999_999),
  needed_by: isoDate,
  source: z.enum(INQUIRY_SOURCES as [string, ...string[]]),
  notes: optionalText,
});

const CreateInquirySchema = InquiryFields;
const UpdateInquirySchema = InquiryFields.omit({ new_buyer: true }).extend({ id: uuid });

const SetStatusSchema = z.object({
  id: uuid,
  status: z.enum(INQUIRY_STATUSES as [string, ...string[]]),
  reason: z.enum(LOST_REASONS as [string, ...string[]]).nullable().optional(),
});

const ENTITY_TYPES: FollowUpEntityType[] = ['inquiry', 'buyer', 'quote', 'order', 'payment'];
const ENTITY_MODULE: Record<FollowUpEntityType, ModuleKey> = {
  inquiry: 'leads',
  buyer: 'buyers',
  quote: 'quotes',
  order: 'orders',
  payment: 'payments',
};

const AddFollowUpSchema = z.object({
  entity_type: z.enum(ENTITY_TYPES as [string, ...string[]]),
  entity_id: uuid,
  buyer_id: uuid.nullable().optional(),
  note: z.string().trim().min(1).max(2000),
  /** NULL = plain note (done = true); a date = reminder */
  due_on: isoDate,
});

const DoneSchema = z.object({ id: uuid, entity_type: z.enum(ENTITY_TYPES as [string, ...string[]]) });

function pathFor(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case 'inquiry':
      return `/inquiries/${entityId}`;
    case 'buyer':
      return `/buyers/${entityId}`;
    case 'quote':
      return `/quotes/${entityId}`;
    case 'order':
    case 'payment':
      return `/orders/${entityId}`;
    default:
      return null;
  }
}

/** New inquiry (screen 5). Code INQ-xxxx comes from the BEFORE INSERT trigger. */
export async function createInquiryAction(input: unknown): Promise<ActionResult> {
  const parsed = CreateInquirySchema.safeParse(input);
  if (!parsed.success) return BAD_PAYLOAD;
  const d = parsed.data;

  const profile = await getCurrentProfile();
  if (!hasModule(profile, 'leads')) return ACCESS_DENIED; // Wall 2
  const orgId = profile!.org_id;
  const supabase = createClient();

  const buyerId = d.buyer_id;
  let buyerName = d.buyer_name;
  let phone = d.phone;

  // "+ New buyer" (screens.md 5): the inquiry keeps name + phone and NO buyer row is made here.
  // "Save as buyer" on the detail opens /buyers/new?from_inquiry=, which asks India / Export and the
  // country, so the buyer gets a real country and a single atomic save (G2-04, SEC2-03).
  if (!buyerId && d.new_buyer) {
    buyerName = d.new_buyer.name;
    phone = d.new_buyer.phone;
    if (!normalisePhone(phone)) return { ok: false, messageKey: 'msg.error.phone' };
  }
  if (!buyerId && !buyerName) return BAD_PAYLOAD;

  const { data, error } = await supabase
    .from('inquiries')
    .insert({
      org_id: orgId, // org lock: never from the client
      buyer_id: buyerId,
      buyer_name: buyerName,
      phone,
      product_id: d.product_id,
      product_text: d.product_id ? null : d.product_text,
      qty_kg: d.qty_kg,
      needed_by: d.needed_by,
      source: d.source,
      notes: d.notes,
      assigned_to: profile!.id,
      created_by: profile!.id,
    })
    .select('id')
    .single();
  if (error) return mapDbError(error); // Wall 1 errors become label keys

  revalidatePath('/inquiries');
  revalidatePath('/');
  if (buyerId) revalidatePath(`/buyers/${buyerId}`);
  return { ok: true, id: data.id as string };
}

/** Edit the editable columns (status / lost_reason / closed_at stay locked in the database). */
export async function updateInquiryAction(input: unknown): Promise<ActionResult> {
  const parsed = UpdateInquirySchema.safeParse(input);
  if (!parsed.success) return BAD_PAYLOAD;
  const d = parsed.data;

  const profile = await getCurrentProfile();
  if (!hasModule(profile, 'leads')) return ACCESS_DENIED;

  const supabase = createClient();
  const { data, error } = await supabase
    .from('inquiries')
    .update({
      buyer_id: d.buyer_id,
      buyer_name: d.buyer_name,
      phone: d.phone,
      product_id: d.product_id,
      product_text: d.product_id ? null : d.product_text,
      qty_kg: d.qty_kg,
      needed_by: d.needed_by,
      source: d.source,
      notes: d.notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', d.id)
    .eq('org_id', profile!.org_id)
    .select('id');
  if (error) return mapDbError(error);
  if (!data || data.length === 0) return NOT_FOUND;

  revalidatePath('/inquiries');
  revalidatePath(`/inquiries/${d.id}`);
  return { ok: true, id: d.id };
}

/** Talking / Mark lost (+ reason) / Reopen: fn_inquiry_set_status enforces the machine and the roles. */
export async function setInquiryStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = SetStatusSchema.safeParse(input);
  if (!parsed.success) return BAD_PAYLOAD;

  const profile = await getCurrentProfile();
  if (!hasModule(profile, 'leads')) return ACCESS_DENIED;

  const supabase = createClient();
  const { error } = await supabase.rpc('fn_inquiry_set_status', {
    p_id: parsed.data.id,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason ?? null,
  });
  if (error) return mapDbError(error);

  revalidatePath('/inquiries');
  revalidatePath(`/inquiries/${parsed.data.id}`);
  revalidatePath('/');
  return { ok: true, id: parsed.data.id };
}

/**
 * Add note (due_on NULL, done = true) or reminder (due_on set). Used by the inquiry and buyer pages
 * (src/components/followups). The first note on a New inquiry moves it to Talking (contracts 3.2).
 */
export async function addFollowUpAction(input: unknown): Promise<ActionResult> {
  const parsed = AddFollowUpSchema.safeParse(input);
  if (!parsed.success) return BAD_PAYLOAD;
  const d = parsed.data;
  const entityType = d.entity_type as FollowUpEntityType;

  const profile = await getCurrentProfile();
  if (!hasModule(profile, ENTITY_MODULE[entityType])) return ACCESS_DENIED;

  const supabase = createClient();
  const isNote = !d.due_on;
  const { data, error } = await supabase
    .from('follow_ups')
    .insert({
      org_id: profile!.org_id,
      entity_type: entityType,
      entity_id: d.entity_id,
      buyer_id: d.buyer_id ?? null,
      note: d.note,
      due_on: d.due_on,
      done: isNote,
      done_at: isNote ? new Date().toISOString() : null,
      created_by: profile!.id,
    })
    .select('id')
    .single();
  if (error) return mapDbError(error);

  if (entityType === 'inquiry') {
    const { data: inquiry } = await supabase.from('inquiries').select('status').eq('id', d.entity_id).maybeSingle();
    if (inquiry?.status === 'new') {
      const { error: moveError } = await supabase.rpc('fn_inquiry_set_status', { p_id: d.entity_id, p_status: 'talking', p_reason: null });
      if (moveError) console.error('[inquiries] first note did not move the inquiry:', moveError.code, moveError.message);
    }
  }

  const path = pathFor(entityType, d.entity_id);
  if (path) revalidatePath(path);
  revalidatePath('/');
  return { ok: true, id: data.id as string };
}

/** Done tick on a timeline row: fn_follow_up_done checks org and the mapped module in the database. */
export async function followUpDoneAction(input: unknown): Promise<ActionResult> {
  const parsed = DoneSchema.safeParse(input);
  if (!parsed.success) return BAD_PAYLOAD;

  const profile = await getCurrentProfile();
  const entityType = parsed.data.entity_type as FollowUpEntityType;
  const allowed =
    entityType === 'payment'
      ? hasModule(profile, 'payments') || hasModule(profile, 'orders')
      : hasModule(profile, ENTITY_MODULE[entityType]);
  if (!allowed) return ACCESS_DENIED;

  const supabase = createClient();
  const { error } = await supabase.rpc('fn_follow_up_done', { p_id: parsed.data.id });
  if (error) return mapDbError(error);

  revalidatePath('/');
  return { ok: true, id: parsed.data.id };
}
