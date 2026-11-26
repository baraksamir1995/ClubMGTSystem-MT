import 'dart:math';

/// Exponential backoff with "equal jitter":
///   raw   = min(max, base · 2^(attempt−1))
///   delay = raw/2 + U[0,1) · raw/2
/// so the delay is always in [raw/2, raw) — never ~0 (unlike full jitter)
/// while still de-synchronising devices that came online together.
class Backoff {
  Backoff({required this.base, required this.max, double Function()? random})
      : _random = random ?? Random().nextDouble;

  final Duration base;
  final Duration max;
  final double Function() _random;

  /// Upper bound (before jitter) for the [attempt]-th consecutive failure
  /// (1-based).
  Duration rawDelay(int attempt) {
    final a = attempt < 1 ? 1 : attempt;
    // Avoid overflow: once 2^(a-1) exceeds max/base we're capped anyway.
    final factor = a > 30 ? 1 << 30 : 1 << (a - 1);
    final ms = base.inMilliseconds * factor;
    return ms >= max.inMilliseconds ? max : Duration(milliseconds: ms);
  }

  Duration delay(int attempt) {
    final raw = rawDelay(attempt).inMilliseconds;
    final half = raw / 2;
    final j = _random().clamp(0.0, 0.999999);
    return Duration(milliseconds: (half + j * half).round());
  }
}
