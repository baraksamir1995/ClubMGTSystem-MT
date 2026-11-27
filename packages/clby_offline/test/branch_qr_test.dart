import 'dart:convert';

import 'package:clby_offline/clby_offline.dart';
import 'package:cryptography/cryptography.dart';
import 'package:cryptography/dart.dart';
import 'package:drift/drift.dart' hide isNull, isNotNull;
import 'package:flutter_test/flutter_test.dart';

import 'helpers.dart';

String b64u(List<int> b) => base64Url.encode(b).replaceAll('=', '');

class Key {
  Key(this.kid, this.pair, this.pub);
  final String kid;
  final SimpleKeyPair pair;
  final List<int> pub;
  static Future<Key> create(String kid) async {
    final pair = await DartEd25519().newKeyPair();
    return Key(kid, pair, (await pair.extractPublicKey()).bytes);
  }

  Future<String> sign(String canonical) async =>
      b64u((await DartEd25519().sign(utf8.encode(canonical), keyPair: pair)).bytes);

  Future<String> branchQr({
    required String gym,
    required String branch,
    required String token,
    String mode = 'static',
    required int iat,
    required int exp,
    String jti = 'jti_0123456789abcd',
    Map<String, Object?> override = const {},
  }) async {
    final canonical = 'clby_bq|2|$mode|$kid|$gym|$branch|$token|$iat|$exp|$jti';
    return jsonEncode(<String, Object?>{
      'type': 'gym_access', 'gym_id': gym, 'branch_id': branch, 'token': token,
      'v': 2, 'mode': mode, 'kid': kid, 'iat': iat, 'exp': exp, 'jti': jti,
      'sig': await sign(canonical),
    }..addAll(override));
  }
}

