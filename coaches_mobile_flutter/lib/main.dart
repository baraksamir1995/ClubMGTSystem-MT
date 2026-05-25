import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';
import 'core/constants/app_colors.dart';
import 'features/coach/coach_app_state.dart';
import 'firebase_options.dart';
import 'providers/auth_provider.dart';
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
        ChangeNotifierProvider<AuthProvider>(
          create: (ctx) => AuthProvider(ctx.read<ApiService>()),
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
      child: Builder(
        builder: (context) {
          final router = buildRouter(context);
          return MaterialApp.router(
            title: Env.brandName,
            debugShowCheckedModeBanner: false,
            routerConfig: router,
            theme: ThemeData(
              useMaterial3: true,
              brightness: Brightness.dark,
              scaffoldBackgroundColor: AppColors.bg,
              colorScheme: ColorScheme.fromSeed(
                seedColor: AppColors.lime,
                brightness: Brightness.dark,
                surface: AppColors.bg,
                primary: AppColors.lime,
                onPrimary: AppColors.limeText,
              ),
            ),
          );
        },
      ),
    );
  }
}
