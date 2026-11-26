import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../model/sync_models.dart';

/// HTTP endpoints the engine/bootstrap need (CONTRACT §2–§3). Each app
/// implements it on top of its own HTTP client + token — the package never
/// owns auth. Most apps should extend [JsonSyncTransport] and only
/// implement [JsonSyncTransport.send].
///
/// Implementations MUST:
/// * throw the typed [SyncTransportException]s below (never a raw
///   SocketException) so the engine can decide retry vs pause;
/// * never wipe app state or the outbox on a 401 from these endpoints;
/// * when `asUserId` is given, send with THAT user's token or not at all
///   (throw [SyncUserChanged]) — scope X's events/cache must never travel
///   with another account's token (D9, PHASE1-VERIFICATION MEDIUM-4).
abstract class SyncTransport {
  /// The profile id the transport's token belongs to, or null when signed
  /// out. The engine refuses to send scope X's events with any other
  /// user's token (D9).
  String? get authenticatedUserId;

  /// `POST /api/attendance/sync`.
  Future<SyncResponse> sync(SyncRequest request, {String? asUserId});

  /// `GET /api/attendance/offline/bootstrap?cursor=&limit=` (staff/coach).
  Future<SnapshotPage> bootstrapPage({String? cursor, int? limit, String? asUserId});

  /// `GET /api/attendance/offline/me` (member).
  Future<SnapshotPage> me({String? asUserId});

  /// `GET /api/attendance/offline/status?device_id=`.
  Future<OfflineStatusResponse> status({required String deviceId, String? asUserId});
}

// ── Typed errors ─────────────────────────────────────────────────────────

sealed class SyncTransportException implements Exception {
  const SyncTransportException(this.message);
  final String message;
  @override
  String toString() => '$runtimeType: $message';
}

/// 401 — token missing/expired/revoked. Engine pauses (`auth_required`).
class SyncAuthRequired extends SyncTransportException {
  const SyncAuthRequired([super.message = 'authentication required']);
}

/// 403 on the envelope. Engine pauses either way, with a distinct reason
/// per [code] (CONTRACT §6.1):
/// * `device_revoked` → [deviceRevoked];
/// * `device_mismatch` → [deviceMismatch] (same user, device id presented
///   for a different gym);
/// * anything else → plain forbidden.
class SyncForbidden extends SyncTransportException {
  const SyncForbidden(super.message, {this.code});
  final String? code;
  bool get deviceRevoked => code == 'device_revoked';
  bool get deviceMismatch => deviceMismatchCodes.contains(code);
}

/// The transport is no longer signed in as the user the request was made
/// for (account switch mid-pass). Nothing was sent; the engine aborts the
/// pass without touching events and without a sticky pause.
class SyncUserChanged extends SyncTransportException {
  const SyncUserChanged([super.message = 'signed-in user changed']);
}

/// 429. Honour [retryAfter] when present.
class SyncRateLimited extends SyncTransportException {
  const SyncRateLimited({this.retryAfter}) : super('rate limited');
  final Duration? retryAfter;
}

/// Request timed out — the server MAY have processed it. Never treated as
/// a rejection; events stay pending and are resent with the same ids.
class SyncTimeout extends SyncTransportException {
  const SyncTimeout([super.message = 'timeout']);
}

/// DNS / socket / TLS / connection failure.
class SyncNetworkError extends SyncTransportException {
  const SyncNetworkError(super.message);
}

/// 5xx (or an unparseable 2xx body).
class SyncServerError extends SyncTransportException {
  const SyncServerError(this.statusCode, super.message);
  final int statusCode;
}

/// Other 4xx on the envelope (422 bad envelope, 404 endpoint not deployed…).
class SyncRequestError extends SyncTransportException {
  const SyncRequestError(this.statusCode, super.message, {this.code, this.body});
  final int statusCode;
  final String? code;
  /// Decoded JSON body (422: Laravel `{message, errors:{field:[msg]}}`).
  final Map<String, Object?>? body;

  /// 422 validation errors that name specific events of the batch
  /// (`events.<index>[.<field>]`), as index → messages. Empty when the
  /// body doesn't single out events.
  Map<int, List<String>> get eventErrors {
    final errors = body?['errors'];
    if (statusCode != 422 || errors is! Map) return const {};
    final out = <int, List<String>>{};
    final re = RegExp(r'^events\.(\d+)(\.|$)');
    errors.forEach((k, v) {
      final m = re.firstMatch(k.toString());
      if (m == null) return;
      final i = int.parse(m.group(1)!);
      final msgs = v is List ? v.map((e) => e.toString()) : [v.toString()];
      (out[i] ??= []).addAll(msgs);
    });
    return out;
  }
}

