import 'package:clby_offline/clby_offline.dart';

import '../utils/env.dart';
import '../utils/logger.dart';
import 'api_service.dart';

/// [SyncTransport] over the member app's [ApiService]. Uses
/// [ApiService.rawRequest], so a 401 from the offline endpoints pauses the
/// engine without running the app's session-revocation fan-out and without
/// touching queued events.
class MemberSyncTransport extends JsonSyncTransport {
  MemberSyncTransport(this._api);

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

/// Phase 1 wiring (no UI, no change to check-in/QR flows): one scoped,
/// encrypted offline store per signed-in member. Session ready → open +
/// crash-recover + sync pending + readiness refresh; sign-out / revoked
/// session → close (cached data wiped, pending events kept for this user).
class OfflineAttendance {
  OfflineAttendance._(this.transport, this.manager);

  static OfflineAttendance? _instance;

  /// Process-wide instance (ApiService state is static, so one transport
  /// serves every screen's ApiService).
  static OfflineAttendance get instance => _instance ??= _create();

  static OfflineAttendance _create() {
    final transport = MemberSyncTransport(ApiService());
    final manager = OfflineSessionManager(
      app: OfflineApp.member,
      apiBase: Env.apiUrl,
      transport: transport,
      onError: (e, _) => appLog('[offline] $e'),
      // Policy off → only the tiny /offline/status call; no /offline/me
      // download (nothing offline is offered then).
      bootstrapWhenDisabled: false,
    )..attachLifecycle();
    return OfflineAttendance._(transport, manager);
  }

  final MemberSyncTransport transport;
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

  /// Offline cold start (PHASE3 §4): reopen the LAST scope this member
  /// used online, binding the stored token (sync resumes when the network
  /// returns; a dead token only pauses the engine). Doesn't overwrite the
  /// last-scope record. Callers must have checked [offlineEntryBlock].
  Future<OfflineStore?> enterOffline(String userId, String gymId) async {
    final gen = _generation;
    String? token;
    try {
      token = await transport._api.authToken;
    } catch (_) {}
    if (gen != _generation) return null;
    transport.bind(userId, token);
    return manager.activate(userId: userId, gymId: gymId, rememberScope: false);
  }

  void onSignedOut() {
    _generation++;
    transport.unbind();
    manager.deactivate();
  }

  int _generation = 0;
}
