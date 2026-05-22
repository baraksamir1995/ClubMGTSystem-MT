'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, X, ChevronLeft, ChevronRight, DollarSign, CheckCircle, Clock, AlertCircle, FileText, RotateCcw, Bell, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import RecordPaymentModal from './record-payment-modal';
import InvoiceModal from './invoice-modal';
import RefundModal from './refund-modal';
import ReminderModal from './reminder-modal';
import type { Payment, MemberOption, GymInfo, ServiceOption, TrainerOption, PromoCode } from '@/app/dashboard/payments/page';
import type { GymBranch } from '@/app/dashboard/branches/page';
import { can, type Permission } from '@/lib/get-permissions';
import { Badge, type BadgeProps, Button } from '@/components/ui';

const PAGE_SIZE = 10;

const statusConfig: Record<string, { label: string; icon: React.ElementType; variant: BadgeProps['variant']; dot: string }> = {
  paid:          { label: 'Paid',          icon: CheckCircle, variant: 'success', dot: 'bg-success' },
  pending:       { label: 'Pending',       icon: Clock,       variant: 'warning', dot: 'bg-warning' },
  overdue:       { label: 'Overdue',       icon: AlertCircle, variant: 'danger',  dot: 'bg-danger' },
  refunded:      { label: 'Refunded',      icon: RotateCcw,   variant: 'neutral', dot: 'bg-blue-400' },
  partial_refund:{ label: 'Part. Refund',  icon: RotateCcw,   variant: 'neutral', dot: 'bg-blue-400' },
};

const methodLabel: Record<string, string> = {
  cash:          'Cash',
  bank_transfer: 'Bank Transfer',
  card:          'Card',
  other:         'Other',
};

const fmt = (amount: number, currency = 'EGP') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);

interface Props {
  payments: Payment[];
  memberOptions: MemberOption[];
  serviceOptions: ServiceOption[];
  trainerOptions: TrainerOption[];
  branches: GymBranch[];
  gym: GymInfo;
  permissions: Permission[] | null;
  promoCodes: PromoCode[];
}

