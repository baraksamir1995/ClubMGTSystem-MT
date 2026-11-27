import 'dart:async';
import 'dart:io';

import 'package:clby_offline/clby_offline.dart' show OfflineEntryBlock;
import 'package:coachesapp/features/coach/load_error.dart';
import 'package:coachesapp/features/offline/offline_strings.dart';
import 'package:coachesapp/services/api_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

ApiException api(int code) => ApiException(statusCode: code, message: 'x');

void main() {
  group('only network failures may open offline mode (MEDIUM-4)', () {
    test('network / timeout / 5xx → network → try offline mode', () {
      for (final e in <Object>[
        const SocketException('no route'),
        TimeoutException('slow'),
        http.ClientException('reset'),
        const HandshakeException('tls'),
        api(500),
        api(502),
        api(503),
      ]) {
        expect(classifyLoadError(e), LoadErrorKind.network, reason: '$e');
        expect(homeErrorAction(classifyLoadError(e)), HomeErrorAction.tryOfflineMode);
      }
    });

    test('401 → sign-in flow, never offline mode', () {
      expect(classifyLoadError(api(401)), LoadErrorKind.unauthorized);
      expect(homeErrorAction(LoadErrorKind.unauthorized), HomeErrorAction.signIn);
    });

    test('403 (revoked access / inactive trainer profile) → blocked, never offline mode', () {
      expect(classifyLoadError(api(403)), LoadErrorKind.forbidden);
      expect(homeErrorAction(LoadErrorKind.forbidden), HomeErrorAction.blocked);
    });

    test('other 4xx / unknown errors → existing error screen', () {
      for (final e in <Object>[api(404), api(422), api(429), const FormatException('bad json'), StateError('x')]) {
        expect(homeErrorAction(classifyLoadError(e)), HomeErrorAction.showError, reason: '$e');
      }
      expect(homeErrorAction(null), HomeErrorAction.showError);
    });
  });

  test('every offline-entry block reason has a message (en + ar)', () {
    for (final b in OfflineEntryBlock.values) {
      final en = OfflineStrings.en.entryBlocked(b);
      final ar = OfflineStrings.ar.entryBlocked(b);
      expect(en, isNot(startsWith('block_')), reason: b.name);
      expect(ar, isNot(startsWith('block_')), reason: b.name);
      expect(en, isNot(ar));
    }
  });
}
