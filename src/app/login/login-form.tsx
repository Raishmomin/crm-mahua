'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, BookOpen, Crown, Eye, EyeOff, Phone, ShoppingBag, Wheat, type LucideIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { USER_ROLES, type UserRole } from '@/lib/labels';
import { tryAsAction } from './actions';
import { roleWord } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { LanguageToggle } from '@/components/shell/language-toggle';
import { useLang, useT } from '@/components/shell/lang-provider';

// The demo emails and password live only on the server (./actions.ts, contracts A11).
const DEMO_ICONS: Record<UserRole, LucideIcon> = {
  owner: Crown,
  accountant: BookOpen,
  sales: Phone,
  operations: ShoppingBag,
};
const LAST_EMAIL_KEY = 'mahuva.lastEmail';

function isNetworkError(error: { name?: string; status?: number; message?: string }): boolean {
  return error.name === 'AuthRetryableFetchError' || error.status === 0 || /fetch/i.test(error.message ?? '');
}

/** Email + password, one Sign in button, "Try as" demo buttons (demo mode only), language toggle. */
export function LoginForm({ demo }: { demo: boolean }) {
  const lang = useLang();
  const tt = useT();
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [missing, setMissing] = React.useState<{ email?: boolean; password?: boolean }>({});

  React.useEffect(() => {
    try {
      const last = window.localStorage.getItem(LAST_EMAIL_KEY);
      if (last) setEmail(last);
    } catch {
      // Private mode or storage blocked: nothing to prefill.
    }
  }, []);

  async function signIn(mail: string, pass: string) {
    setError(null);
    setBusy(true);
    try {
      const { error: authError } = await createClient().auth.signInWithPassword({ email: mail, password: pass });
      if (authError) {
        setError(tt(isNetworkError(authError) ? 'msg.error.offline' : 'msg.login_error'));
        setBusy(false);
        return;
      }
      try {
        window.localStorage.setItem(LAST_EMAIL_KEY, mail);
      } catch {
        // ignore
      }
      router.push('/');
      router.refresh();
    } catch {
      setError(tt('msg.error.offline'));
      setBusy(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // F6: our own words under the field (app language), not the browser's bubble.
    const next = { email: !email.trim(), password: !password };
    setMissing(next);
    if (next.email || next.password) return;
    void signIn(email.trim(), password);
  }

  async function tryAs(role: UserRole) {
    setError(null);
    setMissing({});
    setBusy(true);
    try {
      const result = await tryAsAction({ role });
      if (!result.ok) {
        setError(tt(result.messageKey));
        setBusy(false);
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setError(tt('msg.error.offline'));
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-[420px] space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-md">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-700 text-white">
            <Wheat className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{tt('app.name')}</h1>
          <p className="text-base text-slate-500">{tt('app.tagline')}</p>
        </div>

        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-base text-rose-800">
            <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label={tt('login.title')}>
          <p className="text-base text-slate-700">{tt('login.subtitle')}</p>
          <FormField htmlFor="email" label={tt('field.login.email')} error={missing.email ? tt('msg.error.required') : null}>
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (missing.email) setMissing((m) => ({ ...m, email: false }));
              }}
              disabled={busy}
            />
          </FormField>
          <FormField htmlFor="password" label={tt('field.login.password')} error={missing.password ? tt('msg.error.required') : null}>
            {/* F2: the wrapper keeps no id; the input carries id + aria itself (FormField skips plain wrappers). */}
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                aria-invalid={missing.password || undefined}
                aria-describedby={missing.password ? 'password-error' : undefined}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (missing.password) setMissing((m) => ({ ...m, password: false }));
                }}
                disabled={busy}
                className="pr-14"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={tt(showPassword ? 'btn.hide_password' : 'btn.show_password')}
                aria-pressed={showPassword}
                className="absolute right-0 top-0 flex h-12 w-12 items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
              </button>
            </div>
          </FormField>
          <Button type="submit" fullWidth loading={busy} loadingLabel={tt('login.wait')}>
            {tt('btn.sign_in')}
          </Button>
        </form>

        {demo && (
          <div className="space-y-2 border-t border-slate-200 pt-4">
            <p className="text-base font-semibold text-slate-700">{tt('btn.try_as')}</p>
            <div className="grid grid-cols-2 gap-2">
              {USER_ROLES.map((role) => {
                const Icon = DEMO_ICONS[role];
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => void tryAs(role)}
                    disabled={busy}
                    className="flex h-[72px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-lg font-semibold text-slate-800 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-50"
                  >
                    <Icon className="h-6 w-6 shrink-0 text-emerald-700" aria-hidden="true" />
                    <span className="truncate">{roleWord(lang, role)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-center">
          <LanguageToggle variant="full" className="w-full max-w-xs" />
        </div>
      </div>
    </main>
  );
}
