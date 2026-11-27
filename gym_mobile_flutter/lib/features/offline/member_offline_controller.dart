import 'dart:async';

import 'package:clby_offline/clby_offline.dart';
import 'package:flutter/widgets.dart';

import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../services/offline_attendance.dart';
import '../../utils/env.dart';
import 'offline_logic.dart';
import 'offline_retry.dart';

/// Result of an offline (outbox) check-in attempt from the scanner.
sealed class OfflineCheckIn {
  const OfflineCheckIn();
}

/// Saved on this phone (state then follows the event live).
class CheckInSaved extends OfflineCheckIn {
  const CheckInSaved(this.event, {required this.asOf, this.coachSession = false});
  final OutboxEvent event;
  final DateTime? asOf;
  /// A coach session (scanned coach QR) rather than a gym check-in.
  final bool coachSession;
}

/// Same scan saved moments ago — nothing new written.
class CheckInDuplicate extends OfflineCheckIn {
  const CheckInDuplicate(this.existingEventId, {this.coachSession = false});
  final String? existingEventId;
  /// Duplicate coach-session scan (→ the coach "already logged" message).
  final bool coachSession;
}

/// The QR failed offline verification (gym QR §2 / coach QR Amendment 2).
/// [code]: qr_invalid | qr_wrong_gym | qr_unknown_key | qr_expired.
class CheckInQrRejected extends OfflineCheckIn {
  const CheckInQrRejected(this.code, {this.outOfDate = false, this.unknownTrainer = false});
  final String code;
  /// Gym QR whose branch token isn't the cached current one.
  final bool outOfDate;
  /// Coach QR for a trainer that isn't a cached active trainer.
  final bool unknownTrainer;
}

/// Offline coach-session pre-check denied (today's codes no_package /
/// package_expired / package_exhausted) — nothing recorded.
class CheckInSpecialistDenied extends OfflineCheckIn {
  const CheckInSpecialistDenied(this.denial, {this.serviceType});
  final SpecialistDenial denial;
  final String? serviceType;
}

/// Local membership pre-check denied entry (§2 step 7) — nothing recorded.
class CheckInDenied extends OfflineCheckIn {
  const CheckInDenied(this.denial);
  final EntryDenial denial;
}

/// Refused before writing (clock skew, policy, missing snapshot…).
class CheckInRefused extends OfflineCheckIn {
  const CheckInRefused(this.reason, this.message);
  final RecordRefusal? reason;
  final String message;
}

/// Member-app offline glue (PHASE3 §4): limited offline mode on cold start,
/// scanner path selection, offline check-in, sync state for the UI.
class MemberOfflineController extends ChangeNotifier {
  MemberOfflineController({
    required this.auth,
    required this.offline,
    required this.api,
  }) {
    auth.addListener(_onAuth);
    _retry = OfflineRetryScheduler(retry: _retryProfile);
    // App resume while in offline mode → retry the normal load now.
    _lifecycle = AppLifecycleListener(onResume: () {
      if (_offlineMode) unawaited(_retry.retryNow());
    });
    _storeSub = offline.manager.storeChanges.listen(_onStore);
    _onStore(offline.manager.store);
    _onAuth();
  }

  final AuthProvider auth;
  final OfflineAttendance offline;
  final ApiService api;

  late final OfflineRetryScheduler _retry;
  AppLifecycleListener? _lifecycle;
  StreamSubscription<OfflineStore?>? _storeSub;
  StreamSubscription<SyncState>? _stateSub;
  StreamSubscription<OfflinePolicy>? _policySub;
  SyncState _sync = const SyncState();
  bool _offlineMode = false;
  bool _tried = false;
  bool _checking = false;
  OfflineEntryBlock? _entryBlock;

  OfflineStore? get store => offline.manager.store;
  SyncState get sync => _sync;
  bool get offlineMode => _offlineMode;
  bool get checkingEntry => _checking;
  OfflineEntryBlock? get entryBlock => _entryBlock;
  /// Offline check-in allowed by the gym's policy. Every new piece of UI is
  /// gated on this: policy off → the app looks and behaves as today.
  bool get memberQrAllowed => store != null && memberQrOfflineAllowed(store!.policy.value);

  /// Actually offline right now — the cached pre-check only runs then.
  bool get isOfflineNow =>
      shouldRunLocalPreCheck(offlineMode: _offlineMode, online: _sync.online);

