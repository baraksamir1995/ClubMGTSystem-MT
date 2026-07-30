'use client';

import { useState, useEffect, useMemo } from 'react';
import { Star, MessageSquare, TrendingUp, Users, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
// Uses /api/reviews server route (admin client bypasses RLS)
import type { GymClass } from '@/app/dashboard/classes/page';
import { fmt12 } from '@/lib/time';

interface Props {
  gymId: string;
  classes: GymClass[];
}

interface Review {
  id: string;
  session_rating: number;
  trainer_rating: number | null;
  review: string | null;
  created_at: string;
  class_sessions: {
    id: string;
    session_date: string;
    start_time: string;
    classes: {
      id: string;
      name: string;
      class_type: string;
      color: string;
      instructor: string | null;
    };
  };
  gym_members: {
    id: string;
    user_id: string;
    member_number: string | null;
  };
}

interface Profile {
  id: string;
  full_name: string | null;
}

const SESSION_RATING_CONFIG: Record<number, { label: string; emoji: string; color: string; bgColor: string }> = {
  1: { label: 'Terrible', emoji: '😞', color: 'text-danger',  bgColor: 'bg-danger-soft' },
  2: { label: 'Bad',      emoji: '😐', color: 'text-accent',  bgColor: 'bg-accent/15' },
  3: { label: 'Okay',     emoji: '😐', color: 'text-warning', bgColor: 'bg-warning-soft' },
  4: { label: 'Good',     emoji: '😊', color: 'text-success', bgColor: 'bg-success-soft' },
  5: { label: 'Excellent',emoji: '😄', color: 'text-success', bgColor: 'bg-success-soft' },
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60)  return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label={`${value} out of ${max} stars`}>
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          aria-hidden
          className={`w-3.5 h-3.5 ${i < value ? 'text-warning fill-current' : 'text-fg-faint'}`}
        />
      ))}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const letter = name?.charAt(0)?.toUpperCase() ?? '?';
  return (
    <div className="w-9 h-9 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center flex-shrink-0">
      <span className="text-sm font-semibold text-brand">{letter}</span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-surface-2 border border-line rounded-xl p-5 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-surface-3 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-surface-3 rounded w-1/3" />
          <div className="h-3 bg-surface-3 rounded w-1/4" />
          <div className="h-3 bg-surface-3 rounded w-2/3 mt-2" />
        </div>
      </div>
    </div>
  );
}

const selectCls = 'bg-surface-3 border border-line text-sm text-fg rounded-lg px-3 py-2 focus:outline-none focus:border-brand transition-colors appearance-none pe-8';

