import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:flutter/foundation.dart';

/// Thin wrapper around FirebaseAnalytics.
///
/// Usage:
///   AnalyticsService.instance.logEvent('booking_created', params: {...});
///   AnalyticsService.instance.setUserId('user-uuid');
///
/// In debug builds, events are logged to stdout and not sent to Firebase.
class AnalyticsService {
  AnalyticsService._();

  static final AnalyticsService instance = AnalyticsService._();
  final FirebaseAnalytics _analytics = FirebaseAnalytics.instance;

  FirebaseAnalyticsObserver get observer =>
      FirebaseAnalyticsObserver(analytics: _analytics);

  Future<void> setUserId(String? userId) async {
    await _analytics.setUserId(id: userId);
    if (kDebugMode) debugPrint('[Analytics] setUserId: $userId');
  }

  Future<void> setUserProperty(String name, String? value) async {
    await _analytics.setUserProperty(name: name, value: value);
    if (kDebugMode) debugPrint('[Analytics] setUserProperty $name=$value');
  }

  Future<void> logEvent(String name, {Map<String, Object>? params}) async {
    await _analytics.logEvent(name: name, parameters: params);
    if (kDebugMode) debugPrint('[Analytics] $name ${params ?? ''}');
  }

  // ─── Named event helpers ────────────────────────────────────────────────

  Future<void> logLogin({String method = 'email'}) =>
      _analytics.logLogin(loginMethod: method);

  Future<void> logSignUp({String method = 'email'}) =>
      _analytics.logSignUp(signUpMethod: method);

  Future<void> logScreenView(String screenName) =>
      _analytics.logScreenView(screenName: screenName);

  Future<void> logGymSelected(String gymId, String gymName) => logEvent(
        'gym_selected',
        params: {'gym_id': gymId, 'gym_name': gymName},
      );

  Future<void> logBookingCreated({
    required String sessionId,
    required String className,
  }) =>
      logEvent('booking_created', params: {
        'session_id': sessionId,
        'class_name': className,
      });

  Future<void> logBookingCancelled({required String sessionId}) =>
      logEvent('booking_cancelled', params: {'session_id': sessionId});

  Future<void> logMembershipPurchased({
    required String planId,
    required String planName,
    required double amount,
    required String currency,
  }) =>
      logEvent('membership_purchased', params: {
        'plan_id': planId,
        'plan_name': planName,
        'value': amount,
        'currency': currency,
      });

  Future<void> logPaymentStarted({
    required String paymentId,
    required double amount,
    required String currency,
  }) =>
      logEvent('payment_started', params: {
        'payment_id': paymentId,
        'value': amount,
        'currency': currency,
      });

  Future<void> logPaymentSuccess({
    required String paymentId,
    required double amount,
    required String currency,
  }) =>
      logEvent('payment_success', params: {
        'payment_id': paymentId,
        'value': amount,
        'currency': currency,
      });

  Future<void> logPaymentFailed({
    required String paymentId,
    required String reason,
  }) =>
      logEvent('payment_failed', params: {
        'payment_id': paymentId,
        'reason': reason,
      });

  Future<void> logCheckIn({required String method}) =>
      logEvent('check_in', params: {'method': method});

  Future<void> logGuestModeEntered() => logEvent('guest_mode_entered');
}
