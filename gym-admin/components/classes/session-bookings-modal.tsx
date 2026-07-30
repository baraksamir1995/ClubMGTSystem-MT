'use client';

import { useState, useEffect, useMemo } from 'react';
import { Users, CheckCircle, XCircle, Trash2, Search, UserPlus, Loader2, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import type { ClassSession } from '@/app/dashboard/classes/page';
import { fmt12, fmtTime12 } from '@/lib/time';
import { Avatar, Badge, type BadgeProps, Input, Modal } from '@/components/ui';

interface Booking {
  id: string;
  gym_member_id: string;
  status: 'booked' | 'confirmed' | 'attended' | 'absent';
  created_at: string;
  member_number: string;
  full_name: string | null;   // from manual add
  member_name: string | null; // from RPC
  email: string | null;
  member_email: string | null; // from RPC
}

interface GymMember {
  id: string;
  member_number: string;
  full_name: string | null;
  email: string | null;
}

interface Props {
  session: ClassSession;
  onClose: () => void;
  onBookingCountChange: (sessionId: string, count: number) => void;
}

export default function SessionBookingsModal({ session, onClose, onBookingCountChange }: Props) {
  const t = useTranslations('classes');
  const tc = useTranslations('common');

  const statusConfig: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
    booked:    { label: t('bookingsModal.statusBooked'),   variant: 'neutral' },
    confirmed: { label: t('bookingsModal.statusBooked'),   variant: 'neutral' },
    attended:  { label: t('bookingsModal.statusAttended'), variant: 'success' },
    absent:    { label: t('bookingsModal.statusAbsent'),   variant: 'danger' },
  };

  const [bookings, setBookings]       = useState<Booking[]>([]);
  const [loading, setLoading]         = useState(true);
  const [updatingId, setUpdatingId]   = useState<string | null>(null);

  // Add booking
  const [showAdd, setShowAdd]         = useState(false);
  const [members, setMembers]         = useState<GymMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [addingId, setAddingId]       = useState<string | null>(null);

  // Booking list search
  const [search, setSearch]           = useState('');

  useEffect(() => {
    fetch(`/api/sessions/${session.id}/bookings/detail`)
      .then(r => r.json())
      .then(d => setBookings(d.bookings ?? []))
      .catch(() => toast.error(t('bookingsModal.failedToLoadBookings')))
      .finally(() => setLoading(false));
  }, [session.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showAdd) return;
    setLoadingMembers(true);
    fetch('/api/members/list')
      .then(r => r.json())
      .then(d => setMembers(d.members ?? []))
      .catch(() => setMembers([]))
      .finally(() => setLoadingMembers(false));
  }, [showAdd]);

  const filteredBookings = useMemo(() => {
    if (!search.trim()) return bookings;
    const q = search.toLowerCase();
    return bookings.filter(b =>
      (b.full_name ?? b.member_name)?.toLowerCase().includes(q) || String(b.member_number ?? '').toLowerCase().includes(q)
    );
  }, [bookings, search]);

  const availableMembers = useMemo(() => {
    const bookedIds = new Set(bookings.map(b => b.gym_member_id));
    let list = members.filter(m => !bookedIds.has(m.id));
    if (memberSearch.trim()) {
      const q = memberSearch.toLowerCase();
      list = list.filter(m => m.full_name?.toLowerCase().includes(q) || String(m.member_number ?? '').toLowerCase().includes(q));
    }
    return list;
  }, [members, bookings, memberSearch]);

  const updateStatus = async (booking: Booking, newStatus: 'attended' | 'absent' | 'booked') => {
    setUpdatingId(booking.id);
    try {
      const res = await fetch(`/api/sessions/${session.id}/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? t('bookingsModal.failedToUpdate'));
        return;
      }
      const updated = bookings.map(b => b.id === booking.id ? { ...b, status: newStatus } : b);
      setBookings(updated);
      // booked_count = total active bookings (status changes don't affect count)
      onBookingCountChange(session.id, updated.length);
      toast.success(t('bookingsModal.markedAs', { status: newStatus }));
    } catch { toast.error(tc('networkError')); }
    finally { setUpdatingId(null); }
  };

  const removeBooking = async (booking: Booking) => {
    setUpdatingId(booking.id);
    try {
      const res = await fetch(`/api/sessions/${session.id}/bookings/${booking.id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error(t('bookingsModal.failedToRemove')); return; }
      const updated = bookings.filter(b => b.id !== booking.id);
      setBookings(updated);
      onBookingCountChange(session.id, updated.length);
      toast.success(t('bookingsModal.bookingRemoved'));
    } catch { toast.error(tc('networkError')); }
    finally { setUpdatingId(null); }
  };

  const addBooking = async (member: GymMember) => {
    setAddingId(member.id);
    try {
      const res = await fetch(`/api/sessions/${session.id}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gymMemberId: member.id }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? tc('somethingWrong')); return; }
      const newBooking: Booking = {
        id: data.id,
        gym_member_id: member.id,
        status: 'booked',
        created_at: new Date().toISOString(),
        member_number: member.member_number,
        full_name: member.full_name,
        member_name: member.full_name,
        email: member.email,
        member_email: member.email,
      };
      const updated = [...bookings, newBooking];
      setBookings(updated);
      onBookingCountChange(session.id, updated.length);
      toast.success(t('bookingsModal.memberAdded', { name: member.full_name ?? member.member_number }));
    } catch { toast.error(tc('networkError')); }
    finally { setAddingId(null); }
  };

  const attended = bookings.filter(b => b.status === 'attended').length;
  const absent   = bookings.filter(b => b.status === 'absent').length;
  const booked   = bookings.filter(b => b.status === 'booked' || b.status === 'confirmed').length;

  const sessionDate = new Date(session.session_date).toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <Modal open onClose={onClose} size="xl">
      <Modal.Header>
        <span className="flex items-start gap-3">
          <span className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: session.color }} />
          <span>
            {session.class_name}
            <span className="block text-sm text-fg-muted font-normal mt-0.5">
              {sessionDate} · {fmt12(session.start_time)}–{fmt12(session.end_time)}
              {session.instructor && <span className="ms-2 text-fg-faint">· {session.instructor}</span>}
            </span>
          </span>
        </span>
      </Modal.Header>

      {/* Summary + actions */}
      <div className="px-5 py-3 border-b border-line flex-shrink-0 flex items-center gap-4">
        <div className="flex gap-4">
          <div className="text-center">
            <p className="text-lg font-bold text-brand">{bookings.length}</p>
            <p className="text-xs text-fg-faint">{t('bookingsModal.total')}</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-info">{booked}</p>
            <p className="text-xs text-fg-faint">{t('bookingsModal.booked')}</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-success">{attended}</p>
            <p className="text-xs text-fg-faint">{t('bookingsModal.attended')}</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-danger">{absent}</p>
            <p className="text-xs text-fg-faint">{t('bookingsModal.absent')}</p>
          </div>
          {session.capacity && (
            <div className="text-center">
              <p className="text-lg font-bold text-fg-muted">{session.capacity - bookings.length}</p>
              <p className="text-xs text-fg-faint">{t('bookingsModal.spotsLeft')}</p>
            </div>
          )}
        </div>

        <div className="ms-auto flex items-center gap-2">
          {session.status === 'scheduled' && (
            <button
              onClick={() => setShowAdd(s => !s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showAdd ? 'bg-brand text-brand-ink' : 'bg-brand/15 hover:bg-brand/25 text-brand'}`}>
              <UserPlus aria-hidden className="w-3.5 h-3.5" />
              {t('bookingsModal.addMember')}
            </button>
          )}
          <div title={t('bookingsModal.qrScanMobile')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-3 text-fg-muted text-xs cursor-default">
            <QrCode aria-hidden className="w-3.5 h-3.5" />
            {t('bookingsModal.qrScanMobile')}
          </div>
        </div>
      </div>

      {/* Add member panel */}
      {showAdd && (
        <div className="px-5 py-3 border-b border-line bg-surface-3/20 flex-shrink-0">
          <div className="mb-2">
            <Input
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              placeholder={t('bookingsModal.searchMembers')}
              autoFocus
              leftIcon={<Search className="w-3.5 h-3.5" />}
            />
          </div>
          {loadingMembers ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-fg-muted" />
            </div>
          ) : availableMembers.length === 0 ? (
            <p className="text-xs text-fg-faint text-center py-3">
              {memberSearch ? t('bookingsModal.noMembersFound') : t('bookingsModal.allMembersBooked')}
            </p>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {availableMembers.slice(0, 20).map(m => (
                <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-3/50 transition-colors">
                  <Avatar name={m.full_name ?? m.member_number ?? '?'} size={28} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-fg font-medium truncate">{m.full_name ?? '—'}</p>
                    <p className="text-xs text-fg-faint font-mono">{m.member_number}</p>
                  </div>
                  <button
                    onClick={() => addBooking(m)}
                    disabled={addingId === m.id}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand hover:bg-brand-dim text-brand-ink text-xs font-medium transition-colors disabled:opacity-40">
                    {addingId === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                    {tc('add')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search bookings */}
      {bookings.length > 5 && (
        <div className="px-5 py-2 border-b border-line flex-shrink-0">
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('bookingsModal.searchBookedMembers')}
            leftIcon={<Search className="w-3.5 h-3.5" />} />
        </div>
      )}

      {/* Bookings list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-fg-muted" />
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="w-10 h-10 text-fg-faint mb-3" />
            <p className="text-sm text-fg-muted">
              {bookings.length === 0 ? t('bookingsModal.noBookingsYet') : t('bookingsModal.noMembersMatch')}
            </p>
            {bookings.length === 0 && session.status === 'scheduled' && (
              <button onClick={() => setShowAdd(true)}
                className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand hover:bg-brand-dim text-brand-ink text-xs font-medium transition-colors">
                <UserPlus aria-hidden className="w-3.5 h-3.5" /> {t('bookingsModal.addFirstMember')}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-fg-muted uppercase tracking-wide">
                <th scope="col" className="text-start px-5 py-3">{t('bookingsModal.colMember')}</th>
                <th scope="col" className="text-start px-5 py-3">{t('bookingsModal.colBookedAt')}</th>
                <th scope="col" className="text-start px-5 py-3">{t('bookingsModal.colStatus')}</th>
                <th scope="col" className="text-end px-5 py-3">{t('bookingsModal.colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredBookings.map(b => {
                const sc = statusConfig[b.status] ?? statusConfig.booked;
                const isUpdating = updatingId === b.id;
                return (
                  <tr key={b.id} className="hover:bg-surface-3/20 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={(b.full_name ?? b.member_name) ?? b.member_number ?? '?'} size={32} />
                        <div>
                          <p className="text-fg font-medium">{(b.full_name ?? b.member_name) ?? '—'}</p>
                          <p className="text-xs text-fg-faint font-mono">{b.member_number}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-fg-muted">
                      {new Date(b.created_at).toLocaleDateString('en-GB')}
                      <br />
                      <span className="text-fg-faint">{fmtTime12(new Date(b.created_at))}</span>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={sc.variant}>{sc.label}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {b.status !== 'attended' && (
                          <button
                            onClick={() => updateStatus(b, 'attended')}
                            disabled={isUpdating}
                            title={t('bookingsModal.titleMarkAttended')}
                            className="p-1.5 rounded-lg text-fg-faint hover:text-success hover:bg-success-soft transition-colors disabled:opacity-40">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {b.status !== 'absent' && (
                          <button
                            onClick={() => updateStatus(b, 'absent')}
                            disabled={isUpdating}
                            title={t('bookingsModal.titleMarkAbsent')}
                            className="p-1.5 rounded-lg text-fg-faint hover:text-danger hover:bg-danger-soft transition-colors disabled:opacity-40">
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                        {b.status !== 'booked' && (
                          <button
                            onClick={() => updateStatus(b, 'booked')}
                            disabled={isUpdating}
                            title={t('bookingsModal.titleResetBooking')}
                            className="p-1.5 rounded-lg text-fg-faint hover:text-info hover:bg-info-soft transition-colors disabled:opacity-40 text-xs font-mono">
                            ↺
                          </button>
                        )}
                        <button
                          onClick={() => removeBooking(b)}
                          disabled={isUpdating}
                          title={t('bookingsModal.titleRemoveBooking')}
                          className="p-1.5 rounded-lg text-fg-faint hover:text-danger hover:bg-danger-soft transition-colors disabled:opacity-40">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
