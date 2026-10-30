import React from 'react';
import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ALL_MODULES } from '@/lib/labels';
import { ArrowRight, CheckCircle2, Factory, ShieldCheck, Users, Settings as SettingsIcon } from 'lucide-react';

export default async function HomePage() {
  const profile = await requireAuth();
  const supabase = createClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', profile.org_id)
    .single();

  const { data: business } = await supabase
    .from('business_settings')
    .select('*')
    .eq('org_id', profile.org_id)
    .single();

  const userModules = new Set(profile.modules || []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Welcome Banner */}
      <div className="bg-emerald-900 text-white rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              Active Tenant
            </span>
            <Badge variant="outline" className="border-emerald-600 text-emerald-200 text-[10px]">
              {org?.code || 'MDPL'}
            </Badge>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            {business?.trade_name || business?.company_name || org?.name || 'Mahuva Processing Facility'}
          </h2>
          <p className="text-xs text-emerald-200 mt-1 max-w-xl">
            Welcome back, {profile.full_name} ({profile.role}). Multi-tenant database RLS and 3-wall module permissions are enforced.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {profile.modules.includes('users') && (
            <Link href="/users">
              <Button size="sm" variant="secondary" className="gap-1.5 text-xs">
                <Users className="h-4 w-4" />
                Manage Users
              </Button>
            </Link>
          )}
          {profile.modules.includes('settings') && (
            <Link href="/settings">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs bg-emerald-800 text-white border-emerald-700 hover:bg-emerald-700">
                <SettingsIcon className="h-4 w-4" />
                Settings
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Tenant Operational Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Database Engine</CardDescription>
            <CardTitle className="text-base flex items-center gap-2 text-emerald-800">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Postgres RLS Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">
              Tenant ID: <span className="font-mono text-[11px] text-slate-700">{profile.org_id.slice(0, 8)}...</span>
            </p>
            <div className="mt-2 text-xs text-slate-600 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Isolated by <code className="text-emerald-700">fn_current_org()</code>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Access Entitlements</CardDescription>
            <CardTitle className="text-base flex items-center gap-2 text-slate-800">
              <Users className="h-4 w-4 text-blue-600" />
              {profile.modules.length} of 13 Modules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">
              Role Preset: <span className="font-semibold text-slate-800 capitalize">{profile.role}</span>
            </p>
            <div className="mt-2 text-xs text-slate-600 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Cost Data Protected (Rule 5)
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Factory Identity</CardDescription>
            <CardTitle className="text-base flex items-center gap-2 text-slate-800">
              <Factory className="h-4 w-4 text-amber-600" />
              {business?.city || 'Mahuva'}, {business?.state || 'Gujarat'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">
              GSTIN: <span className="font-mono text-[11px] text-slate-800">{business?.gstin || 'Not configured'}</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              IEC: <span className="font-mono text-[11px] text-slate-800">{business?.iec_code || 'Export Ready'}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Available Modules Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">System Module Registry (Phase 1)</CardTitle>
          <CardDescription className="text-xs">
            Module-based permissions assigned to your user account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {ALL_MODULES.map((mod) => {
              const hasAccess = userModules.has(mod.key);
              return (
                <div
                  key={mod.key}
                  className={`p-3 rounded-lg border text-xs flex flex-col justify-between transition-colors ${
                    hasAccess
                      ? 'border-emerald-200 bg-emerald-50/30'
                      : 'border-slate-200 bg-slate-50/50 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{mod.label}</span>
                    <Badge variant={hasAccess ? 'success' : 'outline'} className="text-[10px]">
                      {hasAccess ? 'Granted' : 'Locked'}
                    </Badge>
                  </div>
                  <p className="text-slate-500 text-[11px] mt-1">{mod.description}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
