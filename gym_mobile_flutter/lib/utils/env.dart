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

  /// Display name for splash, welcome, and any pre-login surface that needs a
  /// brand label. Defaults to 'CLBY' so the marketplace flavor renders correctly
  /// even if a flavor file forgets to set it.
  static const String brandName =
      String.fromEnvironment('BRAND_NAME', defaultValue: 'CLBY');

  /// Hex color (with or without leading #) used as the app primary in
  /// white-label builds. Empty for the marketplace flavor — there the per-gym
  /// primaryColor from the API takes over after login.
  static const String brandPrimaryHex = String.fromEnvironment('BRAND_PRIMARY');

  /// Asset path of the in-app logo used by splash and any default-mark surface.
  /// Defaults to the clby logo so the marketplace flavor works without an
  /// explicit override.
  static const String brandLogoAsset = String.fromEnvironment(
    'BRAND_LOGO_ASSET',
    defaultValue: 'assets/clby_logo.png',
  );

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
