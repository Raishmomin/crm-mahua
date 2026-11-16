'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, Check, Crown, Phone, ShoppingBag, type LucideIcon } from 'lucide-react';
import { ALL_MODULES, ROLE_PRESETS, USER_ROLES, type ModuleKey, type UserRole } from '@/lib/labels';
import type { Profile } from '@/types/database';
import { cn } from '@/lib/utils';
import { roleWord } from '@/lib/i18n';
import { ListCard, ListStack } from '@/components/ui/list-card';
import { Status } from '@/components/ui/status-badge';
import { ChoiceChips } from '@/components/ui/choice-chips';
import { MoreFields } from '@/components/ui/more-fields';
import { Button, buttonVariants } from '@/components/ui/button';
import { Toast, useToast } from '@/components/ui/toast';
import { useLang, useT } from '@/components/shell/lang-provider';
import { updateUserPermissionsAction, toggleUserStatusAction, type ActionResult } from './actions';

const ROLE_ICONS: Record<UserRole, LucideIcon> = { owner: Crown, accountant: BookOpen, sales: Phone, operations: ShoppingBag };
/** The 10 modules with a screen; documents / reports / audit stay in the DB but are never listed. */
const SHOWN_MODULES = ALL_MODULES.filter((m) => m.shown);

function sameSet(a: ModuleKey[], b: ModuleKey[]): boolean {
  return a.length === b.length && a.every((k) => b.includes(k));
}

/** Staff list (ListCards) + change-access sheet: 4 job buttons, login on/off, "Change details" tick list. */
export function UserTable({ users, currentUserId }: { users: Profile[]; currentUserId: string }) {
  const lang = useLang();
  const tt = useT();
  const router = useRouter();
  const { toast, show, clear } = useToast();

  const [selected, setSelected] = React.useState<Profile | null>(null);
  const [role, setRole] = React.useState<UserRole>('sales');
  const [modules, setModules] = React.useState<ModuleKey[]>([]);
  const [active, setActive] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const isSelf = selected?.id === currentUserId;

  function openSheet(user: Profile) {
    setSelected(user);
    setRole(user.role);
    setModules(Array.isArray(user.modules) ? user.modules : []);
    setActive(user.is_active);
  }

  const closeSheet = React.useCallback(() => setSelected(null), []);

  React.useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSheet();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, closeSheet]);

  function pickJob(next: UserRole) {
    setRole(next);
    setModules(ROLE_PRESETS[next]);
  }

  function toggleModule(key: ModuleKey) {
    setModules((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function save() {
    if (!selected || isSelf) return;
    setSaving(true);
    const current = Array.isArray(selected.modules) ? selected.modules : [];
    const accessChanged = role !== selected.role || !sameSet(modules, current);
    const loginChanged = active !== selected.is_active;

    let result: ActionResult = { ok: true };
    if (accessChanged) result = await updateUserPermissionsAction({ userId: selected.id, role, modules });
    if (result.ok && loginChanged) result = await toggleUserStatusAction({ userId: selected.id, isActive: active });
    setSaving(false);

    if (!result.ok) {
      show('error', tt(result.messageKey));
      return;
    }
    show('success', tt('msg.saved'));
    setSelected(null);
    router.refresh();
  }

  const shownCount = (mods: ModuleKey[]) => mods.filter((k) => SHOWN_MODULES.some((m) => m.key === k)).length;

  return (
    <>
      <ListStack>
        {users.map((u) => (
          <ListCard
            key={u.id}
            onClick={() => openSheet(u)}
            title={u.full_name}
            fact1={roleWord(lang, u.role)}
            fact2={tt('field.staff.can_see', { n: shownCount(Array.isArray(u.modules) ? u.modules : []) })}
            badge={<Status domain="staff" code={u.is_active} />}
          />
        ))}
      </ListStack>

      {selected && (
        <div className="fixed inset-0 z-40 bg-white md:bg-slate-900/40" role="dialog" aria-modal="true" aria-labelledby="staff-sheet-title">
          <button type="button" aria-label={tt('btn.close')} className="absolute inset-0 hidden md:block" onClick={closeSheet} />
          <div className="relative flex h-full flex-col bg-white md:ml-auto md:w-[480px] md:shadow-xl">
            <div className="flex items-center gap-2 border-b border-slate-200 px-2 py-2">
              <button type="button" onClick={closeSheet} aria-label={tt('btn.back')} className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
                <ArrowLeft aria-hidden="true" />
              </button>
              <div className="min-w-0 flex-1">
                <h2 id="staff-sheet-title" className="truncate text-xl font-bold text-slate-900">
                  {selected.full_name}
                </h2>
                <p className="truncate text-sm text-slate-500">{selected.email}</p>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
              {isSelf && (
                <p role="note" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-base text-amber-900">
                  {tt('msg.err.self_change')}
                </p>
              )}

              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-700">{tt('section.job')}</h3>
                <ChoiceChips<UserRole>
                  grid
                  size="lg"
                  ariaLabel={tt('field.staff.job')}
                  value={role}
                  onChange={pickJob}
                  disabled={isSelf || saving}
                  options={USER_ROLES.map((r) => ({ value: r, label: roleWord(lang, r), icon: ROLE_ICONS[r] }))}
                />
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-700">{tt('field.staff.login')}</h3>
                <ChoiceChips<'on' | 'off'>
                  ariaLabel={tt('field.staff.login')}
                  value={active ? 'on' : 'off'}
                  onChange={(v) => setActive(v === 'on')}
                  disabled={isSelf || saving}
                  options={[
                    { value: 'on', label: tt('status.staff.true') },
                    { value: 'off', label: tt('status.staff.false') },
                  ]}
                />
              </section>

              <MoreFields moreLabel={tt('btn.change_details')} lessLabel={tt('btn.less')}>
                <h3 className="text-sm font-semibold text-slate-700">{tt('section.can_see')}</h3>
                <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200">
                  {SHOWN_MODULES.map((m) => {
                    const checked = modules.includes(m.key);
                    return (
                      <li key={m.key}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={checked}
                          disabled={isSelf || saving}
                          onClick={() => toggleModule(m.key)}
                          className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 disabled:opacity-50"
                        >
                          <span
                            className={cn(
                              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
                              checked ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-300 bg-white'
                            )}
                            aria-hidden="true"
                          >
                            {checked && <Check className="h-5 w-5" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-base font-medium text-slate-900">{tt(m.labelKey)}</span>
                            <span className="block text-sm text-slate-500">{tt(m.descriptionKey)}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </MoreFields>
            </div>

            <div className="border-t border-slate-200 bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <Button fullWidth onClick={save} loading={saving} loadingLabel={tt('btn.saving')} disabled={isSelf}>
                {tt('btn.save')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onClose={clear} />
    </>
  );
}
