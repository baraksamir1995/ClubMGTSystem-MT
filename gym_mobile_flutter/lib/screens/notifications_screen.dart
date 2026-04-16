import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/notification_model.dart';
import '../providers/auth_provider.dart';
import '../providers/member_provider.dart';
import '../widgets/shimmer_loader.dart';
import '../widgets/screen_refresh_indicator.dart';

// ─── Filter values ────────────────────────────────────────────────────────────

enum _NotifFilter { all, unread, read }

// ─── Screen ───────────────────────────────────────────────────────────────────

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  _NotifFilter _filter = _NotifFilter.all;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _init());
  }

  Future<void> _init() async {
    final authProvider = context.read<AuthProvider>();
    final memberProvider = context.read<MemberProvider>();
    final gymId = authProvider.profile?.gymId;
    if (gymId != null) {
      await memberProvider.loadNotifications(gymId);
    }
    // Clear bell badge once the screen is open
    if (mounted) memberProvider.markNotificationsAsRead();
  }

  Future<void> _refresh() async {
    final authProvider = context.read<AuthProvider>();
    final memberProvider = context.read<MemberProvider>();
    final gymId = authProvider.profile?.gymId;
    if (gymId != null) {
      await memberProvider.loadNotifications(gymId);
    }
    if (mounted) memberProvider.markNotificationsAsRead();
  }

  // ── Filtering & grouping ──────────────────────────────────────────────────

  List<GymNotification> _filtered(
      List<GymNotification> all, MemberProvider mp) {
    switch (_filter) {
      case _NotifFilter.unread:
        return all.where((n) => !mp.isNotificationRead(n.id)).toList();
      case _NotifFilter.read:
        return all.where((n) => mp.isNotificationRead(n.id)).toList();
      case _NotifFilter.all:
        return all;
    }
  }

  /// Groups notifications into today / yesterday / earlier.
  /// Returns a list of mixed items: String (header) or GymNotification.
  List<Object> _group(List<GymNotification> notifs) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final yesterday = today.subtract(const Duration(days: 1));

    final todayList = <GymNotification>[];
    final yesterdayList = <GymNotification>[];
    final earlierList = <GymNotification>[];

    for (final n in notifs) {
      final d = n.sentAt;
      if (d == null) {
        earlierList.add(n);
        continue;
      }
      final day = DateTime(d.year, d.month, d.day);
      if (day == today) {
        todayList.add(n);
      } else if (day == yesterday) {
        yesterdayList.add(n);
      } else {
        earlierList.add(n);
      }
    }

    final result = <Object>[];
    if (todayList.isNotEmpty) {
      result.add('TODAY');
      result.addAll(todayList);
    }
    if (yesterdayList.isNotEmpty) {
      result.add('YESTERDAY');
      result.addAll(yesterdayList);
    }
    if (earlierList.isNotEmpty) {
      result.add('EARLIER');
      result.addAll(earlierList);
    }
    return result;
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final memberProvider = context.watch<MemberProvider>();
    final primary = Theme.of(context).colorScheme.primary;

    final allNotifs = memberProvider.notifications;
    final filtered = _filtered(allNotifs, memberProvider);
    final grouped = _group(filtered);
    final unreadCount = memberProvider.unreadNotificationCount;

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      appBar: _buildAppBar(context, unreadCount),
      body: ScreenRefreshIndicator(
        onRefresh: _refresh,
        icon: Icons.notifications_rounded,
        color: primary,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            // Filter bar
            SliverToBoxAdapter(
              child: _buildFilterBar(primary),
            ),

            // Loading
            if (memberProvider.isLoadingNotifications)
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                sliver: SliverToBoxAdapter(
                  child: BrandedSkeletonList.fromContext(context, itemCount: 5, itemHeight: 80),
                ),
              )

            // Error
            else if (memberProvider.notificationsError != null)
              SliverFillRemaining(
                child: _buildError(
                    context, memberProvider.notificationsError!, primary),
              )

            // Empty — no notifications at all
            else if (allNotifs.isEmpty)
              const SliverFillRemaining(
                child: _EmptyState(
                  title: 'No notifications yet',
                  subtitle:
                      'You\'ll see updates about bookings, payments, and activities here.',
                ),
              )

            // Empty — filter returned nothing
            else if (filtered.isEmpty)
              SliverFillRemaining(
                child: _EmptyState(
                  title: _filter == _NotifFilter.unread
                      ? 'All caught up!'
                      : 'No read notifications',
                  subtitle: _filter == _NotifFilter.unread
                      ? 'You have no unread notifications right now.'
                      : 'Notifications you\'ve opened will appear here.',
                ),
              )

            // List
            else
              SliverPadding(
                padding: const EdgeInsets.only(bottom: 32),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      final item = grouped[index];
                      if (item is String) {
                        return _SectionHeader(label: item);
                      }
                      final notif = item as GymNotification;
                      return _NotificationTile(
                        notification: notif,
                        isRead: memberProvider.isNotificationRead(notif.id),
                        onTap: () {
                          memberProvider.markNotificationRead(notif.id);
                        },
                      );
                    },
                    childCount: grouped.length,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  // ── Sub-widgets ───────────────────────────────────────────────────────────

  PreferredSizeWidget _buildAppBar(BuildContext context, int unreadCount) {
    final theme = Theme.of(context);
    return AppBar(
      leadingWidth: 0,
      leading: const SizedBox.shrink(),
      titleSpacing: 20,
      automaticallyImplyLeading: false,
      backgroundColor: theme.colorScheme.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      title: Row(
        children: [
          GestureDetector(
            onTap: () => context.pop(),
            child: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
          ),
          const SizedBox(width: 12),
          Text(
            'Notifications',
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w800,
              fontSize: 22,
            ),
          ),
          if (unreadCount > 0) ...[
            const SizedBox(width: 8),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: const Color(0xFF3B5BDB),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                '$unreadCount',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ],
      ),
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(1),
        child: Divider(
          height: 1,
          thickness: 1,
          color:
              Theme.of(context).colorScheme.outline.withValues(alpha: 0.12),
        ),
      ),
    );
  }

  Widget _buildFilterBar(Color primary) {
    return Container(
      color: Theme.of(context).colorScheme.surface,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Row(
        children: [
          _FilterChip(
            label: 'All',
            selected: _filter == _NotifFilter.all,
            primary: primary,
            onTap: () => setState(() => _filter = _NotifFilter.all),
          ),
          const SizedBox(width: 8),
          _FilterChip(
            label: 'Unread',
            selected: _filter == _NotifFilter.unread,
            primary: primary,
            onTap: () => setState(() => _filter = _NotifFilter.unread),
          ),
          const SizedBox(width: 8),
          _FilterChip(
            label: 'Read',
            selected: _filter == _NotifFilter.read,
            primary: primary,
            onTap: () => setState(() => _filter = _NotifFilter.read),
          ),
        ],
      ),
    );
  }

  Widget _buildError(BuildContext context, String error, Color primary) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 48, color: theme.colorScheme.error),
            const SizedBox(height: 16),
            Text('Failed to load notifications',
                style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(
              error,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 20),
            OutlinedButton(
              onPressed: _refresh,
              style: OutlinedButton.styleFrom(minimumSize: const Size(0, 44)),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Section header ───────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String label;
  const _SectionHeader({required this.label});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      width: double.infinity,
      color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.45),
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
      child: Text(
        label,
        style: theme.textTheme.labelSmall?.copyWith(
          fontWeight: FontWeight.w700,
          color: theme.colorScheme.onSurfaceVariant,
          letterSpacing: 0.8,
        ),
      ),
    );
  }
}

