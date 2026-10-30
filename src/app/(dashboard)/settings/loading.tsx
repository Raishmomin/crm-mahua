import { LoadingSkeleton } from '@/components/ui/state-views';

export default function SettingsLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 bg-slate-200 rounded animate-pulse"></div>
      <LoadingSkeleton rows={8} />
    </div>
  );
}
