import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:clby/features/store_events/home_events_carousel.dart';
import 'package:clby/l10n/l10n.dart';
import 'package:clby/models/app_layout.dart';
import 'package:clby/models/event_model.dart';
import 'package:clby/utils/theme.dart';

const _brand = Color(0xFF1F4E79);

GymEvent _event(
  String id, {
  String? imageUrl,
  bool paid = false,
  int? priceCents,
  int? seatsLeft,
  String? regStatus,
  DateTime? startsAt,
}) =>
    GymEvent(
      id: id,
      title: 'Event $id',
      imageUrl: imageUrl,
      startsAt: startsAt ?? DateTime(2030, 12, 6, 18),
      isPaid: paid,
      priceCents: priceCents,
      seatsLeft: seatsLeft,
      capacity: seatsLeft == null ? null : 20,
      myRegistration: regStatus == null
          ? null
          : MyEventRegistration(id: 'r$id', status: regStatus, paymentStatus: 'na'),
    );

/// Pumps [child] the way Home hosts it: localized, brand-themed, inside the
/// 16 px page padding, with a router so taps can navigate.
Future<void> _pump(
  WidgetTester tester,
  Widget child, {
  Locale locale = const Locale('en'),
}) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  final router = GoRouter(routes: [
    GoRoute(
      path: '/',
      builder: (_, _) => Scaffold(
        body: Padding(padding: const EdgeInsets.all(16), child: child),
      ),
    ),
    GoRoute(
      path: '/events/:id',
      builder: (_, s) => Scaffold(body: Text('detail ${s.pathParameters['id']}')),
    ),
  ]);
  await tester.pumpWidget(MaterialApp.router(
    routerConfig: router,
    theme: AppTheme.buildTheme(_brand),
    locale: locale,
    supportedLocales: AppLocalizations.supportedLocales,
    localizationsDelegates: const [
      AppLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
  ));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('renders one card per event in a snapping, peeking PageView', (tester) async {
    final events = [for (var i = 1; i <= 4; i++) _event('$i')];
    await _pump(tester, HomeEventsCarousel(events: events));

    final pv = tester.widget<PageView>(find.byType(PageView));
    expect(pv.controller!.viewportFraction, closeTo(0.86, 0.001));
    expect(pv.pageSnapping, isTrue);
    expect(pv.childrenDelegate.estimatedChildCount, 4);

    // First card fully visible, second peeking from the trailing edge.
    expect(find.byType(HomeEventCard), findsNWidgets(2));
    final first = tester.getRect(find.byType(HomeEventCard).at(0));
    final second = tester.getRect(find.byType(HomeEventCard).at(1));
    expect(first.left, 16);
    expect(second.left, greaterThan(first.right));
    expect(second.left, lessThan(390 - 16));

    // Compact dots: one per event.
    for (var i = 0; i < 4; i++) {
      expect(find.byKey(ValueKey('home-events-dot-$i')), findsOneWidget);
    }

    // Swipe → snaps to the next page and moves the active dot.
    await tester.drag(find.byType(PageView), const Offset(-200, 0));
    await tester.pumpAndSettle();
    expect(pv.controller!.page, 1);
    final dot1 = tester.getSize(find.byKey(const ValueKey('home-events-dot-1')));
    final dot0 = tester.getSize(find.byKey(const ValueKey('home-events-dot-0')));
    expect(dot1.width, greaterThan(dot0.width));
  });

  testWidgets('event without an image gets the brand-colour cover, no icon', (tester) async {
    await _pump(tester, HomeEventsCarousel(events: [_event('1')]));

    final fallback = find.byKey(const ValueKey('event-cover-fallback'));
    expect(fallback, findsOneWidget);
    expect(tester.widget<ColoredBox>(fallback).color, _brand);
    expect(find.byKey(const ValueKey('event-cover-image')), findsNothing);
    expect(find.byType(Icon), findsNothing);

    // Date tile: month abbreviation + day number.
    final tile = find.byKey(const ValueKey('event-date-tile'));
    expect(find.descendant(of: tile, matching: find.text('DEC')), findsOneWidget);
    expect(find.descendant(of: tile, matching: find.text('6')), findsOneWidget);

    // A single event → no dots.
    expect(find.byKey(const ValueKey('home-events-dots')), findsNothing);
  });

  testWidgets('event with an image uses the cached image', (tester) async {
    await _pump(
      tester,
      HomeEventsCarousel(events: [_event('1', imageUrl: 'https://cdn.test/a.jpg')]),
    );
    expect(find.byKey(const ValueKey('event-cover-image')), findsOneWidget);
  });

  testWidgets('price, Free, low seats, full and registered states', (tester) async {
    await _pump(
      tester,
      Column(children: [
        SizedBox(height: 200, child: HomeEventCard(event: _event('free', seatsLeft: 3))),
        SizedBox(height: 200, child: HomeEventCard(event: _event('paid', paid: true, priceCents: 30000, seatsLeft: 12))),
        SizedBox(height: 200, child: HomeEventCard(event: _event('reg', seatsLeft: 2, regStatus: 'confirmed'))),
        SizedBox(height: 200, child: HomeEventCard(event: _event('sold-out', seatsLeft: 0))),
      ]),
    );

    expect(find.text('Free'), findsNWidgets(3));
    expect(find.text('300 EGP'), findsOneWidget);
    expect(find.text('3 seats left'), findsOneWidget);
    // Plenty of seats → no scarcity badge.
    expect(find.text('12 seats left'), findsNothing);
    // Registered wins over "2 seats left".
    expect(find.byKey(const ValueKey('home-event-registered')), findsOneWidget);
    expect(find.text('Registered'), findsOneWidget);
    expect(find.text('2 seats left'), findsNothing);
    expect(find.text('Event full'), findsOneWidget);
  });

  testWidgets('tapping a card opens the event detail', (tester) async {
    await _pump(tester, HomeEventsCarousel(events: [_event('42'), _event('43')]));
    await tester.tap(find.byType(HomeEventCard).first);
    await tester.pumpAndSettle();
    expect(find.text('detail 42'), findsOneWidget);
  });

  testWidgets('no upcoming events renders nothing', (tester) async {
    await _pump(tester, const HomeEventsCarousel(events: []));
    expect(find.byType(PageView), findsNothing);
    expect(find.byType(HomeEventCard), findsNothing);
    expect(tester.getSize(find.byType(HomeEventsCarousel)), Size.zero);
  });

  testWidgets('App Layout with `events` hidden leaves the carousel out', (tester) async {
    final layout = AppLayout.fromJson({
      'home': [
        {'key': 'banners', 'visible': true},
        {'key': 'events', 'visible': false},
      ],
    });
    expect(layout.home, isNot(contains('events')));

    // Same loop shape as HomeScreen.build → _buildSection.
    await _pump(
      tester,
      Column(children: [
        for (final key in layout.home)
          if (key == 'events') HomeEventsCarousel(events: [_event('1')]),
      ]),
    );
    expect(find.byType(HomeEventsCarousel), findsNothing);
  });

  testWidgets('RTL: cards run right-to-left with Arabic copy', (tester) async {
    final events = [
      _event('1', paid: true, priceCents: 15000),
      _event('2'),
      _event('3'),
    ];
    await _pump(tester, HomeEventsCarousel(events: events), locale: const Locale('ar'));

    expect(Directionality.of(tester.element(find.byType(PageView))), TextDirection.rtl);
    // First card is flush with the RIGHT edge; the next one peeks on the left.
    final first = tester.getRect(find.byType(HomeEventCard).at(0));
    final second = tester.getRect(find.byType(HomeEventCard).at(1));
    expect(first.right, 390 - 16);
    expect(second.right, lessThan(first.left));
    expect(second.right, greaterThan(16));

    // Date tile sits at the card's top-right (start) corner.
    final tile = tester.getRect(find.byKey(const ValueKey('event-date-tile')).first);
    expect(tile.right, closeTo(first.right - 14, 0.5));

    // Arabic strings.
    expect(find.text('150 جنيه'), findsOneWidget);
    expect(find.text('مجانية'), findsWidgets);

    // Swiping towards the right (natural "next" in RTL) advances, and the
    // first dot is the rightmost.
    await tester.drag(find.byType(PageView), const Offset(200, 0));
    await tester.pumpAndSettle();
    expect(tester.widget<PageView>(find.byType(PageView)).controller!.page, 1);
    final dot0 = tester.getRect(find.byKey(const ValueKey('home-events-dot-0')));
    final dot2 = tester.getRect(find.byKey(const ValueKey('home-events-dot-2')));
    expect(dot0.left, greaterThan(dot2.left));
  });
}
