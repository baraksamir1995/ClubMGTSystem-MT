import 'dart:async';
import 'dart:io';

import 'package:package_info_plus/package_info_plus.dart';

import '../identity/device_identity.dart';
import '../scope.dart';
import '../store/offline_store.dart';

/// App/device identity sent on every API call (CONTRACT §5 headers):
/// `X-Device-Id`, `X-App`, `X-App-Version`, `X-App-Build`, `X-App-Platform`.
///
/// Call [ClientInfo.init] once in `main()` (after FreshInstallGuard); API
/// clients read the synchronous [ClientInfo.headers]. Never throws; a
/// missing piece is simply omitted and retried by [ensureDeviceId].
class ClientInfo {
  ClientInfo._({
    required this.app,
    required this.appVersion,
    required this.appBuild,
    required this.platform,
    required this.deviceIdentity,
  });

  static ClientInfo? _instance;

  /// The initialised instance (null before [init]).
  static ClientInfo? get instance => _instance;

  /// Headers for the current process; empty before [init].
  static Map<String, String> get headers => _instance?.toHeaders() ?? const {};

  final OfflineApp app;
  final String appVersion;
  final String appBuild;
  final String platform;
  final DeviceIdentity deviceIdentity;

  String? get deviceId => deviceIdentity.current;

  static Future<ClientInfo> init({
    required OfflineApp app,
    DeviceIdentity? deviceIdentity,
    Duration timeout = const Duration(seconds: 4),
  }) async {
    var version = '0.0.0', build = '0';
    try {
      final info = await PackageInfo.fromPlatform().timeout(timeout);
      version = info.version.isEmpty ? version : info.version;
      build = info.buildNumber.isEmpty ? build : info.buildNumber;
    } catch (_) {}
    DeviceIdentity identity;
    if (deviceIdentity != null) {
      identity = deviceIdentity;
    } else {
      Directory dir;
      try {
        dir = await defaultOfflineDirectory();
      } catch (_) {
        dir = Directory.systemTemp;
      }
      identity = DeviceIdentity(mirrorDirectory: dir);
    }
    final ci = ClientInfo._(
      app: app,
      appVersion: version,
      appBuild: build,
      platform: Platform.isIOS
          ? 'ios'
          : Platform.isAndroid
              ? 'android'
              : Platform.operatingSystem,
      deviceIdentity: identity,
    );
    _instance = ci;
    try {
      await identity.load().timeout(timeout);
    } catch (_) {/* retried by ensureDeviceId() */}
    return ci;
  }

  /// Loads the device id if [init] couldn't. Throws OfflineStoreUnavailable
  /// (deviceIdUnavailable) when secure storage is unreadable.
  Future<String> ensureDeviceId() => deviceIdentity.load();

  Map<String, String> toHeaders() => {
        'X-App': app.wire,
        'X-App-Version': appVersion,
        'X-App-Build': appBuild,
        'X-App-Platform': platform,
        'X-Device-Id': ?deviceId,
      };
}
