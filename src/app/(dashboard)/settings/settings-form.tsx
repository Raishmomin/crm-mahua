'use client';

import React, { useState } from 'react';
import { Loader2, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BusinessSettings, BankDetail } from '@/types/database';
import { LABELS } from '@/lib/labels';
import { updateBusinessSettingsAction } from './actions';

export function SettingsForm({ initialData }: { initialData?: Partial<BusinessSettings> | null }) {
  const [formData, setFormData] = useState({
    company_name: initialData?.company_name || '',
    trade_name: initialData?.trade_name || '',
    gstin: initialData?.gstin || '',
    iec_code: initialData?.iec_code || '',
    pan: initialData?.pan || '',
    fssai_no: initialData?.fssai_no || '',
    address: initialData?.address || '',
    city: initialData?.city || '',
    state: initialData?.state || '',
    pincode: initialData?.pincode || '',
    country: initialData?.country || 'India',
    contact_email: initialData?.contact_email || '',
    contact_phone: initialData?.contact_phone || '',
    authorized_signatory: initialData?.authorized_signatory || '',
  });

  const [bankAccounts, setBankAccounts] = useState<BankDetail[]>(
    Array.isArray(initialData?.bank_details) && initialData?.bank_details.length > 0
      ? (initialData.bank_details as BankDetail[])
      : [
          {
            bank_name: 'State Bank of India',
            account_no: '',
            ifsc: '',
            branch: 'Mahuva',
            currency: 'INR',
            is_primary: true,
          },
        ]
  );

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addBankAccount() {
    setBankAccounts([
      ...bankAccounts,
      {
        bank_name: '',
        account_no: '',
        ifsc: '',
        branch: '',
        currency: 'INR',
        is_primary: false,
      },
    ]);
  }

  function removeBankAccount(index: number) {
    setBankAccounts(bankAccounts.filter((_, i) => i !== index));
  }

  function updateBankAccount(index: number, field: keyof BankDetail, value: any) {
    const updated = [...bankAccounts];
    updated[index] = { ...updated[index], [field]: value };
    setBankAccounts(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    setError(null);

    try {
      await updateBusinessSettingsAction({
        ...formData,
        bank_details: bankAccounts,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>Organization settings saved and synchronized successfully.</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
          {error}
        </div>
      )}

      {/* Business Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold">
            {LABELS.settings.companyDetailsTab}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {LABELS.settings.companyName} *
              </label>
              <Input
                required
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="e.g. Mahuva Dehydration Private Limited"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {LABELS.settings.tradeName}
              </label>
              <Input
                value={formData.trade_name}
                onChange={(e) => setFormData({ ...formData, trade_name: e.target.value })}
                placeholder="e.g. Mahuva Dehydro Foods"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {LABELS.settings.gstin}
              </label>
              <Input
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                placeholder="24AAACM1234F1Z5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {LABELS.settings.iecCode}
              </label>
              <Input
                value={formData.iec_code}
                onChange={(e) => setFormData({ ...formData, iec_code: e.target.value })}
                placeholder="0309012345"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {LABELS.settings.pan}
              </label>
              <Input
                value={formData.pan}
                onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                placeholder="AAACM1234F"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {LABELS.settings.fssaiNo}
              </label>
              <Input
                value={formData.fssai_no}
                onChange={(e) => setFormData({ ...formData, fssai_no: e.target.value })}
                placeholder="10019021004321"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {LABELS.settings.authorizedSignatory}
              </label>
              <Input
                value={formData.authorized_signatory}
                onChange={(e) => setFormData({ ...formData, authorized_signatory: e.target.value })}
                placeholder="e.g. Hareshbhai Mehta (Director)"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {LABELS.settings.address} *
            </label>
            <Input
              required
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Plot / Survey No., GIDC Industrial Area"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {LABELS.settings.city} *
              </label>
              <Input
                required
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {LABELS.settings.state} *
              </label>
              <Input
                required
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {LABELS.settings.pincode} *
              </label>
              <Input
                required
                value={formData.pincode}
                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {LABELS.settings.country}
              </label>
              <Input
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bank & Settlement Details */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold">
            {LABELS.settings.taxBankTab}
          </CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addBankAccount} className="h-8 text-xs gap-1">
            <Plus className="h-3.5 w-3.5" />
            Add Account
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {bankAccounts.map((account, idx) => (
            <div key={idx} className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Account #{idx + 1}</span>
                {bankAccounts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBankAccount(idx)}
                    className="text-slate-400 hover:text-rose-600 text-xs"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {LABELS.settings.bankName}
                  </label>
                  <Input
                    required
                    value={account.bank_name}
                    onChange={(e) => updateBankAccount(idx, 'bank_name', e.target.value)}
                    placeholder="State Bank of India"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {LABELS.settings.bankAccountNo}
                  </label>
                  <Input
                    required
                    value={account.account_no}
                    onChange={(e) => updateBankAccount(idx, 'account_no', e.target.value)}
                    placeholder="Account Number"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {LABELS.settings.bankIfsc}
                  </label>
                  <Input
                    required
                    value={account.ifsc}
                    onChange={(e) => updateBankAccount(idx, 'ifsc', e.target.value.toUpperCase())}
                    placeholder="SBIN0000421"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {LABELS.settings.bankBranch}
                  </label>
                  <Input
                    value={account.branch || ''}
                    onChange={(e) => updateBankAccount(idx, 'branch', e.target.value)}
                    placeholder="Mahuva Main"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {LABELS.settings.swiftCode}
                  </label>
                  <Input
                    value={account.swift || ''}
                    onChange={(e) => updateBankAccount(idx, 'swift', e.target.value.toUpperCase())}
                    placeholder="SBININBB421"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Currency
                  </label>
                  <Input
                    value={account.currency}
                    onChange={(e) => updateBankAccount(idx, 'currency', e.target.value.toUpperCase())}
                    placeholder="INR or USD"
                  />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving} className="px-6 font-semibold gap-1.5">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {LABELS.common.saving}
            </>
          ) : (
            LABELS.common.save
          )}
        </Button>
      </div>
    </form>
  );
}
