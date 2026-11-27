import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../cache/bootstrap_service.dart';
import '../db/offline_database.dart';
import '../db/open.dart';
import '../errors.dart';
import '../model/clock_offset.dart';
import '../pass/branch_qr.dart';
import '../pass/member_pass.dart';
import '../pass/specialist_qr.dart';
import '../model/enums.dart';
import '../model/policy_holder.dart';
import '../model/sync_models.dart';
import '../recorder/offline_event_recorder.dart';
import '../recorder/timezone.dart';
import '../scope.dart';
import '../security/key_store.dart';
import '../sync/sync_engine.dart';
import '../sync/sync_state.dart';
import '../sync/transport.dart';

/// Default directory for offline databases: `<app support>/clby_offline`.
Future<Directory> defaultOfflineDirectory() async => Directory(
    p.join((await getApplicationSupportDirectory()).path, 'clby_offline'));

/// One open, scoped offline store: encrypted DB + recorder + sync engine +
/// bootstrap. At most one instance per scope per process.
class OfflineStore {
  OfflineStore._({
    required this.scope,
    required this.app,
    required this.db,
    required this.policy,
    required this.recorder,
    required this.engine,
    required this.bootstrap,
    required this.transport,
    required this.deviceId,
    required this.serverClock,
  });

  /// Shared server-time estimate (status / bootstrap / sync / recorder).
  final ServerClock serverClock;

  /// White-label gym lock for branch QRs (`Env.gymId`), set by the app.
  String? gymLock;

  /// Offline v2 branch-QR verification (PHASE3-CONTRACT §2).
  BranchQrVerifier get branchQrVerifier => BranchQrVerifier(
      db: db, gymId: scope.gymId, serverClock: serverClock, policy: policy, gymLock: gymLock);

  /// The coach's own signed QR `{qr, expires_at, kid}` (coach bootstrap
  /// `own_qr`), cached so it can be shown offline.
  Future<CachedSignedQr?> ownQr() async {
    final raw = await db.readMeta(SyncMetaKeys.ownQr);
    if (raw == null) return null;
    try {
      final j = jsonDecode(raw);
      if (j is! Map || j['qr'] is! String) return null;
      return CachedSignedQr(
        qr: j['qr'] as String,
        expiresAt: DateTime.tryParse('${j['expires_at']}'),
        kid: j['kid']?.toString(),
      );
    } catch (_) {
      return null;
    }
  }

  /// Offline coach-QR verification (Amendment 2 §C).
  SpecialistQrVerifier get specialistQrVerifier => SpecialistQrVerifier(
      db: db, gymId: scope.gymId, serverClock: serverClock, policy: policy, gymLock: gymLock);

  /// Cached assignments of one member (member snapshot: own packages).
  Future<List<CachedAssignment>> assignmentsOf(String gymMemberId) =>
      (db.select(db.cachedAssignments)..where((t) => t.gymMemberId.equals(gymMemberId))).get();

  /// The signed-in member's own `gym_member_id` (member snapshot).
  Future<String?> ownMemberId() async {
    final raw = await db.readMeta(SyncMetaKeys.member);
    if (raw == null) return null;
    try {
      final j = jsonDecode(raw);
      return j is Map ? j['gym_member_id']?.toString() : null;
    } catch (_) {
      return null;
    }
  }

  /// Cached buckets of one member (pre-check / "as of" summaries).
  Future<List<CachedMembership>> membershipsOf(String gymMemberId) =>
      (db.select(db.cachedMemberships)..where((t) => t.gymMemberId.equals(gymMemberId))).get();

  /// Offline member-pass verification (PHASE2-CONTRACT steps 1–6).
  late final MemberPassVerifier passVerifier = MemberPassVerifier(
      db: db, gymId: scope.gymId, serverClock: serverClock, policy: policy);

  static final Map<String, OfflineStore> _open = {};

