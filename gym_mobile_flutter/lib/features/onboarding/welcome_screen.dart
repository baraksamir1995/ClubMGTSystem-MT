import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../utils/env.dart';
import '../../widgets/legal_links.dart';

const _kBg          = Color(0xFFF7F6F2);
const _kInk         = Color(0xFF1F1A14);
const _kInk2        = Color(0x9E1F1A14);
const _kInk3        = Color(0x6B1F1A14);
const _kPeach       = Color(0xFFF4DCC1);
const _kPrimary     = Color(0xFFE07A3B);

/// Decision screen shown after onboarding completes.
/// Routes to /register for new users, /login for returning ones, with an
/// optional guest entry on white-label builds.
class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key});

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen> {
  bool _guestLoading = false;

  Future<void> _continueAsGuest() async {
    setState(() => _guestLoading = true);
    await context.read<AuthProvider>().continueAsGuest();
    if (!mounted) return;
    setState(() => _guestLoading = false);
    context.go('/guest/home');
  }

  @override
  Widget build(BuildContext context) {
    final showGuest = Env.isWhiteLabel;
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    return Scaffold(
      backgroundColor: _kBg,
      body: Stack(
        children: [
          // Peach radial glow at the top.
          Positioned(
            top: -80,
            left: 0, right: 0,
            child: IgnorePointer(
              child: Center(
                child: Opacity(
                  opacity: 0.65,
                  child: Container(
                    width: 460, height: 460,
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
            ),
          ),
          SafeArea(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(22, 16, 22, 0),
                  child: Row(
                    children: [
                      _RoundIconButton(
                        icon: Icons.arrow_back_ios_new_rounded,
                        onTap: () => context.go('/onboarding'),
                      ),
                      const Spacer(),
                    ],
                  ),
                ),
                const Spacer(),
                const _BrandMark(size: 84),
                const SizedBox(height: 26),
                const _WelcomeTitle(),
                const SizedBox(height: 14),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 320),
                  child: Text(
                    "Your gym, your sessions, your friends — all in one place. Let's get you set up.",
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 15, color: _kInk2, height: 1.55),
                  ),
                ),
                const Spacer(),
                Padding(
                  padding: EdgeInsets.fromLTRB(22, 12, 22, 22 + bottomPadding),
                  child: Column(
                    children: [
                      SizedBox(
                        width: double.infinity,
                        height: 56,
                        child: ElevatedButton(
                          onPressed: () => context.go('/register'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _kPrimary,
                            foregroundColor: Colors.white,
                            elevation: 10,
                            shadowColor: const Color(0x57E07A3B),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          ),
                          child: const Text(
                            'Create account',
                            style: TextStyle(
                              fontSize: 16, fontWeight: FontWeight.w600, letterSpacing: -0.1,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      SizedBox(
                        width: double.infinity,
                        height: 56,
                        child: OutlinedButton(
                          onPressed: () => context.go('/login'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: _kInk,
                            side: const BorderSide(color: _kInk, width: 1.6),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          ),
                          child: const Text(
                            'I already have an account',
                            style: TextStyle(
                              fontSize: 16, fontWeight: FontWeight.w600, letterSpacing: -0.1,
                            ),
                          ),
                        ),
                      ),
                      if (showGuest) ...[
                        const SizedBox(height: 6),
                        TextButton(
                          onPressed: _guestLoading ? null : _continueAsGuest,
                          style: TextButton.styleFrom(
                            foregroundColor: _kInk2,
                          ),
                          child: _guestLoading
                              ? const SizedBox(
                                  width: 18, height: 18,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: _kInk2),
                                )
                              : const Text(
                                  'Continue as guest',
                                  style: TextStyle(
                                    fontSize: 14, fontWeight: FontWeight.w500,
                                  ),
                                ),
                        ),
                      ],
                      const SizedBox(height: 10),
                      DefaultTextStyle(
                        style: const TextStyle(
                          fontSize: 11, color: _kInk3, height: 1.5,
                          fontWeight: FontWeight.w500,
                        ),
                        textAlign: TextAlign.center,
                        child: const LegalConsentLine(
                          prefix: 'By continuing, you agree to our ',
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
    );
  }
}

class _WelcomeTitle extends StatelessWidget {
  const _WelcomeTitle();

  @override
  Widget build(BuildContext context) {
    return RichText(
      textAlign: TextAlign.center,
      text: const TextSpan(
        style: TextStyle(
          fontSize: 32, fontWeight: FontWeight.w700,
          color: _kInk, letterSpacing: -0.8, height: 1.15,
        ),
        children: [
          TextSpan(text: 'Welcome to '),
          TextSpan(text: 'CLBY', style: TextStyle(color: _kPrimary)),
        ],
      ),
    );
  }
}

class _BrandMark extends StatelessWidget {
  final double size;
  const _BrandMark({required this.size});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size, height: size,
      decoration: BoxDecoration(
        color: _kInk,
        borderRadius: BorderRadius.circular(size * 0.28),
        boxShadow: [
          BoxShadow(
            color: const Color(0x2D1F1A14),
            blurRadius: size * 0.32,
            offset: Offset(0, size * 0.12),
          ),
        ],
      ),
      child: CustomPaint(painter: _DumbbellPainter(size: size * 0.6)),
    );
  }
}

class _DumbbellPainter extends CustomPainter {
  final double size;
  const _DumbbellPainter({required this.size});

  @override
  void paint(Canvas canvas, Size canvasSize) {
    final scale = size / 24.0;
    final dx = (canvasSize.width - size) / 2;
    final dy = (canvasSize.height - size) / 2;
    final orange = Paint()..color = _kPrimary;
    final white = Paint()..color = Colors.white;
    void rect(double x, double y, double w, double h, double r, Paint p) {
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(dx + x * scale, dy + y * scale, w * scale, h * scale),
          Radius.circular(r * scale),
        ),
        p,
      );
    }
    rect(2, 9, 3, 6, 1, orange);
    rect(19, 9, 3, 6, 1, orange);
    rect(7, 11, 10, 2, 1, white);
  }

  @override
  bool shouldRepaint(_DumbbellPainter old) => false;
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
          color: Color(0x0D1F1A14),
          shape: BoxShape.circle,
        ),
        alignment: Alignment.center,
        child: Icon(icon, size: 16, color: _kInk),
      ),
    );
  }
}
