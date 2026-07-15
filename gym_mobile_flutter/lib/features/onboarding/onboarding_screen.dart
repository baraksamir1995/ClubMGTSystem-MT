import 'package:clby/l10n/l10n.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import 'data/onboarding_data.dart';
import 'widgets/onboarding_page_widget.dart';
import 'widgets/page_indicator.dart';
import '../../utils/env.dart';
import '../../services/api_service.dart';

const _kBg          = Color(0xFFF7F6F2);
const _kInk         = Color(0xFF1F1A14);
const _kInk2        = Color(0x9E1F1A14);
const _kPrimary     = Color(0xFFE07A3B);
const _kInkSubtle   = Color(0x0D1F1A14);

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
      // Fall back to defaults silently.
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
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeInOutCubic,
      );
    }
  }

  void _back() {
    if (_currentPage > 0) {
      _pageController.previousPage(
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeInOutCubic,
      );
    }
  }

  Future<void> _finishOnboarding() async {
    await _storage.write(key: _onboardingKey, value: 'true');
    if (!mounted) return;
    context.go('/welcome');
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
    final topPadding = MediaQuery.of(context).padding.top;

    return Scaffold(
      backgroundColor: _kBg,
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            SizedBox(height: topPadding + 16),
            // Top bar — back (slides 2-3) + Skip
            Padding(
              padding: const EdgeInsets.fromLTRB(22, 0, 22, 0),
              child: Row(
                children: [
                  if (_currentPage > 0)
                    _RoundIconButton(icon: Icons.arrow_back_ios_new_rounded, onTap: _back)
                  else
                    const SizedBox(width: 38, height: 38),
                  const Spacer(),
                  TextButton(
                    onPressed: _finishOnboarding,
                    style: TextButton.styleFrom(
                      foregroundColor: _kInk2,
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: Text(
                      context.l10n.commonSkip,
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),

            // Hero illustration
            Expanded(
              child: PageView.builder(
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
            ),

            // Title + body
            Padding(
              padding: const EdgeInsets.fromLTRB(28, 0, 28, 12),
              child: Column(
                children: [
                  Text(
                    item.title,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w700,
                      color: _kInk,
                      letterSpacing: -0.6,
                      height: 1.2,
                    ),
                  ),
                  const SizedBox(height: 12),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 320),
                    child: Text(
                      item.description,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 15, color: _kInk2, height: 1.55,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Dot indicator
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 14),
              child: PageIndicator(count: _items.length, current: _currentPage),
            ),

            // Continue / Get started CTA
            Padding(
              padding: EdgeInsets.fromLTRB(22, 4, 22, 22 + bottomPadding),
              child: SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: _onNext,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _kPrimary,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shadowColor: const Color(0x57E07A3B),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ).copyWith(
                    elevation: WidgetStateProperty.resolveWith((states) {
                      if (states.contains(WidgetState.disabled)) return 0;
                      return 10;
                    }),
                  ),
                  child: Text(
                    _isLastPage
                        ? context.l10n.onboardingGetStarted
                        : context.l10n.onboardingContinue,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      letterSpacing: -0.1,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RoundIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _RoundIconButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: 38, height: 38,
        decoration: const BoxDecoration(
          color: _kInkSubtle,
          shape: BoxShape.circle,
        ),
        alignment: Alignment.center,
        child: Icon(icon, size: 16, color: _kInk),
      ),
    );
  }
}