// ─── Filter chip ──────────────────────────────────────────────────────────────

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final Color primary;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.selected,
    required this.primary,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF1D1D1B) : Colors.transparent,
          borderRadius: BorderRadius.circular(50),
          border: Border.all(
            color: selected
                ? const Color(0xFF1D1D1B)
                : theme.colorScheme.outline.withValues(alpha: 0.25),
            width: 1.2,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : theme.colorScheme.onSurface,
          ),
        ),
      ),
    );
  }
}

// ─── Notification tile ────────────────────────────────────────────────────────

class _NotificationTile extends StatelessWidget {
  final GymNotification notification;
  final bool isRead;
  final VoidCallback onTap;

  const _NotificationTile({
    required this.notification,
    required this.isRead,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final config = _notifConfig(notification.title, notification.message);

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Type icon
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: config.bgColor,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(config.icon, color: config.iconColor, size: 20),
            ),

            const SizedBox(width: 12),

            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    notification.title,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight:
                          isRead ? FontWeight.w500 : FontWeight.w700,
                      color: theme.colorScheme.onSurface,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    notification.message,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    _formatTimestamp(notification.sentAt),
                    style: theme.textTheme.bodySmall?.copyWith(
                      fontSize: 11,
                      color: theme.colorScheme.onSurfaceVariant
                          .withValues(alpha: 0.65),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(width: 8),

            // Unread dot
            if (!isRead)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: Color(0xFF3B5BDB),
                    shape: BoxShape.circle,
                  ),
                ),
              )
            else
              const SizedBox(width: 8),
          ],
        ),
      ),
    );
  }

  String _formatTimestamp(DateTime? dt) {
    if (dt == null) return '';
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final d = DateTime(dt.year, dt.month, dt.day);
    final diff = today.difference(d).inDays;

    final timeStr = DateFormat('h:mm a').format(dt);

    if (diff == 0) return timeStr;
    if (diff == 1) return 'Yesterday, $timeStr';
    if (diff < 7) return '$diff days ago';
    if (diff < 14) return '1 week ago';
    return DateFormat('MMM d').format(dt);
  }
}

