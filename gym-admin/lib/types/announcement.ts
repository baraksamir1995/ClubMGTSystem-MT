/**
 * "What's New" product announcements — platform updates authored by a
 * super-admin and shown in the gym-admin dashboard.
 *
 * Two shapes because the two audiences see different fields: the tenant
 * never receives targeting, draft status, or storage paths.
 */

export type AnnouncementMediaType = 'image' | 'video' | 'video_url';
export type AnnouncementStatus = 'draft' | 'published';
export type AnnouncementAudience = 'all' | 'selected';

/** What a gym-admin dashboard user receives. */
export interface Announcement {
  id: string;
  title: string;
  /** Sanitised HTML — safe to render, sanitised server-side on write. */
  content: string;
  /** Plain-text summary for list rows. */
  excerpt: string;
  media_type: AnnouncementMediaType | null;
  media_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  published_at: string | null;
  expires_at: string | null;
  is_expired: boolean;
  is_read: boolean;
  read_at: string | null;
  dismissed_at: string | null;
}

/** What the super-admin management screen receives. */
export interface AdminAnnouncement extends Omit<Announcement, 'is_read' | 'read_at' | 'dismissed_at'> {
  media_path: string | null;
  status: AnnouncementStatus;
  audience: AnnouncementAudience;
  gym_ids: string[];
  /** Published and not expired — the state the list badges as "Live". */
  is_live: boolean;
  /** Published with a publish date still in the future. */
  is_scheduled: boolean;
  reads_count: number;
  created_by: string | null;
  author_name: string | null;
  created_at: string;
  updated_at: string;
}
