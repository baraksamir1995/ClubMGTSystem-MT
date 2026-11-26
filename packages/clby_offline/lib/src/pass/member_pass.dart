import 'dart:convert';

import 'package:cryptography/dart.dart';
import 'package:cryptography/cryptography.dart';
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

  /// Contract step 1. Returns null when [raw] isn't a well-formed v1 member
  /// pass (any other QR, other `t`/`v`, missing / mistyped fields).
  static MemberPass? tryParse(String raw) {
    Object? j;
    try {
      j = jsonDecode(raw.trim());
    } catch (_) {
      return null;
    }
    if (j is! Map) return null;
    final Map<Object?, Object?> o = j;
    if (o['t'] != type || o['v'] != version) return null;
    String? str(String k) {
      final v = o[k];
      return (v is String && v.isNotEmpty) ? v : null;
    }

    final kid = str('kid'), g = str('g'), m = str('m'), sigRaw = str('sig');
    final iat = o['iat'], exp = o['exp'], n = o['n'];
    if (kid == null || g == null || m == null || sigRaw == null) return null;
    if (iat is! int || exp is! int) return null;
    if (!o.containsKey('n')) return null;
    final String nText;
    if (n == null) {
      nText = '';
    } else if (n is int) {
      nText = '$n';
    } else if (n is String) {
      nText = n;
    } else {
      return null;
    }
    final sig = decodeBase64Url(sigRaw);
    if (sig == null || sig.length != 64) return null;
    return MemberPass(
      kid: kid,
      gymId: g,
      memberId: m,
      memberNumber: nText,
      iat: iat,
      exp: exp,
      signature: sig,
      raw: raw,
    );
  }
}

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

  Future<PassVerdict> verify(String raw) async {
    // 1. parse
    final pass = MemberPass.tryParse(raw);
    if (pass == null) return const PassInvalid(PassFailure.qrInvalid);

    final serverNow = await serverClock.bestServerNow();

    // 2. key known (active, or retired and still within valid_until)
    final key = await (db.select(db.cachedPassKeys)
          ..where((t) => t.kid.equals(pass.kid)))
        .getSingleOrNull();
    if (key == null || !_keyUsable(key, serverNow)) {
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

    // 4. gym
    if (pass.gymId != gymId) return PassInvalid(PassFailure.qrWrongGym, pass: pass);

    // 5. time (server-clock estimate, CONTRACT §6.6)
    final nowS = serverNow.millisecondsSinceEpoch ~/ 1000;
    if (pass.exp <= nowS) return PassInvalid(PassFailure.passExpired, pass: pass);
    if (pass.iat > nowS + policy.value.futureSkewSeconds) {
      return PassInvalid(PassFailure.qrInvalid, pass: pass);
    }

    // 6. member in cache
    final member = await (db.select(db.cachedMembers)
          ..where((t) => t.gymMemberId.equals(pass.memberId)))
        .getSingleOrNull();
    final assignments = await (db.select(db.cachedAssignments)
          ..where((t) => t.gymMemberId.equals(pass.memberId)))
        .get();
    CachedMember? shown = member;
    if (shown == null && assignments.isNotEmpty) {
      final a = assignments.first;
      final name = a.memberName ?? '';
      shown = CachedMember(
        gymMemberId: pass.memberId,
        memberNumber: a.memberNumber,
        fullName: name,
        searchText: name.toLowerCase(),
        photoUrl: a.photoUrl,
      );
    }
    if (shown == null) return PassInvalid(PassFailure.memberNotFound, pass: pass);
    final memberships = await (db.select(db.cachedMemberships)
          ..where((t) => t.gymMemberId.equals(pass.memberId)))
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
