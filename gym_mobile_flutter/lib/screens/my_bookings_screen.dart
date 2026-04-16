import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/booking_record_model.dart';
import '../providers/auth_provider.dart';
import '../providers/member_provider.dart';
import '../utils/theme.dart';
import '../widgets/shimmer_loader.dart';

class MyBookingsScreen extends StatefulWidget {
  const MyBookingsScreen({super.key});

  @override
  State<MyBookingsScreen> createState() => _MyBookingsScreenState();
}

class _MyBookingsScreenState extends State<MyBookingsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadData());
  }

  Future<void> _loadData() async {
    final memberProvider = context.read<MemberProvider>();
    final gymId = context.read<AuthProvider>().profile?.gymId;
    if (gymId != null) await memberProvider.ensureMemberLoaded(gymId);
    await memberProvider.loadMyBookings();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final memberProvider = context.watch<MemberProvider>();

    final upcoming = memberProvider.myBookings
        .where((b) => b.isUpcoming)
        .toList()
      ..sort((a, b) => a.sessionDate.compareTo(b.sessionDate));
    final history = memberProvider.myBookings
        .where((b) => !b.isUpcoming)
        .toList()
      ..sort((a, b) => b.sessionDate.compareTo(a.sessionDate));

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'My Bookings',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        bottom: TabBar(
          controller: _tabController,
          tabs: [
            Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Upcoming'),
                  if (upcoming.isNotEmpty) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: theme.colorScheme.primary,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '${upcoming.length}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const Tab(text: 'Past'),
          ],
        ),
      ),
      body: memberProvider.isLoadingMyBookings
          ? Padding(
              padding: const EdgeInsets.all(16),
              child: ShimmerListLoader(itemCount: 5, itemHeight: 100),
            )
          : memberProvider.myBookingsError != null
              ? _buildError(context, memberProvider.myBookingsError!)
              : RefreshIndicator(
                  onRefresh: () =>
                      context.read<MemberProvider>().loadMyBookings(),
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _BookingList(
                        bookings: upcoming,
                        emptyIcon: Icons.event_available_outlined,
                        emptyTitle: 'No upcoming bookings',
                        emptySubtitle:
                            'Book a class from the Schedule tab',
                      ),
                      _BookingList(
                        bookings: history,
                        emptyIcon: Icons.history_outlined,
                        emptyTitle: 'No past bookings',
                        emptySubtitle:
                            'Your attended and cancelled sessions will appear here',
                      ),
                    ],
                  ),
                ),
    );
  }

  Widget _buildError(BuildContext context, String error) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 48, color: theme.colorScheme.error),
            const SizedBox(height: 16),
            Text('Failed to load bookings',
                style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(
              error,
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: () =>
                  context.read<MemberProvider>().loadMyBookings(),
              style:
                  OutlinedButton.styleFrom(minimumSize: const Size(0, 44)),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Booking list ─────────────────────────────────────────────────────────────

class _BookingList extends StatelessWidget {
  final List<BookingRecord> bookings;
  final IconData emptyIcon;
  final String emptyTitle;
  final String emptySubtitle;

  const _BookingList({
    required this.bookings,
    required this.emptyIcon,
    required this.emptyTitle,
    required this.emptySubtitle,
  });

  @override
  Widget build(BuildContext context) {
    if (bookings.isEmpty) {
      return _buildEmpty(context);
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      itemCount: bookings.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) =>
          _BookingCard(booking: bookings[index]),
    );
  }

  Widget _buildEmpty(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            emptyIcon,
            size: 64,
            color: theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.4),
          ),
          const SizedBox(height: 16),
          Text(
            emptyTitle,
            style: theme.textTheme.titleMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 40),
            child: Text(
              emptySubtitle,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Booking card ─────────────────────────────────────────────────────────────

class _BookingCard extends StatelessWidget {
  final BookingRecord booking;

  const _BookingCard({required this.booking});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    Color accentColor = AppTheme.defaultPrimary;
    if (booking.classColor != null && booking.classColor!.isNotEmpty) {
      try {
        accentColor = AppTheme.colorFromHex(booking.classColor!);
      } catch (_) {}
    }

    return Card(
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(
          children: [
            Container(width: 5, color: accentColor),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Left: class info
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Class name
                          Text(
                            booking.className ?? 'Class',
                            style: theme.textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 4),
                          // Class type badge
                          if (booking.classType != null)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: accentColor.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(5),
                              ),
                              child: Text(
                                _capitalize(booking.classType!),
                                style: TextStyle(
                                  color: accentColor,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          const SizedBox(height: 6),
                          // Trainer
                          if (booking.instructor != null)
                            _InfoRow(
                              icon: Icons.person_outline,
                              text: booking.instructor!,
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          const SizedBox(height: 3),
                          // Session date & time
                          _InfoRow(
                            icon: Icons.calendar_today_outlined,
                            text: DateFormat('EEE, MMM d, yyyy')
                                .format(booking.sessionDate),
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                          const SizedBox(height: 3),
                          _InfoRow(
                            icon: Icons.access_time_outlined,
                            text: _formatTime(
                                booking.sessionDate, booking.sessionEndTime),
                            color: accentColor,
                            fontWeight: FontWeight.w600,
                          ),
                          const SizedBox(height: 6),
                          // Booked on date
                          Text(
                            'Booked on ${DateFormat('MMM d, yyyy').format(booking.bookedAt)}',
                            style: theme.textTheme.labelSmall?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant
                                  .withValues(alpha: 0.7),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    // Right: status badge
                    _StatusBadge(status: booking.status),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatTime(DateTime start, DateTime? end) {
    final s = DateFormat('h:mm a').format(start);
    if (end == null) return s;
    return '$s – ${DateFormat('h:mm a').format(end)}';
  }

  String _capitalize(String s) =>
      s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
}

// ─── Status badge ─────────────────────────────────────────────────────────────

class _StatusBadge extends StatelessWidget {
  final String status;

  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    Color color;
    IconData icon;
    String label;

    switch (status) {
      case 'attended':
        color = Colors.blue;
        icon = Icons.verified_rounded;
        label = 'Attended';
        break;
      case 'cancelled':
        color = Colors.red;
        icon = Icons.cancel_outlined;
        label = 'Cancelled';
        break;
      default:
        color = Colors.green;
        icon = Icons.check_circle_rounded;
        label = 'Booked';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Info row ─────────────────────────────────────────────────────────────────

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String text;
  final Color color;
  final FontWeight fontWeight;

  const _InfoRow({
    required this.icon,
    required this.text,
    required this.color,
    this.fontWeight = FontWeight.w400,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 13, color: color),
        const SizedBox(width: 4),
        Expanded(
          child: Text(
            text,
            style: TextStyle(
              color: color,
              fontSize: 12,
              fontWeight: fontWeight,
            ),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}
