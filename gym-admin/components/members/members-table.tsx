'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Users, Plus, Pencil, Eye, Search, X, ChevronLeft, ChevronRight, Download, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import MemberModal from './member-modal';
import ToggleStatusButton from './toggle-status-button';
import VerifyEmailButton from './verify-email-button';
import ExportModal from './export-modal';
import { can, type Permission } from '@/lib/get-permissions';

const PAGE_SIZE = 20;

interface MemberWithProfile {
  id: string;
  member_number: string;
  status: string;
  joined_at: string;
  notes: string | null;
  plan_type: string | null;
  plan_name: string | null;
  profile: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    photo_url: string | null;
    email_verified?: boolean;
  } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface Props {
  members: MemberWithProfile[];
  initialPagination?: Pagination;
  permissions: Permission[] | null;
}

const statusColor: Record<string, string> = {
  active:    'bg-emerald-400/10 text-emerald-400',
  inactive:  'bg-gray-400/10 text-gray-400',
  expired:   'bg-gray-400/10 text-gray-400',
  suspended: 'bg-red-400/10 text-red-400',
  cancelled: 'bg-gray-400/10 text-gray-400',
};

const SORT_OPTIONS = [
  { value: 'newest', label: 'Join Date (Newest)' },
  { value: 'oldest', label: 'Join Date (Oldest)' },
] as const;

export default function MembersTable({ members: initialMembers, initialPagination, permissions }: Props) {
  // Server-side paginated state
  const [members, setMembers]     = useState<MemberWithProfile[]>(initialMembers);
  const [loading, setLoading]     = useState(false);
  const [page, setPage]           = useState(initialPagination?.page ?? 1);
  const [totalPages, setTotalPages] = useState(initialPagination?.pages ?? 1);
  const [total, setTotal]         = useState(initialPagination?.total ?? initialMembers.length);

  // Sync with server data when navigating back (initialMembers changes)
  useEffect(() => {
    setMembers(initialMembers);
    setPage(initialPagination?.page ?? 1);
    setTotalPages(initialPagination?.pages ?? 1);
    setTotal(initialPagination?.total ?? initialMembers.length);
  }, [initialMembers, initialPagination]);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sort, setSort]           = useState('newest');

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberWithProfile | undefined>(undefined);
  const [exportOpen, setExportOpen] = useState(false);

  // Debounce search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  // Fetch members from API
  const fetchMembers = useCallback(async (p = 1) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(p));
    params.set('limit', String(PAGE_SIZE));
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    params.set('sort', sort);

    try {
      const res = await fetch(`/api/members?${params}`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members);
        setPage(data.pagination.page);
        setTotalPages(data.pagination.pages);
        setTotal(data.pagination.total);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [debouncedSearch, statusFilter, sort]);

  // Re-fetch when filters change (reset to page 1)
  // Skip the first render — server already provided initialMembers
  const isInitialRender = useRef(true);
  useEffect(() => {
    if (isInitialRender.current) { isInitialRender.current = false; return; }
    fetchMembers(1);
  }, [debouncedSearch, statusFilter, sort]);

  const goToPage = (p: number) => { fetchMembers(p); };

  const openCreate = () => { setEditingMember(undefined); setModalOpen(true); };
  const openEdit = (m: MemberWithProfile) => { setEditingMember(m); setModalOpen(true); };
  const closeModal = () => {
    setModalOpen(false);
    setEditingMember(undefined);
    fetchMembers(page); // Refresh after modal closes
  };

  const hasFilters = debouncedSearch || statusFilter !== 'all';
  const clearFilters = () => { setSearch(''); setStatusFilter('all'); setSort('newest'); };

  const selectCls = 'bg-gray-700 border border-gray-600 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 transition-colors';

  // Generate page numbers to show (max 5 visible)
  const pageNumbers = (() => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  })();

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Members</h1>
            <p className="text-sm text-gray-400 mt-0.5">{total} members registered to your gym</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExportOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" /> Export
            </button>
            {can(permissions, 'members', 'create') && (
              <button
                onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Member
              </button>
            )}
          </div>
        </div>

        {/* Search + Filters */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, phone, or member #…"
              className="w-full pl-9 pr-9 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap gap-3 items-center">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectCls}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive / Expired</option>
              <option value="suspended">Deactivated</option>
            </select>

            <select value={sort} onChange={e => setSort(e.target.value)} className={selectCls}>
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1">
                <X className="w-3 h-3" /> Clear all
              </button>
            )}

            <span className="ml-auto text-xs text-gray-500 flex items-center gap-2">
              {loading && <RefreshCw className="w-3 h-3 animate-spin" />}
              {total} members
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          {loading && members.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
          ) : members.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">
                {hasFilters ? 'No members match your filters' : 'No members yet'}
              </p>
              {!hasFilters && can(permissions, 'members', 'create') && (
                <button onClick={openCreate} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors">
                  <Plus className="w-4 h-4" /> Add your first member
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-xs text-gray-400 uppercase tracking-wide">
                    <th className="text-left px-4 py-3">Member</th>
                    <th className="text-left px-4 py-3">Member #</th>
                    <th className="text-left px-4 py-3">Phone</th>
                    <th className="text-left px-4 py-3">Joined</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {members.map(m => {
                    const p = m.profile;
                    const displayName = p?.full_name ?? String(m.member_number ?? '?');
                    return (
                      <tr key={m.id} className={`hover:bg-gray-700/30 transition-colors ${loading ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3">
                          <Link href={`/dashboard/members/${m.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                            <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center text-xs font-bold text-purple-400 flex-shrink-0">
                              {displayName.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-white font-medium hover:text-purple-400 transition-colors">{p?.full_name ?? '—'}</p>
                              <p className="text-xs text-gray-500">{p?.email ?? ''}</p>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {m.member_number
                            ? <span className="text-gray-300">{m.member_number}</span>
                            : <span className="text-gray-500 text-xs italic">No Member ID yet</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-400">{p?.phone ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-400">
                          {m.joined_at ? new Date(m.joined_at).toLocaleDateString('en-GB') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColor[m.status] ?? 'bg-gray-400/10 text-gray-400'}`}>
                            {m.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/dashboard/members/${m.id}`} title="View profile" className="p-1.5 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 transition-colors">
                              <Eye className="w-4 h-4" />
                            </Link>
                            {can(permissions, 'members', 'edit') && (
                              <button onClick={() => openEdit(m)} title="Edit member" className="p-1.5 rounded-lg text-gray-500 hover:text-purple-400 hover:bg-purple-400/10 transition-colors">
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                            {can(permissions, 'members', 'edit') && !p?.email_verified && p?.email && (
                              <VerifyEmailButton memberId={m.id} memberName={p?.full_name ?? m.member_number} emailVerified={p?.email_verified} />
                            )}
                            {can(permissions, 'members', 'edit') && (
                              <ToggleStatusButton memberId={m.id} memberName={p?.full_name ?? m.member_number} currentStatus={m.status} />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700">
              <p className="text-xs text-gray-500">
                Page {page} of {totalPages} ({total} total)
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1 || loading}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {pageNumbers.map(n => (
                  <button
                    key={n}
                    onClick={() => goToPage(n)}
                    disabled={loading}
                    className={`w-8 h-8 text-xs rounded-lg transition-colors ${
                      n === page
                        ? 'bg-purple-600 text-white font-medium'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages || loading}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {modalOpen && <MemberModal member={editingMember} onClose={closeModal} />}
      {exportOpen && <ExportModal members={members} onClose={() => setExportOpen(false)} />}
    </>
  );
}
