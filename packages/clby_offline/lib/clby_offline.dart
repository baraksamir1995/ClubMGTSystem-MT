/// CLBY offline-first attendance core (Phase 1 foundation).
///
/// Entry points:
/// * [ClientInfo] — `X-*` headers + device id (init in `main()`).
/// * [OfflineSessionManager] — open/close the scoped store on login/logout,
///   engine triggers.
/// * [OfflineStore] — recorder, sync engine, bootstrap, outbox queries.
/// * [SyncTransport] / [JsonSyncTransport] — implemented by each app.
library;

export 'src/cache/bootstrap_service.dart';
export 'src/db/offline_database.dart';
export 'src/db/open.dart';
export 'src/errors.dart';
export 'src/identity/device_identity.dart';
export 'src/model/calendar_date.dart';
export 'src/model/clock_offset.dart';
export 'src/model/enums.dart';
export 'src/model/event_wire.dart';
export 'src/model/offline_policy.dart';
export 'src/model/policy_holder.dart';
export 'src/model/sync_models.dart';
export 'src/platform/client_info.dart';
export 'src/platform/connectivity.dart';
export 'src/recorder/offline_event_recorder.dart';
export 'src/recorder/timezone.dart';
export 'src/scope.dart';
export 'src/security/key_store.dart';
export 'src/store/offline_session_manager.dart';
export 'src/store/offline_store.dart';
export 'src/sync/backoff.dart';
export 'src/sync/sync_engine.dart';
export 'src/sync/sync_state.dart';
export 'src/sync/transport.dart';
