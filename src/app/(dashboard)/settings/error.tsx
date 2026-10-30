'use client';

import { ErrorState } from '@/components/ui/state-views';

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-4">
      <ErrorState
        title="Failed to Load Settings"
        description={error.message || 'Unable to retrieve organization settings.'}
        onRetry={() => reset()}
      />
    </div>
  );
}
