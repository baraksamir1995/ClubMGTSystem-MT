import 'package:clby_offline/clby_offline.dart';
import 'package:coachesapp/features/offline/offline_logic.dart';
import 'package:coachesapp/features/offline/offline_strings.dart';
import 'package:flutter_test/flutter_test.dart';

CachedAssignment a({
  String? status = 'active',
  int? total = 10,
  int? used = 4,
  String? expiresAt,
}) =>
    CachedAssignment(
      assignmentId: 'a',
      gymMemberId: 'm',
      status: status,
      sessionsTotal: total,
      sessionsUsed: used,
      expiresAt: expiresAt,
    );

OutboxEvent ev(String status, {String? code, String? message}) => OutboxEvent(
      eventId: 'e',
      kind: 'service_session',
      gymId: 'g',
      memberId: 'm',
      deviceRecordedAt: '2026-11-26T08:00:00.000+02:00',
      deviceRecordedAtMs: 0,
      deviceTimezone: 'Africa/Cairo',
      metadata: '{}',
      actorUserId: 'u',
      actorType: 'coach',
      deviceId: 'd',
      syncStatus: status,
      syncAttempts: 0,
      flags: '[]',
      createdAt: 0,
      resultCode: code,
      resultMessage: message,
    );

void main() {
  group('log path (PHASE2 "Online vs offline")', () {
    test('policy enabled + store → outbox (online or offline)', () {
      expect(chooseLogPath(storeOpen: true, policyEnabled: true, offlineMode: false), LogPath.outbox);
      expect(chooseLogPath(storeOpen: true, policyEnabled: true, offlineMode: true), LogPath.outbox);
    });
    test('policy disabled online → existing decrement endpoint', () {
      expect(chooseLogPath(storeOpen: true, policyEnabled: false, offlineMode: false), LogPath.online);
      expect(chooseLogPath(storeOpen: false, policyEnabled: false, offlineMode: false), LogPath.online);
      expect(chooseLogPath(storeOpen: false, policyEnabled: true, offlineMode: false), LogPath.online,
          reason: 'store unavailable while online: keep working online');
    });
    test('offline mode without the outbox → unavailable', () {
      expect(chooseLogPath(storeOpen: true, policyEnabled: false, offlineMode: true), LogPath.unavailable);
      expect(chooseLogPath(storeOpen: false, policyEnabled: true, offlineMode: true), LogPath.unavailable);
    });
  });

  group('offline-mode entry rules (package rule used by the controller)', () {
    final last = LastOfflineScope(apiBase: 'https://api.clbyapp.com', gymId: 'g', userId: 'coach-1');
    test('same coach, same API, store opens with data → allowed', () {
      expect(offlineEntryBlock(hasToken: true, tokenUserId: 'coach-1', last: last,
          apiBase: 'https://api.clbyapp.com', storeOpened: true, hasCachedData: true), isNull);
    });
    test('never weakens auth', () {
      expect(offlineEntryBlock(hasToken: false, tokenUserId: 'coach-1', last: last,
          apiBase: 'https://api.clbyapp.com'), OfflineEntryBlock.notSignedIn);
      expect(offlineEntryBlock(hasToken: true, tokenUserId: 'coach-2', last: last,
          apiBase: 'https://api.clbyapp.com'), OfflineEntryBlock.differentUser);
      expect(offlineEntryBlock(hasToken: true, tokenUserId: 'coach-1', last: last,
          apiBase: 'https://api.clbyapp.com', storeOpened: false), OfflineEntryBlock.storeUnavailable);
      expect(offlineEntryBlock(hasToken: true, tokenUserId: 'coach-1', last: last,
          apiBase: 'https://api.clbyapp.com', storeOpened: true, hasCachedData: false),
          OfflineEntryBlock.noCachedData);
    });
  });

  group('active cached assignment', () {
    final now = DateTime(2026, 11, 26, 10);
    test('active with sessions left', () => expect(isActiveCachedAssignment(a(), now), isTrue));
    test('completed / exhausted', () {
      expect(isActiveCachedAssignment(a(status: 'completed'), now), isFalse);
      expect(isActiveCachedAssignment(a(used: 10), now), isFalse);
    });
    test('date-only expiry is a calendar day (expires end of that day)', () {
      expect(isActiveCachedAssignment(a(expiresAt: '2026-11-26'), now), isTrue);
      expect(isActiveCachedAssignment(a(expiresAt: '2026-11-25'), now), isFalse);
    });
    test('timestamp expiry', () {
      expect(isActiveCachedAssignment(a(expiresAt: '2026-11-26T09:00:00Z'), DateTime.utc(2026, 11, 26, 10)), isFalse);
      expect(isActiveCachedAssignment(a(expiresAt: '2026-11-27T09:00:00Z'), DateTime.utc(2026, 11, 26, 10)), isTrue);
    });
    test('sessions left', () => expect(sessionsLeft(a()), 6));
  });

  group('labels', () {
    test('every indicator state has a contract label (en + ar)', () {
      for (final t in [OfflineStrings.en, OfflineStrings.ar]) {
        final labels = {
          indicatorLabel(const SyncState(), t),
          indicatorLabel(const SyncState(online: false), t),
          indicatorLabel(const SyncState(syncing: true), t),
          indicatorLabel(const SyncState(pendingCount: 3), t),
          indicatorLabel(const SyncState(pendingCount: 1, lastRunFailed: true), t),
          indicatorLabel(const SyncState(dataExpired: true), t),
          indicatorLabel(const SyncState(pause: SyncPauseReason.authRequired), t),
          indicatorLabel(const SyncState(pause: SyncPauseReason.deviceRevoked), t),
        };
        expect(labels.length, 8);
      }
      expect(indicatorLabel(const SyncState(pendingCount: 3), OfflineStrings.en), 'Pending (3)');
    });

    test('item states never show a local item as confirmed', () {
      final t = OfflineStrings.en;
      expect(itemStateLabel(ev('pending'), t), t.stateSaved);
      expect(itemStateLabel(ev('syncing'), t), t.stateSaved);
      expect(itemStateLabel(ev('synced'), t), t.stateSynced);
      expect(itemStateLabel(ev('rejected', code: 'guard_window', message: 'Logged < 30 min ago'), t),
          'Rejected — Logged < 30 min ago');
    });

    test('Arabic covers every key and is RTL', () {
      for (final k in OfflineStrings.keys) {
        expect(OfflineStrings.hasArabic(k), isTrue, reason: k);
      }
      expect(OfflineStrings.ar.isRtl, isTrue);
      expect(OfflineStrings.en.isRtl, isFalse);
    });

    test('every pass failure has text', () {
      for (final f in PassFailure.values) {
        expect(passFailureText(f, OfflineStrings.en), isNotEmpty);
        expect(passFailureText(f, OfflineStrings.ar), isNotEmpty);
      }
    });
  });
}
