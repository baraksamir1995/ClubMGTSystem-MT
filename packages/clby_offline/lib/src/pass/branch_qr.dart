import 'dart:convert';

import 'package:cryptography/cryptography.dart';
import 'package:cryptography/dart.dart';
import 'package:meta/meta.dart';

import '../db/offline_database.dart';
import '../model/clock_offset.dart';
import '../model/policy_holder.dart';
import 'member_pass.dart';

/// A parsed (NOT yet verified) branch QR v2 — PHASE3-CONTRACT §1:
/// `{"type":"gym_access","gym_id","branch_id","token","v":2,"mode","kid",
///   "iat","exp","jti","sig"}`.
@immutable
class BranchQr {
  const BranchQr({
    required this.gymId,
    required this.branchId,
    required this.token,
    required this.mode,
    required this.kid,
    required this.iat,
    required this.exp,
    required this.jti,
    required this.signature,
    required this.raw,
  });

  static const type = 'gym_access';
  static const version = 2;
  static const maxRawLength = 1024;

  final String gymId;
  final String branchId;
  /// `branches.qr_token` the QR was issued for.
  final String token;
  /// `static` | `rotating`.
  final String mode;
  final String kid;
  final int iat;
  final int exp;
  final String jti;
  final List<int> signature;
  final String raw;

  bool get rotating => mode == 'rotating';

  /// `clby_bq|2|<mode>|<kid>|<gym_id>|<branch_id>|<token>|<iat>|<exp>|<jti>`.
  String get canonical =>
      'clby_bq|$version|$mode|$kid|$gymId|$branchId|$token|$iat|$exp|$jti';

  static const _keys = {
    'type', 'gym_id', 'branch_id', 'token', 'v', 'mode', 'kid', 'iat', 'exp', 'jti', 'sig',
  };
  static final _uuidRe =
      RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
  static final _kidRe = RegExp(r'^[A-Za-z0-9_-]{1,32}$');
  static final _jtiRe = RegExp(r'^[A-Za-z0-9_-]{16,32}$');
  static final _sigRe = RegExp(r'^[A-Za-z0-9_-]+$');

  /// True when [raw] is a JSON object claiming to be a v2 branch QR:
  /// no BOM, `type == "gym_access"` and an INTEGER `v` equal to 2 (server
  /// rule; `2.0` or a BOM-prefixed text is not a v2 claim → v1 handling).
  /// A v2 claim that then fails strict parsing is `qr_invalid`.
  static bool claimsV2(String raw) {
    if (raw.isEmpty || raw.codeUnitAt(0) == 0xFEFF) return false;
    try {
      final j = jsonDecode(raw);
      return j is Map && j['type'] == type && j['v'] is int && j['v'] == version;
    } catch (_) {
      return false;
    }
  }

  /// Strict parse (PHASE3 §1 = PHASE2 amendment §3 rules): ≤ 1024 chars,
  /// no BOM, exactly the 11 keys, integer `v` 2, lowercase canonical UUIDs,
  /// `mode` static|rotating, kid/jti patterns, integer iat/exp, canonical
  /// unpadded base64url 64-byte `sig`. Null → `qr_invalid`.
  static BranchQr? tryParse(String raw) {
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
    final t = o['type'], v = o['v'], g = o['gym_id'], b = o['branch_id'];
    final tok = o['token'], mode = o['mode'], kid = o['kid'];
    final iat = o['iat'], exp = o['exp'], jti = o['jti'], sig = o['sig'];
    if (t != type) return null;
    if (v is! int || v != version) return null;
    if (g is! String || !_uuidRe.hasMatch(g)) return null;
    if (b is! String || !_uuidRe.hasMatch(b)) return null;
    if (tok is! String || !_uuidRe.hasMatch(tok)) return null;
    if (mode != 'static' && mode != 'rotating') return null;
    if (kid is! String || !_kidRe.hasMatch(kid)) return null;
    if (iat is! int || exp is! int) return null;
    if (jti is! String || !_jtiRe.hasMatch(jti)) return null;
    if (sig is! String || !_sigRe.hasMatch(sig)) return null;
    final sigBytes = decodeBase64Url(sig);
    if (sigBytes == null || sigBytes.length != 64) return null;
    if (encodeBase64UrlNoPad(sigBytes) != sig) return null;
    return BranchQr(
      gymId: g,
      branchId: b,
      token: tok,
      mode: mode as String,
      kid: kid,
      iat: iat,
      exp: exp,
      jti: jti,
      signature: sigBytes,
      raw: raw,
    );
  }
}

