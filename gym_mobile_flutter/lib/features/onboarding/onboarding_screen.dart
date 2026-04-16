import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'data/onboarding_data.dart';
import 'widgets/onboarding_page_widget.dart';
import 'widgets/page_indicator.dart';
import '../../utils/env.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _pageController = PageController();
  static const _storage = FlutterSecureStorage();
  static const _onboardingKey = 'onboarding_completed';

  int _currentPage = 0;
  double _pageOffset = 0.0;
  bool _isGuestLoading = false;
  List<OnboardingItem>? _remoteItems;

  List<OnboardingItem> get _items => _remoteItems ?? defaultOnboardingItems;
  bool get _isLastPage => _currentPage == _items.length - 1;

  @override
  void initState() {
    super.initState();
    _pageController.addListener(_onPageScroll);
    _loadRemoteSlides();
  }

  Future<void> _loadRemoteSlides() async {
    if (!Env.isWhiteLabel) return; // marketplace build — use defaults
    try {
      final slides = await ApiService().getOnboardingSlides(Env.gymId);
      if (slides.isNotEmpty && mounted) {
        setState(() {
          _remoteItems = slides.map((s) => OnboardingItem(
            title: s['title'] ?? '',
            description: s['description'] ?? '',
            icon: Icons.fitness_center_rounded,
            imageUrl: s['image_url'],
            sortOrder: s['sort_order'] ?? 0,
          )).toList();
        });
      }
    } catch (_) {
      // Fall back to defaults silently
    }
  }

  void _onPageScroll() {
    setState(() {
      _pageOffset = _pageController.page ?? 0.0;
    });
  }

  Future<void> _onNext() async {
    if (_isLastPage) {
      await _finishOnboarding();
    } else {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOutCubic,
      );
    }
  }

  Future<void> _finishOnboarding() async {
    await _storage.write(key: _onboardingKey, value: 'true');
    if (!mounted) return;
    context.go('/login');
  }

  Future<void> _continueAsGuest() async {
    await _storage.write(key: _onboardingKey, value: 'true');
    if (!mounted) return;
    setState(() => _isGuestLoading = true);
    await context.read<AuthProvider>().continueAsGuest();
    if (!mounted) return;
    setState(() => _isGuestLoading = false);
    context.go('/guest/home');
  }

  @override
  void dispose() {
    _pageController.removeListener(_onPageScroll);
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final item = _items[_currentPage];
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // ── Top section: purple gradient background + illustration ──
          Positioned.fill(
            bottom: 280 + bottomPadding,
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0xFF9333EA), // purple-600
                    Color(0xFF7C3AED), // purple-500
                    Color(0xFF6D28D9), // purple-700
                  ],
                ),
              ),
              child: SafeArea(
                bottom: false,
                child: Stack(
                  children: [
                    // Skip button
                    if (!_isLastPage)
                      Positioned(
                        top: 8,
                        right: 16,
                        child: TextButton(
                          onPressed: _finishOnboarding,
                          style: TextButton.styleFrom(
                            foregroundColor: Colors.white.withValues(alpha: 0.9),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 8,
                            ),
                          ),
                          child: const Text(
                            'Skip',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ),

                    // Page view with illustrations
                    PageView.builder(
                      controller: _pageController,
                      itemCount: _items.length,
                      onPageChanged: (i) => setState(() => _currentPage = i),
                      itemBuilder: (context, index) {
                        final offset = _pageOffset - index;
                        return OnboardingPageWidget(
                          item: _items[index],
                          pageOffset: offset,
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
          ),

          // ── Bottom card: content + controls ──
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              padding: EdgeInsets.fromLTRB(28, 28, 28, 24 + bottomPadding),
              decoration: const BoxDecoration(
                color: Color(0xFF1A1025), // dark purple-black
                borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Dot indicator
                  PageIndicator(
                    count: _items.length,
                    current: _currentPage,
                    activeColor: Colors.white,
                  ),
                  const SizedBox(height: 24),

                  // Title
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      item.title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        height: 1.2,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Description
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      item.description,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.6),
                        fontSize: 15,
                        height: 1.5,
                      ),
                    ),
                  ),
                  const SizedBox(height: 28),

                  // CTA button — white pill
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      onPressed: _onNext,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: Colors.black,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(28),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _isLastPage ? 'Get Started' : 'Next',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(width: 8),
                          const Icon(Icons.arrow_forward_rounded, size: 20),
                        ],
                      ),
                    ),
                  ),

                  // "Continue as Guest" — only on last page, only for white-label builds
                  if (_isLastPage && Env.isWhiteLabel) ...[
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: _isGuestLoading ? null : _continueAsGuest,
                      child: _isGuestLoading
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white54,
                              ),
                            )
                          : Text(
                              'Continue as Guest',
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.5),
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                    ),
                  ] else ...[
                    // Down arrow hint
                    const SizedBox(height: 8),
                    Icon(
                      Icons.keyboard_arrow_down_rounded,
                      color: Colors.white.withValues(alpha: 0.3),
                      size: 28,
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
