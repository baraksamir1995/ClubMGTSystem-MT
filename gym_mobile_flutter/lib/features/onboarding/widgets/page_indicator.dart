import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';

class PageIndicator extends StatelessWidget {
  final int count;
  final int current;
  final Color activeColor;

  const PageIndicator({
    super.key,
    required this.count,
    required this.current,
    this.activeColor = AppColors.indicatorActive,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(count, (i) => _Dot(
        isActive: i == current,
        activeColor: activeColor,
      )),
    );
  }
}

class _Dot extends StatelessWidget {
  final bool isActive;
  final Color activeColor;
  const _Dot({required this.isActive, required this.activeColor});

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
      margin: const EdgeInsets.symmetric(horizontal: 4),
      width: isActive ? 24 : 8,
      height: 8,
      decoration: BoxDecoration(
        color: isActive ? activeColor : AppColors.indicatorInactive,
        borderRadius: BorderRadius.circular(100),
      ),
    );
  }
}
