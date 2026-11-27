import 'dart:convert';

import 'package:cryptography/cryptography.dart';
import 'package:cryptography/dart.dart';
import 'package:meta/meta.dart';

import '../db/offline_database.dart';
import '../model/clock_offset.dart';
import '../model/policy_holder.dart';
import 'member_pass.dart';

/// A parsed (NOT yet verified) coach QR v2 — PHASE3 Amendment 2 §C:
/// `{"type":"specialist_session","gym_id","trainer_id","v":2,"kid","iat",
///   "exp","jti","sig"}`.
@immutable
class SpecialistQr {
  const SpecialistQr({
    required this.gymId,
    required this.trainerId,
    required this.kid,
    required this.iat,
    required this.exp,
    required this.jti,
    required this.signature,
    required this.raw,
  });

  static const type = 'specialist_session';
  static const version = 2;
  static const maxRawLength = 1024;

  final String gymId;
  /// trainer_profiles.id
  final String trainerId;
  final String kid;
  final int iat;
  final int exp;
  final String jti;
  final List<int> signature;
  final String raw;

  /// `clby_sq|2|<kid>|<gym_id>|<trainer_id>|<iat>|<exp>|<jti>` — distinct
  /// prefix from `clby_bq` / `clby_mp`, so no other signature verifies here.
  String get canonical => 'clby_sq|$version|$kid|$gymId|$trainerId|$iat|$exp|$jti';

  static const _keys = {'type', 'gym_id', 'trainer_id', 'v', 'kid', 'iat', 'exp', 'jti', 'sig'};
  static final _uuidRe =
      RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
  static final _kidRe = RegExp(r'^[A-Za-z0-9_-]{1,32}$');
  static final _jtiRe = RegExp(r'^[A-Za-z0-9_-]{16,32}$');
  static final _sigRe = RegExp(r'^[A-Za-z0-9_-]+$');

  /// Claims to be a v2 coach QR: no BOM, `type == "specialist_session"`,
  /// integer `v == 2`. Otherwise today's online handling (v1).
  static bool claimsV2(String raw) {
    if (raw.isEmpty || raw.codeUnitAt(0) == 0xFEFF) return false;
    try {
      final j = jsonDecode(raw);
      return j is Map && j['type'] == type && j['v'] is int && j['v'] == version;
    } catch (_) {
      return false;
    }
  }

  /// Strict parse (same rules as the branch QR / member pass). Null →
  /// `qr_invalid`.
  static SpecialistQr? tryParse(String raw) {
    if (raw.isEmpty || raw.length > maxRawLength) return null;
    if (raw.codeUnitAt(0) == 0xFEFF) return null;
    Object? j;
    try {
      j = jsonDecode(raw);
    } catch (_) {
      return null;
    }
    if (j is! Map) return null;
    final Map<Object?, Object?> o = j;
    if (o.length != _keys.length || !o.keys.every(_keys.contains)) return null;
    final t = o['type'], v = o['v'], g = o['gym_id'], tr = o['trainer_id'];
    final kid = o['kid'], iat = o['iat'], exp = o['exp'], jti = o['jti'], sig = o['sig'];
    if (t != type) return null;
    if (v is! int || v != version) return null;
    if (g is! String || !_uuidRe.hasMatch(g)) return null;
    if (tr is! String || !_uuidRe.hasMatch(tr)) return null;
    if (kid is! String || !_kidRe.hasMatch(kid)) return null;
    if (iat is! int || exp is! int) return null;
    if (jti is! String || !_jtiRe.hasMatch(jti)) return null;
    if (sig is! String || !_sigRe.hasMatch(sig)) return null;
    final sigBytes = decodeBase64Url(sig);
    if (sigBytes == null || sigBytes.length != 64) return null;
    if (encodeBase64UrlNoPad(sigBytes) != sig) return null;
    return SpecialistQr(
      gymId: g,
      trainerId: tr,
      kid: kid,
      iat: iat,
      exp: exp,
      jti: jti,
      signature: sigBytes,
      raw: raw,
    );
  }
}

/// Coach-QR failure codes.
enum SpecialistQrFailure {
  qrInvalid('qr_invalid'),
  qrWrongGym('qr_wrong_gym'),
  /// Client-only (server: qr_invalid) — "refresh offline data".
  qrUnknownKey('qr_unknown_key'),
  qrExpired('qr_expired');

  const SpecialistQrFailure(this.code);
  final String code;
}

sealed class SpecialistQrVerdict {
  const SpecialistQrVerdict();
}

/// Not a v2 coach QR — today's online flow.
class SpecialistQrNotV2 extends SpecialistQrVerdict {
  const SpecialistQrNotV2();
}

class SpecialistQrValid extends SpecialistQrVerdict {
  const SpecialistQrValid(this.qr, this.trainer);
  final SpecialistQr qr;
  final CachedTrainer trainer;
}

class SpecialistQrInvalid extends SpecialistQrVerdict {
  const SpecialistQrInvalid(this.reason, {this.qr, this.unknownTrainer = false});
  final SpecialistQrFailure reason;
  final SpecialistQr? qr;
  /// The trainer isn't a cached active trainer of the gym.
  final bool unknownTrainer;
}

/// Offline coach-QR verification: strict parse → gym (+ white-label lock)
/// → key → signature → trainer cached + active → time (`iat ≤ scan +
/// skew`, `scan ≤ exp`; `iat > exp` → qr_invalid).
class SpecialistQrVerifier {
  SpecialistQrVerifier({
    required this.db,
    required this.gymId,
    required this.serverClock,
    required this.policy,
    this.gymLock,
  });

