import 'dart:async';
import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:meta/meta.dart';

import '../db/offline_database.dart';
import '../model/enums.dart';
import '../model/event_wire.dart';
import '../model/offline_policy.dart';
import '../model/policy_holder.dart';
import '../model/sync_models.dart';
import '../scope.dart';
import 'backoff.dart';
import 'sync_state.dart';
import 'transport.dart';

/// Drains one scope's outbox to `POST /api/attendance/sync`.
///
/// Guarantees (CONTRACT §5, SPEC §8):
/// * single-flight — concurrent triggers join the running pass; a trigger
///   that arrives mid-run schedules exactly one follow-up pass;
/// * crash recovery — [start] returns `syncing` rows to `pending`;
/// * order — `device_recorded_at`, then `created_at` (then rowid);
/// * batches ≤ `policy.max_batch` (≤ 50);
/// * result mapping — accepted/duplicate → synced (ids + flags kept),
///   rejected → rejected (kept), error / missing / unknown → pending with
///   backoff;
/// * transport failures (timeout, network, 5xx, 422, 429) → the whole
///   batch back to `pending` with exponential backoff + jitter; never
///   deleted, never marked rejected;
/// * 401 → paused `authRequired`, 403 → paused `deviceRevoked`/`forbidden`;
///   in both cases the batch returns to `pending` with NO other change;
/// * D9 — only events whose actor is this scope's user are selected, and
///   nothing is sent unless the transport's signed-in user is that user.
class SyncEngine {
  SyncEngine({
    required this.db,
    required this.transport,
    required this.scope,
    required this.deviceId,
    required this.app,
    required this.appVersion,
    required this.policy,
    DateTime Function()? now,
    double Function()? random,
    this.autoRetry = true,
    this.maxBatchesPerRun = 200,
  })  : _now = now ?? DateTime.now,
        _random = random;

  final OfflineDatabase db;
  final SyncTransport transport;
  final OfflineScope scope;
  final String deviceId;
  final OfflineApp app;
  final String appVersion;
  final PolicyHolder policy;
  /// Schedule a timer for the earliest backed-off event.
  final bool autoRetry;
  final int maxBatchesPerRun;

  final DateTime Function() _now;
  final double Function()? _random;

  final _states = StreamController<SyncState>.broadcast();
  SyncState _state = const SyncState();
  Future<SyncRunResult>? _inflight;
  bool _rerun = false;
  bool _rerunForce = false;
  bool _started = false;
  bool _disposed = false;
  Timer? _retryTimer;

  /// Latest state (also replayed by [states] listeners via [state]).
  SyncState get state => _state;

  /// Broadcast stream of state changes (UI indicator + counters).
  Stream<SyncState> get states => _states.stream;

  bool get isRunning => _inflight != null;

  Backoff get _backoff => Backoff(
      base: policy.value.retryBase, max: policy.value.retryMax, random: _random);

  // ── Lifecycle / triggers ───────────────────────────────────────────────

  /// Crash recovery + initial state. Idempotent. Does not sync.
  Future<void> start() async {
    if (_started) return;
    _started = true;
    await db.recoverInterruptedSync();
    await refreshState();
  }

  /// App launched with a session for this scope.
  Future<SyncRunResult> onAppStart() async {
    await start();
    return _trigger(SyncTrigger.appStart, force: false);
  }

  /// App came to the foreground. Respects backoff.
  Future<SyncRunResult> onAppResumed() => _trigger(SyncTrigger.resume, force: false);

  /// Connectivity hint. Regaining a network ignores backoff (each event is
  /// still sent at most once per pass).
  Future<SyncRunResult> onConnectivityChanged(bool hasNetwork) async {
    final was = _state.online;
    _emit(_state.copyWith(online: hasNetwork));
    if (!hasNetwork) {
      _retryTimer?.cancel();
      return const SyncRunResult(skipped: true);
    }
    if (!was) return _trigger(SyncTrigger.connectivity, force: true);
    return const SyncRunResult(skipped: true);
  }

  /// A new event was recorded locally.
  Future<SyncRunResult> onEventRecorded() =>
      _trigger(SyncTrigger.recorded, force: false);

  /// User-initiated "sync now" (and attendance screen opened). Ignores
  /// backoff.
  Future<SyncRunResult> syncNow({bool force = true}) =>
      _trigger(SyncTrigger.manual, force: force);

