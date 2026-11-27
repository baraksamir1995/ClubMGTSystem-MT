/// Why the encrypted offline store could not be opened.
enum OfflineStoreFailure {
  /// The keychain/keystore read failed or kept returning nothing while the
  /// database file exists. We NEVER generate a new key in that case (it
  /// would orphan pending events) — retry later.
  keyUnavailable,

  /// The key was read but does not decrypt the database (wrong key,
  /// restored backup, corruption). The file is left untouched.
  keyMismatch,

  /// The native SQLite library is not the SQLite3MultipleCiphers build —
  /// the app's pubspec is missing `hooks: user_defines: sqlite3: source:
  /// sqlite3mc`. Fail closed: never write member data unencrypted.
  encryptionUnsupported,

  /// The file was written by a newer app version (schema downgrade).
  schemaTooNew,

  /// Device identity could not be read/created.
  deviceIdUnavailable,

  /// Anything else while opening.
  openFailed,
}

/// Thrown when the offline store (or device identity) cannot be opened
/// safely. Callers must treat offline features as unavailable and retry
/// later; nothing has been deleted or regenerated.
class OfflineStoreUnavailable implements Exception {
  const OfflineStoreUnavailable(this.reason, [this.detail]);

  final OfflineStoreFailure reason;
  final String? detail;

  @override
  String toString() =>
      'OfflineStoreUnavailable(${reason.name}${detail == null ? '' : ': $detail'})';
}
