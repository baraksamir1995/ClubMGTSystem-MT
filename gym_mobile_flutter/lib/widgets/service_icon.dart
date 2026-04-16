import 'package:flutter/material.dart';

/// Renders one of three service icons (pt / physio / nutrition) using Canvas.
class ServiceIcon extends StatelessWidget {
  final String iconType;
  final Color color;
  final double size;

  const ServiceIcon({
    super.key,
    required this.iconType,
    required this.color,
    this.size = 24,
  });

  @override
  Widget build(BuildContext context) {
    CustomPainter painter;
    switch (iconType) {
      case 'physio':
        painter = _PhysioPainter(color);
        break;
      case 'nutrition':
        painter = _NutritionPainter(color);
        break;
      default:
        painter = _BarbellPainter(color);
    }
    return CustomPaint(
      painter: painter,
      size: Size(size, size),
    );
  }
}

// ── Barbell (PT) ─────────────────────────────────────────────────────────────

class _BarbellPainter extends CustomPainter {
  final Color color;
  _BarbellPainter(this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    final stroke = Paint()
      ..color = color
      ..strokeWidth = w * 0.063 // ~1.5 / 24
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;

    // Centre bar
    canvas.drawLine(Offset(w * 0.25, h * 0.5), Offset(w * 0.75, h * 0.5), stroke);

    // Inner weight plates (left & right)
    final inner = RRect.fromLTRBR(0, 0, w * 0.1, h * 0.5, const Radius.circular(2));
    canvas.save();
    canvas.translate(w * 0.16, h * 0.25);
    canvas.drawRRect(inner, stroke);
    canvas.restore();

    canvas.save();
    canvas.translate(w * 0.74, h * 0.25);
    canvas.drawRRect(inner, stroke);
    canvas.restore();

    // Outer weight plates (left & right)
    final outer = RRect.fromLTRBR(0, 0, w * 0.1, h * 0.66, const Radius.circular(2));
    canvas.save();
    canvas.translate(w * 0.04, h * 0.17);
    canvas.drawRRect(outer, stroke);
    canvas.restore();

    canvas.save();
    canvas.translate(w * 0.86, h * 0.17);
    canvas.drawRRect(outer, stroke);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_BarbellPainter old) => old.color != color;
}

// ── Human figure (Physio) ────────────────────────────────────────────────────

class _PhysioPainter extends CustomPainter {
  final Color color;
  _PhysioPainter(this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    final paint = Paint()
      ..color = color
      ..strokeWidth = w * 0.063
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;

    // Head
    canvas.drawCircle(Offset(w * 0.5, h * 0.14), w * 0.11, paint);

    // Body — open-bottom U
    final body = Path()
      ..moveTo(w * 0.22, h * 0.28)
      ..lineTo(w * 0.22, h * 0.72)
      ..quadraticBezierTo(w * 0.22, h * 0.88, w * 0.38, h * 0.88)
      ..lineTo(w * 0.62, h * 0.88)
      ..quadraticBezierTo(w * 0.78, h * 0.88, w * 0.78, h * 0.72)
      ..lineTo(w * 0.78, h * 0.28);
    canvas.drawPath(body, paint);

    // Mid-body horizontal line (arms / torso mid)
    canvas.drawLine(Offset(w * 0.22, h * 0.52), Offset(w * 0.78, h * 0.52), paint);
  }

  @override
  bool shouldRepaint(_PhysioPainter old) => old.color != color;
}

// ── Leaf (Nutrition) ─────────────────────────────────────────────────────────

class _NutritionPainter extends CustomPainter {
  final Color color;
  _NutritionPainter(this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    final paint = Paint()
      ..color = color
      ..strokeWidth = w * 0.063
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;

    // Leaf outline
    final leaf = Path()
      ..moveTo(w * 0.5, h * 0.84)
      ..cubicTo(w * 0.08, h * 0.68, w * 0.06, h * 0.18, w * 0.5, h * 0.06)
      ..cubicTo(w * 0.94, h * 0.18, w * 0.92, h * 0.68, w * 0.5, h * 0.84);
    canvas.drawPath(leaf, paint);

    // Vertical centre vein
    canvas.drawLine(Offset(w * 0.5, h * 0.08), Offset(w * 0.5, h * 0.84), paint);

    // Stem
    canvas.drawLine(Offset(w * 0.5, h * 0.84), Offset(w * 0.5, h * 0.96), paint);

    // Base ellipse
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(w * 0.5, h * 0.95),
        width: w * 0.36,
        height: h * 0.09,
      ),
      paint,
    );
  }

  @override
  bool shouldRepaint(_NutritionPainter old) => old.color != color;
}
