import 'dart:async';

import 'package:clby_offline/clby_offline.dart';
import 'package:flutter/foundation.dart';

import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../services/offline_attendance.dart';
import '../../utils/env.dart';
import 'offline_logic.dart';

/// Result of an offline (outbox) check-in attempt from the scanner.
sealed class OfflineCheckIn {
  const OfflineCheckIn();
}

/// Saved on this phone (state then follows the event live).
class CheckInSaved extends OfflineCheckIn {
  const CheckInSaved(this.event, {required this.asOf});
  final OutboxEvent event;
  final DateTime? asOf;
}

/// Same scan saved moments ago — nothing new written.
class CheckInDuplicate extends OfflineCheckIn {
  const CheckInDuplicate(this.existingEventId);
  final String? existingEventId;
}

/// The QR failed offline verification (§2 steps 1–6).
class CheckInQrRejected extends OfflineCheckIn {
  const CheckInQrRejected(this.reason, {this.outOfDate = false});
  final BranchQrFailure reason;
  final bool outOfDate;
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
    _storeSub = offline.manager.storeChanges.listen(_onStore);
    _onStore(offline.manager.store);
    _onAuth();
  }

  final AuthProvider auth;
  final OfflineAttendance offline;
  final ApiService api;

  StreamSubscription<OfflineStore?>? _storeSub;
  StreamSubscription<SyncState>? _stateSub;
  StreamSubscription<OfflinePolicy>? _policySub;
  SyncState _sync = const SyncState();
  bool _offlineMode = false;
  bool _tried = false;
  bool _checking = false;
  bool _reconnecting = false;
  OfflineEntryBlock? _entryBlock;

  OfflineStore? get store => offline.manager.store;
  SyncState get sync => _sync;
  bool get offlineMode => _offlineMode;
  bool get checkingEntry => _checking;
  OfflineEntryBlock? get entryBlock => _entryBlock;
  bool get memberQrAllowed => store != null && memberQrOfflineAllowed(store!.policy.value);

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
    // once; success leaves offline mode (see _onAuth).
    if (cameOnline && _offlineMode && !_reconnecting) {
      _reconnecting = true;
      auth.refreshProfile().whenComplete(() => _reconnecting = false);
    }
    notifyListeners();
  }

  void _onAuth() {
    if (auth.profile != null) {
      _tried = false;
      if (_offlineMode) {
        _offlineMode = false;
        notifyListeners();
      }
      return;
    }
    if (auth.userId == null) {
      _tried = false;
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
        if (block != null && s != null) await offline.manager.deactivate();
      }
      _entryBlock = block;
      // The profile may have loaded meanwhile (network came back).
      _offlineMode = block == null && auth.profile == null && auth.userId != null;
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

  /// "Try to reconnect" in offline mode.
  Future<void> retryOnline() => auth.refreshProfile();

  ScanPath scanPath(String code) => chooseScanPath(
        claimsV2: BranchQr.claimsV2(code),
        policyAllows: memberQrAllowed,
        storeOpen: store != null,
        offlineMode: _offlineMode,
      );

  /// §4 offline check-in: verify (§2 1–6) → local pre-check (step 7, no
  /// event on denial) → record `member_qr` (self, branch, `qr.raw`).
  Future<OfflineCheckIn> checkIn(String raw) async {
    final s = store;
    if (s == null) {
      return const CheckInRefused(null, 'store_unavailable');
    }
    final v = await s.branchQrVerifier.verify(raw);
    switch (v) {
      case BranchQrNotV2():
        return const CheckInQrRejected(BranchQrFailure.qrInvalid);
      case BranchQrInvalid(:final reason, :final outOfDate):
        return CheckInQrRejected(reason, outOfDate: outOfDate);
      case BranchQrValid(:final qr):
        final self = await s.ownMemberId();
        if (self == null) {
          return const CheckInQrRejected(BranchQrFailure.qrUnknownKey);
        }
        final denial = gymEntryDenialCached(await s.membershipsOf(self), qr.branchId);
        if (denial != null) return CheckInDenied(denial);
        final o = await s.recorder.record(NewOfflineEvent.attendance(
          method: AttendanceMethod.memberQr,
          memberId: self,
          branchId: qr.branchId,
          qrRaw: raw,
          metadata: {'source': 'member_scan', 'qr_v': 2, 'qr_mode': qr.mode},
        ));
        final asOfRaw = await s.db.readMeta(SyncMetaKeys.asOf);
        return switch (o) {
          RecordSaved(:final event) => CheckInSaved(event,
              asOf: asOfRaw == null ? null : DateTime.tryParse(asOfRaw)),
          RecordDuplicate(:final existingEventId) => CheckInDuplicate(existingEventId),
          RecordRefused(:final reason, :final message) => CheckInRefused(reason, message),
        };
    }
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
    auth.removeListener(_onAuth);
    _storeSub?.cancel();
    _stateSub?.cancel();
    _policySub?.cancel();
    super.dispose();
  }
}
