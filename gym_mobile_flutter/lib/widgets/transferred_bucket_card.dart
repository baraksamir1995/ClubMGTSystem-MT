import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/membership_summary_model.dart';

/// Compact per-bucket card for the "Transferred Sessions" section of the
/// Active Services screen. Surfaces the remaining count, expiry, and the
/// sender's name when available — the audit trail the spec calls for.
class TransferredBucketCard extends StatelessWidget {
  final MembershipBucket bucket;
  final Color primary;

  const TransferredBucketCard({
    super.key,
    required this.bucket,
    required this.primary,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final remaining = bucket.isUnlimited
        ? '∞'
        : '${bucket.sessionsRemaining ?? 0}';
    final expiry = bucket.endDate != null
        ? DateFormat('MMM d, yyyy').format(bucket.endDate!)
        : 'No expiry';

    return Container(
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: theme.colorScheme.outline.withValues(alpha: 0.15),
        ),
      ),
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(Icons.redeem_outlined, color: primary, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  bucket.transferredFromMemberName != null
                      ? 'From ${bucket.transferredFromMemberName}'
                      : 'Transferred sessions',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  'Expires $expiry',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                remaining,
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: primary,
                ),
              ),
              Text(
                bucket.isUnlimited ? 'unlimited' : 'remaining',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
