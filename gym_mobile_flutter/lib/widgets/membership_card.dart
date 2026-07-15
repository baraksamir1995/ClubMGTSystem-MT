import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:clby/l10n/l10n.dart';
import '../models/membership_model.dart';

class MembershipCard extends StatelessWidget {
  final MemberMembership? membership;
  final Color? primaryColor;
  final String? memberStatus; // gym_members.status

  const MembershipCard({
    super.key,
    this.membership,
    this.primaryColor,
    this.memberStatus,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = primaryColor ?? theme.colorScheme.primary;

    if (membership == null) {
      return _buildNoMembership(context);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Main card with gradient
        Container(
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
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        context.l10n.memberCardMembership,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.7),
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 1.2,
                        ),
                      ),
                      if (membership!.planType != null)
                        Text(
                          membership!.planType!.toUpperCase(),
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.9),
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                            letterSpacing: 0.5,
                          ),
                        ),
                    ],
                  ),
                  _buildStatusBadge(context),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                membership!.planName ?? context.l10n.memberCardStandardPlan,
                style: theme.textTheme.headlineSmall?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
              if (membership!.description != null) ...[
                const SizedBox(height: 4),
                Text(
                  membership!.description!,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.75),
                    fontSize: 13,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
              const SizedBox(height: 16),
              Row(
                children: [
                  _buildDateInfo(context.l10n.memberCardStart, membership!.startDate),
                  const SizedBox(width: 24),
                  _buildDateInfo(context.l10n.memberCardExpires, membership!.endDate),
                  const Spacer(),
                  if (membership!.price != null)
                    Text(
                      '${membership!.currency ?? 'USD'} ${membership!.price!.toStringAsFixed(0)}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),

        // Benefits summary card
        const SizedBox(height: 16),
        _buildBenefitsCard(context, color),
      ],
    );
  }

  Widget _buildBenefitsCard(BuildContext context, Color color) {
    final theme = Theme.of(context);
    final benefits = <_Benefit>[];

    if (membership!.visitsPerWeek != null) {
      benefits.add(_Benefit(
        Icons.calendar_view_week_outlined,
        context.l10n.memberCardVisitsPerWeek(membership!.visitsPerWeek!),
      ));
    }
    if (membership!.visitsPerMonth != null) {
      benefits.add(_Benefit(
        Icons.calendar_month_outlined,
        context.l10n.memberCardVisitsPerMonth(membership!.visitsPerMonth!),
      ));
    }
    if (membership!.sessionCount != null) {
      benefits.add(_Benefit(
        Icons.fitness_center_outlined,
        context.l10n.memberCardSessionsIncluded(membership!.sessionCount!),
      ));
    }
    if (membership!.billingCycle != null) {
      benefits.add(_Benefit(
        Icons.autorenew_outlined,
        context.l10n.memberCardBilling(_capitalize(membership!.billingCycle!)),
      ));
    }
    for (final facility in membership!.facilities) {
      benefits.add(_Benefit(Icons.check_circle_outline, facility));
    }
    for (final addon in membership!.addOns) {
      benefits.add(_Benefit(Icons.star_outline, addon));
    }

    if (benefits.isEmpty) return const SizedBox.shrink();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.workspace_premium_outlined,
                    size: 18, color: color),
                const SizedBox(width: 8),
                Text(
                  context.l10n.memberCardPlanBenefits,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            ...benefits.map((b) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    children: [
                      Icon(b.icon, size: 16, color: color),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          b.label,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurface,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                )),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusBadge(BuildContext context) {
    // Member suspension takes priority over membership status
    final String status;
    if (memberStatus == 'suspended') {
      status = 'Suspended';
    } else if (memberStatus == 'expired') {
      status = 'Expired';
    } else {
      status = membership!.displayStatus;
    }

    Color bgColor;
    switch (status) {
      case 'Active':
        bgColor = Colors.white.withValues(alpha: 0.25);
        break;
      case 'Expired':
        bgColor = Colors.red.withValues(alpha: 0.4);
        break;
      case 'Suspended':
        bgColor = Colors.orange.withValues(alpha: 0.4);
        break;
      default:
        bgColor = Colors.white.withValues(alpha: 0.15);
    }

    // Localized display text — the switch above keeps comparing the raw
    // model status values.
    final String displayText;
    switch (status) {
      case 'Active':
        displayText = context.l10n.commonActive;
        break;
      case 'Expired':
        displayText = context.l10n.commonExpired;
        break;
      case 'Suspended':
        displayText = context.l10n.memberCardSuspended;
        break;
      case 'Frozen':
        displayText = context.l10n.memberCardFrozen;
        break;
      case 'Inactive':
        displayText = context.l10n.memberCardInactive;
        break;
      default:
        displayText = status;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.4)),
      ),
      child: Text(
        displayText,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _buildDateInfo(String label, DateTime? date) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.7),
            fontSize: 11,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          date != null ? DateFormat('MMM d, yyyy').format(date) : '—',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  Widget _buildNoMembership(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: theme.colorScheme.outline.withValues(alpha: 0.2),
        ),
      ),
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Icon(Icons.card_membership_outlined,
              size: 40, color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(height: 12),
          Text(
            context.l10n.memberCardNoActiveMembership,
            style: theme.textTheme.titleMedium
                ?.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 4),
          Text(
            context.l10n.memberCardContactGym,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }

  String _capitalize(String s) =>
      s.isEmpty ? s : '${s[0].toUpperCase()}${s.substring(1)}';
}

class _Benefit {
  final IconData icon;
  final String label;
  const _Benefit(this.icon, this.label);
}
