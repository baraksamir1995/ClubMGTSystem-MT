import 'dart:io';
import 'dart:math';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path/path.dart' as p;
import 'package:sqlite3/sqlite3.dart' show Database;

import '../errors.dart';
import '../scope.dart';
import '../security/key_store.dart';
import 'offline_database.dart';

const _noMcMarker = 'CLBY_SQLITE3MC_MISSING';

/// Opens (creating if needed) the encrypted database for [scope] inside
/// [directory].
///
/// Key rules (member-app audit §6.2):
/// * key present → use it;
/// * key read FAILED (threw on every retry) → [OfflineStoreUnavailable]
///   (`keyUnavailable`), nothing is generated;
/// * key absent AND db file absent → fresh scope: generate a 256-bit key,
///   write it, read it back, then create the DB;
/// * key absent but db file EXISTS → [OfflineStoreUnavailable]
///   (`keyUnavailable`): the keychain may just be flaky, and a new key
///   would orphan the pending events. The file is never deleted here.
///
/// Encryption is SQLite3MultipleCiphers (`PRAGMA hexkey`), verified on
/// every open (`PRAGMA cipher` must answer) — fails closed with
/// `encryptionUnsupported` when the app forgot the sqlite3mc hook define.
Future<OfflineDatabase> openOfflineDatabase({
  required OfflineScope scope,
  required Directory directory,
  KeyStore keyStore = const SecureKeyStore(),
  bool inBackground = true,
  Duration keyRetryDelay = const Duration(milliseconds: 200),
}) async {
  final file = File(p.join(directory.path, scope.databaseFileName));
  final existed = file.existsSync();

  final hexKey = await _resolveKey(
    keyStore: keyStore,
    entry: scope.keyStoreEntry,
    dbExists: existed,
    retryDelay: keyRetryDelay,
  );

  if (!directory.existsSync()) directory.createSync(recursive: true);

  void setup(Database raw) {
    // Must be the very first statement on the connection.
    raw.execute("PRAGMA hexkey = '$hexKey';");
    final cipher = raw.select('PRAGMA cipher');
    if (cipher.isEmpty) {
      throw StateError(_noMcMarker);
    }
  }

  final QueryExecutor executor = inBackground
      ? NativeDatabase.createInBackground(file, setup: setup)
      : NativeDatabase(file, setup: setup);

  final db = OfflineDatabase(executor);
  try {
    // Forces the open: key check, cipher check, migrations.
    await db.customSelect('SELECT count(*) AS c FROM sqlite_master').get();
  } catch (e) {
    await _safeClose(db);
    throw _mapOpenError(e);
  }
  return db;
}

/// In-memory, UNENCRYPTED database — unit tests only.
OfflineDatabase openInMemoryOfflineDatabase() =>
    OfflineDatabase(NativeDatabase.memory());

/// File-backed UNENCRYPTED database — unit tests only (persistence tests
/// that don't need the key path).
OfflineDatabase openPlainFileOfflineDatabase(File file) =>
    OfflineDatabase(NativeDatabase(file));

Future<String> _resolveKey({
  required KeyStore keyStore,
  required String entry,
  required bool dbExists,
  required Duration retryDelay,
}) async {
  final r = await readWithRetry(keyStore, entry, delay: retryDelay);
  if (r.value != null) {
    if (!_isHexKey(r.value!)) {
      throw const OfflineStoreUnavailable(
          OfflineStoreFailure.keyMismatch, 'stored key is malformed');
    }
    return r.value!;
  }
  if (r.readFailed) {
    throw const OfflineStoreUnavailable(
        OfflineStoreFailure.keyUnavailable, 'secure storage read failed');
  }
  if (dbExists) {
    throw const OfflineStoreUnavailable(OfflineStoreFailure.keyUnavailable,
        'database exists but its key could not be found');
  }
  // Fresh scope: generate, persist, verify.
  final rnd = Random.secure();
  final bytes = List<int>.generate(32, (_) => rnd.nextInt(256));
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  try {
    await keyStore.write(entry, hex);
  } catch (e) {
    throw OfflineStoreUnavailable(
        OfflineStoreFailure.keyUnavailable, 'could not persist key: $e');
  }
  final check = await readWithRetry(keyStore, entry, delay: retryDelay);
  if (check.value != hex) {
    throw const OfflineStoreUnavailable(OfflineStoreFailure.keyUnavailable,
        'key could not be read back after writing');
  }
  return hex;
}

bool _isHexKey(String v) => RegExp(r'^[0-9a-f]{64}$').hasMatch(v);

OfflineStoreUnavailable _mapOpenError(Object e) {
  final s = e.toString();
  if (s.contains(_noMcMarker)) {
    return const OfflineStoreUnavailable(
        OfflineStoreFailure.encryptionUnsupported,
        'sqlite3 is not the sqlite3mc build (missing hooks.user_defines)');
  }
  if (s.contains('not a database') || s.contains('SQLITE_NOTADB') ||
      s.contains('code 26')) {
    return const OfflineStoreUnavailable(OfflineStoreFailure.keyMismatch,
        'key does not decrypt the database');
  }
  if (s.contains('is newer than this app')) {
    return OfflineStoreUnavailable(OfflineStoreFailure.schemaTooNew, s);
  }
  return OfflineStoreUnavailable(OfflineStoreFailure.openFailed, s);
}

Future<void> _safeClose(OfflineDatabase db) async {
  try {
    await db.close();
  } catch (_) {}
}
