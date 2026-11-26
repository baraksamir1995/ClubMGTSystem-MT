import 'package:clby_offline/clby_offline.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_colors.dart';
import '../../core/constants/app_text.dart';
import '../../widgets/c_button.dart';
import '../../widgets/clby_app_bar.dart';
import '../coach/coach_app_state.dart';
import '../coach/models.dart';
import 'coach_offline_controller.dart';
import 'offline_logic.dart';
import 'offline_strings.dart';
import 'offline_widgets.dart';

/// Arguments when the member was picked by scanning a pass.
class OfflineLogArgs {
  const OfflineLogArgs({required this.memberId, this.qrRaw, this.source = 'manual'});
  final String memberId;
  final String? qrRaw;
  final String source;
}

/// PT session log (PHASE2): pick member → active cached package → note →
/// confirm. Path per [CoachOfflineController.logPath]: outbox when offline
/// mode is enabled, else the existing online decrement endpoint.
class OfflineLogScreen extends StatefulWidget {
  const OfflineLogScreen({super.key, this.args});
  final OfflineLogArgs? args;

  @override
  State<OfflineLogScreen> createState() => _OfflineLogScreenState();
}

class _OfflineLogScreenState extends State<OfflineLogScreen> {
  final _search = TextEditingController();
  final _note = TextEditingController();
  List<CachedAssignment> _rows = const [];
  String? _memberId;
  String? _assignmentId;
  bool _saving = false;
  LogResult? _result;
  DateTime? _asOf;

  @override
  void initState() {
    super.initState();
    _memberId = widget.args?.memberId;
    _search.addListener(_load);
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _search.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final c = context.read<CoachOfflineController>();
    var rows = await c.roster(query: _search.text);
    // Online with nothing cached yet (e.g. bootstrap pending): fall back to
    // the live roster so the screen still works.
    if (rows.isEmpty && _search.text.isEmpty && mounted) {
      rows = context.read<CoachAppState>().assignments.map(_fromLive).toList();
    }
    final asOfRaw = await c.store?.db.readMeta(SyncMetaKeys.asOf);
    if (!mounted) return;
    setState(() {
      _rows = rows;
      _asOf = asOfRaw == null ? null : DateTime.tryParse(asOfRaw);
    });
  }

  static CachedAssignment _fromLive(CoachAssignment a) => CachedAssignment(
        assignmentId: a.assignmentId,
        gymMemberId: a.member.id,
        memberName: a.member.name,
        memberNumber: a.member.memberNumber?.toString(),
        photoUrl: a.member.photoUrl,
        packageName: a.packageName,
        serviceType: a.serviceType,
        sessionsTotal: a.sessionsTotal,
        sessionsUsed: a.sessionsUsed,
        status: a.state == AssignmentState.inactive ? 'completed' : 'active',
        expiresAt: a.expiresAt?.toUtc().toIso8601String(),
        lastSessionAt: a.lastSessionAt?.toUtc().toIso8601String(),
      );

