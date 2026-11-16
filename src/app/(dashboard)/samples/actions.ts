'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCurrentProfile, hasModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { mapDbError } from '@/lib/db-errors';

/** contracts.md 6.2; `code` is the new SMP number for the "Saved - SMP-0004" toast. */
export type ActionResult = { ok: true; id?: string; code?: string } | { ok: false; messageKey: string; detail?: string };

const BAD_PAYLOAD: ActionResult = { ok: false, messageKey: 'msg.err.bad_payload' };
const ACCESS_DENIED: ActionResult = { ok: false, messageKey: 'msg.access_denied_title' };

const optionalText = z
  .string()
  .trim()
  .max(200)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

const CreateSampleSchema = z.object({
  inquiry_id: z.string().uuid().nullable().optional(),
  buyer_id: z.string().uuid(),
  product_id: z.string().uuid(),
  qty_grams: z.number().int().positive().max(100000),
  courier: optionalText,
  tracking_no: optionalText,
  lot_no: optionalText,
  note: z.string().trim().max(1000).optional().nullable().transform((v) => (v ? v : null)),
  mark_sent: z.boolean().default(false),
});

export type CreateSampleInput = z.input<typeof CreateSampleSchema>;

/**
 * Send sample form: one call to fn_sample_create (SECURITY INVOKER, so RLS and the column grants
 * apply). It inserts the sample as to_send in the caller's org and, with mark_sent, moves it to
 * sent in the same transaction (G2-13): a refusal saves nothing, so a retry never doubles it.
 */
export async function createSampleAction(input: unknown): Promise<ActionResult> {
  const parsed = CreateSampleSchema.safeParse(input);
  if (!parsed.success) return BAD_PAYLOAD;

  const profile = await getCurrentProfile();
  if (!hasModule(profile, 'samples')) return ACCESS_DENIED; // Wall 2

  const d = parsed.data;
  const supabase = createClient();
  const { data, error } = await supabase.rpc('fn_sample_create', {
    p_buyer_id: d.buyer_id,
    p_product_id: d.product_id,
    p_inquiry_id: d.inquiry_id ?? null,
    p_qty_grams: d.qty_grams,
    p_courier: d.courier,
    p_tracking_no: d.tracking_no,
    p_lot_no: d.lot_no,
    p_note: d.note,
    p_mark_sent: d.mark_sent,
  });
  if (error) return mapDbError(error); // Wall 1 errors become label keys

  const created = data as { id?: unknown; code?: unknown } | null;
  if (!created || typeof created.id !== 'string') return { ok: false, messageKey: 'msg.error.save' };

  revalidatePath('/samples');
  if (d.inquiry_id) revalidatePath(`/inquiries/${d.inquiry_id}`);
  revalidatePath('/');
  return { ok: true, id: created.id, code: typeof created.code === 'string' ? created.code : undefined };
}

const MarkSentSchema = z.object({
  id: z.string().uuid(),
  courier: optionalText,
  tracking_no: optionalText,
});

/** Row button "Mark sent": stores courier + tracking (column grant), then fn_sample_set_status(id, 'sent'). */
export async function markSampleSentAction(input: unknown): Promise<ActionResult> {
  const parsed = MarkSentSchema.safeParse(input);
  if (!parsed.success) return BAD_PAYLOAD;

  const profile = await getCurrentProfile();
  if (!hasModule(profile, 'samples')) return ACCESS_DENIED;

  const supabase = createClient();
  if (parsed.data.courier || parsed.data.tracking_no) {
    const { error } = await supabase
      .from('samples')
      .update({ courier: parsed.data.courier, tracking_no: parsed.data.tracking_no, updated_at: new Date().toISOString() })
      .eq('id', parsed.data.id)
      .eq('org_id', profile!.org_id);
    if (error) return mapDbError(error);
  }

  const { error } = await supabase.rpc('fn_sample_set_status', { p_id: parsed.data.id, p_status: 'sent', p_note: null });
  if (error) return mapDbError(error);

  revalidatePath('/samples');
  revalidatePath(`/samples/${parsed.data.id}`);
  revalidatePath('/');
  return { ok: true, id: parsed.data.id };
}

const ResultSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['approved', 'rejected']),
  note: z.string().trim().max(1000).optional().nullable().transform((v) => (v ? v : null)),
});

/** Row buttons "Approved" / "Rejected" with the buyer's reply. */
export async function setSampleResultAction(input: unknown): Promise<ActionResult> {
  const parsed = ResultSchema.safeParse(input);
  if (!parsed.success) return BAD_PAYLOAD;

  const profile = await getCurrentProfile();
  if (!hasModule(profile, 'samples')) return ACCESS_DENIED;

  const supabase = createClient();
  const { error } = await supabase.rpc('fn_sample_set_status', {
    p_id: parsed.data.id,
    p_status: parsed.data.status,
    p_note: parsed.data.note,
  });
  if (error) return mapDbError(error);

  revalidatePath('/samples');
  revalidatePath(`/samples/${parsed.data.id}`);
  revalidatePath('/');
  return { ok: true, id: parsed.data.id };
}
