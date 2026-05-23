import 'package:flutter/material.dart';
import '../core/constants/app_colors.dart';
import '../core/constants/app_text.dart';

enum CButtonVariant { primary, secondary, ghost, danger }

enum CButtonSize { sm, md, lg }

/// Generic button matching `CButton` in coach-tokens.jsx. Same variants
/// (primary lime / secondary surface2 / ghost transparent / danger soft),
/// same sizes (sm / md / lg), same press-scale animation.
class CButton extends StatefulWidget {
  final String label;
  final VoidCallback? onTap;
  final CButtonVariant variant;
  final CButtonSize size;
  final IconData? icon;
  final Widget? leading;
  final bool full;
  final bool disabled;
  final bool isLoading;

  const CButton({
    super.key,
    required this.label,
    required this.onTap,
    this.variant = CButtonVariant.primary,
    this.size = CButtonSize.md,
    this.icon,
    this.leading,
    this.full = false,
    this.disabled = false,
    this.isLoading = false,
  });

  @override
  State<CButton> createState() => _CButtonState();
}

class _CButtonState extends State<CButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final s = _sizeTokens(widget.size);
    final v = _variantTokens(widget.variant);
    final enabled = !widget.disabled && !widget.isLoading && widget.onTap != null;

    final child = widget.isLoading
        ? SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              valueColor: AlwaysStoppedAnimation(v.fg),
            ),
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (widget.leading != null) ...[
                widget.leading!,
                SizedBox(width: s.gap),
              ] else if (widget.icon != null) ...[
                Icon(widget.icon, size: s.fontSize + 4, color: v.fg),
                SizedBox(width: s.gap),
              ],
              Text(
                widget.label,
                style: AppText.body(
                  size: s.fontSize,
                  weight: FontWeight.w600,
                  color: v.fg,
                  letterSpacing: -0.2,
                ),
              ),
            ],
          );

    return GestureDetector(
      onTapDown: enabled ? (_) => setState(() => _pressed = true) : null,
      onTapUp: enabled ? (_) => setState(() => _pressed = false) : null,
      onTapCancel: enabled ? () => setState(() => _pressed = false) : null,
      onTap: enabled ? widget.onTap : null,
      child: AnimatedScale(
        scale: _pressed ? 0.98 : 1.0,
        duration: const Duration(milliseconds: 120),
        child: AnimatedOpacity(
          opacity: enabled ? 1.0 : 0.4,
          duration: const Duration(milliseconds: 150),
          child: Container(
            width: widget.full ? double.infinity : null,
            padding: EdgeInsets.symmetric(horizontal: s.padX, vertical: s.padY),
            decoration: BoxDecoration(
              color: v.bg,
              borderRadius: BorderRadius.circular(s.radius),
              border: Border.all(color: v.border, width: 1),
            ),
            alignment: Alignment.center,
            child: child,
          ),
        ),
      ),
    );
  }
}

class _SizeTokens {
  final double padX, padY, fontSize, gap, radius;
  const _SizeTokens(this.padX, this.padY, this.fontSize, this.gap, this.radius);
}

_SizeTokens _sizeTokens(CButtonSize size) {
  switch (size) {
    case CButtonSize.sm:
      return const _SizeTokens(14, 8, 13, 6, 10);
    case CButtonSize.md:
      return const _SizeTokens(18, 13, 14, 8, 12);
    case CButtonSize.lg:
      return const _SizeTokens(22, 16, 15, 10, 14);
  }
}

class _VariantTokens {
  final Color bg, fg, border;
  const _VariantTokens({required this.bg, required this.fg, required this.border});
}

_VariantTokens _variantTokens(CButtonVariant v) {
  switch (v) {
    case CButtonVariant.primary:
      return _VariantTokens(bg: AppColors.lime, fg: AppColors.limeText, border: Colors.transparent);
    case CButtonVariant.secondary:
      return _VariantTokens(bg: AppColors.surface2, fg: AppColors.text, border: AppColors.borderStrong);
    case CButtonVariant.ghost:
      return _VariantTokens(bg: Colors.transparent, fg: AppColors.text, border: AppColors.border);
    case CButtonVariant.danger:
      return _VariantTokens(bg: AppColors.dangerSoft, fg: AppColors.danger, border: AppColors.danger);
  }
}
