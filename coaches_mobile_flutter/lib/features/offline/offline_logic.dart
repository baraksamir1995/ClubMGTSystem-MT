import 'package:clby_offline/clby_offline.dart';

import 'offline_strings.dart';

/// Which path a PT session log takes (PHASE2-CONTRACT "Online vs offline").
enum LogPath {
  /// policy.enabled + store open → outbox (synced immediately when online).
  outbox,
  /// policy disabled (or no store) while online → existing
  /// `POST /coach/sessions/decrement`.
  online,
  /// Offline mode but recording isn't possible (policy off / no store).
  unavailable,
}

LogPath chooseLogPath({
  required bool storeOpen,
  required bool policyEnabled,
  required bool offlineMode,
}) {
  if (storeOpen && policyEnabled) return LogPath.outbox;
  if (offlineMode) return LogPath.unavailable;
  return LogPath.online;
}

/// "Active" per the cached snapshot (labelled "as of", never live):
/// status active (or unknown), sessions left (when known), not expired.
bool isActiveCachedAssignment(CachedAssignment a, DateTime now) {
  final st = a.status;
  if (st != null && st != 'active') return false;
  final total = a.sessionsTotal, used = a.sessionsUsed;
  if (total != null && used != null && used >= total) return false;
  final exp = a.expiresAt;
  if (exp != null) {
    final day = a.expiresDay;
    if (day != null) {
      if (day.isBefore(CalendarDate.fromDateTime(now))) return false;
    } else {
      final t = DateTime.tryParse(exp);
      if (t != null && !t.isAfter(now)) return false;
    }
  }
  return true;
}

int? sessionsLeft(CachedAssignment a) {
  final total = a.sessionsTotal, used = a.sessionsUsed;
  if (total == null || used == null) return null;
  return (total - used).clamp(0, total);
}

/// Contract indicator label.
String indicatorLabel(SyncState s, OfflineStrings t) {
  switch (s.indicator) {
    case SyncIndicator.online:
      return t.online;
    case SyncIndicator.offline:
      return t.offline;
    case SyncIndicator.syncing:
      return t.syncing;
    case SyncIndicator.pending:
      return t.pending(s.pendingCount);
    case SyncIndicator.failed:
      return t.syncFailed;
    case SyncIndicator.expired:
      return t.dataExpired;
    case SyncIndicator.authRequired:
      return t.loginRequired;
    case SyncIndicator.deviceRevoked:
    case SyncIndicator.deviceMismatch:
      return t.deviceBlocked;
  }
}

/// Per-item state label; never shows a local item as confirmed.
String itemStateLabel(OutboxEvent e, OfflineStrings t) {
  switch (OutboxStatus.fromWire(e.syncStatus)) {
    case OutboxStatus.synced:
      return t.stateSynced;
    case OutboxStatus.rejected:
      return t.stateRejected(e.resultMessage ?? e.resultCode ?? '—');
    case OutboxStatus.pending:
    case OutboxStatus.syncing:
      return t.stateSaved;
  }
}
