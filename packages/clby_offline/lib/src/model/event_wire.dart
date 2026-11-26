import 'dart:convert';

import '../db/offline_database.dart';

/// Serialises an outbox row to the CONTRACT §1 wire shape.
extension OutboxEventWire on OutboxEvent {
  Map<String, Object?> toWireJson() {
    Object? meta;
    try {
      meta = jsonDecode(metadata);
    } catch (_) {
      meta = const <String, Object?>{};
    }
    return {
      'event_id': eventId,
      'kind': kind,
      'attendance_method': attendanceMethod,
      'gym_id': gymId,
      'branch_id': branchId,
      'member_id': memberId,
      'class_session_id': classSessionId,
      'studio_id': studioId,
      'service_assignment_id': serviceAssignmentId,
      'device_recorded_at': deviceRecordedAt,
      'device_timezone': deviceTimezone,
      'qr': qrRaw == null ? null : {'raw': qrRaw},
      'note': note,
      'metadata': meta is Map ? meta : const <String, Object?>{},
    };
  }

  /// Decoded server review flags (D2).
  List<String> get flagList {
    try {
      final v = jsonDecode(flags);
      return v is List ? v.map((e) => e.toString()).toList() : const [];
    } catch (_) {
      return const [];
    }
  }

  DateTime get deviceRecordedAtUtc =>
      DateTime.fromMillisecondsSinceEpoch(deviceRecordedAtMs, isUtc: true);
}

/// ISO-8601 with millisecond precision and the local UTC offset, e.g.
/// `2026-11-26T08:01:02.123+02:00` (Dart's toIso8601String omits the
/// offset for local times).
String formatWithOffset(DateTime t) {
  final local = t.isUtc ? t.toLocal() : t;
  return formatWithExplicitOffset(local, local.timeZoneOffset);
}

/// Formats wall-clock [t] (taken as already in the zone) with [offset].
String formatWithExplicitOffset(DateTime t, Duration offset) {
  String two(int v) => v.toString().padLeft(2, '0');
  String three(int v) => v.toString().padLeft(3, '0');
  final sign = offset.isNegative ? '-' : '+';
  final abs = offset.abs();
  final oh = two(abs.inHours);
  final om = two(abs.inMinutes.remainder(60));
  final y = t.year.toString().padLeft(4, '0');
  return '$y-${two(t.month)}-${two(t.day)}T${two(t.hour)}:${two(t.minute)}:'
      '${two(t.second)}.${three(t.millisecond)}$sign$oh:$om';
}
