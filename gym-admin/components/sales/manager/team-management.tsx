'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Pencil, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Avatar, Badge, Button, DataTable, EmptyState, Field, Modal, Select,
  type DataTableColumn,
} from '@/components/ui';
import type { SalesContext, TeamMember } from '@/lib/sales-types';
import { branchName, errMsg, salesGet, salesPatch } from './lib';

interface Props {
  context: SalesContext;
  team: TeamMember[];
}

interface EditState {
  member: TeamMember;
  sales_role: 'rep' | 'manager';
  branch_id: string;
  manager_branch_ids: string[];
}

export default function TeamManagement({ context, team: initialTeam }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [team, setTeam] = useState<TeamMember[]>(initialTeam ?? []);
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await salesGet<TeamMember[]>('team');
      setTeam(res.data ?? []);
    } catch {
      /* keep the current roster on refresh failure */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { setTeam(initialTeam ?? []); }, [initialTeam]);

  const openEdit = (m: TeamMember) =>
    setEdit({
      member: m,
      // Admins aren't editable here (no edit button is rendered for them);
      // this fallback just keeps the editable state within its 'rep'|'manager'
      // domain for the type system.
      sales_role: m.sales_role === 'manager' ? 'manager' : 'rep',
      branch_id: m.branch_id != null ? String(m.branch_id) : '',
      manager_branch_ids: (m.manager_branch_ids ?? []).map(String),
    });

  const save = async () => {
    if (!edit) return;
    const { member } = edit;
    const promoting = member.sales_role !== 'manager' && edit.sales_role === 'manager';
    if (promoting && !context.is_admin) {
      toast.error('Only admins can promote to manager');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (edit.sales_role !== member.sales_role) body.sales_role = edit.sales_role;
      if (edit.sales_role === 'rep') {
        body.branch_id = edit.branch_id || null;
      } else {
        body.manager_branch_ids = edit.manager_branch_ids;
      }
      await salesPatch(`team/${member.staff_id}`, body);
      toast.success(`${member.full_name} updated`);
      setEdit(null);
      refetch();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const goReassign = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', 'assign');
    router.push(`${pathname}?${params.toString()}`);
  };

  const columns: DataTableColumn<TeamMember>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (m) => (
        <div className="flex items-center gap-3">
          <Avatar name={m.full_name} size={32} />
          <span className="text-fg font-medium">{m.full_name}</span>
        </div>
      ),
    },
    { key: 'email', header: 'Email', hideOnMobile: true, cell: (m) => <span className="text-fg-muted">{m.email}</span> },
    {
      key: 'role',
      header: 'Role',
      cell: (m) => (
        <Badge
          variant={m.sales_role === 'admin' ? 'warning' : m.sales_role === 'manager' ? 'brand' : 'neutral'}
          size="sm"
        >
          {m.sales_role === 'admin' ? 'Admin' : m.sales_role === 'manager' ? 'Manager' : 'Rep'}
        </Badge>
      ),
    },
    {
      key: 'branches',
      header: 'Branch(es)',
      cell: (m) =>
        m.sales_role === 'admin' ? (
          <span className="text-fg-muted">All branches</span>
        ) : m.sales_role === 'manager' ? (
          <span className="text-fg-muted">
            {(m.manager_branch_ids ?? []).length === 0
              ? '—'
              : (m.manager_branch_ids ?? [])
                  .map((id) => branchName(context.branches, id))
                  .join(', ')}
          </span>
        ) : (
          <span className="text-fg-muted">{branchName(context.branches, m.branch_id)}</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 60,
      // Gym admins have full sales access by virtue of their role — it's not
      // a designation you edit here, so the row is read-only.
      cell: (m) => (
        m.sales_role === 'admin' ? null : (
          <button
            onClick={() => openEdit(m)}
            className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors"
            title={`Edit ${m.full_name}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )
      ),
    },
  ];

  const toggleManagerBranch = (id: string) =>
    setEdit((e) => {
      if (!e) return e;
      const has = e.manager_branch_ids.includes(id);
      return {
        ...e,
        manager_branch_ids: has
          ? e.manager_branch_ids.filter((x) => x !== id)
          : [...e.manager_branch_ids, id],
      };
    });

  return (
    <div className="space-y-3">
      <DataTable
        columns={columns}
        rows={team}
        rowKey={(m) => String(m.staff_id)}
        loading={loading}
        empty={
          <EmptyState
            icon={Users}
            title="No sales team yet"
            description="Give staff members a sales role in the Staff tab, then configure them here."
          />
        }
      />

      <p className="text-xs text-fg-muted">
        Staff accounts, passwords and deactivation are managed in the Staff tab.
        Handing a departing rep&apos;s leads to a teammate lives in the{' '}
        <button onClick={goReassign} className="text-brand hover:underline">
          assignment queue&apos;s Reassign tab
        </button>.
      </p>

      {edit && (
        <Modal open onClose={() => setEdit(null)} size="sm">
          <Modal.Header>Edit {edit.member.full_name}</Modal.Header>
          <Modal.Body>
            <div className="space-y-4">
              <Field
                label="Sales role"
                hint={!context.is_admin ? 'Promoting to manager requires an admin.' : undefined}
              >
                <Select
                  value={edit.sales_role}
                  onChange={(e) =>
                    setEdit((s) => (s ? { ...s, sales_role: e.target.value as 'rep' | 'manager' } : s))}
                >
                  <option value="rep">Rep</option>
                  <option
                    value="manager"
                    disabled={!context.is_admin && edit.member.sales_role !== 'manager'}
                  >
                    Manager
                  </option>
                </Select>
              </Field>

              {edit.sales_role === 'rep' ? (
                <Field label="Branch">
                  <Select
                    value={edit.branch_id}
                    onChange={(e) => setEdit((s) => (s ? { ...s, branch_id: e.target.value } : s))}
                  >
                    <option value="">No branch</option>
                    {(context.branches ?? []).map((b) => (
                      <option key={String(b.id)} value={String(b.id)}>{b.name}</option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <div>
                  <p className="text-sm font-medium text-fg mb-2">Manages branches</p>
                  <div className="space-y-2">
                    {(context.branches ?? []).map((b) => (
                      <label key={String(b.id)} className="flex items-center gap-2.5 text-sm text-fg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={edit.manager_branch_ids.includes(String(b.id))}
                          onChange={() => toggleManagerBranch(String(b.id))}
                          className="w-4 h-4 rounded border-line-strong bg-surface-2 cursor-pointer"
                        />
                        {b.name}
                      </label>
                    ))}
                    {(context.branches ?? []).length === 0 && (
                      <p className="text-xs text-fg-muted">No branches configured.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" fullWidth onClick={() => setEdit(null)}>Cancel</Button>
            <Button variant="primary" fullWidth isLoading={saving} onClick={save}>Save</Button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  );
}
