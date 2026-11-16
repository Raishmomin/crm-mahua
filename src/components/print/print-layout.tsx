import React from 'react';
import type { BankDetail, BusinessSettings } from '@/types/database';
import { formatDate } from '@/lib/utils';
import { PrintToolbar, type PrintToolbarProps } from './print-toolbar';

export type PrintCompany = Pick<
  BusinessSettings,
  | 'company_name'
  | 'trade_name'
  | 'address'
  | 'city'
  | 'state'
  | 'pincode'
  | 'country'
  | 'gstin'
  | 'iec_code'
  | 'fssai_no'
  | 'pan'
  | 'contact_phone'
  | 'contact_email'
  | 'bank_details'
  | 'authorized_signatory'
>;

export interface PrintLayoutProps extends PrintToolbarProps {
  company: Partial<PrintCompany> | null | undefined;
  /** QUOTATION / PROFORMA INVOICE / TAX INVOICE / COMMERCIAL INVOICE / DISPATCH NOTE / RECEIPT */
  title: string;
  docNo: string;
  /** ISO date */
  date: string | null | undefined;
  /** Picks the bank account; SWIFT is printed when not INR. Default INR. */
  currency?: string;
  /** Default true */
  showBank?: boolean;
  children: React.ReactNode;
}

/** Primary account for the document currency, else the primary account, else the first one. */
export function pickBankAccount(list: BankDetail[] | null | undefined, currency = 'INR'): BankDetail | null {
  const accounts = Array.isArray(list) ? list : [];
  const cur = currency.toUpperCase();
  return (
    accounts.find((b) => (b.currency || 'INR').toUpperCase() === cur && b.is_primary) ??
    accounts.find((b) => (b.currency || 'INR').toUpperCase() === cur) ??
    accounts.find((b) => b.is_primary) ??
    accounts[0] ??
    null
  );
}

/** A4 paper: company header, title block, the document body, bank block, signature footer. English only. */
export function PrintLayout({ company, title, docNo, date, currency = 'INR', showBank = true, backHref, whatsapp, children }: PrintLayoutProps) {
  const c = company ?? {};
  const registrations = [
    c.gstin ? `GSTIN ${c.gstin}` : null,
    c.iec_code ? `IEC ${c.iec_code}` : null,
    c.fssai_no ? `FSSAI ${c.fssai_no}` : null,
    c.pan ? `PAN ${c.pan}` : null,
  ].filter(Boolean);
  const addressLine = [c.address, [c.city, c.state, c.pincode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const contactLine = [c.contact_phone, c.contact_email].filter(Boolean).join(' · ');
  const bank = showBank ? pickBankAccount(c.bank_details, currency) : null;
  const companyName = c.company_name ?? '';

  return (
    <>
      <PrintToolbar backHref={backHref} whatsapp={whatsapp} />
      <article className="mx-auto max-w-[190mm] p-6 font-sans text-[11pt] leading-snug text-slate-900 print:p-0">
        <header className="border-b-2 border-slate-800 pb-3">
          <h1 className="text-[20pt] font-bold leading-tight">{companyName}</h1>
          {c.trade_name && c.trade_name !== companyName && <p className="text-[12pt]">{c.trade_name}</p>}
          {addressLine && <p>{addressLine}</p>}
          {contactLine && <p>{contactLine}</p>}
          {registrations.length > 0 && <p className="text-[10pt]">{registrations.join(' · ')}</p>}
        </header>

        <div className="mt-4 flex items-start justify-between gap-4">
          <h2 className="text-[16pt] font-bold">{title}</h2>
          <div className="text-right">
            <p className="font-semibold">{docNo}</p>
            <p>{formatDate(date)}</p>
          </div>
        </div>

        <div className="mt-4 space-y-4">{children}</div>

        {bank && (
          <section className="mt-6 border-t border-slate-400 pt-3">
            <h3 className="font-bold">Bank</h3>
            <p>{bank.bank_name}{bank.branch ? `, ${bank.branch}` : ''}</p>
            <p>A/c no {bank.account_no} · IFSC {bank.ifsc}{currency.toUpperCase() !== 'INR' && bank.swift ? ` · SWIFT ${bank.swift}` : ''}</p>
          </section>
        )}

        <footer className="mt-10 flex items-end justify-between gap-4">
          <p className="text-[9pt] text-slate-500">Mahuva CRM</p>
          <div className="text-right">
            <p className="font-semibold">For {companyName}</p>
            <div className="ml-auto mt-10 w-[40mm] border-t border-slate-800" />
            {c.authorized_signatory && <p className="mt-1">{c.authorized_signatory}</p>}
            <p className="text-[10pt] text-slate-600">Authorised signatory</p>
          </div>
        </footer>
      </article>
    </>
  );
}
