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
  /// attendance is enabled and the cache is missing/stale (or [force]).
  /// Returns the bootstrap result, or null when not needed.
  Future<BootstrapResult?> refreshIfStale({bool force = false}) async {
    final s = await refreshStatus();
    if (!s.enabled || s.deviceRevoked) return null;
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

  Future<OutboxEvent?> event(String eventId) => (db.select(db.outboxEvents)
        ..where((t) =>
            t.eventId.equals(eventId) & t.actorUserId.equals(scope.userId)))
      .getSingleOrNull();

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