  /// Clears an auth/device pause (after the SAME user re-authenticated or
  /// the device was re-approved) and syncs.
  Future<SyncRunResult> resumeAfterAuth() {
    _emit(_state.copyWith(pause: null));
    return _trigger(SyncTrigger.authRestored, force: true);
  }

  Future<void> dispose() async {
    if (_disposed) return;
    _disposed = true;
    _retryTimer?.cancel();
    final f = _inflight;
    if (f != null) {
      try {
        await f;
      } catch (_) {}
    }
    await _states.close();
  }

  // ── State ──────────────────────────────────────────────────────────────

  /// Recomputes counters / data age from the DB and emits.
  Future<SyncState> refreshState() async {
    if (_disposed) return _state;
    final counts = <String, int>{};
    final rows = await db.customSelect(
      'SELECT sync_status AS s, COUNT(*) AS c FROM outbox_events '
      'WHERE actor_user_id = ? AND gym_id = ? GROUP BY sync_status',
      variables: [Variable(scope.userId), Variable(scope.gymId)],
      readsFrom: {db.outboxEvents},
    ).get();
    for (final r in rows) {
      counts[r.read<String>('s')] = r.read<int>('c');
    }
    final lastOk = _parse(await db.readMeta(SyncMetaKeys.lastSuccessfulSyncAt));
    final asOf = _parse(await db.readMeta(SyncMetaKeys.asOf));
    final now = _now();
    final age = asOf == null ? null : now.toUtc().difference(asOf.toUtc());
    final expired = asOf == null || age! > policy.value.maxDataAge;
    _emit(_state.copyWith(
      pendingCount: (counts['pending'] ?? 0) + (counts['syncing'] ?? 0),
      syncingCount: counts['syncing'] ?? 0,
      syncedCount: counts['synced'] ?? 0,
      rejectedCount: counts['rejected'] ?? 0,
      lastSuccessfulSyncAt: lastOk,
      dataAsOf: asOf,
      dataAge: age,
      dataExpired: expired,
    ));
    return _state;
  }

  void _emit(SyncState s) {
    _state = s;
    if (!_states.isClosed) _states.add(s);
  }

  // ── Core ───────────────────────────────────────────────────────────────

  /// Triggers that only fire when connectivity says we're online. Manual,
  /// connectivity-regained and auth-restored always attempt (connectivity
  /// is only a hint).
  static const _onlineOnly = {
    SyncTrigger.appStart,
    SyncTrigger.resume,
    SyncTrigger.recorded,
    SyncTrigger.retryTimer,
  };

  Future<SyncRunResult> _trigger(SyncTrigger trigger, {required bool force}) {
    if (_disposed) return Future.value(const SyncRunResult(skipped: true));
    if (!_state.online && _onlineOnly.contains(trigger)) {
      return Future.value(const SyncRunResult(skipped: true));
    }
    final running = _inflight;
    if (running != null) {
      // Single-flight: join the running pass, and make sure anything
      // recorded meanwhile gets one more pass afterwards.
      _rerun = true;
      _rerunForce = _rerunForce || force;
      return running;
    }
    final f = _runLoop(force).whenComplete(() => _inflight = null);
    _inflight = f;
    return f;
  }

  Future<SyncRunResult> _runLoop(bool force) async {
    if (!_started) await start();
    var total = await _runPass(force);
    while (_rerun && !_disposed && total.pause == null) {
      final f = _rerunForce;
      _rerun = false;
      _rerunForce = false;
      total = total + await _runPass(f);
    }
    _rerun = false;
    _rerunForce = false;
    return total;
  }

  Future<SyncRunResult> _runPass(bool force) async {
    if (_disposed) return const SyncRunResult(skipped: true);
    if (_state.pause != null) {
      return SyncRunResult(skipped: true, pause: _state.pause);
    }
    if (transport.authenticatedUserId != scope.userId) {
      _emit(_state.copyWith(authMismatch: true));
      return const SyncRunResult(skipped: true);
    }
    if (_state.authMismatch) _emit(_state.copyWith(authMismatch: false));

    _retryTimer?.cancel();
    _emit(_state.copyWith(syncing: true));
    var result = const SyncRunResult();
    final attempted = <String>{};
    try {
      for (var i = 0; i < maxBatchesPerRun && !_disposed; i++) {
        final batch = await _selectBatch(force: force, exclude: attempted);
        if (batch.isEmpty) break;
        attempted.addAll(batch.map((e) => e.eventId));
        final r = await _sendBatch(batch);
        result = result + r;
        await refreshState();
        if (r.pause != null || r.error != null) break;
      }
    } finally {
      _emit(_state.copyWith(
        syncing: false,
        lastRunFailed: result.error != null,
        lastError: result.error?.toString(),
      ));
      if (!_disposed) {
        await refreshState();
        await _scheduleRetry();
      }
    }
    return result;
  }

