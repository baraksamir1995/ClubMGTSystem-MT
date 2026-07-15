import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:clby/l10n/l10n.dart';
import '../features/branches/branch_provider.dart';
import '../models/session_model.dart';
import '../providers/auth_provider.dart';
import '../providers/member_provider.dart';
import '../screens/session_detail_screen.dart';
import '../widgets/gym_app_bar.dart';
import '../widgets/session_card.dart';
import '../widgets/shimmer_loader.dart';
import '../services/notification_service.dart';
import '../widgets/screen_refresh_indicator.dart';

class ScheduleScreen extends StatefulWidget {
  const ScheduleScreen({super.key});

  @override
  State<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends State<ScheduleScreen> {
  String? _loadingSessionId;
  DateTime _selectedDate = DateTime.now();
  bool _searchVisible = false;

  // Filters
  final _searchController = TextEditingController();
  String _searchQuery = '';
  String? _filterClassType; // null = All classes
  String? _filterInstructor;
  String? _filterTimeOfDay;
  String? _filterLocation;
  String? _filterBranchId; // null = All branches

  late final List<DateTime> _dateRange = List.generate(30, (i) {
    final d = DateTime.now();
    return DateTime(d.year, d.month, d.day + i);
  });

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadSessions();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadSessions({bool forceRefresh = false}) async {
    final authProvider = context.read<AuthProvider>();
    final memberProvider = context.read<MemberProvider>();

    // AppBootstrap already loaded sessions during splash.
    // Skip initial load to prevent shimmer flash; only load if forced
    // (e.g., pull-to-refresh) or if bootstrap didn't run.
    if (!forceRefresh && memberProvider.isBootstrapped) return;

    final gymId = authProvider.profile?.gymId;
    if (gymId != null) {
      await memberProvider.ensureMemberLoaded(gymId);
      await memberProvider.loadSessions(gymId);
    }
  }

  Future<void> _book(String sessionId) async {
    final memberProvider = context.read<MemberProvider>();
    final session =
        memberProvider.sessions.where((s) => s.id == sessionId).firstOrNull;
    setState(() => _loadingSessionId = sessionId);
    try {
      await memberProvider.bookSession(sessionId);
      if (session != null && mounted) {
        NotificationService().showBookingConfirmedNotification(
          session.className ?? context.l10n.bookingsClassFallback,
          session.scheduledAt,
        );
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(context.l10n.scheduleBookedSuccess),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      rethrow;
    } finally {
      if (mounted) setState(() => _loadingSessionId = null);
    }
  }

  Future<void> _cancel(String bookingId) async {
    final authProvider = context.read<AuthProvider>();
    final gymId = authProvider.profile?.gymId ?? '';
    final memberProvider = context.read<MemberProvider>();
    setState(() => _loadingSessionId = bookingId);
    try {
      await memberProvider.cancelBooking(bookingId, gymId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(context.l10n.scheduleBookingCancelled),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      rethrow;
    } finally {
      if (mounted) setState(() => _loadingSessionId = null);
    }
  }

  void _cancelFromCard(String bookingId) {
    _cancel(bookingId).catchError((e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(context.l10n.scheduleCancelFailed),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    });
  }

  void _openDetail(Session session, List<Session> daySessions) {
    final others = daySessions.where((s) => s.id != session.id).toList();
    final now = DateTime.now();
    final hasEnded = session.endTime != null &&
        session.endTime!.isBefore(now);
    final isAttended = session.bookingStatus == 'attended';
    final canBook = !session.isBooked && !hasEnded && !isAttended;

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => SessionDetailScreen(
          session: session,
          onBook: canBook ? () => _book(session.id) : null,
          onCancel: session.bookingId != null && !isAttended
              ? () => _cancel(session.bookingId!)
              : null,
          otherSessions: others,
        ),
      ),
    );
  }

  bool get _hasActiveFilters =>
      _searchQuery.isNotEmpty ||
      _filterClassType != null ||
      _filterInstructor != null ||
      _filterTimeOfDay != null ||
      _filterLocation != null ||
      _filterBranchId != null;

  List<Session> _applyFilters(List<Session> sessions) {
    return sessions.where((s) {
      if (_searchQuery.isNotEmpty) {
        final q = _searchQuery.toLowerCase();
        final matchesName =
            s.className?.toLowerCase().contains(q) ?? false;
        final matchesInstructor =
            s.instructor?.toLowerCase().contains(q) ?? false;
        final matchesLocation =
            s.location?.toLowerCase().contains(q) ?? false;
        if (!matchesName && !matchesInstructor && !matchesLocation) {
          return false;
        }
      }
      if (_filterClassType != null && s.classType != _filterClassType) {
        return false;
      }
      if (_filterInstructor != null && s.instructor != _filterInstructor) {
        return false;
      }
      if (_filterTimeOfDay != null) {
        final hour = s.scheduledAt.hour;
        if (_filterTimeOfDay == 'morning' && (hour < 6 || hour >= 12)) {
          return false;
        }
        if (_filterTimeOfDay == 'afternoon' && (hour < 12 || hour >= 17)) {
          return false;
        }
        if (_filterTimeOfDay == 'evening' && (hour < 17 || hour >= 22)) {
          return false;
        }
      }
      if (_filterLocation != null && s.location != _filterLocation) {
        return false;
      }
      if (_filterBranchId != null && s.branchId != _filterBranchId) {
        return false;
      }
      return true;
    }).toList();
  }

  void _clearFilters() {
    setState(() {
      _searchController.clear();
      _searchQuery = '';
      _filterClassType = null;
      _filterInstructor = null;
      _filterTimeOfDay = null;
      _filterLocation = null;
      _filterBranchId = null;
    });
  }

  void _openFilterSheet(
      BuildContext context, List<Session> allSessions, Color primaryColor) {
    final types = allSessions
        .map((s) => s.classType)
        .whereType<String>()
        .toSet()
        .toList()
      ..sort();
    final instructors = allSessions
        .map((s) => s.instructor)
        .whereType<String>()
        .toSet()
        .toList()
      ..sort();
    final locations = allSessions
        .map((s) => s.location)
        .whereType<String>()
        .toSet()
        .toList()
      ..sort();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _FilterSheet(
        primaryColor: primaryColor,
        availableTypes: types,
        availableInstructors: instructors,
        availableLocations: locations,
        selectedType: _filterClassType,
        selectedInstructor: _filterInstructor,
        selectedTimeOfDay: _filterTimeOfDay,
        selectedLocation: _filterLocation,
        onApply: (type, instructor, timeOfDay, location) {
          setState(() {
            _filterClassType = type;
            _filterInstructor = instructor;
            _filterTimeOfDay = timeOfDay;
            _filterLocation = location;
          });
        },
        onClear: _clearFilters,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();
    final memberProvider = context.watch<MemberProvider>();
    final branchProvider = context.watch<BranchProvider>();
    final gym = authProvider.gym;

    final primaryColor = Theme.of(context).colorScheme.primary;

    // Derive class types from loaded sessions for filter chips
    final classTypes = memberProvider.sessions
        .map((s) => s.classType)
        .whereType<String>()
        .toSet()
        .toList()
      ..sort();

    // Dates that have sessions (for dot indicators)
    final sessionDates = memberProvider.sessions.map((s) {
      final d = s.scheduledAt;
      return '${d.year}-${d.month}-${d.day}';
    }).toSet();

    // Sessions for selected day
    final daysSessions = memberProvider.sessions.where((s) {
      final d = s.scheduledAt;
      return d.year == _selectedDate.year &&
          d.month == _selectedDate.month &&
          d.day == _selectedDate.day;
    }).toList();

    final filteredSessions = _applyFilters(daysSessions);

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      appBar: GymAppBar(
        gym: gym,
        fallbackTitle: context.l10n.scheduleTitle,
        greeting: context.l10n.scheduleTitle,
        greetingStyle: const TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w800,
          color: Color(0xFF1D1D1B),
        ),
        showNotificationBell: false,
        actions: [
          _AppBarIconButton(
            icon: Icons.calendar_month_outlined,
            backgroundColor: primaryColor.withValues(alpha: 0.12),
            iconColor: primaryColor,
            onTap: () => context.push('/my-bookings'),
          ),
          const SizedBox(width: 6),
          _AppBarIconButton(
            icon: Icons.tune_outlined,
            showBadge: _hasActiveFilters,
            onTap: () => _openFilterSheet(
                context, memberProvider.sessions, primaryColor),
          ),
        ],
      ),
      body: ScreenRefreshIndicator(
        onRefresh: () => _loadSessions(forceRefresh: true),
        icon: Icons.calendar_month_rounded,
        color: primaryColor,
        child: Column(
          children: [
            // Search bar (animated)
            AnimatedSize(
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeInOut,
              child: _searchVisible
                  ? _buildSearchBar(primaryColor)
                  : const SizedBox.shrink(),
            ),
            // Date strip
            _buildDateStrip(primaryColor, sessionDates),
            // Branch chips (only when gym has multiple branches)
            if (branchProvider.isMultiBranch)
              _buildBranchChips(branchProvider, primaryColor),
            // Quick filter chips
            if (classTypes.isNotEmpty)
              _buildFilterChips(classTypes, primaryColor),
            // Selected day label
            _buildDayLabel(context, filteredSessions.length),
            // Divider
            Divider(
              height: 1,
              thickness: 1,
              color: Theme.of(context)
                  .colorScheme
                  .outline
                  .withValues(alpha: 0.10),
            ),
            // Sessions list
            Expanded(
              child: memberProvider.isLoadingSessions
                  ? Padding(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                      child: BrandedSkeletonList.fromContext(context, itemCount: 4, itemHeight: 110),
                    )
                  : memberProvider.sessionsError != null
                      ? _buildError(context, memberProvider.sessionsError!)
                      : filteredSessions.isEmpty
                          ? _buildEmpty(
                              context, daysSessions.isEmpty, primaryColor)
                          : ListView.builder(
                              physics:
                                  const AlwaysScrollableScrollPhysics(),
                              padding:
                                  const EdgeInsets.fromLTRB(16, 16, 16, 24),
                              itemCount: filteredSessions.length,
                              itemBuilder: (context, index) {
                                final session = filteredSessions[index];
                                return Padding(
                                  padding: const EdgeInsets.only(bottom: 12),
                                  child: SessionCard(
                                    session: session,
                                    isLoading: _loadingSessionId == session.id,
                                    onBook: !session.isBooked &&
                                            session.bookingStatus != 'attended' &&
                                            !(session.endTime != null &&
                                                session.endTime!.isBefore(DateTime.now()))
                                        ? () => _book(session.id)
                                        : null,
                                    onCancel: session.bookingId != null &&
                                            session.bookingStatus != 'attended'
                                        ? () => _cancelFromCard(
                                            session.bookingId!)
                                        : null,
                                    onTap: () => _openDetail(session, daysSessions),
                                  ),
                                );
                              },
                            ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Search bar ────────────────────────────────────────────────────────────

  Widget _buildSearchBar(Color primaryColor) {
    final theme = Theme.of(context);
    return Container(
      color: theme.colorScheme.surface,
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
      child: TextField(
        controller: _searchController,
        autofocus: true,
        onChanged: (v) => setState(() => _searchQuery = v),
        decoration: InputDecoration(
          hintText: context.l10n.scheduleSearchHint,
          hintStyle: TextStyle(
            color: theme.colorScheme.onSurfaceVariant,
            fontSize: 14,
          ),
          prefixIcon: Icon(
            Icons.search,
            size: 20,
            color: theme.colorScheme.onSurfaceVariant,
          ),
          suffixIcon: _searchQuery.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.close, size: 18),
                  onPressed: () {
                    _searchController.clear();
                    setState(() => _searchQuery = '');
                  },
                )
              : null,
          isDense: true,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(
              color: theme.colorScheme.outline.withValues(alpha: 0.2),
            ),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(
              color: theme.colorScheme.outline.withValues(alpha: 0.2),
            ),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(
              color: theme.colorScheme.outline.withValues(alpha: 0.4),
            ),
          ),
          filled: true,
          fillColor: theme.colorScheme.surfaceContainerHighest
              .withValues(alpha: 0.5),
        ),
      ),
    );
  }

  // ─── Date strip ────────────────────────────────────────────────────────────

  Widget _buildDateStrip(Color primaryColor, Set<String> sessionDates) {
    final theme = Theme.of(context);

    return Container(
      color: theme.colorScheme.surface,
      height: 88,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        itemCount: _dateRange.length,
        itemBuilder: (context, index) {
          final date = _dateRange[index];
          final isSelected = date.year == _selectedDate.year &&
              date.month == _selectedDate.month &&
              date.day == _selectedDate.day;

          final dateKey = '${date.year}-${date.month}-${date.day}';
          final hasClasses = sessionDates.contains(dateKey);

          return GestureDetector(
            onTap: () => setState(() => _selectedDate = date),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 54,
              margin: const EdgeInsets.symmetric(horizontal: 4),
              decoration: BoxDecoration(
                color: isSelected
                    ? const Color(0xFF1D1D1B)
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isSelected
                      ? const Color(0xFF1D1D1B)
                      : primaryColor.withValues(alpha: 0.45),
                  width: 1.2,
                ),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    DateFormat('EEE').format(date),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: isSelected
                          ? Colors.white
                          : theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    '${date.day}',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: isSelected
                          ? Colors.white
                          : theme.colorScheme.onSurface,
                      height: 1.1,
                    ),
                  ),
                  const SizedBox(height: 3),
                  // Class dot
                  Container(
                    width: 4,
                    height: 4,
                    decoration: BoxDecoration(
                      color: hasClasses
                          ? (isSelected
                              ? Colors.white.withValues(alpha: 0.75)
                              : primaryColor)
                          : Colors.transparent,
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // ─── Quick filter chips ────────────────────────────────────────────────────

  Widget _buildDayLabel(BuildContext context, int classCount) {
    final theme = Theme.of(context);
    final label = DateFormat('EEE, MMM d, yyyy').format(_selectedDate);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
      child: Row(
        children: [
          Text(
            label,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurface,
              fontWeight: FontWeight.w700,
              fontSize: 15,
            ),
          ),
          if (classCount > 0) ...[
            Text(
              ' · ',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
                fontSize: 15,
              ),
            ),
            Text(
              context.l10n.scheduleClassCount(classCount),
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
                fontWeight: FontWeight.w600,
                fontSize: 15,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildBranchChips(BranchProvider branchProvider, Color primaryColor) {
    final theme = Theme.of(context);
    return Container(
      color: theme.colorScheme.surface,
      height: 44,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        children: [
          _QuickChip(
            label: context.l10n.scheduleAllBranches,
            selected: _filterBranchId == null,
            primaryColor: primaryColor,
            onTap: () => setState(() => _filterBranchId = null),
          ),
          const SizedBox(width: 8),
          ...branchProvider.branches.map((branch) {
            final selected = _filterBranchId == branch.id;
            return Padding(
              padding: const EdgeInsetsDirectional.only(end: 8),
              child: _QuickChip(
                label: branch.name,
                selected: selected,
                primaryColor: primaryColor,
                onTap: () => setState(
                  () => _filterBranchId = selected ? null : branch.id,
                ),
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildFilterChips(List<String> classTypes, Color primaryColor) {
    final theme = Theme.of(context);
    return Container(
      color: theme.colorScheme.surface,
      height: 48,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        children: [
          _QuickChip(
            label: context.l10n.scheduleAllClasses,
            selected: _filterClassType == null,
            primaryColor: primaryColor,
            onTap: () => setState(() => _filterClassType = null),
          ),
          const SizedBox(width: 8),
          ...classTypes.map((type) {
            final selected = _filterClassType == type;
            return Padding(
              padding: const EdgeInsetsDirectional.only(end: 8),
              child: _QuickChip(
                label: _capitalize(type),
                selected: selected,
                primaryColor: primaryColor,
                onTap: () => setState(
                  () => _filterClassType = selected ? null : type,
                ),
              ),
            );
          }),
        ],
      ),
    );
  }

  // ─── Empty / Error states ──────────────────────────────────────────────────

  Widget _buildEmpty(
      BuildContext context, bool noClassesOnDay, Color primaryColor) {
    final theme = Theme.of(context);

    if (noClassesOnDay && !_hasActiveFilters) {
      return SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
          // ── Illustration (smaller) ────────────────────────────────────────
          const SizedBox(height: 4),
          const _RestIllustration(),

          const SizedBox(height: 12),

          // ── Headline ─────────────────────────────────────────────────────
          Text(
            context.l10n.scheduleRestDayTitle,
            textAlign: TextAlign.center,
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w800,
              color: theme.colorScheme.onSurface,
              height: 1.2,
            ),
          ),

          const SizedBox(height: 6),

          // ── Subtitle (single line) ────────────────────────────────────────
          Text(
            context.l10n.scheduleRestDaySubtitle,
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
              height: 1.4,
            ),
          ),

          const SizedBox(height: 14),

          // ── CTA rows ─────────────────────────────────────────────────────
          _EmptyCta(
            iconWidget: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: const Color(0xFFFFF3E8),
                borderRadius: BorderRadius.circular(9),
              ),
              child: const Icon(
                Icons.bar_chart_rounded,
                size: 18,
                color: Color(0xFFE08430),
              ),
            ),
            title: context.l10n.scheduleCtaStatsTitle,
            subtitle: context.l10n.scheduleCtaStatsSubtitle,
            onTap: () => context.push('/profile'),
          ),

          const SizedBox(height: 8),

          _EmptyCta(
            iconWidget: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: const Color(0xFFFDE8F0),
                borderRadius: BorderRadius.circular(9),
              ),
              child: const Icon(
                Icons.star_outline_rounded,
                size: 18,
                color: Color(0xFFD4437E),
              ),
            ),
            title: context.l10n.scheduleCtaOffersTitle,
            subtitle: context.l10n.scheduleCtaOffersSubtitle,
            onTap: () => context.push('/explore/memberships'),
          ),
        ],
        ),
      ),
      );
    }

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      child: Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.filter_list_off,
            size: 56,
            color: theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.4),
          ),
          const SizedBox(height: 14),
          Text(
            context.l10n.scheduleNoMatchFilters,
            style: theme.textTheme.titleMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 10),
          TextButton(
            onPressed: _clearFilters,
            child: Text(context.l10n.scheduleClearFilters,
                style: TextStyle(color: primaryColor)),
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
            Icon(Icons.error_outline,
                size: 48, color: theme.colorScheme.error),
            const SizedBox(height: 16),
            Text(context.l10n.scheduleLoadFailed,
                style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(
              error,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: _loadSessions,
              style:
                  OutlinedButton.styleFrom(minimumSize: const Size(0, 44)),
              child: Text(context.l10n.commonRetry),
            ),
          ],
        ),
      ),
    );
  }

  String _capitalize(String s) =>
      s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
}


// ─── Rest day illustration ────────────────────────────────────────────────────

class _RestIllustration extends StatelessWidget {
  const _RestIllustration();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 140,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Ambient dots
          PositionedDirectional(
            top: 20,
            start: 60,
            child: _Dot(size: 8, color: const Color(0xFF9FDCF5)),
          ),
          PositionedDirectional(
            top: 30,
            end: 55,
            child: _Dot(size: 6, color: const Color(0xFF9FDCF5)),
          ),
          PositionedDirectional(
            top: 55,
            end: 40,
            child: _Dot(size: 5, color: const Color(0xFF8EE8C8)),
          ),
          PositionedDirectional(
            top: 15,
            end: 90,
            child: _Dot(size: 4, color: const Color(0xFFF5C842)),
          ),

          // Shadow / platform
          Positioned(
            bottom: 10,
            child: Container(
              width: 140,
              height: 18,
              decoration: BoxDecoration(
                color: const Color(0xFFE2E0D8),
                borderRadius: BorderRadius.circular(50),
              ),
            ),
          ),

          // Kettlebell body
          Positioned(
            bottom: 16,
            child: Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                color: const Color(0xFF1D1D1B),
                shape: BoxShape.circle,
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Eyes
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _Eye(),
                      const SizedBox(width: 14),
                      _Eye(),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // Left handle arm
          PositionedDirectional(
            bottom: 84,
            start: 88,
            child: Container(
              width: 28,
              height: 10,
              decoration: BoxDecoration(
                color: const Color(0xFF1D1D1B),
                borderRadius: BorderRadius.circular(5),
              ),
            ),
          ),

          // Right handle arm
          PositionedDirectional(
            bottom: 84,
            end: 88,
            child: Container(
              width: 28,
              height: 10,
              decoration: BoxDecoration(
                color: const Color(0xFF1D1D1B),
                borderRadius: BorderRadius.circular(5),
              ),
            ),
          ),

          // Handle arc (top)
          Positioned(
            bottom: 118,
            child: CustomPaint(
              size: const Size(60, 36),
              painter: _ArcPainter(color: const Color(0xFFF5C842)),
            ),
          ),

          // Handle knob top
          Positioned(
            bottom: 150,
            child: _Dot(size: 12, color: const Color(0xFFF5C842)),
          ),
        ],
      ),
    );
  }
}

