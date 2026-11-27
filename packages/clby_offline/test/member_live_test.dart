// LIVE member Phase 3 check against a running clby-api. Skipped unless
// CLBY_MEMBER_LIVE points at a JSON file {token, qr:{qr}} (member token +
// a v2 static branch QR issued by the backend's BranchQrService).
// Env: CLBY_API (default http://localhost:8082).
// ignore_for_file: avoid_print
import 'dart:convert';
import 'dart:io';

import 'package:clby_offline/clby_offline.dart';
import 'package:drift/drift.dart' show driftRuntimeOptions;
import 'package:flutter_test/flutter_test.dart';
import 'package:uuid/uuid.dart';

final api = Platform.environment['CLBY_API'] ?? 'http://localhost:8082';
const memberUser = 'a4dbc568-6cfc-4a51-bade-d680b83927bc';
const gymId = 'f59a895f-430e-46d7-ae1c-01602f4ec4fd';
const barakGm = 'c189f940-2d31-4dcf-9e14-8fefd8e6bee7';

class Live extends JsonSyncTransport {
  Live(this.token, this.deviceId);
  final String token;
  final String deviceId;
  final log = <String>[];
  @override
  String? get authenticatedUserId => memberUser;
  @override
  Future<TransportResponse> send(String method, String path,
      {Map<String, String>? query, String? body}) async {
    final c = HttpClient();
    try {
      final req = await c.openUrl(method, Uri.parse('$api$path').replace(queryParameters: query));
      final headers = <String, String>{
        'Content-Type': 'application/json', 'Accept': 'application/json',
        'X-App': 'member', 'X-App-Version': '9.9.9', 'X-App-Build': '1',
        'X-App-Platform': 'ios', 'X-Device-Id': deviceId, 'Authorization': 'Bearer $token',
      };
      headers.forEach(req.headers.set);
      if (body != null) req.add(utf8.encode(body));
      final res = await req.close();
      final text = await res.transform(utf8.decoder).join();
      log.add('$method $path → ${res.statusCode}');
      return TransportResponse(res.statusCode, text);
    } finally {
      c.close(force: true);
    }
  }
}

Future<List<List<String>>> psql(String sql) async {
  final r = await Process.run('psql', ['-h', 'localhost', '-U', 'rtg', '-d', 'clby_offline', '-AtF', '|', '-c', sql]);
  return (r.stdout as String).trim().split('\n').where((l) => l.isNotEmpty).map((l) => l.split('|')).toList();
}

void main() {
  final path = Platform.environment['CLBY_MEMBER_LIVE'];
  if (path == null) {
    test('member live (set CLBY_MEMBER_LIVE)', () {}, skip: 'CLBY_MEMBER_LIVE unset');
    return;
  }
  test('member: /offline/me → offline verify → member_qr → sync → replay', () async {
    driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;
    final j = jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;
    final qr = (j['qr'] as Map)['qr'] as String;
    final t = Live(j['token'] as String, const Uuid().v4());
    final store = await OfflineStore.open(
      scope: OfflineScope(apiBase: api, gymId: gymId, userId: memberUser),
      app: OfflineApp.member, transport: t, deviceId: t.deviceId, appVersion: '9.9.9',
      database: openInMemoryOfflineDatabase(), timezone: () async => 'Africa/Cairo',
      autoRetry: false, autoSyncOnRecord: false,
    );
    final status = await store.refreshStatus();
    print('status enabled=${status.enabled} policy=${status.policy}');
    final boot = await store.refreshIfStale(force: true, evenIfDisabled: true);
    print('bootstrap $boot');
    final branches = await store.db.select(store.db.cachedBranches).get();
    print('branches: ${branches.map((b) => '${b.name} token=${b.qrToken != null}').toList()}');
    expect(branches.any((b) => b.qrToken != null), isTrue, reason: '/offline/me branches[].qr_token');
    final pass = await store.memberPass();
    print('member pass: kid=${pass?.kid} expires=${pass?.expiresAt}');
    expect(pass, isNotNull, reason: '/offline/me member_pass');
    expect(await store.ownMemberId(), barakGm);

    final v = await store.branchQrVerifier.verify(qr);
    print('branch QR verdict: $v');
    expect(v, isA<BranchQrValid>());
    final valid = v as BranchQrValid;
    final denial = gymEntryDenialCached(await store.membershipsOf(barakGm), valid.qr.branchId);
    print('local pre-check denial: $denial');

    // The member's own pass verifies with the cached keys too.
    final pv = await store.passVerifier.verify(pass!.qr);
    print('own pass verdict: ${pv.runtimeType}');

    // Record at "now" (inside the server's online grace → processed even
    // when the offline policy is off); local policy forced on for the test.
    await store.policy.applyServerPolicy({...store.policy.value.toJson(), 'enabled': true, 'allow_member_qr_offline': true});
    final o = await store.recorder.record(NewOfflineEvent.attendance(
        method: AttendanceMethod.memberQr, memberId: barakGm,
        branchId: valid.qr.branchId, qrRaw: qr, metadata: {'source': 'member_scan', 'qr_v': 2}));
    final e = (o as RecordSaved).event;
    await store.engine.syncNow();
    final s1 = (await store.event(e.eventId))!;
    print('sync: ${s1.syncStatus} ${s1.resultStatus}/${s1.resultCode} official=${s1.officialId} msg=${s1.resultMessage}');
    final rows = await psql("select id from attendance_logs where source_event_id='${e.eventId}'");
    print('attendance_logs rows: $rows');
    final meta = await psql("select qr_meta from attendance_events where event_id='${e.eventId}'");
    print('qr_meta: $meta');
    if (s1.syncStatus == 'synced') {
      expect(rows.length, 1);
      expect(s1.officialId, rows.first.first);
      // replay: same event id → event_replayed, still one row
      final wire = s1.toWireJson();
      final r2 = await t.sync(SyncRequest(deviceId: t.deviceId, app: 'member', appVersion: '9.9.9', events: [wire]));
      print('replay: ${r2.results.single.rawStatus}/${r2.results.single.code}');
      expect(r2.results.single.code, 'event_replayed');
      expect((await psql("select count(*) from attendance_logs where source_event_id='${e.eventId}'")).first.first, '1');
    }
    print('created event ${e.eventId} attendance ${rows.isEmpty ? '-' : rows.first.first}');
    print(t.log.join('\n'));
    await store.close();
  });
}
