'use client';

import { ErrorState } from '@/components/ui/state-views';

export default function InquiriesError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState onRetry={() => reset()} />;
}
