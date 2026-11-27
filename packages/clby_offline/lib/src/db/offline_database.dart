import 'package:drift/drift.dart';

import 'tables.dart';

part 'offline_database.g.dart';

/// Keys used in the `sync_meta` key/value table.
abstract final class SyncMetaKeys {
  /// Snapshot `as_of` (ISO) of the last successful bootstrap.
  static const asOf = 'as_of';
  /// Server time (ISO) reported by the last bootstrap/status/sync.
  static const serverTime = 'server_time';
  /// Device time (ISO UTC) of the last 200 from POST /attendance/sync.
  static const lastSuccessfulSyncAt = 'last_successful_sync_at';
  /// Device time (ISO UTC) of the last completed bootstrap.
  static const lastBootstrapAt = 'last_bootstrap_at';
  /// Server policy object (JSON) — CONTRACT §4.
  static const policy = 'policy';
  /// Cursor of an in-progress bootstrap paging run (diagnostics only; the
  /// snapshot is only applied once ALL pages arrived).
  static const bootstrapCursor = 'bootstrap_cursor';
  /// `{id,name,timezone}` JSON from the snapshot.
  static const gym = 'gym';
  /// Member identity JSON (member app `/offline/me`).
  static const member = 'member';
  /// The coach's own signed QR `{qr, expires_at, kid}` (coach bootstrap
  /// `own_qr`, Phase 3 Amendment 2).
  static const ownQr = 'own_qr';
  /// `server_time - device_time` in ms, last measured.
  static const clockOffsetMs = 'clock_offset_ms';
  /// `{registered, revoked}` JSON from /offline/status.
  static const device = 'device';
  /// `enabled` flag from /offline/status.
  static const enabled = 'enabled';

  /// Keys that describe cached operational data and are wiped on logout.
  /// Outbox-related keys (last successful sync) survive.
  static const cacheKeys = {
    asOf,
    serverTime,
    lastBootstrapAt,
    bootstrapCursor,
    gym,
    member,
    ownQr,
  };
}

/// Encrypted per-scope store. One file per (apiBase, gymId, userId) — see
/// `OfflineScope`. Open it through `OfflineStore` / `openOfflineDatabase`.
@DriftDatabase(
  tables: [
    OutboxEvents,
    CachedMembers,
    CachedMemberships,
    CachedBranches,
    CachedClassSessions,
    CachedAssignments,
    CachedRecentAttendance,
    CachedRecentServiceLogs,
    CachedPassKeys,
    CachedTrainers,
    SyncMeta,
  ],
)
class OfflineDatabase extends _$OfflineDatabase {
  OfflineDatabase(super.e);

  /// Bump on every schema change and add a step to [_upgradeSteps].
  /// Exported schemas live in `drift_schemas/` (`dart run drift_dev schema
  /// dump lib/src/db/offline_database.dart drift_schemas/`).
  static const int currentSchemaVersion = 4;

  @override
  int get schemaVersion => currentSchemaVersion;

