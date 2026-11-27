import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:uuid/uuid.dart';

import '../errors.dart';
import '../security/key_store.dart';

/// Stable per-install device id (UUID v4), sent as `X-Device-Id` and in
/// every sync envelope. Evidence, not authorization.
///
/// Stored in secure storage. A non-secret mirror file in the app-support
/// directory acts as a witness so a flaky keychain read can never mint a
/// second id for the same install:
/// * secure value present → use it (and refresh the mirror);
/// * secure read failed / empty but mirror present → use the mirror and
///   re-write secure storage;
/// * secure read FAILED and no mirror → [OfflineStoreUnavailable]
///   (never generate on a failed read);
/// * secure read definitely empty and no mirror → first run: generate.
///
/// On iOS reinstall the member app's FreshInstallGuard wipes the keychain
/// and the sandbox (mirror) is gone too, so a reinstall gets a new id.
class DeviceIdentity {
  DeviceIdentity({
    KeyStore keyStore = const SecureKeyStore(),
    required Directory mirrorDirectory,
    Duration retryDelay = const Duration(milliseconds: 200),
  })  : _store = keyStore,
        _mirror = File(p.join(mirrorDirectory.path, _mirrorName)),
        _retryDelay = retryDelay;

  static const storageKey = 'clby_device_id_v1';
  static const _mirrorName = '.clby_device_id';
  static final _uuidRe = RegExp(
      r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');

  final KeyStore _store;
  final File _mirror;
  final Duration _retryDelay;
  String? _cached;

  /// The id if [load] already succeeded this process, else null.
  String? get current => _cached;

  Future<String> load() async {
    if (_cached != null) return _cached!;
    final r = await readWithRetry(_store, storageKey, delay: _retryDelay);
    final mirror = _readMirror();
    if (r.value != null && _uuidRe.hasMatch(r.value!)) {
      if (mirror != r.value) _writeMirror(r.value!);
      return _cached = r.value!;
    }
    if (mirror != null) {
      try {
        await _store.write(storageKey, mirror);
      } catch (_) {/* mirror stays authoritative until next run */}
      return _cached = mirror;
    }
    if (r.readFailed) {
      throw const OfflineStoreUnavailable(
          OfflineStoreFailure.deviceIdUnavailable, 'secure storage read failed');
    }
    final id = const Uuid().v4();
    try {
      await _store.write(storageKey, id);
    } catch (e) {
      throw OfflineStoreUnavailable(
          OfflineStoreFailure.deviceIdUnavailable, 'could not persist: $e');
    }
    _writeMirror(id);
    return _cached = id;
  }

  String? _readMirror() {
    try {
      if (!_mirror.existsSync()) return null;
      final v = _mirror.readAsStringSync().trim();
      return _uuidRe.hasMatch(v) ? v : null;
    } catch (_) {
      return null;
    }
  }

  void _writeMirror(String id) {
    try {
      _mirror.parent.createSync(recursive: true);
      _mirror.writeAsStringSync(id, flush: true);
    } catch (_) {/* best effort */}
  }
}
