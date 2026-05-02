import 'package:flutter/material.dart';

/// Slide-to-confirm bar — drag the white knob across to fire [onConfirm].
/// Mirrors the design's `SlideToConfirm` component:
/// - Track starts dark ink, fills with the brand `primary` as you drag
/// - Label fades out as the knob advances
/// - Releasing past 92% snaps to confirmed and triggers the callback
/// - Releasing earlier springs back to start
class SlideToConfirm extends StatefulWidget {
  final String label;
  final VoidCallback onConfirm;
  final Color primary;
  final Color trackColor;
  final bool disabled;

  const SlideToConfirm({
    super.key,
    required this.label,
    required this.onConfirm,
    required this.primary,
    this.trackColor = const Color(0xFF1F1A14),
    this.disabled = false,
  });

  @override
  State<SlideToConfirm> createState() => _SlideToConfirmState();
}

class _SlideToConfirmState extends State<SlideToConfirm> {
  static const double _height = 64;
  static const double _knob = 56;
  static const double _knobInset = 4;
  double _x = 0;
  bool _confirming = false;
  double _trackWidth = 0;

  void _onDragUpdate(DragUpdateDetails d) {
    if (widget.disabled || _confirming) return;
    final max = (_trackWidth - _knob - 6).clamp(0, double.infinity).toDouble();
    setState(() => _x = (_x + d.delta.dx).clamp(0.0, max));
  }

  void _onDragEnd(DragEndDetails d) {
    if (widget.disabled || _confirming) return;
    final max = (_trackWidth - _knob - 6).clamp(0, double.infinity).toDouble();
    if (_x > max * 0.92) {
      setState(() {
        _x = max;
        _confirming = true;
      });
      Future.delayed(const Duration(milliseconds: 220), widget.onConfirm);
    } else {
      setState(() => _x = 0);
    }
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        _trackWidth = constraints.maxWidth;
        final max = (_trackWidth - _knob - 6).clamp(1, double.infinity).toDouble();
        final pct = (_x / max).clamp(0.0, 1.0);
        return Opacity(
          opacity: widget.disabled ? 0.45 : 1,
          child: SizedBox(
            height: _height,
            child: Stack(
              children: [
                // Track background
                AnimatedContainer(
                  duration: const Duration(milliseconds: 250),
                  decoration: BoxDecoration(
                    color: _confirming ? widget.primary : widget.trackColor,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
                // Primary fill, clipped to drag progress
                ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Container(
                      width: _trackWidth * pct,
                      decoration: BoxDecoration(color: widget.primary),
                    ),
                  ),
                ),
                // Label fades out as knob advances
                Center(
                  child: AnimatedOpacity(
                    duration: const Duration(milliseconds: 120),
                    opacity: (1 - pct * 1.4).clamp(0.0, 1.0),
                    child: Text(
                      widget.label,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.1,
                      ),
                    ),
                  ),
                ),
                // Draggable white knob with arrow
                AnimatedPositioned(
                  duration: Duration(milliseconds: _x == 0 || _x == max ? 250 : 0),
                  curve: Curves.easeOutCubic,
                  top: _knobInset,
                  left: _knobInset - 1 + _x,
                  child: GestureDetector(
                    onHorizontalDragUpdate: _onDragUpdate,
                    onHorizontalDragEnd: _onDragEnd,
                    child: Container(
                      width: _knob,
                      height: _knob,
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(color: Color(0x2E000000), blurRadius: 6, offset: Offset(0, 2)),
                        ],
                      ),
                      child: const Icon(Icons.arrow_forward,
                          size: 22, color: Color(0xFF1F1A14)),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
