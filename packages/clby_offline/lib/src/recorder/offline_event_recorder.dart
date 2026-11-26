import 'dart:async';
import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:meta/meta.dart';
import 'package:uuid/uuid.dart';

import '../db/offline_database.dart';
import '../model/enums.dart';
import '../model/clock_offset.dart';
import '../model/event_wire.dart';
import '../model/policy_holder.dart';
import '../scope.dart';
import 'timezone.dart';

/// Input for [OfflineEventRecorder.record]. gym, actor, device and time are
/// filled in by the recorder — callers can't spoof them.
@immutable
class NewOfflineEvent {
  const NewOfflineEvent._({
    required this.kind,
    required this.memberId,
    this.method,
    this.branchId,
    this.classSessionId,
    this.studioId,
    this.serviceAssignmentId,
    this.qrRaw,
    this.note,
    this.metadata = const {},
  });

  /// Gym/class attendance (admin: manual | staff_qr; member: member_qr).
  factory NewOfflineEvent.attendance({
    required AttendanceMethod method,
    required String memberId,
    String? branchId,
    String? classSessionId,
    String? studioId,
    String? qrRaw,
    Map<String, Object?> metadata = const {},
  }) =>
      NewOfflineEvent._(
        kind: EventKind.attendance,
        method: method,
        memberId: memberId,
        branchId: branchId,
        classSessionId: classSessionId,
        studioId: studioId,
        qrRaw: qrRaw,
        metadata: metadata,
      );

  /// Coach PT/physio session (D5) — same as POST /coach/sessions/decrement.
  factory NewOfflineEvent.serviceSession({
    required String memberId,
    required String serviceAssignmentId,
    String? note,
    Map<String, Object?> metadata = const {},
  }) =>
      NewOfflineEvent._(
        kind: EventKind.serviceSession,
        memberId: memberId,
        serviceAssignmentId: serviceAssignmentId,
        note: note,
        metadata: metadata,
      );

  final EventKind kind;
  final AttendanceMethod? method;
  final String memberId;
  final String? branchId;
  final String? classSessionId;
  final String? studioId;
  final String? serviceAssignmentId;
  final String? qrRaw;
  final String? note;
  final Map<String, Object?> metadata;
}

/// Why a record request was refused before anything was written.
enum RecordRefusal {
  /// Server policy `enabled == false` (or never fetched).
  offlineDisabled,
  /// Policy disallows this method/kind offline, or this app/role can't
  /// record it (admin: manual/staff_qr; coach: service_session; member:
  /// member_qr).
  notAllowed,
  /// Malformed input (ids, missing QR/assignment, note/metadata size).
  invalidInput,
  /// Cached data older than max_data_age_hours and policy says `block`.
  cacheExpired,
  /// Member app: the member id isn't the signed-in member's own id.
  notSelf,
  /// The device clock, corrected by the last known server offset, puts the
  /// event outside the server's accept window (ahead by more than
  /// `future_skew_seconds`, or behind by more than `max_event_age_days`):
  /// the server would always reject it (CONTRACT §6.6). Fix the clock.
  clockSkew,
}

sealed class RecordOutcome {
  const RecordOutcome();
}

/// Written as `pending` — show "Saved locally — pending synchronization".
class RecordSaved extends RecordOutcome {
  const RecordSaved(this.event, {this.cacheExpired = false});
  final OutboxEvent event;
  /// Saved although the cache is stale (policy `warn`) — UI must warn.
  final bool cacheExpired;
}

/// Nothing written: an equivalent event already exists.
class RecordDuplicate extends RecordOutcome {
  const RecordDuplicate(this.reason, {this.existingEventId, this.existingAttendanceId});
  final LocalDuplicateReason reason;
  final String? existingEventId;
  /// Server attendance id when the duplicate is a cached server record.
  final String? existingAttendanceId;
}

enum LocalDuplicateReason {
  /// Identical event within [OfflineEventRecorder.antiDoubleTapWindow].
  doubleTap,
  /// Class rule: one per (member, class_session) — matches the server's
  /// existing `already_checked_in` rule (D1).
  classAlreadyCheckedIn,
}

