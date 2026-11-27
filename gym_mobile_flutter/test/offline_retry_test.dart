import 'package:clby/features/offline/offline_logic.dart';
import 'package:clby/features/offline/offline_retry.dart';
import 'package:clby_offline/clby_offline.dart' show SpecialistDenial;
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('M2: offline mode keeps retrying the normal load', () {
    test('backoff schedule doubles and is capped', () {
      final s = OfflineRetryScheduler(retry: () async => false);
      expect(s.delayFor(0), const Duration(seconds: 10));
      expect(s.delayFor(1), const Duration(seconds: 20));
      expect(s.delayFor(3), const Duration(seconds: 80));
      expect(s.delayFor(10), const Duration(minutes: 5));
      expect(s.delayFor(100), const Duration(minutes: 5));
    });

    test('retries on its own (5xx at cold start, network still up) until success, then stops', () async {
      var calls = 0;
      final s = OfflineRetryScheduler(
        retry: () async => ++calls >= 3,
        base: const Duration(milliseconds: 5),
        max: const Duration(milliseconds: 20),
      )..start();
      await Future<void>.delayed(const Duration(milliseconds: 200));
      expect(calls, 3, reason: 'two failures, then success');
      expect(s.running, isFalse, reason: 'left offline mode → stopped');
      await Future<void>.delayed(const Duration(milliseconds: 60));
      expect(calls, 3, reason: 'no retries after success');
    });

    test('retryNow (chip / resume / pull-to-refresh) runs at once and stops on success', () async {
      var ok = false;
      var calls = 0;
      final s = OfflineRetryScheduler(
        retry: () async {
          calls++;
          return ok;
        },
        base: const Duration(seconds: 30),
      )..start();
      expect(await s.retryNow(), isFalse);
      expect(s.running, isTrue, reason: 'still offline → keeps the timer');
      ok = true;
      expect(await s.retryNow(), isTrue);
      expect(s.running, isFalse);
      expect(calls, 2);
    });

    test('a throwing retry counts as a failure and keeps retrying', () async {
      var calls = 0;
      final s = OfflineRetryScheduler(
        retry: () async {
          calls++;
          if (calls == 1) throw StateError('x');
          return true;
        },
        base: const Duration(milliseconds: 5),
      )..start();
      await Future<void>.delayed(const Duration(milliseconds: 100));
      expect(calls, 2);
      expect(s.running, isFalse);
    });

    test('stop() (signed out / back online) cancels pending retries', () async {
      var calls = 0;
      final s = OfflineRetryScheduler(
        retry: () async {
          calls++;
          return false;
        },
        base: const Duration(milliseconds: 20),
      )..start();
      s.stop();
      await Future<void>.delayed(const Duration(milliseconds: 80));
      expect(calls, 0);
    });
  });

  test('L6: offline coach denial texts = the online server texts for every code', () {
    for (final d in SpecialistDenial.values) {
      expect(specialistDenyMessages[d.code], isNotNull, reason: d.code);
    }
    expect(specialistDenyMessages['package_exhausted'],
        "You've used all sessions in your package with this specialist.");
  });
}
