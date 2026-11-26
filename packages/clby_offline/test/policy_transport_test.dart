import 'package:clby_offline/clby_offline.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('OfflinePolicy', () {
    test('defaults match CONTRACT §4', () {
      const p = OfflinePolicy.defaults;
      expect(p.toJson(), {
        'enabled': false, 'max_batch': 50, 'max_data_age_hours': 24,
        'max_event_age_days': 7, 'future_skew_seconds': 300,
        'allow_manual_offline': true, 'allow_staff_qr_offline': true,
        'allow_member_qr_offline': false, 'allow_service_session_offline': true,
        'expired_cache_policy': 'warn', 'retry_base_seconds': 5, 'retry_max_seconds': 900,
      });
    });

    test('garbage falls back to defaults; numbers clamped', () {
      expect(OfflinePolicy.fromJson(null).enabled, isFalse);
      expect(OfflinePolicy.fromJsonString('{not json').maxBatch, 50);
      final p = OfflinePolicy.fromJson({
        'enabled': 1, 'max_batch': 0, 'retry_base_seconds': '10',
        'retry_max_seconds': 2, 'expired_cache_policy': 'explode', 'allow_manual_offline': 'false',
      });
      expect(p.enabled, isTrue);
      expect(p.maxBatch, 1);
      expect(p.retryBaseSeconds, 10);
      expect(p.retryMaxSeconds, 10, reason: 'max ≥ base');
      expect(p.expiredCachePolicy, 'warn');
      expect(p.allowManualOffline, isFalse);
    });
  });

  group('Backoff', () {
    test('exponential schedule with cap (raw)', () {
      final b = Backoff(base: const Duration(seconds: 5), max: const Duration(seconds: 900));
      expect([for (var i = 1; i <= 10; i++) b.rawDelay(i).inSeconds],
          [5, 10, 20, 40, 80, 160, 320, 640, 900, 900]);
      expect(b.rawDelay(1000).inSeconds, 900);
    });

    test('equal jitter keeps delay in [raw/2, raw)', () {
      final lo = Backoff(base: const Duration(seconds: 5), max: const Duration(minutes: 15), random: () => 0);
      final hi = Backoff(base: const Duration(seconds: 5), max: const Duration(minutes: 15), random: () => 0.999999);
      for (var a = 1; a <= 12; a++) {
        final raw = lo.rawDelay(a).inMilliseconds;
        expect(lo.delay(a).inMilliseconds, raw ~/ 2);
        expect(hi.delay(a).inMilliseconds, lessThanOrEqualTo(raw));
        expect(hi.delay(a).inMilliseconds, greaterThan(raw * 0.99));
      }
    });
  });

  group('JsonSyncTransport.mapResponse', () {
    TransportResponse r(int s, String b, [Map<String, String> h = const {}]) =>
        TransportResponse(s, b, headers: h);

    test('200 → map', () {
      expect(JsonSyncTransport.mapResponse(r(200, '{"results":[]}')), {'results': []});
    });
    test('2xx with junk body → server error (retry)', () {
      expect(() => JsonSyncTransport.mapResponse(r(200, '<html>')),
          throwsA(isA<SyncServerError>()));
    });
    test('401 → SyncAuthRequired', () {
      expect(() => JsonSyncTransport.mapResponse(r(401, '{"message":"Unauthenticated."}')),
          throwsA(isA<SyncAuthRequired>()));
    });
    test('403 device_revoked → SyncForbidden(deviceRevoked)', () {
      expect(() => JsonSyncTransport.mapResponse(r(403, '{"code":"device_revoked"}')),
          throwsA(isA<SyncForbidden>().having((e) => e.deviceRevoked, 'revoked', isTrue)));
      expect(() => JsonSyncTransport.mapResponse(r(403, '{"message":"nope"}')),
          throwsA(isA<SyncForbidden>().having((e) => e.deviceRevoked, 'revoked', isFalse)));
    });
    test('429 → SyncRateLimited with Retry-After', () {
      expect(() => JsonSyncTransport.mapResponse(r(429, '', {'retry-after': '30'})),
          throwsA(isA<SyncRateLimited>()
              .having((e) => e.retryAfter, 'ra', const Duration(seconds: 30))));
    });
    test('5xx / 422 / 408', () {
      expect(() => JsonSyncTransport.mapResponse(r(503, '')), throwsA(isA<SyncServerError>()));
      expect(() => JsonSyncTransport.mapResponse(r(422, '{"message":"bad"}')),
          throwsA(isA<SyncRequestError>()));
      expect(() => JsonSyncTransport.mapResponse(r(408, '')), throwsA(isA<SyncTimeout>()));
    });

    test('send() failures map to typed errors; paths match CONTRACT', () async {
      final tr = _Tr();
      tr.next = () => throw const _Sock();
      await expectLater(tr.sync(const SyncRequest(deviceId: 'd', app: 'coach', appVersion: '1', events: [])),
          throwsA(isA<SyncNetworkError>()));
      expect(tr.calls.last, 'POST /api/attendance/sync');
      tr.next = () async => const TransportResponse(200, '{"server_time":"x","enabled":true,"policy":{},"device":{"registered":true,"revoked":false}}');
      final s = await tr.status(deviceId: 'd');
      expect(s.enabled, isTrue);
      expect(tr.calls.last, 'GET /api/attendance/offline/status?device_id=d');
      tr.next = () async => const TransportResponse(200, '{"next_cursor":null}');
      await tr.bootstrapPage(cursor: 'c1', limit: 500);
      expect(tr.calls.last, 'GET /api/attendance/offline/bootstrap?cursor=c1&limit=500');
      await tr.me();
      expect(tr.calls.last, 'GET /api/attendance/offline/me');
    });
  });
}

class _Sock implements Exception {
  const _Sock();
}

class _Tr extends JsonSyncTransport {
  final calls = <String>[];
  late Future<TransportResponse> Function() next;
  @override
  String? get authenticatedUserId => 'u';
  @override
  Future<TransportResponse> send(String method, String path,
      {Map<String, String>? query, String? body}) {
    calls.add('$method $path${query == null ? '' : '?${Uri(queryParameters: query).query}'}');
    return next();
  }
}
