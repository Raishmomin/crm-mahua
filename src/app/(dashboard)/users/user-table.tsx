'use client';

import React, { useState } from 'react';
import { Shield, Check, X, Edit, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ALL_MODULES, ROLE_PRESETS, ModuleKey, UserRole, LABELS } from '@/lib/labels';
import { Profile } from '@/types/database';
import { updateUserPermissionsAction, toggleUserStatusAction } from './actions';

export function UserTable({ users, currentUserId }: { users: Profile[]; currentUserId: string }) {
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('sales');
  const [editModules, setEditModules] = useState<ModuleKey[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEditModal(user: Profile) {
    setSelectedUser(user);
    setEditRole(user.role);
    setEditModules(user.modules || []);
    setError(null);
  }

  function handleRolePresetChange(role: UserRole) {
    setEditRole(role);
    setEditModules(ROLE_PRESETS[role]);
  }

  function toggleModule(modKey: ModuleKey) {
    setEditModules((prev) =>
      prev.includes(modKey) ? prev.filter((k) => k !== modKey) : [...prev, modKey]
    );
  }

  async function handleSave() {
    if (!selectedUser) return;
    setSaving(true);
    setError(null);

    try {
      await updateUserPermissionsAction({
        userId: selectedUser.id,
        role: editRole,
        modules: editModules,
      });
      setSelectedUser(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to update permissions.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(user: Profile) {
    try {
      await toggleUserStatusAction({
        userId: user.id,
        isActive: !user.is_active,
      });
    } catch (err: any) {
      alert(err?.message || 'Failed to toggle status.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm text-slate-700">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 font-semibold">{LABELS.users.colName}</th>
              <th className="px-6 py-3 font-semibold">{LABELS.users.colRole}</th>
              <th className="px-6 py-3 font-semibold">{LABELS.users.colModules}</th>
              <th className="px-6 py-3 font-semibold">{LABELS.users.colStatus}</th>
              <th className="px-6 py-3 font-semibold text-right">{LABELS.common.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-semibold text-slate-900">{user.full_name}</div>
                  <div className="text-xs text-slate-500">{user.email}</div>
                </td>
                <td className="px-6 py-4">
                  <Badge variant="outline" className="capitalize font-semibold text-xs">
                    {user.role}
                  </Badge>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1 max-w-md">
                    {user.modules?.map((m) => (
                      <span
                        key={m}
                        className="inline-block px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-700 rounded border border-slate-200"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Badge variant={user.is_active ? 'success' : 'destructive'} className="text-[11px]">
                    {user.is_active ? LABELS.users.active : LABELS.users.inactive}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1"
                    onClick={() => openEditModal(user)}
                  >
                    <Edit className="h-3 w-3" />
                    {LABELS.users.editModules}
                  </Button>
                  {user.id !== currentUserId && (
                    <Button
                      size="sm"
                      variant={user.is_active ? 'destructive' : 'secondary'}
                      className="h-8 text-xs"
                      onClick={() => handleToggleStatus(user)}
                    >
                      {user.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Permissions Edit Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {LABELS.users.modalTitle}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedUser.full_name} ({selectedUser.email})
                </p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded">
                {error}
              </div>
            )}

            {/* Role Preset Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Preset Role Archetype
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['owner', 'accountant', 'sales', 'operations'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleRolePresetChange(r)}
                    className={`p-2.5 rounded-lg border text-left text-xs capitalize transition-colors ${
                      editRole === r
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Selecting a preset will populate recommended modules, which you can customize below.
              </p>
            </div>

            {/* Granular Module Checkboxes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Granular Module Entitlements ({editModules.length} of {ALL_MODULES.length})
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ALL_MODULES.map((mod) => {
                  const checked = editModules.includes(mod.key);
                  return (
                    <label
                      key={mod.key}
                      onClick={() => toggleModule(mod.key)}
                      className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer select-none text-xs transition-colors ${
                        checked
                          ? 'border-emerald-300 bg-emerald-50/50'
                          : 'border-slate-200 bg-slate-50/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {}}
                        className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div>
                        <div className="font-semibold text-slate-800">{mod.label}</div>
                        <div className="text-[10px] text-slate-500 leading-tight">
                          {mod.description}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" onClick={() => setSelectedUser(null)} disabled={saving}>
                {LABELS.common.cancel}
              </Button>
              <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {LABELS.common.saving}
                  </>
                ) : (
                  LABELS.users.savePermissions
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
