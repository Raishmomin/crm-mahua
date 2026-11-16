'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCurrentProfile, hasModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { mapDbError } from '@/lib/db-errors';
import { INCOTERMS, REJECT_REASONS } from '@/types/quotes';

/** contracts.md 6.2; `code` carries the QTN / ORD number for toasts. */
export type ActionResult = { ok: true; id?: string; code?: string } | { ok: false; messageKey: string; detail?: string };

const BAD_PAYLOAD: ActionResult = { ok: false, messageKey: 'msg.err.bad_payload' };
const ACCESS_DENIED: ActionResult = { ok: false, messageKey: 'msg.access_denied_title' };

const ItemSchema = z.object({
  product_id: z.string().uuid(),
  packaging_type_id: z.string().uuid().nullable().optional(),
  qty_kg: z.number().positive().max(10_000_000),
  unit: z.enum(['kg', 'MT']),
  rate: z.number().positive().max(100_000_000),
  spec_text: z.string().trim().max(300).nullable().optional(),
});

const QuoteSchema = z.object({
  inquiry_id: z.string().uuid().nullable().optional(),
  buyer_id: z.string().uuid(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  fx_rate: z.number().positive().nullable().optional(),
  incoterm: z.enum(INCOTERMS as [string, ...string[]]),
  valid_till: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payment_terms: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(2000).nullable().optional(),
  items: z.array(ItemSchema).min(1).max(20),
});

export type QuoteInput = z.input<typeof QuoteSchema>;

function itemRows(orgId: string, quotationId: string, items: z.infer<typeof ItemSchema>[]) {
  return items.map((it, i) => ({
    org_id: orgId,
    quotation_id: quotationId,
    product_id: it.product_id,
    packaging_type_id: it.packaging_type_id ?? null,
    qty_kg: it.qty_kg,
    unit: it.unit,
    rate: it.rate,
    spec_text: it.spec_text || null,
    sort_order: i + 1,
  }));
}

/** Save quote (draft): header insert, then items; the triggers price-guard and total the rows. */
export async function createQuoteAction(input: unknown): Promise<ActionResult> {
  const parsed = QuoteSchema.safeParse(input);
  if (!parsed.success) return parsed.error.issues.some((i) => i.path[0] === 'items') ? { ok: false, messageKey: 'msg.err.no_items' } : BAD_PAYLOAD;

  const profile = await getCurrentProfile();
  if (!hasModule(profile, 'quotes')) return ACCESS_DENIED; // Wall 2

  const d = parsed.data;
  const supabase = createClient();
  const { data: header, error } = await supabase
    .from('quotations')
    .insert({
      org_id: profile!.org_id, // org lock
      inquiry_id: d.inquiry_id ?? null,
      buyer_id: d.buyer_id,
      currency: d.currency,
      fx_rate: d.currency === 'INR' ? null : d.fx_rate ?? null,
      incoterm: d.incoterm,
      valid_till: d.valid_till,
      payment_terms: d.payment_terms,
      notes: d.notes || null,
      created_by: profile!.id,
    })
    .select('id, quote_no')
    .single();
  if (error) return mapDbError(error);

  const { error: itemsError } = await supabase.from('quotation_items').insert(itemRows(profile!.org_id, header.id, d.items));
  if (itemsError) {
    // No half quotes: a refused item (floor price) removes the empty draft again.
    await supabase.from('quotations').delete().eq('id', header.id).eq('org_id', profile!.org_id);
    return mapDbError(itemsError);
  }

  revalidatePath('/quotes');
  if (d.inquiry_id) revalidatePath(`/inquiries/${d.inquiry_id}`);
  return { ok: true, id: header.id, code: header.quote_no };
}

const UpdateSchema = QuoteSchema.extend({ id: z.string().uuid() });

/**
 * Edit a draft: header + items in one transaction (fn_quote_update_draft, SECURITY INVOKER, so
 * RLS, the column grants and the item guard all apply). The new items are guarded against the
 * new currency, and a refused item (floor / no price) leaves the draft exactly as it was.
 */
export async function updateQuoteAction(input: unknown): Promise<ActionResult> {
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success) return parsed.error.issues.some((i) => i.path[0] === 'items') ? { ok: false, messageKey: 'msg.err.no_items' } : BAD_PAYLOAD;

  const profile = await getCurrentProfile();
  if (!hasModule(profile, 'quotes')) return ACCESS_DENIED;

  const d = parsed.data;
  const supabase = createClient();
  const items = itemRows(profile!.org_id, d.id, d.items).map(({ product_id, packaging_type_id, qty_kg, unit, rate, spec_text }) => ({
    product_id,
    packaging_type_id,
    qty_kg,
    unit,
    rate,
    spec_text,
  }));
  const { data: quoteNo, error } = await supabase.rpc('fn_quote_update_draft', {
    p_id: d.id,
    p_buyer_id: d.buyer_id,
    p_inquiry_id: d.inquiry_id ?? null,
    p_currency: d.currency,
    p_fx_rate: d.currency === 'INR' ? null : d.fx_rate ?? null,
    p_incoterm: d.incoterm,
    p_valid_till: d.valid_till,
    p_payment_terms: d.payment_terms,
    p_notes: d.notes || null,
    p_items: items,
  });
  if (error) return mapDbError(error);

  revalidatePath('/quotes');
  revalidatePath(`/quotes/${d.id}`);
  return { ok: true, id: d.id, code: typeof quoteNo === 'string' ? quoteNo : undefined };
}

