import 'package:flutter/material.dart';
import 'package:clby/l10n/l10n.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/gym_app_bar.dart';
import '../../widgets/guest_register_prompt.dart';

class GuestShell extends StatelessWidget {
  final StatefulNavigationShell navigationShell;

  const GuestShell({super.key, required this.navigationShell});

  void _onTap(BuildContext context, int index) {
    // Indices 2 (QR/Check-in), 3 (Bookings), 4 (Profile) are locked for guests
    if (index >= 2) {
      showGuestRegisterPrompt(context);
      return;
    }
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final gym = context.watch<AuthProvider>().gym;
    final currentIndex = navigationShell.currentIndex;

    return Scaffold(
      appBar: GymAppBar(
        gym: gym,
        greeting: context.l10n.guestShellWelcome,
        showGuestAvatar: true,
      ),
      body: Column(
        children: [
          // Sign up banner
          Material(
            color: theme.colorScheme.primary,
            child: SafeArea(
              bottom: false,
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline,
                        color: Colors.white, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        context.l10n.guestShellBrowsingAsGuest,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: () => context.go('/register'),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          context.l10n.guestShellJoinNow,
                          style: TextStyle(
                            color: theme.colorScheme.primary,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Expanded(child: navigationShell),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 16,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 64,
            child: Row(
              children: [
                // Home
                Expanded(
                  child: _GuestNavItem(
                    icon: Icons.home_outlined,
                    activeIcon: Icons.home_rounded,
                    label: context.l10n.guestShellNavHome,
                    index: 0,
                    currentIndex: currentIndex,
                    onTap: (i) => _onTap(context, i),
                  ),
                ),
                // Classes
                Expanded(
                  child: _GuestNavItem(
                    icon: Icons.calendar_month_outlined,
                    activeIcon: Icons.calendar_month_rounded,
                    label: context.l10n.guestShellNavClasses,
                    index: 1,
                    currentIndex: currentIndex,
                    onTap: (i) => _onTap(context, i),
                  ),
                ),
                // Center QR / Check-in (locked)
                SizedBox(
                  width: 72,
                  child: Center(
                    child: GestureDetector(
                      onTap: () => _onTap(context, 2),
                      child: Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          color: theme.colorScheme.onSurface
                              .withValues(alpha: 0.18),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.qr_code_scanner_rounded,
                          color: theme.colorScheme.onSurface
                              .withValues(alpha: 0.35),
                          size: 24,
                        ),
                      ),
                    ),
                  ),
                ),
                // Explore (locked)
                Expanded(
                  child: _GuestNavItem(
                    icon: Icons.explore_outlined,
                    activeIcon: Icons.explore_rounded,
                    label: context.l10n.guestShellNavExplore,
                    index: 3,
                    currentIndex: currentIndex,
                    onTap: (i) => _onTap(context, i),
                    locked: true,
                  ),
                ),
                // Profile (locked)
                Expanded(
                  child: _GuestNavItem(
                    icon: Icons.person_outline_rounded,
                    activeIcon: Icons.person_rounded,
                    label: context.l10n.guestShellNavProfile,
                    index: 4,
                    currentIndex: currentIndex,
                    onTap: (i) => _onTap(context, i),
                    locked: true,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _GuestNavItem extends StatelessWidget {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final int index;
  final int currentIndex;
  final ValueChanged<int> onTap;
  final bool locked;

  const _GuestNavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.index,
    required this.currentIndex,
    required this.onTap,
    this.locked = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isSelected = !locked && index == currentIndex;
    final color = locked
        ? theme.colorScheme.onSurface.withValues(alpha: 0.3)
        : isSelected
            ? theme.colorScheme.primary
            : theme.colorScheme.onSurfaceVariant;

    return GestureDetector(
      onTap: () => onTap(index),
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(isSelected ? activeIcon : icon, size: 24, color: color),
          const SizedBox(height: 3),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
