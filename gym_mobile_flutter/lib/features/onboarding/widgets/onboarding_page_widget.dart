import 'package:flutter/material.dart';
import '../data/onboarding_data.dart';

const _kInk     = Color(0xFF1F1A14);
const _kInk2    = Color(0x9E1F1A14);
const _kPeach   = Color(0xFFF4DCC1);
const _kPrimary = Color(0xFFE07A3B);
const _kSuccess = Color(0xFF3F8B5C);

/// Slide content with the bespoke illustration that matches the slide kind.
/// A `pageOffset` of 0 means the slide is fully on screen; ±1 means an
/// adjacent slide is visible during a swipe.
class OnboardingPageWidget extends StatelessWidget {
  final OnboardingItem item;
  final double pageOffset;

  const OnboardingPageWidget({
    super.key,
    required this.item,
    required this.pageOffset,
  });

  @override
  Widget build(BuildContext context) {
    final opacity = (1.0 - pageOffset.abs().clamp(0.0, 1.0));
    final slideX = pageOffset * 32.0;

    Widget illus;
    if (item.imageUrl != null && item.imageUrl!.isNotEmpty) {
      illus = _RemoteIllustration(url: item.imageUrl!);
    } else {
      switch (item.kind) {
        case OnboardingKind.attend: illus = const _IllusAttend(); break;
        case OnboardingKind.share:  illus = const _IllusShare();  break;
        case OnboardingKind.manage: illus = const _IllusManage(); break;
      }
    }

    return Transform.translate(
      offset: Offset(slideX, 0),
      child: Opacity(
        opacity: opacity.clamp(0.0, 1.0),
        child: Center(child: illus),
      ),
    );
  }
}

