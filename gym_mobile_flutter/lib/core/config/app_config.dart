import '../../utils/env.dart';

/// App-level configuration for this gym's white-label build.
class AppConfig {
  AppConfig._();

  /// The gym this app instance belongs to.
  /// Set via --dart-define GYM_ID=<uuid> at build time.
  static String get gymId => Env.gymId;

  /// Base URL of the Laravel API (no trailing slash).
  /// Set via --dart-define API_URL=<url> at build time.
  static String get adminBaseUrl => Env.apiUrl;
}
