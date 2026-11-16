import React from 'react';
import { getLang } from '@/lib/i18n-server';
import { LangProvider } from '@/components/shell/lang-provider';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic'; // DEMO_MODE is read at request time, not baked into the build

export default function LoginPage() {
  const lang = getLang();
  // contracts A11: "Try as" only with the server-side DEMO_MODE=true (and a DEMO_PASSWORD for tryAsAction).
  const demo = process.env.DEMO_MODE === 'true' && Boolean(process.env.DEMO_PASSWORD);
  return (
    <LangProvider lang={lang}>
      <LoginForm demo={demo} />
    </LangProvider>
  );
}
