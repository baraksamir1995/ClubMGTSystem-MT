import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../models/banner_model.dart';
import '../banner_analytics.dart';

/// Detail screen for a banner with `actionType == 'sponsor'`.
///
/// Three CTA modes, mutually exclusive:
///   1. Has promo code → primary "Get promo code" button. Tap reveals the
///      code in a dashed-border card AND auto-copies to clipboard. Bottom
///      button swaps to outlined "Visit website" (only if external URL set).
///   2. No code, has external URL → just outlined "Visit website".
///   3. Neither → no CTA at all (description + terms only).
class SponsorBannerDetailScreen extends StatefulWidget {
  final BannerModel banner;
  const SponsorBannerDetailScreen({super.key, required this.banner});

  @override
  State<SponsorBannerDetailScreen> createState() =>
      _SponsorBannerDetailScreenState();
}

class _SponsorBannerDetailScreenState extends State<SponsorBannerDetailScreen> {
  bool _revealed = false;
  bool _copied = false;
  Timer? _copyResetTimer;

  @override
  void dispose() {
    _copyResetTimer?.cancel();
    super.dispose();
  }

  void _flashCopiedState() {
    setState(() => _copied = true);
    _copyResetTimer?.cancel();
    _copyResetTimer = Timer(const Duration(seconds: 2), () {
      if (mounted) setState(() => _copied = false);
    });
  }

  // App tokens — kept in sync with the rest of the app's warm-cream palette.
  static const _kBg      = Color(0xFFF7F6F2);
  static const _kInk     = Color(0xFF1F1A14);
  static const _kInk2    = Color(0x9E1F1A14);
  static const _kInk3    = Color(0x6B1F1A14);
  static const _kHair    = Color(0x141F1A14);
  static const _kPeach   = Color(0xFFF4DCC1);
  static const _kPrimary = Color(0xFFE07A3B);

  BannerModel get banner => widget.banner;
  bool get _hasCode => (banner.sponsorPromoCode ?? '').isNotEmpty;
  bool get _hasUrl  => (banner.sponsorExternalUrl ?? '').isNotEmpty;

  Future<void> _revealAndCopy() async {
    setState(() => _revealed = true);
    if (_hasCode) {
      await Clipboard.setData(ClipboardData(text: banner.sponsorPromoCode!));
      if (mounted) _flashCopiedState();
    }
    BannerAnalytics.logSponsorCodeRevealed(banner);
  }

  Future<void> _copyAgain() async {
    if (!_hasCode) return;
    await Clipboard.setData(ClipboardData(text: banner.sponsorPromoCode!));
    if (mounted) _flashCopiedState();
  }

  Future<void> _visitWebsite() async {
    if (!_hasUrl) return;
    BannerAnalytics.logSponsorUrlVisited(banner);
    var raw = banner.sponsorExternalUrl!.trim();
    if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
      raw = 'https://$raw';
    }
    final uri = Uri.tryParse(raw);
    if (uri != null && await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final caption     = banner.caption?.trim() ?? '';
    final description = banner.description?.trim() ?? '';
    final terms       = banner.sponsorTerms?.trim() ?? '';

    return Scaffold(
      backgroundColor: _kBg,
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _Hero(imageUrl: banner.imageUrl, onClose: () => Navigator.of(context).maybePop()),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(22, 18, 22, 24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('OFFER',
                          style: TextStyle(
                            fontSize: 11, fontWeight: FontWeight.w700,
                            color: _kInk2, letterSpacing: 0.6,
                          ),
                        ),
                        if (caption.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text(caption,
                            style: const TextStyle(
                              fontSize: 24, fontWeight: FontWeight.w700,
                              color: _kInk, letterSpacing: -0.5, height: 1.15,
                            ),
                          ),
                        ],
                        if (description.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          Text(description,
                            style: const TextStyle(
                              fontSize: 14, color: _kInk2, height: 1.55,
                            ),
                          ),
                        ],
                        if (_hasCode) ...[
                          const SizedBox(height: 18),
                          AnimatedSize(
                            duration: const Duration(milliseconds: 220),
                            curve: Curves.easeOut,
                            child: _revealed
                                ? _CodeCard(
                                    code: banner.sponsorPromoCode!,
                                    onCopy: _copyAgain,
                                    copied: _copied,
                                  )
                                : const SizedBox.shrink(),
                          ),
                        ],
                        if (terms.isNotEmpty) ...[
                          const SizedBox(height: 14),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                            child: Text(terms,
                              style: const TextStyle(fontSize: 11, color: _kInk3, height: 1.55),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (_hasCode && !_revealed)
            _StickyCTA(
              child: _PrimaryButton(
                label: 'Get promo code',
                icon: Icons.lock_open_rounded,
                onTap: _revealAndCopy,
              ),
            )
          else if (_hasUrl)
            _StickyCTA(
              child: _OutlineButton(
                label: 'Visit ${_hostFromUrl(banner.sponsorExternalUrl)}',
                onTap: _visitWebsite,
              ),
            ),
          // No CTA when there's no code AND no url — body text is the whole page.
        ],
      ),
    );
  }

  static String _hostFromUrl(String? raw) {
    if (raw == null || raw.isEmpty) return 'website';
    var s = raw.trim();
    s = s.replaceFirst(RegExp(r'^https?://'), '');
    s = s.split('/').first;
    return s;
  }
}

class _Hero extends StatelessWidget {
  final String imageUrl;
  final VoidCallback onClose;
  const _Hero({required this.imageUrl, required this.onClose});

