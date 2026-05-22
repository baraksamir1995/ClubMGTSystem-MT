'use client';

import { useState, useEffect } from 'react';
import { X, CalendarDays, Clock, MapPin, Loader2 } from 'lucide-react';
import type { TrainerProfile } from './trainer-modal';
import { fmt12 } from '@/lib/time';

interface TrainerSession {
  id: string;
  class_name: string;
  class_type: string;
  color: string;
  session_date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  status: string;
}

interface Props {
  trainer: TrainerProfile;
  onClose: () => void;
}

export default function TrainerSessionsModal({ trainer, onClose }: Props) {
  const [sessions, setSessions] = useState<TrainerSession[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    fetch(`/api/trainers/${trainer.id}/sessions`)
      .then(r => r.json())
      .then(d => setSessions(d.sessions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [trainer.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-2 border border-line rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-surface-3 flex-shrink-0">
              {trainer.photo_url ? (
                <img src={trainer.photo_url} alt={trainer.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-brand/20">
                  <span className="text-sm font-bold text-brand">{trainer.name.slice(0, 2).toUpperCase()}</span>
                </div>
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold text-fg">{trainer.name}</h2>
              <p className="text-xs text-fg-muted">Upcoming assigned sessions</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-fg-muted" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CalendarDays className="w-10 h-10 text-fg-faint mb-3" />
              <p className="text-sm text-fg-muted">No upcoming sessions assigned</p>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {sessions.map(s => (
                <div key={s.id} className="flex items-start gap-3 px-5 py-4 hover:bg-surface-3/20 transition-colors">
                  <div className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: s.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-fg font-medium">{s.class_name}</p>
                    <p className="text-xs text-fg-faint capitalize mt-0.5">{s.class_type}</p>
                    <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-fg-faint">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        {new Date(s.session_date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {fmt12(s.start_time)} – {fmt12(s.end_time)}
                      </span>
                      {s.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{s.location}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400 font-medium flex-shrink-0">
                    Scheduled
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
