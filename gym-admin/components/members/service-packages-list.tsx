'use client';

import { useState } from 'react';
import { Dumbbell, Salad, HeartPulse, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 5;

const serviceIcon: Record<string, React.ElementType> = {
  personal_trainer: Dumbbell,
  nutritionist:     Salad,
  physiotherapist:  HeartPulse,
};
const serviceLabel: Record<string, string> = {
  personal_trainer: 'Personal Training',
  nutritionist:     'Nutrition',
  physiotherapist:  'Physiotherapy',
};
const statusCls: Record<string, string> = {
  active:    'bg-emerald-400/10 text-emerald-400',
  completed: 'bg-gray-400/10 text-gray-400',
  cancelled: 'bg-red-400/10 text-red-400',
};

export default function ServicePackagesList({ assignments }: { assignments: any[] }) {
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil(assignments.length / PAGE_SIZE);
  const slice = assignments.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mt-6">
      <div className="flex items-center gap-2 mb-4">
        <Dumbbell className="w-4 h-4 text-purple-400" />
        <h2 className="text-sm font-semibold text-white">Service Packages</h2>
        <span className="ml-auto text-xs text-gray-500">{assignments.length} assigned</span>
      </div>

      <div className="space-y-3">
        {slice.map((a) => {
          const Icon = serviceIcon[a.service_type] ?? Dumbbell;
          const used  = a.sessions_used  ?? 0;
          const total = a.sessions_total ?? 1;
          const pct   = Math.min(100, Math.round((used / total) * 100));
          return (
            <div key={a.id} className="bg-gray-700/30 rounded-xl p-4 border border-gray-700/50">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-gray-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-white">{a.package_name}</p>
                    <p className="text-xs text-gray-500">{serviceLabel[a.service_type] ?? a.service_type}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusCls[a.status] ?? 'bg-gray-400/10 text-gray-400'}`}>
                  {a.status}
                </span>
              </div>
              {a.trainer_name && (
                <p className="text-xs text-gray-500 mb-2">
                  Specialist: <span className="text-gray-300">{a.trainer_name}</span>
                </p>
              )}
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Sessions used</span>
                <span className="text-white font-medium">{used} / {total}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-1.5">
                <div className="bg-purple-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              {a.notes && (
                <p className="text-xs text-gray-600 mt-2 truncate" title={a.notes}>{a.notes}</p>
              )}
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
          <span className="text-xs text-gray-500">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={page === 0}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
