import 'dart:async';
import 'dart:io';

import 'package:clby_offline/clby_offline.dart';
import 'package:http/http.dart' as http;

import '../../services/api_service.dart';

/// Why the cold-start profile load failed.
enum LoadErrorKind {
  /// No connection / DNS / TLS / timeout / 5xx — the ONLY kind that may
  /// open offline mode (PHASE3-CONTRACT §4).
  network,
  /// 401 — session gone → the existing sign-in flow.
  unauthorized,
  /// 403 — access blocked → never offline mode; the engine is paused.
  forbidden,
  /// Anything else — existing behaviour.
  other,
}

LoadErrorKind classifyLoadError(Object e) {
  if (e is ApiException) {
    if (e.statusCode == 401) return LoadErrorKind.unauthorized;
    if (e.statusCode == 403) return LoadErrorKind.forbidden;
    if (e.statusCode >= 500) return LoadErrorKind.network;
    return LoadErrorKind.other;
  }
  if (e is SocketException ||
      e is TimeoutException ||
      e is http.ClientException ||
      e is HandshakeException) {
    return LoadErrorKind.network;
  }
  return LoadErrorKind.other;
}

/// Should the app TRY offline mode now? Only a signed-in member (user id
/// restored from secure storage) whose profile could not be loaded because
/// of a NETWORK failure, and who isn't a guest.
bool shouldTryOfflineMode({
  required String? userId,
  required bool hasProfile,
  required bool isLoading,
  required bool isGuest,
  required LoadErrorKind? profileError,
}) =>
    userId != null &&
    !hasProfile &&
    !isLoading &&
    !isGuest &&
    profileError == LoadErrorKind.network;

/// How a scanned code is handled (PHASE3-CONTRACT §4).
enum ScanPath {
  /// v2 branch QR + `enabled && allow_member_qr_offline` + store open →
  /// verify offline, pre-check, record in the outbox (synced immediately
  /// when online).
  outbox,
  /// App is in offline mode but this code can't be handled offline (v1 QR,
  /// policy off, no store) → clear "not available offline" message.
  unavailableOffline,
  /// Everything else → today's online flow, unchanged.
  legacy,
}

ScanPath chooseScanPath({
  required bool claimsV2,
  required bool policyAllows,
  required bool storeOpen,
  required bool offlineMode,
}) {
  if (claimsV2 && policyAllows && storeOpen) return ScanPath.outbox;
  if (offlineMode) return ScanPath.unavailableOffline;
  return ScanPath.legacy;
}

/// `enabled && allow_member_qr_offline`.
bool memberQrOfflineAllowed(OfflinePolicy p) => p.enabled && p.allowMemberQrOffline;

/// Fix (verification MEDIUM): the cached membership / package pre-check
/// may only deny when the phone is actually offline. Online, a stale
/// snapshot must never block a member — the event is recorded and synced
/// at once, and the server decides.
bool shouldRunLocalPreCheck({required bool offlineMode, required bool online}) =>
    offlineMode || !online;

/// Fix (verification LOW): with offline check-in off for the gym, no new
/// UI appears (no status chip, no dimming, no extra Profile row).
bool shouldShowStatus({
  required bool policyAllows,
  required bool offlineMode,
  required bool online,
  required int pending,
  required bool failing,
}) =>
    policyAllows && (offlineMode || !online || pending > 0 || failing);
