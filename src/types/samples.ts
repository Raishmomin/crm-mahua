/**
 * Row shapes for samples (docs/design/contracts.md 3.3). Column names mirror the table exactly.
 */

export type SampleStatus = 'to_send' | 'sent' | 'approved' | 'rejected';

export const SAMPLE_STATUSES: SampleStatus[] = ['to_send', 'sent', 'approved', 'rejected'];

export interface Sample {
  id: string;
  org_id: string;
  code: string;
  inquiry_id: string | null;
  buyer_id: string;
  product_id: string;
  qty_grams: number;
  lot_no: string | null;
  courier: string | null;
  tracking_no: string | null;
  sent_on: string | null;
  status: SampleStatus;
  result_note: string | null;
  decided_on: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** One list / detail row: the sample plus the names the screen shows. */
export interface SampleRow extends Sample {
  buyer_name: string;
  product_name: string;
  product_short: string;
  inquiry_code: string | null;
  phone: string | null;
}
