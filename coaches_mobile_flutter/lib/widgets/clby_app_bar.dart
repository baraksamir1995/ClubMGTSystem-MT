import 'package:flutter/material.dart';
import '../core/constants/app_colors.dart';
import '../core/constants/app_text.dart';
import 'frosted_header_shell.dart';

/// Sticky frosted app bar. Port of `AppBar` in coach-tokens.jsx:
/// 60px top padding (the dynamic-island/status-bar overlay), `bg/0.85`
/// fill + 16px backdrop blur, hairline bottom border, Bebas Neue title
/// uppercase, optional back chip and trailing slot.
class ClbyAppBar extends StatelessWidget {
  final String title;
  final VoidCallback? onBack;
  final Widget? trailing;

  const ClbyAppBar({
    super.key,
    required this.title,
    this.onBack,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return FrostedHeaderShell(
      child: Row(
        children: [
              if (onBack != null) ...[
                // -6px nudge left (the design pulls the chip flush with the
                // edge). Container.margin can't be negative in Flutter, so
                // we use Transform — no impact on layout, just paint offset.
                Transform.translate(
                  offset: const Offset(-6, 0),
                  child: GestureDetector(
                    onTap: onBack,
                    child: Container(
                      width: 36,
                      height: 36,
                      margin: const EdgeInsets.only(right: 2),
                      decoration: BoxDecoration(
                        color: AppColors.surface2,
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.border),
                      ),
                      alignment: Alignment.center,
                      child: Icon(
                        Icons.arrow_back_ios_new_rounded,
                        size: 16,
                        color: AppColors.text,
                      ),
                    ),
                  ),
                ),
              ],
              Expanded(
                child: Text(
                  title.toUpperCase(),
                  style: AppText.disp(
                    size: 22,
                    letterSpacing: 1.2,
                    color: AppColors.text,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
          ?trailing,
        ],
      ),
    );
  }
}
