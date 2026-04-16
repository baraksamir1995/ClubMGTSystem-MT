import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../models/gym_model.dart';
import '../providers/member_provider.dart';

class GymAppBar extends StatelessWidget implements PreferredSizeWidget {
  final Gym? gym;
  final String fallbackTitle;
  final List<Widget>? actions;
  final bool showNotificationBell;
  /// US-01-05: shows guest avatar instead of notification bell
  final bool showGuestAvatar;
  /// US-01-02: when non-null, renders "Hi, [greeting]" inline right of logo.
  final String? greeting;
  final TextStyle? greetingStyle;

  const GymAppBar({
    super.key,
    this.gym,
    this.fallbackTitle = 'Gym App',
    this.actions,
    this.showNotificationBell = true,
    this.showGuestAvatar = false,
    this.greeting,
    this.greetingStyle,
  });

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    final bellAndActions = [
      if (showGuestAvatar)
        _GuestAvatar()
      else if (showNotificationBell)
        _NotificationBell(),
      ...?actions,
      const SizedBox(width: 12),
    ];

    final logoMark = _GymLogoMark(gym: gym, fallbackTitle: fallbackTitle);

    // US-01-02: logo + greeting as a left-aligned row in the title slot
    final Widget titleWidget = greeting != null
        ? Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              logoMark,
              const SizedBox(width: 10),
              Text(
                greeting!,
                style: greetingStyle ??
                    const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF1D1D1B),
                    ),
              ),
            ],
          )
        : logoMark;

    return AppBar(
      leadingWidth: 0,
      leading: const SizedBox.shrink(),
      titleSpacing: 16,
      automaticallyImplyLeading: false,
      title: titleWidget,
      centerTitle: false,
      actions: bellAndActions,
      backgroundColor: Theme.of(context).colorScheme.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(1),
        child: Divider(
          height: 1,
          thickness: 1,
          color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.12),
        ),
      ),
    );
  }
}

// US-01-01 — 26×26px logo mark, border-radius 7px, dark background #1D1D1B
// Non-tappable. Fallback: first letter of gym name.
class _GymLogoMark extends StatelessWidget {
  final Gym? gym;
  final String fallbackTitle;

  const _GymLogoMark({required this.gym, required this.fallbackTitle});

  static const _bg = Color(0xFF1D1D1B);
  static const _size = 26.0;
  static const _radius = 7.0;

  String get _initial {
    final name = gym?.name ?? fallbackTitle;
    return name.isNotEmpty ? name[0].toUpperCase() : '?';
  }

  @override
  Widget build(BuildContext context) {
    final logoUrl = gym?.logoUrl;
    final hasLogo = logoUrl != null && logoUrl.isNotEmpty;

    return Container(
      width: _size,
      height: _size,
      decoration: BoxDecoration(
        color: _bg,
        borderRadius: BorderRadius.circular(_radius),
      ),
      clipBehavior: Clip.antiAlias,
      child: hasLogo
          ? CachedNetworkImage(
              imageUrl: logoUrl,
              width: _size,
              height: _size,
              fit: BoxFit.cover,
              placeholder: (ctx, url) => _buildInitial(),
              errorWidget: (ctx, url, err) => _buildInitial(),
            )
          : _buildInitial(),
    );
  }

  Widget _buildInitial() {
    return Center(
      child: Text(
        _initial,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 13,
          fontWeight: FontWeight.w700,
          height: 1,
        ),
      ),
    );
  }
}

// US-01-04: 28×28px circular bell, 7px red dot badge (#E24B4A) with 1.5px white border
class _NotificationBell extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final hasUnread =
        context.watch<MemberProvider>().hasUnreadNotifications;

    return GestureDetector(
      onTap: () => context.push('/notifications'),
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: 28,
        height: 28,
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            const Icon(Icons.notifications_outlined, size: 22),
            if (hasUnread)
              Positioned(
                right: -1,
                top: -1,
                child: Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE24B4A),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 1.5),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// US-01-05: 28×28px circular avatar (#D3D1C7), replaces bell for guest users
class _GuestAvatar extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.go('/login'),
      child: Container(
        width: 28,
        height: 28,
        decoration: const BoxDecoration(
          color: Color(0xFFD3D1C7),
          shape: BoxShape.circle,
        ),
        child: const Icon(Icons.person_outline, size: 16, color: Colors.black87),
      ),
    );
  }
}
