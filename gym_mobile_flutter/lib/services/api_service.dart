import 'dart:io';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import '../models/gym_model.dart';
import '../models/capacity_model.dart';
import '../models/member_model.dart';
import '../models/membership_model.dart';
import '../models/session_model.dart' as session_model;
import '../models/attendance_model.dart';
import '../models/notification_model.dart';
import '../models/payment_model.dart';
import '../models/booking_record_model.dart';
import '../models/trainer_profile_model.dart';
import '../models/invitation_model.dart';
import '../models/service_assignment_model.dart';
import '../utils/env.dart';

const _storage = FlutterSecureStorage();
const _tokenKey = 'auth_token';
const _userIdKey = 'user_id';

class ApiService {
  String get _baseUrl => Env.apiUrl;

  Future<String?> get _token => _storage.read(key: _tokenKey);

  String? _cachedUserId;

  String? get currentUserId => _cachedUserId;

  /// Must be called after login to cache the user ID in memory.
  void setCachedUserId(String? id) => _cachedUserId = id;

  /// Loads the cached user ID from secure storage (call once at startup).
  Future<void> loadCachedUserId() async {
    _cachedUserId = await _storage.read(key: _userIdKey);
  }

  Future<Map<String, String>> get _headers async {
    final token = await _token;
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  // ── HTTP helpers ────────────────────────────────────────────────────────────

  Future<dynamic> _get(String path, {Map<String, String>? queryParams}) async {
    final uri = Uri.parse('$_baseUrl$path').replace(queryParameters: queryParams);
    final response = await http.get(uri, headers: await _headers);
    return _parse(response);
  }

  Future<dynamic> _post(String path, [Map<String, dynamic>? body]) async {
    final uri = Uri.parse('$_baseUrl$path');
    final response = await http.post(
      uri,
      headers: await _headers,
      body: body != null ? jsonEncode(body) : null,
    );
    return _parse(response);
  }

  Future<dynamic> _put(String path, Map<String, dynamic> body) async {
    final uri = Uri.parse('$_baseUrl$path');
    final response = await http.put(
      uri,
      headers: await _headers,
      body: jsonEncode(body),
    );
    return _parse(response);
  }

  Future<dynamic> _patch(String path, Map<String, dynamic> body) async {
    final uri = Uri.parse('$_baseUrl$path');
    final response = await http.patch(
      uri,
      headers: await _headers,
      body: jsonEncode(body),
    );
    return _parse(response);
  }

  Future<dynamic> _delete(String path) async {
    final uri = Uri.parse('$_baseUrl$path');
    final response = await http.delete(uri, headers: await _headers);
    return _parse(response);
  }

  dynamic _parse(http.Response response) {
    if (response.body.isEmpty) return <String, dynamic>{};
    final body = jsonDecode(response.body);
    if (response.statusCode >= 400) {
      final msg = body is Map ? (body['message']?.toString() ?? 'Unknown error') : 'Unknown error';
      throw ApiException(statusCode: response.statusCode, message: msg);
    }
    return body;
  }

  // ─── Auth ─────────────────────────────────────────────────────────────────

  /// Signs in and returns a map with 'user' and 'token'.
  /// Stores the token and user ID in secure storage.
  Future<AuthResult> signIn(String email, String password) async {
    final data = await _post('/api/auth/login', {
      'email': email,
      'password': password,
    });
    final token = data['token'] as String;
    final user = data['user'] as Map<String, dynamic>;
    final userId = user['id']?.toString() ?? '';

    await _storage.write(key: _tokenKey, value: token);
    await _storage.write(key: _userIdKey, value: userId);
    _cachedUserId = userId;

    return AuthResult(
      userId: userId,
      email: user['email'] as String? ?? email,
      fullName: user['full_name'] as String?,
      userData: user,
    );
  }

  Future<void> signOut() async {
    try {
      await _post('/api/auth/logout');
    } catch (_) {
      // Best-effort — clear local state regardless
    }
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _userIdKey);
    _cachedUserId = null;
  }

