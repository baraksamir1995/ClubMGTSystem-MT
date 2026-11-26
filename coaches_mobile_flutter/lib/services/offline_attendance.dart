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

  /// The user the app is signed in as; set by [OfflineAttendance] on
  /// login/logout. The engine refuses to send another user's events (D9).
  String? signedInUserId;

  @override
  String? get authenticatedUserId => signedInUserId;

  @override
  Future<TransportResponse> send(String method, String path,
          {Map<String, String>? query, String? body}) =>
      _api.rawRequest(method, path, query: query, body: body);
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

  void onSessionReady(String userId, String gymId) {
    transport.signedInUserId = userId;
    manager.activate(userId: userId, gymId: gymId);
  }

  void onSignedOut() {
    transport.signedInUserId = null;
    manager.deactivate();
  }
}
