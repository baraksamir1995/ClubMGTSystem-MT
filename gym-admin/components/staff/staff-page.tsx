'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, ShieldCheck, ClipboardList, Plus, Edit2, UserX, UserCheck,
  Trash2, RefreshCw, Download, Search, X, Check, ChevronRight,
  AlertTriangle, Activity, Filter, KeyRound, Copy, LayoutDashboard,
  UserCheck2, UserX2, Shield,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { can, type Permission } from '@/lib/get-permissions';

/* ─── Constants ─────────────────────────────────────────────────────── */
const MODULES = [
  { key: 'overview',      label: 'Overview (Dashboard)' },
  { key: 'members',       label: 'Members' },
  { key: 'plans',         label: 'Subscription Plans' },
  { key: 'payments',      label: 'Payments' },
  { key: 'classes',       label: 'Classes & Schedule' },
  { key: 'trainers',      label: 'Trainers' },
  { key: 'promotions',    label: 'Promotions & Discounts' },
  { key: 'attendance',    label: 'Attendance & Access' },
  { key: 'content',       label: 'Content' },
  { key: 'notifications', label: 'Communications' },
  { key: 'analytics',     label: 'Analytics' },
  { key: 'settings',      label: 'Settings' },
  { key: 'staff',         label: 'Staff & Roles' },
];
const ACTIONS = ['view', 'create', 'edit', 'delete'] as const;
const ACTION_LABELS: Record<string, string> = { view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete' };

type ActionKey = typeof ACTIONS[number];
type PermSet = Record<string, Set<ActionKey>>;

interface StaffMember {
  id: string; full_name: string; email: string; phone?: string;
  status: 'active' | 'inactive'; created_at: string;
  roles: { id: string; name: string }[];
}
interface StaffRole {
  id: string; name: string; description?: string | null;
  permissions: { module: string; action: string }[];
  memberCount: number;
}
interface ActivityLog {
  id: string; staff_name: string; action_type: string;
  module?: string; description?: string; created_at: string;
}
interface OverviewData {
  totalStaff: number; activeStaff: number; inactiveStaff: number;
  totalRoles: number;
  recentActivity: ActivityLog[];
  roleBreakdown: { id: string; name: string; memberCount: number }[];
}

/* ─── helpers ────────────────────────────────────────────────────────── */
function initPerms(permissions: { module: string; action: string }[]): PermSet {
  const ps: PermSet = {};
  MODULES.forEach(m => { ps[m.key] = new Set(); });
  permissions.forEach(p => { ps[p.module]?.add(p.action as ActionKey); });
  return ps;
}
function permsToArray(ps: PermSet) {
  const out: { module: string; action: string }[] = [];
  Object.entries(ps).forEach(([mod, acts]) => acts.forEach(a => out.push({ module: mod, action: a })));
  return out;
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function actionColor(t: string) {
  if (t === 'create' || t === 'reactivate') return 'text-emerald-400';
  if (t === 'delete' || t === 'deactivate') return 'text-red-400';
  if (t === 'update') return 'text-blue-400';
  return 'text-fg-muted';
}

/* ─── Component ──────────────────────────────────────────────────────── */
interface PageProps {
  permissions: Permission[] | null;
  initialStaff: StaffMember[];
  initialRoles: StaffRole[];
  initialOverview: OverviewData;
}

export default function StaffPage({ permissions, initialStaff, initialRoles, initialOverview }: PageProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'accounts' | 'roles' | 'activity'>('overview');

  /* staff */
  const [staff,       setStaff]       = useState<StaffMember[]>(initialStaff);
  const [staffLoad,   setStaffLoad]   = useState(false);
  /* roles */
  const [roles,       setRoles]       = useState<StaffRole[]>(initialRoles);
  const [rolesLoad,   setRolesLoad]   = useState(false);
  const [selectedRole, setSelectedRole] = useState<StaffRole | null>(initialRoles[0] ?? null);
  /* overview */
  const [overview,     setOverview]    = useState<OverviewData | null>(initialOverview);
  const [overviewLoad, setOverviewLoad] = useState(false);
  /* activity */
  const [logs,        setLogs]        = useState<ActivityLog[]>([]);
  const [logsLoad,    setLogsLoad]    = useState(false);
  const [logFilter,   setLogFilter]   = useState({ staff_name: '', from: '', to: '', action_type: '' });
  const [logPage,     setLogPage]     = useState(1);
  const [logPages,    setLogPages]    = useState(1);
  const [logTotal,    setLogTotal]    = useState(0);

  /* modals */
  const [staffModal, setStaffModal]       = useState<{ open: boolean; editing: StaffMember | null }>({ open: false, editing: null });
  const [roleModal,  setRoleModal]        = useState<{ open: boolean; editing: StaffRole | null }>({ open: false, editing: null });
  const [confirmDeactivate, setConfirmDeactivate] = useState<StaffMember | null>(null);

  /* staff form state */
  const [sf, setSf] = useState({ full_name: '', email: '', phone: '', role_ids: [] as string[] });
  /* role form state */
  const [rf, setRf] = useState({ name: '', description: '' });
  const [rfPerms, setRfPerms] = useState<PermSet>(() => initPerms([]));
  /* temp password after staff creation / reset */
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);
  const [resetPwResult, setResetPwResult] = useState<{ staffId: string; password: string } | null>(null);

  /* ── fetch (used for refresh after mutations) ──────────────── */
  const fetchOverview = useCallback(async () => {
    setOverviewLoad(true);
    const res = await fetch('/api/staff/overview');
    if (res.ok) setOverview(await res.json());
    setOverviewLoad(false);
  }, []);

  const fetchStaff = useCallback(async () => {
    setStaffLoad(true);
    const res = await fetch('/api/staff');
    if (res.ok) setStaff(await res.json());
    setStaffLoad(false);
  }, []);

  const fetchRoles = useCallback(async () => {
    setRolesLoad(true);
    const res = await fetch('/api/staff/roles');
    if (res.ok) {
      const data = await res.json();
      setRoles(data);
      setSelectedRole(prev => {
        if (!prev) return data[0] ?? null;
        return data.find((r: StaffRole) => r.id === prev.id) ?? data[0] ?? null;
      });
    }
    setRolesLoad(false);
  }, []);

  const fetchLogs = useCallback(async (page = 1) => {
    setLogsLoad(true);
    const p = new URLSearchParams();
    if (logFilter.staff_name)  p.set('staff_name', logFilter.staff_name);
    if (logFilter.from)        p.set('from', logFilter.from);
    if (logFilter.to)          p.set('to', logFilter.to);
    if (logFilter.action_type) p.set('action_type', logFilter.action_type);
    p.set('page', String(page));
    p.set('limit', '15');
    const res = await fetch(`/api/staff/activity?${p}`);
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs);
      setLogPage(data.pagination.page);
      setLogPages(data.pagination.pages);
      setLogTotal(data.pagination.total);
    }
    setLogsLoad(false);
  }, [logFilter]);

  // Only fetch activity logs lazily when the tab is opened
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (activeTab === 'activity') fetchLogs(); }, [activeTab]);

  // Refresh overview + activity after any mutation
  const invalidateActivity = useCallback(() => {
    fetchOverview();
    if (activeTab === 'activity') fetchLogs(logPage);
  }, [fetchOverview, fetchLogs, activeTab, logPage]);

  /* ── staff modal helpers ──────────────────────────────────── */
  const openAddStaff = () => {
    setSf({ full_name: '', email: '', phone: '', role_ids: [] });
    setCreatedCreds(null);
    setStaffModal({ open: true, editing: null });
  };
  const openEditStaff = (s: StaffMember) => {
    setSf({ full_name: s.full_name, email: s.email, phone: s.phone ?? '', role_ids: s.roles.map(r => r.id) });
    setStaffModal({ open: true, editing: s });
  };
  const saveStaff = async () => {
    if (!sf.full_name.trim() || !sf.email.trim()) { toast.error('Name and email required'); return; }
    const editing = staffModal.editing;
    const url  = editing ? `/api/staff/${editing.id}` : '/api/staff';
    const method = editing ? 'PATCH' : 'POST';
    const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sf) });
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Error'); return; }
    if (editing) {
      toast.success('Staff updated');
      setStaffModal({ open: false, editing: null });
      fetchStaff();
      invalidateActivity();
    } else {
      const d = await res.json();
      setCreatedCreds({ email: sf.email.trim(), password: d.tempPassword });
      fetchStaff();
      invalidateActivity();
    }
  };

  const resetStaffPassword = async (staffId: string) => {
    const res = await fetch(`/api/staff/${staffId}/reset-password`, { method: 'POST' });
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? 'Failed to reset password'); return; }
    const d = await res.json();
    setResetPwResult({ staffId, password: d.tempPassword });
  };

  /* ── toggle status ──────────────────────────────────────── */
  const toggleStatus = async (s: StaffMember) => {
    const newStatus = s.status === 'active' ? 'inactive' : 'active';
    const res = await fetch(`/api/staff/${s.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) { toast.error('Failed to update status'); return; }
    toast.success(newStatus === 'active' ? 'Account reactivated' : 'Account deactivated');
    setConfirmDeactivate(null);
    fetchStaff();
    invalidateActivity();
  };

  /* ── role modal helpers ──────────────────────────────────── */
  const openAddRole = () => {
    setRf({ name: '', description: '' });
    setRfPerms(initPerms([]));
    setRoleModal({ open: true, editing: null });
  };
  const openEditRole = (r: StaffRole) => {
    setRf({ name: r.name, description: r.description ?? '' });
    setRfPerms(initPerms(r.permissions));
    setRoleModal({ open: true, editing: r });
  };
  const togglePerm = (mod: string, action: ActionKey) => {
    setRfPerms(prev => {
      const next = { ...prev, [mod]: new Set(prev[mod]) };
      if (next[mod].has(action)) next[mod].delete(action); else next[mod].add(action);
      return next;
    });
  };
  const toggleModule = (mod: string, allChecked: boolean) => {
    setRfPerms(prev => ({
      ...prev,
      [mod]: allChecked ? new Set<ActionKey>() : new Set<ActionKey>(ACTIONS),
    }));
  };
  const saveRole = async () => {
    if (!rf.name.trim()) { toast.error('Role name required'); return; }
    const editing = roleModal.editing;
    const url = editing ? `/api/staff/roles/${editing.id}` : '/api/staff/roles';
    const method = editing ? 'PATCH' : 'POST';
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...rf, permissions: permsToArray(rfPerms) }),
    });
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Error'); return; }
    toast.success(editing ? 'Role updated' : 'Role created');
    setRoleModal({ open: false, editing: null });
    fetchRoles();
    invalidateActivity();
  };
  const deleteRole = async (r: StaffRole) => {
    if (!confirm(`Delete role "${r.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/staff/roles/${r.id}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Error'); return; }
    toast.success('Role deleted');
    invalidateActivity();
    fetchRoles();
  };

  /* ── export logs ─────────────────────────────────────────── */
  const exportLogs = async () => {
    // Fetch ALL matching logs (up to 10 000) for CSV export regardless of current page
    const p = new URLSearchParams();
    if (logFilter.staff_name)  p.set('staff_name', logFilter.staff_name);
    if (logFilter.from)        p.set('from', logFilter.from);
    if (logFilter.to)          p.set('to', logFilter.to);
    if (logFilter.action_type) p.set('action_type', logFilter.action_type);
    p.set('limit', '10000');
    p.set('page', '1');
    const res = await fetch(`/api/staff/activity?${p}`);
    const allLogs: ActivityLog[] = res.ok ? (await res.json()).logs : logs;
    const rows = [['Date', 'Staff', 'Module', 'Action', 'Description'],
      ...allLogs.map(l => [fmtDate(l.created_at), l.staff_name, l.module ?? '', l.action_type, l.description ?? ''])];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `activity_log_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  /* ── tab class ───────────────────────────────────────────── */
  const tabCls = (t: string) =>
    `flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === t ? 'bg-surface-3 text-fg' : 'text-fg-muted hover:text-fg'}`;
  const inp = 'bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-brand';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-fg">User & Role Management</h1>
        <p className="text-sm text-fg-muted mt-0.5">Manage staff accounts, roles, permissions, and access logs</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-2 border border-line rounded-xl p-1 w-fit flex-wrap">
        <button onClick={() => setActiveTab('overview')} className={tabCls('overview')}>
          <LayoutDashboard className="w-4 h-4" /> Overview
        </button>
        <button onClick={() => setActiveTab('accounts')} className={tabCls('accounts')}>
          <Users className="w-4 h-4" /> Staff Accounts
        </button>
        <button onClick={() => setActiveTab('roles')} className={tabCls('roles')}>
          <ShieldCheck className="w-4 h-4" /> Roles & Permissions
        </button>
        <button onClick={() => setActiveTab('activity')} className={tabCls('activity')}>
          <Activity className="w-4 h-4" /> Activity Log
        </button>
      </div>

      {/* ── OVERVIEW TAB ───────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {overviewLoad ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-6 h-6 text-brand animate-spin" />
            </div>
          ) : overview ? (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-surface-2 border border-line rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-brand/15 flex items-center justify-center">
                      <Users className="w-4.5 h-4.5 text-brand" />
                    </div>
                    <p className="text-xs text-fg-muted">Total Staff</p>
                  </div>
                  <p className="text-2xl font-bold text-fg">{overview.totalStaff}</p>
                </div>
                <div className="bg-surface-2 border border-line rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-600/15 flex items-center justify-center">
                      <UserCheck2 className="w-4.5 h-4.5 text-emerald-400" />
                    </div>
                    <p className="text-xs text-fg-muted">Active</p>
                  </div>
                  <p className="text-2xl font-bold text-emerald-400">{overview.activeStaff}</p>
                </div>
                <div className="bg-surface-2 border border-line rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-red-600/15 flex items-center justify-center">
                      <UserX2 className="w-4.5 h-4.5 text-red-400" />
                    </div>
                    <p className="text-xs text-fg-muted">Inactive</p>
                  </div>
                  <p className="text-2xl font-bold text-red-400">{overview.inactiveStaff}</p>
                </div>
                <div className="bg-surface-2 border border-line rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-600/15 flex items-center justify-center">
                      <Shield className="w-4.5 h-4.5 text-blue-400" />
                    </div>
                    <p className="text-xs text-fg-muted">Roles</p>
                  </div>
                  <p className="text-2xl font-bold text-fg">{overview.totalRoles}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5">
                {/* Role breakdown */}
                <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-line">
                    <h3 className="text-sm font-semibold text-fg">Roles & Members</h3>
                  </div>
                  {overview.roleBreakdown.length === 0 ? (
                    <div className="p-8 text-center">
                      <Shield className="w-8 h-8 text-fg-faint mx-auto mb-2" />
                      <p className="text-sm text-fg-muted">No roles created yet</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-700/50">
                      {overview.roleBreakdown.map(r => (
                        <div key={r.id} className="flex items-center justify-between px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-brand/15 flex items-center justify-center">
                              <ShieldCheck className="w-4 h-4 text-brand" />
                            </div>
                            <span className="text-sm font-medium text-fg">{r.name}</span>
                          </div>
                          <span className="text-xs text-fg-muted">{r.memberCount} member{r.memberCount !== 1 ? 's' : ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </>
          ) : (
            <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
              <LayoutDashboard className="w-10 h-10 text-fg-faint mx-auto mb-3" />
              <p className="text-sm text-fg-muted">Failed to load overview data</p>
            </div>
          )}
        </div>
      )}

      {/* ── STAFF ACCOUNTS TAB ──────────────────────────────── */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-fg-muted">{staff.length} staff member{staff.length !== 1 ? 's' : ''}</p>
            {can(permissions, 'staff', 'create') && (
              <button onClick={openAddStaff}
                className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-dim text-brand-ink text-sm font-medium rounded-lg transition-colors">
                <Plus className="w-4 h-4" /> Add Staff
              </button>
            )}
          </div>

          {staffLoad ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-6 h-6 text-brand animate-spin" />
            </div>
          ) : staff.length === 0 ? (
            <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
              <Users className="w-10 h-10 text-fg-faint mx-auto mb-3" />
              <p className="text-sm text-fg-muted mb-4">No staff members yet</p>
              {can(permissions, 'staff', 'create') && (
                <button onClick={openAddStaff}
                  className="px-4 py-2 bg-brand hover:bg-brand-dim text-brand-ink text-sm font-medium rounded-lg transition-colors">
                  Add First Staff Member
                </button>
              )}
            </div>
          ) : (
            <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-fg-muted uppercase tracking-wider">
                    <th className="px-5 py-3 text-left">Name</th>
                    <th className="px-5 py-3 text-left">Email</th>
                    <th className="px-5 py-3 text-left">Phone</th>
                    <th className="px-5 py-3 text-left">Roles</th>
                    <th className="px-5 py-3 text-left">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {staff.map(s => (
                    <tr key={s.id} className="hover:bg-surface-3/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-semibold text-brand">
                              {s.full_name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-fg">{s.full_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-fg-muted">{s.email}</td>
                      <td className="px-5 py-3.5 text-fg-muted">{s.phone || '—'}</td>
                      <td className="px-5 py-3.5">
                        {s.roles.length === 0 ? (
                          <span className="text-xs text-fg-faint">No roles</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {s.roles.map(r => (
                              <span key={r.id} className="px-2 py-0.5 rounded-full text-xs bg-brand/20 text-brand border border-brand/30">
                                {r.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                          s.status === 'active' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-surface-4/40 text-fg-muted'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'active' ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                          {s.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          {can(permissions, 'staff', 'edit') && (
                            <button onClick={() => openEditStaff(s)} title="Edit"
                              className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {can(permissions, 'staff', 'edit') && (
                            <button onClick={() => resetStaffPassword(s.id)} title="Reset Password"
                              className="p-1.5 rounded-lg text-fg-muted hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors">
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {s.status === 'active' && can(permissions, 'staff', 'edit') && (
                            <button onClick={() => setConfirmDeactivate(s)} title="Deactivate"
                              className="p-1.5 rounded-lg text-fg-muted hover:text-amber-400 hover:bg-amber-400/10 transition-colors">
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {s.status !== 'active' && can(permissions, 'staff', 'edit') && (
                            <button onClick={() => toggleStatus(s)} title="Reactivate"
                              className="p-1.5 rounded-lg text-fg-muted hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors">
                              <UserCheck className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ROLES & PERMISSIONS TAB ─────────────────────────── */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: role list */}
          <div className="space-y-3">
            {can(permissions, 'staff', 'create') && (
              <button onClick={openAddRole}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-dim text-brand-ink text-sm font-medium rounded-lg transition-colors">
                <Plus className="w-4 h-4" /> Create Role
              </button>
            )}

            {rolesLoad ? (
              <div className="flex justify-center py-10"><RefreshCw className="w-5 h-5 text-brand animate-spin" /></div>
            ) : roles.length === 0 ? (
              <div className="bg-surface-2 border border-line rounded-xl p-8 text-center">
                <ShieldCheck className="w-8 h-8 text-fg-faint mx-auto mb-2" />
                <p className="text-sm text-fg-muted">No roles yet</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {roles.map(r => (
                  <button key={r.id} onClick={() => setSelectedRole(r)}
                    className={`w-full text-left px-4 py-3.5 rounded-xl border transition-colors ${
                      selectedRole?.id === r.id
                        ? 'bg-brand/10 border-brand/40 text-fg'
                        : 'bg-surface-2 border-line text-fg-muted hover:border-line'
                    }`}>
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{r.name}</p>
                        {r.description && <p className="text-xs text-fg-faint truncate mt-0.5">{r.description}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className="text-xs text-fg-faint">{r.memberCount} member{r.memberCount !== 1 ? 's' : ''}</span>
                        <ChevronRight className="w-4 h-4 text-fg-faint" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: permissions matrix */}
          <div className="lg:col-span-2">
            {!selectedRole ? (
              <div className="bg-surface-2 border border-line rounded-xl p-12 text-center h-full flex flex-col items-center justify-center">
                <ShieldCheck className="w-10 h-10 text-fg-faint mb-3" />
                <p className="text-sm text-fg-muted">Select a role to view its permissions</p>
              </div>
            ) : (
              <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-line flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-fg">{selectedRole.name}</h2>
                    {selectedRole.description && <p className="text-xs text-fg-muted mt-0.5">{selectedRole.description}</p>}
                  </div>
                  <div className="flex gap-2">
                    {can(permissions, 'staff', 'edit') && (
                      <button onClick={() => openEditRole(selectedRole)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-3 hover:bg-surface-4 text-fg text-xs font-medium rounded-lg transition-colors">
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                    )}
                    {can(permissions, 'staff', 'delete') && (
                      <button onClick={() => deleteRole(selectedRole)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium rounded-lg transition-colors border border-red-500/20">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* Permissions table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-xs text-fg-muted uppercase tracking-wider">
                        <th className="px-5 py-3 text-left">Module</th>
                        {ACTIONS.map(a => (
                          <th key={a} className="px-4 py-3 text-center">{ACTION_LABELS[a]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                      {MODULES.map(m => {
                        const permsForMod = selectedRole.permissions.filter(p => p.module === m.key).map(p => p.action);
                        return (
                          <tr key={m.key} className="hover:bg-surface-3/20">
                            <td className="px-5 py-3 text-fg-muted font-medium">{m.label}</td>
                            {ACTIONS.map(a => (
                              <td key={a} className="px-4 py-3 text-center">
                                {permsForMod.includes(a) ? (
                                  <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                                ) : (
                                  <span className="w-4 h-4 flex items-center justify-center mx-auto">
                                    <span className="w-1.5 h-1.5 rounded-full bg-surface-3 block" />
                                  </span>
                                )}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 border-t border-line">
                  <p className="text-xs text-fg-faint">
                    {selectedRole.permissions.length} permission{selectedRole.permissions.length !== 1 ? 's' : ''} granted
                    · {selectedRole.memberCount} staff member{selectedRole.memberCount !== 1 ? 's' : ''} assigned
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ACTIVITY LOG TAB ────────────────────────────────── */}
      {activeTab === 'activity' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-surface-2 border border-line rounded-xl p-4 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-fg-muted">Staff</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-faint" />
                <input type="text" placeholder="Filter by name…" value={logFilter.staff_name}
                  onChange={e => setLogFilter(p => ({ ...p, staff_name: e.target.value }))}
                  className={`${inp} pl-8 w-44`} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-fg-muted">From</label>
              <input type="date" value={logFilter.from} onChange={e => setLogFilter(p => ({ ...p, from: e.target.value }))}
                className={`${inp} [color-scheme:dark]`} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-fg-muted">To</label>
              <input type="date" value={logFilter.to} onChange={e => setLogFilter(p => ({ ...p, to: e.target.value }))}
                className={`${inp} [color-scheme:dark]`} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-fg-muted">Action</label>
              <select value={logFilter.action_type} onChange={e => setLogFilter(p => ({ ...p, action_type: e.target.value }))}
                className={inp}>
                <option value="">All actions</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="deactivate">Deactivate</option>
                <option value="reactivate">Reactivate</option>
              </select>
            </div>
            <button onClick={() => fetchLogs(1)} disabled={logsLoad}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-dim text-brand-ink text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
              {logsLoad ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Filter className="w-3.5 h-3.5" />}
              Apply
            </button>
            <button onClick={exportLogs} disabled={logsLoad || logs.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-surface-3 hover:bg-surface-4 text-fg text-sm font-medium rounded-lg transition-colors disabled:opacity-40 ml-auto">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>

          {logsLoad ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-6 h-6 text-brand animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
              <ClipboardList className="w-10 h-10 text-fg-faint mx-auto mb-3" />
              <p className="text-sm text-fg-muted">No activity logs found</p>
            </div>
          ) : (
            <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-line flex items-center justify-between">
                <p className="text-xs text-fg-muted">{logTotal} log entr{logTotal !== 1 ? 'ies' : 'y'}</p>
              </div>
              <div className="divide-y divide-gray-700/50">
                {logs.map(log => (
                  <div key={log.id} className="flex items-start gap-4 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-fg">{log.staff_name}</span>
                        <span className={`text-xs font-medium capitalize ${actionColor(log.action_type)}`}>
                          {log.action_type}
                        </span>
                        {log.module && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-surface-3 text-fg-muted capitalize">
                            {log.module}
                          </span>
                        )}
                      </div>
                      {log.description && <p className="text-xs text-fg-muted mt-0.5">{log.description}</p>}
                    </div>
                    <span className="text-xs text-fg-faint flex-shrink-0 whitespace-nowrap">
                      {fmtDate(log.created_at)}
                    </span>
                  </div>
                ))}
              </div>
              {/* Pagination */}
              {logPages > 1 && (
                <div className="px-5 py-3 border-t border-line flex items-center justify-between">
                  <p className="text-xs text-fg-faint">Page {logPage} of {logPages}</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => fetchLogs(logPage - 1)} disabled={logPage <= 1 || logsLoad}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-3 text-fg-muted hover:bg-surface-4 disabled:opacity-40 transition-colors">
                      Previous
                    </button>
                    <button onClick={() => fetchLogs(logPage + 1)} disabled={logPage >= logPages || logsLoad}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-3 text-fg-muted hover:bg-surface-4 disabled:opacity-40 transition-colors">
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── STAFF MODAL ──────────────────────────────────────── */}
      {staffModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-2 border border-line rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-line">
              <h2 className="text-lg font-semibold text-fg">
                {createdCreds ? 'Staff Created' : staffModal.editing ? 'Edit Staff Member' : 'Add Staff Member'}
              </h2>
              <button onClick={() => { setStaffModal({ open: false, editing: null }); setCreatedCreds(null); }}
                className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3">
                <X className="w-4 h-4" />
              </button>
            </div>

            {createdCreds ? (
              <StaffCreatedCard
                email={createdCreds.email}
                password={createdCreds.password}
                onDone={() => { setStaffModal({ open: false, editing: null }); setCreatedCreds(null); }}
              />
            ) : (
              <>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="text-xs font-medium text-fg-muted mb-1.5 block">Full Name *</label>
                    <input type="text" value={sf.full_name} onChange={e => setSf(p => ({ ...p, full_name: e.target.value }))}
                      placeholder="e.g. Jane Smith" className={`${inp} w-full`} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-fg-muted mb-1.5 block">Email *</label>
                    <input type="email" value={sf.email} onChange={e => setSf(p => ({ ...p, email: e.target.value }))}
                      placeholder="jane@example.com" className={`${inp} w-full`} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-fg-muted mb-1.5 block">Phone</label>
                    <input type="tel" value={sf.phone} onChange={e => setSf(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+1 555 000 0000" className={`${inp} w-full`} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-fg-muted mb-1.5 block">Assign Roles</label>
                    {roles.length === 0 ? (
                      <p className="text-xs text-fg-faint">No roles created yet. Create roles first in the Roles & Permissions tab.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {roles.map(r => (
                          <label key={r.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-line hover:border-line cursor-pointer transition-colors">
                            <input type="checkbox" checked={sf.role_ids.includes(r.id)}
                              onChange={e => setSf(p => ({
                                ...p,
                                role_ids: e.target.checked ? [...p.role_ids, r.id] : p.role_ids.filter(id => id !== r.id),
                              }))}
                              className="w-4 h-4 accent-brand" />
                            <div>
                              <p className="text-sm text-fg">{r.name}</p>
                              {r.description && <p className="text-xs text-fg-faint">{r.description}</p>}
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-fg-faint">A temporary password will be auto-generated. The staff member must change it on first login.</p>
                </div>
                <div className="flex gap-3 px-6 pb-6">
                  <button onClick={() => setStaffModal({ open: false, editing: null })}
                    className="flex-1 py-2.5 bg-surface-3 hover:bg-surface-4 text-fg text-sm font-medium rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button onClick={saveStaff}
                    className="flex-1 py-2.5 bg-brand hover:bg-brand-dim text-brand-ink text-sm font-medium rounded-lg transition-colors">
                    {staffModal.editing ? 'Save Changes' : 'Create Staff'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── ROLE MODAL ───────────────────────────────────────── */}
      {roleModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-2 border border-line rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-line">
              <h2 className="text-lg font-semibold text-fg">
                {roleModal.editing ? 'Edit Role' : 'Create Role'}
              </h2>
              <button onClick={() => setRoleModal({ open: false, editing: null })}
                className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-fg-muted mb-1.5 block">Role Name *</label>
                  <input type="text" value={rf.name} onChange={e => setRf(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Manager, Trainer" className={`${inp} w-full`} />
                </div>
                <div>
                  <label className="text-xs font-medium text-fg-muted mb-1.5 block">Description</label>
                  <input type="text" value={rf.description} onChange={e => setRf(p => ({ ...p, description: e.target.value }))}
                    placeholder="Brief description…" className={`${inp} w-full`} />
                </div>
              </div>

              {/* Permissions matrix */}
              <div>
                <label className="text-xs font-medium text-fg-muted mb-2 block">Permissions</label>
                <div className="border border-line rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface-3/50 text-xs text-fg-muted uppercase tracking-wider">
                        <th className="px-4 py-2.5 text-left">Module</th>
                        {ACTIONS.map(a => (
                          <th key={a} className="px-3 py-2.5 text-center">{ACTION_LABELS[a]}</th>
                        ))}
                        <th className="px-3 py-2.5 text-center">All</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                      {MODULES.map(m => {
                        const allChecked = ACTIONS.every(a => rfPerms[m.key]?.has(a));
                        return (
                          <tr key={m.key} className="hover:bg-surface-3/20">
                            <td className="px-4 py-2.5 text-fg-muted">{m.label}</td>
                            {ACTIONS.map(a => (
                              <td key={a} className="px-3 py-2.5 text-center">
                                <input type="checkbox" checked={rfPerms[m.key]?.has(a) ?? false}
                                  onChange={() => togglePerm(m.key, a)}
                                  className="w-4 h-4 accent-brand cursor-pointer" />
                              </td>
                            ))}
                            <td className="px-3 py-2.5 text-center">
                              <input type="checkbox" checked={allChecked}
                                onChange={() => toggleModule(m.key, allChecked)}
                                className="w-4 h-4 accent-brand cursor-pointer" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6 pt-2">
              <button onClick={() => setRoleModal({ open: false, editing: null })}
                className="flex-1 py-2.5 bg-surface-3 hover:bg-surface-4 text-fg text-sm font-medium rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={saveRole}
                className="flex-1 py-2.5 bg-brand hover:bg-brand-dim text-brand-ink text-sm font-medium rounded-lg transition-colors">
                {roleModal.editing ? 'Save Changes' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DEACTIVATE CONFIRM ──────────────────────────────── */}
      {confirmDeactivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-2 border border-line rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-400/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="font-semibold text-fg">Deactivate Account</h2>
                <p className="text-xs text-fg-muted mt-0.5">This will revoke their access immediately</p>
              </div>
            </div>
            <p className="text-sm text-fg-muted">
              Are you sure you want to deactivate <span className="text-fg font-medium">{confirmDeactivate.full_name}</span>?
              You can reactivate them at any time.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeactivate(null)}
                className="flex-1 py-2.5 bg-surface-3 hover:bg-surface-4 text-fg text-sm font-medium rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={() => toggleStatus(confirmDeactivate)}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-fg text-sm font-medium rounded-lg transition-colors">
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RESET PASSWORD RESULT ───────────────────────────── */}
      {resetPwResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-2 border border-line rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-yellow-400" />
                <h2 className="text-base font-semibold text-fg">Password Reset</h2>
              </div>
              <button onClick={() => setResetPwResult(null)} className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-fg-muted">Share this temporary password with the staff member. They must change it on next login.</p>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 flex items-center gap-3 overflow-hidden">
              <span className="text-base font-bold text-fg tracking-wide flex-1 break-all">{resetPwResult.password}</span>
              <CopyButton text={resetPwResult.password} />
            </div>
            <button onClick={() => setResetPwResult(null)}
              className="w-full py-2.5 bg-brand hover:bg-brand-dim text-brand-ink text-sm font-medium rounded-lg transition-colors">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────── */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button onClick={copy} className="p-1.5 rounded-lg bg-surface-3 hover:bg-surface-4 text-fg-muted transition-colors flex-shrink-0">
      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

function StaffCreatedCard({ email, password, onDone }: { email: string; password: string; onDone: () => void }) {
  return (
    <div className="p-6 space-y-4">
      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
        <p className="text-green-400 font-semibold text-sm mb-1">Staff member created!</p>
        <p className="text-fg-muted text-xs">Share these credentials. They must change their password on first login.</p>
      </div>
      <div className="bg-surface-3/50 rounded-xl p-4 space-y-3">
        <div>
          <p className="text-xs text-fg-muted mb-1">Email</p>
          <p className="text-sm text-fg font-medium">{email}</p>
        </div>
        <div>
          <p className="text-xs text-fg-muted mb-1">Temporary password</p>
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="text-base font-bold text-fg tracking-wide break-all flex-1">{password}</span>
            <CopyButton text={password} />
          </div>
        </div>
      </div>
      <button onClick={onDone} className="w-full py-2.5 bg-brand hover:bg-brand-dim text-brand-ink text-sm font-medium rounded-lg transition-colors">
        Done
      </button>
    </div>
  );
}
