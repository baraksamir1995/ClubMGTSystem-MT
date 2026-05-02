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
  bool _obscure   = true;
  bool _isLoading = false;
  bool _submitted = false;

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
        backgroundColor: kAuthCard,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Verify your email', style: TextStyle(color: kAuthInk, fontWeight: FontWeight.w600)),
        content: const Text(
          "We sent a confirmation link when you signed up. Tap the link in the email to activate your account. Check spam if you can't find it.",
          style: TextStyle(color: kAuthInk2, height: 1.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Close', style: TextStyle(color: kAuthInk2)),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: kAuthPrimary),
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
      backgroundColor: kAuthError,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final keyboard = MediaQuery.of(context).viewInsets.bottom;
    final safeBottom = MediaQuery.of(context).padding.bottom;
    return Scaffold(
      backgroundColor: kAuthBg,
      resizeToAvoidBottomInset: true,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(24, 32, 24, 16 + safeBottom + keyboard),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const AuthMark(size: 48),
              const SizedBox(height: 24),
              const Text(
                'Welcome back',
                style: TextStyle(
                  fontSize: 32, fontWeight: FontWeight.w600,
                  color: kAuthInk, letterSpacing: -0.8, height: 1.1,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Sign in to manage your sessions and transfers.',
                style: TextStyle(fontSize: 15, color: kAuthInk2, height: 1.5),
              ),
              const SizedBox(height: 28),

              AuthField(
                label: 'Email',
                controller: _emailCtrl,
                placeholder: 'you@example.com',
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                leading: const Icon(Icons.mail_outline_rounded, size: 18, color: kAuthInk2),
                errorText: _emailError,
              ),
              const SizedBox(height: 14),

              AuthField(
                label: 'Password',
                controller: _passwordCtrl,
                placeholder: '••••••••',
                isPassword: true,
                obscureText: _obscure,
                onToggleObscure: () => setState(() => _obscure = !_obscure),
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _signIn(),
                leading: const Icon(Icons.lock_outline_rounded, size: 18, color: kAuthInk2),
                errorText: _passwordError,
              ),

              Align(
                alignment: Alignment.centerRight,
                child: AuthTextLink(
                  text: 'Forgot password?',
                  onTap: () => context.push('/forgot-password'),
                ),
              ),
              const SizedBox(height: 24),

              AuthButton(
                label: 'Sign in',
                isLoading: _isLoading,
                enabled: _isFormValid,
                onTap: _signIn,
              ),
              const SizedBox(height: 18),

              Center(
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'New here? ',
                      style: TextStyle(fontSize: 14, color: kAuthInk2),
                    ),
                    AuthTextLink(
                      text: 'Create an account',
                      onTap: () => context.go('/register'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
