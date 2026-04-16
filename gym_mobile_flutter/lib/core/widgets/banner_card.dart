import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import '../../models/banner_model.dart';

class BannerCard extends StatelessWidget {
  final BannerModel banner;
  final bool useHero;

  const BannerCard({super.key, required this.banner, this.useHero = true});

  static const _fallbackStart = Color(0xFF1D1D1B);
  static const _fallbackEnd = Color(0xFF534AB7);

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: Stack(
        fit: StackFit.expand,
        children: [
          _buildBackground(),
          _buildDarkOverlay(),
          _buildContent(),
        ],
      ),
    );
  }

  Widget _buildBackground() {
    final hasImage = banner.imageUrl.isNotEmpty;
    if (hasImage) {
      final image = CachedNetworkImage(
        imageUrl: banner.imageUrl,
        fit: BoxFit.cover,
        fadeInDuration: const Duration(milliseconds: 300),
        placeholder: (context, url) => Shimmer.fromColors(
          baseColor: Colors.grey.shade300,
          highlightColor: Colors.grey.shade100,
          child: Container(color: Colors.white),
        ),
        errorWidget: (context, url, error) => _buildFallbackGradient(),
      );
      if (!useHero) return image;
      return Hero(tag: 'banner_${banner.id}', child: image);
    }
    return _buildFallbackGradient();
  }

  Widget _buildFallbackGradient() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_fallbackStart, _fallbackEnd],
        ),
      ),
    );
  }

  Widget _buildDarkOverlay() {
    return Positioned(
      left: 0,
      right: 0,
      bottom: 0,
      height: 110,
      child: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.bottomCenter,
            end: Alignment.topCenter,
            colors: [Color(0xCC000000), Colors.transparent],
          ),
        ),
      ),
    );
  }

  Widget _buildContent() {
    final hasTag = banner.tag != null && banner.tag!.isNotEmpty;
    final hasHeadline = banner.caption != null && banner.caption!.isNotEmpty;
    final hasSubtitle =
        banner.description != null && banner.description!.isNotEmpty;

    return Positioned(
      left: 14,
      right: 14,
      bottom: 12,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (hasTag) ...[
            _buildTagPill(),
            const SizedBox(height: 6),
          ],
          if (hasHeadline)
            Text(
              banner.caption!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 14,
                fontWeight: FontWeight.w700,
                height: 1.25,
              ),
            ),
          if (hasHeadline && hasSubtitle) const SizedBox(height: 2),
          if (hasSubtitle)
            Text(
              banner.description!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.75),
                fontSize: 11,
                fontWeight: FontWeight.w400,
                height: 1.3,
              ),
            ),
          if (banner.hasAction) ...[
            const SizedBox(height: 8),
            _buildCtaPill(),
          ],
        ],
      ),
    );
  }

  Color? _parseTagColor() {
    final hex = banner.tagColor;
    if (hex == null || hex.isEmpty) return null;
    try {
      final clean = hex.replaceFirst('#', '');
      return Color(int.parse('FF$clean', radix: 16));
    } catch (_) {
      return null;
    }
  }

  Widget _buildTagPill() {
    final tagBg = _parseTagColor();
    final useCustomColor = tagBg != null;

    // Determine text color: dark text on light backgrounds, white on dark
    Color textColor = Colors.white;
    if (useCustomColor) {
      final luminance = tagBg.computeLuminance();
      textColor = luminance > 0.5 ? const Color(0xFF1D1D1B) : Colors.white;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: useCustomColor
            ? tagBg
            : Colors.white.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(20),
        border: useCustomColor
            ? null
            : Border.all(
                color: Colors.white.withValues(alpha: 0.4),
                width: 0.5,
              ),
      ),
      child: Text(
        banner.tag!,
        style: TextStyle(
          color: textColor,
          fontSize: 10,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.3,
        ),
      ),
    );
  }

  Widget _buildCtaPill() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
      ),
      child: const Text(
        'Learn More',
        style: TextStyle(
          color: Color(0xFF1D1D1B),
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
