import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:clby/l10n/l10n.dart';

import '../../models/event_model.dart';
import '../../widgets/event_card.dart' show openEventDetail;
import 'event_cover.dart';
import 'store_events_ui.dart';

/// Home screen events carousel (App Layout key `events`).
///
/// Full-bleed cover cards in a snapping [PageView] that shows a slice of the
/// next card. Visual language is borrowed from the rest of Home rather than
/// invented here:
///  • 22 px radius + ink bottom scrim + white 18/w700 title — the banner card.
///  • Peach month/day tile — the events list tile ([EventListTile]).
///  • Low-seat / full badge colours — the "Today's classes" spots badge.
///  • Stretching-pill page dots — the banner carousel, one size smaller.
///
/// Renders nothing when [events] is empty, so the section collapses.
class HomeEventsCarousel extends StatefulWidget {
  final List<GymEvent> events;

  /// Fraction of the row each card takes; the rest is the next card peeking.
  final double viewportFraction;

  const HomeEventsCarousel({
    super.key,
    required this.events,
    this.viewportFraction = 0.86,
  });

  /// How many upcoming events Home shows before "See all".
  static const maxItems = 5;

  /// At or below this many seats a "N seats left" badge appears.
  static const lowSeatThreshold = 5;

  @override
  State<HomeEventsCarousel> createState() => _HomeEventsCarouselState();
}

class _HomeEventsCarouselState extends State<HomeEventsCarousel> {
  late PageController _controller;
  int _page = 0;

  @override
  void initState() {
    super.initState();
    _controller = PageController(viewportFraction: widget.viewportFraction);
  }

  @override
  void didUpdateWidget(HomeEventsCarousel old) {
    super.didUpdateWidget(old);
    if (old.viewportFraction != widget.viewportFraction) {
      _controller.dispose();
      _controller = PageController(viewportFraction: widget.viewportFraction);
      _page = 0;
    } else if (_page >= widget.events.length && widget.events.isNotEmpty) {
      // A refresh dropped events past the current page.
      _page = widget.events.length - 1;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final events = widget.events;
    if (events.isEmpty) return const SizedBox.shrink();

    return LayoutBuilder(builder: (context, constraints) {
      final pageWidth = constraints.maxWidth * widget.viewportFraction;
      // A touch taller than 16:9 so a two-line title never crowds the date
      // tile, clamped for tablets / tiny phones.
      final height = (pageWidth * 0.62).clamp(176.0, 280.0);

      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: height,
            child: PageView.builder(
              key: const ValueKey('home-events-pageview'),
              controller: _controller,
              // First card sits flush with the section header; the next
              // one peeks from the trailing edge (mirrored in RTL — PageView
              // follows the ambient Directionality).
              padEnds: false,
              itemCount: events.length,
              onPageChanged: (i) => setState(() => _page = i),
              itemBuilder: (context, i) => Padding(
                // Gutter between cards; the last card keeps it too so its
                // edge lines up with where the previous ones ended.
                padding: const EdgeInsetsDirectional.only(end: 10),
                child: HomeEventCard(event: events[i]),
              ),
            ),
          ),
          if (events.length > 1) ...[
            const SizedBox(height: 10),
            _PageDots(count: events.length, index: _page),
          ],
        ],
      );
    });
  }
}

/// One carousel card. Public so other screens / tests can use it directly.
class HomeEventCard extends StatelessWidget {
  final GymEvent event;
  const HomeEventCard({super.key, required this.event});

  static const _radius = 22.0;

