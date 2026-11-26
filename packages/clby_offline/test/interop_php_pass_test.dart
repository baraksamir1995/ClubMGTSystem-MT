// Cross-stack check: a member pass signed by clby-api's MemberPassService
// (libsodium) must verify with the Dart verifier. Skipped unless
// CLBY_PHP_PASS points at a JSON file {gym, member, pass, pass_null_n, keys}
// produced with `php artisan tinker` (see the Phase 2 report).
import 'dart:convert';
import 'dart:io';

import 'package:clby_offline/clby_offline.dart';
import 'package:drift/drift.dart' hide isNull, isNotNull;
import 'package:flutter_test/flutter_test.dart';

import 'helpers.dart';

void main() {
  final path = Platform.environment['CLBY_PHP_PASS'];
  if (path == null) {
    test('php interop (set CLBY_PHP_PASS)', () {}, skip: 'CLBY_PHP_PASS unset');
    return;
  }
  final j = jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;

  test('PHP-signed passes verify; tampering fails', () async {
    final store = await memoryStore(
        transport: FakeTransport(),
        app: OfflineApp.coach,
        scope: OfflineScope(apiBase: apiBase, gymId: j['gym'] as String, userId: uid()));
    for (final k in (j['keys'] as List).cast<Map<String, dynamic>>()) {
      await store.db.into(store.db.cachedPassKeys).insert(CachedPassKeysCompanion.insert(
          kid: k['kid'] as String,
          publicKey: k['public_key'] as String,
          status: k['status'] as String,
          validUntil: Value(k['valid_until'] as String?)));
    }
    await store.db.into(store.db.cachedAssignments).insert(CachedAssignmentsCompanion.insert(
        assignmentId: uid(), gymMemberId: j['member'] as String,
        memberName: const Value('barak samir'), status: const Value('active')));
    await store.serverClock.record(DateTime.now().toUtc().toIso8601String());

    for (final raw in [j['pass'] as String, j['pass_null_n'] as String]) {
      final v = await store.passVerifier.verify(raw);
      expect(v, isA<PassValid>(), reason: raw);
    }
    final tampered = (jsonDecode(j['pass'] as String) as Map<String, dynamic>)..['n'] = 2;
    final bad = await store.passVerifier.verify(jsonEncode(tampered));
    expect((bad as PassInvalid).reason, PassFailure.qrInvalid);
    await store.close();
  });
}
