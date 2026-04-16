import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

/// Full-screen skeleton for the session detail screen.
/// Mirrors the exact layout of the revamped design.
class SessionDetailSkeleton extends StatelessWidget {
  const SessionDetailSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final base =
        Theme.of(context).colorScheme.surfaceContainerHighest;
    final highlight = Theme.of(context).colorScheme.surface;

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      body: Shimmer.fromColors(
        baseColor: base,
        highlightColor: highlight,
        child: Stack(
          children: [
            CustomScrollView(
              physics: const NeverScrollableScrollPhysics(),
              slivers: [
                // ── Hero area ──────────────────────────────────
                SliverToBoxAdapter(
                  child: _SkeletonHero(),
                ),

                // ── Body ───────────────────────────────────────
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 20, 16, 120),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // 2×2 info grid
                        _SkeletonInfoGrid(),
                        const SizedBox(height: 16),

                        // Coach card
                        _SkeletonCoachCard(),
                        const SizedBox(height: 16),

                        // Capacity card
                        _SkeletonCapacityCard(),
                        const SizedBox(height: 24),

                        // "ABOUT THIS CLASS" header
                        _box(height: 12, width: 130, radius: 6),
                        const SizedBox(height: 14),

                        // Description lines
                        _box(height: 10, radius: 6),
                        const SizedBox(height: 8),
                        _box(height: 10, radius: 6),
                        const SizedBox(height: 8),
                        _box(height: 10, width: 220, radius: 6),
                        const SizedBox(height: 24),

                        // "WHAT TO EXPECT" header
                        _box(height: 12, width: 140, radius: 6),
                        const SizedBox(height: 14),

                        // Expect chips
                        _SkeletonChipsRow(),
                        const SizedBox(height: 24),

                        // "OTHER CLASSES TODAY" header
                        _box(height: 12, width: 160, radius: 6),
                        const SizedBox(height: 14),

                        // Other classes horizontal strip
                        _SkeletonOtherClasses(),
                      ],
                    ),
                  ),
                ),
              ],
            ),

            // ── Sticky bottom bar ───────────────────────────────
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(
                color: Theme.of(context).colorScheme.surface,
                padding: EdgeInsets.fromLTRB(
                    16, 12, 16,
                    MediaQuery.of(context).padding.bottom + 12),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // "Uses 1 session..." row
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _box(height: 10, width: 160, radius: 5),
                        _box(height: 10, width: 90, radius: 5),
                      ],
                    ),
                    const SizedBox(height: 12),
                    // Book button
                    _box(height: 52, radius: 14),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _box(
      {required double height,
      double? width,
      required double radius,
      Color? color}) {
    return Container(
      height: height,
      width: width ?? double.infinity,
      decoration: BoxDecoration(
        color: color ?? Colors.white,
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }
}

// ── Hero ──────────────────────────────────────────────────────────────────────

class _SkeletonHero extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // Grey gradient background
        Container(
          height: 240,
          color: Colors.white,
        ),
        // Back + share circle buttons
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _circle(36),
                _circle(36),
              ],
            ),
          ),
        ),
        // Bottom content of hero
        Positioned(
          left: 16,
          right: 16,
          bottom: 20,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Class type badge
              Container(
                height: 22,
                width: 60,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(20),
                ),
              ),
              const SizedBox(height: 10),
              // Class name
              Container(
                height: 28,
                width: 180,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.6),
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              const SizedBox(height: 10),
              // Status + time row
              Row(
                children: [
                  Container(
                    height: 20,
                    width: 56,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.4),
                      borderRadius: BorderRadius.circular(20),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    height: 14,
                    width: 100,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.3),
                      borderRadius: BorderRadius.circular(6),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _circle(double size) => Container(
        width: size,
        height: size,
        decoration: const BoxDecoration(
          color: Colors.white,
          shape: BoxShape.circle,
        ),
      );
}

// ── 2×2 info grid ─────────────────────────────────────────────────────────────

class _SkeletonInfoGrid extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Column(
            children: [
              _SkeletonInfoCard(),
              const SizedBox(height: 10),
              _SkeletonInfoCard(),
            ],
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            children: [
              _SkeletonInfoCard(),
              const SizedBox(height: 10),
              _SkeletonInfoCard(),
            ],
          ),
        ),
      ],
    );
  }
}

class _SkeletonInfoCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      height: 76,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Icon box
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(8),
            ),
          ),
          const Spacer(),
          // Label
          Container(
            height: 8,
            width: 48,
            color: Colors.white,
          ),
          const SizedBox(height: 4),
          // Value
          Container(
            height: 10,
            width: 70,
            color: Colors.white,
          ),
        ],
      ),
    );
  }
}

// ── Coach card ────────────────────────────────────────────────────────────────

class _SkeletonCoachCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          // Avatar circle
          Container(
            width: 44,
            height: 44,
            decoration: const BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(height: 13, width: 100, color: Colors.white),
                const SizedBox(height: 6),
                Container(height: 10, width: 150, color: Colors.white),
                const SizedBox(height: 8),
                // Stats row
                Row(
                  children: [
                    Container(height: 9, width: 60, color: Colors.white),
                    const SizedBox(width: 12),
                    Container(height: 9, width: 70, color: Colors.white),
                    const SizedBox(width: 12),
                    Container(height: 9, width: 60, color: Colors.white),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            width: 16,
            height: 16,
            color: Colors.white,
          ),
        ],
      ),
    );
  }
}

// ── Capacity card ─────────────────────────────────────────────────────────────

class _SkeletonCapacityCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(height: 13, width: 130, color: Colors.white),
              Container(height: 13, width: 50, color: Colors.white),
            ],
          ),
          const SizedBox(height: 12),
          // Progress bar
          Container(
            height: 8,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(4),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(height: 9, width: 70, color: Colors.white),
              Container(height: 9, width: 90, color: Colors.white),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Chips row ─────────────────────────────────────────────────────────────────

class _SkeletonChipsRow extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final widths = [90.0, 110.0, 80.0, 95.0, 100.0];
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: widths
          .map(
            (w) => Container(
              height: 28,
              width: w,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
              ),
            ),
          )
          .toList(),
    );
  }
}

// ── Other classes strip ───────────────────────────────────────────────────────

class _SkeletonOtherClasses extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 96,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: 3,
        separatorBuilder: (context, index) => const SizedBox(width: 10),
        itemBuilder: (context, index) => Container(
          width: 100,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
          ),
          padding: const EdgeInsets.all(10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              Container(height: 11, width: 70, color: Colors.white),
              const SizedBox(height: 5),
              Container(height: 9, width: 50, color: Colors.white),
            ],
          ),
        ),
      ),
    );
  }
}
