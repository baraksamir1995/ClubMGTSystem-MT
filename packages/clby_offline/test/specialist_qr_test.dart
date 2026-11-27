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

  Future<String> sign(String c) async =>
      b64u((await DartEd25519().sign(utf8.encode(c), keyPair: pair)).bytes);

  Future<String> coachQr({required String gym, required String trainer, required int iat,
      required int exp, String jti = 'jti_0123456789abcd'}) async {
    final sig = await sign('clby_sq|2|$kid|$gym|$trainer|$iat|$exp|$jti');
    return jsonEncode({'type': 'specialist_session', 'gym_id': gym, 'trainer_id': trainer,
      'v': 2, 'kid': kid, 'iat': iat, 'exp': exp, 'jti': jti, 'sig': sig});
  }
}

void main() {
  late OfflineStore store;
  late TestClock clock;
  late Key key;
  late int nowS;
  final trainer = uid(), inactive = uid();
  const year = 365 * 86400;

  setUp(() async {
    clock = TestClock(DateTime.utc(2026, 11, 27, 8));
    nowS = clock.now.millisecondsSinceEpoch ~/ 1000;
    store = await memoryStore(transport: FakeTransport(), app: OfflineApp.member, clock: clock,
        scope: OfflineScope(apiBase: apiBase, gymId: gymA, userId: uid()));
    key = await Key.create('k-active');
    await store.db.batch((b) {
      b.insert(store.db.cachedPassKeys, CachedPassKeysCompanion.insert(
          kid: key.kid, publicKey: b64u(key.pub), status: 'active'));
      b.insert(store.db.cachedTrainers, CachedTrainersCompanion.insert(
          id: trainer, name: const Value('Coach A'), serviceType: const Value('personal_trainer')));
      b.insert(store.db.cachedTrainers, CachedTrainersCompanion.insert(
          id: inactive, isActive: const Value(false)));
    });
  });
  tearDown(() => store.close());

  Future<SpecialistQrVerdict> verify(String raw) => store.specialistQrVerifier.verify(raw);
  SpecialistQrFailure? reason(SpecialistQrVerdict v) => v is SpecialistQrInvalid ? v.reason : null;

  test('valid signed coach QR (fixed, 10-year TTL)', () async {
    final raw = await key.coachQr(gym: gymA, trainer: trainer, iat: nowS - 86400, exp: nowS + 10 * year);
    final v = await verify(raw) as SpecialistQrValid;
    expect(v.trainer.name, 'Coach A');
  });

  test('today\'s unsigned coach QR is not v2 (online flow)', () async {
    expect(await verify(jsonEncode({'type': 'specialist_session', 'gym_id': gymA, 'trainer_id': trainer})),
        isA<SpecialistQrNotV2>());
    expect(await verify(jsonEncode({'type': 'specialist_session', 'gym_id': gymA, 'trainer_id': trainer, 'v': 2.0})),
        isA<SpecialistQrNotV2>());
  });

  test('tampered / branch-QR signature replayed → qr_invalid', () async {
    final g = jsonDecode(await key.coachQr(gym: gymA, trainer: trainer, iat: nowS, exp: nowS + year))
        as Map<String, dynamic>;
    expect(reason(await verify(jsonEncode({...g, 'trainer_id': inactive}))), SpecialistQrFailure.qrInvalid);
    expect(reason(await verify(jsonEncode({...g, 'exp': nowS + 20 * year}))), SpecialistQrFailure.qrInvalid);
    final bq = await key.sign('clby_bq|2|static|${key.kid}|$gymA|$trainer|$trainer|${g['iat']}|${g['exp']}|${g['jti']}');
    expect(reason(await verify(jsonEncode({...g, 'sig': bq}))), SpecialistQrFailure.qrInvalid);
    for (final bad in [
      jsonEncode({...g, 'extra': 1}),
      jsonEncode(Map.of(g)..remove('jti')),
      jsonEncode({...g, 'trainer_id': trainer.toUpperCase()}),
      jsonEncode({...g, 'sig': '${g['sig']}=='}),
      jsonEncode({...g, 'iat': '${g['iat']}'}),
    ]) {
      expect(reason(await verify(bad)), SpecialistQrFailure.qrInvalid, reason: bad);
    }
  });

  test('wrong gym (before key) / white-label lock', () async {
    final stranger = await Key.create('k-unknown');
    expect(reason(await verify(await stranger.coachQr(gym: uid(), trainer: trainer, iat: nowS, exp: nowS + year))),
        SpecialistQrFailure.qrWrongGym);
    store.gymLock = uid();
    expect(reason(await verify(await key.coachQr(gym: gymA, trainer: trainer, iat: nowS, exp: nowS + year))),
        SpecialistQrFailure.qrWrongGym);
  });

  test('keys: unknown → qr_unknown_key; revoked → qr_invalid', () async {
    final unknown = await Key.create('k-unknown');
    expect(reason(await verify(await unknown.coachQr(gym: gymA, trainer: trainer, iat: nowS, exp: nowS + year))),
        SpecialistQrFailure.qrUnknownKey);
    final revoked = await Key.create('k-revoked');
    await store.db.into(store.db.cachedPassKeys).insert(CachedPassKeysCompanion.insert(
        kid: revoked.kid, publicKey: b64u(revoked.pub), status: 'revoked'));
    expect(reason(await verify(await revoked.coachQr(gym: gymA, trainer: trainer, iat: nowS, exp: nowS + year))),
        SpecialistQrFailure.qrInvalid);
  });

  test('inactive / unknown trainer → qr_invalid (unknownTrainer)', () async {
    for (final t in [inactive, uid()]) {
      final v = await verify(await key.coachQr(gym: gymA, trainer: t, iat: nowS, exp: nowS + year))
          as SpecialistQrInvalid;
      expect(v.reason, SpecialistQrFailure.qrInvalid);
      expect(v.unknownTrainer, isTrue);
    }
  });

  test('time: expired, iat in the future, iat > exp', () async {
    expect(reason(await verify(await key.coachQr(gym: gymA, trainer: trainer, iat: nowS - year, exp: nowS - 1))),
        SpecialistQrFailure.qrExpired);
    expect(reason(await verify(await key.coachQr(gym: gymA, trainer: trainer, iat: nowS + 600, exp: nowS + year))),
        SpecialistQrFailure.qrExpired);
    expect(reason(await verify(await key.coachQr(gym: gymA, trainer: trainer, iat: nowS + 10, exp: nowS + 5))),
        SpecialistQrFailure.qrInvalid);
  });

  group('specialistPreCheck (SpecialistScanController rules)', () {
    final at = DateTime.utc(2026, 11, 27, 8);
    CachedAssignment a(String id, {String? tr, String status = 'active', int total = 10, int used = 4,
            String? expires}) =>
        CachedAssignment(assignmentId: id, gymMemberId: 'm', trainerId: tr ?? trainer, status: status,
            sessionsTotal: total, sessionsUsed: used, expiresAt: expires);
    test('no package with this trainer', () {
      expect(specialistPreCheck([a('x', tr: uid())], trainer, at).denial, SpecialistDenial.noPackage);
      expect(specialistPreCheck([], trainer, at).denial, SpecialistDenial.noPackage);
    });
    test('picks the usable package expiring soonest (no expiry last)', () {
      final r = specialistPreCheck([
        a('none'),
        a('later', expires: '2027-06-01'),
        a('soon', expires: '2026-12-15T00:00:00Z'),
        a('done', used: 10, expires: '2026-12-01'),
      ], trainer, at);
      expect(r.denial, isNull);
      expect(r.pick!.assignmentId, 'soon');
    });
    test('expired vs exhausted', () {
      expect(specialistPreCheck([a('e', expires: '2026-11-27')], trainer, at).denial,
          SpecialistDenial.packageExpired, reason: 'date-only = start of day UTC');
      expect(specialistPreCheck([a('x', used: 10)], trainer, at).denial,
          SpecialistDenial.packageExhausted);
      expect(specialistPreCheck([a('x', used: 10), a('e', expires: '2026-01-01')], trainer, at).denial,
          SpecialistDenial.packageExpired);
      expect(specialistPreCheck([a('c', status: 'completed', used: 3)], trainer, at).denial,
          SpecialistDenial.packageExhausted);
    });
  });

  test('member service_session event: member_qr + trainer_id + qr.raw, self only', () async {
    await store.policy.applyServerPolicy({...enabledPolicy, 'allow_member_qr_offline': true});
    await store.db.writeMeta(SyncMetaKeys.member, jsonEncode({'gym_member_id': memberA}));
    final raw = await key.coachQr(gym: gymA, trainer: trainer, iat: nowS, exp: nowS + year);
    final o = await store.recorder.record(NewOfflineEvent.memberServiceSession(
        memberId: memberA, trainerId: trainer, qrRaw: raw)) as RecordSaved;
    final w = o.event.toWireJson();
    expect(w['kind'], 'service_session');
    expect(w['attendance_method'], 'member_qr');
    expect(w['trainer_id'], trainer);
    expect(w['service_assignment_id'], isNull);
    expect(w['qr'], {'raw': raw});
    // Same scan again → anti-double-tap; other members refused.
    expect(await store.recorder.record(NewOfflineEvent.memberServiceSession(
        memberId: memberA, trainerId: trainer, qrRaw: raw)), isA<RecordDuplicate>());
    expect(((await store.recorder.record(NewOfflineEvent.memberServiceSession(
        memberId: uid(), trainerId: trainer, qrRaw: raw))) as RecordRefused).reason, RecordRefusal.notSelf);
  });

  test('events without a trainer keep their exact wire shape (no trainer_id key)', () async {
    final s2 = await memoryStore(transport: FakeTransport());
    final id = await recordManual(s2);
    expect((await s2.event(id))!.toWireJson().containsKey('trainer_id'), isFalse);
    await s2.close();
  });

  test('coach app cannot record member-QR service sessions', () async {
    final cs = await memoryStore(transport: FakeTransport(), app: OfflineApp.coach,
        scope: OfflineScope(apiBase: apiBase, gymId: gymA, userId: uid()));
    final o = await cs.recorder.record(NewOfflineEvent.memberServiceSession(
        memberId: memberA, trainerId: trainer, qrRaw: '{}'));
    expect((o as RecordRefused).reason, RecordRefusal.notAllowed);
    await cs.close();
  });
}
