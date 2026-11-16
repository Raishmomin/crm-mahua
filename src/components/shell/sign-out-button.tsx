'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button, type ButtonVariant } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useT } from './lang-provider';

export interface SignOutButtonProps {
  variant?: ButtonVariant;
  /** 48px round icon only (header on md+) */
  iconOnly?: boolean;
  fullWidth?: boolean;
  /** Custom word (account-inactive uses btn.sign_in); hides the icon */
  label?: string;
  className?: string;
}

/** Signs out and goes to /login. Works even when the auth server is unreachable. */
export function SignOutButton({ variant = 'outline', iconOnly = false, fullWidth, label, className }: SignOutButtonProps) {
  const tt = useT();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const word = label ?? tt('btn.sign_out');

  async function signOut() {
    setBusy(true);
    try {
      await createClient().auth.signOut();
    } catch {
      // Still send the user to the login page.
    }
    router.push('/login');
    router.refresh();
  }

  return (
    <Button
      variant={variant}
      size={iconOnly ? 'icon' : 'default'}
      fullWidth={fullWidth}
      onClick={signOut}
      loading={busy}
      aria-label={word}
      title={word}
      className={className}
    >
      {!label && <LogOut aria-hidden="true" />}
      {!iconOnly && <span>{word}</span>}
    </Button>
  );
}
