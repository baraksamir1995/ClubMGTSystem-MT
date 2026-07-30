'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Users, Plus, Pencil, Eye, Download, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import MemberModal from './member-modal';
import ToggleStatusButton from './toggle-status-button';
import VerifyEmailButton from './verify-email-button';
import ExportModal from './export-modal';
import { can, type Permission } from '@/lib/get-permissions';
import {
  Avatar,
  Badge,
  type BadgeProps,
  Button,
  DataTable,
  type DataTableColumn,
  EmptyState,
  FilterDropdown,
  Pagination,
  SearchInput,
} from '@/components/ui';

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

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface Props {
  members: MemberWithProfile[];
  initialPagination?: PaginationMeta;
  permissions: Permission[] | null;
}

// Status → Badge variant. Anything not active/suspended reads as neutral.
const statusVariant: Record<string, BadgeProps['variant']> = {
  active:    'success',
  inactive:  'neutral',
  expired:   'neutral',
  suspended: 'danger',
  cancelled: 'neutral',
};

export default function MembersTable({ members: initialMembers, initialPagination, permissions }: Props) {
  const t = useTranslations('members.list');
  const tc = useTranslations('common');

  const SORT_OPTIONS = [
    { value: 'newest', label: t('sort.newest') },
    { value: 'oldest', label: t('sort.oldest') },
  ];

  const STATUS_OPTIONS = [
    { value: 'all',       label: t('status.all') },
    { value: 'active',    label: t('status.active') },
    { value: 'inactive',  label: t('status.inactive') },
    { value: 'suspended', label: t('status.suspended') },
  ];

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

  // SearchInput owns its own debounce; this mirrors the value it emits.
  const [debouncedSearch, setDebouncedSearch] = useState('');

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, sort]);

  const openCreate = () => { setEditingMember(undefined); setModalOpen(true); };
  const openEdit = (m: MemberWithProfile) => { setEditingMember(m); setModalOpen(true); };
  const closeModal = () => {
    setModalOpen(false);
    setEditingMember(undefined);
    fetchMembers(page); // Refresh after modal closes
  };

  const hasFilters = Boolean(debouncedSearch) || statusFilter !== 'all';
  const clearFilters = () => { setSearch(''); setDebouncedSearch(''); setStatusFilter('all'); setSort('newest'); };

  const columns: DataTableColumn<MemberWithProfile>[] = [
    {
      key: 'member',
      header: t('col.member'),
      cell: (m) => (
        <Link href={`/dashboard/members/${m.id}`} className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity">
          <Avatar name={m.profile?.full_name ?? String(m.member_number ?? '?')} size={32} />
          <div className="min-w-0">
            <div className="text-fg font-medium truncate">{m.profile?.full_name ?? '—'}</div>
            <div className="text-[11px] text-fg-muted truncate">{m.profile?.email ?? ''}</div>
          </div>
        </Link>
      ),
    },
    {
      key: 'member_number',
      header: t('col.memberNumber'),
      cell: (m) => (
        <span className="font-mono">
          {m.member_number
            ? <span className="text-fg-muted">{m.member_number}</span>
            : <span className="text-fg-faint text-xs italic">{t('noMemberId')}</span>}
        </span>
      ),
    },
    {
      key: 'phone',
      header: t('col.phone'),
      hideOnMobile: true,
      cell: (m) => <span className="text-fg-muted">{m.profile?.phone ?? '—'}</span>,
    },
    {
      key: 'joined',
      header: t('col.joined'),
      hideOnMobile: true,
      cell: (m) => (
        <span className="text-fg-muted">{m.joined_at ? new Date(m.joined_at).toLocaleDateString('en-GB') : '—'}</span>
      ),
    },
    {
      key: 'status',
      header: t('col.status'),
      cell: (m) => (
        <Badge variant={statusVariant[m.status] ?? 'neutral'} className="capitalize">{m.status}</Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (m) => (
        <div className="flex items-center justify-end gap-1">
          <Link href={`/dashboard/members/${m.id}`} title={t('action.viewProfile')} aria-label={t('action.viewProfile')} className="p-1.5 rounded-lg text-fg-faint hover:text-fg hover:bg-surface-3 transition-colors">
            <Eye className="w-4 h-4" aria-hidden />
          </Link>
          {can(permissions, 'members', 'edit') && (
            <button type="button" onClick={() => openEdit(m)} title={t('action.editMember')} aria-label={t('action.editMember')} className="p-1.5 rounded-lg text-fg-faint hover:text-brand hover:bg-surface-3 transition-colors">
              <Pencil className="w-4 h-4" aria-hidden />
            </button>
          )}
          {can(permissions, 'members', 'edit') && !m.profile?.email_verified && m.profile?.email && (
            <VerifyEmailButton memberId={m.id} memberName={m.profile?.full_name ?? m.member_number} emailVerified={m.profile?.email_verified} />
          )}
          {can(permissions, 'members', 'edit') && (
            <ToggleStatusButton memberId={m.id} memberName={m.profile?.full_name ?? m.member_number} currentStatus={m.status} />
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-fg">{t('title')}</h1>
            <p className="text-sm text-fg-muted mt-0.5">{t('subtitle', { total })}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setExportOpen(true)} leftIcon={<Download className="w-4 h-4" />}>
              {tc('export')}
            </Button>
            {can(permissions, 'members', 'create') && (
              <Button variant="primary" onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>
                {t('addMember')}
              </Button>
            )}
          </div>
        </div>

        {/* Search + Filters */}
        <div className="bg-surface-2 border border-line rounded-xl p-4 space-y-3">
          <SearchInput
            value={search}
            onValueChange={setSearch}
            onSearch={setDebouncedSearch}
            placeholder={t('searchPlaceholder')}
          />

          <div className="flex flex-wrap gap-2 items-center">
            <FilterDropdown label={tc('status')} value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
            <FilterDropdown label={tc('filter')} value={sort} onChange={setSort} options={SORT_OPTIONS} />

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>{tc('clear')}</Button>
            )}

            <span className="ms-auto text-xs text-fg-faint flex items-center gap-2">
              {loading && <RefreshCw className="w-3 h-3 animate-spin" aria-hidden />}
              {t('totalCount', { total })}
            </span>
          </div>
        </div>

        {/* Table */}
        <DataTable
          columns={columns}
          rows={members}
          rowKey={(m) => m.id}
          loading={loading}
          empty={
            <EmptyState
              icon={Users}
              title={hasFilters ? t('noMembersFiltered') : t('noMembersYet')}
              action={
                !hasFilters && can(permissions, 'members', 'create')
                  ? <Button variant="primary" size="sm" onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>{t('addFirstMember')}</Button>
                  : undefined
              }
            />
          }
        />

        {/* Pagination */}
        <Pagination
          total={total}
          limit={PAGE_SIZE}
          offset={(page - 1) * PAGE_SIZE}
          onChange={(o) => fetchMembers(Math.floor(o / PAGE_SIZE) + 1)}
          loading={loading}
        />
      </div>

      {modalOpen && <MemberModal member={editingMember} onClose={closeModal} />}
      {exportOpen && <ExportModal members={members} onClose={() => setExportOpen(false)} />}
    </>
  );
}
