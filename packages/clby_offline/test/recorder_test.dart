import 'dart:convert';

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
  tearDown(() => store.close());

  NewOfflineEvent manual(String member, {String? cls, String? branch}) =>
      NewOfflineEvent.attendance(
          method: AttendanceMethod.manual,
          memberId: member,
          classSessionId: cls,
          branchId: branch);

  test('writes a pending row with all CONTRACT fields', () async {
    final branch = uid();
    final o = await store.recorder.record(NewOfflineEvent.attendance(
        method: AttendanceMethod.staffQr, memberId: memberA, branchId: branch,
        qrRaw: '{"x":1}', metadata: {'screen': 'scan'}));
    expect(o, isA<RecordSaved>());
    final e = (o as RecordSaved).event;
    expect(e.eventId, matches(RegExp(
        r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')));
    expect(e.syncStatus, 'pending');
    expect(e.kind, 'attendance');
    expect(e.attendanceMethod, 'staff_qr');
    expect(e.gymId, gymA);
    expect(e.memberId, memberA);
    expect(e.branchId, branch);
    expect(e.actorUserId, userA);
    expect(e.actorType, 'admin');
    expect(e.deviceId, 'dev-1');
    expect(e.deviceTimezone, 'Africa/Cairo');
    expect(e.qrRaw, '{"x":1}');
    expect(e.syncAttempts, 0);
    expect(e.deviceRecordedAtMs, clock.now.millisecondsSinceEpoch);
    final off = clock.now.timeZoneOffset;
    expect(DateTime.parse(e.deviceRecordedAt).toUtc(), clock.now.toUtc());
    expect(e.deviceRecordedAt, endsWith(formatWithExplicitOffset(clock.now, off).substring(23)));
    expect(jsonDecode(e.metadata), {'screen': 'scan'});
  });

  test('offset formatting', () {
    final t = DateTime(2026, 11, 26, 8, 1, 2, 123);
    expect(formatWithExplicitOffset(t, const Duration(hours: 2)), '2026-11-26T08:01:02.123+02:00');
    expect(formatWithExplicitOffset(t, const Duration(hours: -3, minutes: -30)),
        '2026-11-26T08:01:02.123-03:30');
    expect(fallbackTimezone(DateTime.utc(2026)), anyOf('UTC', startsWith('Etc/GMT')));
  });

  group('anti-double-tap (10 s window)', () {
    test('identical event within the window → doubleTap, one row', () async {
      final first = await store.recorder.record(manual(memberA));
      clock.advance(const Duration(seconds: 9));
      final second = await store.recorder.record(manual(memberA));
      expect(second, isA<RecordDuplicate>());
      final d = second as RecordDuplicate;
      expect(d.reason, LocalDuplicateReason.doubleTap);
      expect(d.existingEventId, (first as RecordSaved).event.eventId);
      expect((await store.outbox()).length, 1);
    });

    test('after the window a new gym-entry event is allowed (D1: no entry window)', () async {
      await store.recorder.record(manual(memberA));
      clock.advance(const Duration(seconds: 11));
      expect(await store.recorder.record(manual(memberA)), isA<RecordSaved>());
      clock.advance(const Duration(minutes: 1));
      expect(await store.recorder.record(manual(memberA)), isA<RecordSaved>());
      expect((await store.outbox()).length, 3);
    });

    test('different member / branch / method within the window are not duplicates', () async {
      await store.recorder.record(manual(memberA));
      expect(await store.recorder.record(manual(uid())), isA<RecordSaved>());
      expect(await store.recorder.record(manual(memberA, branch: uid())), isA<RecordSaved>());
      expect(await store.recorder.record(NewOfflineEvent.attendance(
          method: AttendanceMethod.staffQr, memberId: memberA)), isA<RecordSaved>());
    });

    test('a rejected identical event does not block a retry', () async {
      final o = await store.recorder.record(manual(memberA)) as RecordSaved;
      await (store.db.update(store.db.outboxEvents)
            ..where((x) => x.eventId.equals(o.event.eventId)))
          .write(const OutboxEventsCompanion(syncStatus: Value('rejected')));
      expect(await store.recorder.record(manual(memberA)), isA<RecordSaved>());
    });
  });

  group('class rule (member, class_session)', () {
    test('existing outbox event for the same class → classAlreadyCheckedIn', () async {
      final cls = uid();
      await store.recorder.record(manual(memberA, cls: cls));
      clock.advance(const Duration(hours: 1));
      final o = await store.recorder.record(manual(memberA, cls: cls));
      expect((o as RecordDuplicate).reason, LocalDuplicateReason.classAlreadyCheckedIn);
      expect(await store.recorder.record(manual(memberA, cls: uid())), isA<RecordSaved>());
    });

    test('cached server attendance for the class → duplicate with its id', () async {
      final cls = uid();
      await store.db.into(store.db.cachedRecentAttendance).insert(
          CachedRecentAttendanceCompanion.insert(
              attendanceId: 'srv-1', gymMemberId: memberA, classSessionId: Value(cls)));
      final o = await store.recorder.record(manual(memberA, cls: cls));
      expect((o as RecordDuplicate).existingAttendanceId, 'srv-1');
    });
  });

  group('validation + policy', () {
    Future<RecordRefusal?> refusal(NewOfflineEvent e, {OfflineStore? s}) async {
      final o = await (s ?? store).recorder.record(e);
      return o is RecordRefused ? o.reason : null;
    }

    test('policy disabled (default before any server policy) → offlineDisabled', () async {
      await store.policy.applyServerPolicy({'enabled': false});
      expect(await refusal(manual(memberA)), RecordRefusal.offlineDisabled);
    });

    test('invalid ids / missing fields → invalidInput', () async {
      expect(await refusal(manual('not-a-uuid')), RecordRefusal.invalidInput);
      expect(await refusal(manual(memberA, branch: 'x')), RecordRefusal.invalidInput);
    });

    test('per-method policy switches', () async {
      await store.policy.applyServerPolicy({...enabledPolicy, 'allow_manual_offline': false});
      expect(await refusal(manual(memberA)), RecordRefusal.notAllowed);
      await store.policy.applyServerPolicy({...enabledPolicy, 'allow_staff_qr_offline': false});
      expect(await refusal(NewOfflineEvent.attendance(
          method: AttendanceMethod.staffQr, memberId: memberA)), RecordRefusal.notAllowed);
    });

    test('admin cannot record member_qr or service sessions', () async {
      expect(await refusal(NewOfflineEvent.attendance(
          method: AttendanceMethod.memberQr, memberId: memberA, qrRaw: 'x')),
          RecordRefusal.notAllowed);
      expect(await refusal(NewOfflineEvent.serviceSession(
          memberId: memberA, serviceAssignmentId: uid())), RecordRefusal.notAllowed);
    });

    test('cache expired + policy block → cacheExpired; warn → saved flagged', () async {
      await store.policy.applyServerPolicy({...enabledPolicy, 'expired_cache_policy': 'block'});
      expect(await refusal(manual(memberA)), RecordRefusal.cacheExpired);
      await store.policy.applyServerPolicy({...enabledPolicy, 'expired_cache_policy': 'warn'});
      final o = await store.recorder.record(manual(memberA));
      expect((o as RecordSaved).cacheExpired, isTrue);
      await store.db.writeMeta(SyncMetaKeys.asOf, clock.now.toUtc().toIso8601String());
      clock.advance(const Duration(seconds: 30));
      final o2 = await store.recorder.record(manual(uid()));
      expect((o2 as RecordSaved).cacheExpired, isFalse);
      expect(jsonDecode(o2.event.metadata)['cache_as_of'], isNotNull);
    });

    test('note and metadata limits', () async {
      final coach = await memoryStore(
          transport: FakeTransport(), app: OfflineApp.coach,
          scope: OfflineScope(apiBase: apiBase, gymId: gymA, userId: uid()));
      expect(await refusal(NewOfflineEvent.serviceSession(
          memberId: memberA, serviceAssignmentId: uid(), note: 'x' * 501), s: coach),
          RecordRefusal.invalidInput);
      expect(await refusal(NewOfflineEvent.serviceSession(
          memberId: memberA, serviceAssignmentId: uid(),
          metadata: {'blob': 'y' * 5000}), s: coach), RecordRefusal.invalidInput);
      await coach.close();
    });
  });

  test('coach records service_session only', () async {
    final coach = await memoryStore(
        transport: FakeTransport(), app: OfflineApp.coach, clock: clock,
        scope: OfflineScope(apiBase: apiBase, gymId: gymA, userId: uid()));
    final a = uid();
    final o = await coach.recorder.record(NewOfflineEvent.serviceSession(
        memberId: memberA, serviceAssignmentId: a, note: 'legs'));
    final e = (o as RecordSaved).event;
    expect(e.kind, 'service_session');
    expect(e.serviceAssignmentId, a);
    expect(e.attendanceMethod, isNull);
    expect(e.toWireJson()['note'], 'legs');
    expect((await coach.recorder.record(manual(memberA))), isA<RecordRefused>());
    await coach.close();
  });

  test('member: member_qr only, self only, policy gate', () async {
    final m = await memoryStore(
        transport: FakeTransport(), app: OfflineApp.member, clock: clock,
        scope: OfflineScope(apiBase: apiBase, gymId: gymA, userId: uid()));
    final qr = NewOfflineEvent.attendance(
        method: AttendanceMethod.memberQr, memberId: memberA, qrRaw: '{"type":"gym_access"}');
    // allow_member_qr_offline defaults to false (CONTRACT §4).
    expect(((await m.recorder.record(qr)) as RecordRefused).reason, RecordRefusal.notAllowed);
    await m.policy.applyServerPolicy({...enabledPolicy, 'allow_member_qr_offline': true});
    await m.db.writeMeta(SyncMetaKeys.member, jsonEncode({'gym_member_id': uid()}));
    expect(((await m.recorder.record(qr)) as RecordRefused).reason, RecordRefusal.notSelf);
    await m.db.writeMeta(SyncMetaKeys.member, jsonEncode({'gym_member_id': memberA}));
    final saved = await m.recorder.record(qr) as RecordSaved;
    expect(saved.event.toWireJson()['qr'], {'raw': '{"type":"gym_access"}'});
    expect(((await m.recorder.record(NewOfflineEvent.attendance(
        method: AttendanceMethod.memberQr, memberId: memberA))) as RecordRefused).reason,
        RecordRefusal.invalidInput, reason: 'member_qr needs the QR text');
    await m.close();
  });
}
