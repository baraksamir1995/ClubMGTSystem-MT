import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../features/store_events/store_events_ui.dart';
import '../models/event_model.dart';

void openEventDetail(BuildContext context, GymEvent e) =>
    context.push('/events/${e.id}', extra: e);

/// Horizontal-rail card (Explore): cover, title, date, price / status.
class EventCard extends StatelessWidget {
  final GymEvent event;
  final double width;

  const EventCard({super.key, required this.event, this.width = 250});

  @override
  Widget build(BuildContext context) {
    final e = event;
    final reg = e.isRegistered ? e.myRegistration : null;
    return GestureDetector(
      onTap: () => openEventDetail(context, e),
      child: Container(
        width: width,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: kSeHair),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: SizedBox(
                width: double.infinity,
                child: networkImageOrPlaceholder(
                  context,
                  e.imageUrl,
                  icon: Icons.event_rounded,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    e.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: kSeInk,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    formatEventDate(context, e.startsAt),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12, color: kSeInk2),
                  ),
                  const SizedBox(height: 8),
                  reg != null
                      ? EventStatusPill(status: reg.status)
                      : EventPricePill(event: e),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Compact row (Home strip, events list): date block, title, place, pill.
class EventListTile extends StatelessWidget {
  final GymEvent event;

  const EventListTile({super.key, required this.event});

  @override
  Widget build(BuildContext context) {
    final e = event;
    final primary = Theme.of(context).colorScheme.primary;
    final reg = e.isRegistered ? e.myRegistration : null;
    final locale = Localizations.localeOf(context).toLanguageTag();
    String month = '';
    String day = '';
    final start = e.startsAt;
    if (start != null) {
      day = '${start.day}';
      try {
        month = DateFormat('MMM', locale).format(start);
      } catch (_) {
        month = DateFormat('MMM').format(start);
      }
    }

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => openEventDetail(context, e),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: kSeHair),
          ),
          child: Row(
            children: [
              Container(
                width: 52,
                height: 56,
                decoration: BoxDecoration(
                  color: kSePeach,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      month.toUpperCase(),
                      maxLines: 1,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: primary,
                        letterSpacing: 0.4,
                      ),
                    ),
                    Text(
                      day,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: kSeInk,
                        height: 1.1,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      e.title,
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
                        formatEventDate(context, e.startsAt),
                        if ((e.location ?? '').trim().isNotEmpty) e.location!.trim(),
                      ].join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12, color: kSeInk2),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              reg != null
                  ? EventStatusPill(status: reg.status)
                  : EventPricePill(event: e),
            ],
          ),
        ),
      ),
    );
  }
}
