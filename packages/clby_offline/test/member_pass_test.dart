import 'dart:convert';

import 'package:clby_offline/clby_offline.dart';
import 'package:cryptography/dart.dart';
import 'package:cryptography/cryptography.dart';
import 'package:drift/drift.dart' hide isNull, isNotNull;
import 'package:flutter_test/flutter_test.dart';

import 'helpers.dart';

String b64u(List<int> b) => base64Url.encode(b).replaceAll('=', '');

class Signer {
  Signer(this.kid, this.pair, this.pub);
  final String kid;
  final SimpleKeyPair pair;
  final List<int> pub;
  static Future<Signer> create(String kid) async {
    final pair = await DartEd25519().newKeyPair();
    final pub = (await pair.extractPublicKey()).bytes;
    return Signer(kid, pair, pub);
  }

  Future<String> pass({
    required String gym,
    required String member,
    Object? n = 42,
    required int iat,
    required int exp,
    String? kidOverride,
    Map<String, Object?> tamper = const {},
  }) async {
    final k = kidOverride ?? kid;
    final canonical = 'clby_mp|1|$k|$gym|$member|${n ?? ''}|$iat|$exp';
    final sig = await DartEd25519().sign(utf8.encode(canonical), keyPair: pair);
    final m = <String, Object?>{
      't': 'clby_mp', 'v': 1, 'kid': k, 'g': gym, 'm': member, 'n': n,
      'iat': iat, 'exp': exp, 'sig': b64u(sig.bytes),
    }..addAll(tamper);
    return jsonEncode(m);
  }
}