/// Branch QR failure codes (contract §2).
enum BranchQrFailure {
  qrInvalid('qr_invalid'),
  qrWrongGym('qr_wrong_gym'),
  /// Client-only (server: qr_invalid) — "refresh offline data".
  qrUnknownKey('qr_unknown_key'),
  qrExpired('qr_expired');

  const BranchQrFailure(this.code);
  final String code;
}

sealed class BranchQrVerdict {
  const BranchQrVerdict();
}

/// Not a v2 branch QR (v1, other QR types, garbage) — the caller keeps
/// today's online-only handling.
class BranchQrNotV2 extends BranchQrVerdict {
  const BranchQrNotV2();
}

class BranchQrValid extends BranchQrVerdict {
  const BranchQrValid(this.qr, this.branch);
  final BranchQr qr;
  final CachedBranch branch;
}

class BranchQrInvalid extends BranchQrVerdict {
  const BranchQrInvalid(this.reason, {this.qr, this.outOfDate = false});
  final BranchQrFailure reason;
  final BranchQr? qr;
  /// Step 5 failed (unknown/inactive branch or token ≠ the cached current
  /// token): "This QR is out of date — ask staff".
  final bool outOfDate;
}

/// Offline v2 branch-QR verification (PHASE3-CONTRACT §2 steps 1–6).
class BranchQrVerifier {
  BranchQrVerifier({
    required this.db,
    required this.gymId,
    required this.serverClock,
    required this.policy,
    this.gymLock,
  });

  final OfflineDatabase db;
  /// The member's gym (store scope).
  final String gymId;
  /// White-label builds: the QR must also be for `Env.gymId`.
  final String? gymLock;
  final ServerClock serverClock;
  final PolicyHolder policy;

  /// `rotating_grace_seconds` (server config, default 30).
  static const rotatingGraceSeconds = 30;

  static final _ed25519 = DartEd25519();

