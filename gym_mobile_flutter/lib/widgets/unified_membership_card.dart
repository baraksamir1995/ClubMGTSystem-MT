import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/membership_summary_model.dart';

/// Unified membership card. Shows total usable sessions, the next bucket
/// expiry, and an expandable breakdown into original / transferred. Mirrors
/// the spec's "Membership Card Redesign — Goal: Display total usable sessions
/// while maintaining transparency of sources."
///
/// When the summary is null (still loading or failed), the caller is
/// expected to render a skeleton or fall back to the legacy per-plan card.
class UnifiedMembershipCard extends StatefulWidget {
  final MembershipSummary summary;
  final Color primary;

  const UnifiedMembershipCard({
    super.key,
    required this.summary,
    required this.primary,
  });

  @override
  State<UnifiedMembershipCard> createState() => _UnifiedMembershipCardState();
}

class _UnifiedMembershipCardState extends State<UnifiedMembershipCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final s = widget.summary;
    final color = widget.primary;
    final theme = Theme.of(context);

    final hasUnlimited = s.buckets.any((b) => b.isUnlimited);
    final showBreakdown = s.transferredSessions > 0;

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [color, color.withValues(alpha: 0.75)],
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.35),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'AVAILABLE SESSIONS',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.7),
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${s.totalSessions}',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 56,
                  fontWeight: FontWeight.w800,
                  height: 1,
                ),
              ),
              const SizedBox(width: 8),
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  s.totalSessions == 1 ? 'session' : 'sessions',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.85),
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              if (hasUnlimited) ...[
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.4)),
                  ),
                  child: const Text(
                    '+ Unlimited',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 12),
          if (s.nextExpiryDate != null)
            Row(
              children: [
                Icon(Icons.event_outlined,
                    size: 14, color: Colors.white.withValues(alpha: 0.85)),
                const SizedBox(width: 6),
                Text(
                  'Next expiry: ${DateFormat('MMM d, yyyy').format(s.nextExpiryDate!)}',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.85),
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          if (showBreakdown) ...[
            const SizedBox(height: 16),
            InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () => setState(() => _expanded = !_expanded),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  children: [
                    Icon(
                      _expanded ? Icons.expand_less : Icons.expand_more,
                      size: 18,
                      color: Colors.white.withValues(alpha: 0.85),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      _expanded ? 'Hide breakdown' : 'View breakdown',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.9),
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (_expanded) ...[
              const SizedBox(height: 8),
              _BreakdownPill(
                label: 'Original',
                value: s.originalSessions,
                theme: theme,
              ),
              const SizedBox(height: 8),
              _BreakdownPill(
                label: 'Transferred',
                value: s.transferredSessions,
                theme: theme,
              ),
            ],
          ],
        ],
      ),
    );
  }
}

class _BreakdownPill extends StatelessWidget {
  final String label;
  final int value;
  final ThemeData theme;

  const _BreakdownPill({
    required this.label,
    required this.value,
    required this.theme,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Text(
            label,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.85),
              fontSize: 13,
              fontWeight: FontWeight.w500,
            ),
          ),
          const Spacer(),
          Text(
            '$value',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
