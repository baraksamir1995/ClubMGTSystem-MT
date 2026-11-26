import 'dart:async';

import 'package:clby_offline/clby_offline.dart';
import 'package:flutter/foundation.dart';

import '../../services/api_service.dart';
import '../../services/offline_attendance.dart';
import '../../utils/env.dart';
import '../coach/coach_app_state.dart';
import 'offline_logic.dart';

/// Outcome of logging one PT session from the new screens.
sealed class LogResult {
  const LogResult();
}

/// Written to the outbox (state then follows the event: saved → synced /
/// rejected). [cacheExpired]: saved although the snapshot is stale.
class LogSaved extends LogResult {
  const LogSaved(this.event, {this.cacheExpired = false});
  final OutboxEvent event;
  final bool cacheExpired;
}

/// Logged through the existing online endpoint (policy disabled).
class LogOnline extends LogResult {
  const LogOnline();
}

/// Same session saved moments ago (anti-double-tap) — nothing new written.
class LogDuplicate extends LogResult {
  const LogDuplicate(this.existingEventId);
  final String? existingEventId;
}

/// Refused before anything was written (policy, clock, validation, 30-min
/// guard online…). [message] is user-facing.
class LogRefused extends LogResult {
  const LogRefused(this.message, {this.code});
  final String message;
  final String? code;
}

/// Glue between the coach UI and the offline store (Phase 2).
class CoachOfflineController extends ChangeNotifier {
  CoachOfflineController({
    required this.offline,
    required this.api,
    required this.coach,
  }) {
    _storeSub = offline.manager.storeChanges.listen(_onStore);
    _onStore(offline.manager.store);
  }

  final OfflineAttendance offline;
  final ApiService api;
  final CoachAppState coach;

  StreamSubscription<OfflineStore?>? _storeSub;
  StreamSubscription<SyncState>? _stateSub;
  StreamSubscription<OfflinePolicy>? _policySub;
  SyncState _sync = const SyncState();
  bool _offlineMode = false;
  OfflineEntryBlock? _entryBlock;
  bool _checkingEntry = false;

  OfflineStore? get store => offline.manager.store;
  SyncState get sync => _sync;
  bool get offlineMode => _offlineMode;
  OfflineEntryBlock? get entryBlock => _entryBlock;
  bool get checkingEntry => _checkingEntry;
  bool get policyEnabled => store?.policy.value.enabled ?? false;

  LogPath get logPath => chooseLogPath(
      storeOpen: store != null, policyEnabled: policyEnabled, offlineMode: _offlineMode);

  void _onStore(OfflineStore? s) {
    _stateSub?.cancel();
    _policySub?.cancel();
    _stateSub = null;
    _policySub = null;
    if (s != null) {
      _sync = s.engine.state;
      _stateSub = s.syncStates.listen((st) {
        _sync = st;
        notifyListeners();
      });
      _policySub = s.policy.changes.listen((_) => notifyListeners());
    } else {
      _sync = const SyncState();
    }
    notifyListeners();
  }

  /// Offline cold start: let the SAME coach (token + user id in secure
  /// storage) into offline mode with the store of the scope they last used
  /// online — only if that store opens with its own key and holds data.
  Future<bool> tryEnterOfflineMode() async {
    if (_offlineMode) return true;
    if (_checkingEntry) return false;
    _checkingEntry = true;
    notifyListeners();
    try {
      final hasToken = await api.hasSession();
      await api.loadCachedUserId();
      final uid = api.currentUserId;
      final last = await LastOfflineScope.read();
      var block = offlineEntryBlock(
          hasToken: hasToken, tokenUserId: uid, last: last, apiBase: Env.apiUrl);
      if (block == null) {
        final s = await offline.enterOffline(uid!, last!.gymId);
        final hasData = s == null ? null : await s.hasCachedData();
        block = offlineEntryBlock(
            hasToken: hasToken,
            tokenUserId: uid,
            last: last,
            apiBase: Env.apiUrl,
            storeOpened: s != null,
            hasCachedData: hasData);
        if (block != null && s != null) await offline.manager.deactivate();
      }
      _entryBlock = block;
      _offlineMode = block == null;
      return _offlineMode;
    } catch (_) {
      _entryBlock = OfflineEntryBlock.storeUnavailable;
      _offlineMode = false;
      return false;
    } finally {
      _checkingEntry = false;
      notifyListeners();
    }
  }

  /// Back online (roster loaded) — the normal shell takes over.
  void leaveOfflineMode() {
    if (!_offlineMode) return;
    _offlineMode = false;
    notifyListeners();
  }

  /// Cached roster (search by name / member number).
  Future<List<CachedAssignment>> roster({String? query}) async =>
      await store?.cachedAssignments(query: query) ?? const [];

  Future<PassVerdict?> verifyPass(String raw) async => store?.passVerifier.verify(raw);

  Stream<OutboxEvent?> watchEvent(String id) =>
      store?.watchEvent(id) ?? Stream.value(null);

  Future<void> syncNow() async => store?.engine.syncNow();

  Future<void> refreshData() async {
    final s = store;
    if (s == null) return;
    await s.refreshIfStale(force: true, evenIfDisabled: true);
    await s.engine.syncNow();
  }

  /// Logs one PT session on [logPath].
  Future<LogResult> logSession({
    required String memberId,
    required String assignmentId,
    String? note,
    required String source, // 'manual' | 'qr'
    String? qrRaw,
  }) async {
    final cleanNote = (note == null || note.trim().isEmpty) ? null : note.trim();
    switch (logPath) {
      case LogPath.outbox:
        final o = await store!.recorder.record(NewOfflineEvent.serviceSession(
          memberId: memberId,
          serviceAssignmentId: assignmentId,
          note: cleanNote,
          qrRaw: qrRaw,
          metadata: {'source': source},
        ));
        return switch (o) {
          RecordSaved(:final event, :final cacheExpired) =>
            LogSaved(event, cacheExpired: cacheExpired),
          RecordDuplicate(:final existingEventId) => LogDuplicate(existingEventId),
          RecordRefused(:final reason, :final message) =>
            LogRefused(message, code: reason.name),
        };
      case LogPath.online:
        try {
          if (coach.assignmentById(assignmentId) != null) {
            await coach.confirmSession(assignmentId: assignmentId, note: cleanNote);
          } else {
            await api.decrementSession(assignmentId: assignmentId, note: cleanNote);
          }
          return const LogOnline();
        } on RecentlyLoggedException catch (e) {
          return LogRefused('recently_logged:${e.minutesLeft}', code: 'recently_logged');
        } on ApiException catch (e) {
          return LogRefused(e.message, code: e.code);
        }
      case LogPath.unavailable:
        return const LogRefused('offline_disabled', code: 'offline_disabled');
    }
  }

  @override
  void dispose() {
    _storeSub?.cancel();
    _stateSub?.cancel();
    _policySub?.cancel();
    super.dispose();
  }
}
