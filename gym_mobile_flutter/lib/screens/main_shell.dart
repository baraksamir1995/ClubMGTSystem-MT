import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:clby/l10n/l10n.dart';
import '../features/offline/member_offline_controller.dart';
import '../features/offline/offline_ui.dart';
import 'qr_scanner_screen.dart';

class MainShell extends StatefulWidget {
  final StatefulNavigationShell navigationShell;

  const MainShell({super.key, required this.navigationShell});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  @override
  Widget build(BuildContext context) {
    // Offline attendance (Phase 3 Amendment 3): no separate offline
    // screen. Offline, the normal shell stays but is dimmed and disabled;
    // only Scan QR works. The widget tree is identical online (opacity 1,
    // pointer events on, no chip unless something is pending), so the
    // tabs keep their state and online looks exactly like today.
    final offline = context.watch<MemberOfflineController>();
    final dim = offline.offlineMode;
    return Scaffold(
      body: Stack(
        children: [
          IgnorePointer(
            ignoring: dim,
            child: Opacity(
              opacity: dim ? 0.35 : 1,
              child: widget.navigationShell,
            ),
          ),
          if (offline.showStatus)
            PositionedDirectional(
              top: MediaQuery.of(context).padding.top + 6,
              end: 12,
              child: const OfflineSyncChip(),
            ),
        ],
      ),
      bottomNavigationBar: _BottomNav(
        currentIndex: widget.navigationShell.currentIndex,
        offline: dim,
        onTap: (index) {
          if (dim) {
            // Only the centre Scan button is usable offline.
            if (index == 2) {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const QrScannerScreen()),
              );
            }
            return;
          }
          widget.navigationShell.goBranch(
            index,
            initialLocation: index == widget.navigationShell.currentIndex,
          );
        },
      ),
    );
  }
}

// ─── Custom bottom nav ────────────────────────────────────────────────────────

class _BottomNav extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;

  /// Offline mode: every item except the centre Scan button is dimmed.
  final bool offline;

  const _BottomNav({
    required this.currentIndex,
    required this.onTap,
    this.offline = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
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
                child: _NavItem(
                  icon: Icons.home_outlined,
                  activeIcon: Icons.home_rounded,
                  label: context.l10n.navHome,
                  index: 0,
                  currentIndex: currentIndex,
                  onTap: onTap,
                  disabled: offline,
                ),
              ),
              // Classes
              Expanded(
                child: _NavItem(
                  icon: Icons.calendar_month_outlined,
                  activeIcon: Icons.calendar_month_rounded,
                  label: context.l10n.navClasses,
                  index: 1,
                  currentIndex: currentIndex,
                  onTap: onTap,
                  disabled: offline,
                ),
              ),
              // Center QR / Check-in button
              SizedBox(
                width: 72,
                child: Center(
                  child: GestureDetector(
                    onTap: () => onTap(2),
                    child: Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: const Color(0xFF1A1A2E),
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.28),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.qr_code_scanner_rounded,
                        color: Colors.white,
                        size: 24,
                      ),
                    ),
                  ),
                ),
              ),
              // Explore (placeholder — content TBD)
              Expanded(
                child: _NavItem(
                  icon: Icons.explore_outlined,
                  activeIcon: Icons.explore_rounded,
                  label: context.l10n.navExplore,
                  index: 3,
                  currentIndex: currentIndex,
                  onTap: onTap,
                  disabled: offline,
                ),
              ),
              // Profile
              Expanded(
                child: _NavItem(
                  icon: Icons.person_outline_rounded,
                  activeIcon: Icons.person_rounded,
                  label: context.l10n.navProfile,
                  index: 4,
                  currentIndex: currentIndex,
                  onTap: onTap,
                  disabled: offline,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final int index;
  final int currentIndex;
  final ValueChanged<int> onTap;
  final bool disabled;

  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.index,
    required this.currentIndex,
    required this.onTap,
    this.disabled = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isSelected = index == currentIndex;
    final color = isSelected
        ? theme.colorScheme.primary
        : theme.colorScheme.onSurfaceVariant;

    return GestureDetector(
      onTap: () => onTap(index),
      behavior: HitTestBehavior.opaque,
      child: Opacity(
        opacity: disabled ? 0.35 : 1,
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
      ),
    );
  }
}
