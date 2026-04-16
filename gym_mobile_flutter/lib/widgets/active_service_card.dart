import 'package:flutter/material.dart';
import '../models/membership_model.dart';

class ActiveServiceCard extends StatelessWidget {
  final MemberMembership membership;
  final Color primaryColor;
  final VoidCallback? onFreeze;
  final VoidCallback? onUnfreeze;

  const ActiveServiceCard({
    super.key,
    required this.membership,
    required this.primaryColor,
    this.onFreeze,
    this.onUnfreeze,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isFrozen = membership.isFrozen;
    final isExpired = membership.isExpired;

    Color cardColor;
    Color borderColor;
    if (isFrozen) {
      cardColor = const Color(0xFF0D1B2A);
      borderColor = const Color(0xFF3B82F6).withValues(alpha: 0.4);
    } else if (isExpired) {
      cardColor = theme.colorScheme.surfaceContainerHighest;
      borderColor = theme.colorScheme.outline.withValues(alpha: 0.3);
    } else {
      cardColor = Colors.white;
      borderColor = const Color(0xFFE8E6E0);
    }

    return Container(
      decoration: BoxDecoration(
        color: cardColor,
        border: Border.all(color: borderColor, width: 1),
        borderRadius: BorderRadius.circular(16),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row: plan name + status badge
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      membership.planName ?? '—',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: isFrozen
                            ? Colors.white
                            : isExpired
                                ? theme.colorScheme.onSurfaceVariant
                                : const Color(0xFF1D1D1B),
                      ),
                    ),
                    if (membership.planType != null)
                      Text(
                        membership.planType!
                            .replaceAll('_', ' ')
                            .split(' ')
                            .map((w) => w.isEmpty
                                ? w
                                : '${w[0].toUpperCase()}${w.substring(1)}')
                            .join(' '),
                        style: TextStyle(
                          fontSize: 11,
                          color: isFrozen
                              ? Colors.blue.shade300
                              : theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                  ],
                ),
              ),
              _StatusBadge(status: membership.displayStatus),
            ],
          ),

          const SizedBox(height: 14),

          // Dates row
          if (membership.startDate != null || membership.endDate != null) ...[
            Row(
              children: [
                if (membership.startDate != null)
                  _DateChip(
                    label: 'Started',
                    value: _formatDate(membership.startDate!),
                    icon: Icons.calendar_today_outlined,
                    textColor: isFrozen ? Colors.white70 : null,
                  ),
                if (membership.startDate != null && membership.endDate != null)
                  const SizedBox(width: 12),
                if (membership.endDate != null)
                  _DateChip(
                    label: isFrozen ? 'New expiry' : 'Expires',
                    value: _formatDate(membership.endDate!),
                    icon: Icons.event_outlined,
                    textColor: isFrozen
                        ? Colors.blue.shade300
                        : isExpired
                            ? Colors.red.shade400
                            : null,
                  ),
              ],
            ),
            const SizedBox(height: 12),
          ],

          // Days remaining progress bar
          if (membership.endDate != null && !isExpired) ...[
            _DaysProgress(membership: membership, primaryColor: primaryColor, isFrozen: isFrozen),
            const SizedBox(height: 12),
          ],

          // Sessions remaining
          if (membership.sessionsRemaining != null) ...[
            _SessionsProgress(membership: membership, primaryColor: primaryColor),
            const SizedBox(height: 12),
          ],

          // Frozen: show resume info
          if (isFrozen && membership.frozenUntil != null) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              decoration: BoxDecoration(
                color: Colors.blue.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.ac_unit, size: 14, color: Colors.blue),
                  const SizedBox(width: 6),
                  Text(
                    'Resumes ${_formatDate(membership.frozenUntil!)}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Colors.blue,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
          ],

          // Action buttons
          if (!isExpired) ...[
            if (isFrozen && onUnfreeze != null)
              _ActionButton(
                label: 'Unfreeze Plan',
                icon: Icons.play_circle_outline,
                color: Colors.blue,
                onTap: onUnfreeze!,
              ),
            if (!isFrozen && membership.canFreeze && onFreeze != null)
              _ActionButton(
                label: 'Freeze Plan',
                icon: Icons.ac_unit,
                color: primaryColor,
                onTap: onFreeze!,
              ),
          ],
        ],
      ),
    );
  }

  String _formatDate(DateTime d) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${d.day} ${months[d.month - 1]} ${d.year}';
  }
}

