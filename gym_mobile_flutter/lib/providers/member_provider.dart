import 'package:flutter/material.dart';
import '../services/notification_service.dart';
import '../models/member_model.dart';
import '../models/membership_model.dart';
import '../models/membership_summary_model.dart';
import '../models/session_model.dart';
import '../models/attendance_model.dart';
import '../models/transfer_log.dart';
import '../models/grant_log.dart';
import '../models/notification_model.dart';
import '../models/payment_model.dart';
import '../services/api_service.dart';
import '../models/capacity_model.dart';
import '../models/booking_record_model.dart';
import '../models/invitation_model.dart';
import '../models/service_assignment_model.dart';
import '../utils/error_utils.dart';

class MemberProvider extends ChangeNotifier {
  final ApiService _service;

  GymMember? _member;
  MemberMembership? _currentMembership;
  MembershipSummary? _membershipSummary;
  List<Session> _sessions = [];
  List<BookingRecord> _myBookings = [];
  List<Attendance> _attendance = [];
  List<TransferLog> _transfers = [];
  List<GrantLog> _grants = [];
  List<GymNotification> _notifications = [];
  List<Payment> _payments = [];
  int _monthlyCheckIns = 0;
  // US-01-04: badge — count-based; clears when user opens the notifications screen
  int _readNotificationCount = 0;
  // Per-notification read state for the dot indicators and filter states
  final Set<String> _readNotificationIds = {};

  // True after AppBootstrap has finished its initial data load.
  // Screens check this to skip redundant initState fetches.
  bool _bootstrapped = false;

  bool _isLoadingMember = false;
  Future<void>? _memberLoadFuture;
  bool _isLoadingSessions = false;
  bool _isLoadingMyBookings = false;
  bool _isLoadingAttendance = false;
  bool _isLoadingTransfers = false;
  bool _isLoadingGrants = false;
  bool _isLoadingNotifications = false;
  bool _isLoadingPayments = false;

  GymCapacity? _capacity;
  bool _isLoadingCapacity = false;

  List<ServiceAssignment> _serviceAssignments = [];
  bool _isLoadingServices = false;

  List<GuestInvitation> _invitations = [];
  bool _isLoadingInvitations = false;
  String? _invitationsError;

  String? _memberError;
  String? _sessionsError;
  String? _myBookingsError;
  String? _attendanceError;
  String? _transfersError;
  String? _grantsError;
  String? _notificationsError;
  String? _paymentsError;

  MemberProvider(this._service);

  GymMember? get member => _member;
  MemberMembership? get currentMembership => _currentMembership;
  MembershipSummary? get membershipSummary => _membershipSummary;
  List<Session> get sessions => _sessions;
  List<BookingRecord> get myBookings => _myBookings;
  bool get isLoadingMyBookings => _isLoadingMyBookings;
  String? get myBookingsError => _myBookingsError;
  List<Attendance> get attendance => _attendance;
  List<TransferLog> get transfers => _transfers;
  bool get isLoadingTransfers => _isLoadingTransfers;
  String? get transfersError => _transfersError;
  List<GrantLog> get grants => _grants;
  bool get isLoadingGrants => _isLoadingGrants;
  String? get grantsError => _grantsError;
  List<GymNotification> get notifications => _notifications;
  // US-01-04: true when new notifications arrived since last visit
  bool get hasUnreadNotifications =>
      _notifications.length > _readNotificationCount;

  // US-01-04: called when user opens the notifications screen — clears bell badge
  void markNotificationsAsRead() {
    _readNotificationCount = _notifications.length;
    notifyListeners();
  }

  /// Mark a single notification as read (clears its dot in the list).
  void markNotificationRead(String id) {
    if (_readNotificationIds.add(id)) notifyListeners();
  }

  /// Whether a specific notification has been read.
  bool isNotificationRead(String id) => _readNotificationIds.contains(id);

  /// Count of notifications the user has not yet tapped.
  int get unreadNotificationCount =>
      _notifications.where((n) => !_readNotificationIds.contains(n.id)).length;

  /// True once [AppBootstrap] has pre-loaded all critical data.
  /// Screens use this to skip their own initState data fetch.
  bool get isBootstrapped => _bootstrapped;

  /// Called by [AppBootstrap] after initial data load completes.
  void markBootstrapped() {
    _bootstrapped = true;
    // No notifyListeners needed — screens only read this synchronously.
  }
  List<Payment> get payments => _payments;
  int get monthlyCheckIns => _monthlyCheckIns;

