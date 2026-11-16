'use client';

import { ErrorState } from '@/components/ui/state-views';

export default function SettingsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState onRetry={() => reset()} />;
}
