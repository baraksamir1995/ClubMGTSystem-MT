import 'package:flutter/material.dart';
import 'package:clby/l10n/l10n.dart';
import '../../services/api_service.dart';
import '../../utils/error_utils.dart';

class GuestGymInfoScreen extends StatefulWidget {
  const GuestGymInfoScreen({super.key});

  @override
  State<GuestGymInfoScreen> createState() => _GuestGymInfoScreenState();
}

class _GuestGymInfoScreenState extends State<GuestGymInfoScreen> {
  Map<String, dynamic>? _gymData;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadGymInfo();
  }

  Future<void> _loadGymInfo() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final data = await ApiService().getGymSettings();
      if (data == null) throw Exception('Gym not found');
      setState(() => _gymData = data);
    } catch (e) {
      setState(() => _error = friendlyError(e));
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final primary = Theme.of(context).colorScheme.primary;

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _loadGymInfo,
        color: primary,
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Text(_error!, style: TextStyle(color: theme.colorScheme.error)))
                : _gymData == null
                    ? Center(child: Text(context.l10n.guestGymInfoEmpty))
                    : _buildContent(context, theme, primary),
      ),
    );
  }

  Widget _buildContent(BuildContext context, ThemeData theme, Color primary) {
    final d = _gymData!;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Header card
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        color: primary.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Icon(Icons.fitness_center, color: primary, size: 28),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Text(d['name'] ?? '',
                          style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                    ),
                  ],
                ),
                if (d['description'] != null) ...[
                  const SizedBox(height: 16),
                  Text(d['description'],
                      style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant)),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),

        // Contact & Location
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(context.l10n.guestGymInfoContactLocation,
                    style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 14),
                if (d['address'] != null)
                  _infoRow(theme, Icons.location_on_outlined, d['address'], primary),
                if (d['phone'] != null)
                  _infoRow(theme, Icons.phone_outlined, d['phone'], primary),
                if (d['email'] != null)
                  _infoRow(theme, Icons.email_outlined, d['email'], primary),
              ],
            ),
          ),
        ),

        // Operating Hours
        if (d['operating_hours'] != null) ...[
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(context.l10n.guestGymInfoOperatingHours,
                      style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 14),
                  ..._buildHoursRows(theme, d['operating_hours'], primary),
                ],
              ),
            ),
          ),
        ],

        const SizedBox(height: 24),
      ],
    );
  }

  Widget _infoRow(ThemeData theme, IconData icon, String text, Color primary) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Icon(icon, size: 18, color: primary),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: theme.textTheme.bodyMedium)),
        ],
      ),
    );
  }

  /// Handles both array and map shapes of the operating_hours JSONB.
  List<Widget> _buildHoursRows(ThemeData theme, dynamic hours, Color primary) {
    final l10n = context.l10n;
    final dayNames = [
      l10n.guestGymInfoDayMonday,
      l10n.guestGymInfoDayTuesday,
      l10n.guestGymInfoDayWednesday,
      l10n.guestGymInfoDayThursday,
      l10n.guestGymInfoDayFriday,
      l10n.guestGymInfoDaySaturday,
      l10n.guestGymInfoDaySunday,
    ];
    const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    if (hours is Map) {
      // e.g. {"monday": {"open": "06:00", "close": "22:00"}, ...}
      //   or {"monday": "06:00 - 22:00", ...}
      //   or {"monday": "Closed", ...}
      return dayKeys.asMap().entries.map((entry) {
        final key = entry.key;
        final day = entry.value;
        final val = hours[day];
        if (val == null) return const SizedBox.shrink();
        String timeStr;
        bool isClosed = false;
        if (val is Map) {
          isClosed = val['closed'] == true || val['is_closed'] == true;
          if (isClosed) {
            timeStr = l10n.guestGymInfoClosed;
          } else {
            final open = val['open'] ?? val['open_time'] ?? '';
            final close = val['close'] ?? val['close_time'] ?? '';
            timeStr = '$open – $close';
          }
        } else {
          timeStr = val.toString();
          isClosed = timeStr.toLowerCase() == 'closed';
          if (isClosed) timeStr = l10n.guestGymInfoClosed;
        }
        return _hoursRow(theme, dayNames[key], timeStr, isClosed);
      }).toList();
    }

    if (hours is List) {
      // e.g. [{"day": "Monday", "open": "06:00", "close": "22:00"}, ...]
      return hours.map<Widget>((h) {
        if (h is! Map) return const SizedBox.shrink();
        final day = h['day']?.toString() ?? '';
        final isClosed = h['closed'] == true || h['is_closed'] == true;
        final timeStr = isClosed
            ? l10n.guestGymInfoClosed
            : '${h['open'] ?? h['open_time'] ?? ''} – ${h['close'] ?? h['close_time'] ?? ''}';
        return _hoursRow(theme, day, timeStr, isClosed);
      }).toList();
    }

    // Fallback: plain text
    return [Text(hours.toString(), style: theme.textTheme.bodyMedium)];
  }

  Widget _hoursRow(ThemeData theme, String day, String time, bool isClosed) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          SizedBox(
            width: 96,
            child: Text(day,
                style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
          ),
          Text(
            time,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: isClosed ? theme.colorScheme.error : theme.colorScheme.onSurface,
            ),
          ),
        ],
      ),
    );
  }
}