  /// Shell status chip (only with offline check-in allowed).
  bool get showStatus => shouldShowStatus(
        policyAllows: memberQrAllowed,
        offlineMode: _offlineMode,
        online: _sync.online,
        pending: _sync.pendingCount,
        failing: _sync.indicator == SyncIndicator.failed || _sync.pause != null,
      );

  void _onStore(OfflineStore? s) {
    _stateSub?.cancel();
    _policySub?.cancel();
    _stateSub = null;
    _policySub = null;
    if (s != null) {
      // White-label builds: branch QRs must also be for Env.gymId.
      if (Env.gymId.isNotEmpty) s.gymLock = Env.gymId;
      _sync = s.engine.state;
      _stateSub = s.syncStates.listen(_onSync);
      _policySub = s.policy.changes.listen((_) => notifyListeners());
    } else {
      _sync = const SyncState();
    }
    notifyListeners();
  }

  void _onSync(SyncState st) {
    final cameOnline = !_sync.online && st.online;
    _sync = st;
    // Back online while in offline mode: retry the normal profile load
    // now; success leaves offline mode (see _onAuth).
    if (cameOnline && _offlineMode) unawaited(_retry.retryNow());
    notifyListeners();
  }

  void _onAuth() {
    if (auth.profile != null) {
      _tried = false;
      _retry.stop();
      if (_offlineMode) {
        _offlineMode = false;
        notifyListeners();
      }
      return;
    }
    if (auth.userId == null) {
      _tried = false;
      _retry.stop();
      if (_offlineMode) {
        _offlineMode = false;
        notifyListeners();
      }
      return;
    }
    if (auth.profileError == LoadErrorKind.forbidden) {
      // 403: never offline mode; keep queued events, stop sending.
      store?.engine.pause(SyncPauseReason.forbidden, message: auth.error);
      if (_offlineMode) {
        _offlineMode = false;
        notifyListeners();
      }
      return;
    }
    if (!_tried &&
        shouldTryOfflineMode(
          userId: auth.userId,
          hasProfile: auth.profile != null,
          isLoading: auth.isLoading,
          isGuest: auth.isGuest,
          profileError: auth.profileError,
        )) {
      _tried = true;
      unawaited(tryEnterOfflineMode());
    }
  }

