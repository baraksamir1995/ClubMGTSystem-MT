import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../models/membership_model.dart';

/// US-03-01: Sessions-based membership card
class SessionsPlanCard extends StatelessWidget {
  final MemberMembership membership;

  const SessionsPlanCard({super.key, required this.membership});

  static const _gradientStart = Color(0xFF26215C);
  static const _gradientEnd = Color(0xFF534AB7);
  static const _pillBg = Color(0xFFAFA9EC);
  static const _pillText = Color(0xFF26215C);
  static const _activeBg = Color(0xFF1D9E75);
  static const _activeText = Color(0xFFE1F5EE);

  @override
  Widget build(BuildContext context) {
    final isUnlimited = membership.isUnlimitedSessions;
    final total = membership.effectiveSessionTotal ?? 0;
    final used = membership.sessionsUsed ?? 0;
    final remaining = membership.sessionsRemaining ?? total;
    final progress = !isUnlimited && total > 0 ? (used / total).clamp(0.0, 1.0) : 0.0;
    final usedPct = !isUnlimited && total > 0 ? ((used / total) * 100).round() : 0;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 15, 16, 15),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_gradientStart, _gradientEnd],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Row 1: plan name + badges
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      membership.planName ?? 'Sessions Plan',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        height: 1.2,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _buildPlanTypePill(),
                        if (membership.isTransferred) ...[
                          const SizedBox(width: 6),
                          _buildTransferredPill(),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              _buildStatusBadge(),
            ],
          ),

          const SizedBox(height: 14),

          // Row 2: primary metric + expiry
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              // Sessions remaining (large) — or "Unlimited" label
              if (isUnlimited)
                const Text(
                  'Unlimited',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    height: 1,
                  ),
                )
              else ...[
                Text(
                  '$remaining',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    height: 1,
                  ),
                ),
                const SizedBox(width: 4),
                Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Text(
                    'of $total',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.55),
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
              const Spacer(),
              if (membership.endDate != null)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      'Expires',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.55),
                        fontSize: 10,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    Text(
                      DateFormat('MMM d').format(membership.endDate!),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
            ],
          ),

          const SizedBox(height: 12),

          if (isUnlimited)
            // Unlimited plan — progress bar doesn't apply, just show used count
            Text(
              '$used sessions used so far',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.7),
                fontSize: 11,
                fontWeight: FontWeight.w500,
              ),
            )
          else ...[
            // Progress bar
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progress,
                minHeight: 6,
                backgroundColor: Colors.white.withValues(alpha: 0.15),
                valueColor: const AlwaysStoppedAnimation<Color>(_pillBg),
              ),
            ),

            const SizedBox(height: 6),

            // Progress labels
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '0 sessions',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.5),
                    fontSize: 10,
                  ),
                ),
                Text(
                  '$used used · $usedPct%',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.7),
                    fontSize: 10,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                Text(
                  '$total sessions',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.5),
                    fontSize: 10,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildPlanTypePill() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: _pillBg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: const Text(
        'Sessions plan',
        style: TextStyle(
          color: _pillText,
          fontSize: 9,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.2,
        ),
      ),
    );
  }

  Widget _buildTransferredPill() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF3D6),
        borderRadius: BorderRadius.circular(20),
      ),
      child: const Text(
        'Transferred',
        style: TextStyle(
          color: Color(0xFF8A5A00),
          fontSize: 9,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.2,
        ),
      ),
    );
  }

  Widget _buildStatusBadge() {
    final isFrozen = membership.isFrozen;
    final isActive = membership.isActive;
    final Color bg = isFrozen
        ? const Color(0xFF1E40AF)
        : isActive
            ? _activeBg
            : Colors.orange.shade800;
    final String label = isFrozen
        ? '❄ Frozen'
        : isActive
            ? 'Active'
            : membership.displayStatus;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
