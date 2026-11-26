// LIVE integration test against a running clby-api. Skipped unless
// CLBY_LIVE=1. Env: CLBY_API (default http://localhost:8082),
// CLBY_COACH_TOKEN, CLBY_MEMBER_TOKEN, CLBY_OUT (dir for captured JSON).
// Verification-only artefact (not part of the product test suite).
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:clby_offline/clby_offline.dart';
import 'package:drift/drift.dart' hide isNull, isNotNull;
import 'package:flutter_test/flutter_test.dart';
import 'package:uuid/uuid.dart';

final env = Platform.environment;
final live = env['CLBY_LIVE'] == '1';
final api = env['CLBY_API'] ?? 'http://localhost:8082';
final outDir = env['CLBY_OUT'] ?? Directory.systemTemp.path;

const gymId = 'f59a895f-430e-46d7-ae1c-01602f4ec4fd';
const coachUser = 'd7d83ae0-3061-4580-911a-2b2f3decabaa';
const memberUser = 'a4dbc568-6cfc-4a51-bade-d680b83927bc';
const barakGm = 'c189f940-2d31-4dcf-9e14-8fefd8e6bee7';
const assignment = '007bc602-ca08-4325-be79-cc03a487decd';
const otherAssignment = '1b5e2590-08b8-49c2-8ae1-cd43582e9cfd';
const goldenBranch = 'dba85f42-c7dc-4406-ac1e-526cc4adfa86';
const goldenToken = 'd000fe8a-983b-405f-9b80-457a717b3dd0';
const otherGymToken = '15229abc-5c7e-445e-8d1b-c27536ceea53';
const barakBoundDevice = '587343d2-7502-4693-9aa7-227ec2d0595a';

final log = <String>[];
void say(String s) {
  log.add(s);
  // ignore: avoid_print
  print('[live] $s');
}

/// Mirrors ApiService.rawRequest (both apps): same headers
/// (Content-Type, Accept, ClientInfo.headers, Authorization), 30 s timeout,
/// returns TransportResponse; parsing = package JsonSyncTransport.
class LiveTransport extends JsonSyncTransport {
  LiveTransport(
      {required this.token,
      required this.app,
      required this.deviceId,
      required this.userId});
  String token;
  final String app;
  String deviceId;
  final String userId;
  int requests = 0;
  final bodies = <String, List<String>>{};
  /// After the server answered: hang forever (simulated kill) or throw a
  /// TimeoutException (response lost after commit).
  bool hangAfterSend = false;
  bool dropAfterSend = false;
  final hung = Completer<void>();

  @override
  String? get authenticatedUserId => userId;

  @override
  Future<TransportResponse> send(String method, String path,
      {Map<String, String>? query, String? body}) async {
    requests++;
    final uri = Uri.parse('$api$path').replace(queryParameters: query);
    final client = HttpClient();
    try {
      final req = await client.openUrl(method, uri).timeout(const Duration(seconds: 30));
      final h = <String, String>{
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-App': app,
        'X-App-Version': '9.9.9',
        'X-App-Build': '999',
        'X-App-Platform': 'ios',
        'X-Device-Id': deviceId,
        'Authorization': 'Bearer $token',
      };
      h.forEach(req.headers.set);
      if (body != null) req.add(utf8.encode(body));
      final res = await req.close().timeout(const Duration(seconds: 30));
      final text = await res.transform(utf8.decoder).join();
      final headers = <String, String>{};
      res.headers.forEach((k, v) => headers[k.toLowerCase()] = v.join(','));
      (bodies[path] ??= []).add('${res.statusCode} $text');
      if (hangAfterSend) {
        await hung.future; // never completes
      }
      if (dropAfterSend) {
        dropAfterSend = false;
        throw TimeoutException('response lost after commit (simulated)');
      }
      return TransportResponse(res.statusCode, text, headers: headers);
    } finally {
      client.close(force: true);
    }
  }
}

Future<List<List<String>>> psql(String sql) async {
  final r = await Process.run('psql',
      ['-h', 'localhost', '-U', 'rtg', '-d', 'clby_offline', '-AtF', '|', '-c', sql]);
  if (r.exitCode != 0) throw StateError('psql: ${r.stderr}');
  return (r.stdout as String)
      .trim()
      .split('\n')
      .where((l) => l.isNotEmpty)
      .map((l) => l.split('|'))
      .toList();
}

