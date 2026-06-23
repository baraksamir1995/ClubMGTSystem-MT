import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../models/attendance_model.dart';
import '../models/transfer_log.dart';
import '../models/grant_log.dart';
import '../providers/auth_provider.dart';
import '../providers/member_provider.dart';
import '../widgets/gym_app_bar.dart';
import '../widgets/screen_refresh_indicator.dart';
import '../widgets/shimmer_loader.dart';
import 'qr_scanner_screen.dart';
import 'attendance_history_screen.dart';

// ── Design tokens (shared with the rest of the warm UI) ─────────────────────
const _kBg          = Color(0xFFF7F6F2);
const _kCard        = Color(0xFFFFFFFF);
const _kInk         = Color(0xFF1F1A14);
const _kInk2        = Color(0x9E1F1A14);
const _kInk3        = Color(0x6B1F1A14);
const _kHair        = Color(0x141F1A14);
const _kPeach       = Color(0xFFF4DCC1);
const _kPeachDeep   = Color(0xFFEAC59C);
const _kPrimary     = Color(0xFFE07A3B);
const _kPrimaryDeep = Color(0xFFC8642A);
const _kSuccess     = Color(0xFF3F8B5C);

enum _AttendanceFilter { all, entrance, classes, transfers }

class _DateRange {
  final DateTime from;
  final DateTime to;
  const _DateRange(this.from, this.to);
}

/// Polymorphic timeline item — either a check-in (attendance) or a session
/// transfer. Lets _HistoryList render both in one chronological list.
sealed class _ActivityItem {
  DateTime get timestamp;
  String get id;
}

class _AttItem extends _ActivityItem {
  final Attendance attendance;
  _AttItem(this.attendance);
  @override DateTime get timestamp => attendance.checkedInAt;
  @override String get id => attendance.id;
}

class _XferItem extends _ActivityItem {
  final TransferLog transfer;
  _XferItem(this.transfer);
  @override DateTime get timestamp => transfer.createdAt;
  @override String get id => transfer.id;
}

class _GrantItem extends _ActivityItem {
  final GrantLog grant;
  _GrantItem(this.grant);
  @override DateTime get timestamp => grant.createdAt;
  @override String get id => grant.id;
}

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  _AttendanceFilter _filter = _AttendanceFilter.all;
  _DateRange? _dateRange;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadAttendance());
  }

  Future<void> _loadAttendance() async {
    final memberProvider = context.read<MemberProvider>();
    final gymId = context.read<AuthProvider>().profile?.gymId;
    if (gymId != null) await memberProvider.ensureMemberLoaded(gymId);
    // Load attendance + transfers in parallel — both populate the unified
    // activity timeline rendered by _HistoryList.
    await Future.wait([
      memberProvider.loadAttendance(),
      memberProvider.loadTransfers(),
      memberProvider.loadGrants(),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final mp   = context.watch<MemberProvider>();
    final gym  = auth.gym;
    final member       = mp.member;
    final memberStatus = member?.status;
    final membership   = mp.currentMembership;
    final summary      = mp.membershipSummary;

    // Active-plan check mirrors the studio QR access predicate.
    final hasActiveSubscription = membership != null &&
        membership.isActive &&
        memberStatus != 'suspended';
    final hasTransferredAccess = summary != null &&
        summary.totalSessions > 0 &&
        summary.buckets.any((b) => b.isTransferred) &&
        memberStatus != 'suspended';
    final hasActivePlan = hasActiveSubscription || hasTransferredAccess;
    final isSuspended = memberStatus == 'suspended';

    // Build the unified timeline (attendance + transfers) and apply filters.
    // Sorting happens here, so additions to either list naturally interleave.
    final activity = <_ActivityItem>[
      ...mp.attendance.map((a) => _AttItem(a)),
      ...mp.transfers.map((t) => _XferItem(t)),
      ...mp.grants.map((g) => _GrantItem(g)),
    ]..sort((a, b) => b.timestamp.compareTo(a.timestamp));
    final filtered = _applyFilters(activity);

    return Scaffold(
      backgroundColor: _kBg,
      appBar: GymAppBar(
        gym: gym,
        fallbackTitle: 'Attendance',
        greeting: 'Attendance',
        greetingStyle: const TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w800,
          color: _kInk,
        ),
      ),
      body: ScreenRefreshIndicator(
        onRefresh: _loadAttendance,
        icon: Icons.qr_code_rounded,
        color: _kPrimary,
        child: hasActivePlan
            ? _ActiveBody(
                planName: membership?.planName ?? 'Active Plan',
                memberNumber: member?.memberNumber,
                renewsOn: membership?.endDate,
                filter: _filter,
                onFilter: (f) => setState(() => _filter = f),
                dateRange: _dateRange,
                onPickDate: _openDatePicker,
                onClearDate: () => setState(() => _dateRange = null),
                onScan: _openScanner,
                items: filtered,
                isLoading: mp.isLoadingAttendance || mp.isLoadingTransfers || mp.isLoadingGrants,
                error: mp.attendanceError ?? mp.transfersError ?? mp.grantsError,
                onViewAll: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => AttendanceHistoryScreen(memberId: member?.id ?? ''),
                  ),
                ),
                onRetry: _loadAttendance,
              )
            : _NoMembershipBody(
                isSuspended: isSuspended,
                onBrowse: isSuspended ? null : () => context.push('/explore/memberships'),
              ),
      ),
    );
  }

  // ── Filtering ───────────────────────────────────────────────────────────────
  List<_ActivityItem> _applyFilters(List<_ActivityItem> all) {
    Iterable<_ActivityItem> items = all;
    switch (_filter) {
      case _AttendanceFilter.all:
        // no type filter — show everything
        break;
      case _AttendanceFilter.entrance:
        items = items.whereType<_AttItem>().where((i) => i.attendance.isEntrance);
        break;
      case _AttendanceFilter.classes:
        items = items.whereType<_AttItem>().where((i) => i.attendance.isClassOrStudio);
        break;
      case _AttendanceFilter.transfers:
        items = items.where((i) => i is _XferItem || i is _GrantItem);
        break;
    }
    final r = _dateRange;
    if (r != null) {
      final from = DateTime(r.from.year, r.from.month, r.from.day);
      final to   = DateTime(r.to.year,   r.to.month,   r.to.day,   23, 59, 59);
      items = items.where((i) => !i.timestamp.isBefore(from) && !i.timestamp.isAfter(to));
    }
    return items.toList();
  }

  Future<void> _openDatePicker() async {
    final picked = await showModalBottomSheet<_DateRange>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _DateFilterSheet(initial: _dateRange),
    );
    if (picked != null && mounted) setState(() => _dateRange = picked);
  }

  Future<void> _openScanner() async {
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const QrScannerScreen()),
    );
    if (mounted) await _loadAttendance();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Active-plan body: membership card + scan CTA + filters + history
