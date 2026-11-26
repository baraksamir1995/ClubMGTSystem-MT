// VERIFY-ONLY (throwaway): runs the PHP pass corpus through the Dart
// MemberPassVerifier. Skipped unless CLBY_VERIFY_CORPUS is set.
import 'dart:convert';
import 'dart:io';

import 'package:clby_offline/clby_offline.dart';
import 'package:drift/drift.dart' hide isNull, isNotNull;
import 'package:flutter_test/flutter_test.dart';

import 'helpers.dart';

void main() {
  final path = Platform.environment['CLBY_VERIFY_CORPUS'];
  final out = Platform.environment['CLBY_VERIFY_OUT'];
  if (path == null) {
    test('corpus', () {}, skip: 'CLBY_VERIFY_CORPUS unset');
    return;
  }
  test('corpus', () async {
    final c = jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;
    final nowMs = c['now_ms'] as int;
    final clock = TestClock(DateTime.fromMillisecondsSinceEpoch(nowMs, isUtc: true));
    final store = await memoryStore(
        transport: FakeTransport(),
        app: OfflineApp.admin,
        clock: clock,
        policy: {...enabledPolicy, 'future_skew_seconds': c['future_skew_seconds']},
        scope: OfflineScope(apiBase: apiBase, gymId: c['gym_id'] as String, userId: uid()));
    for (final k in (c['pass_keys'] as List).cast<Map<String, dynamic>>()) {
      await store.db.into(store.db.cachedPassKeys).insert(CachedPassKeysCompanion.insert(
          kid: k['kid'] as String,
          publicKey: k['public_key'] as String,
          status: k['status'] as String,
          validUntil: Value(k['valid_until'] as String?)));
    }
    for (final m in (c['cached_member_ids'] as List).cast<String>()) {
      await store.db.into(store.db.cachedMembers).insert(CachedMembersCompanion.insert(
          gymMemberId: m, fullName: 'x', searchText: 'x'));
    }
    await store.serverClock.record(
        DateTime.fromMillisecondsSinceEpoch(nowMs, isUtc: true).toIso8601String());
    expect(store.policy.value.futureSkewSeconds, c['future_skew_seconds']);
    final verdicts = <String, String>{};
    final rows = <String>[];
    for (final cs in (c['cases'] as List).cast<Map<String, dynamic>>()) {
      // Server clock stays anchored at now_ms; the device wall clock (scan
      // time) is the case's scan_ms when given (corpus v2).
      final scanMs = (cs['scan_ms'] as int?) ?? nowMs;
      clock.now = DateTime.fromMillisecondsSinceEpoch(scanMs, isUtc: true);
      final v = await store.passVerifier.verify(cs['raw'] as String);
      // qr_unknown_key is a client-only code; the server says qr_invalid
      // (PHASE2-CONTRACT step 2).
      final raw = v is PassValid ? 'ok' : (v as PassInvalid).reason.code;
      final d = raw == 'qr_unknown_key' ? 'qr_invalid' : raw;
      verdicts[cs['name'] as String] = d;
      final s = cs['server'] as String;
      if (d != s) rows.add('${cs['name']}\tdart=$d\tserver=$s');
    }
    if (out != null) {
      File(out).writeAsStringSync(const JsonEncoder.withIndent(' ').convert(verdicts));
    }
    // ignore: avoid_print
    print('TOTAL ${verdicts.length} DISAGREE ${rows.length}\n${rows.join('\n')}');
    await store.close();
    expect(rows, isEmpty, reason: 'every verdict must match the server');
  });
}
