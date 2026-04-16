import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/attendance_model.dart';
import '../services/api_service.dart';
import 'package:provider/provider.dart';
import '../utils/error_utils.dart';

class AttendanceHistoryScreen extends StatefulWidget {
  final String memberId;
  const AttendanceHistoryScreen({super.key, required this.memberId});

  @override
  State<AttendanceHistoryScreen> createState() =>
      _AttendanceHistoryScreenState();
}

class _AttendanceHistoryScreenState extends State<AttendanceHistoryScreen> {
  final _service = ApiService();
  final _scrollController = ScrollController();

  List<Attendance> _records = [];
  bool _isLoading = false;
  bool _hasMore = true;
  static const _pageSize = 20;

  // Filters
  DateTime? _from;
  DateTime? _to;
  String? _type; // null=all, 'gym', 'class', 'manual'

  @override
  void initState() {
    super.initState();
    _load(reset: true);
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
            _scrollController.position.maxScrollExtent - 200 &&
        !_isLoading &&
        _hasMore) {
      _load();
    }
  }

  Future<void> _load({bool reset = false}) async {
    if (_isLoading) return;
    setState(() => _isLoading = true);

    final offset = reset ? 0 : _records.length;
    try {
      final results = await _service.getAttendanceHistory(
        widget.memberId,
        limit: _pageSize,
        offset: offset,
        from: _from,
        to: _to != null
            ? DateTime(_to!.year, _to!.month, _to!.day, 23, 59, 59)
            : null,
        type: _type,
      );
      setState(() {
        if (reset) { _records = results; } else { _records.addAll(results); }
        _hasMore = results.length == _pageSize;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(friendlyError(e)),
              backgroundColor: Theme.of(context).colorScheme.error,
              behavior: SnackBarBehavior.floating),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _pickDate(bool isFrom) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: isFrom ? (_from ?? now) : (_to ?? now),
      firstDate: DateTime(2020),
      lastDate: now,
    );
    if (picked == null) return;
    setState(() {
      if (isFrom) { _from = picked; } else { _to = picked; }
    });
    _load(reset: true);
  }

  void _clearFilters() {
    setState(() {
      _from = null;
      _to = null;
      _type = null;
    });
    _load(reset: true);
  }

  bool get _hasActiveFilters => _from != null || _to != null || _type != null;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final primary = Theme.of(context).colorScheme.primary;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Attendance History',
            style: TextStyle(fontWeight: FontWeight.w700)),
        backgroundColor: theme.colorScheme.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Divider(height: 1, thickness: 1,
              color: theme.colorScheme.outline.withValues(alpha: 0.12)),
        ),
        actions: [
          if (_hasActiveFilters)
            TextButton(
              onPressed: _clearFilters,
              child: Text('Clear', style: TextStyle(color: primary)),
            ),
        ],
      ),
      body: Column(
        children: [
          // ── Filters bar ──────────────────────────────────────────
          Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Column(
              children: [
                // Type chips
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _typeChip('All', null, primary),
                      const SizedBox(width: 8),
                      _typeChip('Gym Entrance', 'gym', primary),
                      const SizedBox(width: 8),
                      _typeChip('Classes', 'class', primary),
                      const SizedBox(width: 8),
                      _typeChip('Manual', 'manual', primary),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
                // Date range row
                Row(
                  children: [
                    Expanded(
                      child: _datePicker(
                          label: _from != null
                              ? DateFormat('MMM d, yyyy').format(_from!)
                              : 'From date',
                          icon: Icons.calendar_today_outlined,
                          onTap: () => _pickDate(true),
                          active: _from != null,
                          primary: primary,
                          theme: theme),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _datePicker(
                          label: _to != null
                              ? DateFormat('MMM d, yyyy').format(_to!)
                              : 'To date',
                          icon: Icons.calendar_today_outlined,
                          onTap: () => _pickDate(false),
                          active: _to != null,
                          primary: primary,
                          theme: theme),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Divider(height: 1, color: theme.colorScheme.outline.withValues(alpha: 0.12)),

          // ── List ─────────────────────────────────────────────────
          Expanded(
            child: _records.isEmpty && !_isLoading
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.directions_run,
                            size: 48,
                            color: theme.colorScheme.onSurfaceVariant
                                .withValues(alpha: 0.4)),
                        const SizedBox(height: 12),
                        Text('No check-ins found',
                            style: theme.textTheme.titleSmall?.copyWith(
                                color: theme.colorScheme.onSurfaceVariant)),
                      ],
                    ),
                  )
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                    itemCount: _records.length + (_isLoading ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (index == _records.length) {
                        return const Padding(
                          padding: EdgeInsets.all(16),
                          child: Center(child: CircularProgressIndicator()),
                        );
                      }
                      final record = _records[index];
                      return _buildItem(context, theme, record, primary);
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _typeChip(String label, String? value, Color primary) {
    final selected = _type == value;
    return GestureDetector(
      onTap: () {
        setState(() => _type = value);
        _load(reset: true);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? primary : primary.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? Colors.white : primary,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  Widget _datePicker({
    required String label,
    required IconData icon,
    required VoidCallback onTap,
    required bool active,
    required Color primary,
    required ThemeData theme,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          color: active
              ? primary.withValues(alpha: 0.1)
              : theme.colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(10),
          border: active ? Border.all(color: primary.withValues(alpha: 0.4)) : null,
        ),
        child: Row(
          children: [
            Icon(icon, size: 14,
                color: active ? primary : theme.colorScheme.onSurfaceVariant),
            const SizedBox(width: 6),
            Expanded(
              child: Text(label,
                  style: theme.textTheme.bodySmall?.copyWith(
                      color: active ? primary : theme.colorScheme.onSurfaceVariant,
                      fontWeight: active ? FontWeight.w600 : null),
                  overflow: TextOverflow.ellipsis),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildItem(BuildContext context, ThemeData theme,
      Attendance record, Color primary) {
    final isToday = _isToday(record.checkedInAt);
    final isGymEntrance = record.accessPoint == 'Gym Main Entrance';
    final isClass = record.method == 'qr' && !isGymEntrance;
    final isManual = record.method == 'manual';

    final label = isManual
        ? 'Manual Check-in'
        : isGymEntrance
            ? 'Gym Entrance'
            : isClass
                ? record.accessPoint ?? 'Class'
                : 'Check-in';

    final icon = isManual
        ? Icons.edit_outlined
        : isGymEntrance
            ? Icons.sensor_door_outlined
            : isClass
                ? Icons.fitness_center_outlined
                : Icons.check_circle_outline;

    final iconColor = isGymEntrance
        ? primary
        : isClass
            ? Colors.orange
            : isManual
                ? theme.colorScheme.onSurfaceVariant
                : primary;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: iconColor, size: 20),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      DateFormat('EEE, MMM d, yyyy').format(record.checkedInAt),
                      style: theme.textTheme.bodyMedium
                          ?.copyWith(fontWeight: FontWeight.w600),
                    ),
                    Text(
                      DateFormat('h:mm a').format(record.checkedInAt),
                      style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant),
                    ),
                    const SizedBox(height: 2),
                    Text(label,
                        style: theme.textTheme.labelSmall?.copyWith(
                            color: iconColor, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
              if (isToday)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text('Today',
                      style: TextStyle(
                          color: primary,
                          fontSize: 11,
                          fontWeight: FontWeight.w600)),
                ),
            ],
          ),
        ),
      ),
    );
  }

  bool _isToday(DateTime date) {
    final now = DateTime.now();
    return date.year == now.year &&
        date.month == now.month &&
        date.day == now.day;
  }
}