// ─────────────────────────────────────────────────────────────────────────────
class _ActiveBody extends StatelessWidget {
  final String planName;
  final String? memberNumber;
  final DateTime? renewsOn;
  final _AttendanceFilter filter;
  final ValueChanged<_AttendanceFilter> onFilter;
  final _DateRange? dateRange;
  final VoidCallback onPickDate;
  final VoidCallback onClearDate;
  final VoidCallback onScan;
  final List<_ActivityItem> items;
  final bool isLoading;
  final String? error;
  final VoidCallback onViewAll;
  final VoidCallback onRetry;

  const _ActiveBody({
    required this.planName,
    required this.memberNumber,
    required this.renewsOn,
    required this.filter,
    required this.onFilter,
    required this.dateRange,
    required this.onPickDate,
    required this.onClearDate,
    required this.onScan,
    required this.items,
    required this.isLoading,
    required this.error,
    required this.onViewAll,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        const SizedBox(height: 6),
        _MembershipCard(planName: planName, memberNumber: memberNumber, renewsOn: renewsOn),
        const SizedBox(height: 16),
        _ScanCta(onTap: onScan),
        _FilterChips(
          value: filter,
          onChange: onFilter,
          dateRange: dateRange,
          onPickDate: onPickDate,
          onClearDate: onClearDate,
        ),
        if (isLoading)
          const Padding(
            padding: EdgeInsets.fromLTRB(22, 12, 22, 0),
            child: ShimmerListLoader(itemCount: 5, itemHeight: 72),
          )
        else if (error != null)
          _ErrorBlock(error: error!, onRetry: onRetry)
        else if (items.isEmpty)
          const _EmptyHistory()
        else
          _HistoryList(items: items, onViewAll: onViewAll),
      ],
    );
  }
}

