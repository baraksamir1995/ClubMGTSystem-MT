import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/membership_model.dart';
import '../models/membership_summary_model.dart';

/// One card to rule them all — replaces the per-plan-type variants
/// (sessions / duration / duration_session) with a single adaptive layout.
///
/// Reads the bucket-aware summary so totals and "next expiry" reflect the
/// aggregate of subscription + transferred buckets. The subscription row
/// (when present) drives the plan name, type, status, freeze actions.
///
/// Layout adapts:
///   - sessions-only plan       → big number = sessions, no days metric
///   - duration-only plan       → big number = days remaining, sessions row only if transfers exist
///   - duration_session plan    → both metrics shown
///   - no subscription, only transfers → "Transferred sessions" headline
class MembershipCardUnified extends StatelessWidget {
  final MembershipSummary summary;
  final MemberMembership? subscription;
  final Color primary;
  // Gym's secondary brand color. When provided we gradient primary →
  // secondary so the card carries both brand colors. Falls back to a
  // darkened primary when the gym only configured one color.
  final Color? secondary;
  final VoidCallback? onFreeze;
  final VoidCallback? onUnfreeze;

  const MembershipCardUnified({
    super.key,
    required this.summary,
    required this.primary,
    this.subscription,
    this.secondary,
    this.onFreeze,
    this.onUnfreeze,
  });