  /// [scanTime] defaults to the device clock (it becomes the event's
  /// `device_recorded_at`, which is what the server judges against).
  Future<BranchQrVerdict> verify(String raw, {DateTime? scanTime}) async {
    // 1. strict parse; not a v2 claim → v1 handling
    final qr = BranchQr.tryParse(raw);
    if (qr == null) {
      return BranchQr.claimsV2(raw)
          ? const BranchQrInvalid(BranchQrFailure.qrInvalid)
          : const BranchQrNotV2();
    }

    // 2. gym (and white-label lock)
    final lock = gymLock;
    if (qr.gymId != gymId.toLowerCase() ||
        (lock != null && lock.isNotEmpty && qr.gymId != lock.toLowerCase())) {
      return BranchQrInvalid(BranchQrFailure.qrWrongGym, qr: qr);
    }

    final scan = (scanTime ?? serverClock.deviceNow()).toUtc();
    final scanS = scan.millisecondsSinceEpoch ~/ 1000;

    // 3. key: active, or retired within grace at scan time; revoked never
    final key = await (db.select(db.cachedPassKeys)..where((t) => t.kid.equals(qr.kid)))
        .getSingleOrNull();
    if (key != null && key.status == 'revoked') {
      return BranchQrInvalid(BranchQrFailure.qrInvalid, qr: qr);
    }
    if (key == null || !_keyUsable(key, scan)) {
      return BranchQrInvalid(BranchQrFailure.qrUnknownKey, qr: qr);
    }

    // 4. signature (distinct clby_bq prefix — a member-pass signature can
    // never verify here)
    final pub = decodeBase64Url(key.publicKey);
    if (pub == null || pub.length != 32) {
      return BranchQrInvalid(BranchQrFailure.qrUnknownKey, qr: qr);
    }
    final ok = await _ed25519.verify(
      utf8.encode(qr.canonical),
      signature: Signature(qr.signature,
          publicKey: SimplePublicKey(pub, type: KeyPairType.ed25519)),
    );
    if (!ok) return BranchQrInvalid(BranchQrFailure.qrInvalid, qr: qr);

    // 5. branch cached + active + current token
    final branch = await (db.select(db.cachedBranches)
          ..where((t) => t.id.equals(qr.branchId)))
        .getSingleOrNull();
    if (branch == null || !branch.isActive || branch.qrToken == null ||
        branch.qrToken!.toLowerCase() != qr.token) {
      return BranchQrInvalid(BranchQrFailure.qrInvalid, qr: qr, outOfDate: true);
    }

    // 6. time (judged at the scan)
    if (qr.iat > qr.exp) return BranchQrInvalid(BranchQrFailure.qrInvalid, qr: qr);
    final skew = policy.value.futureSkewSeconds;
    final grace = qr.rotating ? rotatingGraceSeconds : 0;
    if (qr.iat > scanS + skew || scanS > qr.exp + grace) {
      return BranchQrInvalid(BranchQrFailure.qrExpired, qr: qr);
    }
    return BranchQrValid(qr, branch);
  }

  static bool _keyUsable(CachedPassKey k, DateTime at) {
    if (k.status == 'active') return true;
    if (k.status != 'retired') return false;
    final until = k.validUntil == null ? null : DateTime.tryParse(k.validUntil!);
    return until != null && at.isBefore(until);
  }
}

/// Local, informational gym-entry pre-check (contract §2 step 7): the same
/// rules as the server's `gymEntryDenialForBranch`, evaluated against the
/// cached buckets "as of" the snapshot.
enum EntryDenial {
  /// Current subscription frozen (`membership_frozen`).
  frozen,
  /// Plan type without gym access (`gym_access_not_included`).
  gymAccessNotIncluded,
  /// No subscription, only transferred sessions — studio-only
  /// (server code `gym_access_not_included`; the app shows its
  /// studio-only message).
  transferOnly,
  /// Branch not in the subscription's allowed branches.
  branchNotIncluded,
}

const _gymAccessPlanTypes = {'monthly', 'annual', 'duration', 'duration_session'};

EntryDenial? gymEntryDenialCached(List<CachedMembership> buckets, String branchId) {
  CachedMembership? current;
  for (final b in buckets) {
    if (b.sourceType == 'subscription' && b.status == 'active' && b.paymentStatus == 'paid') {
      current = b;
      break;
    }
  }
  if (current != null) {
    if (current.freezeStatus == 'frozen') return EntryDenial.frozen;
    if (!_gymAccessPlanTypes.contains(current.planType)) {
      return EntryDenial.gymAccessNotIncluded;
    }
    final allowed = _branchList(current.allowedBranchIds);
    if (allowed.isNotEmpty && !allowed.contains(branchId)) {
      return EntryDenial.branchNotIncluded;
    }
    return null;
  }
  final hasTransfer = buckets.any((b) => b.sourceType == 'transfer' && b.status == 'active');
  return hasTransfer ? EntryDenial.transferOnly : null;
}

List<String> _branchList(String? json) {
  if (json == null || json.isEmpty) return const [];
  try {
    final v = jsonDecode(json);
    return v is List ? v.map((e) => e.toString()).toList() : const [];
  } catch (_) {
    return const [];
  }
}
