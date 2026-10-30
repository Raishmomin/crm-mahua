'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Inbox,
  Building2,
  FlaskConical,
  FileSpreadsheet,
  ShoppingBag,
  CreditCard,
  Package,
  FileText,
  BarChart3,
  Users,
  Settings,
  ShieldCheck,
  Wheat,
} from 'lucide-react';
import { MAIN_NAV, ModuleKey, LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { Profile } from '@/types/database';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Inbox,
  Building2,
  FlaskConical,
  FileSpreadsheet,
  ShoppingBag,
  CreditCard,
  Package,
  FileText,
  BarChart3,
  Users,
  Settings,
  ShieldCheck,
};

export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();

  // Wall 3: Menu shows ONLY held modules
  const heldModules = Array.isArray(profile.modules) ? profile.modules : [];
  const allowedNav = MAIN_NAV.filter((item) => heldModules.includes(item.key));

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col h-screen fixed left-0 top-0 z-30 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-200 gap-3">
        <div className="h-9 w-9 rounded-lg bg-emerald-700 flex items-center justify-center text-white shadow-sm font-bold">
          <Wheat className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-bold text-slate-900 text-sm tracking-tight leading-none">
            {LABELS.appName}
          </h1>
          <span className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">
            Dehydration CRM
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Modules
        </div>
        {allowedNav.map((item) => {
          const Icon = ICON_MAP[item.icon] || LayoutDashboard;
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-emerald-50 text-emerald-800 font-semibold shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-emerald-700' : 'text-slate-400')} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Profile & Org Badge */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 font-bold text-xs uppercase">
            {profile.full_name?.slice(0, 2) || 'US'}
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-semibold text-slate-900 truncate">{profile.full_name}</p>
            <p className="text-[11px] text-slate-500 capitalize">{profile.role}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
