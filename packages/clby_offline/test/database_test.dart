import 'dart:io';

import 'package:clby_offline/clby_offline.dart';
import 'package:drift/drift.dart' hide isNull, isNotNull;
import 'package:flutter_test/flutter_test.dart';
import 'package:sqlite3/sqlite3.dart' as raw;

import 'helpers.dart';

void main() {
  late Directory dir;
  setUp(() {
    driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;
    dir = Directory.systemTemp.createTempSync('clby_offline_test');
  });
  tearDown(() => dir.deleteSync(recursive: true));

  OfflineScope scopeFor(String gym, String user) =>
      OfflineScope(apiBase: apiBase, gymId: gym, userId: user);

  Future<OfflineStore> openEncrypted(OfflineScope s, KeyStore ks, FakeTransport t,
          {TestClock? clock}) async {
    final store = await OfflineStore.open(
      scope: s,
      app: OfflineApp.admin,
      transport: t..userId = s.userId,
      deviceId: 'dev-1',
      appVersion: '1.0.0',
      directory: dir,
      keyStore: ks,
      timezone: () async => 'Africa/Cairo',
      now: (clock ?? TestClock()).call,
      autoRetry: false,
      autoSyncOnRecord: false,
    );
    await store.policy.applyServerPolicy(enabledPolicy);
    return store;
  }

  group('encrypted open path (real sqlite3mc under flutter test)', () {
    test('native library is SQLite3MultipleCiphers', () {
      final db = raw.sqlite3.openInMemory();
      addTearDown(db.close);
      expect(db.select('SELECT sqlite3mc_version() AS v').first['v'],
          contains('Multiple Ciphers'));
    });

    test('pending events persist across close/reopen; file is encrypted', () async {
      final ks = InMemoryKeyStore();
      final s = scopeFor(gymA, userA);
      var store = await openEncrypted(s, ks, FakeTransport());
      final id = await recordManual(store);
      await store.close();

      final file = File('${dir.path}/${s.databaseFileName}');
      expect(file.existsSync(), isTrue);
      final header = String.fromCharCodes(file.readAsBytesSync().take(15));
      expect(header, isNot('SQLite format 3'), reason: 'plaintext header = not encrypted');
      expect(ks.values[s.keyStoreEntry], matches(RegExp(r'^[0-9a-f]{64}$')));

      // A plain (keyless) sqlite open cannot read it.
      final plain = raw.sqlite3.open(file.path);
      expect(() => plain.select('SELECT count(*) FROM sqlite_master'),
          throwsA(isA<raw.SqliteException>()));
      plain.close();

      store = await openEncrypted(s, ks, FakeTransport());
      final e = await store.event(id);
      expect(e, isNotNull);
      expect(e!.syncStatus, 'pending');
      expect(e.deviceTimezone, 'Africa/Cairo');
      await store.close();
    });

    test('syncing rows from a killed process come back pending on reopen', () async {
      final ks = InMemoryKeyStore();
      final s = scopeFor(gymA, userA);
      var store = await openEncrypted(s, ks, FakeTransport());
      final id = await recordManual(store);
      await (store.db.update(store.db.outboxEvents)..where((t) => t.eventId.equals(id)))
          .write(const OutboxEventsCompanion(syncStatus: Value('syncing')));
      await store.close();
      store = await openEncrypted(s, ks, FakeTransport());
      expect((await store.event(id))!.syncStatus, 'pending');
      await store.close();
    });

    test('wrong key → keyMismatch, file untouched', () async {
      final ks = InMemoryKeyStore();
      final s = scopeFor(gymA, userA);
      final store = await openEncrypted(s, ks, FakeTransport());
      await recordManual(store);
      await store.close();
      final file = File('${dir.path}/${s.databaseFileName}');
      final before = file.readAsBytesSync();
      ks.values[s.keyStoreEntry] = 'ab' * 32;
      await expectLater(openEncrypted(s, ks, FakeTransport()),
          throwsA(isA<OfflineStoreUnavailable>()
              .having((e) => e.reason, 'reason', OfflineStoreFailure.keyMismatch)));
      expect(file.readAsBytesSync(), before);
    });

    test('key missing while DB exists → keyUnavailable, never regenerated', () async {
      final ks = InMemoryKeyStore();
      final s = scopeFor(gymA, userA);
      final store = await openEncrypted(s, ks, FakeTransport());
      await recordManual(store);
      await store.close();
      final key = ks.values[s.keyStoreEntry];
      ks.readsReturnNull = true; // flaky keychain says "not found"
      await expectLater(openEncrypted(s, ks, FakeTransport()),
          throwsA(isA<OfflineStoreUnavailable>()
              .having((e) => e.reason, 'reason', OfflineStoreFailure.keyUnavailable)));
      expect(ks.values[s.keyStoreEntry], key, reason: 'no new key written');
      ks.readsReturnNull = false;
      final again = await openEncrypted(s, ks, FakeTransport());
      expect((await again.outbox()).length, 1, reason: 'events survive the flake');
      await again.close();
    });

    test('keychain read throwing → keyUnavailable even for a fresh scope', () async {
      final ks = InMemoryKeyStore()..failReads = 100;
      final s = scopeFor(gymA, userA);
      await expectLater(openEncrypted(s, ks, FakeTransport()),
          throwsA(isA<OfflineStoreUnavailable>()
              .having((e) => e.reason, 'reason', OfflineStoreFailure.keyUnavailable)));
      expect(ks.values, isEmpty);
      expect(File('${dir.path}/${s.databaseFileName}').existsSync(), isFalse);
    });

    test('transient keychain failure is retried', () async {
      final ks = InMemoryKeyStore();
      final s = scopeFor(gymA, userA);
      final store = await openEncrypted(s, ks, FakeTransport());
      await store.close();
      ks.failReads = 1;
      final again = await openEncrypted(s, ks, FakeTransport());
      await again.close();
    });

    test('opening the same scope twice in one process is refused', () async {
      final ks = InMemoryKeyStore();
      final s = scopeFor(gymA, userA);
      final store = await openEncrypted(s, ks, FakeTransport());
      await expectLater(openEncrypted(s, ks, FakeTransport()), throwsStateError);
      await store.close();
    });
  });

  group('scope isolation', () {
    test('distinct (apiBase, gym, user) → distinct files + keys', () {
      final a = scopeFor(gymA, userA);
      final b = scopeFor(gymA, uid());
      final c = scopeFor(uid(), userA);
      final d = OfflineScope(apiBase: 'https://staging.clby', gymId: gymA, userId: userA);
      final files = {a, b, c, d}.map((s) => s.databaseFileName).toSet();
      expect(files.length, 4);
      expect({a, b, c, d}.map((s) => s.keyStoreEntry).toSet().length, 4);
      expect(OfflineScope(apiBase: '$apiBase/', gymId: gymA, userId: userA).key, a.key);
      expect(a.databaseFileName, isNot(contains(userA)));
    });

    test('two users / gyms on one device never see each other\'s rows', () async {
      final ks = InMemoryKeyStore();
      final sa = scopeFor(gymA, userA);
      final sb = scopeFor(gymA, uid());
      final sc = scopeFor(uid(), userA);
      final ta = FakeTransport(), tb = FakeTransport(), tc = FakeTransport();
      final a = await openEncrypted(sa, ks, ta);
      final b = await openEncrypted(sb, ks, tb);
      final c = await openEncrypted(sc, ks, tc);
      final ida = await recordManual(a);
      await a.db.into(a.db.cachedMembers).insert(CachedMembersCompanion.insert(
          gymMemberId: memberA, fullName: 'Alice', searchText: 'alice'));
      final idb = await recordManual(b);

      expect((await a.outbox()).map((e) => e.eventId), [ida]);
      expect((await b.outbox()).map((e) => e.eventId), [idb]);
      expect(await c.outbox(), isEmpty);
      expect(await b.db.select(b.db.cachedMembers).get(), isEmpty);
      expect(await c.db.select(c.db.cachedMembers).get(), isEmpty);

      await b.engine.syncNow();
      expect(tb.requests.expand((r) => r.eventIds), [idb]);
      await c.engine.syncNow();
      expect(tc.requests, isEmpty);
      for (final s in [a, b, c]) {
        await s.close();
      }
      // Scope B's key can't open scope A's file.
      ks.values[sa.keyStoreEntry] = ks.values[sb.keyStoreEntry]!;
      await expectLater(openEncrypted(sa, ks, ta),
          throwsA(isA<OfflineStoreUnavailable>()));
    });

    test('engine never selects rows of another actor even in the same DB', () async {
      final t = FakeTransport();
      final store = await memoryStore(transport: t);
      final foreign = uid();
      await store.db.into(store.db.outboxEvents).insert(OutboxEventsCompanion.insert(
            eventId: uid(), kind: 'attendance', gymId: gymA, memberId: memberA,
            deviceRecordedAt: '2026-11-26T08:00:00.000+02:00',
            deviceRecordedAtMs: 1, deviceTimezone: 'UTC',
            actorUserId: foreign, actorType: 'admin', deviceId: 'x', createdAt: 1,
            attendanceMethod: const Value('manual')));
      await store.engine.syncNow();
      expect(t.requests, isEmpty);
      expect(await store.outbox(), isEmpty);
      await store.close();
    });
  });

  test('a member_pass cached by an earlier build is removed on open', () async {
    final ks = InMemoryKeyStore();
    final s = scopeFor(gymA, userA);
    var store = await openEncrypted(s, ks, FakeTransport());
    await store.db.writeMeta('member_pass', '{"qr":"old"}');
    await store.close();
    store = await openEncrypted(s, ks, FakeTransport());
    expect(await store.db.readMeta('member_pass'), isNull);
    await store.close();
  });

  group('logout policy (D9)', () {
    test('wipeCache clears cache tables, keeps outbox and last-sync', () async {
      final ks = InMemoryKeyStore();
      final s = scopeFor(gymA, userA);
      final t = FakeTransport();
      var store = await openEncrypted(s, ks, t);
      final pending = await recordManual(store);
      final db = store.db;
      await db.into(db.cachedMembers).insert(CachedMembersCompanion.insert(
          gymMemberId: memberA, fullName: 'A', searchText: 'a'));
      await db.into(db.cachedBranches).insert(CachedBranchesCompanion.insert(id: uid(), name: 'B'));
      await db.writeMeta(SyncMetaKeys.asOf, '2026-11-26T06:00:00Z');
      await db.writeMeta(SyncMetaKeys.lastSuccessfulSyncAt, '2026-11-26T06:00:00Z');
      await store.close(wipeCache: true);

      store = await openEncrypted(s, ks, t);
      expect(await store.db.select(store.db.cachedMembers).get(), isEmpty);
      expect(await store.db.select(store.db.cachedBranches).get(), isEmpty);
      expect(await store.db.readMeta(SyncMetaKeys.asOf), isNull);
      expect(await store.db.readMeta(SyncMetaKeys.lastSuccessfulSyncAt), isNotNull);
      expect((await store.event(pending))!.syncStatus, 'pending');
      expect(store.policy.value.enabled, isTrue, reason: 'policy survives logout');
      await store.close();
    });
  });

  group('schema guards', () {
    late OfflineStore store;
    setUp(() async => store = await memoryStore(transport: FakeTransport()));
    tearDown(() => store.close());

    test('schema version 4 (v2 pass keys, v3 branch qr_token, v4 trainers)', () {
      expect(store.db.schemaVersion, 4);
      expect(OfflineDatabase.currentSchemaVersion, 4);
    });

    test('device_recorded_at / identity is immutable', () async {
      final id = await recordManual(store);
      final q = store.db.update(store.db.outboxEvents)..where((t) => t.eventId.equals(id));
      await expectLater(
          q.write(const OutboxEventsCompanion(
              deviceRecordedAt: Value('2020-01-01T00:00:00.000+00:00'))),
          throwsA(anything));
      await expectLater(
          q.write(OutboxEventsCompanion(memberId: Value(uid()))), throwsA(anything));
      // Sync bookkeeping is still writable.
      await q.write(const OutboxEventsCompanion(syncAttempts: Value(3)));
    });

    test('pending/syncing events cannot be deleted; synced can', () async {
      final id = await recordManual(store);
      final del = store.db.delete(store.db.outboxEvents)..where((t) => t.eventId.equals(id));
      await expectLater(del.go(), throwsA(anything));
      expect(await store.event(id), isNotNull);
      await store.engine.syncNow();
      expect(await del.go(), 1);
    });

    test('CHECK constraints reject bad enums', () async {
      await expectLater(
          store.db.into(store.db.outboxEvents).insert(OutboxEventsCompanion.insert(
              eventId: uid(), kind: 'gym_party', gymId: gymA, memberId: memberA,
              deviceRecordedAt: 'x', deviceRecordedAtMs: 1, deviceTimezone: 'UTC',
              actorUserId: userA, actorType: 'admin', deviceId: 'd', createdAt: 1)),
          throwsA(anything));
      await expectLater(
          store.db.into(store.db.outboxEvents).insert(OutboxEventsCompanion.insert(
              eventId: uid(), kind: 'attendance', gymId: gymA, memberId: memberA,
              deviceRecordedAt: 'x', deviceRecordedAtMs: 1, deviceTimezone: 'UTC',
              actorUserId: userA, actorType: 'admin', deviceId: 'd', createdAt: 1,
              syncStatus: const Value('lost'))),
          throwsA(anything));
    });
  });

  group('DeviceIdentity', () {
    test('generated once, stable across instances', () async {
      final ks = InMemoryKeyStore();
      final a = await DeviceIdentity(keyStore: ks, mirrorDirectory: dir, retryDelay: Duration.zero).load();
      final b = await DeviceIdentity(keyStore: ks, mirrorDirectory: dir, retryDelay: Duration.zero).load();
      expect(a, b);
      expect(a, matches(RegExp(r'^[0-9a-f-]{36}$')));
    });

    test('failed read with mirror → mirror id, not a new one', () async {
      final ks = InMemoryKeyStore();
      final a = await DeviceIdentity(keyStore: ks, mirrorDirectory: dir, retryDelay: Duration.zero).load();
      ks.failReads = 100;
      final b = await DeviceIdentity(keyStore: ks, mirrorDirectory: dir, retryDelay: Duration.zero).load();
      expect(b, a);
    });

    test('failed read without mirror → unavailable, nothing generated', () async {
      final ks = InMemoryKeyStore()..failReads = 100;
      await expectLater(
          DeviceIdentity(keyStore: ks, mirrorDirectory: dir, retryDelay: Duration.zero).load(),
          throwsA(isA<OfflineStoreUnavailable>()
              .having((e) => e.reason, 'r', OfflineStoreFailure.deviceIdUnavailable)));
      expect(ks.values, isEmpty);
    });
  });
}
