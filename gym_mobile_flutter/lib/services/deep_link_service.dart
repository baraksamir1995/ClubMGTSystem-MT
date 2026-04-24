import 'dart:async';
import 'package:app_links/app_links.dart';
import 'package:flutter/foundation.dart';

/// Handles incoming `gymapp://` deep links.
/// Callback receives (host, queryParams) so the app can route appropriately.
class DeepLinkService {
  DeepLinkService._();
  static final DeepLinkService instance = DeepLinkService._();

  final AppLinks _appLinks = AppLinks();
  StreamSubscription<Uri>? _sub;
  void Function(Uri uri)? _onLink;

  Future<void> init(void Function(Uri uri) onLink) async {
    _onLink = onLink;

    // Cold-start link (app launched by the URL)
    try {
      final initial = await _appLinks.getInitialLink();
      if (initial != null) _onLink?.call(initial);
    } catch (e, st) {
      debugPrint('DeepLinkService initial link error: $e\n$st');
    }

    // Warm-start links (app already running)
    _sub = _appLinks.uriLinkStream.listen(
      (uri) => _onLink?.call(uri),
      onError: (Object e) => debugPrint('DeepLinkService stream error: $e'),
    );
  }

  Future<void> dispose() async {
    await _sub?.cancel();
    _sub = null;
  }
}
