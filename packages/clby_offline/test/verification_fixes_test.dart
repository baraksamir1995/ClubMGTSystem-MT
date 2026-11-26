// Regression tests for PHASE1-VERIFICATION.md findings + CONTRACT §6.

import 'package:clby_offline/clby_offline.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

import 'helpers.dart';

void main() {
  group('HIGH-2: Android secure-storage options never touch the apps\' entries', () {
    test('package storage uses exactly the plugin-default AndroidOptions', () {
      // The apps call `FlutterSecureStorage()` (defaults). Any difference
      // here (encryptedSharedPreferences → checkAndMigrateToEncrypted;
      // sharedPreferencesName/prefix → sticky on the plugin's single
      // native instance) would move or hide the apps' auth_token.
      expect(SecureKeyStore.defaultStorage.aOptions.toMap(),
          const FlutterSecureStorage().aOptions.toMap());
      final m = SecureKeyStore.androidOptions.toMap();
      expect(m['encryptedSharedPreferences'], 'false');
      expect(m['resetOnError'], 'false');
      expect(m['sharedPreferencesName'], '');
      expect(m['preferencesKeyPrefix'], '');
    });

    test('iOS items are isolated by accessibility', () {
      expect(SecureKeyStore.defaultStorage.iOptions.toMap()['accessibility'],
          'first_unlock_this_device');
    });
  });

  group('HIGH-1: distinct 403 pause reasons (§6.1)', () {
    for (final (code, reason, indicator) in [
      ('device_revoked', SyncPauseReason.deviceRevoked, SyncIndicator.deviceRevoked),
      ('device_mismatch', SyncPauseReason.deviceMismatch, SyncIndicator.deviceMismatch),
      ('permission_denied', SyncPauseReason.forbidden, SyncIndicator.authRequired),
    ]) {
      test('$code → $reason, events untouched, error kept', () async {
        final t = FakeTransport();
        final store = await memoryStore(transport: t);
        t.enqueue((r) => throw SyncForbidden('nope $code', code: code));
        final id = await recordManual(store);
        final r = await store.engine.syncNow();
        expect(r.pause, reason);
        final s = store.engine.state;
        expect(s.pause, reason);
        expect(s.indicator, indicator);
        expect(s.lastError, contains('nope $code'), reason: 'LOW-5: kept after pause');
        final e = (await store.event(id))!;
        expect(e.syncStatus, 'pending');
        expect(e.syncAttempts, 0);
        await store.close();
      });
    }

    test('401 pause keeps lastError too', () async {
      final t = FakeTransport();
      final store = await memoryStore(transport: t);
      t.enqueue((r) => throw const SyncAuthRequired('Unauthenticated.'));
      await recordManual(store);
      await store.engine.syncNow();
      expect(store.engine.state.lastError, contains('Unauthenticated.'));
      expect(store.engine.state.lastRunFailed, isFalse);
      await store.close();
    });
  });

  group('MEDIUM-2: clock skew vs server time (§6.6)', () {
    late FakeTransport t;
    late TestClock clock;
    late OfflineStore store;
    setUp(() async {
      t = FakeTransport();
      clock = TestClock();
      store = await memoryStore(transport: t, clock: clock);
    });
    tearDown(() => store.close());

    NewOfflineEvent ev() => NewOfflineEvent.attendance(
        method: AttendanceMethod.manual, memberId: uid());

    /// Server answers with its time = device wall − [deviceAhead].
    Future<void> measure(Duration deviceAhead) => store.serverClock
        .record(clock.now.subtract(deviceAhead).toUtc().toIso8601String());

    Future<RecordRefusal?> refusal() async {
      final o = await store.recorder.record(ev());
      return o is RecordRefused ? o.reason : null;
    }

    test('never measured → records (cannot judge)', () async {
      expect(await refusal(), isNull);
    });

    test('device already 1 h fast when measured → refused, nothing written', () async {
      await measure(const Duration(hours: 1));
      final o = await store.recorder.record(ev());
      expect((o as RecordRefused).reason, RecordRefusal.clockSkew);
      expect(o.message, contains('ahead'));
      expect(await store.outbox(), isEmpty);
    });

    test('clock changed AFTER measurement: +1 h and −8 d are refused', () async {
      await measure(Duration.zero); // in sync at measurement
      expect(await refusal(), isNull);
      clock.now = clock.now.add(const Duration(hours: 1)); // user sets clock +1 h
      expect(await refusal(), RecordRefusal.clockSkew);
      clock.now = clock.now.subtract(const Duration(hours: 1, days: 8)); // −8 d
      final o = await store.recorder.record(ev());
      expect((o as RecordRefused).reason, RecordRefusal.clockSkew);
      expect(o.message, contains('behind'));
    });

    test('real time passing (wall + monotonic) is not skew', () async {
      await measure(Duration.zero);
      clock.advance(const Duration(days: 9));
      expect(await refusal(), isNull);
    });

    test('margins: 4 min fast / 6 days slow are fine; 30 s margin applied', () async {
      await measure(const Duration(minutes: 4));
      final a = await store.recorder.record(ev()) as RecordSaved;
      expect(a.event.metadata, contains('"server_clock_offset_ms":-240000'));
      await measure(const Duration(days: -6));
      expect(await refusal(), isNull);
      await measure(const Duration(seconds: 285)); // > 300 s − 30 s margin
      expect(await refusal(), RecordRefusal.clockSkew);
    });

    test('thresholds follow the server policy', () async {
      await store.policy.applyServerPolicy({...enabledPolicy, 'future_skew_seconds': 60});
      await measure(const Duration(minutes: 2));
      expect(await refusal(), RecordRefusal.clockSkew);
    });

    test('after an app restart (no monotonic anchor) the persisted offset is used', () async {
      await measure(const Duration(hours: 1)); // device 1 h fast, persisted
      final restarted = ServerClock(store.db, now: clock.call, monotonic: () => Duration.zero);
      expect(restarted.hasAnchor, isFalse);
      expect(await restarted.deviceAheadMs(), const Duration(hours: 1).inMilliseconds);
      // Documented limitation: a clock change while the app was not running
      // is invisible until the next measurement (status/bootstrap/sync).
      clock.now = clock.now.subtract(const Duration(hours: 1));
      expect(await restarted.deviceAheadMs(), const Duration(hours: 1).inMilliseconds);
      await restarted.record(clock.now.toUtc().toIso8601String());
      expect(await restarted.deviceAheadMs(), 0);
    });

    test('server time is updated from status and sync responses', () async {
      t.statusResponse = OfflineStatusResponse.fromJson({
        'server_time': clock.now.add(const Duration(minutes: 10)).toUtc().toIso8601String(),
        'enabled': true, 'policy': enabledPolicy, 'device': {},
      });
      await store.refreshStatus();
      expect(await readServerClockOffsetMs(store.db), 600000);
      expect(await store.serverClock.deviceAheadMs(), -600000);
      await recordManual(store);
      t.enqueue((r) => SyncResponse.fromJson({
            'server_time': clock.now.subtract(const Duration(seconds: 30)).toUtc().toIso8601String(),
            'results': [for (final id in r.eventIds) result(id, 'accepted')],
          }));
      await store.engine.syncNow();
      expect(await readServerClockOffsetMs(store.db), -30000);
      expect(await store.serverClock.deviceAheadMs(), 30000);
    });
  });

  group('MEDIUM-3: double-tap identity includes qr_raw', () {
    test('valid QR right after a garbage one records; identical QR is a double tap', () async {
      final m = await memoryStore(
          transport: FakeTransport(), app: OfflineApp.member,
          scope: OfflineScope(apiBase: apiBase, gymId: gymA, userId: uid()),
          policy: {...enabledPolicy, 'allow_member_qr_offline': true});
      NewOfflineEvent qr(String raw) => NewOfflineEvent.attendance(
          method: AttendanceMethod.memberQr, memberId: memberA, qrRaw: raw);
      expect(await m.recorder.record(qr('garbage-qr')), isA<RecordSaved>());
      expect(await m.recorder.record(qr('{"type":"gym_access","token":"t"}')),
          isA<RecordSaved>());
      expect(await m.recorder.record(qr('{"type":"gym_access","token":"t"}')),
          isA<RecordDuplicate>());
      await m.close();
    });
  });

  group('MEDIUM-4: account switch mid-pass', () {
    test('user re-checked before every batch; pass aborts, rest untouched', () async {
      final t = FakeTransport();
      final store = await memoryStore(transport: t);
      await store.policy.applyServerPolicy({...enabledPolicy, 'max_batch': 2});
      for (var i = 0; i < 6; i++) {
        await recordManual(store);
      }
      // After the first batch is answered, the app switches account.
      t.beforeSync = () => t.userId = uid();
      final r = await store.engine.syncNow();
      expect(t.requests.length, 1, reason: 'no batch sent with the other token');
      expect(r.aborted, isTrue);
      expect(store.engine.state.authMismatch, isTrue);
      expect(store.engine.state.pause, isNull, reason: 'not a sticky pause');
      final pending = await store.outbox(statuses: {OutboxStatus.pending});
      expect(pending.length, 4);
      expect(pending.every((e) => e.syncAttempts == 0), isTrue);
      expect(t.asUsers.toSet(), {userA});
      await store.close();
    });

    test('JsonSyncTransport refuses to send when the bound user changed', () async {
      final tr = _BindingTransport()..user = 'A';
      await expectLater(
          tr.sync(const SyncRequest(deviceId: 'd', app: 'coach', appVersion: '1', events: []),
              asUserId: 'B'),
          throwsA(isA<SyncUserChanged>()));
      expect(tr.sent, 0);
      await expectLater(tr.status(deviceId: 'd', asUserId: 'B'),
          throwsA(isA<SyncUserChanged>()));
      expect(tr.sent, 0);
      await tr.status(deviceId: 'd', asUserId: 'A');
      expect(tr.sent, 1);
    });

    test('bootstrap requests carry the scope user', () async {
      final t = FakeTransport();
      final store = await memoryStore(transport: t);
      t.bootstrapPages[null] = const SnapshotPage({'as_of': '2026-11-26T06:00:00Z'});
      await store.bootstrap.refresh();
      expect(t.asUsers, [userA]);
      await store.close();
    });
  });

  group('LOW-4: 422 envelope (§6.5)', () {
    test('422 naming events rejects exactly those; the rest are resent', () async {
      final t = FakeTransport();
      final store = await memoryStore(transport: t);
      final a = await recordManual(store);
      final b = await recordManual(store);
      final c = await recordManual(store);
      t.enqueue((r) => throw SyncRequestError(422, 'The given data was invalid.', body: {
            'message': 'invalid',
            'errors': {'events.1.event_id': ['The event id must be a valid UUID.']},
          }));
      final res = await store.engine.syncNow();
      expect(res.rejected, 1);
      final eb = (await store.event(b))!;
      expect(eb.syncStatus, 'rejected');
      expect(eb.resultCode, 'invalid_envelope');
      expect(eb.resultMessage, contains('valid UUID'));
      expect((await store.event(a))!.syncStatus, 'synced');
      expect((await store.event(c))!.syncStatus, 'synced');
      expect(t.requests.length, 2);
      await store.close();
    });

    test('un-attributed 422 backs off, then stops as failed after the cap', () async {
      final t = FakeTransport();
      final clock = TestClock();
      final store = await memoryStore(transport: t, clock: clock);
      final id = await recordManual(store);
      t.defaultHandler = (r) => throw const SyncRequestError(422, 'bad envelope', body: {
            'message': 'bad', 'errors': {'device_id': ['must be uuid']}});
      await store.engine.syncNow();
      expect(store.engine.state.pause, isNull);
      expect((await store.event(id))!.nextAttemptAt, isNotNull, reason: 'backoff applies');
      await store.engine.syncNow();
      await store.engine.syncNow(); // 3rd consecutive → stop
      final s = store.engine.state;
      expect(s.pause, SyncPauseReason.invalidEnvelope);
      expect(s.indicator, SyncIndicator.failed);
      expect(s.lastError, contains('bad envelope'));
      final n = t.requests.length;
      clock.advance(const Duration(hours: 2));
      await store.engine.onAppResumed();
      await store.engine.onConnectivityChanged(true);
      expect(t.requests.length, n, reason: 'no automatic retry loop once stopped');
      expect((await store.event(id))!.syncStatus, 'pending', reason: 'never lost');
      expect((await store.event(id))!.lastSyncError, startsWith('invalid_envelope'));
      // Manual sync gives one more try; success clears it.
      t.defaultHandler = acceptAll;
      await store.engine.syncNow();
      expect((await store.event(id))!.syncStatus, 'synced');
      expect(store.engine.state.pause, isNull);
      await store.close();
    });
  });

  group('LOW-5: resumeAfterAuth on re-login of the same user', () {
    test('activate() for the open scope resumes a paused engine', () async {
      // Covered at manager level in session_manager_test; engine-level here.
      final t = FakeTransport();
      final store = await memoryStore(transport: t);
      t.enqueue((r) => throw const SyncAuthRequired());
      final id = await recordManual(store);
      await store.engine.syncNow();
      expect(store.engine.state.pause, SyncPauseReason.authRequired);
      await store.engine.resumeAfterAuth();
      expect((await store.event(id))!.syncStatus, 'synced');
      expect(store.engine.state.pause, isNull);
      await store.close();
    });
  });

  group('LOW-1: date-only fields (§6.4)', () {
    test('CalendarDate parses strict YYYY-MM-DD, never as an instant', () {
      final d = CalendarDate.tryParse('2027-07-26')!;
      expect(d, const CalendarDate(2027, 7, 26));
      expect(d.toString(), '2027-07-26');
      expect(d.toLocalDateTime(), DateTime(2027, 7, 26));
      expect(CalendarDate.tryParse('2026-02-30'), isNull);
      expect(CalendarDate.tryParse('2027-07-25T21:00:00.000Z'), isNull);
      expect(CalendarDate.tryParse(null), isNull);
      expect(const CalendarDate(2026, 12, 31).isBefore(const CalendarDate(2027, 1, 1)), isTrue);
    });

    test('bootstrap stores bucket dates as calendar days', () async {
      final t = FakeTransport();
      final store = await memoryStore(transport: t);
      t.bootstrapPages[null] = SnapshotPage({
        'as_of': '2026-11-26T06:00:00Z',
        'members': [{
          'gym_member_id': memberA, 'full_name': 'A',
          'buckets': [
            {'membership_id': 'b1', 'start_date': '2026-11-01', 'end_date': '2027-07-26'},
            {'membership_id': 'b2', 'start_date': 'junk', 'end_date': '2026-02-30'},
          ],
        }],
      });
      await store.bootstrap.refresh();
      final rows = {for (final b in await store.db.select(store.db.cachedMemberships).get()) b.membershipId: b};
      expect(rows['b1']!.endDay, const CalendarDate(2027, 7, 26));
      expect(rows['b1']!.startDate, '2026-11-01');
      expect(rows['b2']!.startDay, isNull);
      expect(rows['b2']!.endDate, isNull);
      await store.close();
    });
  });
}

class _BindingTransport extends JsonSyncTransport {
  String? user;
  int sent = 0;
  @override
  String? get authenticatedUserId => user;
  @override
  Future<TransportResponse> send(String method, String path,
      {Map<String, String>? query, String? body}) async {
    sent++;
    return const TransportResponse(200,
        '{"server_time":"2026-11-26T06:00:00Z","enabled":true,"policy":{},"device":{},"results":[]}');
  }
}