// ── Sub-widgets ───────────────────────────────────────────────────────────────

class _StatusBadge extends StatelessWidget {
  final String status;
  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    switch (status) {
      case 'Active':
        bg = const Color(0xFF16A34A).withValues(alpha: 0.12);
        fg = const Color(0xFF16A34A);
        break;
      case 'Frozen':
        bg = Colors.blue.withValues(alpha: 0.15);
        fg = Colors.blue;
        break;
      case 'Expired':
        bg = Colors.red.withValues(alpha: 0.12);
        fg = Colors.red;
        break;
      default:
        bg = Colors.grey.withValues(alpha: 0.12);
        fg = Colors.grey;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
      child: Text(
        status == 'Frozen' ? '❄ Frozen' : status,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: fg),
      ),
    );
  }
}

class _DateChip extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color? textColor;
  const _DateChip({required this.label, required this.value, required this.icon, this.textColor});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = textColor ?? theme.colorScheme.onSurfaceVariant;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: color),
        const SizedBox(width: 4),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: TextStyle(fontSize: 10, color: color.withValues(alpha: 0.7))),
            Text(value, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color)),
          ],
        ),
      ],
    );
  }
}

class _DaysProgress extends StatelessWidget {
  final MemberMembership membership;
  final Color primaryColor;
  final bool isFrozen;
  const _DaysProgress({required this.membership, required this.primaryColor, required this.isFrozen});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final endDate = membership.endDate ?? DateTime.now();
    final totalDays = endDate.difference(membership.startDate ?? endDate).inDays;
    final daysLeft = endDate.difference(DateTime.now()).inDays.clamp(0, totalDays > 0 ? totalDays : 1);
    final progress = totalDays > 0 ? (daysLeft / totalDays).clamp(0.0, 1.0) : 0.0;
    final barColor = isFrozen ? Colors.blue : primaryColor;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              '$daysLeft days remaining',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: isFrozen ? Colors.white70 : theme.colorScheme.onSurface,
              ),
            ),
          ],
        ),
        const SizedBox(height: 5),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: progress,
            minHeight: 5,
            backgroundColor: barColor.withValues(alpha: 0.15),
            valueColor: AlwaysStoppedAnimation<Color>(barColor),
          ),
        ),
      ],
    );
  }
}

class _SessionsProgress extends StatelessWidget {
  final MemberMembership membership;
  final Color primaryColor;
  const _SessionsProgress({required this.membership, required this.primaryColor});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final total = membership.sessionCount ?? 1;
    final used = membership.sessionsUsed ?? 0;
    final remaining = membership.sessionsRemaining ?? 0;
    final progress = (used / total).clamp(0.0, 1.0);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              '$remaining sessions remaining',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: theme.colorScheme.onSurface),
            ),
            Text('$used / $total', style: TextStyle(fontSize: 11, color: theme.colorScheme.onSurfaceVariant)),
          ],
        ),
        const SizedBox(height: 5),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: progress,
            minHeight: 5,
            backgroundColor: primaryColor.withValues(alpha: 0.15),
            valueColor: AlwaysStoppedAnimation<Color>(primaryColor),
          ),
        ),
      ],
    );
  }
}

class _ActionButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  const _ActionButton({required this.label, required this.icon, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: onTap,
        icon: Icon(icon, size: 16),
        label: Text(label),
        style: OutlinedButton.styleFrom(
          foregroundColor: color,
          side: BorderSide(color: color.withValues(alpha: 0.5)),
          padding: const EdgeInsets.symmetric(vertical: 10),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
        ),
      ),
    );
  }
}
