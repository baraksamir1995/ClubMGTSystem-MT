import 'dart:convert';

import 'package:cryptography/dart.dart';
import 'package:cryptography/cryptography.dart';
import 'package:drift/drift.dart' show StringExpressionOperators;
import 'package:meta/meta.dart';

import '../db/offline_database.dart';
import '../model/clock_offset.dart';
import '../model/policy_holder.dart';

/// A parsed (NOT yet verified) member pass — PHASE2-CONTRACT "Pass format":
/// `{"t":"clby_mp","v":1,"kid","g","m","n","iat","exp","sig"}`.
@immutable
class MemberPass {
  const MemberPass({
    required this.kid,
    required this.gymId,
    required this.memberId,
    required this.memberNumber,
    required this.iat,
    required this.exp,
    required this.signature,
    required this.raw,
  });

  static const type = 'clby_mp';
  static const version = 1;

  final String kid;
  final String gymId;
  /// gym_members.id
  final String memberId;
  /// Text form of `n` as it appears in the canonical string ('' for null).
  final String memberNumber;
  /// Unix seconds.
  final int iat;
  final int exp;
  final List<int> signature;
  final String raw;

  DateTime get issuedAt => DateTime.fromMillisecondsSinceEpoch(iat * 1000, isUtc: true);
  DateTime get expiresAt => DateTime.fromMillisecondsSinceEpoch(exp * 1000, isUtc: true);

  /// `clby_mp|1|<kid>|<g>|<m>|<n or empty>|<iat>|<exp>` (UTF-8).
  String get canonical => '$type|$version|$kid|$gymId|$memberId|$memberNumber|$iat|$exp';

  /// Max raw QR text length (PHASE2-CONTRACT amendment §3).
  static const maxRawLength = 1024;

  static const _keys = {'t', 'v', 'kid', 'g', 'm', 'n', 'iat', 'exp', 'sig'};
  static final _kidRe = RegExp(r'^[A-Za-z0-9_-]{1,32}$');
  /// Lowercase canonical UUIDs only (server rule).
  static final _uuidRe = RegExp(
      r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
  /// |n| ≤ 2^53−1 (JSON-safe integer; server rule).
  static const maxSafeInt = 9007199254740991;
  static final _sigRe = RegExp(r'^[A-Za-z0-9_-]+$');

  /// Contract step 1 with STRICT canonical parsing (amendment §3): a pass
  /// has exactly one valid QR text. Returns null (→ `qr_invalid`) unless:
  /// ≤ 1024 chars, no BOM, a JSON object with exactly the 9 keys, `t` ==
  /// "clby_mp", `v` the integer 1 (not 1.0), `kid` (server pattern) / `g` /
  /// `m` (lowercase canonical UUIDs) strings, `n` integer or null (not a
  /// string, |n| ≤ 2^53−1), `iat`/`exp`
  /// integers, `sig` unpadded base64url decoding to 64 bytes and
  /// re-encoding to the same text (no `+`/`/`/`=`, no stray trailing bits).
  static MemberPass? tryParse(String raw) {
    if (raw.isEmpty || raw.length > maxRawLength) return null;
    if (raw.codeUnitAt(0) == 0xFEFF) return null; // BOM
    Object? j;
    try {
      j = jsonDecode(raw);
    } catch (_) {
      return null;
    }
    if (j is! Map) return null;
    final Map<Object?, Object?> o = j;
    if (o.length != _keys.length || !o.keys.every(_keys.contains)) return null;
    final t = o['t'], v = o['v'], kid = o['kid'], g = o['g'], m = o['m'];
    final n = o['n'], iat = o['iat'], exp = o['exp'], sig = o['sig'];
    if (t != type) return null;
    if (v is! int || v != version) return null;
    if (kid is! String || !_kidRe.hasMatch(kid)) return null;
    if (g is! String || !_uuidRe.hasMatch(g)) return null;
    if (m is! String || !_uuidRe.hasMatch(m)) return null;
    if (n != null && (n is! int || n.abs() > maxSafeInt)) return null;
    if (iat is! int || exp is! int) return null;
    if (sig is! String || !_sigRe.hasMatch(sig)) return null;
    final sigBytes = decodeBase64Url(sig);
    if (sigBytes == null || sigBytes.length != 64) return null;
    if (encodeBase64UrlNoPad(sigBytes) != sig) return null; // canonical only
    return MemberPass(
      kid: kid,
      gymId: g,
      memberId: m,
      memberNumber: n == null ? '' : '$n',
      iat: iat,
      exp: exp,
      signature: sigBytes,
      raw: raw,
    );
  }
}

/// Unpadded base64url.
String encodeBase64UrlNoPad(List<int> bytes) =>
    base64Url.encode(bytes).replaceAll('=', '');

/// base64url without (or with) padding → bytes, null if malformed.
List<int>? decodeBase64Url(String s) {
  try {
    final padded = s.padRight((s.length + 3) ~/ 4 * 4, '=');
    return base64Url.decode(padded);
  } catch (_) {
    return null;
  }
}

/// Why a pass was not accepted (codes mirror the contract).
enum PassFailure {
  /// Not a member pass / malformed / bad signature / `iat` in the future.
  qrInvalid('qr_invalid'),
  /// `kid` not in the cached `pass_keys` (or retired past `valid_until`):
  /// "refresh offline data". Client-only code.
  qrUnknownKey('qr_unknown_key'),
  /// Pass issued for another gym.
  qrWrongGym('qr_wrong_gym'),
  /// `exp` ≤ estimated server now.
  passExpired('pass_expired'),
  /// Member not in this device's cache.
  memberNotFound('member_not_found');