  // Matches the recommended banner upload aspect (1170×534 = 2.19∶1) so the
  // image displays at its native ratio — no crop, no stretch. Same shape
  // the carousel card uses.
  static const double _bannerAspectRatio = 1170 / 534;

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.of(context).padding.top;
    return Stack(
      children: [
        Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Status-bar spacer in peach so the image area visually starts
            // flush against the safe-area edge.
            Container(height: topInset, color: _SponsorBannerDetailScreenState._kPeach),
            ClipRRect(
              borderRadius: const BorderRadius.only(
                bottomLeft: Radius.circular(24),
                bottomRight: Radius.circular(24),
              ),
              child: AspectRatio(
                aspectRatio: _bannerAspectRatio,
                child: Container(
                  color: _SponsorBannerDetailScreenState._kPeach,
                  child: CachedNetworkImage(
                    imageUrl: imageUrl,
                    fit: BoxFit.cover,
                    placeholder: (_, _) => Container(color: _SponsorBannerDetailScreenState._kPeach),
                    errorWidget: (_, _, _) => Container(color: _SponsorBannerDetailScreenState._kPeach),
                  ),
                ),
              ),
            ),
          ],
        ),
        Positioned(
          top: topInset + 8,
          left: 12,
          child: Material(
            color: Colors.white.withValues(alpha: 0.92),
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: onClose,
              child: Container(
                width: 38, height: 38,
                alignment: Alignment.center,
                child: const Icon(Icons.arrow_back, size: 18, color: _SponsorBannerDetailScreenState._kInk),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _CodeCard extends StatelessWidget {
  final String code;
  final VoidCallback onCopy;
  final bool copied;
  const _CodeCard({required this.code, required this.onCopy, required this.copied});

  @override
  Widget build(BuildContext context) {
    // Button morphs to "Copied" with success green + check for ~2s after tap.
    final btnBg = copied
        ? const Color(0xFF3F8B5C) // success
        : _SponsorBannerDetailScreenState._kInk;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 12, 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: _SponsorBannerDetailScreenState._kPrimary,
          width: 1.6,
          style: BorderStyle.solid,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('YOUR PROMO CODE',
                  style: TextStyle(
                    fontSize: 11, fontWeight: FontWeight.w700,
                    color: _SponsorBannerDetailScreenState._kInk2, letterSpacing: 0.6,
                  ),
                ),
                const SizedBox(height: 6),
                Text(code,
                  style: const TextStyle(
                    fontSize: 22, fontWeight: FontWeight.w700,
                    color: _SponsorBannerDetailScreenState._kInk,
                    letterSpacing: 1.4,
                    fontFamily: 'Menlo',
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          AnimatedContainer(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOut,
            decoration: BoxDecoration(
              color: btnBg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(10),
                onTap: copied ? null : onCopy,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 180),
                    transitionBuilder: (child, anim) =>
                        FadeTransition(opacity: anim, child: child),
                    child: Row(
                      key: ValueKey(copied),
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(copied ? Icons.check_rounded : Icons.copy_rounded,
                          size: 14, color: Colors.white),
                        const SizedBox(width: 6),
                        Text(copied ? 'Copied' : 'Copy',
                          style: const TextStyle(
                            fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StickyCTA extends StatelessWidget {
  final Widget child;
  const _StickyCTA({required this.child});

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;
    return Container(
      padding: EdgeInsets.fromLTRB(22, 12, 22, 12 + bottomInset),
      decoration: const BoxDecoration(
        color: _SponsorBannerDetailScreenState._kBg,
        border: Border(top: BorderSide(color: _SponsorBannerDetailScreenState._kHair, width: 1)),
      ),
      child: child,
    );
  }
}

class _PrimaryButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  const _PrimaryButton({required this.label, required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: _SponsorBannerDetailScreenState._kPrimary,
      borderRadius: BorderRadius.circular(16),
      elevation: 0,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: SizedBox(
          height: 56,
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, color: Colors.white, size: 18),
            const SizedBox(width: 8),
            Text(label,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.white, letterSpacing: -0.1),
            ),
          ]),
        ),
      ),
    );
  }
}

class _OutlineButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _OutlineButton({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          height: 52,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: _SponsorBannerDetailScreenState._kInk, width: 1.6),
          ),
          alignment: Alignment.center,
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Text(label,
              style: const TextStyle(
                fontSize: 15, fontWeight: FontWeight.w600,
                color: _SponsorBannerDetailScreenState._kInk,
              ),
            ),
            const SizedBox(width: 8),
            const Icon(Icons.north_east_rounded, size: 16, color: _SponsorBannerDetailScreenState._kInk),
          ]),
        ),
      ),
    );
  }
}
