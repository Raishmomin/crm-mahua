'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCurrentProfile, hasModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { mapDbError } from '@/lib/db-errors';
import { CHECKLIST_KEYS } from '@/lib/status';

/**
 * Order screens' server actions (contracts.md 6.2). Every state change is an RPC to a
 * SECURITY DEFINER function in 0006 that checks org, module and role again (Wall 1).
 * Failures carry a label key; nothing throws to the client and no SQL text leaks.
 */
export type ActionResult = { ok: true; id?: string; code?: string } | { ok: false; messageKey: string; detail?: string };

const BAD_PAYLOAD: ActionResult = { ok: false, messageKey: 'msg.err.bad_payload' };
const ACCESS_DENIED: ActionResult = { ok: false, messageKey: 'msg.access_denied_title' };

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const shortText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

async function ordersSession() {
  const profile = await getCurrentProfile();
  if (!hasModule(profile, 'orders')) return null; // Wall 2
  return { profile: profile!, supabase: createClient() };
}

function revalidateOrder(id: string) {
  revalidatePath('/orders');
  revalidatePath(`/orders/${id}`);
  revalidatePath('/');
}

const StatusSchema = z.object({ id: uuid, status: z.enum(['in_production', 'ready', 'cancelled']) });

/** Start packing / Packing started (-> in_production), and Cancel order (owner; the DB checks the role). */
export async function setOrderStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = StatusSchema.safeParse(input);
  if (!parsed.success) return BAD_PAYLOAD;
  const session = await ordersSession();
  if (!session) return ACCESS_DENIED;
  const { error } = await session.supabase.rpc('fn_order_set_status', { p_id: parsed.data.id, p_status: parsed.data.status });
  if (error) return mapDbError(error);
  revalidateOrder(parsed.data.id);
  return { ok: true, id: parsed.data.id };
}

const PackedSchema = z.object({ id: uuid, bags: z.number().int().positive().max(100000) });

/** Packed -> "How many bags?" -> fn_order_set_packed (stores the bags, status ready). */
export async function setPackedAction(input: unknown): Promise<ActionResult> {
  const parsed = PackedSchema.safeParse(input);
  if (!parsed.success) return BAD_PAYLOAD;
  const session = await ordersSession();
  if (!session) return ACCESS_DENIED;
  const { error } = await session.supabase.rpc('fn_order_set_packed', { p_order_id: parsed.data.id, p_packed_bags: parsed.data.bags });
  if (error) return mapDbError(error);
  revalidateOrder(parsed.data.id);
  return { ok: true, id: parsed.data.id };
}

const DispatchSchema = z
  .object({
    order_id: uuid,
    mode: z.enum(['truck', 'container']),
    dispatched_on: isoDate,
    bags: z.number().int().min(0).max(100000),
    qty_kg: z.number().positive().max(10_000_000),
    vehicle_no: shortText(40),
    lr_no: shortText(60),
    transporter: shortText(120),
    container_no: shortText(40),
    port: shortText(60),
    vessel: shortText(120),
    stuffing_date: isoDate.nullish(),
    eta: isoDate.nullish(),
    notes: shortText(1000),
  })
  .refine((d) => (d.mode === 'truck' ? !!d.vehicle_no : !!d.container_no && !!d.port), 'mode fields');

/** Save & make papers (office form and the Plant's Loaded form): fn_order_dispatch -> invoice number. */
export async function dispatchOrderAction(input: unknown): Promise<ActionResult> {
  const parsed = DispatchSchema.safeParse(input);
  if (!parsed.success) return BAD_PAYLOAD;
  const session = await ordersSession();
  if (!session) return ACCESS_DENIED;
  const d = parsed.data;
  const truck = d.mode === 'truck';
  const { data, error } = await session.supabase.rpc('fn_order_dispatch', {
    p_order_id: d.order_id,
    p_mode: d.mode,
    p_vehicle_no: truck ? d.vehicle_no : null,
    p_lr_no: d.lr_no,
    p_transporter: d.transporter,
    p_bags: d.bags,
    p_qty_kg: d.qty_kg,
    p_container_no: truck ? null : d.container_no,
    p_port: truck ? null : d.port,
    p_vessel: truck ? null : d.vessel,
    p_stuffing_date: truck ? null : d.stuffing_date ?? null,
    p_eta: truck ? null : d.eta ?? null,
    p_dispatched_on: d.dispatched_on,
    p_notes: d.notes,
  });
  if (error) return mapDbError(error);
  const dispatchId = typeof data === 'string' ? data : null;
  if (!dispatchId) return { ok: false, messageKey: 'msg.error.save' };

  const { data: row } = await session.supabase.from('dispatches').select('invoice_no').eq('id', dispatchId).maybeSingle();
  revalidateOrder(d.order_id);
  return { ok: true, id: dispatchId, code: (row as { invoice_no?: string } | null)?.invoice_no ?? undefined };
}

