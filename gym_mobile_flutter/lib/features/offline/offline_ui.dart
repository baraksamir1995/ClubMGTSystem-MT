import 'package:clby/l10n/l10n.dart';
import 'package:clby_offline/clby_offline.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import 'member_offline_controller.dart';

// Member-app design tokens (same values as profile_screen.dart).
const kOffInk = Color(0xFF1F1A14);
const kOffBg = Color(0xFFF7F6F2);
const kOffCard = Color(0xFFFFFFFF);
const kOffHair = Color(0x141F1A14);
const kOffMuted = Color(0xFF6B6860);
const kOffSuccess = Color(0xFF3F8B5C);
const kOffSuccessBg = Color(0xFFE4F0E6);
const kOffWarn = Color(0xFFB6531B);
const kOffWarnBg = Color(0xFFFBEAD6);
const kOffError = Color(0xFFC24E3D);
const kOffErrorBg = Color(0xFFFBE3DE);

String fmtOfflineTime(BuildContext context, DateTime? t) {
  if (t == null) return '—';
  final locale = Localizations.localeOf(context).toLanguageTag();
  try {
    return DateFormat.yMMMd(locale).add_Hm().format(t.toLocal());
  } catch (_) {
    return DateFormat('d MMM y, HH:mm', 'en').format(t.toLocal());
  }
}

String fmtOfflineDate(BuildContext context, DateTime? t) {
  if (t == null) return '—';
  final locale = Localizations.localeOf(context).toLanguageTag();
  try {
    return DateFormat.yMMMd(locale).format(t.toLocal());
  } catch (_) {
    return DateFormat('d MMM y', 'en').format(t.toLocal());
  }
}

String syncLabel(BuildContext context, SyncState s) {
  final l = context.l10n;
  return switch (s.indicator) {
    SyncIndicator.online => l.syncOnline,
    SyncIndicator.offline => l.syncOffline,
    SyncIndicator.syncing => l.syncSyncing,
    SyncIndicator.pending => l.syncPending(s.pendingCount),
    SyncIndicator.failed => l.syncFailed,
    SyncIndicator.expired => l.syncDataExpired,
    SyncIndicator.authRequired => l.syncLoginRequired,
    SyncIndicator.deviceRevoked || SyncIndicator.deviceMismatch => l.syncDeviceBlocked,
  };
}

/// Per-item state; a local item is never shown as confirmed.
String checkInStateLabel(BuildContext context, OutboxEvent e) {
  final l = context.l10n;
  return switch (OutboxStatus.fromWire(e.syncStatus)) {
    OutboxStatus.synced => l.checkinStateConfirmed,
    OutboxStatus.rejected => l.checkinStateNotAccepted(e.resultMessage ?? e.resultCode ?? '—'),
    OutboxStatus.pending || OutboxStatus.syncing => l.checkinStateSaved,
  };
}

/// Small sync indicator for the scanner / pass / offline screens.
class OfflineSyncChip extends StatelessWidget {
  const OfflineSyncChip({super.key, this.onTap});
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.watch<MemberOfflineController>();
    if (c.store == null) return const SizedBox.shrink();
    final s = c.sync;
    final (fg, bg, icon) = switch (s.indicator) {
      SyncIndicator.online => (kOffSuccess, kOffSuccessBg, Icons.cloud_done_outlined),
      SyncIndicator.syncing => (kOffInk, kOffCard, Icons.sync_rounded),
      SyncIndicator.pending || SyncIndicator.expired => (kOffWarn, kOffWarnBg, Icons.schedule_rounded),
      SyncIndicator.offline => (kOffMuted, kOffCard, Icons.cloud_off_rounded),
      _ => (kOffError, kOffErrorBg, Icons.error_outline_rounded),
    };
    return GestureDetector(
      onTap: onTap,
      child: Container(
        key: const Key('offline-sync-chip'),
        padding: const EdgeInsetsDirectional.fromSTEB(10, 6, 12, 6),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: kOffHair),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 14, color: fg),
          const SizedBox(width: 6),
          Text(syncLabel(context, s),
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: fg)),
        ]),
      ),
    );
  }
}

class CheckInStateChip extends StatelessWidget {
  const CheckInStateChip({super.key, required this.event});
  final OutboxEvent event;

  @override
  Widget build(BuildContext context) {
    final st = OutboxStatus.fromWire(event.syncStatus);
    final (fg, bg, icon) = switch (st) {
      OutboxStatus.synced => (kOffSuccess, kOffSuccessBg, Icons.check_circle_outline_rounded),
      OutboxStatus.rejected => (kOffError, kOffErrorBg, Icons.block_rounded),
      _ => (kOffWarn, kOffWarnBg, Icons.schedule_rounded),
    };
    return Container(
      padding: const EdgeInsetsDirectional.fromSTEB(8, 4, 10, 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 14, color: fg),
        const SizedBox(width: 6),
        Flexible(
          child: Text(checkInStateLabel(context, event),
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: fg)),
        ),
      ]),
    );
  }
}

/// White rounded card used by the offline screens.
class OfflineCard extends StatelessWidget {
  const OfflineCard({super.key, required this.child, this.padding = const EdgeInsets.all(16)});
  final Widget child;
  final EdgeInsetsGeometry padding;
  @override
  Widget build(BuildContext context) => Container(
        padding: padding,
        decoration: BoxDecoration(
          color: kOffCard,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: kOffHair),
        ),
        child: child,
      );
}
