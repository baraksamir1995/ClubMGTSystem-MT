import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../models/membership_model.dart';
import '../../../providers/auth_provider.dart';

/// Duration-based membership card (unlimited / limited / day_pass plans).
/// Shows a warm brown gradient with a time-based progress bar.
class DurationPlanCard extends StatelessWidget {
  final MemberMembership membership;

  const DurationPlanCard({super.key, required this.membership});

  static const _gradientStart = Color(0xFF3D1A00);
  static const _gradientEnd = Color(0xFF7A4A18);
  static const _pillBg = Color(0xFFD4905A);
  static const _pillText = Color(0xFF3D1A00);
  static const _barFill = Color(0xFFD4905A);

  String _planTypeLabel() {
    switch (membership.planType) {
      case 'unlimited':
        return 'Duration plan';
      case 'limited':
        return 'Duration plan';
      case 'day_pass':
        return 'Day pass';
      default:
        return 'Duration plan';
    }
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final start = membership.startDate;
    final end = membership.endDate;

    final daysLeft = end != null ? end.difference(now).inDays : null;
    final totalDays = (start != null && end != null)
        ? end.difference(start).inDays
        : null;
    final daysElapsed =
        (start != null) ? now.difference(start).inDays : null;

    final progress = (totalDays != null && totalDays > 0 && daysElapsed != null)
        ? (daysElapsed / totalDays).clamp(0.0, 1.0)
        : 0.0;
    final usedPct = totalDays != null && totalDays > 0 && daysElapsed != null
        ? ((daysElapsed / totalDays) * 100).round()
        : 0;

    final isExpiringSoon = daysLeft != null && daysLeft <= 7 && daysLeft >= 0;
    final isExpired = daysLeft != null && daysLeft < 0;

    final isFrozen = membership.isFrozen;

    String statusLabel;
    Color statusBg;
    if (isFrozen) {
      statusLabel = '❄ Frozen';
      statusBg = const Color(0xFF1E40AF);
    } else if (isExpired) {
      statusLabel = 'Expired';
      statusBg = Colors.red.shade800;
    } else if (isExpiringSoon) {
      statusLabel = 'Expiring soon';
      statusBg = const Color(0xFFD97706);
    } else {
      statusLabel = 'Active';
      statusBg = const Color(0xFF1D9E75);
    }

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_gradientStart, _gradientEnd],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 15, 16, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Row 1: plan name + status badge
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        membership.planName ?? 'Membership',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          height: 1.2,
                        ),
                      ),
                      const SizedBox(height: 6),
                      // Plan type pill
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: _pillBg,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          _planTypeLabel(),
                          style: const TextStyle(
                            color: _pillText,
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.2,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                // Status badge
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusBg,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    statusLabel,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 14),

            // Row 2: days remaining | started | expires
            Row(
              children: [
                // Days remaining (left — primary metric)
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Days remaining',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.6),
                          fontSize: 10,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        daysLeft != null
                            ? (daysLeft > 0 ? '${daysLeft} days' : 'Today')
                            : '—',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 22,
                          fontWeight: FontWeight.w700,
                          height: 1,
                        ),
                      ),
                    ],
                  ),
                ),
                // Started (center)
                if (start != null)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Text(
                        'Started',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.6),
                          fontSize: 10,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        DateFormat('MMM d').format(start),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                if (start != null) const SizedBox(width: 20),
                // Expires (right)
                if (end != null)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        'Expires',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.6),
                          fontSize: 10,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        DateFormat('MMM d').format(end),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
              ],
            ),

            const SizedBox(height: 12),

            // Progress bar
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progress,
                minHeight: 6,
                backgroundColor: Colors.white.withValues(alpha: 0.15),
                valueColor: const AlwaysStoppedAnimation<Color>(_barFill),
              ),
            ),

            const SizedBox(height: 6),

            // Progress labels
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Day 1',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.5),
                    fontSize: 10,
                  ),
                ),
                Text(
                  '$usedPct% used',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.7),
                    fontSize: 10,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                Text(
                  totalDays != null ? 'Day $totalDays' : '',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.5),
                    fontSize: 10,
                  ),
                ),
              ],
            ),

            const SizedBox(height: 12),

            // Bottom banner: expiry notice + renew
            if (daysLeft != null && daysLeft <= 30) ...[
              Container(
                height: 1,
                color: Colors.white.withValues(alpha: 0.15),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      daysLeft <= 0
                          ? 'Plan has expired'
                          : 'Expiring in $daysLeft days',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.8),
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    if (context.watch<AuthProvider>().gym?.mobilePaymentsEnabled ?? true)
                      GestureDetector(
                        onTap: () {},
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.3),
                            ),
                          ),
                          child: const Text(
                            'Renew now ›',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ] else
              const SizedBox(height: 15),
          ],
        ),
      ),
    );
  }
}