  bool get isLoadingMember => _isLoadingMember;
  bool get isLoadingSessions => _isLoadingSessions;
  bool get isLoadingAttendance => _isLoadingAttendance;
  bool get isLoadingNotifications => _isLoadingNotifications;
  bool get isLoadingPayments => _isLoadingPayments;

  GymCapacity? get capacity => _capacity;
  bool get isLoadingCapacity => _isLoadingCapacity;

  List<ServiceAssignment> get serviceAssignments => _serviceAssignments;
  bool get isLoadingServices => _isLoadingServices;

  List<GuestInvitation> get invitations => _invitations;
  bool get isLoadingInvitations => _isLoadingInvitations;
  String? get invitationsError => _invitationsError;

  /// Remaining invitations from the current membership.
  int get invitationsRemaining => _currentMembership?.invitationsRemaining ?? 0;

  String? get memberError => _memberError;
  String? get sessionsError => _sessionsError;
  String? get attendanceError => _attendanceError;
  String? get notificationsError => _notificationsError;
  String? get paymentsError => _paymentsError;

  Session? get nextSession {
    if (_sessions.isEmpty) return null;
    final now = DateTime.now();
    try {
      return _sessions.firstWhere((s) => s.scheduledAt.isAfter(now));
    } catch (_) {
      return null;
    }
  }

  /// Loads member data only if not already loaded or in progress.
  /// Multiple concurrent callers share the same in-flight Future.
  Future<void> ensureMemberLoaded(String gymId) {
    if (_member != null) return Future.value();
    _memberLoadFuture ??= loadMemberData(gymId).whenComplete(() {
      _memberLoadFuture = null;
    });
    return _memberLoadFuture!;
  }

  /// In-flight registry for `_runOnce`. Each key represents one
  /// loadX(args) signature; concurrent callers with the same key share
  /// the same Future so a slow first response can't land after a faster
  /// second one and clobber the field with stale data. Cleared in clear().
  final Map<String, Future<void>> _inFlight = {};

  /// Run [fn] under [key]. If a Future for [key] is already pending,
  /// return that Future; otherwise start one and cache it until it
  /// completes. Errors propagate so callers' try/catch still works.
  ///
  /// [force]=true bypasses the in-flight share — starts a fresh fn() even
  /// if another is already running. Used by pull-to-refresh and post-login
  /// flows where the user explicitly requested fresh data; we accept the
  /// "two writes can race" trade-off because the LAST write wins, and
  /// fresh data after the spinner is the desired outcome. Without this
  /// bypass, a slow load that started during bootstrap (whose outer
  /// .timeout() already gave up) would keep its in-flight slot for 30s+
  /// and pull-to-refresh would silently join it — looking like an
  /// infinite spinner.
  Future<void> _runOnce(String key, Future<void> Function() fn, {bool force = false}) {
    if (!force) {
      final existing = _inFlight[key];
      if (existing != null) return existing;
    }
    // `late` so the whenComplete closure can reference the same Future
    // it's chained off of — needed for the "still own this slot" check.
    late final Future<void> f;
    f = fn().whenComplete(() {
      // Only clear the slot if we still own it — a later force=true call
      // may have replaced it with a newer future.
      if (identical(_inFlight[key], f)) _inFlight.remove(key);
    });
    _inFlight[key] = f;
    return f;
  }

  Future<void> loadMemberData(String gymId) async {
    _isLoadingMember = true;
    _memberError = null;
    notifyListeners();

    try {
      _member = await _service.getGymMember(gymId);
      if (_member != null) {
        // Fetch membership, summary, check-in count, and capacity in parallel.
        final membershipFuture = _service.getCurrentMembership(_member!.id);
        final summaryFuture = _service.getMembershipSummary(gymId: gymId);
        final checkInFuture = _service.getMonthlyCheckInCount(_member!.id);
        final capacityFuture = _service.getGymCapacity(gymId);
        _currentMembership = await membershipFuture;
        _membershipSummary = await summaryFuture;
        _monthlyCheckIns = await checkInFuture;
        _capacity = await capacityFuture;
        _scheduleMembershipNotifications();
      }
    } catch (e) {
      _memberError = friendlyError(e);
    } finally {
      _isLoadingMember = false;
      notifyListeners();
    }
  }