  final OfflineDatabase db;
  final String gymId;
  final String? gymLock;
  final ServerClock serverClock;
  final PolicyHolder policy;

  static final _ed25519 = DartEd25519();

  Future<SpecialistQrVerdict> verify(String raw, {DateTime? scanTime}) async {
    final qr = SpecialistQr.tryParse(raw);
    if (qr == null) {
      return SpecialistQr.claimsV2(raw)
          ? const SpecialistQrInvalid(SpecialistQrFailure.qrInvalid)
          : const SpecialistQrNotV2();
    }
    final lock = gymLock;
    if (qr.gymId != gymId.toLowerCase() ||
        (lock != null && lock.isNotEmpty && qr.gymId != lock.toLowerCase())) {
      return SpecialistQrInvalid(SpecialistQrFailure.qrWrongGym, qr: qr);
    }
    final scan = (scanTime ?? serverClock.deviceNow()).toUtc();
    final scanS = scan.millisecondsSinceEpoch ~/ 1000;

    final key = await (db.select(db.cachedPassKeys)..where((t) => t.kid.equals(qr.kid)))
        .getSingleOrNull();
    if (key != null && key.status == 'revoked') {
      return SpecialistQrInvalid(SpecialistQrFailure.qrInvalid, qr: qr);
    }
    if (key == null || !_keyUsable(key, scan)) {
      return SpecialistQrInvalid(SpecialistQrFailure.qrUnknownKey, qr: qr);
    }
    final pub = decodeBase64Url(key.publicKey);
    if (pub == null || pub.length != 32) {
      return SpecialistQrInvalid(SpecialistQrFailure.qrUnknownKey, qr: qr);
    }
    final ok = await _ed25519.verify(
      utf8.encode(qr.canonical),
      signature: Signature(qr.signature,
          publicKey: SimplePublicKey(pub, type: KeyPairType.ed25519)),
    );
    if (!ok) return SpecialistQrInvalid(SpecialistQrFailure.qrInvalid, qr: qr);

    final trainer = await (db.select(db.cachedTrainers)..where((t) => t.id.equals(qr.trainerId)))
        .getSingleOrNull();
    if (trainer == null || !trainer.isActive) {
      return SpecialistQrInvalid(SpecialistQrFailure.qrInvalid, qr: qr, unknownTrainer: true);
    }

    if (qr.iat > qr.exp) return SpecialistQrInvalid(SpecialistQrFailure.qrInvalid, qr: qr);
    if (qr.iat > scanS + policy.value.futureSkewSeconds || scanS > qr.exp) {
      return SpecialistQrInvalid(SpecialistQrFailure.qrExpired, qr: qr);
    }
    return SpecialistQrValid(qr, trainer);
  }

  static bool _keyUsable(CachedPassKey k, DateTime at) {
    if (k.status == 'active') return true;
    if (k.status != 'retired') return false;
    final until = k.validUntil == null ? null : DateTime.tryParse(k.validUntil!);
    return until != null && at.isBefore(until);
  }
}

/// Local, informational coach-session pre-check — the same selection rules
/// as the online `SpecialistScanController` (codes `no_package` /
/// `package_expired` / `package_exhausted`), against the member's cached
/// assignments "as of" the snapshot, judged at [at] (scan time).
enum SpecialistDenial {
  noPackage('no_package'),
  packageExpired('package_expired'),
  packageExhausted('package_exhausted');

  const SpecialistDenial(this.code);
  final String code;
}

/// Returns the usable assignment the server would pick (expiring soonest,
/// no expiry last), or the denial.
({CachedAssignment? pick, SpecialistDenial? denial}) specialistPreCheck(
    List<CachedAssignment> memberAssignments, String trainerId, DateTime at) {
  final mine = memberAssignments.where((a) => a.trainerId == trainerId).toList();
  if (mine.isEmpty) return (pick: null, denial: SpecialistDenial.noPackage);
  int remaining(CachedAssignment a) => (a.sessionsTotal ?? 0) - (a.sessionsUsed ?? 0);
  final usable = mine
      .where((a) => a.status == 'active' && remaining(a) > 0 && !_expiredAt(a.expiresAt, at))
      .toList()
    ..sort((x, y) {
      final ex = _expiry(x.expiresAt), ey = _expiry(y.expiresAt);
      if (ex == null && ey == null) return 0;
      if (ex == null) return 1;
      if (ey == null) return -1;
      return ex.compareTo(ey);
    });
  if (usable.isNotEmpty) return (pick: usable.first, denial: null);
  final anyExpired = mine.any((a) => remaining(a) > 0 && _expiredAt(a.expiresAt, at));
  return (
    pick: null,
    denial: anyExpired ? SpecialistDenial.packageExpired : SpecialistDenial.packageExhausted,
  );
}

/// `expires_at` as an instant: date-only `YYYY-MM-DD` is the START of that
/// day in UTC (what the server's `Carbon::parse` gives with app TZ UTC).
DateTime? _expiry(String? s) {
  if (s == null || s.isEmpty) return null;
  final d = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(s);
  if (d != null) {
    return DateTime.utc(int.parse(d.group(1)!), int.parse(d.group(2)!), int.parse(d.group(3)!));
  }
  return DateTime.tryParse(s)?.toUtc();
}

bool _expiredAt(String? s, DateTime at) {
  final e = _expiry(s);
  return e != null && e.isBefore(at.toUtc());
}
