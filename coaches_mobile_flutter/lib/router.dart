import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'features/coach/screens/manual_log_screen.dart';
import 'features/coach/screens/member_detail_screen.dart';
import 'features/offline/offline_log_screen.dart';
import 'features/offline/scan_pass_screen.dart';
import 'features/offline/sync_status_screen.dart';
import 'providers/auth_provider.dart';
import 'screens/splash_screen.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';

/// Routes reachable without an authenticated session.
const _publicRoutes = {'/splash', '/login'};

GoRouter buildRouter(BuildContext context) {
  final authProvider = context.read<AuthProvider>();

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: authProvider,
    redirect: (BuildContext ctx, GoRouterState state) {
      final isAuthenticated = authProvider.isAuthenticated;
      final location = state.matchedLocation;
      final isPublic = _publicRoutes.contains(location);

      if (!isAuthenticated && !isPublic) return '/login';
      if (isAuthenticated && location == '/login') return '/home';
      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        name: 'splash',
        pageBuilder: (context, state) =>
            const NoTransitionPage(child: SplashScreen()),
      ),
      GoRoute(
        path: '/login',
        name: 'login',
        pageBuilder: (context, state) =>
            const NoTransitionPage(child: LoginScreen()),
      ),
      GoRoute(
        path: '/home',
        name: 'home',
        pageBuilder: (context, state) =>
            const NoTransitionPage(child: HomeScreen()),
      ),
      // Push from the QR home — slide in from the right.
      GoRoute(
        path: '/manual-log',
        name: 'manual-log',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const ManualLogScreen(),
          transitionsBuilder: (_, animation, _, child) => SlideTransition(
            position: Tween(begin: const Offset(1, 0), end: Offset.zero)
                .animate(CurvedAnimation(
                    parent: animation, curve: Curves.easeInOutCubic)),
            child: child,
          ),
          transitionDuration: const Duration(milliseconds: 300),
        ),
      ),
      // Offline-attendance (Phase 2) screens — slide in like manual log.
      GoRoute(
        path: '/offline-log',
        name: 'offline-log',
        pageBuilder: (context, state) => _slide(OfflineLogScreen(
            args: state.extra is OfflineLogArgs ? state.extra as OfflineLogArgs : null)),
      ),
      GoRoute(
        path: '/scan-pass',
        name: 'scan-pass',
        pageBuilder: (context, state) => _slide(const ScanPassScreen()),
      ),
      GoRoute(
        path: '/offline-status',
        name: 'offline-status',
        pageBuilder: (context, state) => _slide(const SyncStatusScreen()),
      ),
      // Member detail in the design — scoped to a single assignment id.
      GoRoute(
        path: '/assignment/:id',
        name: 'assignment-detail',
        pageBuilder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          return CustomTransitionPage(
            child: MemberDetailScreen(assignmentId: id),
            transitionsBuilder: (_, animation, _, child) => SlideTransition(
              position: Tween(begin: const Offset(1, 0), end: Offset.zero)
                  .animate(CurvedAnimation(
                      parent: animation, curve: Curves.easeInOutCubic)),
              child: child,
            ),
            transitionDuration: const Duration(milliseconds: 300),
          );
        },
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(child: Text('Page not found: ${state.error}')),
    ),
  );
}

CustomTransitionPage<void> _slide(Widget child) => CustomTransitionPage<void>(
      child: child,
      transitionsBuilder: (_, animation, _, child) => SlideTransition(
        position: Tween(begin: const Offset(1, 0), end: Offset.zero).animate(
            CurvedAnimation(parent: animation, curve: Curves.easeInOutCubic)),
        child: child,
      ),
      transitionDuration: const Duration(milliseconds: 300),
    );