  const PassFailure(this.code);
  final String code;
}

sealed class PassVerdict {
  const PassVerdict();
}

/// Steps 1–6 passed. The UI MUST still show [member] (cached photo + name)
/// and the cached memberships / assignments "as of [asOf]" and ask the
/// staff member to confirm before recording.
class PassValid extends PassVerdict {
  const PassValid({
    required this.pass,
    required this.member,
    required this.memberships,
    required this.assignments,
    required this.asOf,
  });
  final MemberPass pass;
  /// Cached member row (staff bootstrap) or a synthesized one built from
  /// the coach's cached assignments (coach bootstrap has no member list).
  /// Record events with `member.gymMemberId` (canonical cached id), not the
  /// pass's possibly differently-cased `m`.
  final CachedMember member;
  final List<CachedMembership> memberships;
  final List<CachedAssignment> assignments;
  /// Snapshot `as_of` of the cached data shown alongside.
  final DateTime? asOf;
}

class PassInvalid extends PassVerdict {
  const PassInvalid(this.reason, {this.pass});
  final PassFailure reason;
  /// Present when the text parsed (e.g. for wrong gym / expired details).
  final MemberPass? pass;
}

/// Offline member-pass verification (PHASE2-CONTRACT "Verification",
/// steps 1–6), identical rules to the server and dashboard.
class MemberPassVerifier {
  MemberPassVerifier({
    required this.db,
    required this.gymId,
    required this.serverClock,
    required this.policy,
  });

  final OfflineDatabase db;
  /// The staff member's gym (the store's scope).
  final String gymId;
  final ServerClock serverClock;
  final PolicyHolder policy;

  static final _ed25519 = DartEd25519();

