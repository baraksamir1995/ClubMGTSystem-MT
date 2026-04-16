import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';

// ============================================================================
// GRAYSCALE COLOR MATRIX
// Standard NTSC luminance weights for perceptual grayscale.
// ============================================================================
const List<double> _grayscaleMatrix = [
  0.2126, 0.7152, 0.0722, 0, 0, //
  0.2126, 0.7152, 0.0722, 0, 0, //
  0.2126, 0.7152, 0.0722, 0, 0, //
  0,      0,      0,      1, 0, //
];

// ============================================================================
// BrandSkeletonLogo
//
// Renders the gym logo as a faint, grayscale, blurred watermark.
// Automatically normalizes ANY logo (colored, white, multi-color).
//
// Design decisions:
//   - Grayscale: removes brand color distraction from loading state
//   - Low opacity (0.06): visible enough for brand presence, never dominates
//   - Blur (sigma 1.5): softens details so logo reads as a texture
//   - Dark mode: slightly higher opacity (0.09) for visibility on dark bg
// ============================================================================
class BrandSkeletonLogo extends StatelessWidget {
  final String? imageUrl;
  final double size;

  const BrandSkeletonLogo({
    super.key,
    this.imageUrl,
    this.size = 120,
  });

  @override
  Widget build(BuildContext context) {
    if (imageUrl == null || imageUrl!.isEmpty) {
      return const SizedBox.shrink();
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final opacity = isDark ? 0.15 : 0.10;

    return Opacity(
      opacity: opacity,
      child: ImageFiltered(
        imageFilter: ui.ImageFilter.blur(sigmaX: 1.5, sigmaY: 1.5),
        child: ColorFiltered(
          colorFilter: const ColorFilter.matrix(_grayscaleMatrix),
          child: ColorFiltered(
            // Makes black pixels transparent, keeps light pixels visible
            colorFilter: const ColorFilter.mode(Colors.white, BlendMode.modulate),
            child: Image.network(
              imageUrl!,
              width: size,
              height: size,
              fit: BoxFit.contain,
              color: Colors.white,
              colorBlendMode: BlendMode.screen,
              errorBuilder: (_, __, ___) => const SizedBox.shrink(),
              loadingBuilder: (_, child, progress) {
                if (progress == null) return child;
                return SizedBox(width: size, height: size);
              },
            ),
          ),
        ),
      ),
    );
  }
}

// ============================================================================
// BrandedSkeletonCard
//
// A reusable skeleton loading card with:
//   - Shimmer animation
//   - Gym logo watermark (auto-normalized)
//   - Configurable placeholder rows
//
// Usage:
//   BrandedSkeletonCard(height: 120)
//   BrandedSkeletonCard(height: 80, rows: 2)
//   BrandedSkeletonCard.fromContext(context, height: 120)
// ============================================================================
class BrandedSkeletonCard extends StatelessWidget {
  final double height;
  final double borderRadius;
  final int rows;
  final String? logoUrl;

  const BrandedSkeletonCard({
    super.key,
    this.height = 120,
    this.borderRadius = 16,
    this.rows = 3,
    this.logoUrl,
  });

  /// Convenience constructor that reads the gym logo from AuthProvider.
  static Widget fromContext(BuildContext context, {
    double height = 120,
    double borderRadius = 16,
    int rows = 3,
  }) {
    final gym = context.watch<AuthProvider>().gym;
    return BrandedSkeletonCard(
      height: height,
      borderRadius: borderRadius,
      rows: rows,
      logoUrl: gym?.logoUrl,
    );
  }

  @override
  Widget build(BuildContext context) {
    final baseColor = Theme.of(context).colorScheme.surfaceContainerHighest;
    final highlightColor = Theme.of(context).colorScheme.surface;

    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: SizedBox(
        height: height,
        width: double.infinity,
        child: Stack(
          children: [
            // Layer 1: Shimmer background + placeholder rows
            Shimmer.fromColors(
              baseColor: baseColor,
              highlightColor: highlightColor,
              child: Container(
                height: height,
                width: double.infinity,
                decoration: BoxDecoration(
                  color: baseColor,
                  borderRadius: BorderRadius.circular(borderRadius),
                ),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: _buildRows(),
                ),
              ),
            ),

          ],
        ),
      ),
    );
  }

  List<Widget> _buildRows() {
    final widths = [0.4, 0.7, 0.5, 0.3, 0.6];
    final heights = [14.0, 18.0, 12.0, 10.0, 12.0];

    return List.generate(rows.clamp(1, 5), (i) {
      return Padding(
        padding: EdgeInsets.only(bottom: i < rows - 1 ? 8.0 : 0),
        child: FractionallySizedBox(
          alignment: Alignment.centerLeft,
          widthFactor: widths[i % widths.length],
          child: Container(
            height: heights[i % heights.length],
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(4),
            ),
          ),
        ),
      );
    });
  }
}

