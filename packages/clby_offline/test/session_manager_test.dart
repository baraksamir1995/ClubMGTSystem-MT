import 'dart:io';

import 'package:clby_offline/clby_offline.dart';
import 'package:drift/drift.dart' show driftRuntimeOptions;
import 'package:flutter_test/flutter_test.dart';

import 'helpers.dart';

void main() {
  late Directory dir;
  late InMemoryKeyStore ks;
  late FakeTransport t;
  late ManualConnectivityMonitor conn;
  late OfflineSessionManager mgr;
  final errors = <Object>[];

  setUp(() async {
    driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;
    dir = Directory.systemTemp.createTempSync('clby_offline_mgr');
    ks = InMemoryKeyStore();
    t = FakeTransport();
    conn = ManualConnectivityMonitor(false);
    errors.clear();
    await ClientInfo.init(
        app: OfflineApp.coach,
        deviceIdentity: DeviceIdentity(keyStore: ks, mirrorDirectory: dir));
    mgr = OfflineSessionManager(
      app: OfflineApp.coach,
      apiBase: apiBase,
      transport: t,
      connectivity: conn,
      keyStore: ks,
      directory: dir,
      onError: (e, _) => errors.add(e),
      refreshOnActivate: false,
    );
  });
  tearDown(() async {
    await mgr.dispose();
    dir.deleteSync(recursive: true);
  });

  test('ClientInfo headers carry app + device id', () {
    final h = ClientInfo.headers;
    expect(h['X-App'], 'coach');
    expect(h['X-Device-Id'], isNotNull);
    expect(h.keys, containsAll(['X-App-Version', 'X-App-Build', 'X-App-Platform']));
  });

  test('login → record → logout keeps outbox, wipes cache; same user gets it back', () async {
    t.userId = userA;
    final s = (await mgr.activate(userId: userA, gymId: gymA))!;
    expect(identical(await mgr.activate(userId: userA, gymId: gymA), s), isTrue,
        reason: 'idempotent for the same scope');
    await s.policy.applyServerPolicy(enabledPolicy);
    final o = await s.recorder.record(NewOfflineEvent.serviceSession(
        memberId: memberA, serviceAssignmentId: uid()));
    final id = (o as RecordSaved).event.eventId;
    await s.db.into(s.db.cachedAssignments).insert(
        CachedAssignmentsCompanion.insert(assignmentId: 'a', gymMemberId: memberA));

    await mgr.deactivate();
    expect(mgr.store, isNull);
    expect(s.isClosed, isTrue);

    // Another coach on the same device sees nothing.
    final other = uid();
    t.userId = other;
    final s2 = (await mgr.activate(userId: other, gymId: gymA))!;
    expect(await s2.outbox(), isEmpty);
    await mgr.deactivate();

    t.userId = userA;
    final s3 = (await mgr.activate(userId: userA, gymId: gymA))!;
    expect(await s3.db.select(s3.db.cachedAssignments).get(), isEmpty);
    final e = await s3.event(id);
    expect(e, isNotNull, reason: 'pending event survived logout');
    expect(errors, isEmpty);
  });

  test('connectivity regained triggers a sync', () async {
    t.userId = userA;
    final s = (await mgr.activate(userId: userA, gymId: gymA))!;
    await s.policy.applyServerPolicy(enabledPolicy);
    await s.recorder.record(NewOfflineEvent.serviceSession(
        memberId: memberA, serviceAssignmentId: uid()));
    await Future<void>.delayed(const Duration(milliseconds: 50));
    expect(s.engine.state.online, isFalse);
    expect(t.requests, isEmpty, reason: 'auto triggers wait for connectivity');
    expect(s.engine.state.indicator, SyncIndicator.offline);
    conn.set(true);
    await Future<void>.delayed(const Duration(milliseconds: 100));
    expect(t.requests, isNotEmpty);
    expect(s.engine.state.pendingCount, 0);
  });

  test('re-activating the same user resumes a paused engine (LOW-5)', () async {
    t.userId = userA;
    conn.set(true);
    final s = (await mgr.activate(userId: userA, gymId: gymA))!;
    await s.policy.applyServerPolicy(enabledPolicy);
    await Future<void>.delayed(const Duration(milliseconds: 50));
    t.enqueue((r) => throw const SyncAuthRequired());
    await s.recorder.record(NewOfflineEvent.serviceSession(
        memberId: memberA, serviceAssignmentId: uid()));
    await s.engine.syncNow();
    expect(s.engine.state.pause, SyncPauseReason.authRequired);
    expect(identical(await mgr.activate(userId: userA, gymId: gymA), s), isTrue);
    await Future<void>.delayed(const Duration(milliseconds: 100));
    expect(s.engine.state.pause, isNull);
    expect(s.engine.state.pendingCount, 0);
  });

  test('unavailable key store → activate returns null, app keeps running', () async {
    ks.failReads = 1000;
    final s = await mgr.activate(userId: userA, gymId: gymA);
    expect(s, isNull);
    expect(errors.single, isA<OfflineStoreUnavailable>());
  });
}
