import '../db/offline_database.dart';

/// Monotonic time source: elapsed time since an arbitrary process-local
/// origin. Unaffected by wall-clock changes; resets on app restart.
typedef MonotonicClock = Duration Function();

final Stopwatch _processStopwatch = Stopwatch()..start();

/// Default [MonotonicClock] (process-wide stopwatch).
Duration defaultMonotonicClock() => _processStopwatch.elapsed;

/// Server-time estimate for one store (CONTRACT §6.6).
///
/// Every status, bootstrap page and sync response calls [record] with the
/// server's `server_time`:
/// * in memory it keeps an ANCHOR `(server_time, monotonic_at_receipt)`, so
///   `estimatedServerNow = server_time + monotonic elapsed since`. That
///   estimate is independent of the device wall clock, so a clock change
///   made AFTER the measurement is still detected (the event's stamped wall
///   time drifts away from the estimate);
/// * it persists `server_time − device_wall_now` (ms) in `sync_meta` as a
///   FALLBACK. Monotonic ticks don't survive an app restart or reboot, so
///   after a restart (no anchor yet) the estimate is `device_wall_now +
///   persisted offset` until the next measurement — which can't see a clock
///   change made while the app was not running.
class ServerClock {
  ServerClock(this._db, {DateTime Function()? now, MonotonicClock? monotonic})
      : _now = now ?? DateTime.now,
        _mono = monotonic ?? defaultMonotonicClock;

  final OfflineDatabase _db;
  final DateTime Function() _now;
  final MonotonicClock _mono;

  DateTime? _anchorServer;
  Duration? _anchorMono;

  /// True when an in-memory (monotonic) anchor exists this process.
  bool get hasAnchor => _anchorServer != null;

  Future<void> record(String? serverTime) async {
    if (serverTime == null) return;
    final st = DateTime.tryParse(serverTime);
    if (st == null) return;
    _anchorServer = st.toUtc();
    _anchorMono = _mono();
    await _db.writeMeta(SyncMetaKeys.serverTime, serverTime);
    await _db.writeMeta(SyncMetaKeys.clockOffsetMs,
        '${st.toUtc().difference(_now().toUtc()).inMilliseconds}');
  }

  /// Best estimate of the server's current time, or null if never measured.
  Future<DateTime?> estimatedServerNow() async {
    final s = _anchorServer, m = _anchorMono;
    if (s != null && m != null) return s.add(_mono() - m);
    final off = await readServerClockOffsetMs(_db);
    if (off == null) return null;
    return _now().toUtc().add(Duration(milliseconds: off));
  }

  /// `device_wall_now − estimatedServerNow` in ms (positive = device fast),
  /// or null if never measured.
  Future<int?> deviceAheadMs() async {
    final est = await estimatedServerNow();
    if (est == null) return null;
    return _now().toUtc().difference(est).inMilliseconds;
  }
}

/// Last persisted `server_time − device_now` in ms (fallback / evidence).
Future<int?> readServerClockOffsetMs(OfflineDatabase db) async =>
    int.tryParse(await db.readMeta(SyncMetaKeys.clockOffsetMs) ?? '');
