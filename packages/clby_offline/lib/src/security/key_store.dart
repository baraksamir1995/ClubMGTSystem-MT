import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Minimal secret store abstraction (tests use [InMemoryKeyStore]).
abstract class KeyStore {
  /// Returns the value, `null` when absent. May throw on platform errors.
  Future<String?> read(String key);
  Future<void> write(String key, String value);
}

/// [KeyStore] over flutter_secure_storage.
///
/// iOS: `first_unlock_this_device` so a sync running while the phone is
/// locked (after first unlock) can still open the DB, and the item never
/// migrates to another device via backup.
/// Android: EncryptedSharedPreferences.
class SecureKeyStore implements KeyStore {
  const SecureKeyStore([this._storage = _defaultStorage]);

  static const _defaultStorage = FlutterSecureStorage(
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock_this_device),
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);
}

/// Test/in-memory implementation. `failReads` simulates a flaky keychain.
class InMemoryKeyStore implements KeyStore {
  final Map<String, String> values = {};

  /// When > 0, the next N reads throw.
  int failReads = 0;

  /// When true, reads return null even if a value exists (iOS keychain
  /// "item not found" flake).
  bool readsReturnNull = false;

  @override
  Future<String?> read(String key) async {
    if (failReads > 0) {
      failReads--;
      throw StateError('simulated keychain failure');
    }
    if (readsReturnNull) return null;
    return values[key];
  }

  @override
  Future<void> write(String key, String value) async => values[key] = value;
}

/// Reads a secret with retries; distinguishes "definitely absent" from
/// "couldn't read". Returns `(value, readFailed)`.
Future<({String? value, bool readFailed})> readWithRetry(
  KeyStore store,
  String key, {
  int attempts = 3,
  Duration delay = const Duration(milliseconds: 200),
}) async {
  var failed = false;
  for (var i = 0; i < attempts; i++) {
    if (i > 0) await Future<void>.delayed(delay * i);
    try {
      final v = await store.read(key);
      if (v != null && v.isNotEmpty) return (value: v, readFailed: false);
      failed = false;
    } catch (_) {
      failed = true;
    }
  }
  return (value: null, readFailed: failed);
}
