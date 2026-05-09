import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'services/analytics_route_observer.dart';
import 'screens/login_screen.dart';
import 'screens/main_shell.dart';
import 'screens/home_screen.dart';
import 'screens/schedule_screen.dart';
import 'screens/membership_screen.dart';
import 'screens/explore_screen.dart';
import 'screens/notifications_screen.dart';
import 'screens/my_bookings_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/attendance_screen.dart';
import 'screens/guest/guest_shell.dart';
import 'screens/guest/guest_home_screen.dart';
import 'screens/guest/guest_schedule_screen.dart';
// Guest screen imports kept for route definitions (unreachable when guest mode disabled)
// import 'screens/guest/guest_gym_info_screen.dart';
// import 'screens/guest/guest_trainers_screen.dart';
// import 'screens/guest/guest_plans_screen.dart';
import 'features/splash/splash_screen.dart';
import 'features/onboarding/onboarding_screen.dart';
import 'features/onboarding/welcome_screen.dart';
import 'features/auth/register_screen.dart';
import 'features/banners/screens/banner_details_screen.dart';
import 'features/banners/screens/sponsor_banner_detail_screen.dart';
import 'features/billing/billing_screen.dart';
import 'screens/guest_invitations_screen.dart';
import 'screens/offer_detail_screen.dart';
import 'features/billing/invoice_details_screen.dart';
import 'screens/explore_memberships_screen.dart';
import 'screens/explore_offers_screen.dart';
import 'screens/explore_trainers_screen.dart';
import 'screens/explore_programs_screen.dart';
import 'screens/explore_session_packages_screen.dart';
import 'screens/service_packages_screen.dart';
import 'screens/package_detail_screen.dart';
import 'screens/program_detail_screen.dart';
import 'screens/payment_summary_screen.dart';
import 'screens/forgot_password_screen.dart';
import 'screens/reset_password_screen.dart';
import 'screens/transfer_sessions_screen.dart';
import 'models/banner_model.dart';
import 'models/checkout_item.dart';
import 'models/service_model.dart';

const _publicRoutes = {'/splash', '/onboarding', '/welcome', '/login', '/register', '/forgot-password', '/reset-password'};