class RecordRefused extends RecordOutcome {
  const RecordRefused(this.reason, this.message);
  final RecordRefusal reason;
  final String message;
}

/// Writes new offline events into the outbox.
///
/// Local duplicate rules (D1 — deliberately NOT a business duplicate
/// window for gym entry):
/// 1. **Anti-double-tap**: an *identical* event (same kind, member, method,
///    branch, class session, studio, assignment AND scanned QR text — a
///    valid scan right after a garbage one must record) recorded within
///    [antiDoubleTapWindow] (default **10 s**) that is pending, syncing or
///    synced → [RecordDuplicate] (`doubleTap`). Rejected events don't
///    count. 10 s covers double taps, double submits and a scanner firing
///    repeatedly on the same frame, while a genuine second entry by the
///    same member is always further apart than that.
/// 2. **Class rule**: when `class_session_id` is set, an existing
///    non-rejected outbox event or a cached server attendance for the same
///    (member, class_session) → [RecordDuplicate]
///    (`classAlreadyCheckedIn`).
/// Everything else (service-session 30-min guard, membership validity,
/// exhausted packs) is the server's call (CONTRACT §1–§2, D2).
class OfflineEventRecorder {
  OfflineEventRecorder({
    required this.db,
    required this.scope,
    required this.app,
    required this.deviceId,
    required this.policy,
    TimezoneResolver? timezone,
    DateTime Function()? now,
    this.antiDoubleTapWindow = defaultAntiDoubleTapWindow,
    this.onRecorded,
  })  : _tz = timezone ?? resolveDeviceTimezone,
        _now = now ?? DateTime.now;

  static const defaultAntiDoubleTapWindow = Duration(seconds: 10);
  static const maxNoteLength = 500;
  static const maxMetadataBytes = 4096;
  static const maxQrLength = 4096;

  final OfflineDatabase db;
  final OfflineScope scope;
  final OfflineApp app;
  final String deviceId;
  final PolicyHolder policy;
  final Duration antiDoubleTapWindow;
  /// Called after a successful write (the store kicks the engine).
  final void Function(OutboxEvent event)? onRecorded;

  final TimezoneResolver _tz;
  final DateTime Function() _now;

