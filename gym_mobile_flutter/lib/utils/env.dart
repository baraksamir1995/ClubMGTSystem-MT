/// Compile-time environment configuration.
/// All values must be passed via --dart-define at build time.
///
/// White-label build (locked to one gym):
///   flutter build ipa \
///     --dart-define=API_URL=https://api.yourgym.com \
///     --dart-define=GYM_ID=your-gym-uuid \
///     --dart-define=IS_STAGING=false
///
/// NEVER hardcode actual values in this file.
abstract class Env {
  static const bool isStaging = bool.fromEnvironment('IS_STAGING');

  static const String apiUrl = String.fromEnvironment('API_URL');
  static const String gymId = String.fromEnvironment('GYM_ID');

  /// True when this is a white-label build locked to a specific gym.
  static bool get isWhiteLabel => gymId.isNotEmpty;

  /// Call this once at startup to catch misconfigured builds early.
  static void validate() {
    if (apiUrl.isEmpty) {
      throw StateError('API_URL must be set via --dart-define');
    }
    // GYM_ID is optional — empty = CLBY marketplace, set = white-label gym app
  }
}
