import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'package:clby/l10n/l10n.dart';

import '../features/store_events/events_provider.dart';
import '../features/store_events/store_events_ui.dart';
import '../models/event_model.dart';
import '../services/api_service.dart';
import '../widgets/event_card.dart';

/// All upcoming events ("See all" from Explore / Home).
class EventsScreen extends StatefulWidget {
  const EventsScreen({super.key});

  @override
  State<EventsScreen> createState() => _EventsScreenState();
}

class _EventsScreenState extends State<EventsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<EventsProvider>().load(force: true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<EventsProvider>();
    final theme = Theme.of(context);
    final events = provider.events;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text(context.l10n.eventsTitle),
        centerTitle: true,
        actions: [
          IconButton(
            tooltip: context.l10n.eventsMyEvents,
            icon: const Icon(Icons.confirmation_number_outlined),
            onPressed: () => context.push('/my-events'),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: theme.colorScheme.primary,
        onRefresh: () => provider.load(force: true),
        child: (!provider.isLoaded && provider.isLoading)
            ? const Center(child: CircularProgressIndicator())
            : events.isEmpty
                ? _Empty(text: context.l10n.eventsEmpty)
                : ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                    itemCount: events.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (_, i) => EventListTile(event: events[i]),
                  ),
      ),
    );
  }
}

/// The member's own registrations (`/api/me/event-registrations`).
class MyEventsScreen extends StatefulWidget {
  const MyEventsScreen({super.key});

  @override
  State<MyEventsScreen> createState() => _MyEventsScreenState();
}

class _MyEventsScreenState extends State<MyEventsScreen> {
  final _api = ApiService();
  List<EventRegistrationSummary> _rows = [];
  bool _loading = true;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = _rows.isEmpty;
      _error = null;
    });
    try {
      final rows = await _api.getMyEventRegistrations();
      if (!mounted) return;
      setState(() {
        _rows = rows;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  void _open(EventRegistrationSummary r) {
    final ev = context.read<EventsProvider>().byId(r.eventId);
    // Past events drop out of /events; only upcoming ones have a detail view.
    if (ev == null && r.isPast) return;
    context.push('/events/${r.eventId}', extra: ev).then((_) {
      if (mounted) _load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    Widget body;
    if (_loading) {
      body = const Center(child: CircularProgressIndicator());
    } else if (_error != null && _rows.isEmpty) {
      body = _Empty(
        text: storeEventsErrorMessage(context, _error!),
        action: TextButton(onPressed: _load, child: Text(context.l10n.commonRetry)),
      );
    } else if (_rows.isEmpty) {
      body = _Empty(text: context.l10n.eventsMyEmpty);
    } else {
      final upcoming = _rows.where((r) => !r.isPast).toList()
        ..sort((a, b) => (a.startsAt ?? DateTime(0)).compareTo(b.startsAt ?? DateTime(0)));
      final past = _rows.where((r) => r.isPast).toList();
      body = ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          if (upcoming.isNotEmpty) ...[
            _Heading(context.l10n.eventsUpcoming),
            for (final r in upcoming) _RegistrationTile(row: r, onTap: () => _open(r)),
          ],
          if (past.isNotEmpty) ...[
            const SizedBox(height: 8),
            _Heading(context.l10n.eventsPast),
            for (final r in past) _RegistrationTile(row: r, onTap: null),
          ],
        ],
      );
    }

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(title: Text(context.l10n.eventsMyEvents), centerTitle: true),
      body: RefreshIndicator(
        color: theme.colorScheme.primary,
        onRefresh: () async {
          await Future.wait([
            _load(),
            context.read<EventsProvider>().load(force: true),
          ]);
        },
        child: body,
      ),
    );
  }
}

class _Heading extends StatelessWidget {
  final String text;
  const _Heading(this.text);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 4, 4, 10),
        child: Text(
          text,
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: kSeInk),
        ),
      );
}

class _RegistrationTile extends StatelessWidget {
  final EventRegistrationSummary row;
  final VoidCallback? onTap;

  const _RegistrationTile({required this.row, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    Widget pill;
    if (row.isPast) {
      pill = SePill(
        label: row.attended ? l10n.eventsAttended : l10n.eventsEnded,
        fg: row.attended ? kSeSuccess : kSeMuted,
        bg: row.attended ? kSeSuccessBg : kSeMuted.withValues(alpha: 0.12),
      );
    } else {
      pill = EventStatusPill(status: row.status);
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: kSeHair),
            ),
            child: Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: SizedBox(
                    width: 56,
                    height: 56,
                    child: networkImageOrPlaceholder(
                      context,
                      row.imageUrl,
                      icon: Icons.event_rounded,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        row.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: kSeInk,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        [
                          formatEventDate(context, row.startsAt),
                          if (row.configurationName != null) row.configurationName!,
                        ].join(' · '),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12, color: kSeInk2),
                      ),
                      const SizedBox(height: 6),
                      pill,
                    ],
                  ),
                ),
                if (onTap != null)
                  const Icon(Icons.chevron_right_rounded, color: kSeInk2),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  final String text;
  final Widget? action;
  const _Empty({required this.text, this.action});

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 80),
      children: [
        const Icon(Icons.event_busy_rounded, size: 44, color: kSeInk2),
        const SizedBox(height: 12),
        Text(
          text,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 14, color: kSeInk2),
        ),
        if (action != null) Center(child: action),
      ],
    );
  }
}