export default function PaymentsTable({ payments: initial, memberOptions, serviceOptions, trainerOptions, branches: branchOptions, gym, permissions, promoCodes }: Props) {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>(initial);
  const [modalOpen, setModalOpen]           = useState(false);
  const [invoicePayment, setInvoicePayment] = useState<Payment | null>(null);
  const [refundPayment, setRefundPayment]   = useState<Payment | null>(null);
  const [reminderOpen, setReminderOpen]     = useState(false);
  const [search, setSearch]                 = useState('');
  const [statusFilter, setStatusFilter]     = useState<string>('all');
  const [fromDate, setFromDate]             = useState('');
  const [toDate, setToDate]                 = useState('');
  const [specialistFilter, setSpecialistFilter] = useState('');
  const [methodFilter, setMethodFilter]     = useState('');
  const [serviceFilter, setServiceFilter]   = useState('');
  const [branchFilter, setBranchFilter]     = useState<string[]>([]);
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [page, setPage]                     = useState(1);
  const [updatingId, setUpdatingId]         = useState<string | null>(null);

  useEffect(() => { setPage(1); }, [search, statusFilter, fromDate, toDate, specialistFilter, methodFilter, serviceFilter, branchFilter]);

  // Derive unique filter options from data
  const specialists = useMemo(() => [...new Set(payments.map(p => p.specialist_name).filter(Boolean))] as string[], [payments]);
  const methods     = useMemo(() => [...new Set(payments.map(p => p.payment_method).filter(Boolean))] as string[], [payments]);
  const services    = useMemo(() => [...new Set(payments.map(p => p.service_name).filter(Boolean))] as string[], [payments]);
  const branches    = useMemo(() => [...new Set(payments.map(p => p.branch_name).filter(Boolean))] as string[], [payments]);

  const hasActiveFilters = fromDate || toDate || specialistFilter || methodFilter || serviceFilter || branchFilter.length > 0;
  const clearFilters = () => { setFromDate(''); setToDate(''); setSpecialistFilter(''); setMethodFilter(''); setServiceFilter(''); setBranchFilter([]); };

  // Base filtered (all filters except status) — used for summary cards
  const baseFiltered = useMemo(() => {
    let list = [...payments];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        (p.full_name    ?? '').toLowerCase().includes(q) ||
        (p.email        ?? '').toLowerCase().includes(q) ||
        String(p.member_number ?? '').toLowerCase().includes(q)
      );
    }
    if (fromDate) {
      const from = new Date(fromDate + 'T00:00:00');
      list = list.filter(p => new Date(p.paid_at ?? p.created_at) >= from);
    }
    if (toDate) {
      const to = new Date(toDate + 'T23:59:59');
      list = list.filter(p => new Date(p.paid_at ?? p.created_at) <= to);
    }
    if (specialistFilter) list = list.filter(p => p.specialist_name === specialistFilter);
    if (methodFilter)     list = list.filter(p => p.payment_method === methodFilter);
    if (serviceFilter)    list = list.filter(p => p.service_name === serviceFilter);
    if (branchFilter.length > 0) list = list.filter(p => p.branch_name != null && branchFilter.includes(p.branch_name));
    return list;
  }, [payments, search, fromDate, toDate, specialistFilter, methodFilter, serviceFilter, branchFilter]);

  // Final filtered (with status) — used for table
  const filtered = useMemo(() => {
    if (statusFilter === 'all') return baseFiltered;
    return baseFiltered.filter(p => p.status === statusFilter);
  }, [baseFiltered, statusFilter]);

  const totalPaid    = baseFiltered.filter(p => p.status === 'paid').length;
  const totalPending = baseFiltered.filter(p => p.status === 'pending').length;
  const totalOverdue = baseFiltered.filter(p => p.status === 'overdue').length;
  const totalRefunded = baseFiltered.filter(p => p.status === 'refunded' || p.status === 'partial_refund').reduce((s, p) => s + Number(p.amount), 0);
  const totalRevenue = baseFiltered.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0) - totalRefunded;

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const updateStatus = async (payment: Payment, newStatus: 'paid' | 'pending' | 'overdue') => {
    setUpdatingId(payment.id);
    try {
      const res = await fetch(`/api/payments/${payment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) { toast.error('Failed to update'); return; }
      setPayments(prev => prev.map(p => p.id === payment.id ? { ...p, status: newStatus, paid_at: newStatus === 'paid' ? new Date().toISOString() : null } : p));
      toast.success(`Marked as ${newStatus}`);
    } catch {
      toast.error('Network error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRefunded = () => {
    router.refresh();
  };

  const overduePayments = payments.filter(p => p.status === 'overdue');
  const selectCls = 'bg-surface-3 border border-line text-sm text-fg rounded-lg px-3 py-2 focus:outline-none focus:border-brand transition-colors';

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-fg">Payments</h1>
            <p className="text-sm text-fg-muted mt-0.5">Record and track member payments</p>
          </div>
          <div className="flex items-center gap-2">
            {overduePayments.length > 0 && can(permissions, 'payments', 'create') && (
              <Button variant="danger" onClick={() => setReminderOpen(true)} leftIcon={<Bell className="w-4 h-4" />}>
                Send Reminders
                <span className="ml-1.5 bg-white/20 text-xs px-1.5 py-0.5 rounded-full">{overduePayments.length}</span>
              </Button>
            )}
            {can(permissions, 'payments', 'create') && (
              <Button variant="primary" onClick={() => setModalOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
                Record Payment
              </Button>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-surface-2 border border-line rounded-xl p-4">
            <p className="text-xs text-fg-muted mb-1">Total Revenue</p>
            <p className="text-xl font-bold text-emerald-400">{fmt(totalRevenue)}</p>
          </div>
          {[
            { label: 'Paid',    value: totalPaid,    color: 'text-emerald-400', filter: 'paid' },
            { label: 'Pending', value: totalPending, color: 'text-amber-400',   filter: 'pending' },
            { label: 'Overdue', value: totalOverdue, color: 'text-red-400',     filter: 'overdue' },
          ].map(s => (
            <button key={s.filter}
              onClick={() => setStatusFilter(statusFilter === s.filter ? 'all' : s.filter)}
              className={`bg-surface-2 border rounded-xl p-4 text-left transition-colors ${statusFilter === s.filter ? "border-brand" : "border-line hover:border-line-strong"}`}>
              <p className="text-xs text-fg-muted mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </button>
          ))}
        </div>

        {/* Search + Filters */}
        <div className="bg-surface-2 border border-line rounded-xl p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-faint" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by member name, email, or member #…"
              className="w-full pl-9 pr-9 py-2 bg-surface border border-line rounded-lg text-sm text-fg placeholder-gray-500 focus:outline-none focus:border-brand transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-faint hover:text-fg">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Filter className="w-4 h-4 text-fg-muted" />
            <span className="text-sm font-medium text-fg">Filters</span>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="ml-auto text-xs text-fg-muted hover:text-fg transition-colors">Clear all</button>
            )}
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-fg-faint mb-1">From</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className={selectCls + ' w-full [color-scheme:dark]'} />
            </div>
            <div>
              <label className="block text-xs text-fg-faint mb-1">To</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className={selectCls + ' w-full [color-scheme:dark]'} />
            </div>
          </div>

          {/* Dropdowns row */}
          <div className="flex flex-wrap gap-3 items-center">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectCls}>
              <option value="all">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
              <option value="refunded">Refunded</option>
              <option value="partial_refund">Partial Refund</option>
            </select>
            <select value={methodFilter} onChange={e => setMethodFilter(e.target.value)} className={selectCls}>
              <option value="">All Methods</option>
              {methods.map(m => <option key={m} value={m}>{methodLabel[m] ?? m}</option>)}
            </select>
            {specialists.length > 0 && (
              <select value={specialistFilter} onChange={e => setSpecialistFilter(e.target.value)} className={selectCls}>
                <option value="">All Specialists</option>
                {specialists.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {services.length > 0 && (
              <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)} className={selectCls}>
                <option value="">All Services</option>
                {services.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {branches.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setBranchDropdownOpen(v => !v)}
                  className={`${selectCls} flex items-center gap-1.5 min-w-[140px]`}
                >
                  {branchFilter.length === 0
                    ? 'All Branches'
                    : `${branchFilter.length} Branch${branchFilter.length > 1 ? 'es' : ''}`}
                  {branchFilter.length > 0 && (
                    <span className="ml-1 bg-brand/20 text-brand text-xs px-1.5 py-0.5 rounded-full">{branchFilter.length}</span>
                  )}
                </button>
                <div className={`${branchDropdownOpen ? '' : 'hidden'} absolute z-20 mt-1 w-48 bg-surface-2 border border-line rounded-lg shadow-xl py-1 max-h-48 overflow-y-auto`}>
                  {branches.map(b => (
                    <label key={b} className="flex items-center gap-2 px-3 py-2 hover:bg-surface-3/50 cursor-pointer text-sm text-fg">
                      <input
                        type="checkbox"
                        checked={branchFilter.includes(b)}
                        onChange={() => setBranchFilter(prev =>
                          prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]
                        )}
                        className="rounded border-line bg-surface accent-brand focus:ring-brand focus:ring-offset-0"
                      />
                      {b}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <span className="ml-auto text-xs text-fg-faint">{filtered.length} of {payments.length} payments</span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <DollarSign className="w-10 h-10 text-fg-faint mx-auto mb-3" />
              <p className="text-fg-muted text-sm">
                {payments.length === 0 ? 'No payments recorded yet' : 'No payments match your filters'}
              </p>
              {payments.length === 0 && can(permissions, 'payments', 'create') && (
                <Button variant="primary" className="mt-4" onClick={() => setModalOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
                  Record first payment
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs text-fg-muted uppercase tracking-wide">
                      <th className="text-left px-5 py-3">Member</th>
                      <th className="text-left px-5 py-3">Amount</th>
                      <th className="text-left px-5 py-3">Service / Item</th>
                      <th className="text-left px-5 py-3">Branch</th>
                      <th className="text-left px-5 py-3">Specialist</th>
                      <th className="text-left px-5 py-3">Method</th>
                      <th className="text-left px-5 py-3">Source</th>
                      <th className="text-left px-5 py-3">Date</th>
                      <th className="text-left px-5 py-3">Status</th>
                      <th className="text-right px-5 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {paginated.map(payment => {
                      const sc = statusConfig[payment.status] ?? statusConfig.pending;
                      return (
                        <tr key={payment.id} className="hover:bg-surface-3/30 transition-colors">
                          <td className="px-5 py-3.5">
                            <Link href={`/dashboard/members/${payment.gym_member_id}`} className="flex items-center gap-3 hover:opacity-80">
                              <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center text-xs font-bold text-brand flex-shrink-0">
                                {String(payment.full_name ?? payment.member_number ?? "?").slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-fg font-medium hover:text-brand transition-colors">{payment.full_name}</p>
                                <p className="text-xs text-fg-faint">{payment.member_number}</p>
                              </div>
                            </Link>
                          </td>
                          <td className="px-5 py-3.5 font-semibold text-fg">
                            {fmt(payment.amount, payment.currency)}
                          </td>
                          <td className="px-5 py-3.5 min-w-[200px]">
                            {payment.service_name ? (
                              <div>
                                <p className="text-fg text-sm">{payment.service_name}</p>
                                {payment.service_type && (
                                  <p className="text-xs text-fg-faint mt-0.5 capitalize">
                                    {payment.service_type.replace(/_/g, ' ')}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-fg-faint text-xs">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            {payment.branch_name
                              ? <span className="text-xs px-2 py-0.5 rounded-full bg-brand/10 text-brand">{payment.branch_name}</span>
                              : <span className="text-fg-faint text-xs">—</span>}
                          </td>
                          <td className="px-5 py-3.5 min-w-[140px]">
                            {payment.specialist_name ? (
                              <p className="text-fg-muted text-sm">{payment.specialist_name}</p>
                            ) : (
                              <span className="text-fg-faint text-xs">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-fg-muted capitalize">
                            {methodLabel[payment.payment_method] ?? payment.payment_method}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                              payment.source === 'mobile_app'
                                ? 'bg-blue-400/10 text-blue-400'
                                : 'bg-brand/10 text-brand'
                            }`}>
                              {payment.source === 'mobile_app' ? 'Mobile App' : 'Admin'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-fg-muted">
                            {payment.paid_at
                              ? new Date(payment.paid_at).toLocaleDateString('en-GB')
                              : new Date(payment.created_at).toLocaleDateString('en-GB')}
                          </td>
                          <td className="px-5 py-3.5">
                            <Badge variant={sc.variant}>
                              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                              {sc.label}
                            </Badge>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center justify-end gap-1">
                              {/* Invoice / Receipt */}
                              <button
                                onClick={() => setInvoicePayment(payment)}
                                title={payment.status === 'paid' ? 'View Receipt' : 'View Invoice'}
                                className="p-1.5 rounded-lg text-fg-faint hover:text-brand hover:bg-brand/10 transition-colors"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                              {/* Refund — only on paid entries with remaining balance */}
                              {payment.status === 'paid' && payment.refunded_amount < payment.amount && can(permissions, 'payments', 'edit') && (
                                <button
                                  onClick={() => setRefundPayment(payment)}
                                  title="Process Refund"
                                  className="p-1.5 rounded-lg text-fg-faint hover:text-blue-400 hover:bg-blue-400/10 transition-colors"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              )}
                              {/* Quick status change */}
                              {payment.status !== 'paid' && payment.status !== 'refunded' && payment.status !== 'partial_refund' && can(permissions, 'payments', 'edit') && (
                                <button
                                  onClick={() => updateStatus(payment, 'paid')}
                                  disabled={updatingId === payment.id}
                                  title="Mark as Paid"
                                  className="p-1.5 rounded-lg text-fg-faint hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors disabled:opacity-40 text-xs font-medium"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                              )}
                              {payment.status === 'pending' && can(permissions, 'payments', 'edit') && (
                                <button
                                  onClick={() => updateStatus(payment, 'overdue')}
                                  disabled={updatingId === payment.id}
                                  title="Mark as Overdue"
                                  className="p-1.5 rounded-lg text-fg-faint hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                                >
                                  <AlertCircle className="w-4 h-4" />
                                </button>
                              )}
                              {payment.status === 'paid' && can(permissions, 'payments', 'edit') && (
                                <button
                                  onClick={() => updateStatus(payment, 'pending')}
                                  disabled={updatingId === payment.id}
                                  title="Mark as Pending"
                                  className="p-1.5 rounded-lg text-fg-faint hover:text-amber-400 hover:bg-amber-400/10 transition-colors disabled:opacity-40"
                                >
                                  <Clock className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-line">
                  <p className="text-xs text-fg-faint">
                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                      <button key={n} onClick={() => setPage(n)}
                        className={`w-8 h-8 text-xs rounded-lg transition-colors ${n === page ? 'bg-brand text-brand-ink font-medium' : 'text-fg-muted hover:text-fg hover:bg-surface-3'}`}>
                        {n}
                      </button>
                    ))}
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {modalOpen && <RecordPaymentModal memberOptions={memberOptions} serviceOptions={serviceOptions} trainerOptions={trainerOptions} branches={branchOptions} promoCodes={promoCodes} onClose={() => setModalOpen(false)} />}
      {invoicePayment && (
        <InvoiceModal payment={invoicePayment} gym={gym} onClose={() => setInvoicePayment(null)} />
      )}
      {refundPayment && (
        <RefundModal
          payment={refundPayment}
          onClose={() => setRefundPayment(null)}
          onRefunded={handleRefunded}
        />
      )}
      {reminderOpen && (
        <ReminderModal
          overduePayments={overduePayments}
          gym={gym}
          onClose={() => setReminderOpen(false)}
        />
      )}
    </>
  );
}