const TickSchema = z.object({
  order_id: uuid,
  dispatch_id: uuid,
  key: z.enum(CHECKLIST_KEYS),
  done: z.boolean(),
  on_date: isoDate.nullish(),
  bl_no: shortText(60),
});

/** Export checklist Tick / Untick: fn_dispatch_tick checks the Plant and Untick role rules. */
export async function tickChecklistAction(input: unknown): Promise<ActionResult> {
  const parsed = TickSchema.safeParse(input);
  if (!parsed.success) return BAD_PAYLOAD;
  const session = await ordersSession();
  if (!session) return ACCESS_DENIED;
  const d = parsed.data;
  const { error } = await session.supabase.rpc('fn_dispatch_tick', {
    p_dispatch_id: d.dispatch_id,
    p_key: d.key,
    p_done: d.done,
    p_on_date: d.done ? d.on_date ?? null : null,
    p_bl_no: d.done ? d.bl_no : null,
  });
  if (error) return mapDbError(error);
  revalidateOrder(d.order_id);
  revalidatePath(`/orders/${d.order_id}/checklist`);
  return { ok: true };
}

const DeliveredSchema = z.object({ order_id: uuid, dispatch_id: uuid, delivered_on: isoDate });

/** Delivered (not Plant; the DB refuses operations). */
export async function deliveredAction(input: unknown): Promise<ActionResult> {
  const parsed = DeliveredSchema.safeParse(input);
  if (!parsed.success) return BAD_PAYLOAD;
  const session = await ordersSession();
  if (!session) return ACCESS_DENIED;
  const { error } = await session.supabase.rpc('fn_dispatch_delivered', {
    p_id: parsed.data.dispatch_id,
    p_delivered_on: parsed.data.delivered_on,
  });
  if (error) return mapDbError(error);
  revalidateOrder(parsed.data.order_id);
  return { ok: true };
}

const NoteSchema = z.object({
  entity_type: z.literal('order'),
  entity_id: uuid,
  buyer_id: uuid.nullable(),
  note: z.string().trim().min(1).max(1000),
  due_on: isoDate.nullable(),
});

/** Notes and follow-ups on an order (follow_ups insert by policy: org + orders module). */
export async function addOrderNoteAction(input: unknown): Promise<ActionResult> {
  const parsed = NoteSchema.safeParse(input);
  if (!parsed.success) return BAD_PAYLOAD;
  const session = await ordersSession();
  if (!session) return ACCESS_DENIED;
  const d = parsed.data;
  const plain = d.due_on === null;
  const { data, error } = await session.supabase
    .from('follow_ups')
    .insert({
      org_id: session.profile.org_id, // org lock: always the caller's org
      entity_type: 'order',
      entity_id: d.entity_id,
      buyer_id: d.buyer_id,
      note: d.note,
      due_on: d.due_on,
      done: plain,
      done_at: plain ? new Date().toISOString() : null,
    })
    .select('id')
    .single();
  if (error) return mapDbError(error);
  revalidateOrder(d.entity_id);
  return { ok: true, id: (data as { id: string }).id };
}

const DoneSchema = z.object({ id: uuid, entity_type: z.string().optional() });

/** Done on an order follow-up row: fn_follow_up_done (0004) checks org and module. */
export async function orderFollowUpDoneAction(input: unknown): Promise<ActionResult> {
  const parsed = DoneSchema.safeParse(input);
  if (!parsed.success) return BAD_PAYLOAD;
  const session = await ordersSession();
  if (!session) return ACCESS_DENIED;
  const { error } = await session.supabase.rpc('fn_follow_up_done', { p_id: parsed.data.id });
  if (error) return mapDbError(error);
  revalidatePath('/orders');
  revalidatePath('/');
  return { ok: true };
}
