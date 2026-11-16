import React from 'react';
import Link from 'next/link';
import { CheckCircle2, Factory, FileText, Inbox, IndianRupee, Plus } from 'lucide-react';
import { hasModule, requireModule } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import type { ModuleKey } from '@/lib/labels';
import { isMissingObjectError } from '@/lib/db-errors';
import { kpiRole, moneyKpiRole } from '@/lib/status';
import { firstName, formatDate, formatMoney } from '@/lib/utils';
import { EMPTY_KPIS, type FollowupEntityType, type FollowupTodayRow, type HomeKpis, type OrderInProductionRow } from '@/types/home';
import { KpiGrid, KpiTile } from '@/components/ui/kpi-tile';
import { buttonVariants } from '@/components/ui/button';
import { TodoList, type TodoItem } from '@/components/home/todo-list';
import { PackingToday } from '@/components/home/packing-today';
import { followUpDoneAction } from './home-actions';

type Supabase = ReturnType<typeof createClient>;
type Kpis = Omit<HomeKpis, 'org_id'>;

const HOME_LIMIT = 5;
const ENTITY_MODULE: Record<FollowupEntityType, ModuleKey> = {
  inquiry: 'leads',
  buyer: 'buyers',
  quote: 'quotes',
  order: 'orders',
  payment: 'payments',
};
/** Links per contracts.md 5.2: order and payment rows open the order. */
const ENTITY_PATH: Record<FollowupEntityType, string> = {
  inquiry: '/inquiries',
  buyer: '/buyers',
  quote: '/quotes',
  order: '/orders',
  payment: '/orders',
};

export default async function HomePage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const profile = await requireModule('dashboard'); // Wall 2 (contracts 6.1)
  const lang = getLang();
  const supabase = createClient();
  const showAll = searchParams?.todo === 'all';

  const has = (key: ModuleKey) => hasModule(profile, key);
  // Plant variant: none of leads / quotes / payments.
  const isPlant = !has('leads') && !has('quotes') && !has('payments');

  const [kpis, followups, packing] = await Promise.all([
    loadKpis(supabase),
    loadFollowups(supabase),
    isPlant ? loadPacking(supabase) : Promise.resolve([] as OrderInProductionRow[]),
  ]);

  // Rows only for entity types whose module the user holds.
  const todos = followups.filter((r) => {
    const mod = ENTITY_MODULE[r.entity_type];
    return mod ? has(mod) : false;
  });
  const visible = showAll ? todos : todos.slice(0, HOME_LIMIT);
  const todoItems: TodoItem[] = visible.map((r) => ({
    id: r.id,
    title: r.buyer_name || r.inquiry_code || t(lang, 'common.not_set'),
    note: r.note,
    fact: [r.inquiry_code, r.due_on ? t(lang, 'common.due_on', { date: formatDate(r.due_on) }) : null].filter(Boolean).join(' · '),
    daysLate: Number(r.days_late ?? 0),
    phone: r.phone,
    href: r.entity_type === 'payment' && !has('orders') ? null : `${ENTITY_PATH[r.entity_type]}/${r.entity_id}`,
  }));

  const inr = kpis.money_due_inr;
  const usd = kpis.money_due_usd;
  const paid = inr <= 0 && usd <= 0;
  // screens.md 2: INR line + USD line, then "about ₹ total" at the settings USD rate (v_home_kpis.money_due_about_inr).
  const aboutInr =
    usd > 0 && kpis.money_due_about_inr > 0
      ? t(lang, 'kpi.about_inr', { amount: new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(kpis.money_due_about_inr)) })
      : null;
  const moneySecondary = [
    usd > 0 ? `+ ${formatMoney(usd, 'USD')}` : null,
    aboutInr,
    kpis.money_overdue_count > 0 ? `${kpis.money_overdue_count} ${t(lang, 'kpi.money_overdue')}` : null,
    paid ? t(lang, 'status.money.paid') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const QUICK: { key: ModuleKey; href: string; labelKey: string; icon: typeof Plus }[] = [
    { key: 'leads', href: '/inquiries/new', labelKey: 'btn.new_inquiry', icon: Plus },
    { key: 'quotes', href: '/quotes/new', labelKey: 'btn.new_quote', icon: Plus },
    { key: 'payments', href: '/payments/new', labelKey: 'btn.money_received', icon: IndianRupee },
  ];
  const quick = QUICK.filter((q) => has(q.key));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">{t(lang, 'home.greeting', { name: firstName(profile.full_name) })}</h1>
        <p className="shrink-0 pt-0.5 text-base text-slate-500">{formatDate(new Date())}</p>
      </div>

      <KpiGrid>
        {!isPlant && has('leads') && (
          <KpiTile
            href="/inquiries?status=new"
            word={t(lang, 'kpi.new_inquiries')}
            value={String(kpis.new_inquiries)}
            role={kpiRole('count_blue', kpis.new_inquiries)}
            icon={Inbox}
          />
        )}
        {!isPlant && has('quotes') && (
          <KpiTile
            href="/quotes?status=sent"
            word={t(lang, 'kpi.quotes_waiting')}
            value={String(kpis.quotes_waiting)}
            role={kpiRole('count_amber', kpis.quotes_waiting)}
            icon={FileText}
          />
        )}
        {has('orders') && (
          <KpiTile
            href="/orders?status=open"
            word={t(lang, 'kpi.orders_in_production')}
            value={String(kpis.orders_in_production)}
            role={kpiRole('count_blue', kpis.orders_in_production)}
            icon={Factory}
          />
        )}
        {!isPlant && has('payments') && (
          <KpiTile
            href="/payments?filter=due"
            word={t(lang, 'kpi.money_due')}
            value={formatMoney(inr, 'INR')}
            secondary={moneySecondary || undefined}
            role={moneyKpiRole(inr, usd, kpis.money_overdue_count)}
            icon={paid ? CheckCircle2 : IndianRupee}
          />
        )}
      </KpiGrid>

      <div className="gap-6 md:grid md:grid-cols-3">
        <section className="space-y-3 md:col-span-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            {t(lang, 'kpi.todo_today')}
            {todos.length > 0 && (
              <span className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-full bg-amber-100 px-2 text-sm font-semibold text-amber-900">
                {todos.length}
              </span>
            )}
          </h2>
          <TodoList items={todoItems} total={todos.length} showAll={showAll} onDone={followUpDoneAction} />
        </section>

        <section className="mt-6 space-y-3 md:mt-0">
          {isPlant ? (
            <>
              <h2 className="text-lg font-semibold text-slate-900">{t(lang, 'kpi.packing_today')}</h2>
              <PackingToday rows={packing} lang={lang} />
            </>
          ) : (
            quick.length > 0 && (
              <>
                <h2 className="text-lg font-semibold text-slate-900">{t(lang, 'home.quick_actions')}</h2>
                <div className="space-y-3">
                  {quick.map((q, i) => {
                    const Icon = q.icon;
                    return (
                      <Link
                        key={q.key}
                        href={q.href}
                        className={buttonVariants({ variant: i === 0 ? 'default' : 'outline', size: 'lg', fullWidth: true })}
                      >
                        <Icon aria-hidden="true" />
                        {t(lang, q.labelKey)}
                      </Link>
                    );
                  })}
                </div>
              </>
            )
          )}
        </section>
      </div>
    </div>
  );
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function logUnlessMissing(where: string, error: { code?: string; message?: string } | null) {
  if (error && !isMissingObjectError(error)) console.error(`[home] ${where}:`, error.code, error.message);
}