  static final _uuidRe = RegExp(
      r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$');

  Future<RecordOutcome> record(NewOfflineEvent input) async {
    final refusal = _validate(input) ?? _checkPolicy(input);
    if (refusal != null) return refusal;
    final notSelf = await _checkSelf(input);
    if (notSelf != null) return notSelf;

    // Staleness (policy: warn | block).
    final asOfRaw = await db.readMeta(SyncMetaKeys.asOf);
    final asOf = asOfRaw == null ? null : DateTime.tryParse(asOfRaw);
    final now = _now();
    final stale = asOf == null ||
        now.toUtc().difference(asOf.toUtc()) > policy.value.maxDataAge;
    if (stale && policy.value.blocksOnExpiredCache) {
      return const RecordRefused(RecordRefusal.cacheExpired,
          'Offline data is out of date — connect to refresh.');
    }

    // CONTRACT §6.6: refuse what the server will always reject.
    final offsetMs = await readServerClockOffsetMs(db);
    if (offsetMs != null) {
      final p = policy.value;
      final aheadMs = -offsetMs; // device − server
      if (aheadMs > p.futureSkewSeconds * 1000) {
        return RecordRefused(RecordRefusal.clockSkew,
            'This device clock is ${_fmt(aheadMs)} ahead of the server. '
            'Correct the date/time and try again.');
      }
      if (-aheadMs > p.maxEventAgeDays * Duration.millisecondsPerDay) {
        return RecordRefused(RecordRefusal.clockSkew,
            'This device clock is ${_fmt(-aheadMs)} behind the server. '
            'Correct the date/time and try again.');
      }
    }

    final tz = await _safeTz();
    final local = now.isUtc ? now.toLocal() : now;
    final eventId = const Uuid().v4();
    final meta = <String, Object?>{
      ...input.metadata,
      'cache_as_of': ?asOfRaw,
      // Evidence only (never trusted): offset known at record time.
      'server_clock_offset_ms': ?offsetMs,
    };

    final outcome = await db.transaction<RecordOutcome>(() async {
      final dup = await _findDuplicate(input, local);
      if (dup != null) return dup;
      await db.into(db.outboxEvents).insert(OutboxEventsCompanion.insert(
            eventId: eventId,
            kind: input.kind.wire,
            attendanceMethod: Value(input.method?.wire),
            gymId: scope.gymId,
            branchId: Value(input.branchId),
            memberId: input.memberId,
            classSessionId: Value(input.classSessionId),
            studioId: Value(input.studioId),
            serviceAssignmentId: Value(input.serviceAssignmentId),
            deviceRecordedAt: formatWithOffset(local),
            deviceRecordedAtMs: local.millisecondsSinceEpoch,
            deviceTimezone: tz,
            qrRaw: Value(input.qrRaw),
            note: Value(input.note),
            metadata: Value(jsonEncode(meta)),
            actorUserId: scope.userId,
            actorType: app.wire,
            deviceId: deviceId,
            createdAt: DateTime.now().toUtc().microsecondsSinceEpoch,
          ));
      final row = await (db.select(db.outboxEvents)
            ..where((t) => t.eventId.equals(eventId)))
          .getSingle();
      return RecordSaved(row, cacheExpired: stale);
    });
    if (outcome is RecordSaved) onRecorded?.call(outcome.event);
    return outcome;
  }

  // ── Checks ─────────────────────────────────────────────────────────────

  RecordRefused? _validate(NewOfflineEvent e) {
    RecordRefused bad(String m) => RecordRefused(RecordRefusal.invalidInput, m);
    bool okId(String? v, {bool required = false}) =>
        v == null ? !required : _uuidRe.hasMatch(v);

    if (!okId(e.memberId, required: true)) return bad('member_id must be a UUID');
    if (!okId(e.branchId)) return bad('branch_id must be a UUID');
    if (!okId(e.classSessionId)) return bad('class_session_id must be a UUID');
    if (!okId(e.studioId)) return bad('studio_id must be a UUID');
    if (e.kind == EventKind.attendance) {
      if (e.method == null) return bad('attendance_method is required');
      if (e.serviceAssignmentId != null) {
        return bad('service_assignment_id is only for service_session');
      }
      if (e.method == AttendanceMethod.memberQr &&
          (e.qrRaw == null || e.qrRaw!.trim().isEmpty)) {
        return bad('member_qr requires the scanned QR text');
      }
    } else {
      if (!okId(e.serviceAssignmentId, required: true)) {
        return bad('service_assignment_id must be a UUID');
      }
      if (e.method != null || e.classSessionId != null || e.studioId != null) {
        return bad('service_session carries no attendance fields');
      }
    }
    if (e.qrRaw != null && e.qrRaw!.length > maxQrLength) return bad('qr too long');
    if (e.note != null && e.note!.length > maxNoteLength) {
      return bad('note longer than $maxNoteLength characters');
    }
    try {
      if (utf8.encode(jsonEncode(e.metadata)).length > maxMetadataBytes) {
        return bad('metadata larger than 4 KB');
      }
    } catch (_) {
      return bad('metadata is not JSON-encodable');
    }
    return null;
  }

  RecordRefused? _checkPolicy(NewOfflineEvent e) {
    final p = policy.value;
    if (!p.enabled) {
      return const RecordRefused(
          RecordRefusal.offlineDisabled, 'Offline attendance is disabled.');
    }
    RecordRefused no(String m) => RecordRefused(RecordRefusal.notAllowed, m);
    switch (app) {
      case OfflineApp.admin:
        if (e.kind != EventKind.attendance ||
            e.method == AttendanceMethod.memberQr) {
          return no('Staff record manual or staff_qr attendance only.');
        }
      case OfflineApp.coach:
        if (e.kind != EventKind.serviceSession) {
          return no('Coaches record service sessions only.');
        }
      case OfflineApp.member:
        if (e.method != AttendanceMethod.memberQr) {
          return no('Members check in by scanning the gym QR only.');
        }
    }
    if (e.kind == EventKind.serviceSession && !p.allowServiceSessionOffline) {
      return no('Offline service sessions are disabled.');
    }
    if (e.method == AttendanceMethod.manual && !p.allowManualOffline) {
      return no('Offline manual attendance is disabled.');
    }
    if (e.method == AttendanceMethod.staffQr && !p.allowStaffQrOffline) {
      return no('Offline staff QR attendance is disabled.');
    }
    if (e.method == AttendanceMethod.memberQr && !p.allowMemberQrOffline) {
      return no('Offline member check-in is disabled.');
    }
    return null;
  }

  Future<RecordRefused?> _checkSelf(NewOfflineEvent e) async {
    if (app != OfflineApp.member) return null;
    final raw = await db.readMeta(SyncMetaKeys.member);
    if (raw == null) return null; // server enforces not_self anyway
    try {
      final m = jsonDecode(raw);
      final own = m is Map ? m['gym_member_id']?.toString() : null;
      if (own != null && own != e.memberId) {
        return const RecordRefused(
            RecordRefusal.notSelf, 'Members can only check themselves in.');
      }
    } catch (_) {}
    return null;
  }

  Future<RecordDuplicate?> _findDuplicate(
      NewOfflineEvent e, DateTime local) async {
    // 1. anti-double-tap
    final nowMs = local.millisecondsSinceEpoch;
    final w = antiDoubleTapWindow.inMilliseconds;
    final q = db.select(db.outboxEvents)
      ..where((t) =>
          t.kind.equals(e.kind.wire) &
          t.memberId.equals(e.memberId) &
          t.actorUserId.equals(scope.userId) &
          t.syncStatus.isIn(const ['pending', 'syncing', 'synced']) &
          t.deviceRecordedAtMs.isBetweenValues(nowMs - w, nowMs + w) &
          _nullableEq(t.attendanceMethod, e.method?.wire) &
          _nullableEq(t.branchId, e.branchId) &
          _nullableEq(t.classSessionId, e.classSessionId) &
          _nullableEq(t.studioId, e.studioId) &
          _nullableEq(t.serviceAssignmentId, e.serviceAssignmentId) &
          _nullableEq(t.qrRaw, e.qrRaw))
      ..orderBy([(t) => OrderingTerm.desc(t.deviceRecordedAtMs)])
      ..limit(1);
    final tap = await q.getSingleOrNull();
    if (tap != null) {
      return RecordDuplicate(LocalDuplicateReason.doubleTap,
          existingEventId: tap.eventId, existingAttendanceId: tap.officialId);
    }

    // 2. class rule (member, class_session)
    final cs = e.classSessionId;
    if (e.kind == EventKind.attendance && cs != null) {
      final local = await (db.select(db.outboxEvents)
            ..where((t) =>
                t.kind.equals(EventKind.attendance.wire) &
                t.memberId.equals(e.memberId) &
                t.classSessionId.equals(cs) &
                t.syncStatus.isNotValue(OutboxStatus.rejected.wire))
            ..limit(1))
          .getSingleOrNull();
      if (local != null) {
        return RecordDuplicate(LocalDuplicateReason.classAlreadyCheckedIn,
            existingEventId: local.eventId,
            existingAttendanceId: local.officialId);
      }
      final server = await (db.select(db.cachedRecentAttendance)
            ..where((t) =>
                t.gymMemberId.equals(e.memberId) & t.classSessionId.equals(cs))
            ..limit(1))
          .getSingleOrNull();
      if (server != null) {
        return RecordDuplicate(LocalDuplicateReason.classAlreadyCheckedIn,
            existingAttendanceId: server.attendanceId);
      }
    }
    return null;
  }

  static String _fmt(int ms) {
    final d = Duration(milliseconds: ms);
    if (d.inDays >= 1) return '${d.inDays} d ${d.inHours.remainder(24)} h';
    if (d.inHours >= 1) return '${d.inHours} h ${d.inMinutes.remainder(60)} min';
    return '${d.inMinutes} min';
  }

  Expression<bool> _nullableEq(GeneratedColumn<String> c, String? v) =>
      v == null ? c.isNull() : c.equals(v);

  Future<String> _safeTz() async {
    try {
      final tz = await _tz();
      if (tz.isNotEmpty) return tz;
    } catch (_) {}
    return fallbackTimezone(_now());
  }
}