  Future<List<OutboxEvent>> _selectBatch({
    required bool force,
    required Set<String> exclude,
  }) async {
    final limit = policy.value.maxBatch.clamp(1, OfflinePolicy.serverMaxBatch);
    final nowMs = _now().millisecondsSinceEpoch;
    final q = db.select(db.outboxEvents)
      ..where((t) =>
          t.syncStatus.equals(OutboxStatus.pending.wire) &
          t.actorUserId.equals(scope.userId) &
          t.gymId.equals(scope.gymId))
      ..orderBy([
        (t) => OrderingTerm.asc(t.deviceRecordedAtMs),
        (t) => OrderingTerm.asc(t.createdAt),
        (t) => OrderingTerm.asc(const CustomExpression<int>('rowid')),
      ]);
    if (!force) {
      q.where((t) =>
          t.nextAttemptAt.isNull() | t.nextAttemptAt.isSmallerOrEqualValue(nowMs));
    }
    if (exclude.isNotEmpty) {
      q.where((t) => t.eventId.isNotIn(exclude));
    }
    q.limit(limit);
    return q.get();
  }

  Future<SyncRunResult> _sendBatch(List<OutboxEvent> batch) async {
    final ids = batch.map((e) => e.eventId).toList();
    final nowMs = _now().millisecondsSinceEpoch;
    await (db.update(db.outboxEvents)..where((t) => t.eventId.isIn(ids))).write(
        OutboxEventsCompanion(
            syncStatus: Value(OutboxStatus.syncing.wire),
            lastAttemptAt: Value(nowMs)));
    await refreshState();

    final request = SyncRequest(
      deviceId: deviceId,
      app: app.wire,
      appVersion: appVersion,
      events: batch.map((e) => e.toWireJson()).toList(),
    );

    final SyncResponse response;
    try {
      response = await transport.sync(request);
    } on SyncAuthRequired {
      await _revertUntouched(ids);
      _emit(_state.copyWith(pause: SyncPauseReason.authRequired));
      return const SyncRunResult(pause: SyncPauseReason.authRequired);
    } on SyncForbidden catch (e) {
      await _revertUntouched(ids);
      final reason = e.deviceRevoked
          ? SyncPauseReason.deviceRevoked
          : SyncPauseReason.forbidden;
      _emit(_state.copyWith(pause: reason, lastError: e.message));
      return SyncRunResult(pause: reason);
    } on SyncRateLimited catch (e) {
      await _backOffAll(batch, e, minDelay: e.retryAfter);
      return SyncRunResult(retrying: batch.length, error: e);
    } catch (e) {
      // Timeout / network / 5xx / 4xx envelope / unexpected: keep pending.
      await _backOffAll(batch, e);
      return SyncRunResult(retrying: batch.length, error: e);
    }

    await db.writeMeta(SyncMetaKeys.lastSuccessfulSyncAt,
        _now().toUtc().toIso8601String());
    final st = DateTime.tryParse(response.serverTime ?? '');
    if (st != null) {
      await db.writeMeta(SyncMetaKeys.serverTime, response.serverTime);
      await db.writeMeta(SyncMetaKeys.clockOffsetMs,
          '${st.toUtc().difference(_now().toUtc()).inMilliseconds}');
    }
    return _applyResults(batch, response);
  }

