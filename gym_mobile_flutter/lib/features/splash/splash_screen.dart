import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../features/banners/banner_provider.dart';
import '../../features/branches/branch_provider.dart';
import '../../features/popups/popup_provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/member_provider.dart';
import '../../services/app_bootstrap.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _fadeAnimation;
  late final Animation<double> _scaleAnimation;

  static const _storage = FlutterSecureStorage();
  static const _onboardingKey = 'onboarding_completed';
  static const _gymLogoKey = 'cached_gym_logo_url';
  static const _gymNameKey = 'cached_gym_name';

  /// Minimum time the splash is visible regardless of load speed.
  static const _minDisplayMs = 2000;

  String? _logoUrl;
  String? _gymName;
  bool _listenerAdded = false;
  AuthProvider? _authProvider;

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    );

    _fadeAnimation = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.0, 0.7, curve: Curves.easeOut),
    );

    _scaleAnimation = Tween<double>(begin: 0.85, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.7, curve: Curves.easeOutCubic),
      ),
    );

    _controller.forward();
    _loadCachedBranding();

    // Bootstrap runs after the first frame so providers are available.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // Listen to AuthProvider so we update the logo as soon as live gym
      // data is fetched — even if it differs from the secure-storage cache.
      _authProvider = context.read<AuthProvider>();
      _authProvider!.addListener(_onAuthChanged);
      _listenerAdded = true;
      _bootstrap();
    });
  }

  void _onAuthChanged() {
    if (!mounted) return;
    final gym = context.read<AuthProvider>().gym;
    if (gym == null) return;
    final liveUrl = gym.logoUrl;
    final liveName = gym.name;
    if (liveUrl != null && liveUrl != _logoUrl) {
      if (_logoUrl != null) CachedNetworkImage.evictFromCache(_logoUrl!);
      setState(() {
        _logoUrl = liveUrl;
        _gymName = liveName;
      });
      // Write the fresh URL to cache so next cold-start is correct.
      _storage.write(key: _gymLogoKey, value: liveUrl);
      _storage.write(key: _gymNameKey, value: liveName);
    }
  }

  /// Reads gym name/logo from secure storage so the splash renders immediately
  /// without waiting for network (the cache is warmed on first login).
  Future<void> _loadCachedBranding() async {
    final logo = await _storage.read(key: _gymLogoKey);
    final name = await _storage.read(key: _gymNameKey);
    if (mounted) {
      setState(() {
        _logoUrl = logo;
        _gymName = name;
      });
    }
  }

  /// Runs [AppBootstrap] to pre-load all critical data, then navigates.
  /// The splash stays visible until BOTH the bootstrap AND the minimum
  /// display time have elapsed — whichever takes longer.
  Future<void> _bootstrap() async {
    final minDisplay =
        Future<void>.delayed(const Duration(milliseconds: _minDisplayMs));

    final bootstrap = AppBootstrap(
      authProvider: context.read<AuthProvider>(),
      memberProvider: context.read<MemberProvider>(),
      bannerProvider: context.read<BannerProvider>(),
      branchProvider: context.read<BranchProvider>(),
      popupProvider: context.read<PopupProvider>(),
    );

    // Run bootstrap and minimum timer concurrently.
    await Future.wait<void>([
      bootstrap.run(),
      minDisplay,
    ]);

    if (!mounted) return;
    _navigateNext();
  }

  void _navigateNext() {
    final auth = context.read<AuthProvider>();
    if (auth.isAuthenticated) {
      context.go('/home');
      return;
    }

    _storage.read(key: _onboardingKey).then((value) {
      if (!mounted) return;
      if (value == 'true') {
        context.go('/login');
      } else {
        context.go('/onboarding');
      }
    });
  }

  @override
  void dispose() {
    if (_listenerAdded && _authProvider != null) {
      _authProvider!.removeListener(_onAuthChanged);
    }
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.splashBgTop, AppColors.splashBgBottom],
          ),
        ),
        child: Stack(
          children: [
            // Concentric ring decorations
            const Positioned.fill(child: _ConcentricRings()),

            // Main content
            AnimatedBuilder(
              animation: _controller,
              builder: (context, child) => Opacity(
                opacity: _fadeAnimation.value,
                child: Transform.scale(
                  scale: _scaleAnimation.value,
                  child: child,
                ),
              ),
              child: Stack(
                children: [
                  // Logo at exact screen center — same origin as the rings
                  Center(
                    child: _logoUrl != null
                        ? ClipRRect(
                            borderRadius: BorderRadius.circular(28),
                            child: CachedNetworkImage(
                              imageUrl: _logoUrl!,
                              width: 120,
                              height: 120,
                              fit: BoxFit.cover,
                              // Transparent while loading — avoids the
                              // default-logo flash when a gym logo is set.
                              placeholder: (context, url) =>
                                  const SizedBox(width: 120, height: 120),
                              errorWidget: (context, url, error) =>
                                  const _DefaultLogoBox(),
                            ),
                          )
                        : const _DefaultLogoBox(),
                  ),

                  // Gym name sits below the logo without pushing it off-center
                  Center(
                    child: Transform.translate(
                      // 60 = half logo height (120/2); 24 = gap between logo and name
                      offset: const Offset(0, 84),
                      child: Text(
                        _gymName ?? 'GymApp',
                        style: const TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                          color: AppColors.white,
                          letterSpacing: -0.5,
                        ),
                      ),
                    ),
                  ),

                  // Bottom: dots + "Powered by CLBY"
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: MediaQuery.of(context).padding.bottom + 32,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Loading dots
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: List.generate(3, (i) {
                            return Container(
                              margin:
                                  const EdgeInsets.symmetric(horizontal: 3),
                              width: 6,
                              height: 6,
                              decoration: BoxDecoration(
                                color: i == 0
                                    ? AppColors.white
                                    : AppColors.white.withValues(alpha: 0.3),
                                shape: BoxShape.circle,
                              ),
                            );
                          }),
                        ),
                        const SizedBox(height: 14),
                        Text(
                          'Powered by CLBY',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            color: AppColors.white.withValues(alpha: 0.45),
                            letterSpacing: 0.2,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Concentric rings background ──────────────────────────────────────────────

class _ConcentricRings extends StatelessWidget {
  const _ConcentricRings();

  @override
  Widget build(BuildContext context) {
    return CustomPaint(painter: _RingsPainter());
  }
}

class _RingsPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.04)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;

    for (final radius in [90.0, 150.0, 215.0, 285.0]) {
      canvas.drawCircle(center, radius, paint);
    }
  }

  @override
  bool shouldRepaint(_RingsPainter old) => false;
}

// ─── Default logo box ─────────────────────────────────────────────────────────

class _DefaultLogoBox extends StatelessWidget {
  const _DefaultLogoBox();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 120,
      height: 120,
      decoration: BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.4),
            blurRadius: 40,
            offset: const Offset(0, 16),
          ),
        ],
      ),
      child: const Icon(
        Icons.fitness_center_rounded,
        color: AppColors.white,
        size: 52,
      ),
    );
  }
}
