import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../features/banners/banner_provider.dart';
import '../../features/branches/branch_provider.dart';
import '../../features/popups/popup_provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/member_provider.dart';
import '../../services/app_bootstrap.dart';
import '../../utils/env.dart';

// ── Design tokens (warm cream + peach + orange) ─────────────────────────────
const _kBg      = Color(0xFFF7F6F2);
const _kInk     = Color(0xFF1F1A14);
const _kInk2    = Color(0x9E1F1A14);
const _kInk3    = Color(0x6B1F1A14);
const _kPeach   = Color(0xFFF4DCC1);

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with TickerProviderStateMixin {
  late final AnimationController _glowCtrl;
  late final AnimationController _markCtrl;
  late final AnimationController _textCtrl;
  late final AnimationController _hintCtrl;

  static const _storage = FlutterSecureStorage();
  static const _onboardingKey = 'onboarding_completed';
  static const _gymLogoKey = 'cached_gym_logo_url';
  static const _gymNameKey = 'cached_gym_name';

  /// Minimum time the splash is visible regardless of load speed.
  /// Kept short so users on fast networks aren't held back, but long
  /// enough that the brand mark + wordmark have time to fade in.
  static const _minDisplayMs = 600;

  String? _logoUrl;
  String? _gymName;
  bool _listenerAdded = false;
  AuthProvider? _authProvider;

  @override
  void initState() {
    super.initState();

    // Snappy timings. The mark animation does NOT auto-start here; it
    // waits for the cached branding read to complete so the mark fades
    // in once with the right logo, instead of flashing the default mark
    // and then swapping to the gym logo mid-animation.
    _glowCtrl = AnimationController(
      vsync: this, duration: const Duration(milliseconds: 600),
    )..forward();
    _markCtrl = AnimationController(
      vsync: this, duration: const Duration(milliseconds: 450),
    );
    _textCtrl = AnimationController(
      vsync: this, duration: const Duration(milliseconds: 350),
    );
    _hintCtrl = AnimationController(
      vsync: this, duration: const Duration(milliseconds: 300),
    );

    _resolveBrandingAndAnimate();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _authProvider = context.read<AuthProvider>();
      _authProvider!.addListener(_onAuthChanged);
      _listenerAdded = true;
      _bootstrap();
    });
  }

  /// AuthProvider may receive fresh gym data during bootstrap. We persist
  /// the URL/name to the cache so the next cold start renders correctly,
  /// but we deliberately do NOT swap the displayed logo mid-splash —
  /// otherwise the mark would flash and the splash would feel like it's
  /// hanging.
  void _onAuthChanged() {
    if (!mounted) return;
    final gym = context.read<AuthProvider>().gym;
    if (gym == null) return;
    final liveUrl = gym.logoUrl;
    final liveName = gym.name;
    if (liveUrl != null && liveUrl != _logoUrl) {
      _storage.write(key: _gymLogoKey, value: liveUrl);
    }
    if (liveName != null && liveName != _gymName) {
      _storage.write(key: _gymNameKey, value: liveName);
    }
  }

  /// Reads the cached gym branding, pre-warms the image cache, then
  /// triggers the mark + text + hint animations as a single chain.
  Future<void> _resolveBrandingAndAnimate() async {
    final logo = await _storage.read(key: _gymLogoKey);
    final name = await _storage.read(key: _gymNameKey);

    // Pre-decode the network image so CachedNetworkImage doesn't blink
    // when the mark fades in. Capped at 800 ms so a slow CDN can't
    // hold the splash mark hidden — falls through to the bundled
    // default mark which then swaps to the gym logo on first paint.
    if (logo != null && logo.isNotEmpty && mounted) {
      try {
        await precacheImage(CachedNetworkImageProvider(logo), context)
            .timeout(const Duration(milliseconds: 800));
      } catch (_) {/* fall through to default mark */}
    }

    if (!mounted) return;
    setState(() {
      _logoUrl = logo;
      _gymName = name;
    });

    _markCtrl.forward();
    Future.delayed(const Duration(milliseconds: 120), () {
      if (mounted) _textCtrl.forward();
    });
    Future.delayed(const Duration(milliseconds: 450), () {
      if (mounted) _hintCtrl.forward();
    });
  }

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
    _glowCtrl.dispose();
    _markCtrl.dispose();
    _textCtrl.dispose();
    _hintCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final wordmark = (_gymName != null && _gymName!.isNotEmpty) ? _gymName! : Env.brandName;
    return Scaffold(
      backgroundColor: _kBg,
      body: Stack(
        children: [
          // Peach radial glow — full-screen layer with the glow itself
          // centered. Sized to the Stack so the alignment is unambiguous.
          Positioned.fill(
            child: Center(
              child: AnimatedBuilder(
                animation: _glowCtrl,
                builder: (_, __) {
                  final t = Curves.easeOut.transform(_glowCtrl.value);
                  return IgnorePointer(
                    child: Opacity(
                      opacity: 0.7 * t,
                      child: Transform.scale(
                        scale: 0.4 + 0.6 * t,
                        child: Container(
                          width: 380, height: 380,
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: RadialGradient(
                              colors: [_kPeach, Color(0x00F4DCC1)],
                              stops: [0, 0.65],
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),

          // Mark + wordmark + tagline — Center wrapper guarantees vertical +
          // horizontal centering regardless of Stack fit semantics.
          Positioned.fill(
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ScaleTransition(
                    scale: CurvedAnimation(
                      parent: _markCtrl,
                      curve: Curves.easeOutBack,
                    ).drive(Tween(begin: 0.6, end: 1.0)),
                    child: FadeTransition(
                      opacity: _markCtrl,
                      child: _BrandMark(logoUrl: _logoUrl, size: 88),
                    ),
                  ),
                  const SizedBox(height: 20),
                  FadeTransition(
                    opacity: _textCtrl,
                    child: Text(
                      wordmark.toUpperCase(),
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w700,
                        color: _kInk,
                        letterSpacing: 6,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  FadeTransition(
                    opacity: _textCtrl,
                    child: const Text(
                      'TRAIN · TRACK · SHARE',
                      style: TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w500,
                        color: _kInk2, letterSpacing: 1.5,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Footer hint — anchored to bottom regardless of layout.
          Positioned(
            left: 0, right: 0,
            bottom: 64 + MediaQuery.of(context).padding.bottom,
            child: Center(
              child: FadeTransition(
                opacity: _hintCtrl,
                child: Text(
                  Env.isWhiteLabel ? 'Powered by CLBY' : 'Loading your gym…',
                  style: const TextStyle(
                    fontSize: 12, fontWeight: FontWeight.w500,
                    color: _kInk3, letterSpacing: 0.5,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// Dark rounded square with the dumbbell mark, or the gym's logo when cached.
class _BrandMark extends StatelessWidget {
  final String? logoUrl;
  final double size;
  const _BrandMark({required this.logoUrl, required this.size});

  @override
  Widget build(BuildContext context) {
    final radius = size * 0.28;
    final shadow = BoxShadow(
      color: const Color(0x2D1F1A14),
      blurRadius: size * 0.32,
      offset: Offset(0, size * 0.12),
    );
    // White-label: brand asset wins, no need to wait on the network.
    if (Env.isWhiteLabel) {
      return _DefaultMark(size: size);
    }
    if (logoUrl != null && logoUrl!.isNotEmpty) {
      return Container(
        width: size, height: size,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(radius),
          boxShadow: [shadow],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(radius),
          child: CachedNetworkImage(
            imageUrl: logoUrl!,
            width: size, height: size,
            fit: BoxFit.contain,
            placeholder: (_, __) => _DefaultMark(size: size),
            errorWidget: (_, __, ___) => _DefaultMark(size: size),
          ),
        ),
      );
    }
    return _DefaultMark(size: size);
  }
}

// Default mark: the active flavor's app icon. When a gym uploads its own logo,
// _BrandMark renders that instead via CachedNetworkImage.
class _DefaultMark extends StatelessWidget {
  final double size;
  const _DefaultMark({required this.size});

  @override
  Widget build(BuildContext context) {
    final radius = size * 0.28;
    return Container(
      width: size, height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        boxShadow: [
          BoxShadow(
            color: const Color(0x2D1F1A14),
            blurRadius: size * 0.32,
            offset: Offset(0, size * 0.12),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: Image.asset(
          Env.brandLogoAsset,
          width: size, height: size,
          fit: BoxFit.contain,
        ),
      ),
    );
  }
}
