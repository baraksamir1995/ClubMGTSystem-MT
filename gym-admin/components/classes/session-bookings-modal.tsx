'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Users, CheckCircle, XCircle, Trash2, Search, UserPlus, Loader2, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';
import type { ClassSession } from '@/app/dashboard/classes/page';
import { fmt12, fmtTime12 } from '@/lib/time';

interface Booking {
  id: string;
  gym_member_id: string;
  status: 'booked' | 'attended' | 'absent';
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

const statusConfig: Record<string, { label: string; cls: string }> = {
  booked:    { label: 'Booked',   cls: 'bg-blue-400/10 text-blue-400' },
  confirmed: { label: 'Booked',   cls: 'bg-blue-400/10 text-blue-400' },
  attended:  { label: 'Attended', cls: 'bg-emerald-400/10 text-emerald-400' },
  absent:    { label: 'Absent',   cls: 'bg-red-400/10 text-red-400' },
};

export default function SessionBookingsModal({ session, onClose, onBookingCountChange }: Props) {
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
      .catch(() => toast.error('Failed to load bookings'))
      .finally(() => setLoading(false));
  }, [session.id]);

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
      if (!res.ok) { toast.error('Failed to update'); return; }
      const updated = bookings.map(b => b.id === booking.id ? { ...b, status: newStatus } : b);
      setBookings(updated);
      // booked_count = total active bookings (status changes don't affect count)
      onBookingCountChange(session.id, updated.length);
      toast.success(`Marked as ${newStatus}`);
    } catch { toast.error('Network error'); }
    finally { setUpdatingId(null); }
  };

  const removeBooking = async (booking: Booking) => {
    setUpdatingId(booking.id);
    try {
      const res = await fetch(`/api/sessions/${session.id}/bookings/${booking.id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Failed to remove'); return; }
      const updated = bookings.filter(b => b.id !== booking.id);
      setBookings(updated);
      onBookingCountChange(session.id, updated.length);
      toast.success('Booking removed');
    } catch { toast.error('Network error'); }
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
      if (!res.ok) { toast.error(data.error ?? 'Failed to add'); return; }
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
      toast.success(`${member.full_name ?? member.member_number} added`);
    } catch { toast.error('Network error'); }
    finally { setAddingId(null); }
  };

  const attended = bookings.filter(b => b.status === 'attended').length;
  const absent   = bookings.filter(b => b.status === 'absent').length;
  const booked   = bookings.filter(b => b.status === 'booked' || b.status === 'confirmed').length;

  const sessionDate = new Date(session.session_date).toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: session.color }} />
            <div>
              <h2 className="text-base font-semibold text-white">{session.class_name}</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {sessionDate} · {fmt12(session.start_time)}–{fmt12(session.end_time)}
                {session.instructor && <span className="ml-2 text-gray-500">· {session.instructor}</span>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary + actions */}
        <div className="px-5 py-3 border-b border-gray-700 flex-shrink-0 flex items-center gap-4">
          <div className="flex gap-4">
            <div className="text-center">
              <p className="text-lg font-bold text-purple-400">{bookings.length}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-blue-400">{booked}</p>
              <p className="text-xs text-gray-500">Booked</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-emerald-400">{attended}</p>
              <p className="text-xs text-gray-500">Attended</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-red-400">{absent}</p>
              <p className="text-xs text-gray-500">Absent</p>
            </div>
            {session.capacity && (
              <div className="text-center">
                <p className="text-lg font-bold text-gray-400">{session.capacity - bookings.length}</p>
                <p className="text-xs text-gray-500">Spots left</p>
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {session.status === 'scheduled' && (
              <button
                onClick={() => setShowAdd(s => !s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showAdd ? 'bg-purple-600 text-white' : 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-400'}`}>
                <UserPlus className="w-3.5 h-3.5" />
                Add Member
              </button>
            )}
            <div title="QR code scanning available via mobile app" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 text-gray-400 text-xs cursor-default">
              <QrCode className="w-3.5 h-3.5" />
              QR Scan (Mobile)
            </div>
          </div>
        </div>

        {/* Add member panel */}
        {showAdd && (
          <div className="px-5 py-3 border-b border-gray-700 bg-gray-700/20 flex-shrink-0">
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                placeholder="Search members to add…"
                autoFocus
                className="w-full pl-8 pr-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>
            {loadingMembers ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            ) : availableMembers.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-3">
                {memberSearch ? 'No members found' : 'All members already booked'}
              </p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {availableMembers.slice(0, 20).map(m => (
                  <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-700/50 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-purple-600/20 flex items-center justify-center text-xs font-bold text-purple-400 flex-shrink-0">
                      {String(m.full_name ?? m.member_number ?? '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">{m.full_name ?? '—'}</p>
                      <p className="text-xs text-gray-500 font-mono">{m.member_number}</p>
                    </div>
                    <button
                      onClick={() => addBooking(m)}
                      disabled={addingId === m.id}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition-colors disabled:opacity-40">
                      {addingId === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search bookings */}
        {bookings.length > 5 && (
          <div className="px-5 py-2 border-b border-gray-700 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search booked members…"
                className="w-full pl-8 pr-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
            </div>
          </div>
        )}

        {/* Bookings list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="w-10 h-10 text-gray-600 mb-3" />
              <p className="text-sm text-gray-400">
                {bookings.length === 0 ? 'No bookings yet' : 'No members match your search'}
              </p>
              {bookings.length === 0 && session.status === 'scheduled' && (
                <button onClick={() => setShowAdd(true)}
                  className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition-colors">
                  <UserPlus className="w-3.5 h-3.5" /> Add first member
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-xs text-gray-400 uppercase tracking-wide">
                  <th className="text-left px-5 py-3">Member</th>
                  <th className="text-left px-5 py-3">Booked At</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-right px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {filteredBookings.map(b => {
                  const sc = statusConfig[b.status] ?? statusConfig.booked;
                  const isUpdating = updatingId === b.id;
                  return (
                    <tr key={b.id} className="hover:bg-gray-700/20 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center text-xs font-bold text-purple-400 flex-shrink-0">
                            {String((b.full_name ?? b.member_name) ?? b.member_number ?? '?').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-white font-medium">{(b.full_name ?? b.member_name) ?? '—'}</p>
                            <p className="text-xs text-gray-500 font-mono">{b.member_number}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-400">
                        {new Date(b.created_at).toLocaleDateString('en-GB')}
                        <br />
                        <span className="text-gray-600">{fmtTime12(new Date(b.created_at))}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${sc.cls}`}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {b.status !== 'attended' && (
                            <button
                              onClick={() => updateStatus(b, 'attended')}
                              disabled={isUpdating}
                              title="Mark Attended"
                              className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors disabled:opacity-40">
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          {b.status !== 'absent' && (
                            <button
                              onClick={() => updateStatus(b, 'absent')}
                              disabled={isUpdating}
                              title="Mark Absent"
                              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40">
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                          {b.status !== 'booked' && (
                            <button
                              onClick={() => updateStatus(b, 'booked')}
                              disabled={isUpdating}
                              title="Reset to Booked"
                              className="p-1.5 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 transition-colors disabled:opacity-40 text-xs font-mono">
                              ↺
                            </button>
                          )}
                          <button
                            onClick={() => removeBooking(b)}
                            disabled={isUpdating}
                            title="Remove Booking"
                            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