// ============================================================================
// BrandedSkeletonList
//
// Renders a vertical list of BrandedSkeletonCard widgets.
// Commonly used as the loading state for list screens.
//
// Usage:
//   BrandedSkeletonList(logoUrl: gym?.logoUrl)
//   BrandedSkeletonList(itemCount: 6, itemHeight: 80)
// ============================================================================
class BrandedSkeletonList extends StatelessWidget {
  final int itemCount;
  final double itemHeight;
  final String? logoUrl;
  final double spacing;
  final EdgeInsetsGeometry padding;

  const BrandedSkeletonList({
    super.key,
    this.itemCount = 4,
    this.itemHeight = 100,
    this.logoUrl,
    this.spacing = 12,
    this.padding = EdgeInsets.zero,
  });

  /// Convenience constructor that reads the gym logo from AuthProvider.
  static Widget fromContext(BuildContext context, {
    int itemCount = 4,
    double itemHeight = 100,
    double spacing = 12,
    EdgeInsetsGeometry padding = EdgeInsets.zero,
  }) {
    final gym = context.watch<AuthProvider>().gym;
    return BrandedSkeletonList(
      itemCount: itemCount,
      itemHeight: itemHeight,
      logoUrl: gym?.logoUrl,
      spacing: spacing,
      padding: padding,
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      physics: const NeverScrollableScrollPhysics(),
      shrinkWrap: true,
      padding: padding,
      itemCount: itemCount,
      separatorBuilder: (_, __) => SizedBox(height: spacing),
      itemBuilder: (_, __) => BrandedSkeletonCard(
        height: itemHeight,
        logoUrl: logoUrl,
      ),
    );
  }
}

// ============================================================================
// BrandedSkeletonGrid
//
// A 2-column grid of skeleton cards for dashboard-style loading states.
//
// Usage:
//   BrandedSkeletonGrid(logoUrl: gym?.logoUrl)
// ============================================================================
class BrandedSkeletonGrid extends StatelessWidget {
  final int itemCount;
  final double itemHeight;
  final String? logoUrl;

  const BrandedSkeletonGrid({
    super.key,
    this.itemCount = 4,
    this.itemHeight = 100,
    this.logoUrl,
  });

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      physics: const NeverScrollableScrollPhysics(),
      shrinkWrap: true,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 1.5,
      ),
      itemCount: itemCount,
      itemBuilder: (_, __) => BrandedSkeletonCard(
        height: itemHeight,
        logoUrl: logoUrl,
        rows: 2,
      ),
    );
  }
}

// ============================================================================
// BrandedFullScreenSkeleton
//
// A full-screen branded skeleton with the logo watermark centered.
// Useful for detail screens or when the entire page is loading.
//
// Usage:
//   BrandedFullScreenSkeleton(logoUrl: gym?.logoUrl)
// ============================================================================
class BrandedFullScreenSkeleton extends StatelessWidget {
  final String? logoUrl;

  const BrandedFullScreenSkeleton({super.key, this.logoUrl});

  @override
  Widget build(BuildContext context) {
    final baseColor = Theme.of(context).colorScheme.surfaceContainerHighest;
    final highlightColor = Theme.of(context).colorScheme.surface;

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      body: Shimmer.fromColors(
        baseColor: baseColor,
        highlightColor: highlightColor,
        child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Top bar placeholder
                    Row(
                      children: [
                        Container(
                          width: 36, height: 36,
                          decoration: const BoxDecoration(
                            color: Colors.white, shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Container(
                            height: 20, color: Colors.white,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Container(
                          width: 36, height: 36,
                          decoration: const BoxDecoration(
                            color: Colors.white, shape: BoxShape.circle,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 32),
                    // Hero block
                    Container(
                      height: 180,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    const SizedBox(height: 20),
                    // Content rows
                    ...List.generate(4, (i) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Container(
                        height: 72,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    )),
                  ],
                ),
              ),
            ),
      ),
    );
  }
}