/// Raw HTTP result returned by [JsonSyncTransport.send].
class TransportResponse {
  const TransportResponse(this.statusCode, this.body, {this.headers = const {}});
  final int statusCode;
  final String body;
  /// Lower-case header names.
  final Map<String, String> headers;
}

/// 403 codes meaning the device id is bound elsewhere for this user.
const deviceMismatchCodes = {
  'device_mismatch',
  'device_bound_to_other_user',
  'device_bound_to_another_user',
};

/// Convenience base: implement [send] with the app's HTTP client (adding
/// auth + `X-*` headers) and get JSON parsing + status → typed-exception
/// mapping for free. [send] must NOT run the app's global 401 handler.
///
/// User binding: before every request the base class checks, synchronously
/// and immediately before calling [send], that [authenticatedUserId] equals
/// `asUserId` (else [SyncUserChanged]). Implementations must therefore pick
/// the bearer token SYNCHRONOUSLY at the start of [send] (no `await`
/// before it), from the same binding that backs [authenticatedUserId].
abstract class JsonSyncTransport implements SyncTransport {
  /// Performs one HTTP request. `body` is JSON-encoded by the caller.
  /// Throw anything on network failure; it is mapped here
  /// (TimeoutException → [SyncTimeout], everything else → [SyncNetworkError]).
  Future<TransportResponse> send(
    String method,
    String path, {
    Map<String, String>? query,
    String? body,
  });

  static const syncPath = '/api/attendance/sync';
  static const bootstrapPath = '/api/attendance/offline/bootstrap';
  static const mePath = '/api/attendance/offline/me';
  static const statusPath = '/api/attendance/offline/status';

  @override
  Future<SyncResponse> sync(SyncRequest request, {String? asUserId}) async =>
      SyncResponse.fromJson(await _json('POST', syncPath,
          body: jsonEncode(request.toJson()), asUserId: asUserId));

  @override
  Future<SnapshotPage> bootstrapPage(
          {String? cursor, int? limit, String? asUserId}) async =>
      SnapshotPage(await _json('GET', bootstrapPath,
          query: {
            'cursor': ?cursor,
            if (limit != null) 'limit': '$limit',
          },
          asUserId: asUserId));

  @override
  Future<SnapshotPage> me({String? asUserId}) async =>
      SnapshotPage(await _json('GET', mePath, asUserId: asUserId));

  @override
  Future<OfflineStatusResponse> status(
          {required String deviceId, String? asUserId}) async =>
      OfflineStatusResponse.fromJson(await _json('GET', statusPath,
          query: {'device_id': deviceId}, asUserId: asUserId));

  Future<Map<String, Object?>> _json(String method, String path,
      {Map<String, String>? query, String? body, String? asUserId}) async {
    final TransportResponse r;
    try {
      // Synchronous check → send() (which must capture its token before
      // its first await): no gap for an account switch to slip into.
      if (asUserId != null && authenticatedUserId != asUserId) {
        throw const SyncUserChanged();
      }
      r = await send(method, path,
          query: (query == null || query.isEmpty) ? null : query, body: body);
    } on SyncTransportException {
      rethrow;
    } on TimeoutException catch (e) {
      throw SyncTimeout(e.message ?? 'timeout');
    } on SocketException catch (e) {
      throw SyncNetworkError(e.message);
    } on HandshakeException catch (e) {
      throw SyncNetworkError(e.message);
    } catch (e) {
      throw SyncNetworkError(e.toString());
    }
    return mapResponse(r);
  }

  /// Status-code → result/exception mapping (public for tests).
  static Map<String, Object?> mapResponse(TransportResponse r) {
    Object? decoded;
    try {
      decoded = r.body.isEmpty ? null : jsonDecode(r.body);
    } catch (_) {
      decoded = null;
    }
    final map = decoded is Map ? decoded.cast<String, Object?>() : null;
    final code = map?['code']?.toString();
    final msg =
        (map?['message'] ?? map?['error'])?.toString() ?? 'HTTP ${r.statusCode}';
    final s = r.statusCode;
    if (s >= 200 && s < 300) {
      if (map == null) throw SyncServerError(s, 'unparseable response body');
      return map;
    }
    if (s == 401) throw SyncAuthRequired(msg);
    if (s == 403) throw SyncForbidden(msg, code: code);
    if (s == 429) {
      final ra = int.tryParse(r.headers['retry-after'] ?? '');
      throw SyncRateLimited(retryAfter: ra == null ? null : Duration(seconds: ra));
    }
    if (s == 408) throw SyncTimeout(msg);
    if (s >= 500) throw SyncServerError(s, msg);
    throw SyncRequestError(s, msg, code: code, body: map);
  }
}
