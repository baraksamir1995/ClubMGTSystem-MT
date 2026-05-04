import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../models/banner_model.dart';
import 'banner_card.dart';

class BannerCarousel extends StatefulWidget {
  final List<BannerModel> banners;
  final bool isLoading;

  const BannerCarousel({
    super.key,
    required this.banners,
    this.isLoading = false,
  });

  @override
  State<BannerCarousel> createState() => _BannerCarouselState();
}

class _BannerCarouselState extends State<BannerCarousel> {
  int _currentPage = 0;
  Timer? _autoScrollTimer;
  Timer? _resumeTimer;

  // Slightly taller than before so the bigger headline + CTA pill have
  // breathing room and the peach radial glow reads.
  static const double _carouselHeight = 178;

  // Design tokens (shared with auth/onboarding).
  static const _kInk     = Color(0xFF1F1A14);
  static const _kPrimary = Color(0xFFE07A3B);

  @override
  void initState() {
    super.initState();
    _startAutoScroll();
  }

  @override
  void didUpdateWidget(BannerCarousel old) {
    super.didUpdateWidget(old);
    if (old.banners != widget.banners) {
      _currentPage = 0;
      _stopAutoScroll();
      _resumeTimer?.cancel();
      if (widget.banners.length > 1) _startAutoScroll();
    }
  }

  @override
  void dispose() {
    _stopAutoScroll();
    _resumeTimer?.cancel();
    super.dispose();
  }

  void _startAutoScroll() {
    if (widget.banners.length < 2) return;
    _autoScrollTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (mounted) _advance(1);
    });
  }

  void _stopAutoScroll() {
    _autoScrollTimer?.cancel();
    _autoScrollTimer = null;
  }

  void _advance(int delta) {
    if (!mounted || widget.banners.isEmpty) return;
    setState(() {
      _currentPage =
          (_currentPage + delta + widget.banners.length) % widget.banners.length;
    });
  }

  void _onSwipeEnd(DragEndDetails details) {
    final velocity = details.primaryVelocity ?? 0;
    if (velocity < -300) {
      _stopAutoScroll();
      _resumeTimer?.cancel();
      _advance(1);
      _resumeTimer = Timer(const Duration(seconds: 5), () {
        if (mounted) _startAutoScroll();
      });
    } else if (velocity > 300) {
      _stopAutoScroll();
      _resumeTimer?.cancel();
      _advance(-1);
      _resumeTimer = Timer(const Duration(seconds: 5), () {
        if (mounted) _startAutoScroll();
      });
    }
  }

  Future<void> _onBannerTap(BannerModel banner) async {
    if (!banner.hasAction) return;
    if (banner.isExternalLink) {
      final uri = Uri.tryParse(banner.actionValue!);
      if (uri != null && await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } else if (banner.isInternal) {
      if (mounted) context.push('/banner-details', extra: banner);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.isLoading) return _buildShimmer();
    if (widget.banners.isEmpty) return const SizedBox.shrink();

    return Column(
      children: [
        SizedBox(height: _carouselHeight, child: _buildCarousel()),
        if (widget.banners.length > 1) ...[
          const SizedBox(height: 10),
          _buildDots(),
        ],
      ],
    );
  }

  Widget _buildCarousel() {
    if (widget.banners.length == 1) {
      return GestureDetector(
        onTap: () => _onBannerTap(widget.banners[0]),
        child: BannerCard(
          banner: widget.banners[0],
          useHero: false,
          paletteIndex: 0,
        ),
      );
    }

    return GestureDetector(
      onTap: () => _onBannerTap(widget.banners[_currentPage]),
      onHorizontalDragEnd: _onSwipeEnd,
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 380),
        switchInCurve: Curves.easeIn,
        switchOutCurve: Curves.easeOut,
        transitionBuilder: (child, animation) =>
            FadeTransition(opacity: animation, child: child),
        child: BannerCard(
          // Key forces AnimatedSwitcher to treat each banner as a new widget.
          key: ValueKey(_currentPage),
          banner: widget.banners[_currentPage],
          useHero: false,
          // Cycle through the three palette variants per slide so a stack of
          // image-free banners doesn't all look identical.
          paletteIndex: _currentPage,
        ),
      ),
    );
  }

  /// Dot indicator — active dot stretches into a peach pill, matching the
  /// onboarding indicator and the auth flow's StepDots.
  Widget _buildDots() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(widget.banners.length, (index) {
        final active = index == _currentPage;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeInOut,
          margin: const EdgeInsets.symmetric(horizontal: 3.5),
          width: active ? 22 : 7,
          height: 7,
          decoration: BoxDecoration(
            color: active ? _kPrimary : _kInk.withValues(alpha: 0.18),
            borderRadius: BorderRadius.circular(999),
          ),
        );
      }),
    );
  }

  Widget _buildShimmer() {
    return Shimmer.fromColors(
      baseColor: const Color(0xFFE9E5DD),
      highlightColor: const Color(0xFFF7F6F2),
      child: Container(
        height: _carouselHeight,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(22),
        ),
      ),
    );
  }
}
