/**
 * Map a Supabase / Postgres error to a label key (docs/design/contracts.md section 6.2).
 * Server actions return this instead of throwing; the client shows t(lang, messageKey, { floor: detail }).
 */

export type ActionFailure = { ok: false; messageKey: string; detail?: string };

/** MESSAGE texts raised by the SQL functions (contracts.md section 2.3). */
const KNOWN_MESSAGES = new Set([
  'not_found',
  'role_not_allowed',
  'invalid_transition',
  'no_items',
  'quote_expired',
  'below_floor_price',
  'bad_payload',
  'last_owner',
  'self_change',
  'reason_required',
  'bl_required',
]);

interface DbErrorLike {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

function asDbError(error: unknown): DbErrorLike {
  if (error && typeof error === 'object') return error as DbErrorLike;
  return { message: typeof error === 'string' ? error : undefined };
}

export function mapDbError(error: unknown): ActionFailure {
  const e = asDbError(error);
  const code = e.code ?? '';
  const message = (e.message ?? '').trim();
  const detail = e.details ?? undefined;

  // A function's own message code wins, whatever the SQLSTATE (role_not_allowed is 42501 too).
  if (KNOWN_MESSAGES.has(message)) {
    return { ok: false, messageKey: `msg.err.${message}`, detail: detail || undefined };
  }

  // Access denied (fn_require_module, RLS write refusals).
  if (code === '42501' || /access denied/i.test(message) || /row-level security/i.test(message)) {
    return { ok: false, messageKey: 'msg.access_denied_title' };
  }

  // Unique violation, missing view / function (not migrated yet), anything else.
  if (code === '23505' || code === '42P01' || code === '42883') {
    if (code !== '23505') console.error('[db] object not migrated yet:', code, message);
    return { ok: false, messageKey: 'msg.error.save' };
  }

  console.error('[db] unexpected error:', code, message, detail);
  return { ok: false, messageKey: 'msg.error.save' };
}

/** True when the error means "this table/view/function does not exist yet" (lower sprint state). */
export function isMissingObjectError(error: unknown): boolean {
  const e = asDbError(error);
  const code = e.code ?? '';
  const message = e.message ?? '';
  return (
    code === '42P01' ||
    code === '42883' ||
    code === 'PGRST202' ||
    code === 'PGRST205' ||
    /does not exist/i.test(message) ||
    /could not find/i.test(message) ||
    /schema cache/i.test(message)
  );
}
