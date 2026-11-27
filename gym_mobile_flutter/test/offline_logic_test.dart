import 'dart:async';
import 'dart:io';

import 'package:clby/features/offline/offline_logic.dart';
import 'package:clby/services/api_service.dart';
import 'package:clby_offline/clby_offline.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

ApiException api(int code) => ApiException(statusCode: code, message: 'x');

void main() {
  group('cold-start error classification', () {
    test('only network / timeout / 5xx are network', () {
      for (final e in <Object>[
        const SocketException('x'), TimeoutException('x'), http.ClientException('x'),
        const HandshakeException('x'), api(500), api(503),
      ]) {
        expect(classifyLoadError(e), LoadErrorKind.network, reason: '$e');
      }
      expect(classifyLoadError(api(401)), LoadErrorKind.unauthorized);
      expect(classifyLoadError(api(403)), LoadErrorKind.forbidden);
      for (final e in <Object>[api(404), api(422), api(429), const FormatException('x')]) {
        expect(classifyLoadError(e), LoadErrorKind.other, reason: '$e');
      }
    });
  });

  group('shouldTryOfflineMode (online cold start untouched)', () {
    bool t({String? user = 'u', bool hasProfile = false, bool loading = false,
            bool guest = false, LoadErrorKind? err = LoadErrorKind.network}) =>
        shouldTryOfflineMode(userId: user, hasProfile: hasProfile, isLoading: loading,
            isGuest: guest, profileError: err);
    test('network failure for a restored session → try', () => expect(t(), isTrue));
    test('never when the profile loaded (normal online start)', () => expect(t(hasProfile: true), isFalse));
    test('never while still loading', () => expect(t(loading: true), isFalse));
    test('never signed out / guest', () {
      expect(t(user: null), isFalse);
      expect(t(guest: true), isFalse);
    });
    test('401 / 403 / other / no error → never', () {
      for (final e in [LoadErrorKind.unauthorized, LoadErrorKind.forbidden, LoadErrorKind.other, null]) {
        expect(t(err: e), isFalse, reason: '$e');
      }
    });
  });

  group('scanner path (PHASE3 §4)', () {
    ScanPath p({bool v2 = true, bool allowed = true, bool store = true, bool offline = false}) =>
        chooseScanPath(claimsV2: v2, policyAllows: allowed, storeOpen: store, offlineMode: offline);
    test('v2 + allowed + store → outbox (online or offline)', () {
      expect(p(), ScanPath.outbox);
      expect(p(offline: true), ScanPath.outbox);
    });
    test('online: v1 or policy off → today\'s flow unchanged', () {
      expect(p(v2: false), ScanPath.legacy);
      expect(p(allowed: false), ScanPath.legacy);
      expect(p(store: false), ScanPath.legacy);
    });
    test('offline: v1 or policy off → clear unavailable message', () {
      expect(p(v2: false, offline: true), ScanPath.unavailableOffline);
      expect(p(allowed: false, offline: true), ScanPath.unavailableOffline);
      expect(p(store: false, offline: true), ScanPath.unavailableOffline);
    });
    test('policy flag needs enabled AND allow_member_qr_offline', () {
      expect(memberQrOfflineAllowed(OfflinePolicy.fromJson({'enabled': true, 'allow_member_qr_offline': true})), isTrue);
      expect(memberQrOfflineAllowed(OfflinePolicy.fromJson({'enabled': true})), isFalse);
      expect(memberQrOfflineAllowed(OfflinePolicy.fromJson({'allow_member_qr_offline': true})), isFalse);
    });
    test('v2 claim detection (v1 posters stay online-only)', () {
      expect(BranchQr.claimsV2('{"type":"gym_access","gym_id":"g","branch_id":"b","token":"t"}'), isFalse);
      expect(BranchQr.claimsV2('{"type":"gym_access","v":2}'), isTrue);
      expect(BranchQr.claimsV2('gym:abc'), isFalse);
    });
  });

  group('verification fixes', () {
    test('HTML 5xx body → ApiException(5xx) → network → offline mode may be tried', () {
      Object? caught;
      try {
        decodeApiBody(502, '<html><body>Bad Gateway</body></html>');
      } catch (e) {
        caught = e;
      }
      expect(caught, isA<ApiException>().having((e) => e.statusCode, 'status', 502));
      expect(classifyLoadError(caught!), LoadErrorKind.network);
      expect(shouldTryOfflineMode(userId: 'u', hasProfile: false, isLoading: false,
          isGuest: false, profileError: classifyLoadError(caught)), isTrue);
    });
    test('HTML 403 / 401 bodies keep their status (no offline mode)', () {
      for (final s in [401, 403]) {
        Object? e;
        try {
          decodeApiBody(s, '<html>nope</html>');
        } catch (x) {
          e = x;
        }
        expect((e as ApiException).statusCode, s);
        expect(classifyLoadError(e), isNot(LoadErrorKind.network));
      }
    });
    test('JSON bodies and non-JSON 2xx behave as before', () {
      expect(decodeApiBody(500, '{"message":"x"}'), {'message': 'x'});
      expect(() => decodeApiBody(200, '<html>'), throwsFormatException);
    });
    test('stale snapshot: local pre-check only when actually offline', () {
      expect(shouldRunLocalPreCheck(offlineMode: false, online: true), isFalse,
          reason: 'online → server decides, cache never denies');
      expect(shouldRunLocalPreCheck(offlineMode: false, online: false), isTrue);
      expect(shouldRunLocalPreCheck(offlineMode: true, online: true), isTrue);
    });
    test('policy off → no status UI at all', () {
      for (final offline in [true, false]) {
        for (final online in [true, false]) {
          expect(shouldShowStatus(policyAllows: false, offlineMode: offline, online: online,
              pending: 3, failing: true), isFalse);
        }
      }
      expect(shouldShowStatus(policyAllows: true, offlineMode: false, online: true,
          pending: 0, failing: false), isFalse, reason: 'online + nothing pending → as today');
      expect(shouldShowStatus(policyAllows: true, offlineMode: true, online: false,
          pending: 0, failing: false), isTrue);
      expect(shouldShowStatus(policyAllows: true, offlineMode: false, online: true,
          pending: 1, failing: false), isTrue);
    });
    test('coach QR v2 claims also go through the outbox', () {
      expect(SpecialistQr.claimsV2('{"type":"specialist_session","gym_id":"g","trainer_id":"t"}'), isFalse);
      expect(SpecialistQr.claimsV2('{"type":"specialist_session","v":2}'), isTrue);
    });
  });
}
