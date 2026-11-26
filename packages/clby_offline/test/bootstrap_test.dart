import 'package:clby_offline/clby_offline.dart';
import 'package:flutter_test/flutter_test.dart';

import 'helpers.dart';

Map<String, Object?> member(String id, String name, {List<Map<String, Object?>> buckets = const []}) => {
      'gym_member_id': id, 'member_number': 'M-$name', 'full_name': name,
      'phone_last4': '1234', 'photo_url': null, 'status': 'active', 'buckets': buckets,
    };

void main() {
  late FakeTransport t;
  late TestClock clock;
  late OfflineStore store;
  final branch = uid();
  final m1 = uid(), m2 = uid(), m3 = uid();

  setUp(() async {
    t = FakeTransport();
    clock = TestClock(DateTime.utc(2026, 11, 26, 8));
    store = await memoryStore(transport: t, clock: clock);
    t.bootstrapPages[null] = SnapshotPage({
      'server_time': '2026-11-26T08:00:00Z',
      'as_of': '2026-11-26T07:59:00Z',
      'gym': {'id': gymA, 'name': 'Gym', 'timezone': 'Africa/Cairo'},
      'policy': {...enabledPolicy, 'max_data_age_hours': 12},
      'branches': [{'id': branch, 'name': 'Main', 'is_active': true}],
      'members': [
        member(m1, 'Alice', buckets: [{
          'membership_id': 'mm1', 'plan_type': 'sessions', 'source_type': 'subscription',
          'status': 'active', 'payment_status': 'paid', 'start_date': '2026-11-01',
          'end_date': '2026-12-01', 'sessions_remaining': 3, 'sessions_total': 10,
          'freeze_status': null, 'allowed_branch_ids': [branch],
        }]),
        member(m2, 'Bob'),
      ],
      'class_sessions': [{'id': 'cs1', 'class_id': 'c1', 'name': 'Yoga', 'branch_id': branch,
          'studio_id': null, 'starts_at': '2026-11-26T10:00:00Z', 'ends_at': '2026-11-26T11:00:00Z'}],
      'recent_attendance': [{'attendance_id': 'a1', 'gym_member_id': m1,
          'class_session_id': 'cs1', 'branch_id': branch, 'check_in_at': '2026-11-26T07:00:00Z'}],
      'next_cursor': 'p2',
    });
    t.bootstrapPages['p2'] = SnapshotPage({
      'server_time': '2026-11-26T08:00:05Z',
      'as_of': '2026-11-26T07:58:00Z',
      'members': [member(m3, 'Carol')],
      'next_cursor': null,
    });
  });
  tearDown(() => store.close());

  test('pages through cursors and replaces the cache atomically', () async {
    final r = await store.bootstrap.refresh();
    expect(t.bootstrapCalls, [null, 'p2']);
    expect(r.pages, 2);
    expect(r.members, 3);
    expect(r.memberships, 1);
    expect(r.branches, 1);
    expect(r.classSessions, 1);
    expect(r.recentAttendance, 1);
    expect(r.asOf, DateTime.utc(2026, 11, 26, 7, 58), reason: 'earliest as_of');
    final db = store.db;
    expect((await db.select(db.cachedMembers).get()).map((m) => m.fullName).toSet(),
        {'Alice', 'Bob', 'Carol'});
    final b = await db.select(db.cachedMemberships).getSingle();
    expect(b.sessionsRemaining, 3);
    expect(b.allowedBranchIds, '["$branch"]');
    expect(store.policy.value.maxDataAgeHours, 12);
    expect(await db.readMeta(SyncMetaKeys.gym), contains('Africa/Cairo'));
    expect(await store.bootstrap.isStale(), isFalse);
  });

  test('a failing page leaves the previous snapshot intact', () async {
    await store.bootstrap.refresh();
    t.bootstrapPages[null] = SnapshotPage({
      ...t.bootstrapPages[null]!.json,
      'as_of': '2026-11-26T09:00:00Z',
      'members': [member(uid(), 'Mallory')],
    });
    t.failCursor = 'p2';
    await expectLater(store.bootstrap.refresh(), throwsA(isA<SyncNetworkError>()));
    final names = (await store.db.select(store.db.cachedMembers).get()).map((m) => m.fullName).toSet();
    expect(names, {'Alice', 'Bob', 'Carol'});
    expect(await store.db.readMeta(SyncMetaKeys.asOf), '2026-11-26T07:58:00Z');
  });

  test('refresh replaces (not merges) — removed members disappear', () async {
    await store.bootstrap.refresh();
    t.bootstrapPages['p2'] = SnapshotPage({'as_of': '2026-11-26T08:00:00Z', 'members': []});
    await store.bootstrap.refresh();
    expect((await store.db.select(store.db.cachedMembers).get()).length, 2);
  });

  test('cursor loop is detected', () async {
    t.bootstrapPages['p2'] = SnapshotPage({'members': [], 'next_cursor': 'p2'});
    await expectLater(store.bootstrap.refresh(), throwsA(isA<BootstrapPagingError>()));
  });

  test('staleness vs max_data_age_hours; engine reports expired', () async {
    expect(await store.bootstrap.isStale(), isTrue, reason: 'never bootstrapped');
    await store.bootstrap.refresh(); // as_of 07:58, max 12 h
    expect(await store.bootstrap.isStale(now: DateTime.utc(2026, 11, 26, 19, 57)), isFalse);
    expect(await store.bootstrap.isStale(now: DateTime.utc(2026, 11, 26, 20, 0)), isTrue);
    clock.now = DateTime.utc(2026, 11, 26, 21);
    final s = await store.engine.refreshState();
    expect(s.dataExpired, isTrue);
    expect(s.indicator, SyncIndicator.expired);
  });

  test('refreshIfStale: status disabled → no bootstrap', () async {
    t.statusResponse = OfflineStatusResponse.fromJson({
      'enabled': false, 'policy': {'enabled': false}, 'device': {'registered': true}});
    expect(await store.refreshIfStale(), isNull);
    expect(t.bootstrapCalls, isEmpty);
    expect(store.policy.value.enabled, isFalse);
  });

  test('refreshIfStale(evenIfDisabled) bootstraps while disabled (coach pass keys)', () async {
    t.statusResponse = OfflineStatusResponse.fromJson({
      'enabled': false, 'policy': {'enabled': false}, 'device': {'registered': true}});
    t.bootstrapPages[null] = SnapshotPage({
      ...t.bootstrapPages[null]!.json,
      'policy': {'enabled': false},
      'next_cursor': null,
    });
    expect(await store.refreshIfStale(evenIfDisabled: true), isNotNull);
    expect(store.policy.value.enabled, isFalse);
  });

  test('refreshIfStale: enabled + stale → bootstraps once', () async {
    expect(await store.refreshIfStale(), isNotNull);
    expect(await store.refreshIfStale(), isNull, reason: 'fresh now');
    expect(t.bootstrapCalls, [null, 'p2']);
  });

  test('member snapshot via /offline/me', () async {
    final ms = await memoryStore(
        transport: t, app: OfflineApp.member, clock: clock,
        scope: OfflineScope(apiBase: apiBase, gymId: gymA, userId: uid()));
    t.mePage = SnapshotPage({
      'server_time': '2026-11-26T08:00:00Z', 'as_of': '2026-11-26T08:00:00Z',
      'gym': {'id': gymA}, 'policy': enabledPolicy,
      'member': {'gym_member_id': memberA, 'member_number': '7', 'full_name': 'Me'},
      'buckets': [{'membership_id': 'b1', 'plan_type': 'duration', 'status': 'active'}],
      'branches': [{'id': branch, 'name': 'Main', 'is_active': false}],
      'recent_attendance': [],
    });
    final r = await ms.bootstrap.refresh();
    expect(r.members, 1);
    expect(r.memberships, 1);
    expect((await ms.db.select(ms.db.cachedBranches).getSingle()).isActive, isFalse);
    expect(await ms.db.readMeta(SyncMetaKeys.member), contains(memberA));
    await ms.close();
  });

  test('coach snapshot: assignments + recent service logs', () async {
    final cs = await memoryStore(
        transport: t, app: OfflineApp.coach, clock: clock,
        scope: OfflineScope(apiBase: apiBase, gymId: gymA, userId: uid()));
    t.bootstrapPages[null] = SnapshotPage({
      'as_of': '2026-11-26T08:00:00Z',
      'assignments': [{'assignment_id': 'as1', 'gym_member_id': memberA, 'member_name': 'X',
          'sessions_total': 10, 'sessions_used': '4', 'status': 'active'}],
      'recent_service_logs': [{'service_log_id': 'l1', 'assignment_id': 'as1',
          'logged_at': '2026-11-26T07:00:00Z'}],
    });
    final r = await cs.bootstrap.refresh();
    expect(r.assignments, 1);
    expect(r.recentServiceLogs, 1);
    expect((await cs.db.select(cs.db.cachedAssignments).getSingle()).sessionsUsed, 4);
    await cs.close();
  });
}
