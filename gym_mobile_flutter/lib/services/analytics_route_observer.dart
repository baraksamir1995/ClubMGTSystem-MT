import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';
import 'analytics_service.dart';

/// Attaches a listener to a GoRouter and logs a `screen_view` event
/// every time the current route changes.
///
/// Usage (after creating the router):
///   AnalyticsRouteObserver.attach(router);
class AnalyticsRouteObserver {
  static String? _lastLogged;

  static void attach(GoRouter router) {
    router.routerDelegate.addListener(() {
      final location =
          router.routerDelegate.currentConfiguration.fullPath;
      final name =
          router.routerDelegate.currentConfiguration.last.route.name ??
              location;

      if (name.isEmpty || name == _lastLogged) return;
      _lastLogged = name;

      AnalyticsService.instance.logScreenView(name);
    });
  }
}

/// NavigatorObserver fallback (for imperative Navigator.push outside go_router).
class AnalyticsNavigatorObserver extends NavigatorObserver {
  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    final name = route.settings.name;
    if (name == null || name.isEmpty) return;
    AnalyticsService.instance.logScreenView(name);
  }
}
