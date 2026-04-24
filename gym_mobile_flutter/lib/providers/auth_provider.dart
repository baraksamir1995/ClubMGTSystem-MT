import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/gym_model.dart';
import '../models/member_model.dart';
import '../services/notification_service.dart';
import '../services/api_service.dart';
import '../services/analytics_service.dart';
import '../utils/env.dart';
import '../utils/error_utils.dart';

const _storage = FlutterSecureStorage();
const _gymLogoKey  = 'cached_gym_logo_url';
const _gymNameKey  = 'cached_gym_name';
const _fcmTokenKey = 'cached_fcm_token';

class AuthProvider extends ChangeNotifier with WidgetsBindingObserver {
  final ApiService _service;

  String? _userId;
  Profile? _profile;
  Gym? _gym;
  bool _isLoading = false;
  bool _isGuest = false;
  bool _isPasswordRecovery = false;
  String? _recoveryToken;
  String? _error;

  AuthProvider(this._service) {
    WidgetsBinding.instance.addObserver(this);
    _init();
  }

  String? get userId => _userId;
  Profile? get profile => _profile;
  Gym? get gym => _gym;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isAuthenticated => _userId != null;
  bool get isGuest => _isGuest;
  bool get isPasswordRecovery => _isPasswordRecovery;
  String? get recoveryToken => _recoveryToken;

  Future<void> _init() async {
    // Flip isLoading synchronously so anything listening (e.g. AppBootstrap
    // waiting for auth) knows a session check is in flight. Without this,
    // fire-and-forget init would let _waitForAuth return immediately and
    // bootstrap would skip all preloads.
    _isLoading = true;
    try {
      final hasToken = await _service.hasSession();
      if (hasToken) {
        await _service.loadCachedUserId();
        _userId = _service.currentUserId;
        if (_userId != null) {
          await _loadProfileAndGym();
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

  Future<void> _loadProfileAndGym() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _profile = await _service.getMemberProfile();

      // Register FCM token
      if (_userId != null) {
        final token = await NotificationService().getFcmToken();
        if (token != null) {
          final cachedToken = await _storage.read(key: _fcmTokenKey);
          if (token != cachedToken) {
            try {
              await _service.updateFcmToken(token);
            } catch (_) {
              // Best-effort — FCM token update is non-critical
            }
            await _storage.write(key: _fcmTokenKey, value: token);
          }
        }
      }

      if (_profile?.gymId != null) {
        _gym = await _service.getGymInfo(_profile!.gymId!);
        // Cache gym branding for splash screen
        if (_gym?.logoUrl != null) {
          await _storage.write(key: _gymLogoKey, value: _gym!.logoUrl);
        }
        if (_gym?.name != null) {
          await _storage.write(key: _gymNameKey, value: _gym!.name);
        }
      }
    } catch (e) {
      _error = friendlyError(e);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> continueAsGuest() async {
    assert(Env.gymId.isNotEmpty, 'GYM_ID must be set via --dart-define at build time');

    _isGuest = true;
    _isLoading = true;
    notifyListeners();
    try {
      _gym = await _service.getGymInfo(Env.gymId);
      AnalyticsService.instance.logGuestModeEntered();
    } catch (e) {
      _error = 'Failed to load gym: ${friendlyError(e)}';
    }
    _isLoading = false;
    notifyListeners();
  }

  void exitGuestMode() {
    _isGuest = false;
    _gym = null;
    notifyListeners();
  }

  Future<String?> signIn(String email, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final result = await _service.signIn(email, password);
      _userId = result.userId;
      if (_userId != null) {
        await _loadProfileAndGym();
        AnalyticsService.instance.logLogin();
        AnalyticsService.instance.setUserId(_userId);
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
    AnalyticsService.instance.logEvent('logout');
    AnalyticsService.instance.setUserId(null);
    _userId = null;
    _profile = null;
    _gym = null;
    _error = null;
    _isGuest = false;
    _isPasswordRecovery = false;
    notifyListeners();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _profile?.gymId != null) {
      _refreshGym();
    }
  }

  Future<void> _refreshGym() async {
    if (_profile?.gymId == null) return;
    try {
      _gym = await _service.getGymInfo(_profile!.gymId!);
      notifyListeners();
    } catch (_) {}
  }

  Future<void> refreshProfile() async {
    await _loadProfileAndGym();
  }

  Future<String?> updateProfile(
      String fullName, String phone, DateTime? dateOfBirth) async {
    try {
      await _service.updateProfile(fullName, phone, dateOfBirth);
      _profile = _profile?.copyWith(
          fullName: fullName, phone: phone, dateOfBirth: dateOfBirth);
      notifyListeners();
      return null;
    } catch (e) {
      return friendlyError(e);
    }
  }

  Future<String?> uploadAvatar(String filePath) async {
    try {
      final url = await _service.uploadAvatar(filePath);
      _profile = _profile?.copyWith(avatarUrl: url);
      notifyListeners();
      return null;
    } catch (e) {
      return friendlyError(e);
    }
  }

  Future<String?> deleteAccount() async {
    try {
      await _service.deleteAccount();
      _userId = null;
      _profile = null;
      _gym = null;
      _error = null;
      notifyListeners();
      return null;
    } catch (e) {
      return friendlyError(e);
    }
  }

  Future<String?> changePassword(String newPassword) async {
    try {
      await _service.changePassword(newPassword);
      return null;
    } on ApiException catch (e) {
      return e.message;
    } catch (e) {
      return friendlyError(e);
    }
  }

  void startPasswordRecovery(String token) {
    _recoveryToken = token;
    _isPasswordRecovery = true;
    notifyListeners();
  }

  void clearPasswordRecovery() {
    _isPasswordRecovery = false;
    _recoveryToken = null;
    notifyListeners();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}