class _Dot extends StatelessWidget {
  final double size;
  final Color color;
  const _Dot({required this.size, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }
}

class _Eye extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 18,
      height: 18,
      decoration: const BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
      ),
      child: Center(
        child: Container(
          width: 10,
          height: 10,
          decoration: const BoxDecoration(
            color: Color(0xFF3B5BDB),
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Container(
              width: 4,
              height: 4,
              decoration: const BoxDecoration(
                color: Color(0xFF1D1D1B),
                shape: BoxShape.circle,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ArcPainter extends CustomPainter {
  final Color color;
  const _ArcPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 10
      ..strokeCap = StrokeCap.round;
    final rect = Rect.fromLTWH(0, 0, size.width, size.height * 2);
    canvas.drawArc(rect, 3.14159, 3.14159, false, paint);
  }

  @override
  bool shouldRepaint(_ArcPainter old) => old.color != color;
}

// ─── Empty state CTA row ──────────────────────────────────────────────────────

class _EmptyCta extends StatelessWidget {
  final Widget iconWidget;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _EmptyCta({
    required this.iconWidget,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: theme.colorScheme.outline.withValues(alpha: 0.12),
          ),
        ),
        child: Row(
          children: [
            iconWidget,
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: theme.colorScheme.onSurface,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Icon(
              Icons.chevron_right,
              size: 20,
              color: theme.colorScheme.onSurfaceVariant
                  .withValues(alpha: 0.5),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── App bar icon button ──────────────────────────────────────────────────────

class _AppBarIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  final bool showBadge;
  final Color? backgroundColor;
  final Color? iconColor;

  const _AppBarIconButton({
    required this.icon,
    required this.onTap,
    this.showBadge = false,
    this.backgroundColor,
    this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hasBg = backgroundColor != null;
    return GestureDetector(
      onTap: onTap,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: backgroundColor ?? Colors.transparent,
              border: hasBg
                  ? null
                  : Border.all(
                      color: theme.colorScheme.outline.withValues(alpha: 0.2),
                    ),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              icon,
              size: 18,
              color: iconColor ?? theme.colorScheme.onSurface,
            ),
          ),
          if (showBadge)
            PositionedDirectional(
              end: -2,
              top: -2,
              child: Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: const Color(0xFFE24B4A),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 1.5),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ─── Quick filter chip ────────────────────────────────────────────────────────

class _QuickChip extends StatelessWidget {
  final String label;
  final bool selected;
  final Color primaryColor;
  final VoidCallback onTap;

  const _QuickChip({
    required this.label,
    required this.selected,
    required this.primaryColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
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
            color: selected
                ? Colors.white
                : theme.colorScheme.onSurface,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

// ─── Filter bottom sheet ──────────────────────────────────────────────────────

class _FilterSheet extends StatefulWidget {
  final Color primaryColor;
  final List<String> availableTypes;
  final List<String> availableInstructors;
  final List<String> availableLocations;
  final String? selectedType;
  final String? selectedInstructor;
  final String? selectedTimeOfDay;
  final String? selectedLocation;
  final void Function(
          String? type, String? instructor, String? timeOfDay, String? location)
      onApply;
  final VoidCallback onClear;

  const _FilterSheet({
    required this.primaryColor,
    required this.availableTypes,
    required this.availableInstructors,
    required this.availableLocations,
    required this.selectedType,
    required this.selectedInstructor,
    required this.selectedTimeOfDay,
    required this.selectedLocation,
    required this.onApply,
    required this.onClear,
  });

  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  String? _type;
  String? _instructor;
  String? _timeOfDay;
  String? _location;

  @override
  void initState() {
    super.initState();
    _type = widget.selectedType;
    _instructor = widget.selectedInstructor;
    _timeOfDay = widget.selectedTimeOfDay;
    _location = widget.selectedLocation;
  }

  bool get _hasChanges =>
      _type != null ||
      _instructor != null ||
      _timeOfDay != null ||
      _location != null;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final primary = widget.primaryColor;

    return Container(
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(
          24, 0, 24, MediaQuery.of(context).padding.bottom + 24),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 12, bottom: 20),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: theme.colorScheme.outlineVariant,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  context.l10n.scheduleFilterClasses,
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (_hasChanges)
                  TextButton(
                    onPressed: () {
                      setState(() {
                        _type = null;
                        _instructor = null;
                        _timeOfDay = null;
                        _location = null;
                      });
                    },
                    child: Text(
                      context.l10n.scheduleReset,
                      style: TextStyle(color: theme.colorScheme.error),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 20),

            if (widget.availableTypes.isNotEmpty) ...[
              _SectionLabel(context.l10n.scheduleClassType),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: widget.availableTypes.map((t) {
                  final selected = _type == t;
                  return _FilterChip(
                    label: _capitalize(t),
                    selected: selected,
                    primaryColor: primary,
                    onTap: () =>
                        setState(() => _type = selected ? null : t),
                  );
                }).toList(),
              ),
              const SizedBox(height: 20),
            ],

            _SectionLabel(context.l10n.scheduleTimeOfDay),
            const SizedBox(height: 10),
            Row(
              children: [
                _TimeChip(
                  icon: Icons.wb_sunny_outlined,
                  label: context.l10n.scheduleMorning,
                  sublabel: context.l10n.scheduleMorningRange,
                  value: 'morning',
                  selected: _timeOfDay == 'morning',
                  primaryColor: primary,
                  onTap: () => setState(() =>
                      _timeOfDay = _timeOfDay == 'morning' ? null : 'morning'),
                ),
                const SizedBox(width: 8),
                _TimeChip(
                  icon: Icons.wb_cloudy_outlined,
                  label: context.l10n.scheduleAfternoon,
                  sublabel: context.l10n.scheduleAfternoonRange,
                  value: 'afternoon',
                  selected: _timeOfDay == 'afternoon',
                  primaryColor: primary,
                  onTap: () => setState(() => _timeOfDay =
                      _timeOfDay == 'afternoon' ? null : 'afternoon'),
                ),
                const SizedBox(width: 8),
                _TimeChip(
                  icon: Icons.nights_stay_outlined,
                  label: context.l10n.scheduleEvening,
                  sublabel: context.l10n.scheduleEveningRange,
                  value: 'evening',
                  selected: _timeOfDay == 'evening',
                  primaryColor: primary,
                  onTap: () => setState(() =>
                      _timeOfDay = _timeOfDay == 'evening' ? null : 'evening'),
                ),
              ],
            ),
            const SizedBox(height: 20),

            if (widget.availableInstructors.isNotEmpty) ...[
              _SectionLabel(context.l10n.scheduleTrainer),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: widget.availableInstructors.map((i) {
                  final selected = _instructor == i;
                  return _FilterChip(
                    label: i,
                    selected: selected,
                    primaryColor: primary,
                    onTap: () => setState(
                        () => _instructor = selected ? null : i),
                  );
                }).toList(),
              ),
              const SizedBox(height: 20),
            ],

            if (widget.availableLocations.isNotEmpty) ...[
              _SectionLabel(context.l10n.scheduleLocation),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: widget.availableLocations.map((l) {
                  final selected = _location == l;
                  return _FilterChip(
                    label: l,
                    selected: selected,
                    primaryColor: primary,
                    onTap: () => setState(
                        () => _location = selected ? null : l),
                  );
                }).toList(),
              ),
              const SizedBox(height: 20),
            ],

            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                  textStyle: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                onPressed: () {
                  widget.onApply(_type, _instructor, _timeOfDay, _location);
                  Navigator.of(context).pop();
                },
                child: Text(context.l10n.scheduleApplyFilters),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _capitalize(String s) =>
      s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
}

// ─── Helper widgets ───────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: Theme.of(context).textTheme.labelLarge?.copyWith(
            fontWeight: FontWeight.w700,
          ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final Color primaryColor;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.selected,
    required this.primaryColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected
              ? primaryColor
              : primaryColor.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected
                ? primaryColor
                : primaryColor.withValues(alpha: 0.2),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? Colors.white : primaryColor,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

class _TimeChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final String sublabel;
  final String value;
  final bool selected;
  final Color primaryColor;
  final VoidCallback onTap;

  const _TimeChip({
    required this.icon,
    required this.label,
    required this.sublabel,
    required this.value,
    required this.selected,
    required this.primaryColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: selected
                ? primaryColor
                : primaryColor.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected
                  ? primaryColor
                  : primaryColor.withValues(alpha: 0.2),
            ),
          ),
          child: Column(
            children: [
              Icon(
                icon,
                size: 20,
                color: selected
                    ? Colors.white
                    : theme.colorScheme.onSurfaceVariant,
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color:
                      selected ? Colors.white : theme.colorScheme.onSurface,
                ),
              ),
              Text(
                sublabel,
                style: TextStyle(
                  fontSize: 10,
                  color: selected
                      ? Colors.white.withValues(alpha: 0.8)
                      : theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
