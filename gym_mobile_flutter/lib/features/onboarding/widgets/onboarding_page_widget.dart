import 'package:flutter/material.dart';
import '../data/onboarding_data.dart';

class OnboardingPageWidget extends StatelessWidget {
  final OnboardingItem item;
  final double pageOffset; // -1.0 to 1.0, 0 = current

  const OnboardingPageWidget({
    super.key,
    required this.item,
    required this.pageOffset,
  });

  @override
  Widget build(BuildContext context) {
    final opacity = (1.0 - pageOffset.abs().clamp(0.0, 1.0));
    final slideX = pageOffset * 40.0;

    return Transform.translate(
      offset: Offset(slideX, 0),
      child: Opacity(
        opacity: opacity.clamp(0.0, 1.0),
        child: _IllustrationBox(item: item),
      ),
    );
  }
}

class _IllustrationBox extends StatelessWidget {
  final OnboardingItem item;
  const _IllustrationBox({required this.item});

  @override
  Widget build(BuildContext context) {
    // If a remote image URL is provided, show it; otherwise show the icon
    if (item.imageUrl != null && item.imageUrl!.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(0),
        child: Image.network(
          item.imageUrl!,
          fit: BoxFit.cover,
          width: double.infinity,
          height: double.infinity,
          errorBuilder: (_, __, ___) => _IconFallback(item: item),
        ),
      );
    }

    return _IconFallback(item: item);
  }
}

class _IconFallback extends StatelessWidget {
  final OnboardingItem item;
  const _IconFallback({required this.item});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 140,
        height: 140,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(32),
          boxShadow: [
            BoxShadow(
              color: Colors.white.withValues(alpha: 0.08),
              blurRadius: 60,
              spreadRadius: 20,
            ),
          ],
        ),
        child: Center(
          child: Container(
            width: 90,
            height: 90,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(22),
            ),
            child: Icon(
              item.icon,
              color: Colors.white,
              size: 48,
            ),
          ),
        ),
      ),
    );
  }
}