  Future<SyncRunResult> _applyResults(
      List<OutboxEvent> batch, SyncResponse response) async {
    final byId = <String, SyncEventResult>{
      for (final r in response.results) r.eventId: r,
    };
    var synced = 0, rejected = 0, retrying = 0;
    await db.transaction(() async {
      for (final e in batch) {
        final r = byId[e.eventId];
        final attempts = e.syncAttempts + 1;
        final where = db.update(db.outboxEvents)
          ..where((t) => t.eventId.equals(e.eventId));
        if (r == null) {
          retrying++;
          await where.write(_retryCompanion(attempts, 'no result for event'));
          continue;
        }
        final common = OutboxEventsCompanion(
          syncAttempts: Value(attempts),
          resultStatus: Value(r.rawStatus),
          resultCode: Value(r.code),
          resultMessage: Value(r.message),
          serverReceivedAt: Value(r.serverReceivedAt),
          processedAt: Value(r.processedAt),
        );
        switch (r.status) {
          case ResultStatus.accepted:
          case ResultStatus.duplicate:
            synced++;
            await where.write(common.copyWith(
              syncStatus: Value(OutboxStatus.synced.wire),
              officialId: Value(r.officialId),
              flags: Value(jsonEncode(r.flags)),
              nextAttemptAt: const Value(null),
              lastSyncError: const Value(null),
            ));
          case ResultStatus.rejected:
            rejected++;
            await where.write(common.copyWith(
              syncStatus: Value(OutboxStatus.rejected.wire),
              flags: Value(jsonEncode(r.flags)),
              nextAttemptAt: const Value(null),
              lastSyncError: Value(r.code ?? r.message),
            ));
          case ResultStatus.error:
          case ResultStatus.unknown:
            retrying++;
            final retry = _retryCompanion(
                attempts, r.code ?? r.message ?? 'server error');
            await where.write(retry.copyWith(
              resultStatus: Value(r.rawStatus),
              resultCode: Value(r.code),
              resultMessage: Value(r.message),
              serverReceivedAt: Value(r.serverReceivedAt),
            ));
        }
      }
    });
    return SyncRunResult(
        sent: batch.length, synced: synced, rejected: rejected, retrying: retrying);
  }

  OutboxEventsCompanion _retryCompanion(int attempts, String error,
      {Duration? minDelay}) {
    var d = _backoff.delay(attempts);
    if (minDelay != null && minDelay > d) d = minDelay;
    return OutboxEventsCompanion(
      syncStatus: Value(OutboxStatus.pending.wire),
      syncAttempts: Value(attempts),
      nextAttemptAt: Value(_now().add(d).millisecondsSinceEpoch),
      lastSyncError: Value(error),
    );
  }

  Future<void> _backOffAll(List<OutboxEvent> batch, Object error,
      {Duration? minDelay}) async {
    await db.transaction(() async {
      for (final e in batch) {
        await (db.update(db.outboxEvents)
              ..where((t) => t.eventId.equals(e.eventId)))
            .write(_retryCompanion(e.syncAttempts + 1, error.toString(),
                minDelay: minDelay));
      }
    });
  }

  /// 401/403: back to pending, nothing else changes (attempts, backoff and
  /// result fields untouched).
  Future<void> _revertUntouched(List<String> ids) =>
      (db.update(db.outboxEvents)
            ..where((t) =>
                t.eventId.isIn(ids) & t.syncStatus.equals(OutboxStatus.syncing.wire)))
          .write(OutboxEventsCompanion(syncStatus: Value(OutboxStatus.pending.wire)));

  Future<void> _scheduleRetry() async {
    _retryTimer?.cancel();
    if (!autoRetry || _disposed || _state.pause != null || !_state.online) {
      _emit(_state.copyWith(nextRetryAt: null));
      return;
    }
    final row = await db.customSelect(
      'SELECT MIN(next_attempt_at) AS n FROM outbox_events '
      'WHERE sync_status = ? AND actor_user_id = ? AND gym_id = ? '
      'AND next_attempt_at IS NOT NULL',
      variables: [
        Variable(OutboxStatus.pending.wire),
        Variable(scope.userId),
        Variable(scope.gymId),
      ],
    ).getSingle();
    final n = row.read<int?>('n');
    if (n == null) {
      _emit(_state.copyWith(nextRetryAt: null));
      return;
    }
    final at = DateTime.fromMillisecondsSinceEpoch(n);
    var wait = at.difference(_now());
    if (wait.isNegative) wait = Duration.zero;
    _emit(_state.copyWith(nextRetryAt: at));
    _retryTimer = Timer(wait, () {
      _trigger(SyncTrigger.retryTimer, force: false);
    });
  }

  @visibleForTesting
  Timer? get retryTimer => _retryTimer;

  static DateTime? _parse(String? s) => s == null ? null : DateTime.tryParse(s);
}