  /// Opens the store for [scope]. Throws [OfflineStoreUnavailable] when the
  /// encrypted DB can't be opened safely (nothing is deleted/regenerated).
  ///
  /// [database] injects an already-open DB (tests: in-memory/unencrypted).
  static Future<OfflineStore> open({
    required OfflineScope scope,
    required OfflineApp app,
    required SyncTransport transport,
    required String deviceId,
    required String appVersion,
    Directory? directory,
    KeyStore keyStore = const SecureKeyStore(),
    OfflineDatabase? database,
    TimezoneResolver? timezone,
    DateTime Function()? now,
    MonotonicClock? monotonic,
    double Function()? random,
    bool autoRetry = true,
    /// Kick the engine after each local record (tests turn this off).
    bool autoSyncOnRecord = true,
    Duration antiDoubleTapWindow =
        OfflineEventRecorder.defaultAntiDoubleTapWindow,
  }) async {
    if (_open.containsKey(scope.key)) {
      throw StateError('Offline store for $scope is already open');
    }
    final db = database ??
        await openOfflineDatabase(
          scope: scope,
          directory: directory ?? await defaultOfflineDirectory(),
          keyStore: keyStore,
        );
    try {
      final policy = PolicyHolder(db);
      await policy.load();
      final serverClock = ServerClock(db, now: now, monotonic: monotonic);
      final engine = SyncEngine(
        db: db,
        transport: transport,
        scope: scope,
        deviceId: deviceId,
        app: app,
        appVersion: appVersion,
        policy: policy,
        serverClock: serverClock,
        now: now,
        random: random,
        autoRetry: autoRetry,
      );
      final recorder = OfflineEventRecorder(
        db: db,
        scope: scope,
        app: app,
        deviceId: deviceId,
        policy: policy,
        serverClock: serverClock,
        timezone: timezone,
        now: now,
        antiDoubleTapWindow: antiDoubleTapWindow,
        onRecorded: autoSyncOnRecord
            ? (_) => unawaited(engine.onEventRecorded())
            : null,
      );
      final bootstrap = BootstrapService(
          db: db,
          transport: transport,
          app: app,
          policy: policy,
          asUserId: scope.userId,
          serverClock: serverClock,
          now: now);
      // Crash recovery before anyone can read the outbox.
      await engine.start();
      final store = OfflineStore._(
        scope: scope,
        app: app,
        db: db,
        policy: policy,
        recorder: recorder,
        engine: engine,
        bootstrap: bootstrap,
        transport: transport,
        deviceId: deviceId,
        serverClock: serverClock,
      );
      _open[scope.key] = store;
      return store;
    } catch (e) {
      await db.close();
      if (e is OfflineStoreUnavailable) rethrow;
      throw OfflineStoreUnavailable(OfflineStoreFailure.openFailed, '$e');
    }
  }

  final OfflineScope scope;
  final OfflineApp app;
  final OfflineDatabase db;
  final PolicyHolder policy;
  final OfflineEventRecorder recorder;
  final SyncEngine engine;
  final BootstrapService bootstrap;
  final SyncTransport transport;
  final String deviceId;
  bool _closed = false;

  bool get isClosed => _closed;

  /// Engine state stream (indicator, counters, last sync, data age).
  Stream<SyncState> get syncStates => engine.states;

  /// `GET /offline/status` → stores policy/enabled, pauses nothing by
  /// itself (a revoked device is paused by the sync endpoint's 403).
  Future<OfflineStatusResponse> refreshStatus() async {
    final s = await transport.status(deviceId: deviceId, asUserId: scope.userId);
    await serverClock.record(s.serverTime);
    await policy.applyServerPolicy(s.policy.isEmpty ? null : s.policy,
        enabledOverride: s.enabled);
    await db.writeMeta(SyncMetaKeys.enabled, '${s.enabled}');
    await db.writeMeta(
        SyncMetaKeys.device,
        jsonEncode(
            {'registered': s.deviceRegistered, 'revoked': s.deviceRevoked}));
    if (s.serverTime != null) {
      await db.writeMeta(SyncMetaKeys.serverTime, s.serverTime);
    }
    await engine.refreshState();
    return s;
  }

  /// Best-effort readiness refresh: status, then a bootstrap when offline
  /// attendance is enabled (or [evenIfDisabled] — e.g. the coach app needs
  /// `pass_keys` to verify member passes online, PHASE2-CONTRACT) and the
  /// cache is missing/stale (or [force]). Returns the bootstrap result, or
  /// null when not needed.
  Future<BootstrapResult?> refreshIfStale(
      {bool force = false, bool evenIfDisabled = false}) async {
    final s = await refreshStatus();
    if (s.deviceRevoked || (!s.enabled && !evenIfDisabled)) return null;
    if (!force && !await bootstrap.isStale()) return null;
    final r = await bootstrap.refresh();
    await engine.refreshState();
    return r;
  }

