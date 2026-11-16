import React from 'react';
import { requireAuth } from '@/lib/auth';
import { LangProvider } from '@/components/shell/lang-provider';

/**
 * Print routes (quotes / orders / payments): signed-in users only, no sidebar, no bottom bar,
 * white A4 page (@page rules live in globals.css). Printed papers are always English.
 */
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return (
    <LangProvider lang="en">
      <div className="min-h-screen bg-white text-slate-900">{children}</div>
    </LangProvider>
  );
}