  /// Steps in the amended order (§2): 1 parse → 4 gym → 2 key → 3
  /// signature → 5 time → 6 member.
  Future<PassVerdict> verify(String raw) async {
    // 1. strict parse
    final pass = MemberPass.tryParse(raw);
    if (pass == null) return const PassInvalid(PassFailure.qrInvalid);

    // 4. gym first, so another gym's pass says "wrong gym", not "refresh"
    if (pass.gymId.toLowerCase() != gymId.toLowerCase()) {
      return PassInvalid(PassFailure.qrWrongGym, pass: pass);
    }

    final serverNow = await serverClock.bestServerNow();
    final scanTime = serverClock.deviceNow().toUtc();

    // 2. key: active, or retired within valid_until. Revoked → never
    // (amendment §4); unknown kid / retired past grace → "refresh data".
    final key = await (db.select(db.cachedPassKeys)
          ..where((t) => t.kid.equals(pass.kid)))
        .getSingleOrNull();
    if (key != null && key.status == 'revoked') {
      return PassInvalid(PassFailure.qrInvalid, pass: pass);
    }
    if (key == null || !_keyUsable(key, scanTime)) {
      return PassInvalid(PassFailure.qrUnknownKey, pass: pass);
    }

    // 3. signature
    final pub = decodeBase64Url(key.publicKey);
    if (pub == null || pub.length != 32) {
      return PassInvalid(PassFailure.qrUnknownKey, pass: pass);
    }
    final ok = await _ed25519.verify(
      utf8.encode(pass.canonical),
      signature: Signature(pass.signature,
          publicKey: SimplePublicKey(pub, type: KeyPairType.ed25519)),
    );
    if (!ok) return PassInvalid(PassFailure.qrInvalid, pass: pass);

    // 5. time (amendment §1): iat ≤ exp; the pass must predate the scan
    // (iat ≤ scan time + skew, and ≤ estimated server now + skew); then
    // exp > scan time — like the server, which judges expiry and retired-key
    // grace at the scan (`device_recorded_at`). A device clock far enough
    // off to matter is refused at record time (recorder clockSkew rule).
    final skew = policy.value.futureSkewSeconds;
    int secs(DateTime t) => t.millisecondsSinceEpoch ~/ 1000;
    if (pass.iat > pass.exp ||
        pass.iat > secs(scanTime) + skew ||
        pass.iat > secs(serverNow) + skew) {
      return PassInvalid(PassFailure.qrInvalid, pass: pass);
    }
    if (pass.exp <= secs(scanTime)) {
      return PassInvalid(PassFailure.passExpired, pass: pass);
    }

    // 6. member in cache (UUIDs compare case-insensitively, as on the
    // server; record with the cached row's id — see [PassValid.member]).
    final mid = pass.memberId.toLowerCase();
    final member = await (db.select(db.cachedMembers)
          ..where((t) => t.gymMemberId.lower().equals(mid)))
        .getSingleOrNull();
    final assignments = await (db.select(db.cachedAssignments)
          ..where((t) => t.gymMemberId.lower().equals(mid)))
        .get();
    CachedMember? shown = member;
    if (shown == null && assignments.isNotEmpty) {
      final a = assignments.first;
      final name = a.memberName ?? '';
      shown = CachedMember(
        gymMemberId: a.gymMemberId,
        memberNumber: a.memberNumber,
        fullName: name,
        searchText: name.toLowerCase(),
        photoUrl: a.photoUrl,
      );
    }
    if (shown == null) return PassInvalid(PassFailure.memberNotFound, pass: pass);
    final memberships = await (db.select(db.cachedMemberships)
          ..where((t) => t.gymMemberId.equals(shown!.gymMemberId)))
        .get();
    final asOfRaw = await db.readMeta(SyncMetaKeys.asOf);
    return PassValid(
      pass: pass,
      member: shown,
      memberships: memberships,
      assignments: assignments,
      asOf: asOfRaw == null ? null : DateTime.tryParse(asOfRaw),
    );
  }

  static bool _keyUsable(CachedPassKey k, DateTime serverNow) {
    if (k.status == 'active') return true;
    if (k.status != 'retired') return false;
    final until = k.validUntil == null ? null : DateTime.tryParse(k.validUntil!);
    return until != null && serverNow.isBefore(until);
  }
}