  @override
  Widget build(BuildContext context) {
    final isFrozen   = subscription?.isFrozen ?? false;
    final isExpired  = subscription?.isExpired ?? false;
    final hasSubscription = subscription != null;

    // Plan-shape detection drives which stats matter.
    final planType = subscription?.planType;
    final isSessionsOnly = planType == 'sessions';
    final isDurationOnly =
        planType == 'monthly' || planType == 'annual' || planType == 'duration';
    final isDurationSessions = planType == 'duration_session';
    final hasSessions =
        summary.totalSessions > 0 || summary.buckets.any((b) => b.isUnlimited);
    final hasDuration = isDurationOnly || isDurationSessions;

    // Days remaining (always derived from the *subscription's* end_date — for
    // duration-based access. Transferred-only members fall through to expiry
    // chip only.)
    final daysLeft = subscription?.endDate != null
        ? subscription!.endDate!.difference(DateTime.now()).inDays
        : null;
    final daysSafe = daysLeft != null && daysLeft >= 0 ? daysLeft : null;

    // Aggregated sessions across buckets — only counts bounded buckets.
    final sessionsRemaining = summary.totalSessions;
    final sessionsTotal = summary.buckets.fold<int>(0, (acc, b) {
      if (b.isUnlimited) return acc;
      return acc + (b.sessionsTotal ?? 0);
    });
    final sessionsUsed = (sessionsTotal - sessionsRemaining).clamp(0, sessionsTotal);
    final hasUnlimited = summary.buckets.any((b) => b.isUnlimited);

    // Pick the hero metric.
    final showSessionsHero = hasSessions || isSessionsOnly || isDurationSessions;
    final showDaysHero = hasDuration && daysSafe != null;

    // Live gradient uses the gym's branding (primary + secondary). Fallback
    // to a darkened primary when the gym only configured one color.
    final gradientStart = primary;
    final gradientEnd = secondary ?? _darken(primary, 0.18);

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isFrozen
              ? [const Color(0xFF1E3A8A), const Color(0xFF1E40AF)]
              : isExpired
                  ? [Colors.grey.shade800, Colors.grey.shade700]
                  : [gradientStart, gradientEnd],
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: (isFrozen ? Colors.blue : primary).withValues(alpha: 0.3),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Stack(
        children: [
          // Decorative blob
          Positioned(
            right: -40,
            top: -40,
            child: Container(
              width: 160,
              height: 160,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.06),
              ),
            ),
          ),
          Positioned(
            right: 30,
            bottom: -30,
            child: Container(
              width: 90,
              height: 90,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.04),
              ),
            ),
          ),

          Padding(
            padding: const EdgeInsets.all(22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Header: plan name + status pill ─────────────────
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'MEMBERSHIP',
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.65),
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 1.4,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            hasSubscription
                                ? (subscription!.planName ?? '—')
                                : 'Transferred sessions',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.4,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (hasSubscription && subscription!.planType != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: Text(
                                _planTypeLabel(subscription!.planType!),
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.7),
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    _StatusPill(
                      label: _statusLabel(subscription, isFrozen, isExpired),
                      bg: _statusBg(isFrozen, isExpired),
                    ),
                  ],
                ),

                const SizedBox(height: 20),

                // ── Hero metric ───────────────────────────────────────
                if (showSessionsHero)
                  _Hero(
                    big: hasUnlimited && summary.totalSessions == 0
                        ? '∞'
                        : '$sessionsRemaining',
                    label: hasUnlimited && summary.totalSessions == 0
                        ? 'unlimited sessions'
                        : 'sessions remaining',
                    sub: sessionsTotal > 0
                        ? 'of $sessionsTotal total'
                        : null,
                  )
                else if (showDaysHero)
                  _Hero(
                    big: '$daysSafe',
                    label: daysSafe == 1 ? 'day left' : 'days left',
                    sub: subscription!.endDate != null
                        ? 'until ${DateFormat('MMM d').format(subscription!.endDate!)}'
                        : null,
                  )
                else
                  _Hero(big: '—', label: 'no active access'),

                const SizedBox(height: 18),

                // ── Stat chips row ───────────────────────────────────
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    // Duration+Sessions plans: surface the subscription's own
                    // end date as "Membership expiry" (the 1-year-or-whatever
                    // term the member bought). Transferred-bucket expiries
                    // are still surfaced in the "Includes from transfers"
                    // callout below if they expire sooner.
                    if (isDurationSessions && subscription?.endDate != null)
                      _Chip(
                        icon: Icons.event_outlined,
                        label: 'Membership expiry',
                        value: DateFormat('MMM d, yyyy').format(subscription!.endDate!),
                      )
                    // Only show the nearest/end-date chip when there's a
                    // subscription in play — for transferred-only members the
                    // transferred bucket expiries are already surfaced in the
                    // "Includes from transfers" callout below.
                    else if (hasSubscription && summary.nextExpiryDate != null)
                      _Chip(
                        icon: Icons.event_outlined,
                        label: _isSubscriptionExpiryEarliest(subscription, summary)
                            ? 'End date'
                            : 'Nearest expiry',
                        value: DateFormat('MMM d').format(summary.nextExpiryDate!),
                      ),
                    if (isFrozen && subscription?.frozenUntil != null)
                      _Chip(
                        icon: Icons.ac_unit,
                        label: 'Frozen until',
                        value: DateFormat('MMM d').format(subscription!.frozenUntil!),
                        accent: Colors.blue.shade200,
                      ),
                  ],
                ),

                if (summary.transferredSessions > 0) ...[
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.redeem_outlined,
                            size: 14, color: Colors.white.withValues(alpha: 0.9)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _transferredLine(summary),
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.9),
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                // ── Freeze actions ──────────────────────────────────
                if (onFreeze != null || onUnfreeze != null) ...[
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      if (onFreeze != null)
                        Expanded(
                          child: _ActionButton(
                            label: 'Freeze',
                            icon: Icons.ac_unit,
                            onTap: onFreeze!,
                          ),
                        ),
                      if (onUnfreeze != null)
                        Expanded(
                          child: _ActionButton(
                            label: 'Unfreeze',
                            icon: Icons.local_fire_department_outlined,
                            onTap: onUnfreeze!,
                          ),
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  static String _planTypeLabel(String t) {
    switch (t) {
      case 'sessions':         return 'Sessions plan';
      case 'duration':         return 'Duration plan';
      case 'duration_session': return 'Full access';
      case 'monthly':          return 'Monthly plan';
      case 'annual':           return 'Annual plan';
      default:                 return t.replaceAll('_', ' ');
    }
  }

  static String _statusLabel(MemberMembership? m, bool isFrozen, bool isExpired) {
    if (m == null) return 'Active';
    if (isFrozen) return 'Frozen';
    if (isExpired) return 'Expired';
    return m.displayStatus;
  }

  static Color _statusBg(bool isFrozen, bool isExpired) {
    if (isFrozen) return Colors.blue.withValues(alpha: 0.35);
    if (isExpired) return Colors.red.withValues(alpha: 0.35);
    return Colors.white.withValues(alpha: 0.22);
  }

  static bool _isSubscriptionExpiryEarliest(MemberMembership? sub, MembershipSummary s) {
    if (sub?.endDate == null || s.nextExpiryDate == null) return false;
    // Truncate to date for comparison (timestamps may differ by hours).
    final a = DateTime(sub!.endDate!.year, sub.endDate!.month, sub.endDate!.day);
    final b = DateTime(s.nextExpiryDate!.year, s.nextExpiryDate!.month, s.nextExpiryDate!.day);
    return a.isAtSameMomentAs(b) || !b.isBefore(a);
  }

  /// Builds the "Includes N from transfers" callout. With one transfer, shows
  /// its own expiry. With multiple, switches to "nearest expiry" wording.
  static String _transferredLine(MembershipSummary s) {
    final transferred = s.buckets.where((b) => b.isTransferred).toList();
    final count = s.transferredSessions;
    final base = 'Includes $count session${count == 1 ? '' : 's'} from transfers';

    if (transferred.isEmpty) return base;

    final endDates = transferred
        .where((b) => b.endDate != null)
        .map((b) => b.endDate!)
        .toList()
      ..sort();
    if (endDates.isEmpty) return base;

    final earliest = endDates.first;
    final formatted = DateFormat('MMM d').format(earliest);
    if (transferred.length == 1) {
      return '$base · expires $formatted';
    }
    return '$base · nearest expiry $formatted';
  }

  static Color _darken(Color c, double amount) {
    final hsl = HSLColor.fromColor(c);
    return hsl.withLightness((hsl.lightness - amount).clamp(0.0, 1.0)).toColor();
  }
}

class _Hero extends StatelessWidget {
  final String big;
  final String label;
  final String? sub;
  const _Hero({required this.big, required this.label, this.sub});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text(
          big,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 56,
            fontWeight: FontWeight.w900,
            height: 0.95,
            letterSpacing: -2,
          ),
        ),
        const SizedBox(width: 10),
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              Text(
                label,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.85),
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (sub != null)
                Text(
                  sub!,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.65),
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}


class _Chip extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color? accent;
  const _Chip({
    required this.icon,
    required this.label,
    required this.value,
    this.accent,
  });

  @override
  Widget build(BuildContext context) {
    final fg = accent ?? Colors.white;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: fg.withValues(alpha: 0.85)),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: fg.withValues(alpha: 0.7),
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            value,
            style: TextStyle(
              color: fg,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  final String label;
  final Color bg;
  const _StatusPill({required this.label, required this.bg});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.4,
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  const _ActionButton({required this.label, required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.18),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 16, color: Colors.white),
              const SizedBox(width: 8),
              Text(
                label,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.3,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
