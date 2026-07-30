import 'package:flutter/material.dart';
import '../models/coach_profile.dart';
import '../services/api_service.dart';
import '../utils/error_utils.dart';

/// Owns auth state for the coach app: session restore on launch, login,
/// logout, and the loaded coach profile. No registration — credentials are
/// created from the gym dashboard.
class AuthProvider extends ChangeNotifier {
  final ApiService _service;

  /// Invoked whenever a coach profile loads, with the coach's gym_id —
  /// BrandingProvider hooks this to (re)fetch the gym's dashboard branding.
  final void Function(String? gymId)? onGymResolved;

  String? _userId;
  CoachProfile? _profile;
  bool _isLoading = false;
  String? _error;

  AuthProvider(this._service, {this.onGymResolved}) {
    _init();
  }

  String? get userId => _userId;
  CoachProfile? get profile => _profile;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isAuthenticated => _userId != null;

  /// Restore a prior session from secure storage on cold start.
  Future<void> _init() async {
    _isLoading = true;
    try {
      if (await _service.hasSession()) {
        await _service.loadCachedUserId();
        _userId = _service.currentUserId;
        if (_userId != null) {
          await _loadProfile();
          return;
        }
      }
    } finally {
      if (_userId == null) {
        _isLoading = false;
        notifyListeners();
      }
    }
  }

  Future<void> _loadProfile() async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      _profile = await _service.getProfile();
      if (_profile?.gymId != null) onGymResolved?.call(_profile!.gymId);
    } on ApiException catch (e) {
      if (e.statusCode == 401) {
        // Token expired/revoked server-side. ApiService already cleared
        // storage; drop local state so the router routes to /login.
        _userId = null;
        _profile = null;
      } else {
        _error = friendlyError(e);
      }
    } catch (e) {
      _error = friendlyError(e);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Returns null on success, or a user-facing error message.
  /// Field is labeled "USERNAME" in the UI; the backend matches it
  /// against either a numeric username or an email.
  Future<String?> signIn(String username, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final result = await _service.signIn(username, password);
      _userId = result.userId;
      if (_userId != null) {
        await _loadProfile();
      }
      return null;
    } on ApiException catch (e) {
      _error = e.message;
      _isLoading = false;
      notifyListeners();
      return e.message;
    } catch (e) {
      _error = friendlyError(e);
      _isLoading = false;
      notifyListeners();
      return friendlyError(e);
    }
  }

  Future<void> signOut() async {
    await _service.signOut();
    _userId = null;
    _profile = null;
    _error = null;
    notifyListeners();
  }

  Future<void> refreshProfile() => _loadProfile();

  Future<String?> requestPasswordReset(String email) async {
    try {
      await _service.resetPasswordForEmail(email);
      return null;
    } catch (e) {
      return friendlyError(e);
    }
  }
}