GoRouter buildRouter(BuildContext context) {
  final authProvider = context.read<AuthProvider>();

  final router = GoRouter(
    initialLocation: '/splash',
    refreshListenable: authProvider,
    redirect: (BuildContext ctx, GoRouterState state) {
      final isAuthenticated = authProvider.isAuthenticated;
      final isPasswordRecovery = authProvider.isPasswordRecovery;
      final location = state.matchedLocation;
      final isPublic = _publicRoutes.contains(location);

      // Deep link from password reset email — send to reset screen
      if (isPasswordRecovery && location != '/reset-password') {
        return '/reset-password';
      }
      if (!isAuthenticated && !isPublic) return '/login';
      if (isAuthenticated && !isPasswordRecovery && location == '/login') return '/home';
      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        name: 'splash',
        pageBuilder: (context, state) => const NoTransitionPage(
          child: SplashScreen(),
        ),
      ),
      GoRoute(
        path: '/onboarding',
        name: 'onboarding',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const OnboardingScreen(),
          transitionsBuilder: (context, animation, _, child) =>
              FadeTransition(opacity: animation, child: child),
          transitionDuration: const Duration(milliseconds: 400),
        ),
      ),
      GoRoute(
        path: '/welcome',
        name: 'welcome',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const WelcomeScreen(),
          transitionsBuilder: (context, animation, _, child) =>
              FadeTransition(opacity: animation, child: child),
          transitionDuration: const Duration(milliseconds: 350),
        ),
      ),
      GoRoute(
        path: '/register',
        name: 'register',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const RegisterScreen(),
          transitionsBuilder: (context, animation, _, child) => SlideTransition(
            position: Tween(
              begin: const Offset(1, 0),
              end: Offset.zero,
            ).animate(CurvedAnimation(
              parent: animation,
              curve: Curves.easeInOutCubic,
            )),
            child: child,
          ),
          transitionDuration: const Duration(milliseconds: 350),
        ),
      ),
      GoRoute(
        path: '/login',
        name: 'login',
        pageBuilder: (context, state) => const NoTransitionPage(
          child: LoginScreen(),
        ),
      ),
      GoRoute(
        path: '/forgot-password',
        name: 'forgot-password',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const ForgotPasswordScreen(),
          transitionsBuilder: (context, animation, _, child) => SlideTransition(
            position: Tween(
              begin: const Offset(1, 0),
              end: Offset.zero,
            ).animate(CurvedAnimation(
              parent: animation,
              curve: Curves.easeInOutCubic,
            )),
            child: child,
          ),
          transitionDuration: const Duration(milliseconds: 300),
        ),
      ),
      GoRoute(
        path: '/reset-password',
        name: 'reset-password',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const ResetPasswordScreen(),
          transitionsBuilder: (context, animation, _, child) => SlideTransition(
            position: Tween(
              begin: const Offset(1, 0),
              end: Offset.zero,
            ).animate(CurvedAnimation(
              parent: animation,
              curve: Curves.easeInOutCubic,
            )),
            child: child,
          ),
          transitionDuration: const Duration(milliseconds: 300),
        ),
      ),
      GoRoute(
        path: '/transfer-sessions',
        name: 'transfer-sessions',
        pageBuilder: (context, state) => const MaterialPage(
          child: TransferSessionsScreen(),
        ),
      ),
      // Offer detail — navigated to from Explore feed offer cards
      GoRoute(
        path: '/offer/:id',
        name: 'offer-detail',
        pageBuilder: (context, state) {
          final offerId = state.pathParameters['id']!;
          return CustomTransitionPage(
            child: OfferDetailScreen(offerId: offerId),
            transitionsBuilder: (context, animation, _, child) =>
                SlideTransition(
              position: Tween(
                begin: const Offset(1, 0),
                end: Offset.zero,
              ).animate(CurvedAnimation(
                parent: animation,
                curve: Curves.easeInOutCubic,
              )),
              child: child,
            ),
            transitionDuration: const Duration(milliseconds: 300),
          );
        },
      ),
      // ── Explore listing screens ────────────────────────────────────────────
      GoRoute(
        path: '/explore/memberships',
        name: 'explore-memberships',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const ExploreMembershipsScreen(),
          transitionsBuilder: (context, animation, _, child) => SlideTransition(
            position: Tween(begin: const Offset(1, 0), end: Offset.zero)
                .animate(CurvedAnimation(
                    parent: animation, curve: Curves.easeInOutCubic)),
            child: child,
          ),
          transitionDuration: const Duration(milliseconds: 300),
        ),
      ),
      GoRoute(
        path: '/explore/offers',
        name: 'explore-offers',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const ExploreOffersScreen(),
          transitionsBuilder: (context, animation, _, child) => SlideTransition(
            position: Tween(begin: const Offset(1, 0), end: Offset.zero)
                .animate(CurvedAnimation(
                    parent: animation, curve: Curves.easeInOutCubic)),
            child: child,
          ),
          transitionDuration: const Duration(milliseconds: 300),
        ),
      ),
      GoRoute(
        path: '/explore/trainers',
        name: 'explore-trainers',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const ExploreTrainersScreen(),
          transitionsBuilder: (context, animation, _, child) => SlideTransition(
            position: Tween(begin: const Offset(1, 0), end: Offset.zero)
                .animate(CurvedAnimation(
                    parent: animation, curve: Curves.easeInOutCubic)),
            child: child,
          ),
          transitionDuration: const Duration(milliseconds: 300),
        ),
      ),
      GoRoute(
        path: '/explore/programs',
        name: 'explore-programs',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const ExploreProgramsScreen(),
          transitionsBuilder: (context, animation, _, child) => SlideTransition(
            position: Tween(begin: const Offset(1, 0), end: Offset.zero)
                .animate(CurvedAnimation(
                    parent: animation, curve: Curves.easeInOutCubic)),
            child: child,
          ),
          transitionDuration: const Duration(milliseconds: 300),
        ),
      ),
      GoRoute(
        path: '/program/:id',
        name: 'program-detail',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: ProgramDetailScreen(
              programId: state.pathParameters['id']!),
          transitionsBuilder: (context, animation, _, child) => SlideTransition(
            position: Tween(begin: const Offset(1, 0), end: Offset.zero)
                .animate(CurvedAnimation(
                    parent: animation, curve: Curves.easeInOutCubic)),
            child: child,
          ),
          transitionDuration: const Duration(milliseconds: 300),
        ),
      ),
      GoRoute(
        path: '/explore/session-packages',
        name: 'explore-session-packages',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const ExploreSessionPackagesScreen(),
          transitionsBuilder: (context, animation, _, child) => SlideTransition(
            position: Tween(begin: const Offset(1, 0), end: Offset.zero)
                .animate(CurvedAnimation(
                    parent: animation, curve: Curves.easeInOutCubic)),
            child: child,
          ),
          transitionDuration: const Duration(milliseconds: 300),
        ),
      ),
      // Services flow — ServicesSection → packages → detail → payment summary
      GoRoute(
        path: '/service-packages/:serviceId',
        name: 'service-packages',
        pageBuilder: (context, state) {
          // Prefer extra (set during normal navigation); fall back to kServices
          // lookup by path param so the route survives hot-reload / state restore.
          final serviceId = state.pathParameters['serviceId'] ?? '';
          final service = (state.extra as ServiceModel?) ??
              kServices.firstWhere(
                (s) => s.id == serviceId,
                orElse: () => kServices.first,
              );
          return CustomTransitionPage(
            child: ServicePackagesScreen(service: service),
            transitionsBuilder: (context, animation, _, child) => SlideTransition(
              position: Tween(begin: const Offset(1, 0), end: Offset.zero)
                  .animate(CurvedAnimation(parent: animation, curve: Curves.easeInOutCubic)),
              child: child,
            ),
            transitionDuration: const Duration(milliseconds: 300),
          );
        },
      ),
      GoRoute(
        path: '/package-detail/:packageId',
        name: 'package-detail',
        pageBuilder: (context, state) {
          final extra = state.extra as PackageDetailExtra?;
          // If extra is missing (state restore / hot-reload), fall back to PT
          // with an empty package shell; the screen will handle the empty state.
          final service = extra?.service ?? kServices.first;
          final package = extra?.package ?? const <String, dynamic>{};
          return CustomTransitionPage(
            child: PackageDetailScreen(service: service, package: package),
            transitionsBuilder: (context, animation, _, child) => SlideTransition(
              position: Tween(begin: const Offset(1, 0), end: Offset.zero)
                  .animate(CurvedAnimation(parent: animation, curve: Curves.easeInOutCubic)),
              child: child,
            ),
            transitionDuration: const Duration(milliseconds: 300),
          );
        },
      ),
      // Membership — standalone push route (accessible from Home and Explore)
      GoRoute(
        path: '/membership',
        name: 'membership',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const MembershipScreen(),
          transitionsBuilder: (context, animation, _, child) => SlideTransition(
            position: Tween(
              begin: const Offset(1, 0),
              end: Offset.zero,
            ).animate(CurvedAnimation(
              parent: animation,
              curve: Curves.easeInOutCubic,
            )),
            child: child,
          ),
          transitionDuration: const Duration(milliseconds: 300),
        ),
      ),
      GoRoute(
        path: '/my-bookings',
        name: 'my-bookings',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const MyBookingsScreen(),
          transitionsBuilder: (context, animation, _, child) => SlideTransition(
            position: Tween(
              begin: const Offset(1, 0),
              end: Offset.zero,
            ).animate(CurvedAnimation(
              parent: animation,
              curve: Curves.easeInOutCubic,
            )),
            child: child,
          ),
          transitionDuration: const Duration(milliseconds: 300),
        ),
      ),
      // Banner details — internal banner content screen
      GoRoute(
        path: '/banner-details',
        name: 'banner-details',
        pageBuilder: (context, state) {
          final banner = state.extra as BannerModel?;
          if (banner == null) {
            return CustomTransitionPage(
              child: const Scaffold(body: Center(child: Text('Banner not found'))),
              transitionsBuilder: (context, animation, _, child) => child,
            );
          }
          return CustomTransitionPage(
            child: BannerDetailsScreen(banner: banner),
            transitionsBuilder: (context, animation, _, child) => SlideTransition(
              position: Tween(
                begin: const Offset(1, 0),
                end: Offset.zero,
              ).animate(CurvedAnimation(
                parent: animation,
                curve: Curves.easeInOutCubic,
              )),
              child: child,
            ),
            transitionDuration: const Duration(milliseconds: 300),
          );
        },
      ),
      // Sponsor banner detail — same slide-from-right transition as
      // banner-details so route observers + system back behave the same.
      GoRoute(
        path: '/banner-sponsor',
        name: 'banner-sponsor',
        pageBuilder: (context, state) {
          final banner = state.extra as BannerModel?;
          if (banner == null) {
            return CustomTransitionPage(
              child: const Scaffold(body: Center(child: Text('Banner not found'))),
              transitionsBuilder: (context, animation, _, child) => child,
            );
          }
          return CustomTransitionPage(
            child: SponsorBannerDetailScreen(banner: banner),
            transitionsBuilder: (context, animation, _, child) => SlideTransition(
              position: Tween(
                begin: const Offset(1, 0),
                end: Offset.zero,
              ).animate(CurvedAnimation(
                parent: animation,
                curve: Curves.easeInOutCubic,
              )),
              child: child,
            ),
            transitionDuration: const Duration(milliseconds: 300),
          );
        },
      ),
      // Guest Invitations — member sends/tracks guest passes
      GoRoute(
        path: '/invitations',
        name: 'invitations',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const GuestInvitationsScreen(),
          transitionsBuilder: (context, animation, _, child) => SlideTransition(
            position: Tween(begin: const Offset(1, 0), end: Offset.zero)
                .animate(CurvedAnimation(parent: animation, curve: Curves.easeInOutCubic)),
            child: child,
          ),
          transitionDuration: const Duration(milliseconds: 300),
        ),
      ),
      // Billing — invoice list
      GoRoute(
        path: '/billing',
        name: 'billing',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const BillingScreen(),
          transitionsBuilder: (context, animation, _, child) => SlideTransition(
            position: Tween(begin: const Offset(1, 0), end: Offset.zero)
                .animate(CurvedAnimation(parent: animation, curve: Curves.easeInOutCubic)),
            child: child,
          ),
          transitionDuration: const Duration(milliseconds: 300),
        ),
      ),
      // Billing — invoice details (extra = memberId string)
      GoRoute(
        path: '/billing/:id',
        name: 'invoice-details',
        pageBuilder: (context, state) {
          final invoiceId = state.pathParameters['id']!;
          final memberId  = state.extra as String? ?? '';
          return CustomTransitionPage(
            child: InvoiceDetailsScreen(invoiceId: invoiceId, memberId: memberId),
            transitionsBuilder: (context, animation, _, child) => SlideTransition(
              position: Tween(begin: const Offset(1, 0), end: Offset.zero)
                  .animate(CurvedAnimation(parent: animation, curve: Curves.easeInOutCubic)),
              child: child,
            ),
            transitionDuration: const Duration(milliseconds: 300),
          );
        },
      ),
      // Payment summary — used by all purchase CTAs
      GoRoute(
        path: '/payment-summary',
        name: 'payment-summary',
        pageBuilder: (context, state) {
          final item = state.extra as CheckoutItem?;
          return CustomTransitionPage(
            child: item != null
                ? PaymentSummaryScreen(item: item)
                : const Scaffold(body: SizedBox.shrink()),
            transitionsBuilder: (context, animation, _, child) => SlideTransition(
              position: Tween(begin: const Offset(1, 0), end: Offset.zero)
                  .animate(CurvedAnimation(
                      parent: animation, curve: Curves.easeInOutCubic)),
              child: child,
            ),
            transitionDuration: const Duration(milliseconds: 300),
          );
        },
      ),
      // Notifications — standalone push screen (accessed via bell icon)
      GoRoute(
        path: '/notifications',
        name: 'notifications',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const NotificationsScreen(),
          transitionsBuilder: (context, animation, _, child) => SlideTransition(
            position: Tween(
              begin: const Offset(1, 0),
              end: Offset.zero,
            ).animate(CurvedAnimation(
              parent: animation,
              curve: Curves.easeInOutCubic,
            )),
            child: child,
          ),
          transitionDuration: const Duration(milliseconds: 300),
        ),
      ),
      // Guest shell — 5 tabs: Home, Classes, (locked) Check-in, Bookings, Profile
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            GuestShell(navigationShell: navigationShell),
        branches: [
          // 0 — Home
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/guest/home',
              pageBuilder: (context, state) =>
                  const NoTransitionPage(child: GuestHomeScreen()),
            ),
          ]),
          // 1 — Classes (schedule)
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/guest/classes',
              pageBuilder: (context, state) =>
                  const NoTransitionPage(child: GuestScheduleScreen()),
            ),
          ]),
          // 2 — Check-in (locked — tap intercepted in GuestShell)
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/guest/checkin',
              pageBuilder: (context, state) =>
                  const NoTransitionPage(child: _GuestLockedPlaceholder()),
            ),
          ]),
          // 3 — Bookings (locked)
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/guest/bookings',
              pageBuilder: (context, state) =>
                  const NoTransitionPage(child: _GuestLockedPlaceholder()),
            ),
          ]),
          // 4 — Profile (locked)
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/guest/profile',
              pageBuilder: (context, state) =>
                  const NoTransitionPage(child: _GuestLockedPlaceholder()),
            ),
          ]),
        ],
      ),

      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return MainShell(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/home',
                name: 'home',
                pageBuilder: (context, state) => const NoTransitionPage(
                  child: HomeScreen(),
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/schedule',
                name: 'schedule',
                pageBuilder: (context, state) => const NoTransitionPage(
                  child: ScheduleScreen(),
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/checkin',
                name: 'checkin',
                pageBuilder: (context, state) => const NoTransitionPage(
                  child: AttendanceScreen(),
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/explore',
                name: 'explore',
                pageBuilder: (context, state) => const NoTransitionPage(
                  child: ExploreScreen(),
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/profile',
                name: 'profile',
                pageBuilder: (context, state) => const NoTransitionPage(
                  child: ProfileScreen(),
                ),
              ),
            ],
          ),
        ],
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(
        child: Text('Page not found: ${state.error}'),
      ),
    ),
  );

  AnalyticsRouteObserver.attach(router);
  return router;
}

/// Placeholder shown for locked guest branches (tap is intercepted before navigation).
class _GuestLockedPlaceholder extends StatelessWidget {
  const _GuestLockedPlaceholder();
  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
