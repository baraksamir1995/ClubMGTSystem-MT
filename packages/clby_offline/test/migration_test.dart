import 'package:clby_offline/clby_offline.dart';
import 'package:drift/drift.dart';
import 'package:drift_dev/api/migrations_native.dart';
import 'package:flutter_test/flutter_test.dart' hide isNull, isNotNull;

import 'generated_migrations/schema.dart';
import 'generated_migrations/schema_v1.dart' as v1;
import 'generated_migrations/schema_v2.dart' as v2;
import 'generated_migrations/schema_v3.dart' as v3;

void main() {
  driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;
  late SchemaVerifier verifier;
  setUpAll(() => verifier = SchemaVerifier(GeneratedHelper()));

  test('v2 → v3 matches the exported v3 schema; v1 → v3 too', () async {
    for (final from in [1, 2]) {
      final schema = await verifier.schemaAt(from);
      final db = OfflineDatabase(schema.newConnection());
      await verifier.migrateAndValidate(db, 3);
      await db.close();
    }
  });

  test('v2 → v3 keeps branches + outbox; qr_token starts null', () async {
    await verifier.testWithDataIntegrity(
      oldVersion: 2,
      newVersion: 3,
      createOld: v2.DatabaseAtV2.new,
      createNew: v3.DatabaseAtV3.new,
      openTestedDatabase: OfflineDatabase.new,
      createItems: (batch, oldDb) {
        batch.insert(oldDb.cachedBranches,
            const v2.CachedBranchesData(id: 'b1', name: 'Main', isActive: 1));
        batch.insert(oldDb.outboxEvents, const v2.OutboxEventsData(
          eventId: 'e-2', kind: 'attendance', gymId: 'g', memberId: 'm',
          deviceRecordedAt: '2026-11-27T08:00:00.000+02:00', deviceRecordedAtMs: 1,
          deviceTimezone: 'Africa/Cairo', metadata: '{}', actorUserId: 'u',
          actorType: 'member', deviceId: 'd', syncStatus: 'pending', syncAttempts: 0,
          flags: '[]', createdAt: 1, attendanceMethod: 'member_qr'));
      },
      validateItems: (newDb) async {
        final b = await newDb.select(newDb.cachedBranches).getSingle();
        expect(b.name, 'Main');
        expect(b.qrToken, equals(null));
        expect((await newDb.select(newDb.outboxEvents).getSingle()).eventId, 'e-2');
      },
    );
  });

  test('v1 → v2 matches the exported v2 schema', () async {
    final schema = await verifier.schemaAt(1);
    final db = OfflineDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, 2);
    await db.close();
  });

  test('v1 → v2 keeps outbox + cache rows and adds cached_pass_keys', () async {
    final row = v1.OutboxEventsData(
      eventId: 'e-1', kind: 'service_session', gymId: 'g', memberId: 'm',
      deviceRecordedAt: '2026-11-26T08:00:00.000+02:00', deviceRecordedAtMs: 1,
      deviceTimezone: 'Africa/Cairo', metadata: '{}', actorUserId: 'u',
      actorType: 'coach', deviceId: 'd', syncStatus: 'pending', syncAttempts: 0,
      flags: '[]', createdAt: 1, serviceAssignmentId: 'a',
    );
    await verifier.testWithDataIntegrity(
      oldVersion: 1,
      newVersion: 2,
      createOld: v1.DatabaseAtV1.new,
      createNew: v2.DatabaseAtV2.new,
      openTestedDatabase: OfflineDatabase.new,
      createItems: (batch, oldDb) {
        batch.insert(oldDb.outboxEvents, row);
        batch.insert(oldDb.cachedMembers, const v1.CachedMembersData(
            gymMemberId: 'm', fullName: 'A', searchText: 'a'));
      },
      validateItems: (newDb) async {
        final out = await newDb.select(newDb.outboxEvents).get();
        expect(out.single.eventId, 'e-1');
        expect(out.single.syncStatus, 'pending');
        expect((await newDb.select(newDb.cachedMembers).get()).single.fullName, 'A');
        expect(await newDb.select(newDb.cachedPassKeys).get(), isEmpty);
      },
    );
  });

  test('current app opens a v1 file and upgrades it in place', () async {
    final schema = await verifier.schemaAt(1);
    final db = OfflineDatabase(schema.newConnection());
    await db.customSelect('SELECT 1').get();
    expect(db.schemaVersion, 3);
    await db.into(db.cachedPassKeys).insert(CachedPassKeysCompanion.insert(
        kid: 'k', publicKey: 'p', status: 'active'));
    await db.close();
  });
}
