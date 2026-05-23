import 'package:flutter/material.dart';
import '../core/constants/app_colors.dart';

/// Pseudo-random QR-looking pattern. Port of the `QRCode` SVG generator in
/// coach-tokens.jsx — same 25×25 grid, same seeded LCG so a given seed
/// produces a stable, deterministic pattern. Three finder squares in the
/// top-left / top-right / bottom-left corners, and a CLBY centre punch.
///
/// NOTE: This is purely visual — not scannable. The spec notes flag that
/// a real implementation needs a signed + expiring payload.
class QrPattern extends StatelessWidget {
  final double size;
  final String seed;

  const QrPattern({super.key, required this.seed, this.size = 220});

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size(size, size),
      painter: _QrPainter(seed: seed),
    );
  }
}

class _QrPainter extends CustomPainter {
  static const int _n = 25;
  final String seed;
  _QrPainter({required this.seed});

  @override
  void paint(Canvas canvas, Size size) {
    final cell = size.width / _n;
    final inkPaint = Paint()..color = const Color(0xFF0A0A0B);
    final whitePaint = Paint()..color = Colors.white;
    final limePaint = Paint()..color = AppColors.lime;

    // white background
    canvas.drawRect(Offset.zero & size, whitePaint);

    // Seeded LCG mirroring the JS: s = (s * 1103515245 + 12345) & 0x7fffffff;
    // rand = s / 0x7fffffff
    int s = 0;
    for (int i = 0; i < seed.length; i++) {
      s = (s * 31 + seed.codeUnitAt(i)) & 0xffffffff;
    }
    double next() {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    }

    bool isFinder(int r, int c) {
      bool inBox(int x, int y, int sz) =>
          r >= x && r < x + sz && c >= y && c < y + sz;
      return inBox(0, 0, 7) ||
          inBox(0, _n - 7, 7) ||
          inBox(_n - 7, 0, 7);
    }

    // Random cells (skip finder regions, drawn separately below).
    for (int r = 0; r < _n; r++) {
      for (int c = 0; c < _n; c++) {
        final v = next() > 0.5;
        if (isFinder(r, c)) continue;
        if (!v) continue;
        canvas.drawRect(
          Rect.fromLTWH(c * cell, r * cell, cell, cell),
          inkPaint,
        );
      }
    }

    // Three finder patterns.
    final finders = <List<int>>[
      [0, 0],
      [0, _n - 7],
      [_n - 7, 0],
    ];
    for (final fp in finders) {
      final fr = fp[0], fc = fp[1];
      canvas.drawRect(
        Rect.fromLTWH(fc * cell, fr * cell, 7 * cell, 7 * cell),
        inkPaint,
      );
      canvas.drawRect(
        Rect.fromLTWH((fc + 1) * cell, (fr + 1) * cell, 5 * cell, 5 * cell),
        whitePaint,
      );
      canvas.drawRect(
        Rect.fromLTWH((fc + 2) * cell, (fr + 2) * cell, 3 * cell, 3 * cell),
        inkPaint,
      );
    }

    // Centre logo punch — a small lime "CLBY" stamp on dark ground.
    final cx = size.width / 2;
    final cy = size.height / 2;
    final outerRect = RRect.fromRectAndRadius(
      Rect.fromCenter(center: Offset(cx, cy), width: 36, height: 36),
      const Radius.circular(8),
    );
    canvas.drawRRect(outerRect, whitePaint);
    final innerRect = RRect.fromRectAndRadius(
      Rect.fromCenter(center: Offset(cx, cy), width: 28, height: 28),
      const Radius.circular(6),
    );
    canvas.drawRRect(innerRect, inkPaint);

    final tp = TextPainter(
      text: TextSpan(
        text: 'CLBY',
        style: TextStyle(
          color: AppColors.lime,
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 1,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, Offset(cx - tp.width / 2, cy - tp.height / 2));

    // Avoid unused-paint warning if a future refactor drops the lime use.
    // ignore: unused_local_variable
    final _ = limePaint;
  }

  @override
  bool shouldRepaint(covariant _QrPainter old) => old.seed != seed;
}
