import 'package:flutter/material.dart';
import '../core/constants/app_colors.dart';

/// Horizontal sessions-used progress bar. Port of `SessionsBar` in
/// coach-tokens.jsx — fixed `height` (default 6, taller variants for the
/// member detail card), 0.07-opacity white track, lime fill normally,
/// amber `warn` fill when `low` is true, 0.8 opacity on the fill to
/// match the design's slightly-translucent look.
class SessionsBar extends StatelessWidget {
  final int used;
  final int total;
  final bool low;
  final double height;

  const SessionsBar({
    super.key,
    required this.used,
    required this.total,
    this.low = false,
    this.height = 6,
  });

  @override
  Widget build(BuildContext context) {
    final pct = total == 0 ? 0.0 : (used / total).clamp(0.0, 1.0);
    final fill = low ? AppColors.warn : AppColors.lime;
    return ClipRRect(
      borderRadius: BorderRadius.circular(height / 2),
      child: Container(
        height: height,
        color: const Color(0x12FFFFFF), // rgba(255,255,255,0.07)
        child: Align(
          alignment: Alignment.centerLeft,
          child: FractionallySizedBox(
            widthFactor: pct,
            child: Container(color: fill.withValues(alpha: 0.8)),
          ),
        ),
      ),
    );
  }
}
