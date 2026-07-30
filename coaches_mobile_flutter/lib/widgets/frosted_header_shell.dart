import 'dart:ui';
import 'package:flutter/material.dart';
import '../core/constants/app_colors.dart';

/// The shared frosted header chrome: 60px status-bar inset, `bg/0.85` fill,
/// 16px backdrop blur, hairline bottom border. One definition so
/// [ClbyAppBar] and [CoachGreetingHeader] can't drift apart when the blur,
/// inset or scrim is retuned.
class FrostedHeaderShell extends StatelessWidget {
  final Widget child;

  const FrostedHeaderShell({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: Container(
          padding: const EdgeInsets.fromLTRB(18, 60, 18, 14),
          decoration: BoxDecoration(
            color: AppColors.bg.withValues(alpha: 0.85),
            border: const Border(
              bottom: BorderSide(color: AppColors.border, width: 0.5),
            ),
          ),
          child: child,
        ),
      ),
    );
  }
}