  Future<void> deleteAccount() async {
    await _delete('/api/members/account');
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _userIdKey);
    _cachedUserId = null;
  }

  Future<void> changePassword(String newPassword) async {
    await _post('/api/auth/change-password', {
      'password': newPassword,
      'password_confirmation': newPassword,
    });
  }

  Future<void> resetPasswordForEmail(String email) async {
    await _post('/api/auth/forgot-password', {
      'email': email,
    });
  }

  Future<void> resetPassword(String token, String email, String newPassword) async {
    await _post('/api/auth/reset-password', {
      'token': token,
      'email': email,
      'password': newPassword,
      'password_confirmation': newPassword,
    });
  }

  /// Registers a new user and gym member in one call.
  Future<AuthResult> register({
    required String email,
    required String password,
    required String fullName,
    required String phone,
    required String gymId,
    String? dateOfBirth,
    String? gender,
  }) async {
    final data = await _post('/api/auth/register', {
      'email': email,
      'password': password,
      'password_confirmation': password,
      'full_name': fullName,
      'phone': phone,
      'gym_id': gymId,
      if (dateOfBirth != null) 'date_of_birth': dateOfBirth,
      if (gender != null) 'gender': gender,
    });
    final token = data['token'] as String?;
    final user = data['user'] as Map<String, dynamic>;
    final userId = user['id']?.toString() ?? '';

    if (token != null) {
      await _storage.write(key: _tokenKey, value: token);
      await _storage.write(key: _userIdKey, value: userId);
      _cachedUserId = userId;
    }

    return AuthResult(
      userId: userId,
      email: user['email'] as String? ?? email,
      fullName: user['full_name'] as String?,
      userData: user,
    );
  }

  /// Check if there is a stored auth token.
  Future<bool> hasSession() async {
    final token = await _storage.read(key: _tokenKey);
    return token != null && token.isNotEmpty;
  }

  // ─── Gym ─────────────────────────────────────────────────────────────────

  Future<List<Gym>> getActiveGyms() async {
    // Use public endpoint (no auth required) for registration screen.
    // For white-label builds, fetch the specific gym by GYM_ID.
    final gymId = Env.gymId;
    if (gymId.isNotEmpty) {
      final data = await _get('/api/gyms/$gymId');
      final gym = Gym.fromJson(data as Map<String, dynamic>);
      return [gym];
    }
    // Fallback: authenticated settings endpoint
    final data = await _get('/api/settings');
    final gym = Gym.fromJson(data as Map<String, dynamic>);
    return [gym];
  }

  /// Returns raw gym settings JSON (for screens that need all fields).
  Future<Map<String, dynamic>?> getGymSettings() async {
    try {
      final data = await _get('/api/settings');
      if (data is Map<String, dynamic>) return data;
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<Gym?> getGymInfo(String gymId) async {
    try {
      final data = await _get('/api/settings');
      return Gym.fromJson(data as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  /// Fetch custom onboarding slides for a gym (active only, sorted).
  Future<List<Map<String, dynamic>>> getOnboardingSlides(String gymId) async {
    try {
      final data = await _get('/api/content/onboarding');
      if (data is List) {
        return List<Map<String, dynamic>>.from(data);
      }
      if (data is Map && data['data'] is List) {
        return List<Map<String, dynamic>>.from(data['data'] as List);
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<GymCapacity> getGymCapacity(String gymId) async {
    try {
      final data = await _get('/api/dashboard/capacity');
      if (data is Map<String, dynamic>) {
        return GymCapacity.fromJson(data);
      }
      return GymCapacity.disabled();
    } catch (_) {
      return GymCapacity.disabled();
    }
  }

  // ─── Profile / Member ─────────────────────────────────────────────────────

  Future<Profile?> getMemberProfile() async {
    try {
      final data = await _get('/api/me');
      if (data == null) return null;
      return Profile.fromJson(data as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<GymMember?> getGymMember(String gymId) async {
    try {
      final data = await _get('/api/members', queryParams: {'user_id': 'self'});
      // API may return a list or single object
      if (data is List && data.isNotEmpty) {
        return GymMember.fromJson(data.first as Map<String, dynamic>);
      }
      if (data is Map && data['data'] is List) {
        final list = data['data'] as List;
        if (list.isNotEmpty) {
          return GymMember.fromJson(list.first as Map<String, dynamic>);
        }
      }
      if (data is Map<String, dynamic> && data.containsKey('id')) {
        return GymMember.fromJson(data);
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  // ─── Membership ───────────────────────────────────────────────────────────

  Future<MemberMembership?> getCurrentMembership(String memberId) async {
    try {
      final raw = await _get('/api/members/$memberId');
      if (raw is! Map<String, dynamic>) return null;

      // Unwrap: response may be { data: { memberships: [...] } } or { memberships: [...] }
      final data = (raw['data'] is Map<String, dynamic>) ? raw['data'] as Map<String, dynamic> : raw;

      // Try direct current_membership field
      final msData = data['current_membership'] ?? data['membership'];
      if (msData is Map<String, dynamic>) {
        return MemberMembership.fromJson(msData);
      }

      // Fallback: find active paid membership from list
      final memberships = data['memberships'] as List?;
      if (memberships != null && memberships.isNotEmpty) {
        for (final m in memberships) {
          final ms = m as Map<String, dynamic>;
          if (ms['status'] == 'active' && ms['payment_status'] == 'paid') {
            return MemberMembership.fromJson(ms);
          }
        }
      }
      return null;
    } catch (e) {
      debugPrint('getCurrentMembership error: $e');
      return null;
    }
  }

  Future<List<MemberMembership>> getAllMemberships(String memberId) async {
    try {
      final raw = await _get('/api/members/$memberId');
      if (raw is! Map<String, dynamic>) return [];

      final data = (raw['data'] is Map<String, dynamic>) ? raw['data'] as Map<String, dynamic> : raw;
      final memberships = data['memberships'] as List?;
      if (memberships != null) {
        return memberships
            .map((e) => MemberMembership.fromJson(e as Map<String, dynamic>))
            .toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<MemberMembership> freezeMembership(
    String membershipId,
    String gymMemberId,
    String gymId,
    int days,
    MemberMembership current,
  ) async {
    await _post('/api/memberships/$membershipId/freeze', {
      'days': days,
    });
    // Re-fetch updated membership
    final updated = await getCurrentMembership(gymMemberId);
    return updated!;
  }

  Future<MemberMembership> unfreezeMembership(
    String membershipId,
    String gymMemberId,
    MemberMembership current,
  ) async {
    await _post('/api/memberships/$membershipId/unfreeze');
    final updated = await getCurrentMembership(gymMemberId);
    return updated!;
  }

  Future<List<Map<String, dynamic>>> getFreezeLogs(String membershipId) async {
    try {
      final data = await _get('/api/memberships/$membershipId/freeze-logs');
      if (data is List) return List<Map<String, dynamic>>.from(data);
      if (data is Map && data['data'] is List) {
        return List<Map<String, dynamic>>.from(data['data'] as List);
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  // ─── Service Assignments ──────────────────────────────────────────────────

  Future<List<ServiceAssignment>> getServiceAssignments(String gymMemberId) async {
    try {
      final data = await _get('/api/members/$gymMemberId/services');
      List list;
      if (data is List) {
        list = data;
      } else if (data is Map && data['data'] is List) {
        list = data['data'] as List;
      } else {
        return [];
      }
      return list
          .map((e) => ServiceAssignment.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  // ─── Invitations ──────────────────────────────────────────────────────────

  Future<List<GuestInvitation>> getMyInvitations(String gymMemberId) async {
    try {
      final data = await _get('/api/invitations');
      List list;
      if (data is List) {
        list = data;
      } else if (data is Map && data['data'] is List) {
        list = data['data'] as List;
      } else {
        return [];
      }
      return list
          .map((e) => GuestInvitation.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<GuestInvitation> sendInvitation({
    required String gymId,
    required String gymMemberId,
    required String membershipId,
    required String guestEmail,
    required String guestPhone,
    String? guestName,
    required String durationType,
    int? durationDays,
    required int maxVisits,
    required int validityDays,
  }) async {
    final data = await _post('/api/invitations', {
      'gym_member_id': gymMemberId,
      'membership_id': membershipId,
      'guest_email': guestEmail,
      'guest_phone': guestPhone,
      if (guestName != null) 'guest_name': guestName,
      'duration_type': durationType,
      if (durationDays != null) 'duration_days': durationDays,
      'max_visits': maxVisits,
      'validity_days': validityDays,
    });
    return GuestInvitation.fromJson(data as Map<String, dynamic>);
  }

  Future<void> activateGuestInvitation({
    required String gymId,
    required String guestEmail,
    required String guestPhone,
  }) async {
    try {
      await _post('/api/invitations/activate', {
        'guest_email': guestEmail,
        'guest_phone': guestPhone,
      });
    } catch (_) {
      // Silently ignore — not all registrations have invitations
    }
  }

  Future<GuestInvitation?> getMyGuestPass(String gymId) async {
    try {
      final data = await _get('/api/invitations/my-pass');
      if (data is Map<String, dynamic> && data.containsKey('id')) {
        return GuestInvitation.fromJson(data);
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  // ─── Sessions ─────────────────────────────────────────────────────────────

  Future<List<session_model.Session>> getUpcomingSessions(String gymId) async {
    final data = await _get('/api/sessions');
    List list;
    if (data is List) {
      list = data;
    } else if (data is Map && data['data'] is List) {
      list = data['data'] as List;
    } else {
      return [];
    }
    return list
        .map((e) => session_model.Session.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<String>> getBookedSessionIds(String memberId) async {
    try {
      final data = await _get('/api/bookings', queryParams: {'gym_member_id': memberId});
      List list;
      if (data is List) {
        list = data;
      } else if (data is Map && data['data'] is List) {
        list = data['data'] as List;
      } else {
        return [];
      }
      return list
          .where((e) => (e as Map<String, dynamic>)['status'] != 'cancelled')
          .map((e) => (e as Map<String, dynamic>)['session_id'] as String)
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<Map<String, Map<String, String>>> getBookingsBySession(
      String memberId) async {
    try {
      final data = await _get('/api/bookings', queryParams: {'gym_member_id': memberId});
      List list;
      if (data is List) {
        list = data;
      } else if (data is Map && data['data'] is List) {
        list = data['data'] as List;
      } else {
        return {};
      }
      final result = <String, Map<String, String>>{};
      for (final row in list) {
        final r = row as Map<String, dynamic>;
        if (r['status'] == 'cancelled') continue;
        final sessionId = r['session_id'] as String;
        result[sessionId] = {
          'booking_id': r['id'] as String,
          'status': r['status'] as String,
        };
      }
      return result;
    } catch (_) {
      return {};
    }
  }

  Future<void> bookSession(String sessionId, String memberId) async {
    await _post('/api/bookings', {
      'session_id': sessionId,
      'gym_member_id': memberId,
    });
  }

  Future<List<BookingRecord>> getMyBookings(String memberId) async {
    final data = await _get('/api/bookings', queryParams: {'gym_member_id': memberId});
    List list;
    if (data is List) {
      list = data;
    } else if (data is Map && data['data'] is List) {
      list = data['data'] as List;
    } else {
      return [];
    }
    return list
        .map((e) => BookingRecord.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<BookingRecord?> getLastUnratedAttendedSession(String memberId) async {
    try {
      final data = await _get('/api/bookings', queryParams: {
        'gym_member_id': memberId,
        'status': 'attended',
        'unrated': 'true',
        'limit': '1',
      });
      List list;
      if (data is List) {
        list = data;
      } else if (data is Map && data['data'] is List) {
        list = data['data'] as List;
      } else {
        return null;
      }
      if (list.isEmpty) return null;
      return BookingRecord.fromJson(list.first as Map<String, dynamic>);
    } catch (e) {
      debugPrint('[Rating] getLastUnratedAttendedSession error: $e');
      return null;
    }
  }

  Future<void> cancelBooking(String bookingId) async {
    await _delete('/api/bookings/$bookingId');
  }

  // ─── Attendance ───────────────────────────────────────────────────────────

  Future<List<Attendance>> getAttendanceHistory(String memberId,
      {int limit = 10, int offset = 0, DateTime? from, DateTime? to, String? type}) async {
    final params = <String, String>{
      'gym_member_id': memberId,
      'limit': limit.toString(),
      'offset': offset.toString(),
    };
    if (from != null) params['from'] = from.toIso8601String();
    if (to != null) params['to'] = to.toIso8601String();
    if (type != null) params['type'] = type;

    final data = await _get('/api/attendance', queryParams: params);
    List list;
    if (data is List) {
      list = data;
    } else if (data is Map && data['data'] is List) {
      list = data['data'] as List;
    } else {
      return [];
    }
    return list
        .map((e) => Attendance.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> insertAttendanceLog({
    required String memberId,
    required String gymId,
    String? branchId,
  }) async {
    await _post('/api/attendance', {
      'gym_member_id': memberId,
      if (branchId != null) 'branch_id': branchId,
    });
  }

  Future<Map<String, dynamic>> validateGymQrToken(String token) async {
    try {
      final raw = await _post('/api/access/qr/validate', {'token': token});
      if (raw is Map && raw['data'] is Map) {
        return Map<String, dynamic>.from(raw['data'] as Map);
      }
      return Map<String, dynamic>.from(raw as Map);
    } catch (e) {
      return {'valid': false, 'reason': e.toString()};
    }
  }

  Future<Map<String, dynamic>> checkinGymEntrance(String token, String gymMemberId) async {
    try {
      final data = await _post('/api/attendance/qr', {
        'gym_member_id': gymMemberId,
        'token': token,
      });
      // Response is { data: { status: 'allowed' } } or { data: { status: 'denied', reason: '...' } }
      if (data is Map && data['data'] is Map) {
        return Map<String, dynamic>.from(data['data'] as Map);
      }
      return Map<String, dynamic>.from(data as Map);
    } catch (e) {
      return {'status': 'denied', 'reason': e.toString()};
    }
  }

  Future<Map<String, dynamic>> validateStudioAccess(
    String studioId,
    String userId,
  ) async {
    final raw = await _post('/api/access/studio', {
      'studio_id': studioId,
      'user_id': userId,
    });
    // Unwrap { data: { status: '...' } }
    if (raw is Map && raw['data'] is Map) {
      return Map<String, dynamic>.from(raw['data'] as Map);
    }
    return Map<String, dynamic>.from(raw as Map);
  }

  Future<Map<String, dynamic>> markClassAttended(
      String classId, String memberId, String gymId) async {
    final data = await _post('/api/sessions/checkin', {
      'class_id': classId,
      'gym_member_id': memberId,
    });
    return data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> markSessionAttended(
      String sessionId, String memberId, String gymId, {String? qrBranchId}) async {
    final data = await _post('/api/sessions/$sessionId/checkin', {
      'gym_member_id': memberId,
      if (qrBranchId != null) 'branch_id': qrBranchId,
    });
    return data as Map<String, dynamic>;
  }

  Future<int> getMonthlyCheckInCount(String memberId) async {
    try {
      final startOfMonth = DateTime(
        DateTime.now().year,
        DateTime.now().month,
        1,
      ).toIso8601String();

      final data = await _get('/api/attendance', queryParams: {
        'gym_member_id': memberId,
        'from': startOfMonth,
      });
      List list;
      if (data is List) {
        list = data;
      } else if (data is Map && data['data'] is List) {
        list = data['data'] as List;
      } else {
        return 0;
      }
      return list.length;
    } catch (_) {
      return 0;
    }
  }

  // ─── Notifications ────────────────────────────────────────────────────────

  Future<List<GymNotification>> getNotifications(String gymId) async {
    final data = await _get('/api/notifications');
    List list;
    if (data is List) {
      list = data;
    } else if (data is Map && data['data'] is List) {
      list = data['data'] as List;
    } else {
      return [];
    }
    return list
        .map((e) => GymNotification.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // ─── Payments ─────────────────────────────────────────────────────────────

  Future<String> purchaseMembership({
    required String gymId,
    required String planId,
    required double amount,
    required String currency,
    required String paymentMethod,
    double? originalAmount,
    String? promoCodeId,
  }) async {
    final data = await _post('/api/memberships/purchase', {
      'plan_id': planId,
      'amount': amount,
      'currency': currency,
      'payment_method': paymentMethod,
      'start_date': DateTime.now().toIso8601String().substring(0, 10),
      if (originalAmount != null) 'original_amount': originalAmount,
      if (promoCodeId != null) 'promo_code_id': promoCodeId,
    });
    if (data is Map && data['id'] != null) return data['id'] as String;
    if (data is String) return data;
    return data.toString();
  }

  Future<void> stampPaymobTransactionId(String paymentId, String txnId) async {
    await _post('/api/payments/$paymentId/stamp-txn', {
      'transaction_id': txnId,
    });
  }

  Future<String> purchaseServicePackage({
    required String gymId,
    required String packageId,
    required double amount,
    required String currency,
    required String paymentMethod,
    String? specialistName,
    double? originalAmount,
    String? promoCodeId,
  }) async {
    final data = await _post('/api/memberships/purchase-package', {
      'package_id': packageId,
      'amount': amount,
      'currency': currency,
      'payment_method': paymentMethod,
      if (specialistName != null) 'specialist_name': specialistName,
      if (originalAmount != null) 'original_amount': originalAmount,
      if (promoCodeId != null) 'promo_code_id': promoCodeId,
    });
    if (data is Map && data['id'] != null) return data['id'] as String;
    if (data is String) return data;
    return data.toString();
  }

  Future<Map<String, dynamic>> validatePromoCode({
    required String gymId,
    required String code,
    required double amount,
  }) async {
    final data = await _post('/api/promo-codes/validate', {
      'code': code,
      'amount': amount,
    });
    return Map<String, dynamic>.from(data as Map);
  }

  Future<String> createMobilePayment({
    required String gymId,
    required double amount,
    required String currency,
    required String paymentMethod,
    required String notes,
    String? serviceType,
    String? serviceName,
    String? specialistName,
  }) async {
    final data = await _post('/api/payments', {
      'amount': amount,
      'currency': currency,
      'payment_method': paymentMethod,
      'notes': notes,
      if (serviceType != null) 'service_type': serviceType,
      if (serviceName != null) 'service_name': serviceName,
      if (specialistName != null) 'specialist_name': specialistName,
    });
    if (data is Map && data['id'] != null) return data['id'] as String;
    if (data is String) return data;
    return data.toString();
  }

  Future<List<Payment>> getPaymentHistory(String memberId) async {
    final data = await _get('/api/payments', queryParams: {'gym_member_id': memberId});
    List list;
    if (data is List) {
      list = data;
    } else if (data is Map && data['data'] is List) {
      list = data['data'] as List;
    } else {
      return [];
    }
    return list
        .map((e) => Payment.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Alias for billing repository — returns raw maps for InvoiceModel parsing.
  Future<List<Map<String, dynamic>>> getPayments(String memberId) async {
    final data = await _get('/api/payments', queryParams: {'gym_member_id': memberId});
    return _extractList(data);
  }

  /// Get a single payment by ID (for invoice detail screen).
  Future<Map<String, dynamic>?> getPaymentById(String paymentId, String memberId) async {
    try {
      final raw = await _get('/api/payments/$paymentId');
      if (raw is Map<String, dynamic>) {
        // Unwrap {data: {...}} if present
        if (raw.containsKey('data') && raw['data'] is Map) {
          return Map<String, dynamic>.from(raw['data'] as Map);
        }
        return raw;
      }
      return null;
    } catch (e, stack) {
      debugPrint('getPaymentById error: $e');
      debugPrint('getPaymentById stack: $stack');
      return null;
    }
  }

  // ─── Profile update ───────────────────────────────────────────────────────

  Future<void> updateProfile(
      String fullName, String phone, DateTime? dateOfBirth) async {
    await _put('/api/me', {
      'full_name': fullName,
      'phone': phone,
      if (dateOfBirth != null)
        'date_of_birth': dateOfBirth.toIso8601String().substring(0, 10),
    });
  }

  Future<String> uploadAvatar(String filePath) async {
    final file = File(filePath);
    final bytes = await file.readAsBytes();
    final ext = filePath.split('.').last.toLowerCase().replaceAll('jpg', 'jpeg');

    final uri = Uri.parse('$_baseUrl/api/files/upload');
    final request = http.MultipartRequest('POST', uri);
    final token = await _token;
    if (token != null) {
      request.headers['Authorization'] = 'Bearer $token';
    }
    request.headers['Accept'] = 'application/json';
    request.fields['type'] = 'avatar';
    request.files.add(http.MultipartFile.fromBytes(
      'file',
      bytes,
      filename: 'avatar.$ext',
    ));

    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);
    final data = jsonDecode(response.body);

    if (response.statusCode >= 400) {
      throw ApiException(
        statusCode: response.statusCode,
        message: data['message']?.toString() ?? 'Upload failed',
      );
    }

    final url = data['url'] as String? ?? data['path'] as String? ?? '';
    return url;
  }

  /// Update the FCM token on the server for push notifications.
  Future<void> updateFcmToken(String token) async {
    await _put('/api/me', {'fcm_token': token});
  }

  // ─── Ratings ──────────────────────────────────────────────────────────────

  Future<Set<String>> getRatedBookingIds(String memberId) async {
    try {
      final data = await _get('/api/bookings', queryParams: {
        'gym_member_id': memberId,
        'rated': 'true',
      });
      List list;
      if (data is List) {
        list = data;
      } else if (data is Map && data['data'] is List) {
        list = data['data'] as List;
      } else {
        return {};
      }
      return list
          .map((e) => (e as Map<String, dynamic>)['id'] as String)
          .toSet();
    } catch (_) {
      return {};
    }
  }

  Future<void> submitRating({
    required String sessionId,
    required String bookingId,
    required String gymMemberId,
    required String gymId,
    required int sessionRating,
    int? trainerRating,
    String? review,
  }) async {
    await _post('/api/ratings', {
      'session_id': sessionId,
      'booking_id': bookingId,
      'gym_member_id': gymMemberId,
      'session_rating': sessionRating,
      if (trainerRating != null) 'trainer_rating': trainerRating,
      if (review != null) 'review': review,
    });
  }

  // ─── Trainer profiles ─────────────────────────────────────────────────────

  Future<Map<String, dynamic>?> getTrainerProfile(
      String name, String gymId) async {
    try {
      final data = await _get('/api/trainers', queryParams: {'name': name});
      List list;
      if (data is List) {
        list = data;
      } else if (data is Map && data['data'] is List) {
        list = data['data'] as List;
      } else {
        return null;
      }
      if (list.isEmpty) return null;
      return list.first as Map<String, dynamic>;
    } catch (e) {
      debugPrint('getTrainerProfile error: $e');
      return null;
    }
  }

  Future<TrainerProfile?> getTrainerFullProfile(
      String name, String gymId) async {
    try {
      final data = await _get('/api/trainers', queryParams: {'name': name});
      List list;
      if (data is List) {
        list = data;
      } else if (data is Map && data['data'] is List) {
        list = data['data'] as List;
      } else {
        return null;
      }
      if (list.isEmpty) return null;
      final r = list.first as Map<String, dynamic>;
      final avgRating = (r['avg_rating'] as num?)?.toDouble();
      return TrainerProfile.fromJson(r, avgRating: avgRating);
    } catch (e) {
      debugPrint('getTrainerFullProfile error: $e');
      return null;
    }
  }

  Future<List<Map<String, dynamic>>> getTrainerUpcomingSessions(
      String trainerId, String trainerName, String gymId) async {
    try {
      final data = await _get('/api/trainers/$trainerId/sessions');
      if (data is List) return List<Map<String, dynamic>>.from(data);
      if (data is Map && data['data'] is List) {
        return List<Map<String, dynamic>>.from(data['data'] as List);
      }
      return [];
    } catch (e) {
      debugPrint('getTrainerUpcomingSessions error: $e');
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getTrainerReviews(
      String trainerId, String trainerName, String gymId) async {
    try {
      final data = await _get('/api/trainers/$trainerId/reviews');
      if (data is List) return List<Map<String, dynamic>>.from(data);
      if (data is Map && data['data'] is List) {
        return List<Map<String, dynamic>>.from(data['data'] as List);
      }
      return [];
    } catch (e) {
      debugPrint('getTrainerReviews error: $e');
      return [];
    }
  }

  // ─── Explore feed ─────────────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> getMembershipPlansForExplore(
      String gymId) async {
    try {
      final data = await _get('/api/plans', queryParams: {'explore': 'true', 'exclude_sessions': 'true'});
      return _extractList(data);
    } catch (e) {
      debugPrint('getMembershipPlansForExplore error: $e');
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getCurrentOffers(String gymId) async {
    try {
      final data = await _get('/api/offers', queryParams: {'active': 'true', 'limit': '5'});
      return _extractList(data);
    } catch (e) {
      debugPrint('getCurrentOffers error: $e');
      return [];
    }
  }

  Future<Map<String, dynamic>?> getOfferById(String offerId) async {
    try {
      final data = await _get('/api/offers/$offerId');
      if (data is Map<String, dynamic>) return data;
      return null;
    } catch (e) {
      debugPrint('getOfferById error: $e');
      return null;
    }
  }

  Future<List<Map<String, dynamic>>> getTrainersForExplore(
      String gymId) async {
    try {
      final data = await _get('/api/trainers', queryParams: {'active': 'true'});
      return _extractList(data);
    } catch (e) {
      debugPrint('getTrainersForExplore error: $e');
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getProgramsForExplore(
      String gymId) async {
    try {
      final data = await _get('/api/programs', queryParams: {'status': 'published'});
      return _extractList(data);
    } catch (e) {
      debugPrint('getProgramsForExplore error: $e');
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getSessionPackagesForExplore(
      String gymId) async {
    try {
      final data = await _get('/api/plans', queryParams: {'plan_type': 'sessions'});
      return _extractList(data);
    } catch (e) {
      debugPrint('getSessionPackagesForExplore error: $e');
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getPartnersForExplore(
      String gymId) async {
    try {
      final data = await _get('/api/content/partners');
      return _extractList(data);
    } catch (e) {
      debugPrint('getPartnersForExplore error: $e');
      return [];
    }
  }

  // ── Explore listing screens ───────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> getMembershipPlansListing(
      String gymId) async {
    try {
      final data = await _get('/api/plans', queryParams: {'exclude_sessions': 'true'});
      return _extractList(data);
    } catch (e) {
      debugPrint('getMembershipPlansListing error: $e');
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getAllCurrentOffers(String gymId) async {
    try {
      final data = await _get('/api/offers', queryParams: {'active': 'true'});
      return _extractList(data);
    } catch (e) {
      debugPrint('getAllCurrentOffers error: $e');
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getTrainersListing(String gymId, {String? branchId}) async {
    try {
      final params = <String, String>{'active': 'true'};
      if (branchId != null) params['branch_id'] = branchId;
      final data = await _get('/api/trainers', queryParams: params);
      return _extractList(data);
    } catch (e) {
      debugPrint('getTrainersListing error: $e');
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getTrainersByType(String gymId, String trainerType) async {
    try {
      final data = await _get('/api/trainers', queryParams: {
        'active': 'true',
        'trainer_type': trainerType,
      });
      return _extractList(data);
    } catch (e) {
      debugPrint('getTrainersByType error: $e');
      return [];
    }
  }

  Future<Map<String, dynamic>?> getProgramById(String id) async {
    try {
      final data = await _get('/api/programs/$id');
      return data as Map<String, dynamic>?;
    } catch (e) {
      debugPrint('getProgramById error: $e');
      return null;
    }
  }

  Future<Map<String, dynamic>?> getTrainerByName(
      String name, String gymId) async {
    try {
      final data = await _get('/api/trainers', queryParams: {'name': name});
      final list = _extractList(data);
      return list.isNotEmpty ? list.first : null;
    } catch (e) {
      debugPrint('getTrainerByName error: $e');
      return null;
    }
  }

  Future<({String planName, double discountPct})?> getMemberActivePlan(
      String gymId) async {
    try {
      final member = await getGymMember(gymId);
      if (member == null) return null;
      final ms = await getCurrentMembership(member.id);
      if (ms == null) return null;
      final planName = ms.planName ?? '';
      return (planName: planName, discountPct: 0.0);
    } catch (e) {
      debugPrint('getMemberActivePlan error: $e');
      return null;
    }
  }

  Future<List<Map<String, dynamic>>> getProgramsListing(String gymId) async {
    try {
      final data = await _get('/api/programs', queryParams: {'status': 'published'});
      return _extractList(data);
    } catch (e) {
      debugPrint('getProgramsListing error: $e');
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getSessionPackagesForService(
      String gymId, String trainerType) async {
    try {
      final data = await _get('/api/service-packages', queryParams: {
        'trainer_type': trainerType,
      });
      return _extractList(data);
    } catch (e) {
      debugPrint('getSessionPackagesForService error: $e');
      return [];
    }
  }

  Future<Map<String, int>> getServicePackageCounts(String gymId) async {
    try {
      final data = await _get('/api/service-packages');
      final list = _extractList(data);
      final counts = <String, int>{};
      for (final row in list) {
        final t = row['trainer_type'] as String?;
        if (t != null) counts[t] = (counts[t] ?? 0) + 1;
      }
      return counts;
    } catch (e) {
      debugPrint('getServicePackageCounts error: $e');
      return {};
    }
  }


  Future<List<Map<String, dynamic>>> getSessionPackagesListing(
      String gymId) async {
    try {
      final data = await _get('/api/plans', queryParams: {'plan_type': 'sessions'});
      return _extractList(data);
    } catch (e) {
      debugPrint('getSessionPackagesListing error: $e');
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> searchExplore(
      String gymId, String query) async {
    try {
      final data = await _get('/api/search', queryParams: {'q': query});
      return _extractList(data);
    } catch (e) {
      debugPrint('searchExplore error: $e');
      return [];
    }
  }

  // ── Content endpoints (banners, popups, etc.) ─────────────────────────────

  Future<List<Map<String, dynamic>>> getBanners() async {
    try {
      final data = await _get('/api/content/banners');
      return _extractList(data);
    } catch (_) {
      return [];
    }
  }

  Future<Map<String, dynamic>?> getActivePopup() async {
    try {
      final data = await _get('/api/content/popups');
      final list = _extractList(data);
      return list.isNotEmpty ? list.first : null;
    } catch (_) {
      return null;
    }
  }

  Future<List<Map<String, dynamic>>> getBranches() async {
    try {
      final data = await _get('/api/branches');
      return _extractList(data);
    } catch (_) {
      return [];
    }
  }

  // ── Helper ────────────────────────────────────────────────────────────────

  List<Map<String, dynamic>> _extractList(dynamic data) {
    if (data is List) return List<Map<String, dynamic>>.from(data);
    if (data is Map && data['data'] is List) {
      return List<Map<String, dynamic>>.from(data['data'] as List);
    }
    return [];
  }
}

// ── Result types ──────────────────────────────────────────────────────────────

class AuthResult {
  final String userId;
  final String email;
  final String? fullName;
  final Map<String, dynamic> userData;

  const AuthResult({
    required this.userId,
    required this.email,
    this.fullName,
    required this.userData,
  });
}

class ApiException implements Exception {
  final int statusCode;
  final String message;
  const ApiException({required this.statusCode, required this.message});

  @override
  String toString() => 'ApiException($statusCode): $message';
}
