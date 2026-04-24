import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../features/auth/auth_widgets.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailCtrl    = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _obscure        = true;
  bool _isLoading      = false;
  bool _submitted      = false;

  @override
  void initState() {
    super.initState();
    _emailCtrl.addListener(_onFieldChanged);
    _passwordCtrl.addListener(_onFieldChanged);
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  void _onFieldChanged() => setState(() {});

  bool get _isFormValid =>
      _emailCtrl.text.trim().isNotEmpty && _passwordCtrl.text.isNotEmpty;

  String? get _emailError {
    if (!_submitted) return null;
    if (_emailCtrl.text.trim().isEmpty) return 'Email is required';
    if (!RegExp(r'^[^@]+@[^@]+\.[^@]+').hasMatch(_emailCtrl.text.trim())) {
      return 'Enter a valid email address';
    }
    return null;
  }

  String? get _passwordError {
    if (!_submitted) return null;
    if (_passwordCtrl.text.isEmpty) return 'Password is required';
    return null;
  }

  Future<void> _signIn() async {
    setState(() => _submitted = true);
    if (!_isFormValid) return;

    setState(() => _isLoading = true);
    final error = await context.read<AuthProvider>().signIn(
      _emailCtrl.text.trim(),
      _passwordCtrl.text,
    );
    if (!mounted) return;
    setState(() => _isLoading = false);
    if (error != null) {
      final lower = error.toLowerCase();
      if (lower.contains('banned') || lower.contains('user is banned')) {
        _err('This account has been deleted. You can still restore it by signing up again.');
      } else if (lower.contains('verify your email') || lower.contains('not verified') || lower.contains('email not confirmed')) {
        _showUnverifiedEmailSheet(_emailCtrl.text.trim());
      } else if (lower.contains('invalid login') || lower.contains('invalid credentials')) {
        _err('Incorrect email or password.');
      } else {
        _err(error);
      }
    } else {
      context.go('/home');
    }
  }

  void _showUnverifiedEmailSheet(String email) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Verify your email'),
        content: const Text(
          'We sent a confirmation link when you signed up. Tap the link in the email to activate your account. Check spam if you can’t find it.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Close'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                await ApiService().resendVerificationEmail(email);
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                  content: Text('Verification email sent. Check your inbox.'),
                ));
              } catch (_) {
                if (!mounted) return;
                _err('Could not resend. Try again in a minute.');
              }
            },
            child: const Text('Resend email'),
          ),
        ],
      ),
    );
  }

  void _err(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: Colors.red.shade700,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kAuthBg,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 40, 24, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const GymBranding(),
              const SizedBox(height: 22),
              const Text(
                'Welcome back',
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w500,
                  color: kAuthText,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Sign in to continue',
                style: TextStyle(fontSize: 14, color: kAuthSec),
              ),
              const SizedBox(height: 28),

              // Email
              AuthField(
                label: 'Email address',
                controller: _emailCtrl,
                placeholder: 'you@email.com',
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                errorText: _emailError,
              ),
              const SizedBox(height: 14),

              // Password
              AuthField(
                label: 'Password',
                controller: _passwordCtrl,
                placeholder: 'Your password',
                isPassword: true,
                obscureText: _obscure,
                onToggleObscure: () => setState(() => _obscure = !_obscure),
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _signIn(),
                errorText: _passwordError,
              ),

              // Forgot password
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => context.push('/forgot-password'),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: const Text(
                    'Forgot password?',
                    style: TextStyle(
                      fontSize: 13,
                      color: kAuthPrimary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 4),

              AuthButton(
                label: 'Sign in',
                isLoading: _isLoading,
                enabled: _isFormValid,
                onTap: _signIn,
              ),
              const SizedBox(height: 32),

              Center(
                child: GestureDetector(
                  onTap: () => context.go('/register'),
                  child: RichText(
                    text: const TextSpan(
                      style: TextStyle(fontSize: 13, color: kAuthSec),
                      children: [
                        TextSpan(text: 'No account? '),
                        TextSpan(
                          text: 'Sign up',
                          style: TextStyle(
                            color: kAuthPrimary,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
