/**
 * Row shapes for inquiries and follow-ups (docs/design/contracts.md 3.1, 3.2, 5.1).
 * Column names mirror migration 0004 exactly. Home's v_followups_today row lives in src/types/home.ts.
 */

export type InquiryStatus = 'new' | 'talking' | 'sample_sent' | 'quoted' | 'won' | 'lost';
export type InquirySource = 'whatsapp' | 'call' | 'visit' | 'email' | 'indiamart';
export type LostReason = 'price' | 'quality' | 'timing' | 'no_reply';

export const INQUIRY_STATUSES: InquiryStatus[] = ['new', 'talking', 'sample_sent', 'quoted', 'won', 'lost'];
export const INQUIRY_SOURCES: InquirySource[] = ['whatsapp', 'call', 'visit', 'email', 'indiamart'];
export const LOST_REASONS: LostReason[] = ['price', 'quality', 'timing', 'no_reply'];
/** Statuses that still need work (v_inquiries_open). */
export const OPEN_STATUSES: InquiryStatus[] = ['new', 'talking', 'sample_sent', 'quoted'];

export interface Inquiry {
  id: string;
  org_id: string;
  code: string;
  buyer_id: string | null;
  buyer_name: string;
  phone: string | null;
  product_id: string | null;
  product_text: string | null;
  qty_kg: number | null;
  needed_by: string | null;
  source: InquirySource;
  status: InquiryStatus;
  lost_reason: LostReason | null;
  assigned_to: string | null;
  notes: string | null;
  closed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** v_inquiries_open (contracts 5.1) */
export interface InquiryOpenRow {
  id: string;
  org_id: string;
  code: string;
  buyer_id: string | null;
  buyer_name: string;
  phone: string | null;
  product_id: string | null;
  product_name: string | null;
  qty_kg: number | null;
  needed_by: string | null;
  source: InquirySource;
  status: InquiryStatus;
  assigned_to: string | null;
  created_at: string;
  days_old: number;
  next_followup_on: string | null;
}

export type FollowUpEntityType = 'inquiry' | 'buyer' | 'quote' | 'order' | 'payment';

export interface FollowUp {
  id: string;
  org_id: string;
  entity_type: FollowUpEntityType;
  entity_id: string;
  buyer_id: string | null;
  note: string;
  /** NULL = a plain note (never in To do today) */
  due_on: string | null;
  done: boolean;
  done_at: string | null;
  done_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