export default function ReviewsTab({ gymId, classes }: Props) {
  const t = useTranslations('classes');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);

  const [classFilter, setClassFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState<'all' | 'positive' | 'negative'>('all');
  const [trainerFilter, setTrainerFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/reviews');
        if (!res.ok) { setLoading(false); return; }
        const data = await res.json();

        setReviews(data.reviews ?? []);

        const profileMap: Record<string, Profile> = {};
        for (const [id, name] of Object.entries(data.profiles ?? {})) {
          profileMap[id] = { id, full_name: name as string };
        }
        setProfiles(profileMap);
      } catch {}
      finally { setLoading(false); }
    }

    load();
  }, [gymId]);

  const trainers = useMemo(() => {
    const names = reviews
      .map(r => r.class_sessions?.classes?.instructor)
      .filter((v): v is string => !!v);
    return Array.from(new Set(names)).sort();
  }, [reviews]);

  const filtered = useMemo(() => {
    let list = [...reviews];
    if (classFilter !== 'all') {
      list = list.filter(r => r.class_sessions?.classes?.id === classFilter);
    }
    if (trainerFilter !== 'all') {
      list = list.filter(r => r.class_sessions?.classes?.instructor === trainerFilter);
    }
    if (ratingFilter === 'positive') {
      list = list.filter(r => r.session_rating >= 4);
    } else if (ratingFilter === 'negative') {
      list = list.filter(r => r.session_rating <= 2);
    }
    return list;
  }, [reviews, classFilter, trainerFilter, ratingFilter]);

  useEffect(() => { setPage(1); }, [classFilter, trainerFilter, ratingFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => {
    if (reviews.length === 0) return { avgSession: 0, avgTrainer: 0, total: 0 };
    const total = reviews.length;
    const avgSession = reviews.reduce((s, r) => s + r.session_rating, 0) / total;
    const trainerReviews = reviews.filter(r => r.trainer_rating != null);
    const avgTrainer = trainerReviews.length > 0
      ? trainerReviews.reduce((s, r) => s + (r.trainer_rating ?? 0), 0) / trainerReviews.length
      : 0;
    return { avgSession, avgTrainer, total, trainerCount: trainerReviews.length };
  }, [reviews]);

  function getMemberName(review: Review): string {
    const userId = review.gym_members?.user_id;
    const profile = userId ? profiles[userId] : null;
    if (profile?.full_name?.trim()) return profile.full_name.trim();
    const num = review.gym_members?.member_number;
    return num ? `Member #${num}` : 'Member';
  }

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-2 border border-line rounded-xl p-4">
          <p className="text-xs text-fg-muted mb-1 flex items-center gap-1.5">
            <TrendingUp aria-hidden className="w-3.5 h-3.5" /> {t('reviews.avgSessionRating')}
          </p>
          {loading ? (
            <div className="h-8 bg-surface-3 rounded w-16 animate-pulse mt-1" />
          ) : (
            <div className="flex items-end gap-2">
              <p className="text-2xl font-bold text-fg">
                {stats.total > 0 ? stats.avgSession.toFixed(1) : '—'}
              </p>
              {stats.total > 0 && (
                <p className="text-sm text-fg-muted mb-0.5">/ 5</p>
              )}
            </div>
          )}
        </div>

        <div className="bg-surface-2 border border-line rounded-xl p-4">
          <p className="text-xs text-fg-muted mb-1 flex items-center gap-1.5">
            <Star aria-hidden className="w-3.5 h-3.5" /> {t('reviews.avgTrainerRating')}
          </p>
          {loading ? (
            <div className="h-8 bg-surface-3 rounded w-16 animate-pulse mt-1" />
          ) : (
            <div className="flex items-end gap-2">
              <p className="text-2xl font-bold text-warning">
                {stats.trainerCount && stats.trainerCount > 0 ? stats.avgTrainer.toFixed(1) : '—'}
              </p>
              {stats.trainerCount && stats.trainerCount > 0 && (
                <p className="text-sm text-fg-muted mb-0.5">/ 5</p>
              )}
            </div>
          )}
        </div>

        <div className="bg-surface-2 border border-line rounded-xl p-4">
          <p className="text-xs text-fg-muted mb-1 flex items-center gap-1.5">
            <Users aria-hidden className="w-3.5 h-3.5" /> {t('reviews.totalReviews')}
          </p>
          {loading ? (
            <div className="h-8 bg-surface-3 rounded w-12 animate-pulse mt-1" />
          ) : (
            <p className="text-2xl font-bold text-brand">{stats.total}</p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface-2 border border-line rounded-xl p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Class filter */}
          <div className="relative">
            <select
              value={classFilter}
              onChange={e => setClassFilter(e.target.value)}
              className={selectCls}
            >
              <option value="all">{t('reviews.allClasses')}</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown aria-hidden className="absolute end-2 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted pointer-events-none" />
          </div>

          {/* Trainer filter */}
          <div className="relative">
            <select
              value={trainerFilter}
              onChange={e => setTrainerFilter(e.target.value)}
              className={selectCls}
            >
              <option value="all">{t('reviews.allTrainers')}</option>
              {trainers.map(tr => (
                <option key={tr} value={tr}>{tr}</option>
              ))}
            </select>
            <ChevronDown aria-hidden className="absolute end-2 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted pointer-events-none" />
          </div>

          {/* Rating filter */}
          <div className="relative">
            <select
              value={ratingFilter}
              onChange={e => setRatingFilter(e.target.value as 'all' | 'positive' | 'negative')}
              className={selectCls}
            >
              <option value="all">{t('reviews.allRatings')}</option>
              <option value="positive">{t('reviews.positive')}</option>
              <option value="negative">{t('reviews.negative')}</option>
            </select>
            <ChevronDown aria-hidden className="absolute end-2 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted pointer-events-none" />
          </div>

          <span className="ms-auto text-xs text-fg-faint">
            {loading ? '...' : (filtered.length !== 1 ? t('reviews.countPlural', { count: filtered.length }) : t('reviews.count', { count: filtered.length }))}
          </span>
        </div>
      </div>

      {/* Reviews list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
          <MessageSquare className="w-10 h-10 text-fg-faint mx-auto mb-3" />
          <p className="text-fg-muted text-sm">
            {reviews.length === 0 ? t('reviews.noReviewsYet') : t('reviews.noReviewsMatch')}
          </p>
        </div>
      ) : (
        <>
        <div className="space-y-3">
          {paginated.map(review => {
            const ratingCfg = SESSION_RATING_CONFIG[review.session_rating] ?? SESSION_RATING_CONFIG[3];
            const memberName = getMemberName(review);
            const sessionDate = review.class_sessions?.session_date
              ? new Date(review.class_sessions.session_date).toLocaleDateString('en-GB', {
                  weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
                })
              : '';
            const startTime = fmt12(review.class_sessions?.start_time);
            const className = review.class_sessions?.classes?.name ?? 'Unknown class';
            const classColor = review.class_sessions?.classes?.color ?? '#6b7280';
            const instructor = review.class_sessions?.classes?.instructor ?? null;
            const memberNumber = review.gym_members?.member_number ?? null;
            const isExpanded = expandedId === review.id;

            return (
              <button key={review.id} type="button"
                onClick={() => setExpandedId(isExpanded ? null : review.id)}
                className="w-full text-start bg-surface-2 border border-line rounded-xl p-5 hover:border-line-strong transition-colors">

                {/* Collapsed: member name, class, rating, time */}
                <div className="flex items-center gap-3">
                  <Avatar name={memberName} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-fg font-semibold text-sm">{memberName}</p>
                      {memberNumber && (
                        <span className="text-xs text-fg-faint font-mono bg-surface-3 px-1.5 py-0.5 rounded">
                          #{memberNumber}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: classColor }} />
                      <span className="text-xs text-fg-muted">{className}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ratingCfg.bgColor} ${ratingCfg.color}`}>
                      {ratingCfg.emoji} {review.session_rating}/5
                    </span>
                    <span className="text-xs text-fg-faint">{relativeTime(review.created_at)}</span>
                    {isExpanded
                      ? <ChevronUp aria-hidden className="w-4 h-4 text-fg-faint" />
                      : <ChevronDown aria-hidden className="w-4 h-4 text-fg-faint" />
                    }
                  </div>
                </div>

                {/* Expanded: full details */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-line space-y-2.5" onClick={e => e.stopPropagation()}>
                    {/* Session info */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: classColor }} />
                      <span className="text-xs text-fg-muted font-medium">{className}</span>
                      {sessionDate && (
                        <span className="text-xs text-fg-faint">
                          {sessionDate}{startTime ? ` · ${startTime}` : ''}
                        </span>
                      )}
                    </div>

                    {/* Trainer */}
                    {instructor && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-fg-faint">{t('reviews.trainerLabel')}</span>
                        <span className="text-xs text-fg-muted font-medium">{instructor}</span>
                      </div>
                    )}

                    {/* Ratings */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-fg-muted">{t('reviews.sessionLabel')}</span>
                        <StarRating value={review.session_rating} />
                      </div>
                      {review.trainer_rating != null && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-fg-muted">{t('reviews.trainerRatingLabel')}</span>
                          <StarRating value={review.trainer_rating} />
                        </div>
                      )}
                    </div>

                    {/* Review text */}
                    {review.review && review.review.trim() && (
                      <p className="text-sm text-fg-muted leading-relaxed bg-surface/50 rounded-lg px-3 py-2">
                        &quot;{review.review}&quot;
                      </p>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-fg-faint">
              {filtered.length !== 1 ? t('reviews.countPlural', { count: filtered.length }) : t('reviews.count', { count: filtered.length })}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                aria-label="Previous page"
                className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft aria-hidden className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                <button key={n} onClick={() => setPage(n)}
                  className={`w-8 h-8 text-xs rounded-lg transition-colors ${n === page ? 'bg-brand text-brand-ink font-medium' : 'text-fg-muted hover:text-fg hover:bg-surface-3'}`}>
                  {n}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                aria-label="Next page"
                className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronRight aria-hidden className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        </>
      )}
    </div>
  );
}
