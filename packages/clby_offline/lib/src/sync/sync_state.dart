import 'package:meta/meta.dart';

/// Single headline status for the connection indicator (SPEC §9).
/// Precedence (first match wins): deviceRevoked, deviceMismatch,
/// authRequired, failed (envelope rejected), syncing, offline, failed,
/// expired, pending, online.
enum SyncIndicator {
  online,
  offline,
  syncing,
  pending,
  failed,
  expired,
  authRequired,
  deviceRevoked,
  /// 403 `device_mismatch`: this device id is bound to another gym for this
  /// user (CONTRACT §6.1).
  deviceMismatch,
}

/// Why the engine is paused. Paused engines never touch events; they wait
/// for the app to call `SyncEngine.resumeAfterAuth()` (or for a new
/// engine after re-login).
enum SyncPauseReason {
  /// 401 from the sync endpoint (`auth_required`).
  authRequired,

  /// 403 `device_revoked`.
  deviceRevoked,

  /// 403 `device_mismatch` — same user, device id presented for another
  /// gym (CONTRACT §6.1). Distinct from a revocation.
  deviceMismatch,

  /// Other 403 on the envelope (role/permission/gym).
  forbidden,

  /// The server kept rejecting the batch envelope (422) without naming
  /// events (CONTRACT §6.5): stop after a capped number of attempts and
  /// show "failed" instead of retrying forever. A manual `syncNow()`
  /// retries once.
  invalidEnvelope,
}

@immutable
class SyncState {
  const SyncState({
    this.online = true,
    this.syncing = false,
    this.pause,
    this.authMismatch = false,
    this.pendingCount = 0,
    this.syncingCount = 0,
    this.syncedCount = 0,
    this.rejectedCount = 0,
    this.lastSuccessfulSyncAt,
    this.lastError,
    this.lastRunFailed = false,
    this.nextRetryAt,
    this.dataAsOf,
    this.dataAge,
    this.dataExpired = false,
  });

  /// Last known connectivity (a hint; the request outcome is the truth).
  final bool online;
  final bool syncing;
  final SyncPauseReason? pause;
  /// Transport's signed-in user ≠ this store's user (or signed out): the
  /// engine will not send (D9). Not a sticky pause.
  final bool authMismatch;

  /// Events waiting to be sent (`pending` + `syncing`).
  final int pendingCount;
  final int syncingCount;
  final int syncedCount;
  final int rejectedCount;

  final DateTime? lastSuccessfulSyncAt;
  final String? lastError;
  /// The most recent run ended with a transient failure.
  final bool lastRunFailed;
  final DateTime? nextRetryAt;

  /// Snapshot `as_of` of the cached operational data (null = never
  /// bootstrapped). Always label cached validity "as of …".
  final DateTime? dataAsOf;
  final Duration? dataAge;
  /// Cached data older than policy `max_data_age_hours` (or missing).
  final bool dataExpired;

  SyncIndicator get indicator {
    if (pause == SyncPauseReason.deviceRevoked) return SyncIndicator.deviceRevoked;
    if (pause == SyncPauseReason.deviceMismatch) return SyncIndicator.deviceMismatch;
    if (pause == SyncPauseReason.invalidEnvelope) return SyncIndicator.failed;
    if (pause != null || authMismatch) return SyncIndicator.authRequired;
    if (syncing) return SyncIndicator.syncing;
    if (!online) return SyncIndicator.offline;
    if (lastRunFailed && pendingCount > 0) return SyncIndicator.failed;
    if (dataExpired) return SyncIndicator.expired;
    if (pendingCount > 0) return SyncIndicator.pending;
    return SyncIndicator.online;
  }

  SyncState copyWith({
    bool? online,
    bool? syncing,
    Object? pause = _keep,
    bool? authMismatch,
    int? pendingCount,
    int? syncingCount,
    int? syncedCount,
    int? rejectedCount,
    Object? lastSuccessfulSyncAt = _keep,
    Object? lastError = _keep,
    bool? lastRunFailed,
    Object? nextRetryAt = _keep,
    Object? dataAsOf = _keep,
    Object? dataAge = _keep,
    bool? dataExpired,
  }) =>
      SyncState(
        online: online ?? this.online,
        syncing: syncing ?? this.syncing,
        pause: identical(pause, _keep) ? this.pause : pause as SyncPauseReason?,
        authMismatch: authMismatch ?? this.authMismatch,
        pendingCount: pendingCount ?? this.pendingCount,
        syncingCount: syncingCount ?? this.syncingCount,
        syncedCount: syncedCount ?? this.syncedCount,
        rejectedCount: rejectedCount ?? this.rejectedCount,
        lastSuccessfulSyncAt: identical(lastSuccessfulSyncAt, _keep)
            ? this.lastSuccessfulSyncAt
            : lastSuccessfulSyncAt as DateTime?,
        lastError:
            identical(lastError, _keep) ? this.lastError : lastError as String?,
        lastRunFailed: lastRunFailed ?? this.lastRunFailed,
        nextRetryAt: identical(nextRetryAt, _keep)
            ? this.nextRetryAt
            : nextRetryAt as DateTime?,
        dataAsOf:
            identical(dataAsOf, _keep) ? this.dataAsOf : dataAsOf as DateTime?,
        dataAge: identical(dataAge, _keep) ? this.dataAge : dataAge as Duration?,
        dataExpired: dataExpired ?? this.dataExpired,
      );

  @override
  String toString() => 'SyncState(${indicator.name}, pending=$pendingCount, '
      'synced=$syncedCount, rejected=$rejectedCount, pause=$pause, '
      'err=$lastError)';
}

const _keep = Object();

/// What caused a sync run.
enum SyncTrigger { manual, appStart, resume, connectivity, recorded, retryTimer, authRestored }

/// Outcome of one `syncNow` run.
@immutable
class SyncRunResult {
  const SyncRunResult({
    this.sent = 0,
    this.synced = 0,
    this.rejected = 0,
    this.retrying = 0,
    this.pause,
    this.error,
    this.skipped = false,
    this.aborted = false,
  });

  /// Events included in requests that got a 200.
  final int sent;
  final int synced;
  final int rejected;
  /// Events that went back to `pending` (per-event error, missing result,
  /// or transport failure).
  final int retrying;
  final SyncPauseReason? pause;
  final Object? error;
  /// Nothing attempted (paused, disposed, user mismatch).
  final bool skipped;
  /// The pass stopped early because the signed-in user changed (D9).
  final bool aborted;

  SyncRunResult operator +(SyncRunResult o) => SyncRunResult(
        sent: sent + o.sent,
        synced: synced + o.synced,
        rejected: rejected + o.rejected,
        retrying: retrying + o.retrying,
        pause: o.pause ?? pause,
        error: o.error ?? error,
        skipped: skipped && o.skipped,
        aborted: aborted || o.aborted,
      );
}
