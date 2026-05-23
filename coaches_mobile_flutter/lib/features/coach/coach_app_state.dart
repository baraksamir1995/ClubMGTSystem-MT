import 'dart:async';
import 'package:flutter/foundation.dart';
import '../../services/api_service.dart';
import 'models.dart';

/// Top-level coach state for the authenticated specialist.
///
/// Replaces the original in-memory mock with API-backed data:
///  - `identity` from `GET /api/coach/me`
///  - `assignments` from `GET /api/coach/roster`
///  - `todayLog` from `GET /api/coach/today`
///
/// Optimistic decrements via [confirmSession] update the local copy
/// before the server response so the UI feels instant; on a 30-min-guard
/// 409 we surface a [RecentlyLoggedException] for the QR sheet to switch
/// to the blocked state.
class CoachAppState extends ChangeNotifier {
  final ApiService _api;

  CoachAppState(this._api);

  CoachIdentity? _identity;
  List<CoachAssignment> _assignments = const [];
  List<TodayLogEntry> _todayLog = const [];

  bool _loading = false;
  String? _error;

  CoachIdentity? get identity => _identity;
  List<CoachAssignment> get assignments => _assignments;
  List<TodayLogEntry> get todayLog => _todayLog;
  bool get isLoading => _loading;
  String? get error => _error;

  /// First/repeat load — pulls identity + roster + today in parallel.
  Future<void> load() async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final results = await Future.wait<dynamic>([
        _api.getCoachIdentity(),
        _api.getCoachRoster(),
        _api.getCoachToday(),
      ]);
      _identity = results[0] as CoachIdentity;
      _assignments = results[1] as List<CoachAssignment>;
      _todayLog = results[2] as List<TodayLogEntry>;
    } on ApiException catch (e) {
      _error = e.message;
    } catch (e) {
      _error = 'Could not reach the gym server.';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Pull-to-refresh on tab content. Doesn't toggle the global loading
  /// flag (which is for the splash-style initial fetch) — UI uses the
  /// returned future for its own indicator.
  Future<void> refreshRoster() async {
    try {
      _assignments = await _api.getCoachRoster();
      notifyListeners();
    } on ApiException {
      // Keep the prior list visible; surfacing the error here would
      // flash an error state over working data.
    }
  }

  Future<void> refreshToday() async {
    try {
      _todayLog = await _api.getCoachToday();
      notifyListeners();
    } on ApiException {
      // Same trade-off — keep stale data on refresh failure.
    }
  }

  CoachAssignment? assignmentById(String id) {
    for (final a in _assignments) {
      if (a.assignmentId == id) return a;
    }
    return null;
  }

  /// Confirm a delivered session. Optimistically updates the assignment
  /// + appends to today's log, then reconciles with the server's
  /// authoritative remaining count.
  ///
  /// Throws [RecentlyLoggedException] (with `minutesLeft`) when the
  /// server rejects with `code: recently_logged`, so the QR sheet can
  /// switch to its Blocked state.
  Future<void> confirmSession({
    required String assignmentId,
    String? note,
  }) async {
    final idx = _assignments.indexWhere((a) => a.assignmentId == assignmentId);
    if (idx < 0) {
      throw ApiException(statusCode: 404, message: 'Assignment not found');
    }
    final before = _assignments[idx];
    final optimistic = before.withDecrement();

    // Optimistic update — keep the previous list so we can roll back.
    final prevAssignments = List<CoachAssignment>.from(_assignments);
    _assignments = List<CoachAssignment>.from(_assignments)..[idx] = optimistic;
    notifyListeners();

    try {
      final res = await _api.decrementSession(
        assignmentId: assignmentId,
        note: note,
      );
      // Reconcile with the server's authoritative remaining count.
      final serverUsed = (res['sessions_used'] as num?)?.toInt() ?? optimistic.sessionsUsed;
      final serverRem = (res['sessions_remaining'] as num?)?.toInt() ?? optimistic.sessionsRemaining;
      final completed = (res['completed'] as bool?) ?? optimistic.state == AssignmentState.inactive;
      _assignments = List<CoachAssignment>.from(_assignments)
        ..[idx] = CoachAssignment(
          assignmentId: optimistic.assignmentId,
          status: completed ? 'completed' : optimistic.status,
          state: completed
              ? AssignmentState.inactive
              : (serverRem < 3 ? AssignmentState.low : AssignmentState.active),
          reason: completed ? 'completed' : optimistic.reason,
          sessionsTotal: optimistic.sessionsTotal,
          sessionsUsed: serverUsed,
          sessionsRemaining: serverRem,
          serviceType: optimistic.serviceType,
          packageName: optimistic.packageName,
          assignedAt: optimistic.assignedAt,
          expiresAt: optimistic.expiresAt,
          lastSessionAt: optimistic.lastSessionAt,
          member: optimistic.member,
        );
      // Refresh today's log so the new row appears in the Log tab.
      // Don't await — the UI doesn't block on it.
      unawaited(refreshToday());
      notifyListeners();
    } on ApiException catch (e) {
      // Rollback optimistic update.
      _assignments = prevAssignments;
      notifyListeners();

      if (e.code == 'recently_logged') {
        final minutesLeft = (e.extra?['minutes_left'] as num?)?.toInt() ?? 1;
        throw RecentlyLoggedException(minutesLeft: minutesLeft, original: e);
      }
      rethrow;
    }
  }

  /// Update a delivered-session note. Used by the editable history rows
  /// on Member Detail and the per-session card on the today log.
  Future<void> updateSessionNote({
    required String logId,
    required String? note,
  }) async {
    await _api.updateSessionNote(logId: logId, note: note);
    // Reflect locally so the screens that pull from `todayLog` update
    // without a round-trip.
    _todayLog = [
      for (final t in _todayLog)
        if (t.logId == logId)
          TodayLogEntry(
            logId: t.logId,
            deliveredAt: t.deliveredAt,
            note: note,
            assignmentId: t.assignmentId,
            packageName: t.packageName,
            serviceType: t.serviceType,
            sessionsTotal: t.sessionsTotal,
            sessionsRemaining: t.sessionsRemaining,
            member: t.member,
          )
        else
          t,
    ];
    notifyListeners();
  }

  /// Per-assignment session history. Not cached — Member Detail's
  /// FutureBuilder pulls fresh each open.
  Future<List<AssignmentHistoryItem>> assignmentHistory(String assignmentId) {
    return _api.getAssignmentHistory(assignmentId);
  }

  /// Reset on logout so the next coach starts fresh.
  void clear() {
    _identity = null;
    _assignments = const [];
    _todayLog = const [];
    _loading = false;
    _error = null;
    notifyListeners();
  }
}

/// Surfaced to the QR sheet when the server's 30-min guard rejects a
/// decrement. The sheet uses [minutesLeft] for the blocked-state copy.
class RecentlyLoggedException implements Exception {
  final int minutesLeft;
  final ApiException original;
  const RecentlyLoggedException({
    required this.minutesLeft,
    required this.original,
  });
}
