'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wheat, Loader2, AlertCircle } from 'lucide-react';
import { LABELS } from '@/lib/labels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(LABELS.auth.invalidCredentials);
        setLoading(false);
        return;
      }

      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err?.message || LABELS.auth.invalidCredentials);
      setLoading(false);
    }
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword('DemoPass123!');
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-md border border-slate-200 p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-xl bg-emerald-700 flex items-center justify-center text-white shadow">
            <Wheat className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {LABELS.appName}
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            {LABELS.tagline}
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {LABELS.auth.emailLabel}
            </label>
            <Input
              type="email"
              required
              placeholder="e.g. admin@mahuvacrm.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {LABELS.auth.passwordLabel}
            </label>
            <Input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <Button type="submit" className="w-full font-semibold" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {LABELS.auth.signingIn}
              </>
            ) : (
              LABELS.auth.signInButton
            )}
          </Button>
        </form>

        {/* Demo Fast Login Buttons for testing each role */}
        <div className="pt-4 border-t border-slate-200 space-y-2">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center">
            Demo Credentials (Stage 0)
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => fillDemo('admin@mahuvacrm.com')}
              className="text-left p-2 rounded border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-colors text-xs"
            >
              <div className="font-semibold text-slate-800">Owner (Admin)</div>
              <div className="text-[10px] text-slate-500">All 13 modules</div>
            </button>
            <button
              type="button"
              onClick={() => fillDemo('accountant@mahuvacrm.com')}
              className="text-left p-2 rounded border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-colors text-xs"
            >
              <div className="font-semibold text-slate-800">Accountant</div>
              <div className="text-[10px] text-slate-500">Finance & costs</div>
            </button>
            <button
              type="button"
              onClick={() => fillDemo('sales@mahuvacrm.com')}
              className="text-left p-2 rounded border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-colors text-xs"
            >
              <div className="font-semibold text-slate-800">Sales Lead</div>
              <div className="text-[10px] text-slate-500">Quotes & orders</div>
            </button>
            <button
              type="button"
              onClick={() => fillDemo('ops@mahuvacrm.com')}
              className="text-left p-2 rounded border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-colors text-xs"
            >
              <div className="font-semibold text-slate-800">Operations</div>
              <div className="text-[10px] text-slate-500">Fulfillment</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
