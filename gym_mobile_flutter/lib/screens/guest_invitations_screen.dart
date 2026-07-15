import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';

import 'package:clby/l10n/l10n.dart';
import '../providers/auth_provider.dart';
import '../providers/member_provider.dart';
import '../models/invitation_model.dart';
import '../utils/error_utils.dart';

class GuestInvitationsScreen extends StatefulWidget {
  const GuestInvitationsScreen({super.key});

  @override
  State<GuestInvitationsScreen> createState() => _GuestInvitationsScreenState();
}

class _GuestInvitationsScreenState extends State<GuestInvitationsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final authProvider = context.read<AuthProvider>();
    final memberProvider = context.read<MemberProvider>();
    final gymId = authProvider.profile?.gymId;
    if (gymId != null) {
      await memberProvider.ensureMemberLoaded(gymId);
      await memberProvider.loadInvitations();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final authProvider = context.watch<AuthProvider>();
    final memberProvider = context.watch<MemberProvider>();

    final primaryColor = Theme.of(context).colorScheme.primary;

    final membership = memberProvider.currentMembership;
    final invitationsEnabled = membership?.invitationsEnabled ?? false;
    final remaining = memberProvider.invitationsRemaining;
    final total = membership?.invitationsPerCycle;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => context.pop(),
        ),
        title: Text(context.l10n.guestInvTitle, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17)),
        backgroundColor: Theme.of(context).colorScheme.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Divider(height: 1, thickness: 1, color: theme.colorScheme.outline.withValues(alpha: 0.12)),
        ),
      ),
      floatingActionButton: invitationsEnabled
          ? FloatingActionButton.extended(
              onPressed: remaining > 0
                  ? () => _showSendSheet(context, memberProvider, primaryColor)
                  : null,
              backgroundColor: remaining > 0 ? primaryColor : Colors.grey,
              icon: const Icon(Icons.person_add_alt_1_rounded, color: Colors.white),
              label: Text(
                remaining > 0 ? context.l10n.guestInvInviteGuest : context.l10n.guestInvNoInvitesLeft,
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
              ),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: _load,
        color: primaryColor,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Balance card
              _buildBalanceCard(context, theme, primaryColor, invitationsEnabled, remaining, total, membership),
              const SizedBox(height: 24),

              // Invitations list
              if (!invitationsEnabled)
                _buildDisabledState(context, theme)
              else ...[
                Text(context.l10n.guestInvSentInvitations,
                    style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 12),
                if (memberProvider.isLoadingInvitations)
                  const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator()))
                else if (memberProvider.invitations.isEmpty)
                  _buildEmptyState(context, theme, remaining, primaryColor)
                else
                  ...memberProvider.invitations.map((inv) => _buildInvitationCard(context, theme, inv)),
              ],
              // Space for FAB
              const SizedBox(height: 80),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBalanceCard(BuildContext context, ThemeData theme, Color primaryColor,
      bool enabled, int remaining, int? total, dynamic membership) {
    if (!enabled) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: theme.colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Icon(Icons.mail_outline_rounded, color: theme.colorScheme.onSurfaceVariant, size: 28),
            const SizedBox(width: 14),
            Expanded(
              child: Text(context.l10n.guestInvNotIncluded,
                  style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
            ),
          ],
        ),
      );
    }

    final passLabel = membership?.invitationDurationType == 'time_based'
        ? context.l10n.guestInvDayPass('${membership?.invitationDurationDays ?? '?'}')
        : context.l10n.guestInvOneVisit;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [primaryColor, primaryColor.withValues(alpha: 0.7)],
          begin: AlignmentDirectional.topStart,
          end: AlignmentDirectional.bottomEnd,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.mail_rounded, color: Colors.white, size: 20),
              const SizedBox(width: 8),
              Text(context.l10n.guestInvTitle,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14)),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('$remaining',
                  style: const TextStyle(color: Colors.white, fontSize: 48, fontWeight: FontWeight.w800, height: 1)),
              if (total != null) ...[
                const SizedBox(width: 4),
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text('/ $total', style: const TextStyle(color: Colors.white70, fontSize: 20, fontWeight: FontWeight.w500)),
                ),
              ],
              const SizedBox(width: 12),
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(context.l10n.guestInvInvitesRemaining,
                    style: const TextStyle(color: Colors.white70, fontSize: 14)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(context.l10n.guestInvEachGuestGets(passLabel),
                style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }

  Widget _buildDisabledState(BuildContext context, ThemeData theme) {
    return const SizedBox.shrink();
  }

  Widget _buildEmptyState(BuildContext context, ThemeData theme, int remaining, Color primaryColor) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Icon(Icons.mail_outline_rounded, size: 40, color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(height: 12),
          Text(context.l10n.guestInvNoneSentYet, style: theme.textTheme.titleSmall),
          const SizedBox(height: 4),
          Text(
            remaining > 0 ? context.l10n.guestInvInviteFriend : context.l10n.guestInvNoneRemaining,
            style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            textAlign: TextAlign.center,
          ),
          if (remaining > 0) ...[
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: () => _showSendSheet(context, context.read<MemberProvider>(), primaryColor),
              icon: const Icon(Icons.add, size: 16),
              label: Text(context.l10n.guestInvSendInvitation),
              style: ElevatedButton.styleFrom(backgroundColor: primaryColor, foregroundColor: Colors.white),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildInvitationCard(BuildContext context, ThemeData theme, GuestInvitation inv) {
    final statusInfo = _statusInfo(inv.status);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: theme.colorScheme.outline.withValues(alpha: 0.12)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            // Avatar
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: theme.colorScheme.primary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(Icons.person_outline_rounded, color: theme.colorScheme.primary, size: 22),
            ),
            const SizedBox(width: 12),
            // Details
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    inv.guestName ?? inv.guestEmail,
                    style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (inv.guestName != null)
                    Text(inv.guestEmail,
                        style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                        maxLines: 1, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      // Status badge
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: statusInfo.color.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: statusInfo.color.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(statusInfo.icon, size: 10, color: statusInfo.color),
                            const SizedBox(width: 4),
                            Text(inv.status.label,
                                style: TextStyle(color: statusInfo.color, fontSize: 11, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(inv.passLabel,
                          style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            // Date + countdown
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  DateFormat('d MMM').format(inv.createdAt),
                  style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                ),
                if (inv.isPending) ...[
                  const SizedBox(height: 4),
                  Text(
                    _countdown(inv.expiresAt),
                    style: TextStyle(
                      fontSize: 11,
                      color: inv.daysUntilExpiry != null && inv.daysUntilExpiry! <= 1
                          ? Colors.red
                          : Colors.orange,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  _StatusInfo _statusInfo(InvitationStatus status) {
    switch (status) {
      case InvitationStatus.pending:
        return _StatusInfo(Colors.orange, Icons.schedule_rounded);
      case InvitationStatus.accepted:
        return _StatusInfo(Colors.blue, Icons.check_circle_outline_rounded);
      case InvitationStatus.active:
        return _StatusInfo(Colors.green, Icons.verified_rounded);
      case InvitationStatus.expired:
        return _StatusInfo(Colors.grey, Icons.cancel_outlined);
      case InvitationStatus.invalidated:
        return _StatusInfo(Colors.red, Icons.block_rounded);
    }
  }

  String _countdown(DateTime dt) {
    final diff = dt.difference(DateTime.now());
    if (diff.isNegative) return context.l10n.commonExpired;
    if (diff.inDays > 0) return context.l10n.guestInvDaysLeft(diff.inDays);
    if (diff.inHours > 0) return context.l10n.guestInvHoursLeft(diff.inHours);
    return context.l10n.guestInvExpiringSoon;
  }

  void _showSendSheet(BuildContext context, MemberProvider memberProvider, Color primaryColor) {
    final membership = memberProvider.currentMembership;
    final isPerVisit = (membership?.invitationDurationType ?? 'per_visit') == 'per_visit';
    final remaining = memberProvider.invitationsRemaining;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _SendInvitationSheet(
        primaryColor: primaryColor,
        isPerVisit: isPerVisit,
        maxInvites: remaining,
        onSend: (name, email, phone, maxVisits) async {
          final gymId = context.read<AuthProvider>().profile?.gymId;
          if (gymId == null) throw Exception('Gym not found');
          await memberProvider.sendInvitation(
            gymId: gymId,
            guestEmail: email,
            guestPhone: phone,
            guestName: name.isEmpty ? null : name,
            maxVisits: maxVisits,
          );
        },
      ),
    );
  }
}

class _StatusInfo {
  final Color color;
  final IconData icon;
  const _StatusInfo(this.color, this.icon);
}

// ─── Send Invitation Bottom Sheet ────────────────────────────────────────────

class _SendInvitationSheet extends StatefulWidget {
  final Color primaryColor;
  final bool isPerVisit;
  final int maxInvites;
  final Future<void> Function(String name, String email, String phone, int maxVisits) onSend;

  const _SendInvitationSheet({
    required this.primaryColor,
    required this.isPerVisit,
    required this.maxInvites,
    required this.onSend,
  });

  @override
  State<_SendInvitationSheet> createState() => _SendInvitationSheetState();
}

class _SendInvitationSheetState extends State<_SendInvitationSheet> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  int _visitCount = 1;
  bool _loading = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      await widget.onSend(
        _nameCtrl.text.trim(),
        _emailCtrl.text.trim(),
        _phoneCtrl.text.trim(),
        widget.isPerVisit ? _visitCount : 1,
      );
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(widget.isPerVisit && _visitCount > 1
              ? context.l10n.guestInvSentWithVisits(_visitCount)
              : context.l10n.guestInvSentSimple),
          backgroundColor: Colors.green,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(friendlyError(e)), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      margin: const EdgeInsets.all(12),
      padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + bottomInset),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
      ),
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Handle
            Center(
              child: Container(
                width: 40, height: 4,
                decoration: BoxDecoration(
                  color: theme.colorScheme.outline.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(context.l10n.guestInvSendGuestInvitation,
                style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text(context.l10n.guestInvSheetSubtitle,
                style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
            const SizedBox(height: 24),

            // Guest Name (optional)
            TextFormField(
              controller: _nameCtrl,
              decoration: InputDecoration(
                labelText: context.l10n.guestInvGuestNameOptional,
                prefixIcon: const Icon(Icons.person_outline_rounded),
              ),
              textCapitalization: TextCapitalization.words,
            ),
            const SizedBox(height: 14),

            // Email (required)
            TextFormField(
              controller: _emailCtrl,
              decoration: InputDecoration(
                labelText: context.l10n.guestInvEmailRequired,
                prefixIcon: const Icon(Icons.email_outlined),
              ),
              keyboardType: TextInputType.emailAddress,
              validator: (v) {
                if (v == null || v.trim().isEmpty) return context.l10n.guestInvEmailIsRequired;
                if (!v.contains('@') || !v.contains('.')) return context.l10n.guestInvEnterValidEmail;
                return null;
              },
            ),
            const SizedBox(height: 14),

            // Phone (required)
            TextFormField(
              controller: _phoneCtrl,
              decoration: InputDecoration(
                labelText: context.l10n.guestInvPhoneRequired,
                prefixIcon: const Icon(Icons.phone_outlined),
              ),
              keyboardType: TextInputType.phone,
              validator: (v) {
                if (v == null || v.trim().isEmpty) return context.l10n.guestInvPhoneIsRequired;
                return null;
              },
            ),

            // Visit count selector — only for per_visit plans
            if (widget.isPerVisit) ...[
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: theme.colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(context.l10n.guestInvVisitsToAllocate,
                              style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                          Text(
                            context.l10n.guestInvRemainingAfter(widget.maxInvites - _visitCount),
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: _visitCount > 1
                          ? () => setState(() => _visitCount--)
                          : null,
                      icon: const Icon(Icons.remove_circle_outline_rounded),
                      color: widget.primaryColor,
                      disabledColor: theme.colorScheme.outline.withValues(alpha: 0.3),
                    ),
                    Text(
                      '$_visitCount',
                      style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    IconButton(
                      onPressed: _visitCount < widget.maxInvites
                          ? () => setState(() => _visitCount++)
                          : null,
                      icon: const Icon(Icons.add_circle_outline_rounded),
                      color: widget.primaryColor,
                      disabledColor: theme.colorScheme.outline.withValues(alpha: 0.3),
                    ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 24),

            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: _loading ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: widget.primaryColor,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: _loading
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text(
                        widget.isPerVisit && _visitCount > 1
                            ? context.l10n.guestInvSendWithVisits(_visitCount)
                            : context.l10n.guestInvSendInvitation,
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                      ),
              ),
            ),
            ],
          ),
        ),
      ),
    );
  }
}
