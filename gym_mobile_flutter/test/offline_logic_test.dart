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

  group('offline-mode routing', () {
    test('inactive when online (no redirect ever)', () {
      for (final loc in ['/home', '/checkin', '/profile', '/offline', '/member-pass']) {
        expect(offlineRedirect(offlineMode: false, location: loc), isNull);
      }
    });
    test('offline: only pass / check-ins / offline home', () {
      expect(offlineRedirect(offlineMode: true, location: '/home'), '/offline');
      expect(offlineRedirect(offlineMode: true, location: '/explore'), '/offline');
      for (final loc in offlineRoutes) {
        expect(offlineRedirect(offlineMode: true, location: loc), isNull);
      }
    });
  });
}