class Clock {
  Clock(this.now);
  DateTime now;
  DateTime call() => now;
}

Future<OfflineStore> openStore({
  required String scopeBase,
  required String user,
  required OfflineApp app,
  required LiveTransport t,
  required Clock clock,
  required Directory dir,
  required KeyStore ks,
  bool memory = false,
}) async {
  driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;
  final scope = OfflineScope(apiBase: scopeBase, gymId: gymId, userId: user);
  final db = memory
      ? openInMemoryOfflineDatabase()
      : await openOfflineDatabase(
          scope: scope, directory: dir, keyStore: ks, inBackground: false);
  return OfflineStore.open(
    scope: scope,
    app: app,
    transport: t,
    deviceId: t.deviceId,
    appVersion: '9.9.9',
    database: db,
    timezone: () async => 'Africa/Cairo',
    now: clock.call,
    autoRetry: false,
    autoSyncOnRecord: false,
  );
}

void main() {
  if (!live) {
    test('live integration (set CLBY_LIVE=1)', () {}, skip: 'CLBY_LIVE!=1');
    return;
  }
  final coachToken = env['CLBY_COACH_TOKEN']!;
  final memberToken = env['CLBY_MEMBER_TOKEN']!;
  final coachDevice = const Uuid().v4();
  final memberDevice = const Uuid().v4();
  final created = <String, List<String>>{
    'event_ids': [], 'attendance_logs': [], 'service_session_logs': [],
    'attendance_devices': [coachDevice, memberDevice],
  };
  late Directory dir;
  final ks = InMemoryKeyStore();
  final realNow = DateTime.now();

  setUpAll(() async {
    HttpOverrides.global = null;
    dir = await Directory.systemTemp.createTemp('clby_live_');
    say('coachDevice=$coachDevice memberDevice=$memberDevice dir=${dir.path}');
  });

  tearDownAll(() async {
    File('$outDir/live_created.json')
        .writeAsStringSync(const JsonEncoder.withIndent(' ').convert(created));
    File('$outDir/live_log.txt').writeAsStringSync(log.join('\n'));
  });

  Future<int> sslCount(String ev) async => int.parse(
      (await psql("select count(*) from service_session_logs where source_event_id='$ev'"))[0][0]);
  Future<int> attCount(String ev) async => int.parse(
      (await psql("select count(*) from attendance_logs where source_event_id='$ev'"))[0][0]);

  test('K key handling on a real sqlite3mc file', () async {
    final kdir = await Directory.systemTemp.createTemp('clby_key_');
    final scope = OfflineScope(apiBase: 'k', gymId: gymId, userId: coachUser);
    final ks1 = InMemoryKeyStore();
    final db = await openOfflineDatabase(
        scope: scope, directory: kdir, keyStore: ks1, inBackground: false);
    await db.into(db.outboxEvents).insert(OutboxEventsCompanion.insert(
        eventId: const Uuid().v4(), kind: 'attendance', gymId: gymId,
        memberId: barakGm, deviceRecordedAt: 'x', deviceRecordedAtMs: 1,
        deviceTimezone: 'UTC', actorUserId: coachUser, actorType: 'coach',
        deviceId: 'd', createdAt: 1));
    await db.close();
    final file = File('${kdir.path}/${scope.databaseFileName}');
    final size = file.lengthSync();
    // 1) key missing, file present
    try {
      await openOfflineDatabase(scope: scope, directory: kdir,
          keyStore: InMemoryKeyStore(), inBackground: false,
          keyRetryDelay: Duration.zero);
      say('K1 opened?!');
    } catch (e) {
      say('K1 key missing -> $e');
    }
    // 2) wrong key
    final wrong = InMemoryKeyStore()
      ..values[scope.keyStoreEntry] = 'ab' * 32;
    try {
      await openOfflineDatabase(scope: scope, directory: kdir,
          keyStore: wrong, inBackground: false);
      say('K2 opened?!');
    } catch (e) {
      say('K2 wrong key -> $e');
    }
    // 3) flaky keychain returning null for 3 reads (readsReturnNull)
    ks1.readsReturnNull = true;
    try {
      await openOfflineDatabase(scope: scope, directory: kdir, keyStore: ks1,
          inBackground: false, keyRetryDelay: Duration.zero);
      say('K3 opened?!');
    } catch (e) {
      say('K3 null reads -> $e');
    }
    ks1.readsReturnNull = false;
    final db2 = await openOfflineDatabase(
        scope: scope, directory: kdir, keyStore: ks1, inBackground: false);
    final n = (await db2.select(db2.outboxEvents).get()).length;
    say('K file kept size=$size→${file.lengthSync()} rows after correct key=$n');
    expect(n, 1);
    await db2.close();
  });

  test('A coach: bootstrap, service_session, replay, IDOR, clock skew', () async {
    final clock = Clock(realNow.subtract(const Duration(hours: 3)));
    final t = LiveTransport(
        token: coachToken, app: 'coach', deviceId: coachDevice, userId: coachUser);
    final s = await openStore(
        scopeBase: api, user: coachUser, app: OfflineApp.coach, t: t,
        clock: clock, dir: dir, ks: ks);
    // encrypted file really created via sqlite3mc
    final cipher = await s.db.customSelect('PRAGMA cipher').get();
    say('PRAGMA cipher -> ${cipher.map((r) => r.data).toList()}');
    final f = dir.listSync().whereType<File>().first;
    final head = f.readAsBytesSync().take(16).toList();
    say('db header bytes=${String.fromCharCodes(head.where((b) => b > 31 && b < 127))}');
    expect(String.fromCharCodes(head).startsWith('SQLite format 3'), isFalse);

    clock.now = realNow; // bootstrap with true clock
    final br = await s.refreshIfStale(force: true);
    say('bootstrap: $br policy.enabled=${s.policy.value.enabled}');
    File('$outDir/live_boot_coach.json').writeAsStringSync(
        t.bodies[JsonSyncTransport.bootstrapPath]!.last);
    File('$outDir/live_status_coach.json').writeAsStringSync(
        t.bodies[JsonSyncTransport.statusPath]!.last);
    expect(br, isNotNull);
    expect(br!.assignments, 1);
    final ca = await s.db.select(s.db.cachedAssignments).get();
    say('cached assignment: ${ca.single}');
    expect(ca.single.memberNumber, '1');
    final logs = await s.db.select(s.db.cachedRecentServiceLogs).get();
    say('cached recent logs: ${logs.length}');

    clock.now = realNow.subtract(const Duration(hours: 3));
    final o1 = await s.recorder.record(NewOfflineEvent.serviceSession(
        memberId: barakGm, serviceAssignmentId: assignment, note: 'live A1'));
    expect(o1, isA<RecordSaved>());
    final e1 = (o1 as RecordSaved).event.eventId;
    final o2 = await s.recorder.record(NewOfflineEvent.serviceSession(
        memberId: barakGm, serviceAssignmentId: otherAssignment, note: 'idor'));
    expect(o2, isA<RecordSaved>());
    final e2 = (o2 as RecordSaved).event.eventId;
    created['event_ids']!.addAll([e1, e2]);
    final run = await s.engine.syncNow();
    say('sync run: sent=${run.sent} synced=${run.synced} rejected=${run.rejected} err=${run.error}');
    File('$outDir/live_sync_coach.json').writeAsStringSync(
        t.bodies[JsonSyncTransport.syncPath]!.last);
    final r1 = (await s.event(e1))!;
    final r2 = (await s.event(e2))!;
    say('e1 ${r1.syncStatus} ${r1.resultStatus}/${r1.resultCode} official=${r1.officialId} flags=${r1.flags}');
    say('e2 ${r2.syncStatus} ${r2.resultStatus}/${r2.resultCode} msg=${r2.resultMessage}');
    expect(r1.syncStatus, 'synced');
    expect(r2.syncStatus, 'rejected');
    final row = await psql(
        "select id from service_session_logs where source_event_id='$e1'");
    expect(row.length, 1);
    expect(row[0][0], r1.officialId);
    created['service_session_logs']!.add(row[0][0]);

    // replay: force back to pending and resend
    await (s.db.update(s.db.outboxEvents)..where((x) => x.eventId.isIn([e1, e2])))
        .write(const OutboxEventsCompanion(syncStatus: Value('pending')));
    await s.engine.syncNow();
    final r1b = (await s.event(e1))!;
    final r2b = (await s.event(e2))!;
    say('replay e1 ${r1b.syncStatus} ${r1b.resultStatus}/${r1b.resultCode} official=${r1b.officialId}');
    say('replay e2 ${r2b.syncStatus} ${r2b.resultStatus}/${r2b.resultCode}');
    expect(r1b.resultStatus, 'duplicate');
    expect(r1b.resultCode, 'event_replayed');
    expect(r1b.officialId, r1.officialId);
    expect(await sslCount(e1), 1);

    // same event_id, different payload, straight through the transport
    final wire = Map<String, Object?>.from(r1b.toWireJson())..['note'] = 'changed';
    final reused = await t.sync(SyncRequest(
        deviceId: coachDevice, app: 'coach', appVersion: '9.9.9', events: [wire]));
    say('reused payload -> ${reused.results.single.rawStatus}/${reused.results.single.code}');
    expect(await sslCount(e1), 1);

    // clock skew (CONTRACT §6.6): with a known server offset the recorder
    // refuses what the server would always reject. Measure the offset with
    // the true clock first (status), then skew the device clock.
    clock.now = realNow;
    await s.refreshStatus();
    clock.now = realNow.add(const Duration(hours: 1));
    final of = await s.recorder.record(NewOfflineEvent.serviceSession(
        memberId: barakGm, serviceAssignmentId: assignment, note: 'future'));
    say('recorder with +1h clock -> ${of.runtimeType}');
    clock.now = realNow.subtract(const Duration(days: 8));
    final oo = await s.recorder.record(NewOfflineEvent.serviceSession(
        memberId: barakGm, serviceAssignmentId: assignment, note: 'old'));
    say('recorder with -8d clock -> ${oo.runtimeType}');
    clock.now = realNow;
    expect((of as RecordRefused).reason, RecordRefusal.clockSkew);
    expect((oo as RecordRefused).reason, RecordRefusal.clockSkew);
    await s.close();
  });

  test('E/F coach: 401 and 403 device_mismatch keep events, no loop', () async {
    final clock = Clock(realNow.subtract(const Duration(hours: 1)));
    final t = LiveTransport(
        token: 'garbage|token', app: 'coach', deviceId: coachDevice, userId: coachUser);
    final s = await openStore(
        scopeBase: 'scope-ef', user: coachUser, app: OfflineApp.coach, t: t,
        clock: clock, dir: dir, ks: ks, memory: true);
    await s.policy.applyServerPolicy({'enabled': true});
    final o = await s.recorder.record(NewOfflineEvent.serviceSession(
        memberId: barakGm, serviceAssignmentId: assignment, note: 'never-sent'));
    final e = (o as RecordSaved).event.eventId;
    created['event_ids']!.add('$e (never accepted: 401/403 only)');
    final r = await s.engine.syncNow();
    final row = (await s.event(e))!;
    say('401: pause=${r.pause} state=${s.engine.state.pause} row=${row.syncStatus} attempts=${row.syncAttempts} body=${t.bodies[JsonSyncTransport.syncPath]?.last}');
    expect(s.engine.state.pause, SyncPauseReason.authRequired);
    expect(row.syncStatus, 'pending');

    // 403: real token, device bound to barak
    t.token = coachToken;
    t.deviceId = barakBoundDevice;
    // engine.deviceId is fixed per store, so rebuild an engine on the same DB
    final eng = SyncEngine(
        db: s.db, transport: t, scope: s.scope, deviceId: barakBoundDevice,
        app: OfflineApp.coach, appVersion: '9.9.9', policy: s.policy,
        now: clock.call, autoRetry: true);
    final before = t.requests;
    final r3 = await eng.syncNow();
    final r4 = await eng.syncNow();
    final r5 = await eng.onAppResumed();
    final row3 = (await s.event(e))!;
    say('403: run=${r3.pause} then ${r4.skipped}/${r5.skipped} state=${eng.state.pause} '
        'lastError=${eng.state.lastError} requests=${t.requests - before} row=${row3.syncStatus} '
        'retryTimer=${eng.retryTimer} body=${t.bodies[JsonSyncTransport.syncPath]!.last}');
    expect(row3.syncStatus, 'pending');
    expect(t.requests - before, 1);
    // CONTRACT §6.1: mismatch and revocation are distinct pause reasons,
    // and the error stays visible.
    final bodyCode = jsonDecode(t.bodies[JsonSyncTransport.syncPath]!.last
        .substring(4))['code'];
    expect(eng.state.pause, bodyCode == 'device_revoked'
        ? SyncPauseReason.deviceRevoked
        : bodyCode == 'device_mismatch'
            ? SyncPauseReason.deviceMismatch
            : SyncPauseReason.forbidden);
    expect(eng.state.lastError, isNotNull);
    // resumeAfterAuth: what the app would do on re-login
    final r6 = await eng.resumeAfterAuth();
    say('403 after resumeAfterAuth: pause=${r6.pause} requests=${t.requests - before}');
    final ev = await psql("select count(*) from attendance_events where event_id='$e'");
    say('attendance_events rows for 403 event: ${ev[0][0]}');
    expect(ev[0][0], '0');
    await eng.dispose();
    await s.close();
  });

  test('C coach: kill mid-sync, reopen, recover, same id', () async {
    final clock = Clock(realNow.subtract(const Duration(hours: 5)));
    final t = LiveTransport(
        token: coachToken, app: 'coach', deviceId: coachDevice, userId: coachUser);
    final s = await openStore(
        scopeBase: 'scope-kill', user: coachUser, app: OfflineApp.coach, t: t,
        clock: clock, dir: dir, ks: ks);
    await s.policy.applyServerPolicy({'enabled': true});
    final o = await s.recorder.record(NewOfflineEvent.serviceSession(
        memberId: barakGm, serviceAssignmentId: assignment, note: 'live kill'));
    final e = (o as RecordSaved).event.eventId;
    created['event_ids']!.add(e);
    t.hangAfterSend = true;
    unawaited(s.engine.syncNow());
    for (var i = 0; i < 100 && await sslCount(e) == 0; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 100));
    }
    expect(await sslCount(e), 1);
    // "process killed": open a fresh connection on the same encrypted file
    final db2 = await openOfflineDatabase(
        scope: s.scope, directory: dir, keyStore: ks, inBackground: false);
    final st = await (db2.select(db2.outboxEvents)..where((x) => x.eventId.equals(e))).getSingle();
    say('after kill row=${st.syncStatus}');
    expect(st.syncStatus, 'syncing');
    final t2 = LiveTransport(
        token: coachToken, app: 'coach', deviceId: coachDevice, userId: coachUser);
    final pol = PolicyHolder(db2);
    await pol.load();
    final eng = SyncEngine(
        db: db2, transport: t2, scope: s.scope, deviceId: coachDevice,
        app: OfflineApp.coach, appVersion: '9.9.9', policy: pol, now: clock.call,
        autoRetry: false);
    await eng.start();
    final rec = await (db2.select(db2.outboxEvents)..where((x) => x.eventId.equals(e))).getSingle();
    say('after start() row=${rec.syncStatus}');
    expect(rec.syncStatus, 'pending');
    await eng.syncNow();
    final fin = await (db2.select(db2.outboxEvents)..where((x) => x.eventId.equals(e))).getSingle();
    final row = await psql("select id from service_session_logs where source_event_id='$e'");
    say('after resync ${fin.syncStatus} ${fin.resultStatus}/${fin.resultCode} official=${fin.officialId} db=${row[0][0]} count=${row.length}');
    expect(fin.syncStatus, 'synced');
    expect(fin.officialId, row[0][0]);
    expect(row.length, 1);
    created['service_session_logs']!.add(row[0][0]);
    await eng.dispose();
    await db2.close();
    // the hung store is intentionally leaked (simulated dead process)
  });

  test('B/D member: /me, member_qr forms, lost response, wrong gym, garbage, double-tap', () async {
    final clock = Clock(realNow.subtract(const Duration(minutes: 30)));
    final t = LiveTransport(
        token: memberToken, app: 'member', deviceId: memberDevice, userId: memberUser);
    final s = await openStore(
        scopeBase: api, user: memberUser, app: OfflineApp.member, t: t,
        clock: clock, dir: dir, ks: ks);
    clock.now = realNow;
    final br = await s.refreshIfStale(force: true);
    say('member bootstrap: $br');
    File('$outDir/live_me.json').writeAsStringSync(t.bodies[JsonSyncTransport.mePath]!.last);
    final b = await s.db.select(s.db.cachedMemberships).get();
    say('cached buckets: ${b.map((x) => '${x.membershipId} start=${x.startDate} end=${x.endDate}').toList()}');
    final meta = await s.db.readMeta(SyncMetaKeys.member);
    say('member meta: $meta');

    Future<String?> rec(String qr, Duration back) async {
      clock.now = realNow.subtract(back);
      final o = await s.recorder.record(NewOfflineEvent.attendance(
          method: AttendanceMethod.memberQr, memberId: barakGm, qrRaw: qr));
      say('record qr=${qr.length > 40 ? '${qr.substring(0, 40)}…' : qr} -> $o');
      if (o is RecordSaved) {
        created['event_ids']!.add(o.event.eventId);
        return o.event.eventId;
      }
      return null;
    }

    // double-tap probe: garbage then valid QR 3 s apart
    final g = await rec('garbage-qr', const Duration(minutes: 20, seconds: 3));
    final dt = await rec(goldenToken, const Duration(minutes: 20));
    say('valid QR 3 s after a garbage scan saved? ${dt != null}');
    expect(dt, isNotNull, reason: 'MEDIUM-3: qr_raw is part of the double-tap identity');

    final jsonQr = jsonEncode({
      'type': 'gym_access', 'gym_id': gymId, 'branch_id': goldenBranch, 'token': goldenToken
    });
    final ej = await rec(jsonQr, const Duration(minutes: 10));
    final eb = await rec(goldenToken, const Duration(minutes: 9));
    final ew = await rec(otherGymToken, const Duration(minutes: 8));
    clock.now = realNow;

    // lost response on the first batch
    t.dropAfterSend = true;
    final r1 = await s.engine.syncNow();
    say('lost-response run: err=${r1.error} retrying=${r1.retrying}');
    for (final id in [g, dt, ej, eb, ew].whereType<String>()) {
      final r = (await s.event(id))!;
      say('  after drop $id ${r.syncStatus} attempts=${r.syncAttempts} err=${r.lastSyncError} next=${r.nextAttemptAt}');
      expect(r.syncStatus, 'pending');
    }
    final committed = <String, int>{};
    for (final id in [ej, eb].whereType<String>()) {
      committed[id] = await attCount(id);
    }
    say('server rows after drop: $committed');
    await s.engine.syncNow();
    for (final id in [g, dt, ej, eb, ew].whereType<String>()) {
      final r = (await s.event(id))!;
      final rows = await psql("select id from attendance_logs where source_event_id='$id'");
      say('  final $id ${r.syncStatus} ${r.resultStatus}/${r.resultCode} official=${r.officialId} rows=${rows.map((x) => x[0]).toList()}');
      if (rows.isNotEmpty) {
        expect(rows.length, 1);
        expect(r.officialId, rows[0][0]);
        created['attendance_logs']!.add(rows[0][0]);
      }
    }
    File('$outDir/live_sync_member.json').writeAsStringSync(
        t.bodies[JsonSyncTransport.syncPath]!.join('\n'));
    final sj = (await s.event(ej!))!;
    expect(sj.syncStatus, 'synced');
    expect(sj.resultCode, 'event_replayed');
    if (eb != null) expect((await s.event(eb))!.syncStatus, 'synced');
    expect((await s.event(ew!))!.resultCode, 'qr_wrong_gym');
    expect((await s.event(g!))!.resultCode, 'qr_invalid');
    await s.close();
  });
}
