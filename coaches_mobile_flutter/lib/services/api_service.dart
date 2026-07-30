import 'dart:async';
import 'dart:io';
import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import '../features/coach/models.dart';
import '../models/coach_profile.dart';
import '../utils/env.dart';

const _storage = FlutterSecureStorage();
const _tokenKey = 'auth_token';
const _userIdKey = 'user_id';

/// Auth-scoped API client for the coach app. Mirrors the generic HTTP
/// helpers and token/401 conventions of gym_mobile_flutter's ApiService,
/// trimmed to just what the login → session-restore → profile flow needs.
/// There is no registration endpoint — coach credentials are provisioned
/// from the gym dashboard (gym-admin).
class ApiService {
  // One shared client so the connection pool / TLS session is reused
  // across requests (HTTP keep-alive).
  static final http.Client _http = http.Client();

  String get _baseUrl => Env.apiUrl;

  Future<String?> get _token => _storage.read(key: _tokenKey);

  String? _cachedUserId;
  String? get currentUserId => _cachedUserId;

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

  // ── HTTP helpers ───────────────────────────────────────────────────────────

  static const _timeout = Duration(seconds: 15);

  Future<dynamic> _get(String path, {Map<String, String>? queryParams}) async {
    final uri =
        Uri.parse('$_baseUrl$path').replace(queryParameters: queryParams);
    return _withRetry(() => _runWithTimeout(() async {
          final response = await _http.get(uri, headers: await _headers);
          return _parse(response);
        }));
  }

  /// GET for PUBLIC endpoints: no Authorization header, and a 401/4xx can
  /// never touch the stored session. A pre-login branding fetch that 401s
  /// (auth posture change, proxy misconfig) must not log the coach out —
  /// `_parse` clears the token on 401, which is only correct for calls made
  /// AS the coach.
  Future<dynamic> _getPublic(String path) async {
    final uri = Uri.parse('$_baseUrl$path');
    return _withRetry(() => _runWithTimeout(() async {
          final response = await _http.get(uri, headers: const {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          });
          if (response.body.isEmpty) return <String, dynamic>{};
          final body = jsonDecode(response.body);
          if (response.statusCode >= 400) {
            throw ApiException(
              statusCode: response.statusCode,
              message: (body is Map
                      ? (body['error'] ?? body['message'])?.toString()
                      : null) ??
                  'Unknown error',
            );
          }
          return body;
        }));
  }

  Future<dynamic> _post(String path, [Map<String, dynamic>? body]) async {
    final uri = Uri.parse('$_baseUrl$path');
    return _runWithTimeout(() async {
      final response = await _http.post(
        uri,
        headers: await _headers,
        body: body != null ? jsonEncode(body) : null,
      );
      return _parse(response);
    });
  }

  Future<dynamic> _patch(String path, [Map<String, dynamic>? body]) async {
    final uri = Uri.parse('$_baseUrl$path');
    return _runWithTimeout(() async {
      final response = await _http.patch(
        uri,
        headers: await _headers,
        body: body != null ? jsonEncode(body) : null,
      );
      return _parse(response);
    });
  }

  Future<T> _runWithTimeout<T>(Future<T> Function() op) =>
      Future.sync(op).timeout(_timeout);

  /// One transparent retry for transient network errors on idempotent GETs.
  Future<T> _withRetry<T>(Future<T> Function() op) async {
    try {
      return await op();
    } on SocketException {
      await Future.delayed(const Duration(milliseconds: 600));
      return await op();
    } on http.ClientException {
      await Future.delayed(const Duration(milliseconds: 600));
      return await op();
    }
  }

  Future<dynamic> _parse(http.Response response) async {
    if (response.body.isEmpty) return <String, dynamic>{};
    final body = jsonDecode(response.body);
    if (response.statusCode >= 400) {
      if (response.statusCode == 401) {
        // Sanctum tokens expire after 24h. Clear stale credentials so the
        // next app start can't loop on a dead token.
        await _storage.delete(key: _tokenKey);
        await _storage.delete(key: _userIdKey);
        _cachedUserId = null;
      }
      String msg = 'Unknown error';
      String? code;
      Map<String, dynamic>? extra;
      if (body is Map) {
        // Errors come back as either {error: '...', code: '...', ...}
        // (newer coach controllers) or {message: '...'} (legacy / auth).
        msg = (body['error'] ?? body['message'])?.toString() ?? 'Unknown error';
        code = body['code']?.toString();
        // Surface a small whitelist of extra fields the UI may need
        // (e.g. minutes_left + last_delivered_at on the 30-min guard).
        final m = <String, dynamic>{};
        for (final k in const ['minutes_left', 'last_delivered_at']) {
          if (body.containsKey(k)) m[k] = body[k];
        }
        if (m.isNotEmpty) extra = m;
      }
      throw ApiException(
        statusCode: response.statusCode,
        message: msg,
        code: code,
        extra: extra,
      );
    }
    return body;
  }

