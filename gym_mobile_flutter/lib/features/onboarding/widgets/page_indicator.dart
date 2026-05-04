import 'package:flutter/material.dart';

const _kPrimary = Color(0xFFE07A3B);
const _kInkFaint = Color(0x2D1F1A14);

/// Animated dot pager — active dot stretches into a peach pill.
class PageIndicator extends StatelessWidget {
  final int count;
  final int current;
  final Color activeColor;
  final Color inactiveColor;

  const PageIndicator({
    super.key,
    required this.count,
    required this.current,
    this.activeColor = _kPrimary,
    this.inactiveColor = _kInkFaint,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(count, (i) => _Dot(
        isActive: i == current,
        activeColor: activeColor,
        inactiveColor: inactiveColor,
      )),
    );
  }
}

class _Dot extends StatelessWidget {
  final bool isActive;
  final Color activeColor;
  final Color inactiveColor;
  const _Dot({
    required this.isActive,
    required this.activeColor,
    required this.inactiveColor,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
      margin: const EdgeInsets.symmetric(horizontal: 3.5),
      width: isActive ? 22 : 7,
      height: 7,
      decoration: BoxDecoration(
        color: isActive ? activeColor : inactiveColor,
        borderRadius: BorderRadius.circular(999),
      ),
    );
  }
}
