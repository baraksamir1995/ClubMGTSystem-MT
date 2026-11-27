import 'package:flutter_timezone/flutter_timezone.dart';

/// Returns the device's IANA zone name (e.g. `Africa/Cairo`).
typedef TimezoneResolver = Future<String> Function();

/// Default resolver: platform zone via flutter_timezone, falling back to
/// [fallbackTimezone] if the plugin isn't available (tests, desktop).
Future<String> resolveDeviceTimezone() async {
  try {
    final info = await FlutterTimezone.getLocalTimezone();
    final id = info.identifier;
    if (id.isNotEmpty) return id;
  } catch (_) {}
  return fallbackTimezone(DateTime.now());
}

/// IANA-valid fallback derived from the current UTC offset: `UTC` or
/// `Etc/GMT±N` (POSIX-inverted sign: UTC+2 → `Etc/GMT-2`). Non-whole-hour
/// offsets fall back to `UTC`; the offset in `device_recorded_at` is
/// authoritative for the instant either way.
String fallbackTimezone(DateTime now) {
  final off = (now.isUtc ? now.toLocal() : now).timeZoneOffset;
  if (off == Duration.zero) return 'UTC';
  if (off.inMinutes % 60 != 0) return 'UTC';
  final h = off.inHours;
  return h > 0 ? 'Etc/GMT-$h' : 'Etc/GMT+${-h}';
}
