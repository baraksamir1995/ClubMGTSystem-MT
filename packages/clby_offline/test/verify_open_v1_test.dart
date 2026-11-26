// VERIFY-ONLY (throwaway): open a real encrypted v1 file with the current
// package. Skipped unless V1DIR is set.
import 'dart:convert';
import 'dart:io';
import 'package:clby_offline/clby_offline.dart';
import 'package:flutter_test/flutter_test.dart';

class FileKeyStore implements KeyStore {
  FileKeyStore(this.f);
  final File f;
  Map<String, dynamic> _m() => f.existsSync() ? jsonDecode(f.readAsStringSync()) : {};
  @override
  Future<String?> read(String key) async => _m()[key] as String?;
  @override
  Future<void> write(String key, String value) async =>
      f.writeAsStringSync(jsonEncode({..._m(), key: value}));
}

void main() {
  final d = Platform.environment['V1DIR'];
  if (d == null) {
    test('open v1', () {}, skip: 'V1DIR unset');
    return;
  }
  test('open real v1 file with current package', () async {
    final dir = Directory(d);
    final kf = File('${dir.path}/keys.json');
    final before = kf.readAsStringSync();
    final scope = OfflineScope(apiBase: 'https://api.x', gymId: 'f59a895f-430e-46d7-ae1c-01602f4ec4fd', userId: 'd7d83ae0-3061-4580-911a-2b2f3decabaa');
    final db = await openOfflineDatabase(scope: scope, directory: dir, keyStore: FileKeyStore(kf), inBackground: false);
    final uv = await db.customSelect('PRAGMA user_version').getSingle();
    final rows = await db.select(db.outboxEvents).get();
    final tables = await db.customSelect("select name from sqlite_master where type in ('table','trigger') order by name").get();
    print('V2 user_version=${uv.data} outbox=${rows.map((r) => '${r.eventId}:${r.syncStatus}').toList()}');
    print('V2 objects=${tables.map((t) => t.data['name']).toList()}');
    print('V2 asOf=${await db.readMeta(SyncMetaKeys.asOf)}');
    expect(uv.data['user_version'], 2);
    expect(rows.length, 3);
    expect(rows.every((r) => r.syncStatus == 'pending'), isTrue);
    await db.into(db.cachedPassKeys).insert(CachedPassKeysCompanion.insert(kid: 'k', publicKey: 'p', status: 'active'));
    expect(kf.readAsStringSync(), before, reason: 'key unchanged');
    await db.close();
    // reopen once more (idempotent)
    final db2 = await openOfflineDatabase(scope: scope, directory: dir, keyStore: FileKeyStore(kf), inBackground: false);
    expect((await db2.select(db2.cachedPassKeys).get()).single.kid, 'k');
    expect((await db2.select(db2.outboxEvents).get()).length, 3);
    await db2.close();
  });
}
