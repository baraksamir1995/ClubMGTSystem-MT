import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:meta/meta.dart';

/// Which client app (and therefore which server role snapshot) a store
/// belongs to. Sent as `X-App` and in the sync envelope (`app`).
enum OfflineApp {
  admin('admin'),
  coach('coach'),
  member('member');

  const OfflineApp(this.wire);
  final String wire;
}

/// Storage scope: one local store per (api base, gym, user) — CONTRACT §5.
///
/// Every scope gets its own database FILE and its own encryption key, so
/// two users / gyms / environments on one device can never read each
/// other's cache or outbox, and an engine built for scope X can only ever
/// see (and therefore sync) scope X's events (D9).
@immutable
class OfflineScope {
  OfflineScope({
    required String apiBase,
    required this.gymId,
    required this.userId,
  }) : apiBase = normalizeApiBase(apiBase) {
    if (gymId.isEmpty) throw ArgumentError.value(gymId, 'gymId');
    if (userId.isEmpty) throw ArgumentError.value(userId, 'userId');
  }

  final String apiBase;
  final String gymId;
  final String userId;

  /// sha256(apiBase|gymId|userId), hex. Stable across app versions — it
  /// names the DB file and the key-store entry, so NEVER change the recipe.
  String get key =>
      sha256.convert(utf8.encode('$apiBase|$gymId|$userId')).toString();

  /// File name of this scope's database (no ids leak into the file system).
  String get databaseFileName => 'clby_offline_${key.substring(0, 32)}.sqlite';

  /// Secure-storage entry name holding this scope's DB key.
  String get keyStoreEntry => 'clby_offline_dbkey_v1_${key.substring(0, 32)}';

  static String normalizeApiBase(String base) {
    var b = base.trim().toLowerCase();
    while (b.endsWith('/')) {
      b = b.substring(0, b.length - 1);
    }
    return b;
  }

  @override
  bool operator ==(Object other) =>
      other is OfflineScope &&
      other.apiBase == apiBase &&
      other.gymId == gymId &&
      other.userId == userId;

  @override
  int get hashCode => Object.hash(apiBase, gymId, userId);

  @override
  String toString() => 'OfflineScope(${key.substring(0, 8)}…)';
}
