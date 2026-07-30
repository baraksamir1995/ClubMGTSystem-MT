import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/constants/app_colors.dart';
import '../core/constants/app_text.dart';
import '../providers/branding_provider.dart';
import '../utils/env.dart';
import 'gym_logo_tile.dart';

/// Gym-branded header for pre-login surfaces: the gym's logo + name from
/// the dashboard settings (via [BrandingProvider]'s cache/sync), with the
/// mono "COACH PORTAL" sub-label. Until a gym's branding has been cached
/// (first-ever launch, pre-login) it falls back to the flavor's brand name
/// from [Env] — never a hardcoded brand, which would show the wrong name on
/// a white-label build's first launch.
class GymBrandHeader extends StatelessWidget {
  /// Wordmark/name display size.
  final double size;
  final String? subLabel;
  final CrossAxisAlignment alignment;

  const GymBrandHeader({
    super.key,
    this.size = 40,
    this.subLabel = 'COACH PORTAL',
    this.alignment = CrossAxisAlignment.start,
  });

  @override
  Widget build(BuildContext context) {
    final branding = context.select<BrandingProvider, GymBranding?>(
      (b) => b.branding,
    );
    final name = (branding != null && branding.name.trim().isNotEmpty)
        ? branding.name
        : Env.brandName;
    final logoSize = size + 16;
    return Column(
      crossAxisAlignment: alignment,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (branding?.logoUrl != null) ...[
          GymLogoTile(size: logoSize, branding: branding),
          const SizedBox(height: 14),
        ],
        Text(
          name,
          style: AppText.disp(
            size: size,
            letterSpacing: 1.5,
            color: AppColors.text,
            height: 1.05,
          ),
        ),
        if (subLabel != null && subLabel!.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(
            subLabel!,
            style: AppText.mono(
              size: 11,
              letterSpacing: 2.5,
              color: AppColors.primary,
            ),
          ),
        ],
      ],
    );
  }
}

/// Labeled text field for the auth screens. The label sits above as a
/// small uppercase mono caption; the input is a dark pill with a lime
/// focus border.
class AuthField extends StatefulWidget {
  final String label;
  final TextEditingController controller;
  final String? placeholder;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final bool isPassword;
  final bool obscureText;
  final VoidCallback? onToggleObscure;
  final ValueChanged<String>? onSubmitted;
  final String? errorText;
  final TextCapitalization textCapitalization;

  const AuthField({
    super.key,
    required this.label,
    required this.controller,
    this.placeholder,
    this.keyboardType,
    this.textInputAction,
    this.isPassword = false,
    this.obscureText = false,
    this.onToggleObscure,
    this.onSubmitted,
    this.errorText,
    this.textCapitalization = TextCapitalization.none,
  });

  @override
  State<AuthField> createState() => _AuthFieldState();
}

class _AuthFieldState extends State<AuthField> {
  final _focus = FocusNode();
  bool _focused = false;

  @override
  void initState() {
    super.initState();
    _focus.addListener(() {
      if (mounted) setState(() => _focused = _focus.hasFocus);
    });
  }

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hasError = (widget.errorText?.isNotEmpty ?? false);
    final borderColor = hasError
        ? AppColors.danger
        : _focused
            ? AppColors.lime
            : AppColors.border;
    final fill = _focused ? AppColors.surface2 : AppColors.surface;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          widget.label.toUpperCase(),
          style: AppText.mono(
            size: 10,
            letterSpacing: 1.5,
            color: AppColors.textSec,
          ),
        ),
        const SizedBox(height: 8),
        AnimatedContainer(
          duration: const Duration(milliseconds: 140),
          height: 50,
          decoration: BoxDecoration(
            color: fill,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: borderColor, width: 1),
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  focusNode: _focus,
                  controller: widget.controller,
                  keyboardType: widget.keyboardType,
                  textInputAction: widget.textInputAction,
                  obscureText: widget.isPassword && widget.obscureText,
                  onSubmitted: widget.onSubmitted,
                  textCapitalization: widget.textCapitalization,
                  cursorColor: AppColors.lime,
                  style: AppText.body(
                    size: 15,
                    color: AppColors.text,
                    letterSpacing: -0.2,
                  ),
                  decoration: InputDecoration(
                    isCollapsed: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16),
                    border: InputBorder.none,
                    hintText: widget.placeholder,
                    hintStyle: AppText.body(
                      size: 15,
                      color: AppColors.textTer,
                      letterSpacing: -0.2,
                    ),
                  ),
                ),
              ),
              if (widget.isPassword)
                IconButton(
                  icon: Icon(
                    widget.obscureText
                        ? Icons.visibility_off_outlined
                        : Icons.visibility_outlined,
                    size: 18,
                    color: AppColors.textSec,
                  ),
                  onPressed: widget.onToggleObscure,
                ),
            ],
          ),
        ),
        if (hasError) ...[
          const SizedBox(height: 6),
          Text(
            widget.errorText!,
            style: AppText.body(size: 12, color: AppColors.danger),
          ),
        ],
      ],
    );
  }
}

/// Primary lime CTA button used on auth screens. Shows a small spinner
/// (the design's `cspin` keyframe) while loading.
class AuthButton extends StatelessWidget {
  final String label;
  final bool isLoading;
  final bool enabled;
  final VoidCallback onTap;

  const AuthButton({
    super.key,
    required this.label,
    required this.onTap,
    this.isLoading = false,
    this.enabled = true,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 54,
      child: FilledButton(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.lime,
          disabledBackgroundColor: AppColors.lime.withValues(alpha: 0.35),
          foregroundColor: AppColors.limeText,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
        onPressed: (enabled && !isLoading) ? onTap : null,
        child: isLoading
            ? Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation(
                        AppColors.limeText.withValues(alpha: 0.85),
                      ),
                      backgroundColor: AppColors.limeText.withValues(alpha: 0.18),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Signing in…',
                    style: AppText.body(
                      size: 15,
                      weight: FontWeight.w600,
                      color: AppColors.limeText,
                      letterSpacing: -0.2,
                    ),
                  ),
                ],
              )
            : Text(
                label,
                style: AppText.body(
                  size: 15,
                  weight: FontWeight.w600,
                  color: AppColors.limeText,
                  letterSpacing: -0.2,
                ),
              ),
      ),
    );
  }
}

/// Inline error banner used below the form fields. Mirrors the design's
/// danger-soft pill with the alert glyph.
class AuthErrorBanner extends StatelessWidget {
  final String message;
  const AuthErrorBanner({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      decoration: BoxDecoration(
        color: AppColors.dangerSoft,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.danger),
      ),
      child: Row(
        children: [
          Icon(Icons.error_outline_rounded, size: 16, color: AppColors.danger),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: AppText.body(
                size: 13,
                color: AppColors.danger,
                letterSpacing: -0.1,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
