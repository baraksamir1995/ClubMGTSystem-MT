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
/// * never wipe app state or the outbox on a 401 from these endpoints.
abstract class SyncTransport {
  /// The profile id the transport's token belongs to, or null when signed
  /// out. The engine refuses to send scope X's events with any other
  /// user's token (D9).
  String? get authenticatedUserId;

  /// `POST /api/attendance/sync`.
  Future<SyncResponse> sync(SyncRequest request);

  /// `GET /api/attendance/offline/bootstrap?cursor=&limit=` (staff/coach).
  Future<SnapshotPage> bootstrapPage({String? cursor, int? limit});

  /// `GET /api/attendance/offline/me` (member).
  Future<SnapshotPage> me();

  /// `GET /api/attendance/offline/status?device_id=`.
  Future<OfflineStatusResponse> status({required String deviceId});
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

/// 403 on the envelope. [deviceRevoked] when the server says the device is
/// revoked / bound to another user. Engine pauses either way.
class SyncForbidden extends SyncTransportException {
  const SyncForbidden(super.message, {this.code, this.deviceRevoked = false});
  final String? code;
  final bool deviceRevoked;
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
  const SyncRequestError(this.statusCode, super.message, {this.code});
  final int statusCode;
  final String? code;
}

/// Raw HTTP result returned by [JsonSyncTransport.send].
class TransportResponse {
  const TransportResponse(this.statusCode, this.body, {this.headers = const {}});
  final int statusCode;
  final String body;
  /// Lower-case header names.
  final Map<String, String> headers;
}

/// 403 error codes that mean "this device may not sync for this user".
const deviceRevokedCodes = {
  'device_revoked',
  'device_bound_to_other_user',
  'device_bound_to_another_user',
  'device_mismatch',
};

/// Convenience base: implement [send] with the app's HTTP client (adding
/// auth + `X-*` headers) and get JSON parsing + status → typed-exception
/// mapping for free. [send] must NOT run the app's global 401 handler.
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
  Future<SyncResponse> sync(SyncRequest request) async => SyncResponse.fromJson(
      await _json('POST', syncPath, body: jsonEncode(request.toJson())));

  @override
  Future<SnapshotPage> bootstrapPage({String? cursor, int? limit}) async =>
      SnapshotPage(await _json('GET', bootstrapPath, query: {
        'cursor': ?cursor,
        if (limit != null) 'limit': '$limit',
      }));

  @override
  Future<SnapshotPage> me() async => SnapshotPage(await _json('GET', mePath));

  @override
  Future<OfflineStatusResponse> status({required String deviceId}) async =>
      OfflineStatusResponse.fromJson(
          await _json('GET', statusPath, query: {'device_id': deviceId}));

  Future<Map<String, Object?>> _json(String method, String path,
      {Map<String, String>? query, String? body}) async {
    final TransportResponse r;
    try {
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
    if (s == 403) {
      throw SyncForbidden(msg,
          code: code, deviceRevoked: deviceRevokedCodes.contains(code));
    }
    if (s == 429) {
      final ra = int.tryParse(r.headers['retry-after'] ?? '');
      throw SyncRateLimited(retryAfter: ra == null ? null : Duration(seconds: ra));
    }
    if (s == 408) throw SyncTimeout(msg);
    if (s >= 500) throw SyncServerError(s, msg);
    throw SyncRequestError(s, msg, code: code);
  }
}
