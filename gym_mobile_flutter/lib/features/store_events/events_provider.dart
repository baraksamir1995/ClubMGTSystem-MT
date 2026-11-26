import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../models/event_model.dart';
import '../../services/api_service.dart';
import '../../utils/logger.dart';

/// Shared events state for Home (`events` strip), Explore (`events` section)
/// and the event detail screen, so a registration made on the detail screen
/// is reflected everywhere without each screen re-fetching on its own.
class EventsProvider extends ChangeNotifier {
  final ApiService _api;
  EventsProvider([ApiService? api]) : _api = api ?? ApiService();

  List<GymEvent> _events = const [];
  bool _loading = false;
  bool _loaded = false;
  Future<void>? _inFlight;

  List<GymEvent> get events => _events;
  bool get isLoading => _loading;
  bool get isLoaded => _loaded;

  /// Next few events, soonest first (API already orders by starts_at).
  List<GymEvent> upcoming([int count = 3]) => _events.take(count).toList();

  GymEvent? byId(String id) {
    for (final e in _events) {
      if (e.id == id) return e;
    }
    return null;
  }

  /// Loads `/api/events`. Errors keep the last good list (sections stay
  /// hidden on a cold failure rather than showing an error card).
  Future<void> load({bool force = false}) {
    if (!force && _inFlight != null) return _inFlight!;
    final f = _doLoad();
    _inFlight = f;
    return f.whenComplete(() {
      if (identical(_inFlight, f)) _inFlight = null;
    });
  }

  Future<void> _doLoad() async {
    _loading = true;
    notifyListeners();
    try {
      _events = await _api.getEvents();
    } catch (e) {
      appLog('EventsProvider.load error: $e');
    } finally {
      _loading = false;
      _loaded = true;
      notifyListeners();
    }
  }

  /// After a Paymob checkout the webhook confirms the registration
  /// asynchronously. Re-fetch a few times while it's still `pending_payment`.
  Future<void> refreshUntilSettled(String eventId,
      {int attempts = 5, Duration gap = const Duration(seconds: 2)}) async {
    for (var i = 0; i < attempts; i++) {
      await load(force: true);
      final reg = byId(eventId)?.myRegistration;
      if (reg == null || !reg.isPendingPayment) return;
      await Future.delayed(gap);
    }
  }

  void clear() {
    _events = const [];
    _loaded = false;
    _loading = false;
    _inFlight = null;
    notifyListeners();
  }
}
