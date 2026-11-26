import 'dart:convert';

import 'package:meta/meta.dart';

import '../scope.dart';
import '../security/key_store.dart';

/// The last scope an app successfully opened ONLINE (user + gym + API),
/// kept so a later offline cold start can reopen that same store.
/// Stored in secure storage (not secret, but tied to the session).
@immutable
class LastOfflineScope {
  const LastOfflineScope({required this.apiBase, required this.gymId, required this.userId});

  final String apiBase;
  final String gymId;
  final String userId;

  OfflineScope toScope() => OfflineScope(apiBase: apiBase, gymId: gymId, userId: userId);

  static const storageKey = 'clby_offline_last_scope_v1';

  static Future<LastOfflineScope?> read([KeyStore store = const SecureKeyStore()]) async {
    try {
      final raw = (await readWithRetry(store, storageKey)).value;
      if (raw == null) return null;
      final j = jsonDecode(raw);
      if (j is! Map) return null;
      final a = j['api_base'], g = j['gym_id'], u = j['user_id'];
      if (a is! String || g is! String || u is! String) return null;
      if (a.isEmpty || g.isEmpty || u.isEmpty) return null;
      return LastOfflineScope(apiBase: a, gymId: g, userId: u);
    } catch (_) {
      return null;
    }
  }

  Future<void> write([KeyStore store = const SecureKeyStore()]) => store.write(
      storageKey,
      jsonEncode({
        'api_base': OfflineScope.normalizeApiBase(apiBase),
        'gym_id': gymId,
        'user_id': userId,
      }));
}

/// Why offline mode can't be entered on a cold start.
enum OfflineEntryBlock {
  /// No stored token / user: the coach must sign in (online).
  notSignedIn,
  /// No previous online session recorded on this device.
  noPreviousSession,
  /// The stored token belongs to a different user than the last scope.
  differentUser,
  /// The last scope was for another API (environment).
  differentApi,
  /// The store couldn't be opened (key unavailable etc.).
  storeUnavailable,
  /// The store has never been bootstrapped (nothing to work with).
  noCachedData,
}

/// Offline cold-start rule (PHASE2 coach app): allowed ONLY for the same
/// user whose token is in secure storage, for the scope that user last
/// opened online, against the same API, and only if that scope's store
/// opens with its own key and holds a snapshot. Returns null when allowed.
OfflineEntryBlock? offlineEntryBlock({
  required bool hasToken,
  required String? tokenUserId,
  required LastOfflineScope? last,
  required String apiBase,
  bool? storeOpened,
  bool? hasCachedData,
}) {
  if (!hasToken || tokenUserId == null || tokenUserId.isEmpty) {
    return OfflineEntryBlock.notSignedIn;
  }
  if (last == null) return OfflineEntryBlock.noPreviousSession;
  if (last.userId != tokenUserId) return OfflineEntryBlock.differentUser;
  if (OfflineScope.normalizeApiBase(last.apiBase) != OfflineScope.normalizeApiBase(apiBase)) {
    return OfflineEntryBlock.differentApi;
  }
  if (storeOpened == false) return OfflineEntryBlock.storeUnavailable;
  if (hasCachedData == false) return OfflineEntryBlock.noCachedData;
  return null;
}