  @override
  Widget build(BuildContext context) {
    final t = OfflineStrings.current();
    final c = context.watch<CoachOfflineController>();
    return OfflineDirectionality(
      strings: t,
      child: Scaffold(
        backgroundColor: AppColors.bg,
        body: Column(
          children: [
            ClbyAppBar(
              title: t.logSession,
              onBack: () => context.pop(),
              trailing: const SyncIndicatorChip(),
            ),
            if (c.logPath != LogPath.outbox)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: OfflineNotice(
                  key: const Key('path-notice'),
                  text: c.logPath == LogPath.online ? t.policyOffNote : t.policyOffOffline,
                  tone: c.logPath == LogPath.unavailable ? AppColors.warn : null,
                ),
              ),
            Expanded(
              child: _result != null
                  ? _ResultView(result: _result!, strings: t)
                  : _memberId == null
                      ? _memberList(t)
                      : _memberDetail(t, c),
            ),
          ],
        ),
      ),
    );
  }

  Widget _memberList(OfflineStrings t) {
    final byMember = <String, List<CachedAssignment>>{};
    for (final a in _rows) {
      (byMember[a.gymMemberId] ??= []).add(a);
    }
    final members = byMember.entries.toList();
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: TextField(
            key: const Key('roster-search'),
            controller: _search,
            decoration: InputDecoration(
              hintText: t.searchHint,
              prefixIcon: const Icon(Icons.search_rounded, size: 18),
              filled: true,
              fillColor: AppColors.surface,
              isDense: true,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: AppColors.border),
              ),
            ),
          ),
        ),
        if (_asOf != null)
          Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(18, 4, 18, 4),
            child: Align(
              alignment: AlignmentDirectional.centerStart,
              child: Text(t.asOf(fmtWhen(_asOf)),
                  style: AppText.mono(size: 10.5, letterSpacing: 0.8)),
            ),
          ),
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(14, 6, 14, 24),
            itemCount: members.length,
            separatorBuilder: (_, _) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final rows = members[i].value;
              final first = rows.first;
              final now = DateTime.now();
              final active = rows.where((a) => isActiveCachedAssignment(a, now)).length;
              return _Tile(
                key: Key('member-${first.gymMemberId}'),
                leading: MemberPhoto(name: first.memberName ?? '', url: first.photoUrl),
                title: first.memberName ?? '—',
                subtitle: [
                  if (first.memberNumber != null) '#${first.memberNumber}',
                  '$active/${rows.length}',
                ].join(' · '),
                onTap: () => setState(() {
                  _memberId = first.gymMemberId;
                  _assignmentId = null;
                }),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _memberDetail(OfflineStrings t, CoachOfflineController c) {
    final rows = _rows.where((a) => a.gymMemberId == _memberId).toList();
    final now = DateTime.now();
    final active = rows.where((a) => isActiveCachedAssignment(a, now)).toList();
    if (active.length == 1 && _assignmentId == null) _assignmentId = active.single.assignmentId;
    final head = rows.isEmpty ? null : rows.first;
    final canConfirm = !_saving && _assignmentId != null && c.logPath != LogPath.unavailable;
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
            children: [
              if (head != null)
                Row(children: [
                  MemberPhoto(name: head.memberName ?? '', url: head.photoUrl, size: 64),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(head.memberName ?? '—',
                          style: AppText.body(size: 18, weight: FontWeight.w600, color: AppColors.text)),
                      if (head.memberNumber != null)
                        Text('#${head.memberNumber}', style: AppText.mono(size: 12)),
                      if (_asOf != null)
                        Text(t.asOf(fmtWhen(_asOf)), style: AppText.mono(size: 10.5, letterSpacing: 0.8)),
                    ]),
                  ),
                ]),
              if (widget.args?.source == 'qr') ...[
                const SizedBox(height: 12),
                OfflineNotice(text: t.confirmIdentity, icon: Icons.verified_user_outlined, tone: AppColors.primary),
              ],
              const SizedBox(height: 18),
              Text(t.pickAssignment.toUpperCase(), style: AppText.mono(size: 11, letterSpacing: 1.4)),
              const SizedBox(height: 8),
              if (active.isEmpty) OfflineNotice(text: t.noActiveAssignments, tone: AppColors.warn),
              for (final a in active) ...[
                _Tile(
                  key: Key('assignment-${a.assignmentId}'),
                  selected: a.assignmentId == _assignmentId,
                  leading: Icon(Icons.fitness_center_rounded, color: AppColors.textSec),
                  title: a.packageName ?? a.serviceType ?? '—',
                  subtitle: sessionsLeft(a) == null ? '' : t.sessionsLeft(sessionsLeft(a)!),
                  onTap: () => setState(() => _assignmentId = a.assignmentId),
                ),
                const SizedBox(height: 8),
              ],
              const SizedBox(height: 10),
              TextField(
                key: const Key('note'),
                controller: _note,
                maxLength: OfflineEventRecorder.maxNoteLength,
                minLines: 1,
                maxLines: 3,
                decoration: InputDecoration(
                  hintText: t.noteHint,
                  filled: true,
                  fillColor: AppColors.surface,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.fromLTRB(18, 12, 18, 28),
          decoration: BoxDecoration(
            color: AppColors.bg,
            border: Border(top: BorderSide(color: AppColors.border, width: 0.5)),
          ),
          child: CButton(
            key: const Key('confirm'),
            label: t.confirmSession,
            icon: Icons.check_rounded,
            size: CButtonSize.lg,
            full: true,
            disabled: !canConfirm,
            isLoading: _saving,
            onTap: canConfirm ? () => _confirm(c) : null,
          ),
        ),
      ],
    );
  }

  Future<void> _confirm(CoachOfflineController c) async {
    setState(() => _saving = true);
    final r = await c.logSession(
      memberId: _memberId!,
      assignmentId: _assignmentId!,
      note: _note.text,
      source: widget.args?.source ?? 'manual',
      qrRaw: widget.args?.qrRaw,
    );
    if (!mounted) return;
    setState(() {
      _saving = false;
      _result = r;
    });
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    super.key,
    required this.leading,
    required this.title,
    required this.subtitle,
    this.onTap,
    this.selected = false,
  });
  final Widget leading;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: selected ? AppColors.primarySoft : AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: selected ? AppColors.primary : AppColors.border),
        ),
        child: Row(children: [
          leading,
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: AppText.body(size: 14, weight: FontWeight.w600, color: AppColors.text)),
              if (subtitle.isNotEmpty) Text(subtitle, style: AppText.mono(size: 11, letterSpacing: 0.6)),
            ]),
          ),
          if (selected) Icon(Icons.check_circle_rounded, color: AppColors.primary, size: 20),
        ]),
      ),
    );
  }
}

class _ResultView extends StatelessWidget {
  const _ResultView({required this.result, required this.strings});
  final LogResult result;
  final OfflineStrings strings;

  @override
  Widget build(BuildContext context) {
    final t = strings;
    final c = context.read<CoachOfflineController>();
    Widget body;
    switch (result) {
      case LogSaved(:final event, :final cacheExpired):
        body = StreamBuilder<OutboxEvent?>(
          stream: c.watchEvent(event.eventId),
          initialData: event,
          builder: (_, snap) {
            final e = snap.data ?? event;
            return Column(mainAxisSize: MainAxisSize.min, children: [
              EventStateChip(key: const Key('result-state'), event: e),
              if (cacheExpired) ...[
                const SizedBox(height: 10),
                OfflineNotice(text: t.dataExpired, tone: AppColors.warn),
              ],
            ]);
          },
        );
      case LogOnline():
        body = OfflineNotice(text: t.loggedOnline, icon: Icons.check_circle_outline_rounded, tone: AppColors.success);
      case LogDuplicate():
        body = OfflineNotice(text: t.duplicateTap, tone: AppColors.warn);
      case LogRefused(:final message, :final code):
        final text = switch (code) {
          'recently_logged' => t.recentlyLogged(int.tryParse(message.split(':').last) ?? 30),
          'clockSkew' => t.clockSkew,
          'offline_disabled' || 'offlineDisabled' => t.policyOffOffline,
          _ => message,
        };
        body = OfflineNotice(text: text, icon: Icons.error_outline_rounded, tone: AppColors.danger);
    }
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          body,
          const SizedBox(height: 24),
          CButton(label: t.done, variant: CButtonVariant.secondary, onTap: () => context.pop()),
        ],
      ),
    );
  }
}