// ── Membership card (dark, peach radial accent) ──────────────────────────────
class _MembershipCard extends StatelessWidget {
  final String planName;
  final String? memberNumber;
  final DateTime? renewsOn;
  const _MembershipCard({
    required this.planName,
    required this.memberNumber,
    required this.renewsOn,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 22),
      decoration: BoxDecoration(
        color: _kInk,
        borderRadius: BorderRadius.circular(22),
        boxShadow: const [
          BoxShadow(color: Color(0x29000000), blurRadius: 30, offset: Offset(0, 14)),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          Positioned(
            top: -40, right: -40,
            child: Container(
              width: 160, height: 160,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [_kPeach.withValues(alpha: 0.32), _kPeach.withValues(alpha: 0)],
                  stops: const [0, 1],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Container(
                      width: 42, height: 42,
                      decoration: BoxDecoration(
                        color: const Color(0x1AFFFFFF),
                        borderRadius: BorderRadius.circular(13),
                      ),
                      alignment: Alignment.center,
                      child: const Icon(Icons.badge_outlined, color: _kPeach, size: 22),
                    ),
                    const SizedBox(width: 11),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'MEMBERSHIP',
                            style: TextStyle(
                              fontSize: 11, fontWeight: FontWeight.w600,
                              color: Color(0x9EFFFFFF), letterSpacing: 0.4,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            planName,
                            maxLines: 1, overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 16, fontWeight: FontWeight.w600,
                              color: Colors.white, letterSpacing: -0.2,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                      decoration: BoxDecoration(
                        color: _kSuccess.withValues(alpha: 0.22),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: const Text(
                        'Active',
                        style: TextStyle(
                          fontSize: 11, fontWeight: FontWeight.w700,
                          color: _kSuccess, letterSpacing: 0.3,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0x0FFFFFFF),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'MEMBER #',
                              style: TextStyle(
                                fontSize: 10, fontWeight: FontWeight.w600,
                                color: Color(0x8CFFFFFF), letterSpacing: 0.4,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              memberNumber == null ? '—' : '#$memberNumber',
                              style: const TextStyle(
                                fontSize: 15, fontWeight: FontWeight.w600,
                                color: Colors.white, letterSpacing: 0.2,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(width: 1, height: 26, color: const Color(0x1FFFFFFF)),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            const Text(
                              'RENEWS',
                              style: TextStyle(
                                fontSize: 10, fontWeight: FontWeight.w600,
                                color: Color(0x8CFFFFFF), letterSpacing: 0.4,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              renewsOn == null
                                  ? '—'
                                  : DateFormat('MMM d, yyyy').format(renewsOn!),
                              style: const TextStyle(
                                fontSize: 13, fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Scan-QR primary CTA (full-width dark) ────────────────────────────────────
class _ScanCta extends StatelessWidget {
  final VoidCallback onTap;
  const _ScanCta({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 22),
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          height: 56,
          decoration: BoxDecoration(
            color: _kInk,
            borderRadius: BorderRadius.circular(16),
            boxShadow: const [
              BoxShadow(color: Color(0x381F1A14), blurRadius: 20, offset: Offset(0, 8)),
            ],
          ),
          child: const Center(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.qr_code_scanner_rounded, color: Colors.white, size: 22),
                SizedBox(width: 10),
                Text(
                  'Scan QR to check in',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.1,
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

// ── Filter chips (All / Entrance / Classes / Date) ───────────────────────────
class _FilterChips extends StatelessWidget {
  final _AttendanceFilter value;
  final ValueChanged<_AttendanceFilter> onChange;
  final _DateRange? dateRange;
  final VoidCallback onPickDate;
  final VoidCallback onClearDate;

  const _FilterChips({
    required this.value,
    required this.onChange,
    required this.dateRange,
    required this.onPickDate,
    required this.onClearDate,
  });

  @override
  Widget build(BuildContext context) {
    final opts = <(_AttendanceFilter, String)>[
      (_AttendanceFilter.all, 'All'),
      (_AttendanceFilter.entrance, 'Entrance'),
      (_AttendanceFilter.classes, 'Classes'),
      (_AttendanceFilter.transfers, 'Transfers'),
    ];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(22, 14, 22, 6),
      child: Row(
        children: [
          for (final o in opts) ...[
            _Chip(
              label: o.$2,
              selected: value == o.$1,
              onTap: () => onChange(o.$1),
            ),
            const SizedBox(width: 8),
          ],
          _DateChip(
            range: dateRange,
            onTap: onPickDate,
            onClear: onClearDate,
          ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _Chip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? _kInk : _kCard,
          borderRadius: BorderRadius.circular(999),
          boxShadow: selected
              ? const [BoxShadow(color: Color(0x2D1F1A14), blurRadius: 12, offset: Offset(0, 4))]
              : const [BoxShadow(color: Color(0x0A1F1A14), blurRadius: 2, offset: Offset(0, 1))],
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? Colors.white : _kInk,
            fontSize: 13,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.1,
          ),
        ),
      ),
    );
  }
}

class _DateChip extends StatelessWidget {
  final _DateRange? range;
  final VoidCallback onTap;
  final VoidCallback onClear;
  const _DateChip({required this.range, required this.onTap, required this.onClear});

  String _label() {
    final r = range;
    if (r == null) return 'Date';
    final f = DateFormat('MMM d, yyyy');
    final from = f.format(r.from);
    final to   = f.format(r.to);
    if (from == to) return from;
    return '$from – $to';
  }

  @override
  Widget build(BuildContext context) {
    final hasRange = range != null;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: EdgeInsets.fromLTRB(10, 8, hasRange ? 8 : 12, 8),
        decoration: BoxDecoration(
          color: hasRange ? _kPeach : _kCard,
          borderRadius: BorderRadius.circular(999),
          boxShadow: const [
            BoxShadow(color: Color(0x0A1F1A14), blurRadius: 2, offset: Offset(0, 1)),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.calendar_today_outlined, size: 14, color: _kInk),
            const SizedBox(width: 6),
            Text(
              _label(),
              style: const TextStyle(
                color: _kInk, fontSize: 13, fontWeight: FontWeight.w600,
              ),
            ),
            if (hasRange) ...[
              const SizedBox(width: 4),
              GestureDetector(
                onTap: onClear,
                behavior: HitTestBehavior.opaque,
                child: const Padding(
                  padding: EdgeInsets.all(2),
                  child: Icon(Icons.close_rounded, size: 14, color: _kInk2),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Grouped history list ─────────────────────────────────────────────────────
class _HistoryList extends StatelessWidget {
  final List<_ActivityItem> items;
  final VoidCallback onViewAll;
  const _HistoryList({required this.items, required this.onViewAll});

  /// Header label accounts for both event types: "3 check-ins • 2 transfers"
  /// when a month has both, or just "2 transfers" / "3 check-ins" alone.
  String _headerCount(List<_ActivityItem> group) {
    final att = group.whereType<_AttItem>().length;
    final xfer = group.whereType<_XferItem>().length;
    final grant = group.whereType<_GrantItem>().length;
    final parts = <String>[];
    if (att > 0)   parts.add('$att ${att == 1 ? 'check-in' : 'check-ins'}');
    if (xfer > 0)  parts.add('$xfer ${xfer == 1 ? 'transfer' : 'transfers'}');
    if (grant > 0) parts.add('$grant ${grant == 1 ? 'grant' : 'grants'}');
    return parts.join(' • ');
  }

  @override
  Widget build(BuildContext context) {
    final groups = _groupByMonth(items);
    // "View all" still goes to the dedicated check-in history. Only show it
    // when the unfiltered list is long AND has at least one check-in row to
    // browse (transfers don't have a paginated history screen yet).
    final hasAnyCheckIn = items.any((i) => i is _AttItem);
    return Padding(
      padding: const EdgeInsets.fromLTRB(22, 6, 22, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < groups.length; i++) ...[
            SizedBox(height: i == 0 ? 6 : 18),
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 0, 4, 10),
              child: Row(
                children: [
                  Text(
                    groups[i].label.toUpperCase(),
                    style: const TextStyle(
                      fontSize: 11, fontWeight: FontWeight.w700,
                      color: _kInk2, letterSpacing: 0.5,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    _headerCount(groups[i].items),
                    style: const TextStyle(
                      fontSize: 11, fontWeight: FontWeight.w600,
                      color: _kInk3,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              decoration: BoxDecoration(
                color: _kCard,
                borderRadius: BorderRadius.circular(18),
                boxShadow: const [
                  BoxShadow(color: Color(0x0A1F1A14), blurRadius: 2, offset: Offset(0, 1)),
                ],
              ),
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  for (var j = 0; j < groups[i].items.length; j++) ...[
                    if (j > 0)
                      const Divider(height: 1, thickness: 1, color: _kHair, indent: 14, endIndent: 14),
                    _activityRow(groups[i].items[j]),
                  ],
                ],
              ),
            ),
          ],
          if (items.length >= 8 && hasAnyCheckIn) ...[
            const SizedBox(height: 18),
            Center(
              child: GestureDetector(
                onTap: onViewAll,
                behavior: HitTestBehavior.opaque,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: _kHair, width: 1.4),
                  ),
                  child: const Text(
                    'View all check-ins',
                    style: TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w600, color: _kInk,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _activityRow(_ActivityItem item) => switch (item) {
        _AttItem(:final attendance) => _AttRow(item: attendance),
        _XferItem(:final transfer)  => _TransferRow(item: transfer),
        _GrantItem(:final grant)    => _GrantRow(item: grant),
      };
}

class _MonthGroup {
  final String label;
  final List<_ActivityItem> items;
  _MonthGroup(this.label, this.items);
}

List<_MonthGroup> _groupByMonth(List<_ActivityItem> items) {
  final groups = <String, List<_ActivityItem>>{};
  final order = <String>[];
  final fmt = DateFormat('MMM yyyy');
  for (final a in items) {
    final key = fmt.format(a.timestamp);
    if (!groups.containsKey(key)) {
      groups[key] = [];
      order.add(key);
    }
    groups[key]!.add(a);
  }
  return order.map((k) => _MonthGroup(k, groups[k]!)).toList();
}

class _AttRow extends StatelessWidget {
  final Attendance item;
  const _AttRow({required this.item});

  bool get _isClass => item.isClassOrStudio;

  String get _name {
    // Prefer the structural name (class > studio > branch) so the row
    // always matches what the filter is keying off.
    if (item.className != null) return item.className!;
    if (item.studioName != null) return item.studioName!;
    if (item.branchName != null) return 'Club Entrance';
    if (item.method == 'manual') return 'Manual check-in';
    return item.accessPoint ?? 'Club Entrance';
  }

  bool get _isToday {
    final now = DateTime.now();
    return item.checkedInAt.year == now.year &&
        item.checkedInAt.month == now.month &&
        item.checkedInAt.day == now.day;
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 44, height: 44,
            decoration: BoxDecoration(
              color: _isClass ? _kPeach : const Color(0x0F1F1A14),
              borderRadius: BorderRadius.circular(14),
            ),
            alignment: Alignment.center,
            child: Icon(
              _isClass ? Icons.fitness_center_rounded : Icons.sensor_door_outlined,
              color: _kInk, size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _name,
                  maxLines: 2, overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 15, fontWeight: FontWeight.w600,
                    color: _kInk, letterSpacing: -0.1, height: 1.25,
                  ),
                ),
                const SizedBox(height: 3),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_isToday) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: _kPeach,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: const Text(
                          'TODAY',
                          style: TextStyle(
                            fontSize: 10, fontWeight: FontWeight.w700,
                            color: _kPrimaryDeep, letterSpacing: 0.3,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                    ],
                    Text(
                      DateFormat('EEE · MMM d, yyyy').format(item.checkedInAt),
                      style: const TextStyle(fontSize: 12, color: _kInk2),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Text(
            DateFormat('h:mm a').format(item.checkedInAt),
            style: const TextStyle(
              fontSize: 14, fontWeight: FontWeight.w600,
              color: _kInk, fontFeatures: [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}

/// Single transfer row — visually parallel to [_AttRow] so the unified
/// timeline reads as one list. Direction is conveyed only through the
/// icon's tint (orange = sent, green = received); the title carries the
/// count + counter-party name, and the right side shows the time exactly
/// like a check-in row.
class _TransferRow extends StatelessWidget {
  final TransferLog item;
  const _TransferRow({required this.item});

  bool get _isToday {
    final now = DateTime.now();
    return item.createdAt.year == now.year &&
        item.createdAt.month == now.month &&
        item.createdAt.day == now.day;
  }

  @override
  Widget build(BuildContext context) {
    final sent = item.isSent;
    final accent = sent ? _kPrimary : _kSuccess;
    final iconBg = sent ? const Color(0x1AE07A3B) : const Color(0x1A3F8B5C);
    final unit = item.count == 1 ? 'session' : 'sessions';
    final title = sent
        ? 'Sent ${item.count} $unit to ${item.otherName}'
        : 'Received ${item.count} $unit from ${item.otherName}';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 44, height: 44,
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(14),
            ),
            alignment: Alignment.center,
            child: Icon(
              sent ? Icons.north_east_rounded : Icons.south_west_rounded,
              color: accent, size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 2, overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 15, fontWeight: FontWeight.w600,
                    color: _kInk, letterSpacing: -0.1, height: 1.25,
                  ),
                ),
                const SizedBox(height: 3),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_isToday) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: _kPeach,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: const Text(
                          'TODAY',
                          style: TextStyle(
                            fontSize: 10, fontWeight: FontWeight.w700,
                            color: _kPrimaryDeep, letterSpacing: 0.3,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                    ],
                    Text(
                      DateFormat('EEE · MMM d, yyyy').format(item.createdAt),
                      style: const TextStyle(fontSize: 12, color: _kInk2),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Text(
            DateFormat('h:mm a').format(item.createdAt),
            style: const TextStyle(
              fontSize: 14, fontWeight: FontWeight.w600,
              color: _kInk, fontFeatures: [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}

/// Admin-granted sessions row — visually distinct with a gift/star icon in blue.
class _GrantRow extends StatelessWidget {
  final GrantLog item;
  const _GrantRow({required this.item});

  bool get _isToday {
    final now = DateTime.now();
    return item.createdAt.year == now.year &&
        item.createdAt.month == now.month &&
        item.createdAt.day == now.day;
  }

  @override
  Widget build(BuildContext context) {
    const accent = Color(0xFF7C5CFC);
    const iconBg = Color(0x1A7C5CFC);
    final unit = item.count == 1 ? 'session' : 'sessions';
    final byLine = item.grantedByName != null ? ' by ${item.grantedByName}' : '';
    final title = 'Added ${item.count} $unit$byLine';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 44, height: 44,
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(14),
            ),
            alignment: Alignment.center,
            child: const Icon(Icons.card_giftcard_rounded, color: accent, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 2, overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 15, fontWeight: FontWeight.w600,
                    color: _kInk, letterSpacing: -0.1, height: 1.25,
                  ),
                ),
                const SizedBox(height: 3),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_isToday) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: _kPeach,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: const Text(
                          'TODAY',
                          style: TextStyle(
                            fontSize: 10, fontWeight: FontWeight.w700,
                            color: _kPrimaryDeep, letterSpacing: 0.3,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                    ],
                    Text(
                      DateFormat('EEE · MMM d, yyyy').format(item.createdAt),
                      style: const TextStyle(fontSize: 12, color: _kInk2),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Text(
            DateFormat('h:mm a').format(item.createdAt),
            style: const TextStyle(
              fontSize: 14, fontWeight: FontWeight.w600,
              color: _kInk, fontFeatures: [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Empty / error / no-membership ───────────────────────────────────────────
class _EmptyHistory extends StatelessWidget {
  const _EmptyHistory();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.fromLTRB(22, 36, 22, 0),
      child: Column(
        children: [
          _PeachSquare(icon: Icons.event_available_outlined),
          SizedBox(height: 16),
          Text(
            'No attendance records found',
            style: TextStyle(
              fontSize: 17, fontWeight: FontWeight.w600,
              color: _kInk, letterSpacing: -0.2,
            ),
          ),
          SizedBox(height: 6),
          Text(
            'Try a different filter or scan to check in.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: _kInk2, height: 1.5),
          ),
        ],
      ),
    );
  }
}

class _PeachSquare extends StatelessWidget {
  final IconData icon;
  const _PeachSquare({required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 72, height: 72,
      decoration: BoxDecoration(
        color: _kPeach,
        borderRadius: BorderRadius.circular(22),
      ),
      alignment: Alignment.center,
      child: Icon(icon, color: _kInk, size: 32),
    );
  }
}

class _ErrorBlock extends StatelessWidget {
  final String error;
  final VoidCallback onRetry;
  const _ErrorBlock({required this.error, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(22, 36, 22, 0),
      child: Column(
        children: [
          const Icon(Icons.error_outline_rounded, size: 40, color: _kInk2),
          const SizedBox(height: 12),
          const Text(
            'Failed to load attendance',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: _kInk),
          ),
          const SizedBox(height: 6),
          Text(
            error,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 13, color: _kInk2),
          ),
          const SizedBox(height: 16),
          OutlinedButton(
            onPressed: onRetry,
            style: OutlinedButton.styleFrom(
              foregroundColor: _kInk,
              side: const BorderSide(color: _kHair, width: 1.4),
              shape: const StadiumBorder(),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            ),
            child: const Text('Retry', style: TextStyle(fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}

class _NoMembershipBody extends StatelessWidget {
  final bool isSuspended;
  final VoidCallback? onBrowse;
  const _NoMembershipBody({required this.isSuspended, required this.onBrowse});

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        const SizedBox(height: 6),
        _NoMembershipCard(isSuspended: isSuspended, onBrowse: onBrowse),
        const _NoMembershipHistory(),
      ],
    );
  }
}

class _NoMembershipCard extends StatelessWidget {
  final bool isSuspended;
  final VoidCallback? onBrowse;
  const _NoMembershipCard({required this.isSuspended, required this.onBrowse});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 22),
      decoration: BoxDecoration(
        color: _kCard,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: _kPeachDeep, width: 1.4),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          Positioned(
            right: -30, top: -30,
            child: Container(
              width: 110, height: 110,
              decoration: BoxDecoration(
                color: _kPeach.withValues(alpha: 0.55),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 20, 18, 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(
                    color: _kPeach,
                    borderRadius: BorderRadius.circular(13),
                  ),
                  alignment: Alignment.center,
                  child: Icon(
                    isSuspended ? Icons.pause_circle_outline_rounded : Icons.badge_outlined,
                    color: _kInk, size: 22,
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  isSuspended ? 'Membership suspended' : 'No active membership',
                  style: const TextStyle(
                    fontSize: 18, fontWeight: FontWeight.w600,
                    color: _kInk, letterSpacing: -0.3, height: 1.25,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  isSuspended
                      ? 'Your membership has been suspended. Contact the gym to resolve this.'
                      : 'Pick a plan to start checking in, booking classes, and tracking your attendance.',
                  style: const TextStyle(fontSize: 13, color: _kInk2, height: 1.55),
                ),
                if (!isSuspended && onBrowse != null) ...[
                  const SizedBox(height: 16),
                  GestureDetector(
                    onTap: onBrowse,
                    behavior: HitTestBehavior.opaque,
                    child: Container(
                      height: 48,
                      decoration: BoxDecoration(
                        color: _kPrimary,
                        borderRadius: BorderRadius.circular(14),
                        boxShadow: const [
                          BoxShadow(color: Color(0x52E07A3B), blurRadius: 16, offset: Offset(0, 6)),
                        ],
                      ),
                      alignment: Alignment.center,
                      child: const Text(
                        'Browse memberships',
                        style: TextStyle(
                          color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _NoMembershipHistory extends StatelessWidget {
  const _NoMembershipHistory();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(22, 28, 22, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(4, 0, 4, 10),
            child: Text(
              'CHECK-IN HISTORY',
              style: TextStyle(
                fontSize: 11, fontWeight: FontWeight.w700,
                color: _kInk2, letterSpacing: 0.5,
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.fromLTRB(22, 30, 22, 30),
            decoration: BoxDecoration(
              color: _kCard,
              borderRadius: BorderRadius.circular(18),
              boxShadow: const [
                BoxShadow(color: Color(0x0A1F1A14), blurRadius: 2, offset: Offset(0, 1)),
              ],
            ),
            child: const Column(
              children: [
                _GraySquare(icon: Icons.calendar_today_outlined),
                SizedBox(height: 14),
                Text(
                  'Nothing here yet',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _kInk),
                ),
                SizedBox(height: 4),
                Text(
                  'Once you start a membership, every check-in will show up right here.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12, color: _kInk2, height: 1.5),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _GraySquare extends StatelessWidget {
  final IconData icon;
  const _GraySquare({required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 56, height: 56,
      decoration: BoxDecoration(
        color: const Color(0x0F1F1A14),
        borderRadius: BorderRadius.circular(18),
      ),
      alignment: Alignment.center,
      child: Icon(icon, color: _kInk2, size: 26),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Date filter bottom sheet — From / To picker with calendar grid
// ─────────────────────────────────────────────────────────────────────────────
class _DateFilterSheet extends StatefulWidget {
  final _DateRange? initial;
  const _DateFilterSheet({required this.initial});

  @override
  State<_DateFilterSheet> createState() => _DateFilterSheetState();
}

class _DateFilterSheetState extends State<_DateFilterSheet> {
  late DateTime? _from;
  late DateTime? _to;
  bool _activeFrom = true;
  late DateTime _viewMonth;
  late final DateTime _today;
  late final DateTime _earliest;

  @override
  void initState() {
    super.initState();
    _today    = _stripTime(DateTime.now());
    _earliest = DateTime(_today.year, _today.month - 11, 1);
    _from = widget.initial?.from;
    _to   = widget.initial?.to;
    _viewMonth = DateTime((_from ?? _today).year, (_from ?? _today).month, 1);
  }

  static DateTime _stripTime(DateTime d) => DateTime(d.year, d.month, d.day);
  static bool _sameDay(DateTime? a, DateTime? b) =>
      a != null && b != null && a.year == b.year && a.month == b.month && a.day == b.day;
  bool _inRange(DateTime d) {
    if (_from == null || _to == null) return false;
    final from = _stripTime(_from!.isBefore(_to!) ? _from! : _to!);
    final to   = _stripTime(_from!.isBefore(_to!) ? _to! : _from!);
    return !d.isBefore(from) && !d.isAfter(to);
  }

  void _pickDate(DateTime d) {
    setState(() {
      if (_activeFrom) {
        if (_to != null && d.isAfter(_to!)) _to = null;
        _from = d;
        _activeFrom = false;
      } else {
        if (_from != null && d.isBefore(_from!)) {
          _to = _from;
          _from = d;
        } else {
          _to = d;
        }
      }
    });
  }

  void _reset() {
    setState(() {
      _from = null;
      _to = null;
      _activeFrom = true;
    });
  }

  void _apply() {
    if (_from == null) return;
    final to = _to ?? _from!;
    final from = _from!;
    Navigator.of(context).pop(_DateRange(
      from.isBefore(to) ? from : to,
      from.isBefore(to) ? to : from,
    ));
  }

  bool get _canPrev => _viewMonth.isAfter(_earliest);
  bool get _canNext =>
      _viewMonth.isBefore(DateTime(_today.year, _today.month, 1));

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final monthName = DateFormat('MMMM yyyy').format(_viewMonth);
    final firstWeekday = DateTime(_viewMonth.year, _viewMonth.month, 1).weekday % 7;
    final daysInMonth = DateUtils.getDaysInMonth(_viewMonth.year, _viewMonth.month);
    final cells = <DateTime?>[
      ...List.generate(firstWeekday, (_) => null),
      ...List.generate(daysInMonth, (i) => DateTime(_viewMonth.year, _viewMonth.month, i + 1)),
    ];

    return Container(
      decoration: const BoxDecoration(
        color: _kBg,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: EdgeInsets.fromLTRB(22, 12, 22, 22 + media.padding.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 36, height: 4,
              decoration: BoxDecoration(
                color: const Color(0x2D1F1A14),
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Filter by date',
                      style: TextStyle(
                        fontSize: 18, fontWeight: FontWeight.w600,
                        color: _kInk, letterSpacing: -0.3,
                      ),
                    ),
                    SizedBox(height: 3),
                    Text(
                      'Pick a from / to range.',
                      style: TextStyle(fontSize: 12, color: _kInk2),
                    ),
                  ],
                ),
              ),
              if (_from != null || _to != null)
                GestureDetector(
                  onTap: _reset,
                  behavior: HitTestBehavior.opaque,
                  child: const Padding(
                    padding: EdgeInsets.all(4),
                    child: Text(
                      'Reset',
                      style: TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w600,
                        color: _kPrimaryDeep,
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _FieldChip(
                  label: 'From',
                  value: _from,
                  active: _activeFrom,
                  onTap: () => setState(() => _activeFrom = true),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _FieldChip(
                  label: 'To',
                  value: _to,
                  active: !_activeFrom,
                  onTap: () => setState(() => _activeFrom = false),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 16),
            decoration: BoxDecoration(
              color: _kCard,
              borderRadius: BorderRadius.circular(18),
              boxShadow: const [
                BoxShadow(color: Color(0x0A1F1A14), blurRadius: 2, offset: Offset(0, 1)),
              ],
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    _MonthNavButton(
                      icon: Icons.chevron_left_rounded,
                      enabled: _canPrev,
                      onTap: () => setState(() => _viewMonth =
                          DateTime(_viewMonth.year, _viewMonth.month - 1, 1)),
                    ),
                    Expanded(
                      child: Center(
                        child: Text(
                          monthName,
                          style: const TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w600,
                            color: _kInk, letterSpacing: -0.1,
                          ),
                        ),
                      ),
                    ),
                    _MonthNavButton(
                      icon: Icons.chevron_right_rounded,
                      enabled: _canNext,
                      onTap: () => setState(() => _viewMonth =
                          DateTime(_viewMonth.year, _viewMonth.month + 1, 1)),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    for (final l in const ['S', 'M', 'T', 'W', 'T', 'F', 'S'])
                      Expanded(
                        child: Center(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            child: Text(
                              l,
                              style: const TextStyle(
                                fontSize: 10, fontWeight: FontWeight.w700,
                                color: _kInk3, letterSpacing: 0.5,
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: 7,
                  mainAxisSpacing: 4,
                  crossAxisSpacing: 4,
                  childAspectRatio: 1.0,
                  children: [
                    for (final d in cells)
                      if (d == null)
                        const SizedBox.shrink()
                      else
                        _DayCell(
                          date: d,
                          isFrom: _sameDay(d, _from),
                          isTo: _sameDay(d, _to),
                          inRange: _inRange(d),
                          isFuture: d.isAfter(_today),
                          onTap: () => _pickDate(d),
                        ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => Navigator.of(context).pop(),
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    height: 50,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: _kHair, width: 1.4),
                    ),
                    alignment: Alignment.center,
                    child: const Text(
                      'Cancel',
                      style: TextStyle(
                        fontSize: 14, fontWeight: FontWeight.w600, color: _kInk,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: GestureDetector(
                  onTap: _from == null ? null : _apply,
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    height: 50,
                    decoration: BoxDecoration(
                      color: _from == null ? const Color(0x1F1F1A14) : _kPrimary,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: _from == null
                          ? const []
                          : const [BoxShadow(color: Color(0x52E07A3B), blurRadius: 16, offset: Offset(0, 6))],
                    ),
                    alignment: Alignment.center,
                    child: const Text(
                      'Apply',
                      style: TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _FieldChip extends StatelessWidget {
  final String label;
  final DateTime? value;
  final bool active;
  final VoidCallback onTap;
  const _FieldChip({
    required this.label,
    required this.value,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final v = value;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: active ? _kPeach : _kCard,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: active ? _kPrimary : Colors.transparent, width: 1.6),
          boxShadow: active
              ? const [BoxShadow(color: Color(0x2DE07A3B), blurRadius: 14, offset: Offset(0, 4))]
              : const [BoxShadow(color: Color(0x0A1F1A14), blurRadius: 2, offset: Offset(0, 1))],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label.toUpperCase(),
              style: const TextStyle(
                fontSize: 10, fontWeight: FontWeight.w700,
                color: _kInk2, letterSpacing: 0.5,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              v == null ? 'Select date' : DateFormat('MMM d, yyyy').format(v),
              style: TextStyle(
                fontSize: 14, fontWeight: FontWeight.w600,
                color: v == null ? _kInk3 : _kInk, letterSpacing: -0.1,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MonthNavButton extends StatelessWidget {
  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;
  const _MonthNavButton({required this.icon, required this.enabled, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1 : 0.4,
      child: GestureDetector(
        onTap: enabled ? onTap : null,
        behavior: HitTestBehavior.opaque,
        child: Container(
          width: 32, height: 32,
          decoration: const BoxDecoration(
            color: Color(0x0D1F1A14),
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Icon(icon, size: 20, color: _kInk),
        ),
      ),
    );
  }
}

class _DayCell extends StatelessWidget {
  final DateTime date;
  final bool isFrom;
  final bool isTo;
  final bool inRange;
  final bool isFuture;
  final VoidCallback onTap;
  const _DayCell({
    required this.date,
    required this.isFrom,
    required this.isTo,
    required this.inRange,
    required this.isFuture,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final selected = isFrom || isTo;
    final mid = inRange && !selected;
    return GestureDetector(
      onTap: isFuture ? null : onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        decoration: BoxDecoration(
          color: selected ? _kPrimary : (mid ? _kPeach : Colors.transparent),
          borderRadius: BorderRadius.circular(10),
        ),
        alignment: Alignment.center,
        child: Text(
          '${date.day}',
          style: TextStyle(
            fontSize: 13,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected
                ? Colors.white
                : isFuture ? _kInk3 : _kInk,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
      ),
    );
  }
}
