import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';
import 'core/constants/app_colors.dart';
import 'features/coach/coach_app_state.dart';
import 'firebase_options.dart';
import 'providers/auth_provider.dart';
import 'providers/branding_provider.dart';
import 'router.dart';
import 'services/api_service.dart';
import 'utils/env.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  Env.validate();

  // Firebase + Crashlytics. Initialise before runApp so the error handlers
  // below are armed for the very first frame.
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  final crashlytics = FirebaseCrashlytics.instance;
  // Don't ship debug-session crashes to the dashboard — only release builds
  // report, so local development noise stays out of prod Crashlytics.
  await crashlytics.setCrashlyticsCollectionEnabled(!kDebugMode);

  // Framework (build/layout/paint) errors → Crashlytics, as fatal.
  FlutterError.onError = crashlytics.recordFlutterFatalError;
  // Uncaught async / platform errors that escape the Flutter zone.
  PlatformDispatcher.instance.onError = (error, stack) {
    crashlytics.recordError(error, stack, fatal: true);
    return true;
  };

  // `intl`'s non-default locales must be initialised before any DateFormat
  // call that names a locale (e.g. `DateFormat('dd MMM', 'en_GB')` in
  // `fmtShort`). Without this, the first MemberCard build crashes with
  // `LocaleDataException: Locale data has not been initialized`.
  await initializeDateFormatting('en_GB');
  runApp(const CoachesApp());
}

class CoachesApp extends StatelessWidget {
  const CoachesApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<ApiService>(create: (_) => ApiService()),
        // Branding first: it restores the cached gym logo/colors before the
        // first frame and re-syncs whenever AuthProvider resolves a gym.
        ChangeNotifierProvider<BrandingProvider>(
          create: (ctx) => BrandingProvider(ctx.read<ApiService>()),
        ),
        ChangeNotifierProvider<AuthProvider>(
          create: (ctx) => AuthProvider(
            ctx.read<ApiService>(),
            onGymResolved: (gymId) =>
                ctx.read<BrandingProvider>().syncForGym(gymId),
          ),
        ),
        // CoachAppState is the central coach session state — `memberState`
        // and `lastScans` from coach-app.jsx. Top-level so the push routes
        // (/manual-log, /member-preview) share it with the home tab.
        // Mock data resets on app restart per the prototype's spec.
        // Coach app state is API-backed (roster / today / decrement
        // against /api/coach/*). It's provided here at the root so the
        // push routes (`/manual-log`, `/assignment/:id`) share it with
        // the home shell. HomeScreen triggers .load() on first build.
        ChangeNotifierProvider<CoachAppState>(
          create: (ctx) => CoachAppState(ctx.read<ApiService>()),
        ),
      ],
      child: const _CoachesAppShell(),
    );
  }
}

/// Owns the ONE GoRouter for the app's lifetime. The shell watches
/// BrandingProvider for accent changes, but the router must never be
/// recreated on a branding notification — a fresh GoRouter resets the
/// navigation stack to /splash mid-session (and leaks the old router's
/// refreshListenable subscription).
class _CoachesAppShell extends StatefulWidget {
  const _CoachesAppShell();

  @override
  State<_CoachesAppShell> createState() => _CoachesAppShellState();
}

class _CoachesAppShellState extends State<_CoachesAppShell> {
  late final GoRouter _router = buildRouter(context);

  @override
  void dispose() {
    _router.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Rebuild when the gym's dashboard branding actually CHANGES —
    // BrandingProvider only notifies on real changes, and its epoch keys
    // the whole subtree so every mounted screen repaints with the new
    // AppColors accents (mounted routes don't otherwise rebuild, which
    // used to leave a half-branded UI). GoRouter keeps the current
    // location + pushed routes across the remount, so a rare mid-session
    // brand change costs screen state, not the coach's place in the app.
    final epoch = context.watch<BrandingProvider>().epoch;
    return MaterialApp.router(
      key: ValueKey('branding-$epoch'),
      title: Env.brandName,
      debugShowCheckedModeBanner: false,
      routerConfig: _router,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,
        scaffoldBackgroundColor: AppColors.bg,
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppColors.primary,
          brightness: Brightness.light,
          surface: AppColors.bg,
          primary: AppColors.primary,
          onPrimary: AppColors.primaryInk,
          secondary: AppColors.secondary,
        ),
      ),
    );
  }
}