const IdSchema = z.object({ id: z.string().uuid() });

/** Mark sent / "Yes, mark sent" after WhatsApp: fn_quote_send (floor guard, inquiry -> quoted, follow-up). */
export async function sendQuoteAction(input: unknown): Promise<ActionResult> {
  const parsed = IdSchema.safeParse(input);
  if (!parsed.success) return BAD_PAYLOAD;

  const profile = await getCurrentProfile();
  if (!hasModule(profile, 'quotes')) return ACCESS_DENIED;

  const supabase = createClient();
  const { error } = await supabase.rpc('fn_quote_send', { p_id: parsed.data.id });
  if (error) return mapDbError(error);

  revalidatePath('/quotes');
  revalidatePath(`/quotes/${parsed.data.id}`);
  revalidatePath('/');
  return { ok: true, id: parsed.data.id };
}

const RejectSchema = z.object({ id: z.string().uuid(), reason: z.enum(REJECT_REASONS as [string, ...string[]]) });

/** Buyer rejected + reason chip: fn_quote_reject. */
export async function rejectQuoteAction(input: unknown): Promise<ActionResult> {
  const parsed = RejectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, messageKey: 'msg.err.reason_required' };

  const profile = await getCurrentProfile();
  if (!hasModule(profile, 'quotes')) return ACCESS_DENIED;

  const supabase = createClient();
  const { error } = await supabase.rpc('fn_quote_reject', { p_id: parsed.data.id, p_reason: parsed.data.reason });
  if (error) return mapDbError(error);

  revalidatePath('/quotes');
  revalidatePath(`/quotes/${parsed.data.id}`);
  revalidatePath('/');
  return { ok: true, id: parsed.data.id };
}

const AcceptSchema = z.object({
  id: z.string().uuid(),
  ship_by: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  advance_pct: z.number().int().min(0).max(100),
});

/**
 * "Looks right, make order": fn_quote_accept (Dev-3, 0006) returns the new order id.
 * While the function is not migrated yet the error maps to msg.error.save (no crash).
 */
export async function acceptQuoteAction(input: unknown): Promise<ActionResult> {
  const parsed = AcceptSchema.safeParse(input);
  if (!parsed.success) return BAD_PAYLOAD;

  const profile = await getCurrentProfile();
  if (!hasModule(profile, 'quotes')) return ACCESS_DENIED;

  const supabase = createClient();
  const { data, error } = await supabase.rpc('fn_quote_accept', {
    p_quote_id: parsed.data.id,
    p_ship_by: parsed.data.ship_by,
    p_advance_pct: parsed.data.advance_pct,
  });
  if (error) return mapDbError(error);
  const orderId = typeof data === 'string' ? data : null;
  if (!orderId) return { ok: false, messageKey: 'msg.error.save' };

  revalidatePath('/quotes');
  revalidatePath(`/quotes/${parsed.data.id}`);
  revalidatePath('/orders');
  revalidatePath('/');
  return { ok: true, id: orderId };
}

/** Delete a draft (RLS allows drafts only; items cascade). */
export async function deleteQuoteAction(input: unknown): Promise<ActionResult> {
  const parsed = IdSchema.safeParse(input);
  if (!parsed.success) return BAD_PAYLOAD;

  const profile = await getCurrentProfile();
  if (!hasModule(profile, 'quotes')) return ACCESS_DENIED;

  const supabase = createClient();
  const { data, error } = await supabase
    .from('quotations')
    .delete()
    .eq('id', parsed.data.id)
    .eq('org_id', profile!.org_id)
    .eq('status', 'draft')
    .select('id');
  if (error) return mapDbError(error);
  if (!data || data.length === 0) return { ok: false, messageKey: 'msg.err.invalid_transition' };

  revalidatePath('/quotes');
  return { ok: true };
}

/** "Done" on a quote follow-up row: fn_follow_up_done (0004) maps entity quote -> module quotes. */
export async function quoteFollowUpDoneAction(input: unknown): Promise<ActionResult> {
  const parsed = IdSchema.safeParse(input);
  if (!parsed.success) return BAD_PAYLOAD;

  const profile = await getCurrentProfile();
  if (!hasModule(profile, 'quotes')) return ACCESS_DENIED;

  const supabase = createClient();
  const { error } = await supabase.rpc('fn_follow_up_done', { p_id: parsed.data.id });
  if (error) return mapDbError(error);

  revalidatePath('/quotes');
  revalidatePath('/');
  return { ok: true };
}
