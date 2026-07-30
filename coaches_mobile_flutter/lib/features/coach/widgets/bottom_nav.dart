import 'dart:ui';
import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_text.dart';

/// Bottom nav. Port of `BottomNav` in coach-app.jsx — frosted background,
/// four equal tabs (Scan / Members / Log / Sales), a lime active state
/// (small underline indicator + lime icon/label), and a separate round
/// logout pill on the far right.
class CoachBottomNav extends StatelessWidget {
  final int index;
  final ValueChanged<int> onTabChanged;
  final VoidCallback onLogout;

  static const tabs = [
    _NavTab(label: 'Scan', icon: Icons.qr_code_2_rounded),
    _NavTab(label: 'Members', icon: Icons.groups_2_outlined),
    _NavTab(label: 'Log', icon: Icons.calendar_today_outlined),
  ];

  const CoachBottomNav({
    super.key,
    required this.index,
    required this.onTabChanged,
    required this.onLogout,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          padding: const EdgeInsets.fromLTRB(14, 10, 14, 28),
          decoration: BoxDecoration(
            color: AppColors.bg.withValues(alpha: 0.85),
            border: Border(
              top: BorderSide(color: AppColors.border, width: 0.5),
            ),
          ),
          child: Row(
            children: [
              for (int i = 0; i < tabs.length; i++)
                Expanded(
                  child: _NavTabButton(
                    tab: tabs[i],
                    active: index == i,
                    onTap: () => onTabChanged(i),
                  ),
                ),
              const SizedBox(width: 4),
              GestureDetector(
                onTap: onLogout,
                child: Container(
                  width: 38,
                  height: 38,
                  margin: const EdgeInsets.only(left: 4),
                  decoration: BoxDecoration(
                    color: AppColors.surface2,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Icon(Icons.logout_rounded,
                      size: 16, color: AppColors.textSec),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavTab {
  final String label;
  final IconData icon;
  const _NavTab({required this.label, required this.icon});
}

class _NavTabButton extends StatelessWidget {
  final _NavTab tab;
  final bool active;
  final VoidCallback onTap;
  const _NavTabButton({required this.tab, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final color = active ? AppColors.lime : AppColors.textSec;
    final labelColor = active ? AppColors.lime : AppColors.textTer;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(2, 8, 2, 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Lime indicator dot on top — only when active.
            SizedBox(
              height: 2,
              child: active
                  ? Container(
                      width: 24,
                      decoration: BoxDecoration(
                        color: AppColors.lime,
                        borderRadius: BorderRadius.circular(1),
                      ),
                    )
                  : null,
            ),
            const SizedBox(height: 2),
            AnimatedScale(
              scale: active ? 1.05 : 1.0,
              duration: const Duration(milliseconds: 120),
              child: Icon(tab.icon, size: 22, color: color),
            ),
            const SizedBox(height: 4),
            Text(
              tab.label.toUpperCase(),
              style: AppText.mono(
                size: 9,
                letterSpacing: 1,
                color: labelColor,
                weight: active ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
