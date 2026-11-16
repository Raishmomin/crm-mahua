import type { ColourRole } from '@/lib/status';

/** Tailwind classes per colour role. Plain module (no 'use client') so server components such as KpiTile can read it. */
export const ROLE_CLASSES: Record<ColourRole, { soft: string; solid: string; icon: string }> = {
  green: { soft: 'bg-emerald-100 text-emerald-800 border-emerald-300', solid: 'bg-emerald-700 text-white', icon: 'text-emerald-700' },
  amber: { soft: 'bg-amber-100 text-amber-900 border-amber-300', solid: 'bg-amber-500 text-slate-900', icon: 'text-amber-700' },
  red: { soft: 'bg-rose-100 text-rose-800 border-rose-300', solid: 'bg-rose-600 text-white', icon: 'text-rose-700' },
  blue: { soft: 'bg-sky-100 text-sky-900 border-sky-300', solid: 'bg-sky-700 text-white', icon: 'text-sky-700' },
  grey: { soft: 'bg-slate-100 text-slate-700 border-slate-300', solid: 'bg-slate-500 text-white', icon: 'text-slate-500' },
};
