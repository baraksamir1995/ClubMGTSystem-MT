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

  /// The user the app is signed in as; set by [OfflineAttendance] on
  /// session-ready / sign-out. The engine refuses to send another user's
  /// events (D9).
  String? signedInUserId;

  @override
  String? get authenticatedUserId => signedInUserId;

  @override
  Future<TransportResponse> send(String method, String path,
          {Map<String, String>? query, String? body}) =>
      _api.rawRequest(method, path, query: query, body: body);
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
    )..attachLifecycle();
    return OfflineAttendance._(transport, manager);
  }

  final MemberSyncTransport transport;
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
