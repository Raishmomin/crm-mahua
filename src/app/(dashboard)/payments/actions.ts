'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCurrentProfile, hasModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { mapDbError } from '@/lib/db-errors';
import { PAY_MODES } from '@/types/payments';

/** contracts.md 6.2 result; `code` carries the new receipt number for the success screen. */
export type ActionResult = { ok: true; id?: string; code?: string } | { ok: false; messageKey: string; detail?: string };

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const PaymentSchema = z.object({
  order_id: z.string().uuid(),
  amount: z.number().positive().max(1_000_000_000),
  received_on: isoDate,
  mode: z.enum(PAY_MODES as [string, ...string[]]),
  reference: optionalText(120),
  amount_inr: z.number().positive().max(100_000_000_000).nullish(),
  fx_rate: z.number().positive().max(100_000).nullish(),
  note: optionalText(1000),
});

/** A8 (SEC2-08): the two money caps get their own plain words; everything else as usual. */
function paymentError(error: { message?: string; details?: string | null }): ActionResult {
  const mapped = mapDbError(error);
  if (mapped.messageKey === 'msg.err.bad_payload' && error.details === 'received_on') return { ok: false, messageKey: 'payments.err.future_date' };
  if (mapped.messageKey === 'msg.err.bad_payload' && error.details === 'over_payment') return { ok: false, messageKey: 'payments.err.over_payment' };
  return mapped;
}

/**
 * Money received: fn_payment_record (0006) checks org, the payments module, the order and the
 * USD rupee value, and assigns the REC number. Returns the receipt number for the success screen.
 */
export async function recordPaymentAction(input: unknown): Promise<ActionResult> {
  const parsed = PaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, messageKey: 'msg.err.bad_payload' };

  const profile = await getCurrentProfile();
  if (!hasModule(profile, 'payments')) return { ok: false, messageKey: 'msg.access_denied_title' }; // Wall 2

  const d = parsed.data;
  const supabase = createClient();
  const { data, error } = await supabase.rpc('fn_payment_record', {
    p_order_id: d.order_id,
    p_amount: d.amount,
    p_received_on: d.received_on,
    p_mode: d.mode,
    p_reference: d.reference,
    p_amount_inr: d.amount_inr ?? null,
    p_fx_rate: d.fx_rate ?? null,
    p_note: d.note,
  });
  if (error) return paymentError(error);
  const paymentId = typeof data === 'string' ? data : null;
  if (!paymentId) return { ok: false, messageKey: 'msg.error.save' };

  const { data: row } = await supabase.from('payments').select('receipt_no').eq('id', paymentId).maybeSingle();

  revalidatePath('/payments');
  revalidatePath(`/orders/${d.order_id}`);
  revalidatePath('/');
  return { ok: true, id: paymentId, code: (row as { receipt_no?: string } | null)?.receipt_no ?? undefined };
}
