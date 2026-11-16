/**
 * Row shapes for quotations and quotation_items (docs/design/contracts.md 3.4 / 3.5).
 * Column names mirror the tables exactly. `expired` is never stored by the app: the UI
 * derives it from status = 'sent' AND valid_till < today (see quoteDisplayStatus).
 */

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

export const QUOTE_STATUSES: QuoteStatus[] = ['draft', 'sent', 'accepted', 'rejected', 'expired'];

export type Incoterm = 'EXW' | 'FOB Pipavav' | 'FOB Mundra' | 'CIF';

export const INCOTERMS: Incoterm[] = ['EXW', 'FOB Pipavav', 'FOB Mundra', 'CIF'];

export type RejectReason = 'price' | 'quality' | 'timing' | 'no_reply';

export const REJECT_REASONS: RejectReason[] = ['price', 'quality', 'timing', 'no_reply'];

export type RateUnit = 'kg' | 'MT';

export interface Quotation {
  id: string;
  org_id: string;
  quote_no: string;
  inquiry_id: string | null;
  buyer_id: string;
  currency: string;
  fx_rate: number | null;
  incoterm: Incoterm;
  valid_till: string;
  payment_terms: string;
  subtotal: number;
  gst_amount: number;
  total: number;
  status: QuoteStatus;
  reject_reason: RejectReason | null;
  notes: string | null;
  sent_at: string | null;
  decided_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuotationItem {
  id: string;
  org_id: string;
  quotation_id: string;
  product_id: string;
  packaging_type_id: string | null;
  qty_kg: number;
  unit: RateUnit;
  rate: number;
  amount: number;
  floor_price_at_time: number | null;
  gst_rate: number;
  spec_text: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Item with the names the detail and print pages show. */
export interface QuotationItemRow extends QuotationItem {
  product_name: string;
  product_hsn: string | null;
  packaging_name: string | null;
}

/** Quotes list row: header plus buyer name and the derived display status. */
export interface QuoteListRow extends Quotation {
  buyer_name: string;
  display_status: QuoteStatus;
  days_left: number;
}

/** Everything the quote detail / print pages need in one shape. */
export interface QuoteDetail extends Quotation {
  display_status: QuoteStatus;
  days_left: number;
  buyer: {
    id: string;
    company_name: string;
    /** buyers.buyer_type: export_* decides export vs India (quotes/helpers.ts isExportBuyer). */
    buyer_type: string | null;
    country: string;
    city: string | null;
    state: string | null;
    address: string | null;
    gstin: string | null;
    contact_name: string | null;
    phone: string | null;
  };
  items: QuotationItemRow[];
  sent_by_name: string | null;
  inquiry_code: string | null;
}