  Future<void> loadCapacity(String gymId) => _runOnce('capacity:$gymId', () async {
    _isLoadingCapacity = true;
    // No notifyListeners here — avoid rebuilding the whole screen just for a flag
    try {
      _capacity = await _service.getGymCapacity(gymId);
    } catch (_) {
      // silently swallow; stale data is acceptable
    } finally {
      _isLoadingCapacity = false;
      notifyListeners();
    }
  });

  Future<void> loadSessions(String gymId, {bool force = false}) =>
      _runOnce('sessions:$gymId', () => _doLoadSessions(gymId), force: force);

  Future<void> _doLoadSessions(String gymId) async {
    _isLoadingSessions = true;
    _sessionsError = null;
    notifyListeners();

    try {
      final sessions = await _service.getUpcomingSessions(gymId);
      if (_member != null) {
        // Fetch bookings and rated IDs in parallel — both only need member id.
        final bookingsFuture = _service.getBookingsBySession(_member!.id);
        final ratedFuture = _service.getRatedBookingIds(_member!.id);
        final bookings = await bookingsFuture;
        Set<String> ratedBookingIds;
        try {
          ratedBookingIds = await ratedFuture;
        } catch (_) {
          ratedBookingIds = {};
        }
        for (final session in sessions) {
          if (bookings.containsKey(session.id)) {
            session.isBooked = true;
            session.bookingId = bookings[session.id]!['booking_id'];
            session.bookingStatus = bookings[session.id]!['status'];
            final bookingId = session.bookingId;
            if (bookingId != null && ratedBookingIds.contains(bookingId)) {
              session.hasRated = true;
            }
          }
        }
      }
      _sessions = sessions;
    } catch (e) {
      _sessionsError = friendlyError(e);
    } finally {
      _isLoadingSessions = false;
      notifyListeners();
    }
  }

  Future<void> loadMyBookings() {
    if (_member == null) return Future.value();
    return _runOnce('myBookings:${_member!.id}', () async {
      _isLoadingMyBookings = true;
      _myBookingsError = null;
      notifyListeners();
      try {
        _myBookings = await _service.getMyBookings(_member!.id);
      } catch (e) {
        _myBookingsError = friendlyError(e);
      } finally {
        _isLoadingMyBookings = false;
        notifyListeners();
      }
    });
  }

  Future<void> bookSession(String sessionId) async {
    if (_member == null) return;
    await _service.bookSession(sessionId, _member!.id);
    if (_sessions.isNotEmpty) {
      final gymId = _member!.gymId;
      await loadSessions(gymId);
    }
  }

  Future<void> cancelBooking(String bookingId, String gymId) async {
    await _service.cancelBooking(bookingId);
    await loadSessions(gymId);
  }

  /// Legacy gym entrance QR (no token) — direct insert with client-side checks only.
  Future<Map<String, dynamic>> scanGymQr(String gymId, {String? branchId}) async {
    if (_member == null) throw Exception('Member not loaded');
    try {
      await _service.insertAttendanceLog(
        memberId: _member!.id,
        gymId: gymId,
        branchId: branchId,
      );
      await loadAttendance();
      return {'status': 'allowed'};
    } catch (e) {
      return {'status': 'denied', 'reason': e.toString()};
    }
  }

  /// Token-based gym QR scan — single atomic RPC that validates token,
  /// checks membership/branch access, enforces 2-min cooldown, and inserts.
  /// Uses auth.uid() server-side so no user ID spoofing is possible.
  Future<Map<String, dynamic>> scanGymQrByToken(
    String gymId,
    String token, {
    String? branchId,
  }) async {
    if (_member == null) throw Exception('Member not loaded');

    final result = await _service.checkinGymEntrance(token, _member!.id);
    if (result['status'] == 'allowed') {
      await loadAttendance();
    }
    return result;
  }

  /// Scans a class session QR (legacy `class:{classId}` format) → marks booking attended.
  Future<Map<String, dynamic>> scanClassQr(String classId) async {
    if (_member == null) throw Exception('Member not loaded');
    final result = await _service.markClassAttended(classId, _member!.id, _member!.gymId);
    try {
      _currentMembership = await _service.getCurrentMembership(_member!.id);
      notifyListeners();
    } catch (_) {}
    return result;
  }

