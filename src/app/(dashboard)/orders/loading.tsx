import { LoadingSkeleton } from '@/components/ui/state-views';

export default function OrdersLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
      <LoadingSkeleton rows={4} />
    </div>
  );
}
