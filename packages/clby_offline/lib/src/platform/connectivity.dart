import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';

/// Connectivity HINT (an interface exists ≠ the API is reachable; the sync
/// request outcome is the truth).
abstract class ConnectivityMonitor {
  Future<bool> isOnline();
  Stream<bool> get changes;
}

class ConnectivityPlusMonitor implements ConnectivityMonitor {
  ConnectivityPlusMonitor([Connectivity? c]) : _c = c ?? Connectivity();
  final Connectivity _c;

  static bool _any(List<ConnectivityResult> r) =>
      r.any((e) => e != ConnectivityResult.none);

  @override
  Future<bool> isOnline() async {
    try {
      return _any(await _c.checkConnectivity());
    } catch (_) {
      return true; // unknown → let the request decide
    }
  }

  @override
  Stream<bool> get changes => _c.onConnectivityChanged.map(_any).distinct();
}

/// Manually driven monitor (tests).
class ManualConnectivityMonitor implements ConnectivityMonitor {
  ManualConnectivityMonitor([this._online = true]);
  bool _online;
  final _ctrl = StreamController<bool>.broadcast();

  void set(bool online) {
    _online = online;
    _ctrl.add(online);
  }

  @override
  Future<bool> isOnline() async => _online;

  @override
  Stream<bool> get changes => _ctrl.stream;
}
