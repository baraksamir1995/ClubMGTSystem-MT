import 'package:flutter/material.dart';
import '../core/constants/app_colors.dart';
import '../core/constants/app_text.dart';

/// Initial badge with a deterministic hashed colour. Port of `Avatar` in
/// coach-tokens.jsx — same LCG-style char-sum hash so a given name always
/// lands on the same palette slot.
class Avatar extends StatelessWidget {
  final String name;
  final double size;
  final Color? ring;

  const Avatar({super.key, required this.name, this.size = 44, this.ring});

  static Color colorFor(String name) {
    int h = 0;
    for (int i = 0; i < name.length; i++) {
      h = (h * 31 + name.codeUnitAt(i)) & 0xff;
    }
    final palette = AppColors.avatarPalette;
    return palette[h % palette.length];
  }

  String get _initials {
    final words = name.trim().split(RegExp(r'\s+'));
    final letters = words
        .where((w) => w.isNotEmpty)
        .map((w) => w[0])
        .take(2)
        .join();
    return letters.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: colorFor(name),
        shape: BoxShape.circle,
        border: ring != null ? Border.all(color: ring!, width: 2) : null,
      ),
      alignment: Alignment.center,
      child: Text(
        _initials,
        style: AppText.body(
          size: size * 0.36,
          weight: FontWeight.w600,
          color: AppColors.white,
          letterSpacing: -0.3,
        ),
      ),
    );
  }
}