  /// Forward-only, step-wise migrations: `from` → `from+1` → … → `to`.
  /// Each step must be additive for the outbox (never drop unsynced rows).
  /// v1 is the initial schema.
  /// v2 (Phase 2): `cached_pass_keys` for offline member-pass verification.
  /// v3 (Phase 3): `cached_branches.qr_token`.
  /// v4 (Phase 3 Amendment 2): `outbox_events.trainer_id`,
  /// `cached_assignments.trainer_id`, `cached_trainers`.
  static final Map<int, Future<void> Function(Migrator m, OfflineDatabase db)>
      _upgradeSteps = {
    2: (m, db) => m.createTable(db.cachedPassKeys),
    // v3 (Phase 3): branch QR tokens for offline v2 branch-QR verification.
    3: (m, db) => m.addColumn(db.cachedBranches, db.cachedBranches.qrToken),
    // v4 (Phase 3 Amendment 2): member-scanned coach QRs.
    4: (m, db) async {
      await m.addColumn(db.outboxEvents, db.outboxEvents.trainerId);
      await m.addColumn(db.cachedAssignments, db.cachedAssignments.trainerId);
      await m.createTable(db.cachedTrainers);
    },
  };

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onCreate: (m) async {
          await m.createAll();
          await _createOutboxGuards();
        },
        onUpgrade: (m, from, to) async {
          for (var v = from + 1; v <= to; v++) {
            final step = _upgradeSteps[v];
            if (step == null) {
              throw StateError('No offline DB migration to v$v (from $from)');
            }
            await step(m, this);
          }
        },
        beforeOpen: (details) async {
          // Member pass removed (Phase 3 Amendment 2 §A): drop a pass
          // cached by an earlier build. Idempotent and cheap.
          if (details.versionNow <= currentSchemaVersion) {
            await customStatement("DELETE FROM sync_meta WHERE key = 'member_pass'");
          }
          if (details.versionNow > currentSchemaVersion) {
            // Downgrade (older app on a newer DB): refuse rather than
            // corrupt; the caller surfaces OfflineStoreUnavailable.
            throw StateError(
                'Offline DB schema v${details.versionNow} is newer than '
                'this app (v$currentSchemaVersion)');
          }
        },
      );

  /// Indexes + integrity triggers for the outbox. Idempotent.
  Future<void> _createOutboxGuards() async {
    await customStatement(
        'CREATE INDEX IF NOT EXISTS outbox_status_order ON outbox_events '
        '(sync_status, device_recorded_at_ms, created_at)');
    await customStatement(
        'CREATE INDEX IF NOT EXISTS outbox_member_kind ON outbox_events '
        '(member_id, kind, device_recorded_at_ms)');
    await customStatement(
        'CREATE INDEX IF NOT EXISTS cached_memberships_member ON '
        'cached_memberships (gym_member_id)');
    await customStatement(
        'CREATE INDEX IF NOT EXISTS cached_recent_att_member ON '
        'cached_recent_attendance (gym_member_id, class_session_id)');
    // The original event is evidence: its identity and timestamp can never
    // be rewritten by sync.
    await customStatement('''
CREATE TRIGGER IF NOT EXISTS outbox_immutable_fields
BEFORE UPDATE OF event_id, kind, member_id, gym_id, device_recorded_at,
  device_recorded_at_ms, device_timezone, actor_user_id, created_at
ON outbox_events
WHEN OLD.event_id IS NOT NEW.event_id
  OR OLD.kind IS NOT NEW.kind
  OR OLD.member_id IS NOT NEW.member_id
  OR OLD.gym_id IS NOT NEW.gym_id
  OR OLD.device_recorded_at IS NOT NEW.device_recorded_at
  OR OLD.device_recorded_at_ms IS NOT NEW.device_recorded_at_ms
  OR OLD.device_timezone IS NOT NEW.device_timezone
  OR OLD.actor_user_id IS NOT NEW.actor_user_id
  OR OLD.created_at IS NOT NEW.created_at
BEGIN
  SELECT RAISE(ABORT, 'outbox event identity/timestamp is immutable');
END''');
    // Unsynced events are never deleted.
    await customStatement('''
CREATE TRIGGER IF NOT EXISTS outbox_no_delete_unsynced
BEFORE DELETE ON outbox_events
WHEN OLD.sync_status IN ('pending','syncing')
BEGIN
  SELECT RAISE(ABORT, 'unsynced outbox events cannot be deleted');
END''');
  }

  // ── sync_meta helpers ──────────────────────────────────────────────────

  Future<String?> readMeta(String key) async {
    final row = await (select(syncMeta)..where((t) => t.key.equals(key)))
        .getSingleOrNull();
    return row?.value;
  }

  Future<void> writeMeta(String key, String? value) => into(syncMeta)
      .insertOnConflictUpdate(SyncMetaCompanion.insert(
          key: key, value: Value(value)));

  /// Crash recovery: anything left `syncing` by a killed process goes back
  /// to `pending` (safe — the server is idempotent by event_id).
  Future<int> recoverInterruptedSync() => (update(outboxEvents)
        ..where((t) => t.syncStatus.equals('syncing')))
      .write(const OutboxEventsCompanion(syncStatus: Value('pending')));

  /// Logout policy (D9): wipe cached operational data, KEEP the outbox.
  Future<void> wipeCache() => transaction(() async {
        await delete(cachedMembers).go();
        await delete(cachedMemberships).go();
        await delete(cachedBranches).go();
        await delete(cachedClassSessions).go();
        await delete(cachedAssignments).go();
        await delete(cachedRecentAttendance).go();
        await delete(cachedRecentServiceLogs).go();
        await delete(cachedPassKeys).go();
        await delete(cachedTrainers).go();
        await (delete(syncMeta)
              ..where((t) => t.key.isIn(SyncMetaKeys.cacheKeys)))
            .go();
      });
}