// ─── Notification type config ─────────────────────────────────────────────────

class _NotifConfig {
  final IconData icon;
  final Color iconColor;
  final Color bgColor;
  const _NotifConfig(this.icon, this.iconColor, this.bgColor);
}

_NotifConfig _notifConfig(String title, String message) {
  final t = title.toLowerCase();
  final m = message.toLowerCase();
  final combined = '$t $m';

  if (combined.contains('payment') || combined.contains('paid') ||
      combined.contains('purchased')) {
    return const _NotifConfig(
      Icons.credit_card_rounded,
      Color(0xFF1A9D8A),
      Color(0xFFE3F5F2),
    );
  }
  if (combined.contains('booking') || combined.contains('confirmed')) {
    return const _NotifConfig(
      Icons.calendar_today_rounded,
      Color(0xFF5B4FCF),
      Color(0xFFEEEBF8),
    );
  }
  if (combined.contains('class') || combined.contains('session') ||
      combined.contains('starting') || combined.contains('reminder') ||
      combined.contains('yoga') || combined.contains('hiit') ||
      combined.contains('boxing') || combined.contains('spin')) {
    return const _NotifConfig(
      Icons.schedule_rounded,
      Color(0xFF3B5BDB),
      Color(0xFFE8EDFF),
    );
  }
  if (combined.contains('membership') || combined.contains('expir') ||
      combined.contains('renew')) {
    return const _NotifConfig(
      Icons.schedule_rounded,
      Color(0xFFE08430),
      Color(0xFFFFF3E8),
    );
  }
  if (combined.contains('attendance') || combined.contains('attended') ||
      combined.contains('check-in') || combined.contains('checkin')) {
    return const _NotifConfig(
      Icons.person_outline_rounded,
      Color(0xFF1A9D8A),
      Color(0xFFE3F5F2),
    );
  }
  if (combined.contains('limit') || combined.contains('warning') ||
      combined.contains('alert') || combined.contains('reached')) {
    return const _NotifConfig(
      Icons.warning_amber_rounded,
      Color(0xFFD4437E),
      Color(0xFFFDE8F0),
    );
  }
  if (combined.contains('offer') || combined.contains('exclusive') ||
      combined.contains('deal') || combined.contains('discount')) {
    return const _NotifConfig(
      Icons.star_outline_rounded,
      Color(0xFFD4437E),
      Color(0xFFFDE8F0),
    );
  }
  if (combined.contains('update') || combined.contains('version') ||
      combined.contains('new feature')) {
    return const _NotifConfig(
      Icons.info_outline_rounded,
      Color(0xFF8A8A8A),
      Color(0xFFF0F0F0),
    );
  }
  // default
  return const _NotifConfig(
    Icons.notifications_outlined,
    Color(0xFF8A8A8A),
    Color(0xFFF0F0F0),
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  final String title;
  final String subtitle;

  const _EmptyState({required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: theme.colorScheme.surfaceContainerHighest
                    .withValues(alpha: 0.6),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.notifications_none_rounded,
                size: 38,
                color: theme.colorScheme.onSurfaceVariant
                    .withValues(alpha: 0.5),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              title,
              textAlign: TextAlign.center,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: theme.colorScheme.onSurface,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
