import 'package:clby_offline/clby_offline.dart';

import '../utils/env.dart';
import '../utils/logger.dart';
import 'api_service.dart';

/// [SyncTransport] over the coach app's [ApiService]. Uses
/// [ApiService.rawRequest], so a 401 from the offline endpoints pauses the
/// engine without clearing the session or touching queued events.
class CoachSyncTransport extends JsonSyncTransport {
  CoachSyncTransport(this._api);

  final ApiService _api;

  String? _userId;
  String? _token;

  /// Binds the transport to one signed-in user and THAT user's token
  /// (captured at session start). Synchronous, so user + token always
  /// change together.
  void bind(String userId, String? token) {
    _userId = userId;
    _token = token;
  }

  void unbind() {
    _userId = null;
    _token = null;
  }

  /// The engine refuses to send another user's events (D9); the base class
  /// re-checks this synchronously right before every request.
  @override
  String? get authenticatedUserId => _userId;

  @override
  Future<TransportResponse> send(String method, String path,
      {Map<String, String>? query, String? body}) {
    // Token captured synchronously, before any await (see JsonSyncTransport).
    final token = _token;
    return _api.rawRequest(method, path,
        bearerToken: token, query: query, body: body);
  }
}

/// Phase 1 wiring (no UI): one scoped offline store per signed-in coach.
/// Login → open + crash-recover + sync pending + readiness refresh;
/// logout → close (cached data wiped, pending events kept for this coach).
class OfflineAttendance {
  OfflineAttendance._(this.transport, this.manager);

  factory OfflineAttendance.create(ApiService api) {
    final transport = CoachSyncTransport(api);
    final manager = OfflineSessionManager(
      app: OfflineApp.coach,
      apiBase: Env.apiUrl,
      transport: transport,
      onError: (e, _) => appLog('[offline] $e'),
    )..attachLifecycle();
    return OfflineAttendance._(transport, manager);
  }

  final CoachSyncTransport transport;
  final OfflineSessionManager manager;

  /// Session restored / signed in with a valid token. Re-calling it for the
  /// same user (re-login, profile refresh) re-binds the fresh token and
  /// resumes a paused engine (`activate` → `resumeAfterAuth`).
  Future<void> onSessionReady(String userId, String gymId) async {
    final gen = _generation;
    String? token;
    try {
      token = await transport._api.authToken;
    } catch (_) {}
    // Signed out (or another session started) while reading the token:
    // never re-bind a stale user.
    if (gen != _generation) return;
    transport.bind(userId, token);
    await manager.activate(userId: userId, gymId: gymId);
  }

  void onSignedOut() {
    _generation++;
    transport.unbind();
    manager.deactivate();
  }

  int _generation = 0;
}
