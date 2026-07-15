import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:clby/l10n/l10n.dart';
import '../providers/auth_provider.dart';
import '../providers/member_provider.dart';
import '../widgets/membership_card_unified.dart';
import '../widgets/freeze_bottom_sheet.dart';
import '../widgets/shimmer_loader.dart';
import '../models/service_assignment_model.dart';

class MembershipScreen extends StatefulWidget {
  const MembershipScreen({super.key});

  @override
  State<MembershipScreen> createState() => _MembershipScreenState();
}

class _MembershipScreenState extends State<MembershipScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
  }

  Future<void> _loadData() async {
    final authProvider = context.read<AuthProvider>();
    final memberProvider = context.read<MemberProvider>();
    final gymId = authProvider.profile?.gymId;
    if (gymId != null) {
      await memberProvider.ensureMemberLoaded(gymId);
      await memberProvider.refreshMembership();
      await memberProvider.loadPayments();
      await memberProvider.loadServiceAssignments();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final authProvider = context.watch<AuthProvider>();
    final memberProvider = context.watch<MemberProvider>();
    final primaryColor = Theme.of(context).colorScheme.primary;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => context.pop(),
        ),
        title: Text(
          context.l10n.membershipActiveServices,
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17),
        ),
        backgroundColor: Theme.of(context).colorScheme.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Divider(height: 1, thickness: 1,
              color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.12)),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _loadData,
        color: primaryColor,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Expiry warning banner
              if (!memberProvider.isLoadingMember)
                _buildExpiryBanner(context, memberProvider),

              // Unified membership card with freeze actions
              if (memberProvider.isLoadingMember)
                BrandedSkeletonCard.fromContext(context, height: 200)
              else if (memberProvider.membershipSummary != null
                  && memberProvider.membershipSummary!.buckets.isNotEmpty)
                MembershipCardUnified(
                  summary: memberProvider.membershipSummary!,
                  subscription: memberProvider.currentMembership,
                  primary: primaryColor,
                  secondary: theme.colorScheme.secondary,
                  onFreeze: (memberProvider.currentMembership?.canFreeze ?? false)
                      ? () => _showFreezeSheet(context, memberProvider, primaryColor)
                      : null,
                  onUnfreeze: (memberProvider.currentMembership?.isFrozen ?? false)
                      ? () => _unfreeze(context, memberProvider)
                      : null,
                )
              else
                _buildNoMembership(context, theme),

              // Service assignments (PT, Nutrition, Physio)
              if (!memberProvider.isLoadingServices &&
                  memberProvider.serviceAssignments.isNotEmpty) ...[
                const SizedBox(height: 16),
                Text(
                  context.l10n.membershipActiveServices,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 10),
                ...memberProvider.serviceAssignments.map(
                  (a) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _ServiceAssignmentCard(
                      assignment: a,
                      primaryColor: primaryColor,
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 24),

              // Member details
              if (memberProvider.member != null) ...[
                Text(
                  context.l10n.membershipMemberDetails,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 12),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        _buildDetailRow(
                          context,
                          context.l10n.membershipMemberNumber,
                          memberProvider.member!.memberNumber ?? context.l10n.membershipNoMemberIdYet,
                          Icons.badge_outlined,
                        ),
                        const Divider(height: 24),
                        _buildDetailRow(
                          context,
                          context.l10n.membershipStatus,
                          memberProvider.member!.status ?? '—',
                          Icons.circle_outlined,
                          valueColor: memberProvider.member!.status == 'active'
                              ? Colors.green
                              : null,
                        ),
                        const Divider(height: 24),
                        _buildDetailRow(
                          context,
                          context.l10n.membershipMemberSince,
                          memberProvider.member!.joinedAt != null
                              ? DateFormat('MMM d, yyyy')
                                  .format(memberProvider.member!.joinedAt!)
                              : '—',
                          Icons.calendar_today_outlined,
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
              ],

              // Guest Invitations entry point — only shown when plan has invitations enabled
              if (memberProvider.currentMembership?.invitationsEnabled == true) ...[
                Text(
                  context.l10n.membershipGuestInvitations,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 12),
                Card(
                  child: InkWell(
                    onTap: () => context.push('/invitations'),
                    borderRadius: BorderRadius.circular(12),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: Colors.green.withValues(alpha: 0.10),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(Icons.mail_outline_rounded, color: Colors.green, size: 22),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text(
                                      context.l10n.membershipGuestPasses,
                                      style: theme.textTheme.titleSmall?.copyWith(
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: Colors.green.withValues(alpha: 0.12),
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: Text(
                                        context.l10n.membershipInvitationsLeft(memberProvider.invitationsRemaining),
                                        style: const TextStyle(
                                          color: Colors.green,
                                          fontSize: 11,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                Text(
                                  context.l10n.membershipInviteGuests,
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: theme.colorScheme.onSurfaceVariant,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Icon(Icons.chevron_right,
                              color: theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.5)),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
              ],

              // Billing / Invoices entry point
              Text(
                context.l10n.membershipBilling,
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 12),
              Card(
                child: InkWell(
                  onTap: () => context.push('/billing'),
                  borderRadius: BorderRadius.circular(12),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: primaryColor.withValues(alpha: 0.10),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(Icons.receipt_long_outlined,
                              color: primaryColor, size: 22),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                context.l10n.membershipViewInvoices,
                                style: theme.textTheme.titleSmall?.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              Text(
                                context.l10n.membershipViewInvoicesSubtitle,
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: theme.colorScheme.onSurfaceVariant,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Icon(Icons.chevron_right,
                            color: theme.colorScheme.onSurfaceVariant
                                .withValues(alpha: 0.5)),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showFreezeSheet(BuildContext context, MemberProvider memberProvider, Color primaryColor) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => FreezeBottomSheet(
        membership: memberProvider.currentMembership!,
        primaryColor: primaryColor,
        onFreeze: (days) => memberProvider.freezePlan(
          context.read<AuthProvider>().profile!.gymId!,
          days,
        ),
      ),
    );
  }

  Future<void> _unfreeze(BuildContext context, MemberProvider memberProvider) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(ctx.l10n.membershipUnfreezeTitle),
        content: Text(ctx.l10n.membershipUnfreezeMessage),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(ctx.l10n.commonCancel)),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: Text(ctx.l10n.membershipUnfreeze)),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      await memberProvider.unfreezePlan();
    }
  }

  Widget _buildNoMembership(BuildContext context, ThemeData theme) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Icon(Icons.card_membership_outlined, size: 40, color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(height: 12),
          Text(context.l10n.membershipNoActiveMembership, style: theme.textTheme.titleSmall),
          const SizedBox(height: 4),
          Text(
            context.l10n.membershipNoActiveMembershipSubtitle,
            style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildExpiryBanner(BuildContext context, MemberProvider memberProvider) {
    final expiry = memberProvider.currentMembership?.endDate;
    if (expiry == null) return const SizedBox.shrink();

    final daysLeft = expiry.difference(DateTime.now()).inDays;

    if (daysLeft > 7) return const SizedBox.shrink();

    final isExpired = daysLeft < 0;
    final color = isExpired ? Colors.red : Colors.orange;
    final icon = isExpired ? Icons.error_outline : Icons.warning_amber_rounded;
    final message = isExpired
        ? context.l10n.membershipExpiredBanner
        : daysLeft == 0
            ? context.l10n.membershipExpiresToday
            : context.l10n.membershipExpiresInDays(daysLeft);

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                color: color,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(
    BuildContext context,
    String label,
    String value,
    IconData icon, {
    Color? valueColor,
  }) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: theme.colorScheme.primary.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, size: 18, color: theme.colorScheme.primary),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              Text(
                value,
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: valueColor ?? theme.colorScheme.onSurface,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

}

// ── Service Assignment Card ────────────────────────────────────────────────────

class _ServiceAssignmentCard extends StatelessWidget {
  final ServiceAssignment assignment;
  final Color primaryColor;
  const _ServiceAssignmentCard({required this.assignment, required this.primaryColor});

  IconData get _icon {
    switch (assignment.serviceType) {
      case 'personal_trainer': return Icons.fitness_center;
      case 'nutritionist':     return Icons.restaurant_menu_outlined;
      case 'physiotherapist':  return Icons.favorite_border;
      default:                 return Icons.star_border;
    }
  }

  Color get _accentColor {
    switch (assignment.serviceType) {
      case 'personal_trainer': return const Color(0xFF9333EA); // purple
      case 'nutritionist':     return const Color(0xFF16A34A); // green
      case 'physiotherapist':  return const Color(0xFF2563EB); // blue
      default:                 return const Color(0xFF9333EA);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final used      = assignment.sessionsUsed;
    final total     = assignment.sessionsTotal;
    final remaining = assignment.sessionsRemaining;
    final progress  = total > 0 ? (used / total).clamp(0.0, 1.0) : 0.0;
    final accent    = _accentColor;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFE8E6E0)),
        borderRadius: BorderRadius.circular(16),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(_icon, size: 18, color: accent),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      assignment.packageName,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF1D1D1B),
                      ),
                    ),
                    Text(
                      assignment.serviceLabel,
                      style: TextStyle(
                        fontSize: 11,
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF16A34A).withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  context.l10n.commonActive,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF16A34A),
                  ),
                ),
              ),
            ],
          ),
          if (assignment.trainerName != null) ...[
            const SizedBox(height: 10),
            Text(
              context.l10n.membershipSpecialist(assignment.trainerName!),
              style: TextStyle(
                fontSize: 12,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                context.l10n.membershipSessionsRemaining(remaining),
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF1D1D1B),
                ),
              ),
              Text(
                '$used / $total',
                style: TextStyle(
                  fontSize: 11,
                  color: theme.colorScheme.onSurfaceVariant,
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
              backgroundColor: accent.withValues(alpha: 0.12),
              valueColor: AlwaysStoppedAnimation<Color>(accent),
            ),
          ),
        ],
      ),
    );
  }
}
