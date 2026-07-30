import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../core/constants/app_colors.dart';
import '../providers/auth_provider.dart';
import '../widgets/auth_widgets.dart';

/// Shown on cold start while AuthProvider restores any prior session.
/// Dark CLBY surface with a small lime progress indicator under the
/// wordmark. Once `isLoading` settles, routes to /home or /login.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _settle());
  }

  Future<void> _settle() async {
    final auth = context.read<AuthProvider>();
    while (auth.isLoading) {
      await Future.delayed(const Duration(milliseconds: 80));
      if (!mounted) return;
    }
    if (!mounted) return;
    context.go(auth.isAuthenticated ? '/home' : '/login');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const GymBrandHeader(
              size: 36,
              subLabel: 'COACH PORTAL',
              alignment: CrossAxisAlignment.center,
            ),
            const SizedBox(height: 28),
            SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation(AppColors.primary),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
