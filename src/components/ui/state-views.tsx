import React from 'react';
import { AlertCircle, Inbox, Loader2 } from 'lucide-react';
import { Button } from './button';
import { LABELS } from '@/lib/labels';

export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4 animate-pulse">
      <div className="h-8 bg-slate-200 rounded w-1/4"></div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-12 bg-slate-100 rounded w-full flex items-center px-4 space-x-4">
            <div className="h-4 bg-slate-200 rounded w-1/6"></div>
            <div className="h-4 bg-slate-200 rounded w-1/3"></div>
            <div className="h-4 bg-slate-200 rounded w-1/4"></div>
            <div className="h-4 bg-slate-200 rounded w-1/12 ml-auto"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  title = LABELS.common.emptyTitle,
  description = LABELS.common.emptyDesc,
  actionLabel,
  onAction,
}: {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg border border-dashed border-slate-300 bg-slate-50/50">
      <div className="rounded-full bg-slate-100 p-3 text-slate-400 mb-3">
        <Inbox className="h-8 w-8" />
      </div>
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 max-w-sm">{description}</p>
      {actionLabel && (
        <Button onClick={onAction} className="mt-4" size="sm">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export function ErrorState({
  title = LABELS.common.errorTitle,
  description = LABELS.common.errorDesc,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg border border-rose-200 bg-rose-50/30">
      <div className="rounded-full bg-rose-100 p-3 text-rose-600 mb-3">
        <AlertCircle className="h-8 w-8" />
      </div>
      <h3 className="text-base font-semibold text-rose-900">{title}</h3>
      <p className="mt-1 text-sm text-rose-600 max-w-sm">{description}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="mt-4 border-rose-300 text-rose-800 hover:bg-rose-100" size="sm">
          {LABELS.common.retry}
        </Button>
      )}
    </div>
  );
}
