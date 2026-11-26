import '../db/offline_database.dart';

/// Stores `server_time − device_now` (ms) and the server time itself
/// (CONTRACT §6.6). Called on every status, bootstrap page and sync
/// response, so the offset follows device-clock changes.
Future<void> recordServerClockOffset(
    OfflineDatabase db, String? serverTime, DateTime deviceNow) async {
  if (serverTime == null) return;
  final st = DateTime.tryParse(serverTime);
  if (st == null) return;
  await db.writeMeta(SyncMetaKeys.serverTime, serverTime);
  await db.writeMeta(SyncMetaKeys.clockOffsetMs,
      '${st.toUtc().difference(deviceNow.toUtc()).inMilliseconds}');
}

/// Last known `server_time − device_now` in ms, or null if never measured.
Future<int?> readServerClockOffsetMs(OfflineDatabase db) async =>
    int.tryParse(await db.readMeta(SyncMetaKeys.clockOffsetMs) ?? '');
