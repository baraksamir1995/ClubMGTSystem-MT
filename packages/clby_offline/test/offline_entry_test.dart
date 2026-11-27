import 'package:clby_offline/clby_offline.dart';
import 'package:drift/drift.dart' hide isNull, isNotNull;
import 'package:flutter_test/flutter_test.dart';

import 'helpers.dart';

void main() {
  final last = LastOfflineScope(apiBase: 'https://api.x/', gymId: gymA, userId: userA);

  group('offlineEntryBlock', () {
    test('allowed only for the same user, same API, opened store with data', () {
      expect(offlineEntryBlock(hasToken: true, tokenUserId: userA, last: last,
          apiBase: 'https://API.x', storeOpened: true, hasCachedData: true), isNull);
    });
    test('blocks', () {
      expect(offlineEntryBlock(hasToken: false, tokenUserId: userA, last: last, apiBase: 'https://api.x'),
          OfflineEntryBlock.notSignedIn);
      expect(offlineEntryBlock(hasToken: true, tokenUserId: null, last: last, apiBase: 'https://api.x'),
          OfflineEntryBlock.notSignedIn);
      expect(offlineEntryBlock(hasToken: true, tokenUserId: userA, last: null, apiBase: 'https://api.x'),
          OfflineEntryBlock.noPreviousSession);
      expect(offlineEntryBlock(hasToken: true, tokenUserId: uid(), last: last, apiBase: 'https://api.x'),
          OfflineEntryBlock.differentUser);
      expect(offlineEntryBlock(hasToken: true, tokenUserId: userA, last: last, apiBase: 'https://staging.x'),
          OfflineEntryBlock.differentApi);
      expect(offlineEntryBlock(hasToken: true, tokenUserId: userA, last: last, apiBase: 'https://api.x',
          storeOpened: false), OfflineEntryBlock.storeUnavailable);
      expect(offlineEntryBlock(hasToken: true, tokenUserId: userA, last: last, apiBase: 'https://api.x',
          storeOpened: true, hasCachedData: false), OfflineEntryBlock.noCachedData);
    });
  });

  test('LastOfflineScope round-trips; garbage reads as null', () async {
    final ks = InMemoryKeyStore();
    expect(await LastOfflineScope.read(ks), isNull);
    await last.write(ks);
    final r = (await LastOfflineScope.read(ks))!;
    expect(r.userId, userA);
    expect(r.apiBase, 'https://api.x');
    ks.values[LastOfflineScope.storageKey] = '{nope';
    expect(await LastOfflineScope.read(ks), isNull);
  });

  test('cached assignment search by name / number; counts; hasCachedData', () async {
    final store = await memoryStore(transport: FakeTransport());
    expect(await store.hasCachedData(), isFalse);
    await store.db.batch((b) => b.insertAll(store.db.cachedAssignments, [
          CachedAssignmentsCompanion.insert(assignmentId: 'a1', gymMemberId: 'm1',
              memberName: const Value('Barak Samir'), memberNumber: const Value('17')),
          CachedAssignmentsCompanion.insert(assignmentId: 'a2', gymMemberId: 'm2',
              memberName: const Value('Aya Hassan'), memberNumber: const Value('230')),
        ]));
    await store.db.writeMeta(SyncMetaKeys.asOf, '2026-11-26T06:00:00Z');
    expect(await store.hasCachedData(), isTrue);
    expect((await store.cachedAssignments()).map((a) => a.assignmentId), ['a2', 'a1']);
    expect((await store.cachedAssignments(query: 'sam')).single.assignmentId, 'a1');
    expect((await store.cachedAssignments(query: '23')).single.assignmentId, 'a2');
    final c = await store.cachedCounts();
    expect(c.assignments, 2);
    expect(c.members, 0);
    await store.close();
  });
}
