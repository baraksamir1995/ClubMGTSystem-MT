import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

/// A drop-in replacement for [RefreshIndicator] that shows a contextual
/// screen-specific icon instead of the default spinner.
///
/// Interaction:
///   Pull  → icon scales + fades in following drag progress; turns to full
///            color once the trigger threshold is crossed.
///   Release (armed) → icon spins while [onRefresh] runs.
///   Done  → icon fades out.
///
/// Works cross-platform:
///   iOS / BouncingScrollPhysics  → [ScrollUpdateNotification] when
///     pixels < minScrollExtent (content bounces past the top boundary).
///   Android / ClampingScrollPhysics → [OverscrollNotification] at top.
///   Both → [ScrollEndNotification] to trigger or cancel on release.
class ScreenRefreshIndicator extends StatefulWidget {
  final Widget child;
  final Future<void> Function() onRefresh;
  final IconData icon;

  /// When provided, replaces the [icon] inside the indicator circle.
  /// Useful for showing a gym logo mark instead of a generic icon.
  final Widget? indicatorWidget;

  /// Tint colour for the icon. Defaults to [ColorScheme.primary].
  final Color? color;

  const ScreenRefreshIndicator({
    super.key,
    required this.child,
    required this.onRefresh,
    required this.icon,
    this.indicatorWidget,
    this.color,
  });

  @override
  State<ScreenRefreshIndicator> createState() =>
      _ScreenRefreshIndicatorState();
}

class _ScreenRefreshIndicatorState extends State<ScreenRefreshIndicator>
    with SingleTickerProviderStateMixin {
  // ── animation ─────────────────────────────────────────────────────────────
  late final AnimationController _spin;

  // ── drag state ────────────────────────────────────────────────────────────
  double _drag = 0.0;
  bool _armed = false;
  bool _refreshing = false;

  static const double _kTriggerDist = 72.0;
  static const double _kMaxDrag = 110.0;
  static const double _kIndicatorTop = 10.0;

  // ── lifecycle ─────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    _spin = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
  }

  @override
  void dispose() {
    _spin.dispose();
    super.dispose();
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  /// Calls setState immediately during user-gesture phases; defers to the
  /// next frame during layout/paint to avoid "build scheduled during frame"
  /// when a ScrollEndNotification fires inside performLayout.
  void _safeSetState(VoidCallback fn) {
    if (SchedulerBinding.instance.schedulerPhase ==
        SchedulerPhase.persistentCallbacks) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(fn);
      });
    } else {
      setState(fn);
    }
  }

  // ── scroll notification handling ──────────────────────────────────────────

  bool _onScrollNotification(ScrollNotification n) {
    if (_refreshing) return false;
    if (n.depth != 0) return false;
    if (n.metrics.axisDirection != AxisDirection.down) return false;

    if (n is OverscrollNotification && n.overscroll < 0) {
      // Android / ClampingScrollPhysics: pixels stay at 0, overscroll is delta.
      _safeSetState(() {
        _drag = (_drag - n.overscroll).clamp(0.0, _kMaxDrag);
        _armed = _drag >= _kTriggerDist;
      });
    } else if (n is ScrollUpdateNotification) {
      // iOS / BouncingScrollPhysics: pixels actually go below minScrollExtent.
      final pixels = n.metrics.pixels;
      final minExtent = n.metrics.minScrollExtent;
      if (pixels < minExtent) {
        final pullDist = (minExtent - pixels).clamp(0.0, _kMaxDrag);
        _safeSetState(() {
          _drag = pullDist;
          _armed = _drag >= _kTriggerDist;
        });
      } else if (pixels >= minExtent && _drag > 0) {
        _safeSetState(() {
          _drag = 0.0;
          _armed = false;
        });
      }
    } else if (n is ScrollEndNotification && _drag > 0) {
      if (_armed) {
        if (SchedulerBinding.instance.schedulerPhase ==
            SchedulerPhase.persistentCallbacks) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) _triggerRefresh();
          });
        } else {
          _triggerRefresh();
        }
      } else {
        _safeSetState(() {
          _drag = 0.0;
          _armed = false;
        });
      }
    }
    return false;
  }

  // ── refresh trigger ───────────────────────────────────────────────────────

  Future<void> _triggerRefresh() async {
    setState(() {
      _refreshing = true;
      _armed = false;
    });
    _spin.repeat();
    try {
      await widget.onRefresh();
    } finally {
      if (mounted) {
        _spin.stop();
        _spin.reset();
        setState(() {
          _refreshing = false;
          _drag = 0.0;
        });
      }
    }
  }

  // ── build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final primary =
        widget.color ?? Theme.of(context).colorScheme.primary;
    final surface = Theme.of(context).colorScheme.surface;

    final progress = (_drag / _kTriggerDist).clamp(0.0, 1.0);
    final showIndicator = _refreshing || _drag > 0;

    // Icon colour: muted while below threshold, full primary once armed.
    final iconColor = _armed || _refreshing
        ? primary
        : primary.withValues(alpha: 0.55);

    // Opacity + scale follow drag progress; full when refreshing.
    final opacity = _refreshing ? 1.0 : progress;
    final scale = _refreshing ? 1.0 : (0.5 + 0.5 * progress);

    // Indicator slides in from above as the user pulls:
    //   _drag=0   → top=-22 (fully hidden behind the AppBar edge)
    //   _drag=44  → top=0   (just entering the viewport)
    //   _drag=72+ → top=10  (settled at its resting position)
    // While refreshing: stays pinned at top=10.
    final indicatorTop = _refreshing
        ? _kIndicatorTop
        : (_drag * 0.5 - 22.0).clamp(-44.0, _kIndicatorTop);

    return Stack(
      clipBehavior: Clip.hardEdge,
      children: [
        NotificationListener<ScrollNotification>(
          onNotification: _onScrollNotification,
          child: widget.child,
        ),
        if (showIndicator)
          Positioned(
            top: indicatorTop,
            left: 0,
            right: 0,
            height: 44,
            child: Center(
              child: AnimatedOpacity(
                duration: const Duration(milliseconds: 80),
                opacity: opacity.clamp(0.0, 1.0),
                child: Transform.scale(
                  scale: scale.clamp(0.5, 1.0),
                  child: Material(
                    elevation: 4,
                    shape: const CircleBorder(),
                    color: surface,
                    child: SizedBox(
                      width: 44,
                      height: 44,
                      child: Center(
                        child: AnimatedBuilder(
                          animation: _spin,
                          builder: (context, _) {
                            // Computed inside builder so it refreshes every tick.
                            final angle = _refreshing
                                ? _spin.value * 2 * pi
                                : progress * 2 * pi;
                            return Transform.rotate(
                              angle: angle,
                              child: widget.indicatorWidget ??
                                  Icon(
                                    widget.icon,
                                    color: iconColor,
                                    size: 22,
                                  ),
                            );
                          },
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