  /// Scans a JSON QR (`type:class`) with session_id and branch validation.
  Future<Map<String, dynamic>> scanSessionQr(String sessionId, {String? branchId}) async {
    if (_member == null) throw Exception('Member not loaded');
    final result = await _service.markSessionAttended(
      sessionId, _member!.id, _member!.gymId,
      qrBranchId: branchId,
    );
    try {
      _currentMembership = await _service.getCurrentMembership(_member!.id);
      notifyListeners();
    } catch (_) {}
    return result;
  }

  Future<void> loadAttendance() {
    if (_member == null) return Future.value();
    return _runOnce('attendance:${_member!.id}', () async {
      _isLoadingAttendance = true;
      _attendanceError = null;
      notifyListeners();
      try {
        _attendance = await _service.getAttendanceHistory(_member!.id, limit: 10);
        _monthlyCheckIns = await _service.getMonthlyCheckInCount(_member!.id);
      } catch (e) {
        _attendanceError = friendlyError(e);
      } finally {
        _isLoadingAttendance = false;
        notifyListeners();
      }
    });
  }

  /// Load the caller's session-transfer history (sent + received) into one
  /// flat list, sorted by created_at DESC. Used alongside attendance to power
  /// the unified-timeline activity view on the attendance screen.
  Future<void> loadTransfers() {
    if (_member == null) return Future.value();
    return _runOnce('transfers:${_member!.id}', () async {
      _isLoadingTransfers = true;
      _transfersError = null;
      notifyListeners();
      try {
        final raw = await _service.getMyTransfers();
        final sent = (raw['sent'] ?? const <Map<String, dynamic>>[])
            .map((m) => TransferLog.fromJson(m, isSent: true))
            .toList();
        final received = (raw['received'] ?? const <Map<String, dynamic>>[])
            .map((m) => TransferLog.fromJson(m, isSent: false))
            .toList();
        _transfers = [...sent, ...received]
          ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
      } catch (e) {
        _transfersError = friendlyError(e);
      } finally {
        _isLoadingTransfers = false;
        notifyListeners();
      }
    });
  }

  Future<void> loadGrants() {
    if (_member == null) return Future.value();
    return _runOnce('grants:${_member!.id}', () async {
      _isLoadingGrants = true;
      _grantsError = null;
      notifyListeners();
      try {
        final raw = await _service.getMyGrants();
        _grants = raw.map((m) => GrantLog.fromJson(m)).toList();
      } catch (e) {
        _grantsError = friendlyError(e);
      } finally {
        _isLoadingGrants = false;
        notifyListeners();
      }
    });
  }

  Future<void> loadNotifications(String gymId) => _runOnce('notifications:$gymId', () async {
    _isLoadingNotifications = true;
    _notificationsError = null;
    notifyListeners();
    try {
      _notifications = await _service.getNotifications(gymId);
    } catch (e) {
      _notificationsError = friendlyError(e);
    } finally {
      _isLoadingNotifications = false;
      notifyListeners();
    }
  });

  Future<void> loadPayments() {
    if (_member == null) return Future.value();
    return _runOnce('payments:${_member!.id}', () async {
      _isLoadingPayments = true;
      _paymentsError = null;
      notifyListeners();
      try {
        _payments = await _service.getPaymentHistory(_member!.id);
      } catch (e) {
        _paymentsError = friendlyError(e);
      } finally {
        _isLoadingPayments = false;
        notifyListeners();
      }
    });
  }

  bool _isFreezingPlan = false;
  bool get isFreezingPlan => _isFreezingPlan;

  Future<void> freezePlan(String gymId, int days) async {
    final ms = _currentMembership;
    final m = _member;
    if (ms == null || m == null) return;
    _isFreezingPlan = true;
    notifyListeners();
    try {
      _currentMembership = await _service.freezeMembership(
        ms.id, m.id, m.gymId, days, ms,
      );
    } finally {
      _isFreezingPlan = false;
      notifyListeners();
    }
  }

  Future<void> unfreezePlan() async {
    final ms = _currentMembership;
    final m = _member;
    if (ms == null || m == null) return;
    _isFreezingPlan = true;
    notifyListeners();
    try {
      _currentMembership = await _service.unfreezeMembership(ms.id, m.id, ms);
    } finally {
      _isFreezingPlan = false;
      notifyListeners();
    }
  }