  @override
  Widget build(BuildContext context) {
    final e = event;
    final primary = Theme.of(context).colorScheme.primary;
    final hasImage = (e.imageUrl ?? '').trim().isNotEmpty;

    // Text sits on the scrim (image) or straight on the brand colour
    // (no image). A pale brand colour gets ink text instead of white.
    final onBrand = ThemeData.estimateBrightnessForColor(primary) == Brightness.dark
        ? Colors.white
        : kSeInk;
    final fg = hasImage ? Colors.white : onBrand;

    final price = e.isPaid
        ? formatMoney(context, e.price, e.currency)
        : context.l10n.eventsFree;
    final when = _weekdayTime(context, e.startsAt);
    final meta = [
      if (when.isNotEmpty) when,
      if ((e.location ?? '').trim().isNotEmpty) e.location!.trim(),
    ].join(' · ');

    return Semantics(
      button: true,
      label: [e.title, formatEventDate(context, e.startsAt), price].join(', '),
      excludeSemantics: true,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(_radius),
        child: Stack(
          fit: StackFit.expand,
          children: [
            EventCoverImage(event: e),

            // Restrained scrim — bottom ~60% only, ink not black, so the
            // photo still reads as a photo.
            if (hasImage)
              Align(
                alignment: Alignment.bottomCenter,
                child: FractionallySizedBox(
                  heightFactor: 0.58,
                  widthFactor: 1,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                        colors: [
                          kSeInk.withValues(alpha: 0.74),
                          kSeInk.withValues(alpha: 0),
                        ],
                      ),
                    ),
                  ),
                ),
              ),

            Padding(
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      EventDateTile(date: e.startsAt),
                      const Spacer(),
                      ?_statusBadge(context, e),
                    ],
                  ),
                  const Spacer(),
                  Text(
                    e.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: fg,
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      height: 1.2,
                      letterSpacing: -0.3,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Expanded(
                        child: Text(
                          meta,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: fg.withValues(alpha: 0.78),
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        price,
                        key: const ValueKey('home-event-price'),
                        style: TextStyle(
                          color: fg,
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // Ripple on top of everything, clipped by the ClipRRect.
            Positioned.fill(
              child: Material(
                type: MaterialType.transparency,
                child: InkWell(
                  onTap: () => openEventDetail(context, e),
                  splashColor: Colors.white.withValues(alpha: 0.12),
                  highlightColor: Colors.white.withValues(alpha: 0.06),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Registered / payment pending wins; otherwise only flag scarcity.
  Widget? _statusBadge(BuildContext context, GymEvent e) {
    final l = context.l10n;
    if (e.isRegistered) {
      final pending = e.myRegistration!.isPendingPayment;
      return _Badge(
        key: const ValueKey('home-event-registered'),
        label: pending ? l.eventsStatusPaymentProcessing : l.eventsStatusRegistered,
        icon: pending ? Icons.hourglass_top_rounded : Icons.check_rounded,
        bg: pending ? kSeWarn : kSeSuccess,
      );
    }
    final left = e.seatsLeft;
    if (left == null) return null;
    if (left <= 0) {
      return _Badge(
        key: const ValueKey('home-event-full'),
        label: l.eventsFull,
        bg: const Color(0xFFB91C1C),
      );
    }
    if (left <= HomeEventsCarousel.lowSeatThreshold) {
      return _Badge(
        key: const ValueKey('home-event-low-seats'),
        label: l.eventsSeatsLeft(left),
        bg: const Color(0xFFC2410C),
      );
    }
    return null;
  }

  /// "Sat · 6:00 PM" — the day number + month already sit in the tile.
  static String _weekdayTime(BuildContext context, DateTime? dt) {
    if (dt == null) return '';
    final locale = Localizations.localeOf(context).toLanguageTag();
    try {
      return '${DateFormat('EEE', locale).format(dt)} · '
          '${DateFormat('h:mm a', locale).format(dt)}';
    } catch (_) {
      return '${DateFormat('EEE').format(dt)} · ${DateFormat('h:mm a').format(dt)}';
    }
  }
}

class _Badge extends StatelessWidget {
  final String label;
  final IconData? icon;
  final Color bg;

  const _Badge({super.key, required this.label, required this.bg, this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: Colors.white),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }
}

/// Banner-carousel dots, one size down: active stretches into a pill.
class _PageDots extends StatelessWidget {
  final int count;
  final int index;
  const _PageDots({required this.count, required this.index});

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return Row(
      key: const ValueKey('home-events-dots'),
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (var i = 0; i < count; i++)
          AnimatedContainer(
            key: ValueKey('home-events-dot-$i'),
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOut,
            margin: const EdgeInsets.symmetric(horizontal: 3),
            width: i == index ? 16 : 6,
            height: 6,
            decoration: BoxDecoration(
              color: i == index ? primary : kSeInk.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(999),
            ),
          ),
      ],
    );
  }
}
