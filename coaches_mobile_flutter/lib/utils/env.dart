/// Compile-time environment configuration.
/// All values must be passed via --dart-define (or --dart-define-from-file)
/// at build time. Mirrors gym_mobile_flutter/lib/utils/env.dart.
///
///   flutter run --dart-define-from-file=flavors/coaches.local.json
///   flutter build ipa --dart-define-from-file=flavors/coaches.json
///
/// NEVER hardcode actual values in this file.
abstract class Env {
  static const bool isStaging = bool.fromEnvironment('IS_STAGING');

  /// Base URL of the Laravel API (no trailing slash).
  static const String apiUrl = String.fromEnvironment('API_URL');

  /// Optional gym lock for a single-tenant coach build. Empty = the coach's
  /// gym is derived from their authenticated profile after login.
  static const String gymId = String.fromEnvironment('GYM_ID');

  /// Brand label for pre-login surfaces (splash / login).
  static const String brandName =
      String.fromEnvironment('BRAND_NAME', defaultValue: 'Coachesapp');

  /// Call once at startup to fail fast on a misconfigured build.
  static void validate() {
    if (apiUrl.isEmpty) {
      throw StateError('API_URL must be set via --dart-define');
    }
  }
}
