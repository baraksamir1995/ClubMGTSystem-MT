import 'package:flutter/material.dart';
import 'package:clby/l10n/l10n.dart';
import 'package:intl/intl.dart';
import '../../models/session_model.dart' as session_model;
import '../../services/api_service.dart';
import '../../widgets/session_card.dart';
import '../../widgets/shimmer_loader.dart';
import '../../widgets/guest_register_prompt.dart';
import '../../core/config/app_config.dart';
import '../../utils/error_utils.dart';

class GuestScheduleScreen extends StatefulWidget {
  const GuestScheduleScreen({super.key});

  @override
  State<GuestScheduleScreen> createState() => _GuestScheduleScreenState();
}

class _GuestScheduleScreenState extends State<GuestScheduleScreen> {
  List<session_model.Session> _sessions = [];
  bool _isLoading = true;
  String? _error;
  DateTime _selectedDate = DateTime.now();

  late final List<DateTime> _dateRange = List.generate(30, (i) {
    final d = DateTime.now();
    return DateTime(d.year, d.month, d.day + i);
  });

  @override
  void initState() {
    super.initState();
    _loadSessions();
  }

  Future<void> _loadSessions() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final sessions = await ApiService().getUpcomingSessions(AppConfig.gymId);
      setState(() => _sessions = sessions);
    } catch (e) {
      setState(() => _error = friendlyError(e));
    } finally {
      setState(() => _isLoading = false);
    }
  }

  List<session_model.Session> get _daysSessions {
    return _sessions.where((s) {
      final d = s.scheduledAt;
      return d.year == _selectedDate.year &&
          d.month == _selectedDate.month &&
          d.day == _selectedDate.day;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _loadSessions,
        color: primary,
        child: Column(
          children: [
            _buildDateStrip(primary),
            Expanded(child: _buildBody(primary)),
          ],
        ),
      ),
    );
  }

  Widget _buildDateStrip(Color primary) {
    final theme = Theme.of(context);
    return Container(
      height: 72,
      color: theme.colorScheme.surface,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        itemCount: _dateRange.length,
        itemBuilder: (context, index) {
          final date = _dateRange[index];
          final isSelected = date.year == _selectedDate.year &&
              date.month == _selectedDate.month &&
              date.day == _selectedDate.day;
          return GestureDetector(
            onTap: () => setState(() => _selectedDate = date),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 48,
              margin: const EdgeInsets.symmetric(horizontal: 4),
              decoration: BoxDecoration(
                color: isSelected
                    ? primary
                    : primary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
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
                  const SizedBox(height: 2),
                  Text(
                    '${date.day}',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: isSelected
                          ? Colors.white
                          : theme.colorScheme.onSurface,
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

  Widget _buildBody(Color primary) {
    if (_isLoading) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: ShimmerListLoader(itemCount: 4, itemHeight: 130),
      );
    }
    if (_error != null) {
      return _buildError(primary);
    }
    final sessions = _daysSessions;
    if (sessions.isEmpty) {
      return _buildEmpty();
    }
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      itemCount: sessions.length,
      itemBuilder: (context, index) {
        final session = sessions[index];
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: SessionCard(
            session: session,
            onTap: () => showGuestRegisterPrompt(context),
          ),
        );
      },
    );
  }

  Widget _buildEmpty() {
    final theme = Theme.of(context);
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.event_available_outlined,
            size: 64,
            color: theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.4),
          ),
          const SizedBox(height: 16),
          Text(
            context.l10n.guestScheduleNoClasses,
            style: theme.textTheme.titleMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            context.l10n.guestScheduleTryDifferentDate,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildError(Color primary) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 48, color: theme.colorScheme.error),
            const SizedBox(height: 16),
            Text(context.l10n.guestScheduleLoadFailed, style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(
              _error!,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: _loadSessions,
              style: OutlinedButton.styleFrom(minimumSize: const Size(0, 44)),
              child: Text(context.l10n.commonRetry),
            ),
          ],
        ),
      ),
    );
  }
}
