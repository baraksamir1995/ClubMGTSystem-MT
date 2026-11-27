// Cross-implementation coach (specialist) QR v2 corpus (PHASE3 Amendment 2). Skipped
// unless CLBY_SPECIALIST_CORPUS points at the backend-generated corpus JSON:
// {gym_id, now_ms, future_skew_seconds, pass_keys:[…],
// trainers:[{id,name,service_type,is_active}], cases:[{name, raw, server, scan_ms?}]}.
// Every Dart verdict must equal the server's (client-only qr_unknown_key ≡
// server qr_invalid).
import 'dart:convert';
import 'dart:io';

import 'package:clby_offline/clby_offline.dart';
import 'package:drift/drift.dart' hide isNull, isNotNull;
import 'package:flutter_test/flutter_test.dart';

import 'helpers.dart';

String dartVerdict(SpecialistQrVerdict v) => switch (v) {
      SpecialistQrValid() => 'ok',
      SpecialistQrNotV2() => 'not_v2',
      SpecialistQrInvalid(:final reason) =>
        reason == SpecialistQrFailure.qrUnknownKey ? 'qr_invalid' : reason.code,
    };

void main() {
  final path = Platform.environment['CLBY_SPECIALIST_CORPUS'];
  if (path == null) {
    test('specialist corpus', () {}, skip: 'CLBY_SPECIALIST_CORPUS unset');
    return;
  }
  test('specialist corpus: every verdict matches the server', () async {
    final c = jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;
    final nowMs = c['now_ms'] as int;
    final clock = TestClock(DateTime.fromMillisecondsSinceEpoch(nowMs, isUtc: true));
    final store = await memoryStore(
      transport: FakeTransport(),
      app: OfflineApp.member,
      clock: clock,
      policy: {...enabledPolicy, 'future_skew_seconds': c['future_skew_seconds'] ?? 300},
      scope: OfflineScope(apiBase: apiBase, gymId: c['gym_id'] as String, userId: uid()),
    );
    for (final k in (c['pass_keys'] as List).cast<Map<String, dynamic>>()) {
      await store.db.into(store.db.cachedPassKeys).insert(CachedPassKeysCompanion.insert(
          kid: k['kid'] as String,
          publicKey: k['public_key'] as String,
          status: k['status'] as String,
          validUntil: Value(k['valid_until'] as String?)));
    }
    for (final t in ((c['trainers'] as List?) ?? const []).cast<Map<String, dynamic>>()) {
      await store.db.into(store.db.cachedTrainers).insert(CachedTrainersCompanion.insert(
          id: t['id'] as String,
          name: Value((t['name'] as String?) ?? ''),
          serviceType: Value(t['service_type'] as String?),
          isActive: Value(t['is_active'] != false)));
    }
    await store.serverClock.record(
        DateTime.fromMillisecondsSinceEpoch(nowMs, isUtc: true).toIso8601String());
    final rows = <String>[];
    var n = 0;
    for (final cs in (c['cases'] as List).cast<Map<String, dynamic>>()) {
      final scanMs = (cs['scan_ms'] as int?) ?? nowMs;
      clock.now = DateTime.fromMillisecondsSinceEpoch(scanMs, isUtc: true);
      final d = dartVerdict(await store.specialistQrVerifier.verify(cs['raw'] as String));
      n++;
      if (d != cs['server']) rows.add('${cs['name']}\tdart=$d\tserver=${cs['server']}');
    }
    // ignore: avoid_print
    print('TOTAL $n DISAGREE ${rows.length}\n${rows.join('\n')}');
    await store.close();
    expect(rows, isEmpty);
  });
}
