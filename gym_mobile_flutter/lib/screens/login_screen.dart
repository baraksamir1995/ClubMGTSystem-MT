import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:clby/l10n/l10n.dart';
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
    if (_emailCtrl.text.trim().isEmpty) return context.l10n.loginEmailRequired;
    if (!RegExp(r'^[^@]+@[^@]+\.[^@]+').hasMatch(_emailCtrl.text.trim())) {
      return context.l10n.authEmailInvalid;
    }
    return null;
  }

  String? get _passwordError {
    if (!_submitted) return null;
    if (_passwordCtrl.text.isEmpty) return context.l10n.loginPasswordRequired;
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
        _err(context.l10n.loginAccountDeleted);
      } else if (lower.contains('verify your email') || lower.contains('not verified') || lower.contains('email not confirmed')) {
        _showUnverifiedEmailSheet(_emailCtrl.text.trim());
      } else if (lower.contains('invalid login') || lower.contains('invalid credentials')) {
        _err(context.l10n.loginInvalidCredentials);
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
        title: Text(context.l10n.loginVerifyEmailTitle, style: const TextStyle(color: kAuthInk, fontWeight: FontWeight.w600)),
        content: Text(
          context.l10n.loginVerifyEmailBody,
          style: const TextStyle(color: kAuthInk2, height: 1.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(context.l10n.commonClose, style: const TextStyle(color: kAuthInk2)),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: kAuthPrimary),
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                await ApiService().resendVerificationEmail(email);
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                  content: Text(context.l10n.loginVerificationSent),
                ));
              } catch (_) {
                if (!mounted) return;
                _err(context.l10n.loginResendFailed);
              }
            },
            child: Text(context.l10n.loginResendEmail),
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
              Text(
                context.l10n.loginWelcomeBack,
                style: const TextStyle(
                  fontSize: 32, fontWeight: FontWeight.w600,
                  color: kAuthInk, letterSpacing: -0.8, height: 1.1,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                context.l10n.loginSubtitle,
                style: const TextStyle(fontSize: 15, color: kAuthInk2, height: 1.5),
              ),
              const SizedBox(height: 28),

              AuthField(
                label: context.l10n.authEmailLabel,
                controller: _emailCtrl,
                placeholder: context.l10n.authEmailPlaceholder,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                leading: const Icon(Icons.mail_outline_rounded, size: 18, color: kAuthInk2),
                errorText: _emailError,
              ),
              const SizedBox(height: 14),

              AuthField(
                label: context.l10n.authPasswordLabel,
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
                alignment: AlignmentDirectional.centerEnd,
                child: AuthTextLink(
                  text: context.l10n.authForgotPassword,
                  onTap: () => context.push('/forgot-password'),
                ),
              ),
              const SizedBox(height: 24),

              AuthButton(
                label: context.l10n.authSignIn,
                isLoading: _isLoading,
                enabled: _isFormValid,
                onTap: _signIn,
              ),
              const SizedBox(height: 18),

              Center(
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      context.l10n.loginNewHere,
                      style: const TextStyle(fontSize: 14, color: kAuthInk2),
                    ),
                    AuthTextLink(
                      text: context.l10n.loginCreateAccount,
                      onTap: () => context.go('/register'),
                    ),
                  ],
                ),
              ),
              const PoweredByClby(),
            ],
          ),
        ),
      ),
    );
  }
}
