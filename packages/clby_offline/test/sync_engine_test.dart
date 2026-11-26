import 'dart:async';

import 'package:clby_offline/clby_offline.dart';
import 'package:drift/drift.dart' hide isNull, isNotNull;
import 'package:flutter_test/flutter_test.dart';

import 'helpers.dart';

void main() {
  late FakeTransport t;
  late TestClock clock;
  late OfflineStore store;

  setUp(() async {
    t = FakeTransport();
    clock = TestClock();
    store = await memoryStore(transport: t, clock: clock);
  });

  tearDown(() async => store.close());

  Future<OutboxEvent> ev(String id) async => (await store.event(id))!;

  group('ordering + batching', () {
    test('orders by device_recorded_at then created_at', () async {
      clock.now = DateTime(2026, 11, 26, 9);
      final late9 = await recordManual(store); // 09:00
      clock.now = DateTime(2026, 11, 26, 7);
      final a = await recordManual(store); // 07:00
      final b = await recordManual(store); // 07:00, created later
      clock.now = DateTime(2026, 11, 26, 8);
      final c = await recordManual(store); // 08:00
      await store.engine.syncNow();
      expect(t.requests.single.eventIds, [a, b, c, late9]);
    });

    test('batches respect policy.max_batch', () async {
      await store.policy.applyServerPolicy({...enabledPolicy, 'max_batch': 3});
      for (var i = 0; i < 7; i++) {
        clock.advance(const Duration(minutes: 1));
        await recordManual(store);
      }
      await store.engine.syncNow();
      await store.engine.syncNow();
      final sizes = t.requests.map((r) => r.events.length).toList();
      expect(sizes.every((s) => s <= 3), isTrue);
      expect(sizes.sublist(sizes.length - 3), [3, 3, 1]);
      expect((await store.outbox(statuses: {OutboxStatus.synced})).length, 7);
    });

    test('max_batch from server is clamped to 50', () async {
      await store.policy.applyServerPolicy({...enabledPolicy, 'max_batch': 500});
      expect(store.policy.value.maxBatch, 50);
    });

    test('envelope carries device/app/version and wire events', () async {
      final id = await recordManual(store, branch: uid());
      await store.engine.syncNow();
      final r = t.requests.last;
      final j = r.toJson();
      expect(j['device_id'], 'dev-1');
      expect(j['app'], 'admin');
      expect(j['app_version'], '1.0.0');
      final e = r.events.single;
      expect(e['event_id'], id);
      expect(e['kind'], 'attendance');
      expect(e['attendance_method'], 'manual');
      expect(e['gym_id'], gymA);
      expect(e['device_timezone'], 'Africa/Cairo');
      expect(e['device_recorded_at'] as String,
          matches(RegExp(r'^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}[+-]\d\d:\d\d$')));
      expect(e.keys, containsAll(['qr', 'note', 'metadata', 'service_assignment_id',
          'class_session_id', 'studio_id', 'branch_id', 'member_id']));
    });
  });

  group('result mapping', () {
    Future<OutboxEvent> runWith(Map<String, Object?> Function(String id) res) async {
      final id = await recordManual(store);
      t.enqueue((r) => SyncResponse.fromJson({'server_time': '2026-11-26T06:10:00Z', 'results': [res(id)]}));
      await store.engine.syncNow();
      return ev(id);
    }

    test('accepted/created → synced with attendance id + flags', () async {
      final e = await runWith((id) => result(id, 'accepted',
          code: 'created', attendanceId: 'A1', flags: ['sessions_exhausted']));
      expect(e.syncStatus, 'synced');
      expect(e.officialId, 'A1');
      expect(e.flagList, ['sessions_exhausted']);
      expect(e.resultCode, 'created');
      expect(e.serverReceivedAt, '2026-11-26T06:10:00Z');
      expect(e.nextAttemptAt, isNull);
    });

    test('duplicate/event_replayed → synced with original id', () async {
      final e = await runWith((id) =>
          result(id, 'duplicate', code: 'event_replayed', attendanceId: 'ORIG'));
      expect(e.syncStatus, 'synced');
      expect(e.officialId, 'ORIG');
      expect(e.resultStatus, 'duplicate');
    });

    test('duplicate/already_checked_in → synced with existing id', () async {
      final e = await runWith((id) =>
          result(id, 'duplicate', code: 'already_checked_in', attendanceId: 'EXIST'));
      expect(e.syncStatus, 'synced');
      expect(e.officialId, 'EXIST');
      expect(e.resultCode, 'already_checked_in');
    });

    test('service_session accepted stores service_log_id', () async {
      final e = await runWith((id) =>
          result(id, 'accepted', code: 'created', serviceLogId: 'LOG1'));
      expect(e.officialId, 'LOG1');
    });

    for (final code in ['tenant_mismatch', 'permission_denied', 'event_too_old',
        'guard_window', 'event_id_conflict', 'invalid_payload']) {
      test('rejected/$code → rejected, kept, not retried', () async {
        final e = await runWith((id) => result(id, 'rejected', code: code));
        expect(e.syncStatus, 'rejected');
        expect(e.resultCode, code);
        expect(e.nextAttemptAt, isNull);
        final before = t.requests.length;
        await store.engine.syncNow();
        expect(t.requests.length, before, reason: 'rejected events are never resent');
        expect(await store.event(e.eventId), isNotNull);
      });
    }

    test('error/server_error → pending with backoff', () async {
      final e = await runWith((id) =>
          result(id, 'error', code: 'server_error', retryable: true));
      expect(e.syncStatus, 'pending');
      expect(e.resultCode, 'server_error');
      expect(e.nextAttemptAt, isNotNull);
      expect(e.syncAttempts, 1);
    });

    test('unknown status → pending', () async {
      final e = await runWith((id) => result(id, 'weird'));
      expect(e.syncStatus, 'pending');
    });

    test('event missing from response → pending', () async {
      final e = await runWith((id) => result('someone-else', 'accepted'));
      expect(e.syncStatus, 'pending');
      expect(e.lastSyncError, 'no result for event');
    });

    test('mixed batch maps each event independently', () async {
      final a = await recordManual(store);
      final b = await recordManual(store);
      final c = await recordManual(store);
      t.enqueue((r) => SyncResponse.fromJson({'results': [
            result(a, 'accepted', attendanceId: 'x'),
            result(b, 'rejected', code: 'member_not_found'),
            result(c, 'error', code: 'server_error', retryable: true),
          ]}));
      final res = await store.engine.syncNow();
      expect((await ev(a)).syncStatus, 'synced');
      expect((await ev(b)).syncStatus, 'rejected');
      expect((await ev(c)).syncStatus, 'pending');
      expect(res.synced, greaterThanOrEqualTo(1));
      expect(store.engine.state.rejectedCount, 1);
      expect(store.engine.state.pendingCount, 1);
    });
  });

  group('transport failures never lose or reject events', () {
    for (final err in <Object>[
      const SyncTimeout(),
      const SyncNetworkError('no route'),
      const SyncServerError(502, 'bad gateway'),
      const SyncRequestError(422, 'bad envelope'),
      StateError('unexpected bug'),
    ]) {
      test('${err.runtimeType} → pending + backoff', () async {
        t.enqueue((r) => throw err);
        final id = await recordManual(store);
          await store.engine.syncNow(force: false);
        final e = await ev(id);
        expect(e.syncStatus, 'pending');
        expect(e.syncAttempts, 1);
        expect(e.nextAttemptAt, isNotNull);
        expect(e.resultStatus, isNull);
        expect(store.engine.state.lastRunFailed, isTrue);
        expect(store.engine.state.indicator, SyncIndicator.failed);
      });
    }

    test('timeout after server processed → replay returns event_replayed → synced once', () async {
      // Server "processes" the first request but the client times out.
      final serverLog = <String, String>{};
      t.enqueue((r) {
        for (final id in r.eventIds) {
          serverLog[id] = 'ATT-${serverLog.length}';
        }
        throw const SyncTimeout();
      });
      final id = await recordManual(store);
      await store.engine.syncNow(force: false);
      expect((await ev(id)).syncStatus, 'pending');
      t.enqueue((r) => SyncResponse.fromJson({'results': [
            for (final i in r.eventIds)
              result(i, 'duplicate', code: 'event_replayed', attendanceId: serverLog[i]),
          ]}));
      await store.engine.syncNow();
      final e = await ev(id);
      expect(e.syncStatus, 'synced');
      expect(e.officialId, 'ATT-0');
      expect(serverLog.length, 1, reason: 'one official record');
      expect((await store.outbox()).length, 1);
      // Same event_id both times.
      expect(t.requests.map((r) => r.eventIds.single).toSet(), {id});
    });

    test('429 honours Retry-After when larger than backoff', () async {
      t.enqueue((r) => throw const SyncRateLimited(retryAfter: Duration(minutes: 10)));
      final id = await recordManual(store);
      await store.engine.syncNow(force: false);
      final e = await ev(id);
      expect(e.syncStatus, 'pending');
      expect(e.nextAttemptAt! - clock.now.millisecondsSinceEpoch,
          greaterThanOrEqualTo(const Duration(minutes: 10).inMilliseconds));
    });

    test('backed-off events are skipped by non-forced triggers until due', () async {
      t.enqueue((r) => throw const SyncTimeout());
      await recordManual(store);
      await store.engine.syncNow(force: false);
      final n = t.requests.length;
      await store.engine.onAppResumed();
      expect(t.requests.length, n);
      clock.advance(const Duration(seconds: 6)); // > max(5s) for attempt 1
      await store.engine.onAppResumed();
      expect(t.requests.length, n + 1);
    });
  });

  group('auth pauses', () {
    test('401 → paused auth_required, events untouched', () async {
      t.enqueue((r) => throw const SyncAuthRequired());
      final id = await recordManual(store);
      await store.engine.syncNow(force: false);
      final e = await ev(id);
      expect(e.syncStatus, 'pending');
      expect(e.syncAttempts, 0);
      expect(e.nextAttemptAt, isNull);
      expect(e.lastSyncError, isNull);
      expect(store.engine.state.pause, SyncPauseReason.authRequired);
      expect(store.engine.state.indicator, SyncIndicator.authRequired);
      final n = t.requests.length;
      await store.engine.syncNow();
      await store.engine.onConnectivityChanged(true);
      expect(t.requests.length, n, reason: 'paused engine sends nothing');
      await store.engine.resumeAfterAuth();
      expect((await ev(id)).syncStatus, 'synced');
    });

    test('403 device_revoked → paused device_revoked, events untouched', () async {
      t.enqueue((r) => throw const SyncForbidden('revoked',
          code: 'device_revoked', deviceRevoked: true));
      final id = await recordManual(store);
      await store.engine.syncNow(force: false);
      final e = await ev(id);
      expect(e.syncStatus, 'pending');
      expect(e.syncAttempts, 0);
      expect(store.engine.state.pause, SyncPauseReason.deviceRevoked);
      expect(store.engine.state.indicator, SyncIndicator.deviceRevoked);
    });

    test('other 403 → paused forbidden', () async {
      t.enqueue((r) => throw const SyncForbidden('no'));
      await recordManual(store);
      await store.engine.syncNow(force: false);
      expect(store.engine.state.pause, SyncPauseReason.forbidden);
    });

    test('D9: transport signed in as another user → nothing sent', () async {
      final id = await recordManual(store);
      t.userId = uid();
      final n = t.requests.length;
      final r = await store.engine.syncNow();
      expect(r.skipped, isTrue);
      expect(t.requests.length, n);
      expect(store.engine.state.authMismatch, isTrue);
      expect((await ev(id)).syncStatus, 'pending');
      t.userId = userA;
      await store.engine.syncNow();
      expect((await ev(id)).syncStatus, 'synced');
    });
  });

  group('engine mechanics', () {
    test('crash recovery: syncing → pending on start', () async {
      final id = await recordManual(store);
      await store.engine.syncNow(force: false);
      await (store.db.update(store.db.outboxEvents)..where((x) => x.eventId.equals(id)))
          .write(const OutboxEventsCompanion(syncStatus: Value('syncing')));
      final db = store.db;
      // Simulate a kill: a fresh engine on the same DB.
      final engine2 = SyncEngine(
          db: db, transport: t, scope: store.scope, deviceId: 'd', app: OfflineApp.admin,
          appVersion: '1', policy: store.policy, now: clock.call, autoRetry: false);
      await engine2.start();
      expect((await ev(id)).syncStatus, 'pending');
      await engine2.dispose();
    });

    test('single-flight: concurrent syncNow → one request per batch', () async {
      await recordManual(store);
      await recordManual(store);
      final gate = Completer<void>();
      var inflight = 0, maxInflight = 0;
      t.enqueue((r) async {
        inflight++;
        maxInflight = inflight > maxInflight ? inflight : maxInflight;
        await gate.future;
        inflight--;
        return acceptAll(r);
      });
      final n = t.requests.length;
      final f1 = store.engine.syncNow();
      final f2 = store.engine.syncNow();
      final f3 = store.engine.onAppResumed();
      await Future<void>.delayed(const Duration(milliseconds: 20));
      gate.complete();
      await Future.wait([f1, f2, f3]);
      expect(maxInflight, 1);
      expect(identical(f1, f2), isTrue);
      expect(t.requests.length - n, 1);
      expect(store.engine.state.pendingCount, 0);
    });

    test('event recorded during a sync gets a follow-up pass', () async {
      await store.close();
      store = await memoryStore(transport: t, clock: clock, autoSyncOnRecord: true);
      final gate = Completer<void>();
      t.enqueue((r) async {
        await gate.future;
        return acceptAll(r);
      });
      final first = await recordManual(store); // kicks run, blocked on gate
      await Future<void>.delayed(const Duration(milliseconds: 5));
      expect(store.engine.isRunning, isTrue);
      final second = await recordManual(store); // joins → rerun flag
      gate.complete();
      await store.engine.syncNow(force: false);
      expect((await ev(first)).syncStatus, 'synced');
      expect((await ev(second)).syncStatus, 'synced');
      expect(t.requests.length, 2);
    });

    test('connectivity regained forces a pass ignoring backoff', () async {
      t.enqueue((r) => throw const SyncTimeout());
      final id = await recordManual(store);
      await store.engine.syncNow(force: false);
      await store.engine.onConnectivityChanged(false);
      expect(store.engine.state.indicator, SyncIndicator.offline);
      await store.engine.onConnectivityChanged(true);
      expect((await ev(id)).syncStatus, 'synced');
      expect(store.engine.state.indicator, isNot(SyncIndicator.offline));
    });

    test('state: counts, last sync, data age / expired', () async {
      await recordManual(store);
      await store.engine.syncNow();
      final s = await store.engine.refreshState();
      expect(s.syncedCount, 1);
      expect(s.lastSuccessfulSyncAt, isNotNull);
      expect(s.dataAsOf, isNull);
      expect(s.dataExpired, isTrue);
      expect(s.indicator, SyncIndicator.expired);
      await store.db.writeMeta(SyncMetaKeys.asOf,
          clock.now.subtract(const Duration(hours: 2)).toUtc().toIso8601String());
      final s2 = await store.engine.refreshState();
      expect(s2.dataExpired, isFalse);
      expect(s2.dataAge, const Duration(hours: 2));
      expect(s2.indicator, SyncIndicator.online);
    });

    test('states stream emits syncing then idle', () async {
      final seen = <SyncIndicator>[];
      final sub = store.syncStates.listen((s) => seen.add(s.indicator));
      await recordManual(store);
      await store.engine.syncNow();
      await sub.cancel();
      expect(seen, contains(SyncIndicator.syncing));
    });

    test('retry timer is scheduled for the earliest backed-off event', () async {
      final store2 = await OfflineStore.open(
        scope: OfflineScope(apiBase: apiBase, gymId: gymA, userId: uid()),
        app: OfflineApp.admin,
        transport: FakeTransport(),
        deviceId: 'd', appVersion: '1',
        database: openInMemoryOfflineDatabase(),
        timezone: () async => 'UTC',
        now: clock.call, random: () => 0.0, autoRetry: true,
      );
      final t2 = store2.transport as FakeTransport;
      t2.userId = store2.scope.userId;
      await store2.policy.applyServerPolicy(enabledPolicy);
      t2.enqueue((r) => throw const SyncTimeout());
      await recordManual(store2);
      await store2.engine.syncNow(force: false);
      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(store2.engine.retryTimer?.isActive, isTrue);
      expect(store2.engine.state.nextRetryAt,
          clock.now.add(const Duration(milliseconds: 2500)));
      await store2.close();
    });
  });
}
