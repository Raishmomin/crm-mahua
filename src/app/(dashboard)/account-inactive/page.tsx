import React from 'react';
import Link from 'next/link';
import { UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LABELS } from '@/lib/labels';

export default function AccountInactivePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
      <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-4">
        <UserX className="h-8 w-8" />
      </div>
      <h2 className="text-xl font-bold text-slate-900">Account Deactivated</h2>
      <p className="mt-2 text-sm text-slate-500 max-w-md">
        {LABELS.auth.accountInactive}
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/login">
          <Button variant="outline" size="sm">
            Sign In with Another Account
          </Button>
        </Link>
      </div>
    </div>
  );
}