  /// Same rules as the coach app: the token's user == the last scope used
  /// online on this phone, same API, the store opens with its own key and
  /// holds a snapshot.
  Future<bool> tryEnterOfflineMode() async {
    if (_offlineMode) return true;
    if (_checking) return false;
    _checking = true;
    notifyListeners();
    try {
      final hasToken = await api.hasSession();
      final uid = auth.userId;
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
        // Policy off (cached) → behave exactly like today: no offline mode.
        if (block == null && s != null && !memberQrOfflineAllowed(s.policy.value)) {
          await offline.manager.deactivate();
          _entryBlock = null;
          _offlineMode = false;
          return false;
        }
        if (block != null && s != null) await offline.manager.deactivate();
      }
      _entryBlock = block;
      // The profile may have loaded meanwhile (network came back).
      _offlineMode = block == null && auth.profile == null && auth.userId != null;
      // Keep trying the normal load with backoff while offline (M2).
      if (_offlineMode) _retry.start();
      return _offlineMode;
    } catch (_) {
      _entryBlock = OfflineEntryBlock.storeUnavailable;
      _offlineMode = false;
      return false;
    } finally {
      _checking = false;
      notifyListeners();
    }
  }

  /// "Retry now" (status chip / check-ins screen / pull-to-refresh) while in
  /// offline mode. True when back online.
  Future<bool> retryNow() => _retry.retryNow();

  Future<bool> _retryProfile() async {
    if (auth.isLoading) return false;
    await auth.refreshProfile();
    return auth.profile != null;
  }

  ScanPath scanPath(String code) {
    final coach = SpecialistQr.claimsV2(code);
    return chooseScanPath(
        claimsV2: coach || BranchQr.claimsV2(code),
        // Coach QR offline also needs allow_service_session_offline (server
        // offline gate); gym QR needs enabled + allow_member_qr_offline.
        policyAllows: memberQrAllowed &&
            (!coach || store!.policy.value.allowServiceSessionOffline),
        storeOpen: store != null,
        offlineMode: _offlineMode,
      );
  }

  /// Outbox check-in for a v2 gym QR or v2 coach QR: verify offline →
  /// cached pre-check ONLY when actually offline (online the server
  /// decides; a stale snapshot never denies an online member) → record.
  Future<OfflineCheckIn> checkIn(String raw) async {
    final s = store;
    if (s == null) return const CheckInRefused(null, 'store_unavailable');
    final self = await s.ownMemberId();
    if (self == null) return const CheckInQrRejected('qr_unknown_key');
    return SpecialistQr.claimsV2(raw) ? _coachSession(s, self, raw) : _gymEntry(s, self, raw);
  }

  Future<OfflineCheckIn> _gymEntry(OfflineStore s, String self, String raw) async {
    final v = await s.branchQrVerifier.verify(raw);
    switch (v) {
      case BranchQrNotV2():
        return const CheckInQrRejected('qr_invalid');
      case BranchQrInvalid(:final reason, :final outOfDate):
        return CheckInQrRejected(reason.code, outOfDate: outOfDate);
      case BranchQrValid(:final qr):
        if (isOfflineNow) {
          final denial = gymEntryDenialCached(await s.membershipsOf(self), qr.branchId);
          if (denial != null) return CheckInDenied(denial);
        }
        final o = await s.recorder.record(NewOfflineEvent.attendance(
          method: AttendanceMethod.memberQr,
          memberId: self,
          branchId: qr.branchId,
          qrRaw: raw,
          metadata: {'source': 'member_scan', 'qr_v': 2, 'qr_mode': qr.mode},
        ));
        return _outcome(s, o, coachSession: false);
    }
  }

  Future<OfflineCheckIn> _coachSession(OfflineStore s, String self, String raw) async {
    final v = await s.specialistQrVerifier.verify(raw);
    switch (v) {
      case SpecialistQrNotV2():
        return const CheckInQrRejected('qr_invalid');
      case SpecialistQrInvalid(:final reason, :final unknownTrainer):
        return CheckInQrRejected(reason.code, unknownTrainer: unknownTrainer);
      case SpecialistQrValid(:final qr, :final trainer):
        if (isOfflineNow) {
          final pc = specialistPreCheck(
              await s.assignmentsOf(self), qr.trainerId, s.serverClock.deviceNow());
          if (pc.denial != null) {
            return CheckInSpecialistDenied(pc.denial!, serviceType: trainer.serviceType);
          }
        }
        final o = await s.recorder.record(NewOfflineEvent.memberServiceSession(
          memberId: self,
          trainerId: qr.trainerId,
          qrRaw: raw,
          metadata: {'source': 'member_scan', 'qr_v': 2},
        ));
        return _outcome(s, o, coachSession: true);
    }
  }

  Future<OfflineCheckIn> _outcome(OfflineStore s, RecordOutcome o, {required bool coachSession}) async {
    final asOfRaw = await s.db.readMeta(SyncMetaKeys.asOf);
    return switch (o) {
      RecordSaved(:final event) => CheckInSaved(event,
          asOf: asOfRaw == null ? null : DateTime.tryParse(asOfRaw), coachSession: coachSession),
      RecordDuplicate(:final existingEventId) =>
        CheckInDuplicate(existingEventId, coachSession: coachSession),
      RecordRefused(:final reason, :final message) => CheckInRefused(reason, message),
    };
  }

  Stream<OutboxEvent?> watchEvent(String id) => store?.watchEvent(id) ?? Stream.value(null);

  Stream<List<OutboxEvent>> watchCheckIns() =>
      store?.watchOutbox() ?? Stream.value(const <OutboxEvent>[]);

  /// Pending (not yet confirmed) check-ins of the open store.
  int get pendingCount => _sync.pendingCount;

  Future<void> syncNow() async => store?.engine.syncNow();

  /// Refresh the snapshot (pass, branches, keys) when online.
  Future<void> refreshData() async {
    final s = store;
    if (s == null) return;
    await s.refreshIfStale(force: true, evenIfDisabled: true);
  }

  @override
  void dispose() {
    _retry.dispose();
    _lifecycle?.dispose();
    auth.removeListener(_onAuth);
    _storeSub?.cancel();
    _stateSub?.cancel();
    _policySub?.cancel();
    super.dispose();
  }
}
