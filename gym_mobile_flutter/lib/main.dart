import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'providers/member_provider.dart';
import 'features/banners/banner_provider.dart';
import 'features/billing/billing_provider.dart';
import 'features/branches/branch_provider.dart';
import 'features/popups/popup_provider.dart';
import 'features/rating/rating_reminder_provider.dart';
import 'services/api_service.dart';
import 'services/deep_link_service.dart';
import 'services/fresh_install_guard.dart';
import 'services/notification_service.dart';
import 'router.dart';
import 'utils/env.dart';
import 'utils/theme.dart';
import 'widgets/staging_banner.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Crash loudly in debug builds if required build-time config is missing.
  Env.validate();

  // iOS Keychain entries survive app uninstall — wipe them on first
  // launch so a reinstall behaves like a clean slate (auth token,
  // onboarding flag, cached gym branding).
  await FreshInstallGuard.runOnFirstInstall();

  await NotificationService().initFirebase();
  await NotificationService().init();

  // Screen-protection (screenshot prevention + app-switcher color overlay)
  // was globally enabled here. It caused two different black-screen bugs:
  //   1) leftover blur from the Attendance lifecycle observer firing on
  //      other tabs' paused transitions.
  //   2) the global black color overlay sticking around after iOS
  //      image_picker / image_cropper modals returned, leaving the Profile
  //      screen black after save.
  // Re-enable per-screen on sensitive routes only (Attendance QR, payments)
  // before production — see project backlog.

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
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final auth = context.read<AuthProvider>();
      DeepLinkService.instance.init((uri) {
        if (uri.scheme == 'gymapp' && uri.host == 'password-reset') {
          final token = uri.queryParameters['token'];
          if (token != null && token.isNotEmpty) {
            auth.startPasswordRecovery(token);
          }
        }
      });
    });
  }

  @override
  void dispose() {
    DeepLinkService.instance.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();
    final gym = authProvider.gym;

    Color primaryColor = AppTheme.defaultPrimary;
    Color? secondaryColor;
    // White-label builds bake the brand color into the binary, so it wins over
    // whatever the gym row in the API has — guarantees no flicker between
    // launch and first /me response, and keeps the app on-brand even if an
    // admin clears the gym's primary_color in the dashboard.
    if (Env.isWhiteLabel && Env.brandPrimaryHex.isNotEmpty) {
      try {
        primaryColor = AppTheme.colorFromHex(Env.brandPrimaryHex);
      } catch (_) {}
    } else if (gym?.primaryColor != null && gym!.primaryColor!.isNotEmpty) {
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
        title: gym?.name ?? Env.brandName,
        debugShowCheckedModeBanner: false,
        theme: AppTheme.buildTheme(primaryColor, secondary: secondaryColor),
        routerConfig: _router,
      ),
    );
  }
}
