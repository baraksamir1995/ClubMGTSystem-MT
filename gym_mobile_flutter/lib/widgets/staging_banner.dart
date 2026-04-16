import 'package:flutter/material.dart';
import '../utils/env.dart';

/// Wraps [child] with a diagonal "STAGING" corner banner when running
/// the staging build. No-op in production.
class StagingBanner extends StatelessWidget {
  const StagingBanner({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (!Env.isStaging) return child;
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Banner(
        message: 'STAGING',
        location: BannerLocation.topEnd,
        color: Colors.deepOrange,
        child: child,
      ),
    );
  }
}
