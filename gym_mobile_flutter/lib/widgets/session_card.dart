import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/session_model.dart';
import '../utils/theme.dart';
import '../features/branches/branch_provider.dart';
import 'rating_sheet.dart';

class SessionCard extends StatelessWidget {
  final Session session;
  final VoidCallback? onBook;
  final VoidCallback? onCancel;
  final bool isLoading;
  final VoidCallback? onTap;

  const SessionCard({
    super.key,
    required this.session,
    this.onBook,
    this.onCancel,
    this.isLoading = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    Color accentColor = theme.colorScheme.primary;
    if (session.classColor != null && session.classColor!.isNotEmpty) {
      try {
        accentColor = AppTheme.colorFromHex(session.classColor!);
      } catch (_) {}
    }

    final branchProvider = Provider.of<BranchProvider>(context);
    final branchName = (branchProvider.isMultiBranch && session.branchId != null)
        ? branchProvider.branchById(session.branchId!)?.name
        : null;

    final endTime = session.endTime;
    final capacity = session.capacity;
    final booked = session.bookedCount ?? 0;
    final spotsLeft = capacity != null ? capacity - booked : null;
    final isFull = spotsLeft != null && spotsLeft <= 0;
    final isAttended = session.bookingStatus == 'attended';
    final isBooked = session.isBooked;
    final isCancelled = session.status == 'cancelled';
    final now = DateTime.now();
    final isFinished = endTime != null && now.isAfter(endTime);
    final isOngoing =
        now.isAfter(session.scheduledAt) && (endTime == null || now.isBefore(endTime));

    // Cancelled: grey border; Full: red border; else default
    final cardBorderColor = isCancelled
        ? theme.colorScheme.outline.withValues(alpha: 0.2)
        : isFull && !isBooked && !isAttended
            ? Colors.red.withValues(alpha: 0.4)
            : theme.colorScheme.outline.withValues(alpha: 0.15);

    return Opacity(
      opacity: isCancelled ? 0.55 : 1.0,
      child: Card(
      clipBehavior: Clip.antiAlias,
      elevation: 0,
      color: isCancelled
          ? theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.4)
          : theme.colorScheme.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: cardBorderColor, width: 1.2),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Thick left accent bar ──────────────────────────
              Container(
                width: 5,
                decoration: BoxDecoration(
                  color: accentColor,
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(14),
                    bottomLeft: Radius.circular(14),
                  ),
                ),
              ),
              // ── Card body ──────────────────────────────────────
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(12, 14, 12, 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Row 1: Class name + chevron
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  session.className ?? 'Class',
                                  style: theme.textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 16,
                                  ),
                                ),
                              ),
                              Icon(
                                Icons.chevron_right_rounded,
                                size: 20,
                                color: theme.colorScheme.onSurfaceVariant
                                    .withValues(alpha: 0.4),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),

                          // Row 2: Instructor · Location
                          _buildMetaRow(theme),
                          const SizedBox(height: 6),

                          // Row 3: Time (fixed indigo)
                          Row(
                            children: [
                              const Icon(Icons.access_time_rounded,
                                  size: 14, color: Color(0xFF6366F1)),
                              const SizedBox(width: 5),
                              Text(
                                _formatTime(session.scheduledAt, endTime),
                                style: const TextStyle(
                                  color: Color(0xFF6366F1),
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),

                          // Row 4: Capacity bar
                          if (capacity != null) ...[
                            const SizedBox(height: 10),
                            _buildCapacityBar(theme, accentColor, capacity,
                                booked, spotsLeft, isFull),
                          ],

                          const SizedBox(height: 10),

                          // Row 5: Type chip + branch chip + status badge
                          Row(
                            children: [
                              if (session.classType != null) ...[
                                _TypeChip(
                                  label: _capitalize(session.classType!),
                                  accentColor: accentColor,
                                ),
                                const SizedBox(width: 6),
                              ],
                              if (branchName != null) ...[
                                _BranchChip(name: branchName),
                                const SizedBox(width: 6),
                              ],
                              _StatusBadge(
                                start: session.scheduledAt,
                                end: endTime,
                                isBooked: isBooked,
                                isAttended: isAttended,
                                isFull: isFull,
                                isCancelled: isCancelled,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),

                    // ── Bottom action bar ────────────────────────
                    _buildActionBar(
                      context,
                      theme,
                      accentColor,
                      isAttended: isAttended,
                      isBooked: isBooked,
                      isFinished: isFinished,
                      isOngoing: isOngoing,
                      isFull: isFull,
                      isCancelled: isCancelled,
                      spotsLeft: spotsLeft,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    )); // closes Opacity + Card
  }

  // ─── Meta row ─────────────────────────────────────────────────────────────

  Widget _buildMetaRow(ThemeData theme) {
    final color = theme.colorScheme.onSurfaceVariant;
    final items = <Widget>[];

    if (session.instructor != null) {
      items.add(_metaItem(
          Icons.person_outline_rounded, session.instructor!, color, theme));
    }
    if (session.location != null) {
      if (items.isNotEmpty) {
        items.add(Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6),
          child: Text('·',
              style: TextStyle(
                  color: color.withValues(alpha: 0.5), fontSize: 12)),
        ));
      }
      items.add(_metaItem(
          Icons.location_on_outlined, session.location!, color, theme));
    }
    if (items.isEmpty) return const SizedBox.shrink();
    return Row(children: items);
  }

  Widget _metaItem(
      IconData icon, String text, Color color, ThemeData theme) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: color),
        const SizedBox(width: 3),
        Text(
          text,
          style: theme.textTheme.bodySmall?.copyWith(
            color: color,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  // ─── Capacity bar ──────────────────────────────────────────────────────────

  Widget _buildCapacityBar(ThemeData theme, Color accentColor, int capacity,
      int booked, int? spotsLeft, bool isFull) {
    final fraction =
        capacity > 0 ? (booked / capacity).clamp(0.0, 1.0) : 0.0;
    final barColor = isFull ? Colors.red : accentColor;

    return Row(
      children: [
        Text(
          'Capacity',
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: fraction,
              minHeight: 5,
              backgroundColor: barColor.withValues(alpha: 0.12),
              valueColor: AlwaysStoppedAnimation<Color>(barColor),
            ),
          ),
        ),
        const SizedBox(width: 8),
        if (isFull)
          Text(
            'Full',
            style: const TextStyle(
              color: Colors.red,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          )
        else if (spotsLeft != null && spotsLeft > 0)
          Text(
            '$spotsLeft spots left',
            style: const TextStyle(
              color: Color(0xFF16A34A),
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
      ],
    );
  }

  // ─── Action bar ───────────────────────────────────────────────────────────

  Widget _buildActionBar(
    BuildContext context,
    ThemeData theme,
    Color accentColor, {
    required bool isAttended,
    required bool isBooked,
    required bool isFinished,
    required bool isOngoing,
    required bool isFull,
    required bool isCancelled,
    required int? spotsLeft,
  }) {
    return Column(
      children: [
        Divider(
          height: 1,
          thickness: 1,
          color: accentColor.withValues(alpha: 0.15),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
          child: Row(
            children: [
              if (isCancelled) ...[
                Expanded(
                  child: _ActionButton(
                    icon: Icons.cancel_outlined,
                    label: 'Session Cancelled',
                    backgroundColor: Colors.red.withValues(alpha: 0.08),
                    foregroundColor: Colors.red.shade400,
                  ),
                ),
              ] else if (isAttended) ...[
                // ✓ Attended (soft green)
                Expanded(
                  child: _ActionButton(
                    icon: Icons.check_rounded,
                    label: 'Attended',
                    backgroundColor: const Color(0xFFDCFCE7),
                    foregroundColor: const Color(0xFF16A34A),
                  ),
                ),
                const SizedBox(width: 8),
                // Rate / Rated button
                Expanded(child: _RateButton(session: session)),
              ] else if (isBooked && isOngoing) ...[
                // Booked + ongoing — show "Class is ongoing"
                Expanded(
                  child: _ActionButton(
                    icon: Icons.radio_button_checked,
                    label: 'Class is ongoing',
                    backgroundColor: const Color(0xFFFFF7ED),
                    foregroundColor: const Color(0xFFEA580C),
                  ),
                ),
              ] else if (isBooked) ...[
                // Booked + Cancel
                Expanded(
                  child: _ActionButton(
                    icon: Icons.check_rounded,
                    label: 'Booked',
                    backgroundColor: const Color(0xFFDCFCE7),
                    foregroundColor: const Color(0xFF16A34A),
                  ),
                ),
                if (onCancel != null) ...[
                  const SizedBox(width: 8),
                  Expanded(
                    child: GestureDetector(
                      onTap: isLoading ? null : onCancel,
                      child: _ActionButton(
                        icon: Icons.close_rounded,
                        label: 'Cancel',
                        backgroundColor: const Color(0xFFFFE4E6),
                        foregroundColor: const Color(0xFFDC2626),
                        isLoading: isLoading,
                      ),
                    ),
                  ),
                ],
              ] else if (isFinished) ...[
                // Class ended
                Expanded(
                  child: _ActionButton(
                    icon: Icons.event_busy_outlined,
                    label: 'Class ended',
                    backgroundColor: theme.colorScheme.surfaceContainerHighest
                        .withValues(alpha: 0.5),
                    foregroundColor: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ] else if (isOngoing) ...[
                // Ongoing but not booked
                Expanded(
                  child: _ActionButton(
                    icon: Icons.radio_button_checked,
                    label: 'Class is ongoing',
                    backgroundColor: const Color(0xFFFFF7ED),
                    foregroundColor: const Color(0xFFEA580C),
                  ),
                ),
              ] else if (isFull) ...[
                // Full — disabled
                Expanded(
                  child: _ActionButton(
                    icon: Icons.block_outlined,
                    label: 'Class is full',
                    backgroundColor: Colors.transparent,
                    foregroundColor: theme.colorScheme.onSurfaceVariant,
                    outlined: true,
                  ),
                ),
              ] else if (onBook != null) ...[
                // Open — Book now
                Expanded(
                  child: GestureDetector(
                    onTap: isLoading ? null : onBook,
                    child: _ActionButton(
                      icon: Icons.add_rounded,
                      label: 'Book now',
                      backgroundColor: const Color(0xFF4F46E5),
                      foregroundColor: Colors.white,
                      isLoading: isLoading,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  String _formatTime(DateTime start, DateTime? end) {
    final startStr = DateFormat('h:mm a').format(start);
    if (end == null) return startStr;
    return '$startStr – ${DateFormat('h:mm a').format(end)}';
  }

  String _capitalize(String s) =>
      s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
}

// ─── Type chip ────────────────────────────────────────────────────────────────

class _TypeChip extends StatelessWidget {
  final String label;
  final Color accentColor;

  const _TypeChip({required this.label, required this.accentColor});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: accentColor.withValues(alpha: 0.5)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: accentColor,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

// ─── Branch chip ──────────────────────────────────────────────────────────────

class _BranchChip extends StatelessWidget {
  final String name;
  const _BranchChip({required this.name});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: const Color(0xFF2563EB).withValues(alpha: 0.12),
        border: Border.all(color: const Color(0xFF2563EB).withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.location_city_rounded, size: 10, color: Color(0xFF60A5FA)),
          const SizedBox(width: 3),
          Text(
            name,
            style: const TextStyle(
              color: Color(0xFF60A5FA),
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Status badge ─────────────────────────────────────────────────────────────

class _StatusBadge extends StatelessWidget {
  final DateTime start;
  final DateTime? end;
  final bool isBooked;
  final bool isAttended;
  final bool isFull;
  final bool isCancelled;

  const _StatusBadge({
    required this.start,
    required this.end,
    required this.isBooked,
    required this.isAttended,
    required this.isFull,
    this.isCancelled = false,
  });

  @override
  Widget build(BuildContext context) {
    if (isCancelled) {
      return _badge(Icons.cancel_outlined, 'Cancelled', Colors.red.shade400);
    }

    if (isAttended) {
      return _badge(Icons.check_circle_rounded, 'Attended',
          const Color(0xFF22C55E));
    }

    if (isBooked) {
      return _badge(Icons.check_circle_outline_rounded, 'Booked',
          const Color(0xFF16A34A));
    }

    if (isFull) {
      return _badge(Icons.block_outlined, 'Full', Colors.red);
    }

    final now = DateTime.now();
    if (end != null && now.isAfter(end!)) {
      return _badge(Icons.check_circle_outline, 'Finished',
          const Color(0xFF6B7280));
    } else if (now.isAfter(start) && (end == null || now.isBefore(end!))) {
      return _badge(Icons.radio_button_checked, 'Ongoing',
          const Color(0xFFEA580C));
    }
    return _badge(Icons.circle_outlined, 'Open', const Color(0xFF16A34A));
  }

  Widget _badge(IconData icon, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Rate button (stateful so it flips locally after submission) ──────────────

class _RateButton extends StatefulWidget {
  final Session session;
  const _RateButton({required this.session});

  @override
  State<_RateButton> createState() => _RateButtonState();
}

class _RateButtonState extends State<_RateButton> {
  bool _rated = false;

  @override
  void initState() {
    super.initState();
    _rated = widget.session.hasRated;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (_rated) {
      return _ActionButton(
        icon: Icons.check_circle_rounded,
        label: 'Rated',
        backgroundColor: const Color(0xFFFEF9C3),
        foregroundColor: const Color(0xFFB45309),
      );
    }
    return GestureDetector(
      onTap: () async {
        final rated = await showRatingSheet(context, widget.session);
        if (rated == true && mounted) {
          setState(() {
            _rated = true;
            widget.session.hasRated = true;
          });
        }
      },
      child: _ActionButton(
        icon: Icons.star_border_rounded,
        label: 'Rate',
        backgroundColor: Colors.transparent,
        foregroundColor: theme.colorScheme.onSurface,
        outlined: true,
      ),
    );
  }
}

// ─── Action button ────────────────────────────────────────────────────────────

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color backgroundColor;
  final Color foregroundColor;
  final bool isLoading;
  final bool outlined;

  const _ActionButton({
    required this.icon,
    required this.label,
    required this.backgroundColor,
    required this.foregroundColor,
    this.isLoading = false,
    this.outlined = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 38,
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(10),
        border: outlined
            ? Border.all(
                color: foregroundColor.withValues(alpha: 0.25),
                width: 1.2,
              )
            : null,
      ),
      child: Center(
        child: isLoading
            ? SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(
                    strokeWidth: 1.8, color: foregroundColor),
              )
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(icon, size: 15, color: foregroundColor),
                  const SizedBox(width: 5),
                  Text(
                    label,
                    style: TextStyle(
                      color: foregroundColor,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
