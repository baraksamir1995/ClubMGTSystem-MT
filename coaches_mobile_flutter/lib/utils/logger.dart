import 'package:flutter/foundation.dart';

/// Debug-only logger. No-op in release builds.
void appLog(String message) {
  if (kDebugMode) {
    debugPrint(message);
  }
}
