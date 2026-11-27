import 'package:clby/l10n/l10n.dart';
import 'package:clby_offline/clby_offline.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'member_offline_controller.dart';
import 'offline_ui.dart';

/// "Check-ins on this phone" (PHASE3 §4): read-only, Saved / Confirmed /
/// Not accepted + reason.
class OfflineCheckinsScreen extends StatelessWidget {
  const OfflineCheckinsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final c = context.watch<MemberOfflineController>();
    return Scaffold(
      backgroundColor: kOffBg,
      appBar: AppBar(
        backgroundColor: kOffBg,
        surfaceTintColor: kOffBg,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: kOffInk),
          onPressed: () => context.canPop() ? context.pop() : context.go('/offline'),
        ),
        title: Text(l.thisPhoneCheckinsTitle,
            style: const TextStyle(color: kOffInk, fontWeight: FontWeight.w700)),
        actions: [
          Padding(
            padding: const EdgeInsetsDirectional.only(end: 12),
            child: Center(child: OfflineSyncChip(onTap: c.syncNow)),
          ),
        ],
      ),
      body: StreamBuilder<List<OutboxEvent>>(
        stream: c.watchCheckIns(),
        builder: (context, snap) {
          final items = (snap.data ?? const <OutboxEvent>[])
              .where((e) => e.kind == EventKind.attendance.wire)
              .toList();
          return ListView(
            padding: const EdgeInsets.fromLTRB(22, 8, 22, 32),
            children: [
              Text(l.thisPhoneCheckinsReadOnly,
                  style: const TextStyle(fontSize: 12.5, color: kOffMuted)),
              const SizedBox(height: 12),
              if (items.isEmpty)
                OfflineCard(
                  child: Text(l.thisPhoneCheckinsEmpty,
                      key: const Key('checkins-empty'),
                      style: const TextStyle(color: kOffMuted)),
                ),
              for (final e in items)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: OfflineCard(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(fmtOfflineTime(context, e.deviceRecordedAtUtc),
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: kOffInk)),
                      const SizedBox(height: 8),
                      CheckInStateChip(event: e),
                    ]),
                  ),
                ),
              if (c.sync.pendingCount > 0 && !c.offlineMode) ...[
                const SizedBox(height: 6),
                OutlinedButton.icon(
                  onPressed: c.syncNow,
                  icon: const Icon(Icons.sync_rounded),
                  label: Text(l.syncNowAction),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}