/** One row from v_home_kpis; zeros when the view is missing (before 0006) or on any error. */
async function loadKpis(supabase: Supabase): Promise<Kpis> {
  try {
    const { data, error } = await supabase.from('v_home_kpis').select('*').maybeSingle();
    logUnlessMissing('v_home_kpis', error);
    if (error || !data) return EMPTY_KPIS;
    const d = data as Partial<HomeKpis>;
    return {
      new_inquiries: num(d.new_inquiries),
      quotes_waiting: num(d.quotes_waiting),
      orders_in_production: num(d.orders_in_production),
      money_due_inr: num(d.money_due_inr),
      money_due_usd: num(d.money_due_usd),
      money_due_about_inr: num(d.money_due_about_inr),
      money_overdue_count: num(d.money_overdue_count),
      followups_today: num(d.followups_today),
      papers_pending: num(d.papers_pending),
    };
  } catch {
    return EMPTY_KPIS;
  }
}

/** v_followups_today (0004): overdue first, then today. Empty list when the view is missing. */
async function loadFollowups(supabase: Supabase): Promise<FollowupTodayRow[]> {
  try {
    const { data, error } = await supabase
      .from('v_followups_today')
      .select('*')
      .order('due_on', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(100);
    logUnlessMissing('v_followups_today', error);
    if (error || !data) return [];
    return data as FollowupTodayRow[];
  } catch {
    return [];
  }
}

/** v_orders_in_production (0006) for the Plant "Packing today" list. */
async function loadPacking(supabase: Supabase): Promise<OrderInProductionRow[]> {
  try {
    const { data, error } = await supabase
      .from('v_orders_in_production')
      .select('*')
      .order('expected_dispatch', { ascending: true, nullsFirst: false })
      .limit(50);
    logUnlessMissing('v_orders_in_production', error);
    if (error || !data) return [];
    return data as OrderInProductionRow[];
  } catch {
    return [];
  }
}

export const dynamic = 'force-dynamic';