void main() {
  late OfflineStore store;
  late TestClock clock;
  late Key active;
  late int nowS;
  final branch = uid(), token = uid(), otherBranch = uid();
  const day = 86400;

  setUp(() async {
    clock = TestClock(DateTime.utc(2026, 11, 27, 8));
    nowS = clock.now.millisecondsSinceEpoch ~/ 1000;
    store = await memoryStore(transport: FakeTransport(), app: OfflineApp.member, clock: clock,
        scope: OfflineScope(apiBase: apiBase, gymId: gymA, userId: uid()));
    active = await Key.create('k-active');
    await store.db.batch((b) {
      b.insert(store.db.cachedPassKeys, CachedPassKeysCompanion.insert(
          kid: active.kid, publicKey: b64u(active.pub), status: 'active'));
      b.insert(store.db.cachedBranches, CachedBranchesCompanion.insert(
          id: branch, name: 'Main', qrToken: Value(token)));
      b.insert(store.db.cachedBranches, CachedBranchesCompanion.insert(
          id: otherBranch, name: 'Closed', isActive: const Value(false), qrToken: Value(uid())));
    });
  });
  tearDown(() => store.close());

  Future<BranchQrVerdict> verify(String raw) => store.branchQrVerifier.verify(raw);
  BranchQrFailure? reason(BranchQrVerdict v) => v is BranchQrInvalid ? v.reason : null;

  test('valid static and rotating QRs', () async {
    final s = await active.branchQr(gym: gymA, branch: branch, token: token, iat: nowS - day, exp: nowS + 300 * day);
    final v = await verify(s) as BranchQrValid;
    expect(v.branch.name, 'Main');
    expect(v.qr.mode, 'static');
    final r = await active.branchQr(gym: gymA, branch: branch, token: token, mode: 'rotating', iat: nowS - 10, exp: nowS + 50);
    expect(await verify(r), isA<BranchQrValid>());
  });

  test('v1 / other QRs are not v2 (online-only handling)', () async {
    for (final raw in [
      jsonEncode({'type': 'gym_access', 'gym_id': gymA, 'branch_id': branch, 'token': token}),
      jsonEncode({'type': 'gym_access', 'v': 1, 'gym_id': gymA}),
      '{"type":"studio","studio_id":"x"}',
      'gym:$gymA',
      'garbage',
    ]) {
      expect(await verify(raw), isA<BranchQrNotV2>(), reason: raw);
    }
  });

  test('tampered fields / member-pass signature replayed → qr_invalid', () async {
    final good = jsonDecode(await active.branchQr(
        gym: gymA, branch: branch, token: token, iat: nowS, exp: nowS + day)) as Map<String, dynamic>;
    expect(reason(await verify(jsonEncode({...good, 'mode': 'rotating'}))), BranchQrFailure.qrInvalid);
    expect(reason(await verify(jsonEncode({...good, 'exp': nowS + 900 * day}))), BranchQrFailure.qrInvalid);
    expect(reason(await verify(jsonEncode({...good, 'jti': 'jti_zzzzzzzzzzzzzz'}))), BranchQrFailure.qrInvalid);
    // A member-pass signature by the same key over the clby_mp string.
    final mpSig = await active.sign('clby_mp|1|${active.kid}|$gymA|${good['branch_id']}||${good['iat']}|${good['exp']}');
    expect(reason(await verify(jsonEncode({...good, 'sig': mpSig}))), BranchQrFailure.qrInvalid);
  });

  test('strict parsing (same rules as the member pass)', () async {
    final good = await active.branchQr(gym: gymA, branch: branch, token: token, iat: nowS, exp: nowS + day);
    final g = jsonDecode(good) as Map<String, dynamic>;
    // Not a v2 claim (server rule) → v1 handling.
    expect(await verify(good.replaceFirst('"v":2', '"v":2.0')), isA<BranchQrNotV2>());
    expect(await verify('\uFEFF$good'), isA<BranchQrNotV2>());
    final bad = <String>[
      jsonEncode({...g, 'gym_id': gymA.toUpperCase()}),
      jsonEncode({...g, 'token': 'nope'}),
      jsonEncode({...g, 'mode': 'kiosk'}),
      jsonEncode({...g, 'jti': 'short'}),
      jsonEncode({...g, 'iat': '$nowS'}),
      jsonEncode({...g, 'sig': '${g['sig']}=='}),
      jsonEncode({...g, 'extra': 1}),
      jsonEncode(Map.of(g)..remove('jti')),
      good.padRight(1025),
    ];
    for (final raw in bad) {
      expect(reason(await verify(raw)), BranchQrFailure.qrInvalid, reason: raw);
    }
  });

  test('JSON nested ≥ 4 containers deep → not v2 (server depth limit)', () async {
    final g = jsonDecode(await active.branchQr(gym: gymA, branch: branch, token: token, iat: nowS, exp: nowS + day))
        as Map<String, dynamic>;
    expect(await verify(jsonEncode({...g, 'jti': {'a': {'b': {'c': 1}}}})), isA<BranchQrNotV2>());
  });

  test('wrong gym (also before unknown key) and white-label lock', () async {
    final stranger = await Key.create('k-unknown');
    final other = await stranger.branchQr(gym: uid(), branch: branch, token: token, iat: nowS, exp: nowS + day);
    expect(reason(await verify(other)), BranchQrFailure.qrWrongGym);
    store.gymLock = uid();
    final mine = await active.branchQr(gym: gymA, branch: branch, token: token, iat: nowS, exp: nowS + day);
    expect(reason(await verify(mine)), BranchQrFailure.qrWrongGym);
    store.gymLock = gymA;
    expect(await verify(mine), isA<BranchQrValid>());
  });

  test('keys: unknown → qr_unknown_key, revoked → qr_invalid, retired within / past grace', () async {
    final unknown = await Key.create('k-unknown');
    expect(reason(await verify(await unknown.branchQr(gym: gymA, branch: branch, token: token, iat: nowS, exp: nowS + day))),
        BranchQrFailure.qrUnknownKey);
    final revoked = await Key.create('k-revoked');
    final retired = await Key.create('k-retired');
    await store.db.batch((b) => b.insertAll(store.db.cachedPassKeys, [
          CachedPassKeysCompanion.insert(kid: revoked.kid, publicKey: b64u(revoked.pub), status: 'revoked'),
          CachedPassKeysCompanion.insert(kid: retired.kid, publicKey: b64u(retired.pub), status: 'retired',
              validUntil: Value(clock.now.add(const Duration(days: 2)).toIso8601String())),
        ]));
    expect(reason(await verify(await revoked.branchQr(gym: gymA, branch: branch, token: token, iat: nowS, exp: nowS + day))),
        BranchQrFailure.qrInvalid);
    final rq = await retired.branchQr(gym: gymA, branch: branch, token: token, iat: nowS, exp: nowS + 30 * day);
    expect(await verify(rq), isA<BranchQrValid>());
    clock.advance(const Duration(days: 3));
    expect(reason(await verify(rq)), BranchQrFailure.qrUnknownKey);
  });

  test('token mismatch / unknown or inactive branch → out of date', () async {
    for (final raw in [
      await active.branchQr(gym: gymA, branch: branch, token: uid(), iat: nowS, exp: nowS + day),
      await active.branchQr(gym: gymA, branch: uid(), token: token, iat: nowS, exp: nowS + day),
    ]) {
      final v = await verify(raw) as BranchQrInvalid;
      expect(v.reason, BranchQrFailure.qrInvalid);
      expect(v.outOfDate, isTrue);
    }
    final closed = await (store.db.select(store.db.cachedBranches)..where((t) => t.id.equals(otherBranch))).getSingle();
    final v = await verify(await active.branchQr(gym: gymA, branch: otherBranch, token: closed.qrToken!, iat: nowS, exp: nowS + day))
        as BranchQrInvalid;
    expect(v.outOfDate, isTrue);
  });

  test('time: static exp, rotating grace 30 s, iat in future, iat > exp', () async {
    final staticExpired = await active.branchQr(gym: gymA, branch: branch, token: token, iat: nowS - 400 * day, exp: nowS - 1);
    expect(reason(await verify(staticExpired)), BranchQrFailure.qrExpired);
    final rotGrace = await active.branchQr(gym: gymA, branch: branch, token: token, mode: 'rotating', iat: nowS - 80, exp: nowS - 20);
    expect(await verify(rotGrace), isA<BranchQrValid>());
    final rotLate = await active.branchQr(gym: gymA, branch: branch, token: token, mode: 'rotating', iat: nowS - 100, exp: nowS - 40);
    expect(reason(await verify(rotLate)), BranchQrFailure.qrExpired);
    final future = await active.branchQr(gym: gymA, branch: branch, token: token, iat: nowS + 600, exp: nowS + day);
    expect(reason(await verify(future)), BranchQrFailure.qrExpired);
    final inverted = await active.branchQr(gym: gymA, branch: branch, token: token, iat: nowS + 10, exp: nowS + 5);
    expect(reason(await verify(inverted)), BranchQrFailure.qrInvalid);
    // Rotating code living longer than 120 s → qr_invalid (server rule).
    final longRot = await active.branchQr(gym: gymA, branch: branch, token: token, mode: 'rotating', iat: nowS - 10, exp: nowS + 111);
    expect(reason(await verify(longRot)), BranchQrFailure.qrInvalid);
    final okRot = await active.branchQr(gym: gymA, branch: branch, token: token, mode: 'rotating', iat: nowS - 10, exp: nowS + 110);
    expect(await verify(okRot), isA<BranchQrValid>());
  });

  group('gymEntryDenialCached (server gymEntryDenialForBranch rules)', () {
    CachedMembership m({String source = 'subscription', String status = 'active', String pay = 'paid',
            String? plan = 'monthly', String? freeze, List<String>? allowed}) =>
        CachedMembership(membershipId: uid(), gymMemberId: 'x', sourceType: source, status: status,
            paymentStatus: pay, planType: plan, freezeStatus: freeze,
            allowedBranchIds: allowed == null ? null : jsonEncode(allowed));
    test('allowed', () {
      expect(gymEntryDenialCached([m()], branch), isNull);
      expect(gymEntryDenialCached([m(allowed: [branch])], branch), isNull);
      expect(gymEntryDenialCached([], branch), isNull, reason: 'no subscription, no transfer → server allows');
    });
    test('denials', () {
      expect(gymEntryDenialCached([m(freeze: 'frozen')], branch), EntryDenial.frozen);
      expect(gymEntryDenialCached([m(plan: 'sessions')], branch), EntryDenial.gymAccessNotIncluded);
      expect(gymEntryDenialCached([m(allowed: [otherBranch])], branch), EntryDenial.branchNotIncluded);
      expect(gymEntryDenialCached([m(source: 'transfer')], branch), EntryDenial.transferOnly);
    });
    test('unpaid / inactive subscription is not "current"', () {
      expect(gymEntryDenialCached([m(pay: 'pending', plan: 'sessions')], branch), isNull);
      expect(gymEntryDenialCached([m(status: 'expired'), m(source: 'transfer')], branch), EntryDenial.transferOnly);
    });
  });

  test('member snapshot caches branch tokens, trainers, own assignments; logout wipes them', () async {
    final t = FakeTransport();
    final ms = await memoryStore(transport: t, app: OfflineApp.member, clock: clock,
        scope: OfflineScope(apiBase: apiBase, gymId: gymA, userId: uid()));
    final trainer = uid();
    t.mePage = SnapshotPage({
      'server_time': '2026-11-27T08:00:00Z', 'as_of': '2026-11-27T08:00:00Z',
      'member': {'gym_member_id': memberA, 'member_number': 7, 'full_name': 'Me'},
      'buckets': [],
      'branches': [{'id': branch, 'name': 'Main', 'is_active': true, 'qr_token': token}],
      'pass_keys': [{'kid': 'k', 'public_key': b64u(active.pub), 'status': 'active', 'valid_until': null}],
      'trainers': [{'id': trainer, 'name': 'Coach', 'service_type': 'personal_trainer', 'is_active': true}],
      'assignments': [{'id': 'as-1', 'trainer_id': trainer, 'service_type': 'personal_trainer',
          'sessions_total': 10, 'sessions_used': 2, 'expires_at': null, 'status': 'active'}],
    });
    final r = await ms.bootstrap.refresh();
    expect(r.trainers, 1);
    expect((await ms.db.select(ms.db.cachedBranches).getSingle()).qrToken, token);
    final a = (await ms.assignmentsOf(memberA)).single;
    expect(a.assignmentId, 'as-1');
    expect(a.trainerId, trainer);
    expect(await ms.ownMemberId(), memberA);
    await ms.wipeCache();
    expect(await ms.db.select(ms.db.cachedBranches).get(), isEmpty);
    expect(await ms.db.select(ms.db.cachedTrainers).get(), isEmpty);
    await ms.close();
  });

  test('coach bootstrap caches own_qr for offline display', () async {
    final t = FakeTransport();
    final cs = await memoryStore(transport: t, app: OfflineApp.coach, clock: clock,
        scope: OfflineScope(apiBase: apiBase, gymId: gymA, userId: uid()));
    t.bootstrapPages[null] = const SnapshotPage({
      'as_of': '2026-11-27T08:00:00Z',
      'own_qr': {'qr': '{"type":"specialist_session","v":2}', 'expires_at': '2036-11-27T08:00:00Z', 'kid': 'k'},
    });
    await cs.bootstrap.refresh();
    final q = (await cs.ownQr())!;
    expect(q.qr, contains('specialist_session'));
    expect(q.isExpiredAt(DateTime.utc(2030)), isFalse);
    await cs.wipeCache();
    expect(await cs.ownQr(), isNull);
    await cs.close();
  });

  test('member_qr event: self only, qr.raw + branch recorded', () async {
    await store.policy.applyServerPolicy({...enabledPolicy, 'allow_member_qr_offline': true});
    await store.db.writeMeta(SyncMetaKeys.member, jsonEncode({'gym_member_id': memberA}));
    final raw = await active.branchQr(gym: gymA, branch: branch, token: token, iat: nowS, exp: nowS + day);
    final o = await store.recorder.record(NewOfflineEvent.attendance(
        method: AttendanceMethod.memberQr, memberId: memberA, branchId: branch, qrRaw: raw)) as RecordSaved;
    final w = o.event.toWireJson();
    expect(w['attendance_method'], 'member_qr');
    expect(w['member_id'], memberA);
    expect(w['branch_id'], branch);
    expect(w['qr'], {'raw': raw});
    final other = await store.recorder.record(NewOfflineEvent.attendance(
        method: AttendanceMethod.memberQr, memberId: uid(), branchId: branch, qrRaw: raw));
    expect((other as RecordRefused).reason, RecordRefusal.notSelf);
  });
}
