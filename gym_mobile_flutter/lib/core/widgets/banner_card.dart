import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import '../../models/banner_model.dart';

/// Hero banner card matching the warm cream + peach + orange design system
/// shared with auth, onboarding, and the rest of the app.
///
/// Two visual flavours:
///   • Image-backed — server-uploaded image with a soft ink gradient at the
///     bottom and a peach-tinted CTA, so it still reads against any photo.
///   • No image — falls through to one of three palettes (ink / peach /
///     primary) chosen by `paletteIndex`, with peach radial glow on the
///     dark variant. Mirrors the home design's hero carousel cards.
class BannerCard extends StatelessWidget {
  final BannerModel banner;
  final bool useHero;
  final int paletteIndex;

  const BannerCard({
    super.key,
    required this.banner,
    this.useHero = true,
    this.paletteIndex = 0,
  });

  // Design tokens — same set used across auth + onboarding + welcome.
  static const _kInk     = Color(0xFF1F1A14);
  static const _kPeach   = Color(0xFFF4DCC1);
  static const _kPrimary = Color(0xFFE07A3B);

  @override
  Widget build(BuildContext context) {
    final hasImage = banner.imageUrl.isNotEmpty;
    return ClipRRect(
      borderRadius: BorderRadius.circular(22),
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (hasImage) _buildImage() else _buildSolidBackground(),
          if (hasImage) _buildBottomOverlay() else _buildPeachGlow(),
          _buildContent(hasImage),
        ],
      ),
    );
  }

  // ── Backgrounds ────────────────────────────────────────────────────────────
  Widget _buildImage() {
    final image = CachedNetworkImage(
      imageUrl: banner.imageUrl,
      fit: BoxFit.cover,
      fadeInDuration: const Duration(milliseconds: 300),
      placeholder: (context, url) => Shimmer.fromColors(
        baseColor: const Color(0xFFE9E5DD),
        highlightColor: const Color(0xFFF7F6F2),
        child: Container(color: Colors.white),
      ),
      errorWidget: (context, url, error) => _buildSolidBackground(),
    );
    if (!useHero) return image;
    return Hero(tag: 'banner_${banner.id}', child: image);
  }

  Widget _buildSolidBackground() {
    final p = _palette;
    return DecoratedBox(decoration: BoxDecoration(color: p.bg));
  }

  /// Peach radial accent in the top-right corner of dark/orange cards —
  /// matches the membership card and the splash glow.
  Widget _buildPeachGlow() {
    final p = _palette;
    if (!p.glow) return const SizedBox.shrink();
    return Positioned(
      top: -50, right: -50,
      child: IgnorePointer(
        child: Container(
          width: 200, height: 200,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(
              colors: [_kPeach.withValues(alpha: 0.28), _kPeach.withValues(alpha: 0)],
              stops: const [0, 0.65],
            ),
          ),
        ),
      ),
    );
  }

  /// Soft ink gradient at the bottom 60% of image-backed banners so the
  /// title + CTA stay readable without going Vegas-dark.
  Widget _buildBottomOverlay() {
    return Positioned(
      left: 0, right: 0, bottom: 0,
      height: 130,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.bottomCenter,
            end: Alignment.topCenter,
            colors: [_kInk.withValues(alpha: 0.74), Colors.transparent],
          ),
        ),
      ),
    );
  }

  // ── Foreground content ─────────────────────────────────────────────────────
  Widget _buildContent(bool hasImage) {
    final p = _palette;
    final fg = hasImage ? Colors.white : p.fg;
    final subFg = hasImage ? Colors.white.withValues(alpha: 0.78) : p.sub;

    final hasTag = banner.tag != null && banner.tag!.isNotEmpty;
    final hasHeadline = banner.caption != null && banner.caption!.isNotEmpty;
    final hasSubtitle =
        banner.description != null && banner.description!.isNotEmpty;

    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (hasTag) _buildTagPill(hasImage),
          const Spacer(),
          if (hasHeadline)
            Text(
              banner.caption!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: fg,
                fontSize: 18,
                fontWeight: FontWeight.w700,
                height: 1.2,
                letterSpacing: -0.3,
              ),
            ),
          if (hasSubtitle) ...[
            const SizedBox(height: 4),
            Text(
              banner.description!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: subFg,
                fontSize: 12,
                fontWeight: FontWeight.w500,
                height: 1.3,
              ),
            ),
          ],
          if (banner.hasAction) ...[
            const SizedBox(height: 12),
            _buildCtaPill(hasImage),
          ],
        ],
      ),
    );
  }

  Widget _buildTagPill(bool hasImage) {
    final p = _palette;
    final customColor = _parseTagColor();
    final useCustom = customColor != null;
    final bg = useCustom
        ? customColor
        : hasImage
            ? Colors.white.withValues(alpha: 0.18)
            : p.tagBg;
    final fg = useCustom
        ? (customColor.computeLuminance() > 0.5 ? _kInk : Colors.white)
        : (hasImage ? Colors.white : p.tagFg);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        banner.tag!.toUpperCase(),
        style: TextStyle(
          color: fg,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.2,
        ),
      ),
    );
  }

  Widget _buildCtaPill(bool hasImage) {
    final p = _palette;
    // CTA contrasts the card: white pill on dark/peach, ink pill on white,
    // ink pill on orange to stand out without competing.
    final pillBg = hasImage ? Colors.white : p.ctaBg;
    final pillFg = hasImage ? _kInk : p.ctaFg;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: pillBg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'Learn more',
            style: TextStyle(
              color: pillFg,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.1,
            ),
          ),
          const SizedBox(width: 6),
          Icon(Icons.arrow_forward_rounded, size: 14, color: pillFg),
        ],
      ),
    );
  }

  // ── Palette resolution ────────────────────────────────────────────────────
  _Palette get _palette => _palettes[paletteIndex % _palettes.length];

  static const List<_Palette> _palettes = [
    // Dark ink card with peach radial glow — the "hero" variant.
    _Palette(
      bg: _kInk,
      fg: Colors.white,
      sub: Color(0xCCFFFFFF),
      tagBg: Color(0x33E07A3B),
      tagFg: _kPrimary,
      ctaBg: Colors.white,
      ctaFg: _kInk,
      glow: true,
    ),
    // Warm peach card.
    _Palette(
      bg: _kPeach,
      fg: _kInk,
      sub: Color(0x9E1F1A14),
      tagBg: Color(0x141F1A14),
      tagFg: _kInk,
      ctaBg: _kInk,
      ctaFg: Colors.white,
      glow: false,
    ),
    // Bold orange card — used for promotional / referral-style banners.
    _Palette(
      bg: _kPrimary,
      fg: Colors.white,
      sub: Color(0xCCFFFFFF),
      tagBg: Color(0x331F1A14),
      tagFg: Colors.white,
      ctaBg: _kInk,
      ctaFg: Colors.white,
      glow: false,
    ),
  ];

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
}

class _Palette {
  final Color bg;
  final Color fg;
  final Color sub;
  final Color tagBg;
  final Color tagFg;
  final Color ctaBg;
  final Color ctaFg;
  final bool glow;
  const _Palette({
    required this.bg,
    required this.fg,
    required this.sub,
    required this.tagBg,
    required this.tagFg,
    required this.ctaBg,
    required this.ctaFg,
    required this.glow,
  });
}
