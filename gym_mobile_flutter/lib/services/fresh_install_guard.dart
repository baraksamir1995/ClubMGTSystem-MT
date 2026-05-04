import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Wipes secure-storage on the first launch after a fresh install.
///
/// iOS Keychain entries (used by `flutter_secure_storage`) survive an
/// app uninstall by default — auth tokens, the onboarding-completed
/// flag, and cached gym branding all stick around even though the user
/// just deleted the app.
///
/// `SharedPreferences`, on the other hand, IS cleared on uninstall.
/// We use it as a sentinel: if the marker is missing, this is a clean
/// install and we wipe the keychain so the experience matches what
/// the user expects.
class FreshInstallGuard {
  static const _markerKey = 'install_marker_v1';

  /// Run once at app startup before any other secure-storage reads.
  static Future<void> runOnFirstInstall() async {
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool(_markerKey) == true) return;

    try {
      await const FlutterSecureStorage().deleteAll();
    } catch (_) {
      // If deleteAll fails for any reason we still mark the install as
      // seen — retrying on every launch would be worse.
    }
    await prefs.setBool(_markerKey, true);
  }
}