void main() {
  late FakeTransport t;
  late TestClock clock;
  late OfflineStore store;
  late Signer active;
  late Signer retired;
  late int nowS;

  setUp(() async {
    t = FakeTransport();
    clock = TestClock(DateTime.utc(2026, 11, 26, 8));
    store = await memoryStore(transport: t, clock: clock);
    nowS = clock.now.millisecondsSinceEpoch ~/ 1000;
    active = await Signer.create('k-active');
    retired = await Signer.create('k-old');
    await store.db.batch((b) {
      b.insertAll(store.db.cachedPassKeys, [
        CachedPassKeysCompanion.insert(
            kid: active.kid, publicKey: b64u(active.pub), status: 'active'),
        CachedPassKeysCompanion.insert(
            kid: retired.kid, publicKey: b64u(retired.pub), status: 'retired',
            validUntil: Value(clock.now.add(const Duration(days: 3)).toIso8601String())),
      ]);
      b.insert(store.db.cachedMembers, CachedMembersCompanion.insert(
          gymMemberId: memberA, fullName: 'Alice', searchText: 'alice 42',
          memberNumber: const Value('42'), photoUrl: const Value('https://x/a.jpg')));
      b.insert(store.db.cachedMemberships, CachedMembershipsCompanion.insert(
          membershipId: 'mm1', gymMemberId: memberA, status: const Value('active')));
    });
    await store.db.writeMeta(SyncMetaKeys.asOf, '2026-11-26T07:00:00Z');
  });
  tearDown(() => store.close());

  Future<PassVerdict> verify(String raw) => store.passVerifier.verify(raw);
  PassFailure? reason(PassVerdict v) => v is PassInvalid ? v.reason : null;
  int day = 86400;

  test('valid pass → member + memberships "as of"', () async {
    final raw = await active.pass(gym: gymA, member: memberA, iat: nowS - 60, exp: nowS + 30 * day);
    final v = await verify(raw);
    expect(v, isA<PassValid>());
    final ok = v as PassValid;
    expect(ok.member.fullName, 'Alice');
    expect(ok.member.photoUrl, 'https://x/a.jpg');
    expect(ok.memberships.single.membershipId, 'mm1');
    expect(ok.asOf, DateTime.utc(2026, 11, 26, 7));
    expect(ok.pass.memberId, memberA);
  });

  test('null member number is part of the canonical string', () async {
    final raw = await active.pass(gym: gymA, member: memberA, n: null, iat: nowS, exp: nowS + day);
    expect(await verify(raw), isA<PassValid>());
  });

  test('tampered fields or signature → qr_invalid', () async {
    final good = await active.pass(gym: gymA, member: memberA, iat: nowS, exp: nowS + day);
    final j = jsonDecode(good) as Map<String, dynamic>;
    final otherMember = Map.of(j)..['m'] = uid();
    expect(reason(await verify(jsonEncode(otherMember))), PassFailure.qrInvalid);
    final longer = Map.of(j)..['exp'] = nowS + 365 * day;
    expect(reason(await verify(jsonEncode(longer))), PassFailure.qrInvalid);
    final sig = decodeBase64Url(j['sig'] as String)!..[0] ^= 1;
    final badSig = Map.of(j)..['sig'] = b64u(sig);
    expect(reason(await verify(jsonEncode(badSig))), PassFailure.qrInvalid);
  });

  test('not a member pass / malformed → qr_invalid', () async {
    for (final raw in [
      'garbage',
      '{"type":"gym_access","token":"x"}',
      '{"t":"clby_mp","v":2,"kid":"k","g":"g","m":"m","n":1,"iat":1,"exp":2,"sig":"x"}',
      '{"t":"clby_mp","v":1,"kid":"k","g":"g","m":"m","iat":1,"exp":2,"sig":"x"}',
      '{"t":"clby_mp","v":1,"kid":"k","g":"g","m":"m","n":1,"iat":"1","exp":2,"sig":"x"}',
    ]) {
      expect(reason(await verify(raw)), PassFailure.qrInvalid, reason: raw);
    }
  });

  test('wrong gym → qr_wrong_gym (signature valid)', () async {
    final raw = await active.pass(gym: uid(), member: memberA, iat: nowS, exp: nowS + day);
    expect(reason(await verify(raw)), PassFailure.qrWrongGym);
  });

  test('expired at scan time → pass_expired; expiry judged at scan time like the server', () async {
    final raw = await active.pass(gym: gymA, member: memberA, iat: nowS - 31 * day, exp: nowS - 1);
    expect(reason(await verify(raw)), PassFailure.passExpired);
    // Server rule (corpus case expired_now_valid_at_scan): expiry is judged
    // at the scan (device_recorded_at). A scan stamped before exp is valid;
    // clocks off beyond the server's window are refused by the recorder.
    await store.serverClock.record(clock.now.toIso8601String());
    clock.now = clock.now.subtract(const Duration(minutes: 1));
    expect(await verify(raw), isA<PassValid>());
  });

  test('unknown kid → qr_unknown_key', () async {
    final stranger = await Signer.create('k-unknown');
    final raw = await stranger.pass(gym: gymA, member: memberA, iat: nowS, exp: nowS + day);
    expect(reason(await verify(raw)), PassFailure.qrUnknownKey);
  });

  test('retired key: accepted within valid_until, unknown after', () async {
    final raw = await retired.pass(gym: gymA, member: memberA, iat: nowS - day, exp: nowS + 20 * day);
    expect(await verify(raw), isA<PassValid>());
    clock.advance(const Duration(days: 4));
    expect(reason(await verify(raw)), PassFailure.qrUnknownKey);
  });

  test('iat beyond future skew → qr_invalid; within skew → ok', () async {
    final far = await active.pass(gym: gymA, member: memberA, iat: nowS + 600, exp: nowS + day);
    expect(reason(await verify(far)), PassFailure.qrInvalid);
    final near = await active.pass(gym: gymA, member: memberA, iat: nowS + 200, exp: nowS + day);
    expect(await verify(near), isA<PassValid>());
  });

  test('member not cached → member_not_found', () async {
    final raw = await active.pass(gym: gymA, member: uid(), iat: nowS, exp: nowS + day);
    expect(reason(await verify(raw)), PassFailure.memberNotFound);
  });

  test('uppercase gym / member UUIDs and |n| > 2^53−1 → qr_invalid (server rules)', () async {
    final upper = await active.pass(
        gym: gymA.toUpperCase(), member: memberA.toUpperCase(), iat: nowS, exp: nowS + day);
    expect(reason(await verify(upper)), PassFailure.qrInvalid);
    final big = await active.pass(gym: gymA, member: memberA, n: 9007199254740992, iat: nowS, exp: nowS + day);
    expect(reason(await verify(big)), PassFailure.qrInvalid);
    final maxOk = await active.pass(gym: gymA, member: memberA, n: 9007199254740991, iat: nowS, exp: nowS + day);
    expect(await verify(maxOk), isA<PassValid>());
  });

  test('coach cache (assignments only) synthesizes the member', () async {
    final other = uid();
    await store.db.into(store.db.cachedAssignments).insert(CachedAssignmentsCompanion.insert(
        assignmentId: 'as1', gymMemberId: other, memberName: const Value('Bob'),
        memberNumber: const Value('7'), status: const Value('active')));
    final raw = await active.pass(gym: gymA, member: other, n: 7, iat: nowS, exp: nowS + day);
    final v = await verify(raw) as PassValid;
    expect(v.member.fullName, 'Bob');
    expect(v.assignments.single.assignmentId, 'as1');
  });

  group('amendments after Phase 2 verification', () {
    Future<Map<String, dynamic>> goodMap() async => jsonDecode(
        await active.pass(gym: gymA, member: memberA, iat: nowS, exp: nowS + day))
        as Map<String, dynamic>;
    String enc(Map<String, dynamic> m) => jsonEncode(m);

    test('§3 strict canonical parsing → qr_invalid', () async {
      final g = await goodMap();
      final good = enc(g);
      expect(await verify(good), isA<PassValid>());
      final sig = g['sig'] as String;
      final cases = <String, String>{
        'v 1.0': good.replaceFirst('"v":1,', '"v":1.0,'),
        'n as string': enc({...g, 'n': '42'}),
        'iat 1.0': good.replaceFirst('"iat":$nowS', '"iat":$nowS.0'),
        'padded sig': enc({...g, 'sig': '$sig=='}),
        'standard alphabet sig': enc({...g, 'sig': sig.replaceAll('-', '+').replaceAll('_', '/')}),
        'BOM': '\uFEFF$good',
        'extra key': enc({...g, 'x': 1}),
        'missing n': enc(Map.of(g)..remove('n')),
        'too long': enc({...g, 'kid': g['kid']}).padRight(1025, ' '),
        'kid pattern': enc({...g, 'kid': 'k id'}),
        'gym not uuid': enc({...g, 'g': 'not-a-uuid'}),
      };
      // Non-canonical trailing bits: same 64 bytes, different last char.
      final last = sig[sig.length - 1];
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
      final idx = alphabet.indexOf(last);
      final alt = alphabet[(idx & ~0xF) | ((idx + 1) & 0xF)];
      cases['non-canonical trailing bits'] = enc({...g, 'sig': sig.substring(0, sig.length - 1) + alt});
      for (final e in cases.entries) {
        if (e.key == 'standard alphabet sig' && !sig.contains(RegExp('[-_]'))) continue;
        expect(reason(await verify(e.value)), PassFailure.qrInvalid, reason: e.key);
      }
      expect('\uFEFF$good'.codeUnitAt(0), 0xFEFF);
    });

    test('§1 iat > exp → qr_invalid', () async {
      final raw = await active.pass(gym: gymA, member: memberA, iat: nowS + 10, exp: nowS + 5);
      expect(reason(await verify(raw)), PassFailure.qrInvalid);
    });

    test('§1 pass must predate the scan (device clock set back after measuring)', () async {
      final raw = await active.pass(gym: gymA, member: memberA, iat: nowS, exp: nowS + day);
      await store.serverClock.record(clock.now.toIso8601String());
      clock.now = clock.now.subtract(const Duration(hours: 1)); // scan time 1 h earlier
      expect(reason(await verify(raw)), PassFailure.qrInvalid);
    });

    test('§2 wrong gym reported before an unknown key', () async {
      final stranger = await Signer.create('k-unknown');
      final raw = await stranger.pass(gym: uid(), member: memberA, iat: nowS, exp: nowS + day);
      expect(reason(await verify(raw)), PassFailure.qrWrongGym);
    });

    test('§4 revoked key → rejected, no grace', () async {
      final revoked = await Signer.create('k-revoked');
      await store.db.into(store.db.cachedPassKeys).insert(CachedPassKeysCompanion.insert(
          kid: revoked.kid, publicKey: b64u(revoked.pub), status: 'revoked',
          validUntil: Value(clock.now.add(const Duration(days: 30)).toIso8601String())));
      final raw = await revoked.pass(gym: gymA, member: memberA, iat: nowS, exp: nowS + day);
      expect(reason(await verify(raw)), PassFailure.qrInvalid);
    });
  });

  test('bootstrap caches pass_keys and replaces them atomically', () async {
    t.bootstrapPages[null] = SnapshotPage({
      'as_of': '2026-11-26T08:00:00Z',
      'pass_keys': [
        {'kid': 'k1', 'public_key': b64u(active.pub), 'status': 'active', 'valid_until': null},
        {'kid': 'k0', 'public_key': b64u(retired.pub), 'status': 'retired',
         'valid_until': '2026-12-20T00:00:00Z'},
      ],
    });
    final r = await store.bootstrap.refresh();
    expect(r.passKeys, 2);
    final keys = await store.db.select(store.db.cachedPassKeys).get();
    expect(keys.map((k) => k.kid).toSet(), {'k1', 'k0'});
    expect(keys.firstWhere((k) => k.kid == 'k0').validUntil, '2026-12-20T00:00:00Z');
    await store.wipeCache();
    expect(await store.db.select(store.db.cachedPassKeys).get(), isEmpty);
  });
}
