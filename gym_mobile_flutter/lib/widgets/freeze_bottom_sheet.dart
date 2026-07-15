import 'package:flutter/material.dart';
import 'package:clby/l10n/l10n.dart';
import '../models/membership_model.dart';

class FreezeBottomSheet extends StatefulWidget {
  final MemberMembership membership;
  final Color primaryColor;
  final Future<void> Function(int days) onFreeze;

  const FreezeBottomSheet({
    super.key,
    required this.membership,
    required this.primaryColor,
    required this.onFreeze,
  });

  @override
  State<FreezeBottomSheet> createState() => _FreezeBottomSheetState();
}

class _FreezeBottomSheetState extends State<FreezeBottomSheet> {
  int _days = 1;
  bool _loading = false;

  int get _maxAllowed {
    final remaining = widget.membership.freezeDaysRemaining;
    final daysUntilExpiry = widget.membership.endDate != null
        ? widget.membership.endDate!.difference(DateTime.now()).inDays
        : 0;
    return [remaining, daysUntilExpiry].reduce((a, b) => a < b ? a : b).clamp(0, 9999);
  }

  bool get _limitReached {
    final ms = widget.membership;
    final daysExhausted  = ms.freezeMaxDays  != null && ms.freezeDaysUsed  >= ms.freezeMaxDays!;
    final countExhausted = ms.freezeMaxCount != null && ms.freezeCount     >= ms.freezeMaxCount!;
    return daysExhausted || countExhausted;
  }

  DateTime get _newExpiry {
    final base = widget.membership.endDate ?? DateTime.now();
    return base.add(Duration(days: _days));
  }

  String _formatDate(DateTime d) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${d.day} ${months[d.month - 1]} ${d.year}';
  }

  Future<void> _submit() async {
    setState(() => _loading = true);
    try {
      await widget.onFreeze(_days);
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.freezeFailed(e.toString())), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ms = widget.membership;
    final max = _maxAllowed;
    final limitReached = _limitReached;

    return Container(
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        left: 24, right: 24, top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Handle
          Center(
            child: Container(
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: theme.colorScheme.outlineVariant,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Title
          Row(
            children: [
              Icon(Icons.ac_unit, color: Colors.blue, size: 20),
              const SizedBox(width: 8),
              Text(
                context.l10n.freezeTitle,
                style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            context.l10n.freezeWillPause(ms.planName ?? context.l10n.freezeYourPlan),
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),

          const SizedBox(height: 20),

          // Quota info
          Row(
            children: [
              _QuotaChip(
                label: context.l10n.freezeDaysAvailable,
                value: context.l10n.freezeXOfY(
                    '${ms.freezeDaysRemaining}', '${ms.freezeMaxDays ?? 0}'),
                icon: Icons.timer_outlined,
              ),
              const SizedBox(width: 12),
              _QuotaChip(
                label: context.l10n.freezeFreezesUsed,
                value: context.l10n.freezeXOfY(
                    '${ms.freezeCount}', '${ms.freezeMaxCount ?? '∞'}'),
                icon: Icons.repeat_outlined,
              ),
            ],
          ),

          const SizedBox(height: 24),

          // Limit-reached banner
          if (limitReached) ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.red.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.red.withValues(alpha: 0.25)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.error_outline, color: Colors.red, size: 16),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      ms.freezeMaxDays != null && ms.freezeDaysUsed >= ms.freezeMaxDays!
                          ? context.l10n.freezeAllDaysUsed(ms.freezeMaxDays!)
                          : context.l10n.freezeMaxCountReached(ms.freezeMaxCount ?? 0),
                      style: const TextStyle(fontSize: 13, color: Colors.red),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ] else ...[
          // Day picker
          Text(
            context.l10n.freezeHowManyDays,
            style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _StepButton(
                icon: Icons.remove,
                onTap: _days > 1 ? () => setState(() => _days--) : null,
              ),
              const SizedBox(width: 24),
              Text(
                '$_days',
                style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(width: 24),
              _StepButton(
                icon: Icons.add,
                onTap: _days < max ? () => setState(() => _days++) : null,
              ),
            ],
          ),
          const SizedBox(height: 6),
          Center(
            child: Text(
              context.l10n.freezeMaxDaysHint(max),
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ),

          const SizedBox(height: 20),

          // New expiry preview
          if (ms.endDate != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.blue.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.blue.withValues(alpha: 0.2)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.event, color: Colors.blue, size: 16),
                  const SizedBox(width: 8),
                  Expanded(
                    child: RichText(
                      text: TextSpan(
                        style: const TextStyle(fontSize: 13, color: Colors.blue),
                        children: [
                          TextSpan(text: context.l10n.freezeExtendTo),
                          TextSpan(
                            text: _formatDate(_newExpiry),
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),

          const SizedBox(height: 24),
          ], // end else (not limitReached)

          // Buttons
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _loading ? null : () => Navigator.of(context).pop(),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text(context.l10n.commonCancel),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: (_loading || limitReached) ? null : _submit,
                  icon: _loading
                      ? const SizedBox(
                          width: 14, height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.ac_unit, size: 16),
                  label: Text(_loading ? context.l10n.freezeFreezing : context.l10n.freezeTitle),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blue,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _QuotaChip extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  const _QuotaChip({required this.label, required this.value, required this.icon});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: theme.colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            Icon(icon, size: 14, color: theme.colorScheme.onSurfaceVariant),
            const SizedBox(width: 6),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: TextStyle(fontSize: 10, color: theme.colorScheme.onSurfaceVariant)),
                Text(value, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: theme.colorScheme.onSurface)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _StepButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;
  const _StepButton({required this.icon, this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final enabled = onTap != null;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 44, height: 44,
        decoration: BoxDecoration(
          color: enabled
              ? theme.colorScheme.primaryContainer
              : theme.colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(
          icon,
          size: 20,
          color: enabled
              ? theme.colorScheme.onPrimaryContainer
              : theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.3),
        ),
      ),
    );
  }
}
