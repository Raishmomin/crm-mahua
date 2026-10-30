'use client';

import { ErrorState } from '@/components/ui/state-views';

export default function UsersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-4">
      <ErrorState
        title="Failed to Load Users"
        description={error.message || 'Unable to retrieve team member list.'}
        onRetry={() => reset()}
      />
    </div>
  );
}
