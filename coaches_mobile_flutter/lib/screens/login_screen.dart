import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../core/constants/app_colors.dart';
import '../core/constants/app_text.dart';
import '../providers/auth_provider.dart';
import '../widgets/auth_widgets.dart';

/// CLBY · COACH PORTAL — dark login.
///
/// Faithful port of `coach-login.jsx`: lime + violet ambient glows, CLBY
/// wordmark, mono uppercase labels, dark inputs with lime focus, lime CTA,
/// and the static "Forgot password? Contact your gym admin." footer.
///
/// **No signup.** Credentials are provisioned by a gym admin via the
/// `/dashboard/specialists` flow in gym-admin. The design field label is
/// "Username"; in this build the backend authenticates by email, so the
/// field accepts the email the admin set up (we keep the design label as
/// "USERNAME" but use an email keyboard + validate as an email).
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _userCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _obscure = true;
  bool _isLoading = false;
  String? _err;

  @override
  void initState() {
    super.initState();
    _userCtrl.addListener(_onFieldChanged);
    _passwordCtrl.addListener(_onFieldChanged);
  }

  @override
  void dispose() {
    _userCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  void _onFieldChanged() => setState(() {});

  bool get _isFormValid =>
      _userCtrl.text.trim().isNotEmpty && _passwordCtrl.text.isNotEmpty;

  Future<void> _signIn() async {
    final user = _userCtrl.text.trim();
    final pass = _passwordCtrl.text;
    if (user.isEmpty || pass.isEmpty) {
      setState(() => _err = 'Username and password are required.');
      return;
    }
    setState(() {
      _isLoading = true;
      _err = null;
    });
    final error = await context.read<AuthProvider>().signIn(user, pass);
    if (!mounted) return;
    setState(() => _isLoading = false);
    if (error != null) {
      final lower = error.toLowerCase();
      // Backend says "Invalid credentials." — surface the design's copy.
      final friendly = (lower.contains('invalid') || lower.contains('credentials'))
          ? 'Incorrect username or password.'
          : error;
      setState(() => _err = friendly);
    } else {
      context.go('/home');
    }
  }

  @override
  Widget build(BuildContext context) {
    final keyboard = MediaQuery.of(context).viewInsets.bottom;
    final safeBottom = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      backgroundColor: AppColors.bg,
      resizeToAvoidBottomInset: true,
      body: Stack(
        children: [
          // Ambient primary glow (top-right). The design uses a radial
          // gradient; we approximate with a soft disc fading at the edge.
          Positioned(
            top: -120,
            right: -120,
            child: _AmbientGlow(
              size: 320,
              color: AppColors.primary.withValues(alpha: 0.14),
            ),
          ),
          // Secondary glow (top-left).
          Positioned(
            top: -200,
            left: -100,
            child: _AmbientGlow(
              size: 260,
              color: AppColors.secondary.withValues(alpha: 0.10),
            ),
          ),
          SafeArea(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(
                28,
                64,
                28,
                24 + safeBottom + keyboard,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 26),
                  const GymBrandHeader(size: 40, subLabel: 'COACH PORTAL'),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: 280,
                    child: Text(
                      'Sign in with the credentials provisioned by your gym admin.',
                      style: AppText.body(
                        size: 14,
                        color: AppColors.textSec,
                        height: 1.45,
                      ),
                    ),
                  ),
                  const SizedBox(height: 36),
                  AuthField(
                    label: 'Username',
                    controller: _userCtrl,
                    placeholder: 'coach@yourgym.com',
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.next,
                    textCapitalization: TextCapitalization.none,
                  ),
                  const SizedBox(height: 18),
                  AuthField(
                    label: 'Password',
                    controller: _passwordCtrl,
                    placeholder: '••••••••',
                    isPassword: true,
                    obscureText: _obscure,
                    onToggleObscure: () => setState(() => _obscure = !_obscure),
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _signIn(),
                  ),
                  if (_err != null) ...[
                    const SizedBox(height: 18),
                    AuthErrorBanner(message: _err!),
                  ],
                  const SizedBox(height: 22),
                  AuthButton(
                    label: 'Sign in',
                    isLoading: _isLoading,
                    enabled: _isFormValid,
                    onTap: _signIn,
                  ),
                  const SizedBox(height: 60),
                  Center(
                    child: Text(
                      'Forgot password? Contact your gym admin.',
                      style: AppText.body(
                        size: 12,
                        color: AppColors.textTer,
                        letterSpacing: -0.1,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Soft circular glow used behind the wordmark. Flutter has no `radial-
/// gradient` filter primitive that matches CSS exactly, so we approximate:
/// a soft disc with a wide blur, fading the outer edge.
class _AmbientGlow extends StatelessWidget {
  final double size;
  final Color color;

  const _AmbientGlow({required this.size, required this.color});

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: [color, color.withValues(alpha: 0)],
            stops: const [0.0, 0.7],
          ),
        ),
      ),
    );
  }
}
