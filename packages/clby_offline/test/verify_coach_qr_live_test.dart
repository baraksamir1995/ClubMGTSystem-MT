// ignore_for_file: avoid_print
// VERIFY-ONLY (throwaway): coach service_session with a member pass against
// a live clby-api. Skipped unless CLBY_VERIFY_LIVE=1.
// Env: CLBY_API, CLBY_COACH_TOKEN, CLBY_PASS_BARAK, CLBY_PASS_OTHER.
import 'dart:convert';
import 'dart:io';

import 'package:clby_offline/clby_offline.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uuid/uuid.dart';

import 'integration_live_test.dart'
    show LiveTransport, Clock, openStore, psql, coachUser, barakGm, assignment;

void main() {
  final env = Platform.environment;
  if (env['CLBY_VERIFY_LIVE'] != '1') {
    test('verify coach qr live', () {}, skip: 'CLBY_VERIFY_LIVE!=1');
    return;
  }
  test('coach service_session + member pass (real / other member / tampered)', () async {
    HttpOverrides.global = null;
    final api = env['CLBY_API'] ?? 'http://localhost:8082';
    final realNow = DateTime.now();
    final dir = await Directory.systemTemp.createTemp('clby_vfy_');
    final t = LiveTransport(
        token: env['CLBY_COACH_TOKEN']!, app: 'coach',
        deviceId: const Uuid().v4(), userId: coachUser);
    final clock = Clock(realNow);
    final s = await openStore(
        scopeBase: api, user: coachUser, app: OfflineApp.coach, t: t,
        clock: clock, dir: dir, ks: InMemoryKeyStore());
    final br = await s.refreshIfStale(force: true);
    print('[vfy] bootstrap $br');
    expect(br!.passKeys, greaterThan(0));

    final barak = env['CLBY_PASS_BARAK']!;
    final other = env['CLBY_PASS_OTHER']!;
    final tampered = (jsonDecode(barak) as Map<String, dynamic>)..['n'] = 99;
    final tamperedRaw = jsonEncode(tampered);

    // Local verifier on the coach store.
    final vb = await s.passVerifier.verify(barak);
    final vo = await s.passVerifier.verify(other);
    final vt = await s.passVerifier.verify(tamperedRaw);
    print('[vfy] local barak=${vb.runtimeType} other=${vo is PassInvalid ? vo.reason.code : 'VALID'} '
        'tampered=${vt is PassInvalid ? vt.reason.code : 'VALID'}');
    expect(vb, isA<PassValid>());
    expect((vo as PassInvalid).reason, PassFailure.memberNotFound);
    expect(vo.pass, isNotNull); // parsed pass object exists, but UI shows only failure text
    expect((vt as PassInvalid).reason, PassFailure.qrInvalid);

    Future<String> rec(String raw, Duration back, String note) async {
      clock.now = realNow.subtract(back);
      final o = await s.recorder.record(NewOfflineEvent.serviceSession(
          memberId: barakGm, serviceAssignmentId: assignment,
          note: note, qrRaw: raw, metadata: {'source': 'qr'}));
      expect(o, isA<RecordSaved>(), reason: '$o');
      return (o as RecordSaved).event.eventId;
    }

    final eOk = await rec(barak, const Duration(hours: 7), 'vfy qr ok');
    final eMis = await rec(other, const Duration(hours: 9), 'vfy qr mismatch');
    final eTam = await rec(tamperedRaw, const Duration(hours: 11), 'vfy qr tampered');
    clock.now = realNow;
    final run = await s.engine.syncNow();
    print('[vfy] sync sent=${run.sent} synced=${run.synced} rejected=${run.rejected} err=${run.error}');
    final out = <String, Object?>{};
    for (final (name, id) in [('ok', eOk), ('mismatch', eMis), ('tampered', eTam)]) {
      final e = (await s.event(id))!;
      final row = await psql(
          "select result, reason_code, service_log_id, qr_meta, metadata from attendance_events where event_id='$id'");
      out[name] = {
        'event_id': id, 'local': '${e.syncStatus} ${e.resultStatus}/${e.resultCode}',
        'official': e.officialId, 'db': row,
      };
      print('[vfy] $name $id local=${e.syncStatus} ${e.resultStatus}/${e.resultCode} db=$row');
    }
    File('${env['CLBY_OUT']}/vfy_coach_qr.json')
        .writeAsStringSync(const JsonEncoder.withIndent(' ').convert(out));
    expect((await s.event(eOk))!.syncStatus, 'synced');
    expect((await s.event(eMis))!.resultCode, 'qr_member_mismatch');
    expect((await s.event(eTam))!.resultCode, 'qr_invalid');
    await s.close();
  });
}
