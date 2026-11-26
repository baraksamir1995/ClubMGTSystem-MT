import 'dart:async';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../../services/api_service.dart';

/// What kind of failure stopped the coach shell from loading.
enum LoadErrorKind {
  /// No connection / DNS / TLS / timeout / 5xx — the ONLY kind that may
  /// open offline mode (PHASE2 verification MEDIUM-4).
  network,
  /// 401 — the session is gone: normal sign-in flow.
  unauthorized,
  /// 403 — coach access revoked / trainer profile inactive / not a coach:
  /// blocked screen, never offline mode; the sync engine is paused.
  forbidden,
  /// Anything else (4xx, parse errors…): the existing error screen.
  other,
}

LoadErrorKind classifyLoadError(Object e) {
  if (e is ApiException) {
    if (e.statusCode == 401) return LoadErrorKind.unauthorized;
    if (e.statusCode == 403) return LoadErrorKind.forbidden;
    if (e.statusCode >= 500) return LoadErrorKind.network;
    return LoadErrorKind.other;
  }
  if (e is SocketException ||
      e is TimeoutException ||
      e is http.ClientException ||
      e is HandshakeException) {
    return LoadErrorKind.network;
  }
  return LoadErrorKind.other;
}

/// What the home shell does about a failed first load.
enum HomeErrorAction { tryOfflineMode, signIn, blocked, showError }

HomeErrorAction homeErrorAction(LoadErrorKind? kind) => switch (kind) {
      LoadErrorKind.network => HomeErrorAction.tryOfflineMode,
      LoadErrorKind.unauthorized => HomeErrorAction.signIn,
      LoadErrorKind.forbidden => HomeErrorAction.blocked,
      LoadErrorKind.other || null => HomeErrorAction.showError,
    };