// ── Illustration 1: phone with QR + "Checked in" pill + time chip ──────────
class _IllusAttend extends StatelessWidget {
  const _IllusAttend();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 240, height: 220,
      child: Stack(
        children: [
          // Big peach blob, slightly rotated.
          Positioned(
            left: 30, top: 14,
            child: Transform.rotate(
              angle: -0.105,
              child: Container(
                width: 180, height: 180,
                decoration: BoxDecoration(
                  color: _kPeach,
                  borderRadius: BorderRadius.circular(48),
                ),
              ),
            ),
          ),
          // Phone card.
          Positioned(
            left: 60, top: 22,
            child: Container(
              width: 130, height: 180,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                boxShadow: const [
                  BoxShadow(color: Color(0x2D1F1A14), blurRadius: 40, offset: Offset(0, 18)),
                ],
              ),
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Container(
                    width: 36, height: 4,
                    decoration: BoxDecoration(
                      color: _kPeach,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    width: 88, height: 88,
                    decoration: BoxDecoration(
                      color: _kInk,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    padding: const EdgeInsets.all(8),
                    child: const _FauxQr(),
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'SCAN TO ENTER',
                    style: TextStyle(
                      fontSize: 9, fontWeight: FontWeight.w700,
                      color: _kInk, letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Iron Loft Downtown',
                    style: TextStyle(fontSize: 8, color: _kInk2),
                  ),
                ],
              ),
            ),
          ),
          // "Checked in" success pill.
          Positioned(
            right: 6, top: 30,
            child: Transform.rotate(
              angle: 0.105,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
                decoration: BoxDecoration(
                  color: _kSuccess,
                  borderRadius: BorderRadius.circular(999),
                  boxShadow: const [
                    BoxShadow(color: Color(0x523F8B5C), blurRadius: 18, offset: Offset(0, 6)),
                  ],
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.check_rounded, size: 11, color: Colors.white),
                    SizedBox(width: 4),
                    Text(
                      'Checked in',
                      style: TextStyle(
                        fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          // Time chip.
          Positioned(
            left: 4, bottom: 14,
            child: Transform.rotate(
              angle: -0.07,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: const [
                    BoxShadow(color: Color(0x1F1F1A14), blurRadius: 14, offset: Offset(0, 4)),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6, height: 6,
                      decoration: const BoxDecoration(
                        color: _kPrimary,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 5),
                    const Text(
                      '07:18 AM',
                      style: TextStyle(
                        fontSize: 11, fontWeight: FontWeight.w700,
                        color: _kInk, fontFeatures: [FontFeature.tabularFigures()],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// Synthetic QR pattern — visual only, not a real code.
class _FauxQr extends StatelessWidget {
  const _FauxQr();

  static const _filled = {
    0,1,2,3,4,5,6,7,11,13,14,21,22,24,28,29,30,33,34,35,38,40,42,44,45,46,
  };

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 7,
      mainAxisSpacing: 2,
      crossAxisSpacing: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: List.generate(49, (i) {
        return Container(
          decoration: BoxDecoration(
            color: _filled.contains(i) ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(1),
          ),
        );
      }),
    );
  }
}

// ── Illustration 2: two avatars + dashed arc + "3 SESSIONS" pill ───────────
class _IllusShare extends StatelessWidget {
  const _IllusShare();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 260, height: 220,
      child: Stack(
        children: [
          // Back avatar (peach).
          Positioned(
            left: 22, top: 60,
            child: Container(
              width: 80, height: 80,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: _kPeach,
                shape: BoxShape.circle,
                boxShadow: const [
                  BoxShadow(color: Color(0x1F1F1A14), blurRadius: 30, offset: Offset(0, 14)),
                ],
              ),
              child: const Text(
                'A',
                style: TextStyle(fontSize: 30, fontWeight: FontWeight.w600, color: _kInk),
              ),
            ),
          ),
          // Front avatar (ink).
          Positioned(
            right: 22, top: 60,
            child: Container(
              width: 80, height: 80,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: _kInk,
                shape: BoxShape.circle,
                boxShadow: const [
                  BoxShadow(color: Color(0x2D1F1A14), blurRadius: 30, offset: Offset(0, 14)),
                ],
              ),
              child: const Text(
                'S',
                style: TextStyle(fontSize: 30, fontWeight: FontWeight.w600, color: Colors.white),
              ),
            ),
          ),
          // Dashed arc connecting the two avatars.
          Positioned.fill(
            child: IgnorePointer(
              child: CustomPaint(painter: _DashedArcPainter()),
            ),
          ),
          // "3 SESSIONS" orange pill at the top.
          Positioned(
            left: 0, right: 0, top: 0,
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: _kPrimary,
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: const [
                    BoxShadow(color: Color(0x5CE07A3B), blurRadius: 28, offset: Offset(0, 12)),
                  ],
                ),
                child: const Column(
                  children: [
                    Text(
                      '3',
                      style: TextStyle(
                        fontSize: 22, fontWeight: FontWeight.w700,
                        color: Colors.white, height: 1,
                        fontFeatures: [FontFeature.tabularFigures()],
                      ),
                    ),
                    SizedBox(height: 1),
                    Text(
                      'SESSIONS',
                      style: TextStyle(
                        fontSize: 9, fontWeight: FontWeight.w700,
                        color: Color(0xEAFFFFFF), letterSpacing: 1,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          // Names.
          const Positioned(
            left: 22, top: 148, width: 80,
            child: Center(
              child: Text(
                'You',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: _kInk),
              ),
            ),
          ),
          const Positioned(
            right: 22, top: 148, width: 80,
            child: Center(
              child: Text(
                'Ahmed',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: _kInk),
              ),
            ),
          ),
          // "+3 received" tag.
          Positioned(
            right: 0, top: 168,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(999),
                boxShadow: const [
                  BoxShadow(color: Color(0x1A1F1A14), blurRadius: 12, offset: Offset(0, 4)),
                ],
              ),
              child: const Text(
                '+3 received',
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _kSuccess),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DashedArcPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = _kPrimary
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;
    // Quadratic curve from left avatar top (70,90) to right avatar top (200,90)
    // peaking at (130,20). Stroke as a dashed path.
    final path = Path()
      ..moveTo(70, 90)
      ..quadraticBezierTo(130, 20, 200, 90);
    final dashed = _dashPath(path, dashArray: const [2, 7]);
    canvas.drawPath(dashed, p);
  }

  Path _dashPath(Path src, {required List<double> dashArray}) {
    final out = Path();
    double drawn = 0;
    int i = 0;
    for (final metric in src.computeMetrics()) {
      double dist = 0;
      while (dist < metric.length) {
        final len = dashArray[i % dashArray.length];
        if (i.isEven) {
          out.addPath(metric.extractPath(dist, dist + len), Offset.zero);
        }
        dist += len;
        i++;
      }
      drawn += metric.length;
    }
    return out;
  }

  @override
  bool shouldRepaint(_DashedArcPainter old) => false;
}

// ── Illustration 3: dark membership card + renew chip + sessions chip ──────
class _IllusManage extends StatelessWidget {
  const _IllusManage();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 240, height: 220,
      child: Stack(
        children: [
          // Dark membership card.
          Positioned(
            left: 30, top: 30,
            child: Container(
              width: 180, height: 110,
              decoration: BoxDecoration(
                color: _kInk,
                borderRadius: BorderRadius.circular(18),
                boxShadow: const [
                  BoxShadow(color: Color(0x471F1A14), blurRadius: 36, offset: Offset(0, 18)),
                ],
              ),
              clipBehavior: Clip.antiAlias,
              child: Stack(
                children: [
                  Positioned(
                    right: -30, top: -30,
                    child: Container(
                      width: 100, height: 100,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(
                          colors: [_kPeach, Color(0x00F4DCC1)],
                          stops: [0, 0.65],
                        ),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'MEMBERSHIP',
                          style: TextStyle(
                            fontSize: 9, fontWeight: FontWeight.w700,
                            color: Color(0x99FFFFFF), letterSpacing: 1.2,
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Premium Monthly',
                          style: TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white,
                          ),
                        ),
                        const Spacer(),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            const Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'MEMBER #',
                                    style: TextStyle(
                                      fontSize: 8, fontWeight: FontWeight.w700,
                                      color: Color(0x80FFFFFF), letterSpacing: 0.6,
                                    ),
                                  ),
                                  SizedBox(height: 2),
                                  Text(
                                    '#A12345',
                                    style: TextStyle(
                                      fontSize: 13, fontWeight: FontWeight.w600,
                                      color: Colors.white,
                                      fontFeatures: [FontFeature.tabularFigures()],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                              decoration: BoxDecoration(
                                color: const Color(0x388CD2A0),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: const Text(
                                'ACTIVE',
                                style: TextStyle(
                                  fontSize: 9, fontWeight: FontWeight.w700, color: _kSuccess,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          // Renew chip (rotated -4°).
          Positioned(
            left: 14, bottom: 18,
            child: Transform.rotate(
              angle: -0.07,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: const [
                    BoxShadow(color: Color(0x1F1F1A14), blurRadius: 22, offset: Offset(0, 8)),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 26, height: 26,
                      decoration: BoxDecoration(
                        color: _kPeach,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      alignment: Alignment.center,
                      child: const Icon(Icons.calendar_today_outlined, size: 14, color: _kInk),
                    ),
                    const SizedBox(width: 8),
                    const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'RENEWS',
                          style: TextStyle(
                            fontSize: 9, fontWeight: FontWeight.w700,
                            color: _kInk2, letterSpacing: 0.6,
                          ),
                        ),
                        SizedBox(height: 1),
                        Text(
                          'May 28, 2026',
                          style: TextStyle(
                            fontSize: 12, fontWeight: FontWeight.w600, color: _kInk,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
          // Sessions chip (rotated +5°).
          Positioned(
            right: 4, bottom: 32,
            child: Transform.rotate(
              angle: 0.087,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: _kPrimary,
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: const [
                    BoxShadow(color: Color(0x52E07A3B), blurRadius: 22, offset: Offset(0, 10)),
                  ],
                ),
                child: const Column(
                  children: [
                    Text(
                      '12',
                      style: TextStyle(
                        fontSize: 18, fontWeight: FontWeight.w700,
                        color: Colors.white, height: 1,
                        fontFeatures: [FontFeature.tabularFigures()],
                      ),
                    ),
                    SizedBox(height: 1),
                    Text(
                      'LEFT',
                      style: TextStyle(
                        fontSize: 8, fontWeight: FontWeight.w700,
                        color: Color(0xE6FFFFFF), letterSpacing: 1,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// Remote slide fallback — peach-rounded image so it still feels on-brand.
class _RemoteIllustration extends StatelessWidget {
  final String url;
  const _RemoteIllustration({required this.url});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 240, height: 220,
      decoration: BoxDecoration(
        color: _kPeach,
        borderRadius: BorderRadius.circular(28),
      ),
      clipBehavior: Clip.antiAlias,
      child: Image.network(
        url,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => const _IllusAttend(),
      ),
    );
  }
}
