import 'package:clby_offline/clby_offline.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_colors.dart';
import '../../core/constants/app_text.dart';
import '../../widgets/c_button.dart';
import '../../widgets/clby_app_bar.dart';
import 'coach_offline_controller.dart';
import 'offline_strings.dart';
import 'offline_widgets.dart';

/// Readiness panel + read-only "This device" history (PHASE2 UI rules).
class SyncStatusScreen extends StatefulWidget {
  const SyncStatusScreen({super.key});

  @override
  State<SyncStatusScreen> createState() => _SyncStatusScreenState();
}

class _SyncStatusScreenState extends State<SyncStatusScreen> {
  ({int members, int assignments, int classSessions, int passKeys})? _counts;
  bool _refreshing = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadCounts());
  }

  Future<void> _loadCounts() async {
    final s = context.read<CoachOfflineController>().store;
    final c = await s?.cachedCounts();
    if (mounted) setState(() => _counts = c);
  }

  Future<void> _run(Future<void> Function() op) async {
    setState(() => _refreshing = true);
    try {
      await op();
    } catch (_) {
      // State (indicator/lastError) already reflects the failure.
    }
    await _loadCounts();
    if (mounted) setState(() => _refreshing = false);
  }

  @override
  Widget build(BuildContext context) {
    final t = OfflineStrings.current();
    final c = context.watch<CoachOfflineController>();
    final s = c.sync;
    final store = c.store;
    return OfflineDirectionality(
      strings: t,
      child: Scaffold(
        backgroundColor: AppColors.bg,
        body: Column(
          children: [
            ClbyAppBar(
                title: t.readinessTitle,
                onBack: () => context.pop(),
                trailing: const SyncIndicatorChip(onTap: _noop)),
            Expanded(
              child: store == null
                  ? Padding(
                      padding: const EdgeInsets.all(16),
                      child: OfflineNotice(text: t.storeUnavailable, tone: AppColors.warn))
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(16, 14, 16, 32),
                      children: [
                        _Card(children: [
                          _kv(t.lastSync, s.lastSuccessfulSyncAt == null ? t.never : fmtWhen(s.lastSuccessfulSyncAt)),
                          _kv(t.dataAsOf, s.dataAsOf == null ? t.never : fmtWhen(s.dataAsOf)),
                          _kv(t.dataAge, fmtAge(s.dataAge),
                              tone: s.dataExpired ? AppColors.warn : null),
                          _kv(t.cachedAssignments, '${_counts?.assignments ?? '—'}'),
                          _kv(t.cachedMembers, '${_counts?.members ?? '—'}'),
                          _kv(t.offlineEnabled, c.policyEnabled ? t.yes : t.no),
                          if (s.lastError != null && s.indicator != SyncIndicator.online)
                            Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Text(s.lastError!,
                                  style: AppText.mono(size: 10.5, letterSpacing: 0.2, color: AppColors.danger)),
                            ),
                        ]),
                        const SizedBox(height: 12),
                        Row(children: [
                          Expanded(
                            child: CButton(
                              key: const Key('refresh-data'),
                              label: t.refreshData,
                              icon: Icons.download_rounded,
                              variant: CButtonVariant.secondary,
                              isLoading: _refreshing,
                              disabled: _refreshing,
                              onTap: () => _run(c.refreshData),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: CButton(
                              key: const Key('sync-now'),
                              label: t.syncNow,
                              icon: Icons.sync_rounded,
                              disabled: _refreshing,
                              onTap: () => _run(c.syncNow),
                            ),
                          ),
                        ]),
                        const SizedBox(height: 22),
                        Text(t.thisDevice.toUpperCase(), style: AppText.mono(size: 11, letterSpacing: 1.4)),
                        const SizedBox(height: 4),
                        Text(t.readOnlyNote, style: AppText.body(size: 12, color: AppColors.textTer)),
                        const SizedBox(height: 10),
                        StreamBuilder<List<OutboxEvent>>(
                          stream: store.watchOutbox(),
                          builder: (context, snap) {
                            final items = snap.data ?? const <OutboxEvent>[];
                            if (items.isEmpty) {
                              return OfflineNotice(text: t.nothingRecorded);
                            }
                            return Column(children: [
                              for (final e in items) _EventRow(event: e, t: t),
                            ]);
                          },
                        ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }

  static void _noop() {}

  Widget _kv(String k, String v, {Color? tone}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(children: [
          Expanded(child: Text(k, style: AppText.body(size: 13, color: AppColors.textSec))),
          Text(v, style: AppText.body(size: 13, weight: FontWeight.w600, color: tone ?? AppColors.text)),
        ]),
      );
}

class _Card extends StatelessWidget {
  const _Card({required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
      );
}

class _EventRow extends StatelessWidget {
  const _EventRow({required this.event, required this.t});
  final OutboxEvent event;
  final OfflineStrings t;

  @override
  Widget build(BuildContext context) {
    final rejected = event.syncStatus == OutboxStatus.rejected.wire;
    return GestureDetector(
      key: Key('event-${event.eventId}'),
      onTap: rejected ? () => _showRejected(context) : null,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(
              child: Text(fmtWhen(event.deviceRecordedAtUtc),
                  style: AppText.body(size: 13.5, weight: FontWeight.w600, color: AppColors.text)),
            ),
            if (rejected) Icon(Icons.chevron_right_rounded, size: 18, color: AppColors.textSec),
          ]),
          if (event.note != null)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(event.note!, style: AppText.body(size: 12.5, color: AppColors.textSec)),
            ),
          const SizedBox(height: 8),
          EventStateChip(event: event),
        ]),
      ),
    );
  }

  void _showRejected(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface,
      builder: (_) => Directionality(
        textDirection: t.direction,
        child: Padding(
          key: const Key('rejected-sheet'),
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(t.rejectedTitle, style: AppText.body(size: 17, weight: FontWeight.w700, color: AppColors.danger)),
            const SizedBox(height: 10),
            Text(event.resultMessage ?? '—', style: AppText.body(size: 14, color: AppColors.text)),
            const SizedBox(height: 12),
            Text('${t.reasonCode}: ${event.resultCode ?? '—'}', style: AppText.mono(size: 11, letterSpacing: 0.4)),
            Text('${t.recordedAt}: ${fmtWhen(event.deviceRecordedAtUtc)}', style: AppText.mono(size: 11, letterSpacing: 0.4)),
            const SizedBox(height: 10),
            Text(t.readOnlyNote, style: AppText.body(size: 12, color: AppColors.textTer)),
          ]),
        ),
      ),
    );
  }
}