  /// Re-fetches the current membership and summary from the server.
  /// Use this to pick up plan assignments made by the admin without
  /// triggering a full member reload.
  Future<void> refreshMembership() {
    final m = _member;
    if (m == null) return Future.value();
    return _runOnce('refreshMembership:${m.id}', () async {
      try {
        final ms = await _service.getCurrentMembership(m.id);
        final summary = await _service.getMembershipSummary(gymId: m.gymId);
        _currentMembership = ms;
        _membershipSummary = summary;
        notifyListeners();
      } catch (_) {}
    });
  }

  /// Force-refreshes the GymMember record from the server (including member_number).
  /// Call after a membership purchase so the QR screen shows the assigned member_number.
  Future<void> refreshMemberRecord(String gymId) async {
    try {
      _member = await _service.getGymMember(gymId);
      notifyListeners();
    } catch (_) {}
  }

  /// Loads active service assignments (PT, Nutrition, Physio) for this member.
  Future<void> loadServiceAssignments() {
    final m = _member;
    if (m == null) return Future.value();
    return _runOnce('serviceAssignments:${m.id}', () async {
      _isLoadingServices = true;
      notifyListeners();
      try {
        _serviceAssignments = await _service.getServiceAssignments(m.id);
      } catch (_) {
        _serviceAssignments = [];
      } finally {
        _isLoadingServices = false;
        notifyListeners();
      }
    });
  }

  Future<void> loadAllMemberships() async {
    // kept for future use
  }

  Future<void> loadInvitations() {
    final m = _member;
    if (m == null) return Future.value();
    return _runOnce('invitations:${m.id}', () async {
      _isLoadingInvitations = true;
      _invitationsError = null;
      notifyListeners();
      try {
        _invitations = await _service.getMyInvitations(m.id);
      } catch (e) {
        _invitationsError = friendlyError(e);
      } finally {
        _isLoadingInvitations = false;
        notifyListeners();
      }
    });
  }

  Future<void> sendInvitation({
    required String gymId,
    required String guestEmail,
    required String guestPhone,
    String? guestName,
    int maxVisits = 1,
  }) async {
    final m = _member;
    final ms = _currentMembership;
    if (m == null || ms == null) throw Exception('Membership not loaded');

    final inv = await _service.sendInvitation(
      gymId: gymId,
      gymMemberId: m.id,
      membershipId: ms.id,
      guestEmail: guestEmail,
      guestPhone: guestPhone,
      guestName: guestName,
      durationType: ms.invitationDurationType ?? 'per_visit',
      durationDays: ms.invitationDurationDays,
      maxVisits: maxVisits,
      validityDays: ms.invitationValidityDays ?? 7,
    );

    _invitations = [inv, ..._invitations];
    // Refresh membership to get updated invitations_remaining
    _currentMembership = await _service.getCurrentMembership(m.id);
    notifyListeners();
  }

  void _scheduleMembershipNotifications() {
    final expiry = _currentMembership?.endDate;
    if (expiry == null) return;
    final notif = NotificationService();
    notif.requestPermissions();
    notif.cancelMembershipNotifications().then((_) {
      notif.scheduleMembershipReminderNotification(expiry);
      notif.scheduleMembershipExpiryNotification(expiry);
    });
  }

  void clear() {
    _member = null;
    _currentMembership = null;
    _membershipSummary = null;
    _capacity = null;
    _sessions = [];
    _myBookings = [];
    _attendance = [];
    _notifications = [];
    _payments = [];
    _invitations = [];
    _serviceAssignments = [];
    _monthlyCheckIns = 0;
    _bootstrapped = false;
    _readNotificationIds.clear();
    // Reset all loading flags too — otherwise a sign-out mid-fetch leaves
    // them true and the next user (post sign-in) sees an infinite
    // skeleton until they pull-to-refresh.
    _isLoadingMember = false;
    _isLoadingSessions = false;
    _isLoadingMyBookings = false;
    _isLoadingAttendance = false;
    _isLoadingNotifications = false;
    _isLoadingPayments = false;
    _isLoadingCapacity = false;
    _isLoadingServices = false;
    _isLoadingInvitations = false;
    _memberError = null;
    _sessionsError = null;
    _myBookingsError = null;
    _attendanceError = null;
    _notificationsError = null;
    _paymentsError = null;
    _invitationsError = null;
    // Drop the in-flight registry so a slow load_xxx that returns AFTER
    // sign-out can't dump fresh data into the cleared provider belonging
    // to the next user.
    _inFlight.clear();
    _memberLoadFuture = null;
    notifyListeners();
  }
}