  // ── Auth ───────────────────────────────────────────────────────────────────

  /// Signs a coach in and persists the token + user id to secure storage.
  /// The login screen labels the field "USERNAME" — the value is sent as
  /// `username`, which the backend matches against either the numeric
  /// `profiles.username` column or `profiles.email` (case-insensitive).
  Future<AuthResult> signIn(String username, String password) async {
    final data = await _post('/api/auth/login', {
      'username': username,
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
      email: user['email'] as String? ?? username,
      fullName: user['full_name'] as String?,
      userData: user,
    );
  }

  Future<void> signOut() async {
    try {
      await _post('/api/auth/logout');
    } catch (_) {
      // Best-effort — clear local state regardless.
    }
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _userIdKey);
    _cachedUserId = null;
  }

  Future<void> resetPasswordForEmail(String email) async {
    await _post('/api/auth/forgot-password', {'email': email});
  }

  /// True when a stored auth token exists.
  Future<bool> hasSession() async {
    final token = await _storage.read(key: _tokenKey);
    return token != null && token.isNotEmpty;
  }

  // ── Profile ────────────────────────────────────────────────────────────────

  Future<CoachProfile?> getProfile() async {
    final data = await _get('/api/me');
    if (data == null) return null;
    return CoachProfile.fromJson(data as Map<String, dynamic>);
  }

  /// `GET /api/gyms/{id}` — public gym card (name, logo, branding_config).
  /// No auth required; used to brand the pre-login surfaces. Routed through
  /// [_getPublic] so it sends no token and can never clear the session.
  Future<Map<String, dynamic>> getGymPublic(String gymId) async {
    final data = await _getPublic('/api/gyms/$gymId');
    return data as Map<String, dynamic>;
  }

  // ── Coach app ──────────────────────────────────────────────────────────────

  /// `GET /api/coach/me` — the specialist's own card.
  Future<CoachIdentity> getCoachIdentity() async {
    final data = await _get('/api/coach/me');
    return CoachIdentity.fromJson(data as Map<String, dynamic>);
  }

  /// `GET /api/coach/roster` — every assignment owned by the logged-in
  /// coach, with member + package info and the last-session timestamp.
  Future<List<CoachAssignment>> getCoachRoster() async {
    final data = await _get('/api/coach/roster');
    final list = (data is Map<String, dynamic>)
        ? (data['data'] as List?) ?? []
        : (data as List?) ?? [];
    return list
        .map((e) => CoachAssignment.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// `POST /api/coach/sessions/decrement` — log a session, decrementing
  /// the assignment's `sessions_used`. Server enforces the 30-minute
  /// guard; a 409 with `code: recently_logged` carries `minutes_left`.
  /// Returns the new sessions_used + remaining + the log id.
  Future<Map<String, dynamic>> decrementSession({
    required String assignmentId,
    String? note,
  }) async {
    final data = await _post('/api/coach/sessions/decrement', {
      'assignment_id': assignmentId,
      if (note != null && note.isNotEmpty) 'note': note,
    });
    final j = (data is Map<String, dynamic> && data['data'] is Map<String, dynamic>)
        ? data['data'] as Map<String, dynamic>
        : (data as Map<String, dynamic>);
    return j;
  }

  /// `GET /api/coach/today` — today's logged sessions for this coach.
  Future<List<TodayLogEntry>> getCoachToday() async {
    final data = await _get('/api/coach/today');
    final list = (data is Map<String, dynamic>)
        ? (data['data'] as List?) ?? []
        : (data as List?) ?? [];
    return list
        .map((e) => TodayLogEntry.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// `GET /api/coach/assignments/{id}/history` — recent sessions logged
  /// against this assignment, capped server-side at 50.
  Future<List<AssignmentHistoryItem>> getAssignmentHistory(String assignmentId) async {
    final data = await _get('/api/coach/assignments/$assignmentId/history');
    final list = (data is Map<String, dynamic>)
        ? (data['data'] as List?) ?? []
        : (data as List?) ?? [];
    return list
        .map((e) => AssignmentHistoryItem.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// `PATCH /api/coach/sessions/{logId}` — update the note on a delivered
  /// session. Pass an empty string (or null) to clear it.
  Future<void> updateSessionNote({
    required String logId,
    required String? note,
  }) async {
    await _patch('/api/coach/sessions/$logId', {
      'note': note,
    });
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
  /// API-supplied semantic code (e.g. `recently_logged`, `not_active`,
  /// `email_taken`). Lets the UI branch without parsing `message`.
  final String? code;
  /// Server-supplied extra fields whitelisted in `_parse` — currently
  /// `minutes_left` + `last_delivered_at` for the 30-min guard 409.
  final Map<String, dynamic>? extra;

  const ApiException({
    required this.statusCode,
    required this.message,
    this.code,
    this.extra,
  });

  @override
  String toString() =>
      'ApiException($statusCode${code != null ? '/$code' : ''}): $message';
}
