import 'package:clby/l10n/l10n.dart';
import 'package:clby_offline/clby_offline.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'member_offline_controller.dart';
import 'offline_ui.dart';

/// Result sheet for a check-in saved through the outbox: starts at "saved
/// on this phone" and follows the event live to Confirmed / Not accepted.
class OfflineCheckInSheet extends StatelessWidget {
  const OfflineCheckInSheet({
    super.key,
    required this.saved,
    required this.onDone,
    required this.onScanAgain,
  });

  final CheckInSaved saved;
  final VoidCallback onDone;
  final VoidCallback onScanAgain;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final c = context.read<MemberOfflineController>();
    return StreamBuilder<OutboxEvent?>(
      stream: c.watchEvent(saved.event.eventId),
      initialData: saved.event,
      builder: (context, snap) {
        final e = snap.data ?? saved.event;
        final st = OutboxStatus.fromWire(e.syncStatus);
        final (title, subtitle, icon, color) = switch (st) {
          OutboxStatus.synced => (l.checkinConfirmedTitle, null, Icons.check_circle_rounded, kOffSuccess),
          OutboxStatus.rejected => (
              l.checkinNotAcceptedTitle,
              e.resultMessage ?? e.resultCode,
              Icons.block_rounded,
              kOffError
            ),
          _ => (l.checkinSavedTitle, l.checkinSavedSubtitle, Icons.schedule_rounded, kOffWarn),
        };
        return SafeArea(
          child: Padding(
            key: const Key('offline-checkin-sheet'),
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 20),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(icon, size: 56, color: color),
              const SizedBox(height: 14),
              Text(title,
                  key: Key('offline-checkin-${st.wire}'),
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: kOffInk)),
              if (subtitle != null) ...[
                const SizedBox(height: 6),
                Text(subtitle,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 14, color: kOffMuted, height: 1.4)),
              ],
              const SizedBox(height: 8),
              Text(fmtOfflineTime(context, e.deviceRecordedAtUtc),
                  style: const TextStyle(fontSize: 13, color: kOffMuted)),
              if (saved.asOf != null && st != OutboxStatus.synced) ...[
                const SizedBox(height: 4),
                Text(l.checkinMembershipAsOf(fmtOfflineTime(context, saved.asOf)),
                    style: const TextStyle(fontSize: 12, color: kOffMuted)),
              ],
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: kOffInk, minimumSize: const Size.fromHeight(50)),
                  onPressed: onDone,
                  child: Text(l.commonDone),
                ),
              ),
              TextButton(onPressed: onScanAgain, child: Text(l.qrScanAgain)),
            ]),
          ),
        );
      },
    );
  }
}
