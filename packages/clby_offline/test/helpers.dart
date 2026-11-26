import 'dart:async';
import 'dart:collection';

import 'package:clby_offline/clby_offline.dart';
import 'package:drift/drift.dart' show driftRuntimeOptions;
import 'package:uuid/uuid.dart';

String uid() => const Uuid().v4();

const apiBase = 'https://api.test.clby';
final gymA = uid();
final userA = uid();
final memberA = uid();

/// Test clock with independent WALL and MONOTONIC time.
/// * [advance] = real time passing (both move);
/// * assigning [now] = the user changing the device clock (wall only);
/// * [restart] = app restart (monotonic origin resets).
class TestClock {
  TestClock([DateTime? start]) : now = start ?? DateTime(2026, 11, 26, 8, 0, 0);
  DateTime now;
  Duration mono = const Duration(hours: 1);
  DateTime call() => now;
  Duration monotonic() => mono;
  void advance(Duration d) {
    now = now.add(d);
    mono += d;
  }
}

typedef SyncHandler = FutureOr<SyncResponse> Function(SyncRequest req);

/// Scriptable transport. Default sync handler accepts everything.
class FakeTransport implements SyncTransport {
  FakeTransport({this.userId});

  String? userId;
  final requests = <SyncRequest>[];
  final Queue<SyncHandler> _queue = Queue();
  SyncHandler? defaultHandler;
  final bootstrapPages = <String?, SnapshotPage>{};
  final bootstrapCalls = <String?>[];
  Object? bootstrapErrorOnCursor;
  String? failCursor;
  SnapshotPage? mePage;
  OfflineStatusResponse? statusResponse;

  void enqueue(SyncHandler h) => _queue.add(h);

  @override
  String? get authenticatedUserId => userId;

  /// User each request was made "as" (engine/bootstrap binding).
  final asUsers = <String?>[];
  /// Hook run right before a sync is answered (e.g. switch user mid-pass).
  void Function()? beforeSync;

  @override
  Future<SyncResponse> sync(SyncRequest request, {String? asUserId}) async {
    asUsers.add(asUserId);
    if (asUserId != null && asUserId != userId) throw const SyncUserChanged();
    requests.add(request);
    beforeSync?.call();
    final h = _queue.isNotEmpty ? _queue.removeFirst() : (defaultHandler ?? acceptAll);
    return await h(request);
  }

  @override
  Future<SnapshotPage> bootstrapPage(
      {String? cursor, int? limit, String? asUserId}) async {
    asUsers.add(asUserId);
    bootstrapCalls.add(cursor);
    if (failCursor != null && cursor == failCursor) {
      throw const SyncNetworkError('page failed');
    }
    final p = bootstrapPages[cursor];
    if (p == null) throw StateError('no page for cursor $cursor');
    return p;
  }

  @override
  Future<SnapshotPage> me({String? asUserId}) async => mePage!;

  @override
  Future<OfflineStatusResponse> status(
          {required String deviceId, String? asUserId}) async =>
      statusResponse ??
      OfflineStatusResponse.fromJson({
        'server_time': '2026-11-26T06:00:00Z',
        'enabled': true,
        'policy': {'enabled': true},
        'device': {'registered': true, 'revoked': false},
      });
}

Map<String, Object?> result(String id, String status,
        {String? code, String? attendanceId, String? serviceLogId,
        List<String> flags = const [], bool retryable = false}) =>
    {
      'event_id': id,
      'status': status,
      'code': code,
      'message': code,
      'attendance_id': attendanceId,
      'service_log_id': serviceLogId,
      'flags': flags,
      'server_received_at': '2026-11-26T06:10:00Z',
      'processed_at': status == 'error' ? null : '2026-11-26T06:10:00Z',
      'retryable': retryable,
    };

SyncResponse acceptAll(SyncRequest req) => SyncResponse.fromJson({
      'server_time': '2026-11-26T06:10:00Z',
      'results': [
        for (final id in req.eventIds)
          result(id, 'accepted', code: 'created', attendanceId: 'att-$id'),
      ],
    });

SyncResponse respondEach(SyncRequest req, String status,
        {String? code, bool retryable = false}) =>
    SyncResponse.fromJson({
      'server_time': '2026-11-26T06:10:00Z',
      'results': [
        for (final id in req.eventIds)
          result(id, status, code: code, retryable: retryable),
      ],
    });

const enabledPolicy = {'enabled': true, 'retry_base_seconds': 5, 'retry_max_seconds': 900};

/// Opens an in-memory (unencrypted) store with an enabled policy.
Future<OfflineStore> memoryStore({
  required FakeTransport transport,
  OfflineApp app = OfflineApp.admin,
  OfflineScope? scope,
  TestClock? clock,
  OfflineDatabase? db,
  Map<String, Object?> policy = enabledPolicy,
  double random = 0.5,
  bool autoSyncOnRecord = false,
}) async {
  // Each test DB is its own in-memory executor.
  driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;
  final s = scope ?? OfflineScope(apiBase: apiBase, gymId: gymA, userId: userA);
  transport.userId ??= s.userId;
  final c = clock ?? TestClock();
  final store = await OfflineStore.open(
    scope: s,
    app: app,
    transport: transport,
    deviceId: 'dev-1',
    appVersion: '1.0.0',
    database: db ?? openInMemoryOfflineDatabase(),
    timezone: () async => 'Africa/Cairo',
    now: c.call,
    monotonic: c.monotonic,
    random: () => random,
    autoRetry: false,
    autoSyncOnRecord: autoSyncOnRecord,
  );
  await store.policy.applyServerPolicy(policy);
  return store;
}

Future<String> recordManual(OfflineStore s, {String? member, String? classSession, String? branch}) async {
  final o = await s.recorder.record(NewOfflineEvent.attendance(
    method: AttendanceMethod.manual,
    memberId: member ?? uid(),
    classSessionId: classSession,
    branchId: branch,
  ));
  if (o is! RecordSaved) throw StateError('not saved: $o');
  return o.event.eventId;
}
