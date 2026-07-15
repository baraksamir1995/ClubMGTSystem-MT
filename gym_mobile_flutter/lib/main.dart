import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'l10n/app_localizations.dart';
import 'providers/auth_provider.dart';
import 'providers/locale_provider.dart';
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
        ChangeNotifierProvider<LocaleProvider>(
          create: (_) => LocaleProvider(),
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
  // Cached so we can deregister cleanly in dispose without context lookups.
  AuthProvider? _auth;
  VoidCallback? _signOutFanOut;

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

      // Wire each non-auth provider's clear() so signOut() / deleteAccount()
      // wipe their state too. Otherwise user-A's banners/sessions/popups/etc.
      // survive a user-B login on the same device.
      _auth = auth;
      final member = context.read<MemberProvider>();
      final banner = context.read<BannerProvider>();
      final branch = context.read<BranchProvider>();
      final popup  = context.read<PopupProvider>();
      final rating = context.read<RatingReminderProvider>();
      _signOutFanOut = () {
        member.clear();
        banner.clear();
        branch.clear();
        popup.clear();
        rating.clear();
      };
      _auth!.addSignOutCallback(_signOutFanOut!);
    });
  }

  @override
  void dispose() {
    if (_auth != null && _signOutFanOut != null) {
      _auth!.removeSignOutCallback(_signOutFanOut!);
    }
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

    final localeProvider = context.watch<LocaleProvider>();

    return StagingBanner(
      child: MaterialApp.router(
        title: gym?.name ?? Env.brandName,
        debugShowCheckedModeBanner: false,
        theme: AppTheme.buildTheme(primaryColor, secondary: secondaryColor),
        locale: localeProvider.locale,
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        routerConfig: _router,
      ),
    );
  }
}
