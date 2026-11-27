import 'dart:async';

/// M2 (Phase 3 verification): while the member app is in offline mode,
/// keep retrying the normal profile load with backoff, so a cold-start
/// 5xx / timeout with the network still up doesn't leave the app dimmed
/// forever. [retry] returns true when the app is back online (profile
/// loaded) — the scheduler then stops.
class OfflineRetryScheduler {
  OfflineRetryScheduler({
    required this.retry,
    this.base = const Duration(seconds: 10),
    this.max = const Duration(minutes: 5),
  });

  final Future<bool> Function() retry;
  final Duration base;
  final Duration max;

  Timer? _timer;
  bool _running = false;
  bool _inFlight = false;
  int _attempt = 0;

  bool get running => _running;
  int get attempts => _attempt;

  /// Delay before retry number [attempt] (0-based): base · 2^attempt, capped.
  Duration delayFor(int attempt) {
    final ms = base.inMilliseconds * (1 << (attempt > 20 ? 20 : attempt));
    return ms >= max.inMilliseconds ? max : Duration(milliseconds: ms);
  }

  void start() {
    if (_running) return;
    _running = true;
    _attempt = 0;
    _schedule();
  }

  void stop() {
    _running = false;
    _timer?.cancel();
    _timer = null;
  }

  /// Retry immediately (chip "Retry now", app resume, pull-to-refresh,
  /// connectivity regained). Returns true when back online.
  Future<bool> retryNow() async {
    if (_inFlight) return false;
    _timer?.cancel();
    _inFlight = true;
    bool ok;
    try {
      ok = await retry();
    } catch (_) {
      ok = false;
    } finally {
      _inFlight = false;
    }
    if (ok) {
      stop();
    } else if (_running) {
      _attempt++;
      _schedule();
    }
    return ok;
  }

  void _schedule() {
    _timer?.cancel();
    if (!_running) return;
    _timer = Timer(delayFor(_attempt), () => retryNow());
  }

  void dispose() => stop();
}
