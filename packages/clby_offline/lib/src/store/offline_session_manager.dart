import 'dart:async';
import 'dart:io';

import 'package:flutter/widgets.dart';

import '../errors.dart';
import '../scope.dart';
import '../security/key_store.dart';
import '../platform/client_info.dart';
import '../platform/connectivity.dart';
import '../sync/transport.dart';
import 'last_scope.dart';
import 'offline_store.dart';

/// App-level glue: opens the scoped store after login, closes it on
/// logout (cache wiped, outbox kept — D9), and forwards app-start /
/// resume / connectivity-regained to the engine. Apps hold one instance.
///
/// All calls are serialised, so a fast login → logout → login can't open
/// two stores. Every failure is reported through [onError] and leaves the
/// app running without offline support (never throws into auth flows).
class OfflineSessionManager {
  OfflineSessionManager({
    required this.app,
    required this.apiBase,
    required this.transport,
    ConnectivityMonitor? connectivity,
    this.keyStore = const SecureKeyStore(),
    this.directory,
    this.onError,
    this.refreshOnActivate = true,
    this.bootstrapWhenDisabled = false,
  }) : _connectivity = connectivity ?? ConnectivityPlusMonitor();

  final OfflineApp app;
  final String apiBase;
  /// The app's transport (its signed-in user must match the scope's user
  /// for anything to be sent).
  final SyncTransport transport;
  final KeyStore keyStore;
  final Directory? directory;
  final void Function(Object error, StackTrace stack)? onError;
  /// Call `refreshIfStale()` (status + bootstrap when enabled) on activate.
  final bool refreshOnActivate;
  /// Bootstrap on activate even when the server policy is disabled.
  final bool bootstrapWhenDisabled;
  final ConnectivityMonitor _connectivity;

  OfflineStore? _store;
  Future<void> _lock = Future.value();
  StreamSubscription<bool>? _connSub;
  AppLifecycleListener? _lifecycle;
  final _changes = StreamController<OfflineStore?>.broadcast();

  /// The open store, or null (signed out / unavailable).
  OfflineStore? get store => _store;
  Stream<OfflineStore?> get storeChanges => _changes.stream;

  Future<T> _serial<T>(Future<T> Function() op) {
    final prev = _lock;
    final c = Completer<void>();
    _lock = c.future;
    return prev.then((_) => op()).whenComplete(c.complete);
  }

  /// Opens (or keeps) the store for (apiBase, gymId, userId). Calling it
  /// again for the open scope (re-login, profile refresh) resumes a paused
  /// engine via `resumeAfterAuth()`. Switching
  /// scope closes the previous one first (its cache wiped, outbox kept).
  ///
  /// [rememberScope] (online logins) records this scope as the last one, so
  /// a later offline cold start may reopen it ([LastOfflineScope]). Offline
  /// re-entry passes false.
  Future<OfflineStore?> activate({
    required String userId,
    required String gymId,
    bool rememberScope = true,
  }) =>
      _serial(() async {
        if (userId.isEmpty || gymId.isEmpty) return _store;
        final scope = OfflineScope(apiBase: apiBase, gymId: gymId, userId: userId);
        final current = _store;
        if (current != null && current.scope == scope) {
          // Same user signed in again / session restored with a valid
          // token: lift any auth/device pause (LOW-5).
          if (current.engine.state.pause != null) {
            unawaited(_guard(current.engine.resumeAfterAuth));
          }
          return current;
        }
        await _closeCurrent(wipeCache: true);
        try {
          final info = ClientInfo.instance;
          if (info == null) {
            throw StateError('ClientInfo.init() must run before activate()');
          }
          final deviceId = await info.ensureDeviceId();
          final s = await OfflineStore.open(
            scope: scope,
            app: app,
            transport: transport,
            deviceId: deviceId,
            appVersion: info.appVersion,
            directory: directory,
            keyStore: keyStore,
          );
          _store = s;
          _changes.add(s);
          if (rememberScope) {
            await _guard(() => LastOfflineScope(
                    apiBase: apiBase, gymId: gymId, userId: userId)
                .write(keyStore));
          }
          _connSub = _connectivity.changes.listen((online) {
            unawaited(_guard(() => s.engine.onConnectivityChanged(online)));
          });
          final online = await _connectivity.isOnline();
          await s.engine.onConnectivityChanged(online);
          unawaited(_guard(() async {
            await s.engine.onAppStart();
            if (refreshOnActivate && online) {
              await s.refreshIfStale(evenIfDisabled: bootstrapWhenDisabled);
            }
          }));
          return s;
        } on OfflineStoreUnavailable catch (e, st) {
          onError?.call(e, st);
          return null;
        } catch (e, st) {
          onError?.call(e, st);
          return null;
        }
      });

  /// Logout / session revoked: close the store, wiping cached operational
  /// data but keeping pending/rejected events for this user (D9).
  Future<void> deactivate() => _serial(() => _closeCurrent(wipeCache: true));

  /// Forward app-resume to the engine. Called automatically when
  /// [attachLifecycle] was used.
  void onAppResumed() {
    final s = _store;
    if (s != null) unawaited(_guard(s.engine.onAppResumed));
  }

  /// Registers an [AppLifecycleListener] that forwards `resumed`.
  void attachLifecycle() {
    _lifecycle ??= AppLifecycleListener(onResume: onAppResumed);
  }

  Future<void> dispose() async {
    _lifecycle?.dispose();
    _lifecycle = null;
    await _serial(() => _closeCurrent(wipeCache: false));
    await _changes.close();
  }

  Future<void> _closeCurrent({required bool wipeCache}) async {
    await _connSub?.cancel();
    _connSub = null;
    final s = _store;
    _store = null;
    if (s == null) return;
    if (!_changes.isClosed) _changes.add(null);
    try {
      await s.close(wipeCache: wipeCache);
    } catch (e, st) {
      onError?.call(e, st);
    }
  }

  Future<void> _guard(Future<void> Function() op) async {
    try {
      await op();
    } catch (e, st) {
      onError?.call(e, st);
    }
  }
}
