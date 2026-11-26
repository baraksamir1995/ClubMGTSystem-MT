import 'package:meta/meta.dart';

import 'enums.dart';

/// Body of `POST /api/attendance/sync` (CONTRACT §2).
@immutable
class SyncRequest {
  const SyncRequest({
    required this.deviceId,
    required this.app,
    required this.appVersion,
    required this.events,
  });

  final String deviceId;
  /// `admin` | `coach` | `member`
  final String app;
  final String appVersion;
  /// Wire-format events (CONTRACT §1), 1..50, distinct event_id.
  final List<Map<String, Object?>> events;

  List<String> get eventIds =>
      events.map((e) => e['event_id'] as String).toList(growable: false);

  Map<String, Object?> toJson() => {
        'device_id': deviceId,
        'app': app,
        'app_version': appVersion,
        'events': events,
      };
}

/// One per-event result (CONTRACT §2).
@immutable
class SyncEventResult {
  const SyncEventResult({
    required this.eventId,
    required this.status,
    this.rawStatus,
    this.code,
    this.message,
    this.attendanceId,
    this.serviceLogId,
    this.flags = const [],
    this.serverReceivedAt,
    this.processedAt,
    this.retryable = false,
  });

  final String eventId;
  final ResultStatus status;
  final String? rawStatus;
  final String? code;
  final String? message;
  final String? attendanceId;
  final String? serviceLogId;
  final List<String> flags;
  final String? serverReceivedAt;
  final String? processedAt;
  final bool retryable;

  String? get officialId => attendanceId ?? serviceLogId;

  factory SyncEventResult.fromJson(Map<String, Object?> j) => SyncEventResult(
        eventId: j['event_id']?.toString() ?? '',
        status: ResultStatus.fromWire(j['status']),
        rawStatus: j['status']?.toString(),
        code: j['code']?.toString(),
        message: j['message']?.toString(),
        attendanceId: j['attendance_id']?.toString(),
        serviceLogId: j['service_log_id']?.toString(),
        flags: (j['flags'] is List)
            ? (j['flags'] as List).map((e) => e.toString()).toList()
            : const [],
        serverReceivedAt: j['server_received_at']?.toString(),
        processedAt: j['processed_at']?.toString(),
        retryable: j['retryable'] == true,
      );
}

/// 200 response of `POST /api/attendance/sync`.
@immutable
class SyncResponse {
  const SyncResponse({this.serverTime, required this.results});

  final String? serverTime;
  final List<SyncEventResult> results;

  factory SyncResponse.fromJson(Map<String, Object?> j) => SyncResponse(
        serverTime: j['server_time']?.toString(),
        results: (j['results'] is List)
            ? (j['results'] as List)
                .whereType<Map>()
                .map((m) => SyncEventResult.fromJson(m.cast<String, Object?>()))
                .toList()
            : const [],
      );
}

/// `GET /api/attendance/offline/status` (CONTRACT §3).
@immutable
class OfflineStatusResponse {
  const OfflineStatusResponse({
    this.serverTime,
    required this.enabled,
    required this.policy,
    required this.deviceRegistered,
    required this.deviceRevoked,
  });

  final String? serverTime;
  final bool enabled;
  final Map<String, Object?> policy;
  final bool deviceRegistered;
  final bool deviceRevoked;

  factory OfflineStatusResponse.fromJson(Map<String, Object?> j) {
    final d = j['device'] is Map ? (j['device'] as Map) : const {};
    return OfflineStatusResponse(
      serverTime: j['server_time']?.toString(),
      enabled: j['enabled'] == true,
      policy: j['policy'] is Map
          ? (j['policy'] as Map).cast<String, Object?>()
          : const {},
      deviceRegistered: d['registered'] == true,
      deviceRevoked: d['revoked'] == true,
    );
  }
}

/// One page of `GET /api/attendance/offline/bootstrap` (staff or coach
/// shape) or the whole `GET /api/attendance/offline/me` (member shape).
/// Kept as maps: the importer reads the fields it needs and tolerates
/// additions.
@immutable
class SnapshotPage {
  const SnapshotPage(this.json);

  final Map<String, Object?> json;

  String? get serverTime => json['server_time']?.toString();
  String? get asOf => json['as_of']?.toString();
  String? get nextCursor {
    final c = json['next_cursor'];
    return (c == null || c.toString().isEmpty) ? null : c.toString();
  }

  Map<String, Object?>? get gym => _map('gym');
  Map<String, Object?>? get policy => _map('policy');
  Map<String, Object?>? get member => _map('member');

  List<Map<String, Object?>> list(String key) {
    final v = json[key];
    if (v is! List) return const [];
    return v.whereType<Map>().map((m) => m.cast<String, Object?>()).toList();
  }

  Map<String, Object?>? _map(String k) =>
      json[k] is Map ? (json[k] as Map).cast<String, Object?>() : null;
}
