import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../models/event_model.dart';
import 'store_events_ui.dart';

// Event cover art shared by the Home carousel, the Explore rail card and
// the event detail header, so an event looks the same everywhere — photo
// when there is one, the gym's brand colour when there isn't.

/// The event's photo (cached), or [EventCoverFallback] when it has none or
/// it fails to load. Brand colour shows while loading — no white flash.
class EventCoverImage extends StatelessWidget {
  final GymEvent event;
  final bool showNumeral;

  const EventCoverImage({super.key, required this.event, this.showNumeral = true});

  @override
  Widget build(BuildContext context) {
    final url = (event.imageUrl ?? '').trim();
    final fallback = EventCoverFallback(event: event, showNumeral: showNumeral);
    if (url.isEmpty) return fallback;
    return CachedNetworkImage(
      key: const ValueKey('event-cover-image'),
      imageUrl: url,
      fit: BoxFit.cover,
      fadeInDuration: const Duration(milliseconds: 250),
      placeholder: (context, _) =>
          ColoredBox(color: Theme.of(context).colorScheme.primary),
      errorWidget: (_, _, _) => fallback,
    );
  }
}

/// Peach month + day tile, the same block the events list uses, sized for
/// a card corner.
class EventDateTile extends StatelessWidget {
  final DateTime? date;
  const EventDateTile({super.key, required this.date});

  @override
  Widget build(BuildContext context) {
    final d = date;
    if (d == null) return const SizedBox.shrink();
    final primary = Theme.of(context).colorScheme.primary;
    return Container(
      key: const ValueKey('event-date-tile'),
      width: 46,
      padding: const EdgeInsets.symmetric(vertical: 6),
      decoration: BoxDecoration(
        color: kSePeach,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            eventMonthAbbr(context, d).toUpperCase(),
            maxLines: 1,
            overflow: TextOverflow.clip,
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
              color: primary,
              letterSpacing: 0.5,
              height: 1.1,
            ),
          ),
          Text(
            '${d.day}',
            style: const TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.w800,
              color: kSeInk,
              height: 1.15,
            ),
          ),
        ],
      ),
    );
  }
}

/// "Dec" / "ديسمبر" in the active locale.
String eventMonthAbbr(BuildContext context, DateTime d) {
  final locale = Localizations.localeOf(context).toLanguageTag();
  try {
    return DateFormat('MMM', locale).format(d);
  } catch (_) {
    return DateFormat('MMM').format(d);
  }
}

/// Cover for an event without a photo (or whose photo failed): the gym's
/// brand colour, flat, with the day number set large and quiet in the
/// trailing corner. No icon, no gradient.
class EventCoverFallback extends StatelessWidget {
  final GymEvent event;

  /// The oversized day numeral (off for the event-detail header, which
  /// shows the full date right below it).
  final bool showNumeral;

  const EventCoverFallback({super.key, required this.event, this.showNumeral = true});

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final onBrand = ThemeData.estimateBrightnessForColor(primary) == Brightness.dark
        ? Colors.white
        : kSeInk;
    final d = event.startsAt;
    return ColoredBox(
      key: const ValueKey('event-cover-fallback'),
      color: primary,
      child: (showNumeral && d != null)
          ? Stack(
              clipBehavior: Clip.hardEdge,
              children: [
                PositionedDirectional(
                  end: -6,
                  top: -30,
                  child: Text(
                    '${d.day}',
                    style: TextStyle(
                      fontSize: 132,
                      fontWeight: FontWeight.w800,
                      height: 1,
                      letterSpacing: -6,
                      color: onBrand.withValues(alpha: 0.13),
                    ),
                  ),
                ),
              ],
            )
          : const SizedBox.expand(),
    );
  }
}