  // ── Outbox queries for UI phases ───────────────────────────────────────

  SimpleSelectStatement<$OutboxEventsTable, OutboxEvent> _outboxQuery(
      Set<OutboxStatus>? statuses) {
    final q = db.select(db.outboxEvents)
      ..where((t) =>
          t.actorUserId.equals(scope.userId) & t.gymId.equals(scope.gymId))
      ..orderBy([
        (t) => OrderingTerm.desc(t.deviceRecordedAtMs),
        (t) => OrderingTerm.desc(t.createdAt),
      ]);
    if (statuses != null) {
      q.where((t) => t.syncStatus.isIn(statuses.map((s) => s.wire)));
    }
    return q;
  }

  /// Newest first. Filter by status for "pending" / "rejected" lists.
  Stream<List<OutboxEvent>> watchOutbox({Set<OutboxStatus>? statuses}) =>
      _outboxQuery(statuses).watch();

  Future<List<OutboxEvent>> outbox({Set<OutboxStatus>? statuses}) =>
      _outboxQuery(statuses).get();

  /// Live state of one recorded event (result screens).
  Stream<OutboxEvent?> watchEvent(String eventId) => (db.select(db.outboxEvents)
        ..where((t) =>
            t.eventId.equals(eventId) & t.actorUserId.equals(scope.userId)))
      .watchSingleOrNull();

  Future<OutboxEvent?> event(String eventId) => (db.select(db.outboxEvents)
        ..where((t) =>
            t.eventId.equals(eventId) & t.actorUserId.equals(scope.userId)))
      .getSingleOrNull();

  /// True when a snapshot has been bootstrapped into this store.
  Future<bool> hasCachedData() async =>
      (await db.readMeta(SyncMetaKeys.asOf)) != null;

  /// Cached coach assignments, optionally filtered by member name or
  /// member number (case-insensitive substring). Ordered by member name.
  Future<List<CachedAssignment>> cachedAssignments({String? query}) {
    final q = db.select(db.cachedAssignments)
      ..orderBy([(t) => OrderingTerm.asc(t.memberName)]);
    final s = query?.trim().toLowerCase() ?? '';
    if (s.isNotEmpty) {
      q.where((t) =>
          t.memberName.lower().contains(s) | t.memberNumber.lower().contains(s));
    }
    return q.get();
  }

  /// Cached members (staff bootstrap) by name / member number.
  Future<List<CachedMember>> searchMembers(String query, {int limit = 50}) {
    final s = query.trim().toLowerCase();
    final q = db.select(db.cachedMembers)
      ..orderBy([(t) => OrderingTerm.asc(t.fullName)])
      ..limit(limit);
    if (s.isNotEmpty) q.where((t) => t.searchText.contains(s));
    return q.get();
  }

  /// Counts for the readiness panel.
  Future<({int members, int assignments, int classSessions, int passKeys})>
      cachedCounts() async {
    Future<int> count(TableInfo t) async => (await db
            .customSelect('SELECT COUNT(*) AS c FROM ${t.actualTableName}')
            .getSingle())
        .read<int>('c');
    return (
      members: await count(db.cachedMembers),
      assignments: await count(db.cachedAssignments),
      classSessions: await count(db.cachedClassSessions),
      passKeys: await count(db.cachedPassKeys),
    );
  }

  /// Logout policy (D9): drop cached operational data, keep the outbox.
  Future<void> wipeCache() async {
    await db.wipeCache();
    await engine.refreshState();
  }

  /// Stops the engine and closes the DB. The outbox stays on disk for the
  /// next session of the SAME scope.
  Future<void> close({bool wipeCache = false}) async {
    if (_closed) return;
    _closed = true;
    try {
      await engine.dispose();
      if (wipeCache) await db.wipeCache();
      await policy.dispose();
    } finally {
      _open.remove(scope.key);
      await db.close();
    }
  }
}

/// A cached server-signed QR text (the coach's own `own_qr`).
class CachedSignedQr {
  const CachedSignedQr({required this.qr, this.expiresAt, this.kid});
  final String qr;
  final DateTime? expiresAt;
  final String? kid;
  bool isExpiredAt(DateTime t) => expiresAt != null && !expiresAt!.isAfter(t);
}
