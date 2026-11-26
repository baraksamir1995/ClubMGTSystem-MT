import 'dart:async';
import 'dart:convert';

import '../db/offline_database.dart';
import 'offline_policy.dart';

/// The current [OfflinePolicy] for one store, persisted in `sync_meta`
/// so it survives restarts (offline cold start keeps the last server
/// policy; first run uses the safe compiled-in defaults).
class PolicyHolder {
  PolicyHolder(this._db);

  final OfflineDatabase _db;
  OfflinePolicy _value = OfflinePolicy.defaults;
  final _changes = StreamController<OfflinePolicy>.broadcast();

  OfflinePolicy get value => _value;
  Stream<OfflinePolicy> get changes => _changes.stream;

  Future<void> load() async {
    _value = OfflinePolicy.fromJsonString(await _db.readMeta(SyncMetaKeys.policy));
  }

  /// Stores the server's policy object. `enabledOverride` lets the status
  /// endpoint's top-level `enabled` win over the nested policy's.
  Future<void> applyServerPolicy(Map<String, Object?>? json,
      {bool? enabledOverride}) async {
    if (json == null && enabledOverride == null) return;
    final merged = <String, Object?>{
      ...(json ?? _value.toJson()),
      'enabled': ?enabledOverride,
    };
    _value = OfflinePolicy.fromJson(merged);
    await _db.writeMeta(SyncMetaKeys.policy, jsonEncode(_value.toJson()));
    if (!_changes.isClosed) _changes.add(_value);
  }

  Future<void> dispose() => _changes.close();
}
