import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:screen_protector/screen_protector.dart';
import 'providers/auth_provider.dart';
import 'providers/member_provider.dart';
import 'features/banners/banner_provider.dart';
import 'features/billing/billing_provider.dart';
import 'features/branches/branch_provider.dart';
import 'features/popups/popup_provider.dart';
import 'features/rating/rating_reminder_provider.dart';
import 'services/api_service.dart';
import 'services/notification_service.dart';
import 'router.dart';
import 'utils/env.dart';
import 'utils/theme.dart';
import 'widgets/staging_banner.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Crash loudly in debug builds if required build-time config is missing.
  Env.validate();

  await NotificationService().initFirebase();
  await NotificationService().init();

  // Prevent screenshots and screen recording of sensitive member data.
  await ScreenProtector.preventScreenshotOn();
  await ScreenProtector.protectDataLeakageWithColor(Colors.black);

  runApp(const GymApp());
}

class GymApp extends StatelessWidget {
  const GymApp({super.key});

  @override
  Widget build(BuildContext context) {
    final apiService = ApiService();

    return MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthProvider>(
          create: (_) => AuthProvider(apiService),
        ),
        ChangeNotifierProvider<MemberProvider>(
          create: (_) => MemberProvider(apiService),
        ),
        ChangeNotifierProvider<BannerProvider>(
          create: (_) => BannerProvider(),
        ),
        ChangeNotifierProvider<BillingProvider>(
          create: (_) => BillingProvider(),
        ),
        ChangeNotifierProvider<BranchProvider>(
          create: (_) => BranchProvider(),
        ),
        ChangeNotifierProvider<PopupProvider>(
          create: (_) => PopupProvider(),
        ),
        ChangeNotifierProvider<RatingReminderProvider>(
          create: (_) => RatingReminderProvider(),
        ),
      ],
      child: const _AppRoot(),
    );
  }
}

class _AppRoot extends StatefulWidget {
  const _AppRoot();

  @override
  State<_AppRoot> createState() => _AppRootState();
}

class _AppRootState extends State<_AppRoot> {
  late final _router = buildRouter(context);

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();
    final gym = authProvider.gym;

    Color primaryColor = AppTheme.defaultPrimary;
    Color? secondaryColor;
    if (gym?.primaryColor != null && gym!.primaryColor!.isNotEmpty) {
      try {
        primaryColor = AppTheme.colorFromHex(gym.primaryColor!);
      } catch (_) {}
    }
    if (gym?.secondaryColor != null && gym!.secondaryColor!.isNotEmpty) {
      try {
        secondaryColor = AppTheme.colorFromHex(gym.secondaryColor!);
      } catch (_) {}
    }

    return StagingBanner(
      child: MaterialApp.router(
        title: gym?.name ?? 'Gym App',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.buildTheme(primaryColor, secondary: secondaryColor),
        routerConfig: _router,
      ),
    );
  }
}
