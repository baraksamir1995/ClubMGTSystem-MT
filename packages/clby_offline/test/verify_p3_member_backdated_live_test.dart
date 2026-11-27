// VERIFY-ONLY (throwaway, P3 member verification). Skipped unless
// CLBY_VP3_LIVE points at {token, qr}. Records a member_qr event with the
// device clock 1 h behind (offline scan an hour ago), syncs, checks DB.
// ignore_for_file: avoid_print
import 'dart:convert';
import 'dart:io';

import 'package:clby_offline/clby_offline.dart';
import 'package:drift/drift.dart' show driftRuntimeOptions;
import 'package:flutter_test/flutter_test.dart';
import 'package:uuid/uuid.dart';

import 'member_live_test.dart' show Live, psql;

final api = Platform.environment['CLBY_API'] ?? 'http://localhost:8086';
const memberUser = 'a4dbc568-6cfc-4a51-bade-d680b83927bc';
const gymId = 'f59a895f-430e-46d7-ae1c-01602f4ec4fd';
const barakGm = 'c189f940-2d31-4dcf-9e14-8fefd8e6bee7';

void main() {
  coachRegression();
  final path = Platform.environment['CLBY_VP3_LIVE'];
  if (path == null) {
    test('vp3 live', () {}, skip: 'CLBY_VP3_LIVE unset');
    return;
  }
  test('backdated member_qr via static poster', () async {
    driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;
    final j = jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;
    final qr = j['qr'] as String;
    final t = Live(j['token'] as String, const Uuid().v4());
    var shift = Duration.zero;
    final store = await OfflineStore.open(
      scope: OfflineScope(apiBase: api, gymId: gymId, userId: memberUser),
      app: OfflineApp.member, transport: t, deviceId: t.deviceId, appVersion: '9.9.9',
      database: openInMemoryOfflineDatabase(), timezone: () async => 'Africa/Cairo',
      now: () => DateTime.now().subtract(shift),
      autoRetry: false, autoSyncOnRecord: false,
    );
    final boot = await store.refreshIfStale(force: true, evenIfDisabled: true);
    print('bootstrap $boot policy=${store.policy.value.toJson()}');
    final keys = await store.db.select(store.db.cachedPassKeys).get();
    print('pass_keys: ${keys.map((k) => '${k.kid}/${k.status}').toList()}');
    final branches = await store.db.select(store.db.cachedBranches).get();
    print('branches: ${branches.map((b) => '${b.name}:${b.qrToken}').toList()}');
    // Member pass removed (PHASE3 Amendment 2 §A).
    expect(keys, isNotEmpty);
    expect(await store.ownMemberId(), barakGm);
    // Scan happened an hour ago, offline.
    shift = Duration(seconds: int.parse(Platform.environment['VP3_SHIFT_S'] ?? '3600'));
    final v = await store.branchQrVerifier.verify(qr);
    print('verdict $v ${v is BranchQrInvalid ? v.reason : ''}');
    expect(v, isA<BranchQrValid>());
    final b = (v as BranchQrValid).qr.branchId;
    print('local denial: ${gymEntryDenialCached(await store.membershipsOf(barakGm), b)}');
    final o = await store.recorder.record(NewOfflineEvent.attendance(
        method: AttendanceMethod.memberQr, memberId: barakGm, branchId: b, qrRaw: qr,
        metadata: {'source': 'member_scan', 'qr_v': 2, 'qr_mode': 'static'}));
    print('record $o');
    final e = (o as RecordSaved).event;
    print('device_recorded_at ${e.deviceRecordedAt}');
    shift = Duration.zero;
    await store.engine.syncNow();
    final s1 = (await store.event(e.eventId))!;
    print('sync: ${s1.syncStatus} ${s1.resultStatus}/${s1.resultCode} official=${s1.officialId} msg=${s1.resultMessage} flags=${s1.flags}');
    print('EVENT ${e.eventId}');
    print('logs ${await psql("select id, check_in_at, branch_id from attendance_logs where source_event_id='${e.eventId}'")}');
    print('qr_meta ${await psql("select qr_meta, status, code from attendance_events where event_id='${e.eventId}'")}');
    print(t.log.join('\n'));
    await store.close();
  });
}

// Coach regression against the offline-DISABLED API (CLBY_VP3_COACH = token).
void coachRegression() {
  final tok = Platform.environment['CLBY_VP3_COACH'];
  if (tok == null) return;
  test('coach vs disabled API: status/bootstrap/recorder refuses', () async {
    driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;
    final api2 = Platform.environment['CLBY_API2'] ?? 'http://localhost:8087';
    final t = CoachLive(tok, const Uuid().v4(), api2);
    final store = await OfflineStore.open(
      scope: OfflineScope(apiBase: api2, gymId: gymId, userId: 'd7d83ae0-3061-4580-911a-2b2f3decabaa'),
      app: OfflineApp.coach, transport: t, deviceId: t.deviceId, appVersion: '9.9.9',
      database: openInMemoryOfflineDatabase(), timezone: () async => 'Africa/Cairo',
      autoRetry: false, autoSyncOnRecord: false,
    );
    final st = await store.refreshStatus();
    print('coach status enabled=${st.enabled}');
    expect(st.enabled, isFalse);
    final boot = await store.refreshIfStale(force: true, evenIfDisabled: true);
    print('coach bootstrap $boot');
    final o = await store.recorder.record(NewOfflineEvent.attendance(
        method: AttendanceMethod.manual, memberId: barakGm,
        branchId: 'dba85f42-c7dc-4406-ac1e-526cc4adfa86'));
    print('coach record while disabled: $o ${o is RecordRefused ? o.reason : ''}');
    expect(o, isA<RecordRefused>());
    print(t.log.join('\n'));
    await store.close();
  });
}

class CoachLive extends JsonSyncTransport {
  CoachLive(this.token, this.deviceId, this.base);
  final String token, deviceId, base;
  final log = <String>[];
  @override
  String? get authenticatedUserId => 'd7d83ae0-3061-4580-911a-2b2f3decabaa';
  @override
  Future<TransportResponse> send(String method, String path,
      {Map<String, String>? query, String? body}) async {
    final c = HttpClient();
    try {
      final req = await c.openUrl(method, Uri.parse('$base$path').replace(queryParameters: query));
      final h = <String, String>{'Content-Type': 'application/json', 'Accept': 'application/json', 'X-App': 'coach',
       'X-App-Version': '9.9.9', 'X-App-Build': '1', 'X-App-Platform': 'ios',
       'X-Device-Id': deviceId, 'Authorization': 'Bearer $token'};
      h.forEach(req.headers.set);
      if (body != null) req.add(utf8.encode(body));
      final res = await req.close();
      final text = await res.transform(utf8.decoder).join();
      log.add('$method $path -> ${res.statusCode}');
      return TransportResponse(res.statusCode, text);
    } finally {
      c.close(force: true);
    }
  }
}
