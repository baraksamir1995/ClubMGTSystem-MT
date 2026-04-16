import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../features/auth/auth_widgets.dart';
import '../services/api_service.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  // 0 = email form, 1 = confirmation (link sent)
  int _step = 0;

  final _emailCtrl = TextEditingController();
  bool _isLoading  = false;

  // Resend countdown
  Timer? _resendTimer;
  int _resendSeconds = 60;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _resendTimer?.cancel();
    super.dispose();
  }

  // ── Send reset link ───────────────────────────────────────────────────────────
  Future<void> _send() async {
    final email = _emailCtrl.text.trim();
    if (email.isEmpty) { _err('Please enter your email'); return; }
    if (!RegExp(r'^[^@]+@[^@]+\.[^@]+').hasMatch(email)) {
      _err('Enter a valid email address');
      return;
    }

    setState(() => _isLoading = true);
    try {
      await ApiService().resetPasswordForEmail(email);
      if (!mounted) return;
      setState(() {
        _step = 1;
        _isLoading = false;
      });
      _startResendTimer();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      _err(e.message);
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      _err('Something went wrong. Please try again.');
    }
  }

  // ── Resend countdown ─────────────────────────────────────────────────────────
  void _startResendTimer() {
    _resendSeconds = 60;
    _resendTimer?.cancel();
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) { t.cancel(); return; }
      setState(() {
        if (_resendSeconds > 0) {
          _resendSeconds--;
        } else {
          t.cancel();
        }
      });
    });
  }

  Future<void> _resend() async {
    if (_resendSeconds > 0) return;
    await _send();
  }

  void _err(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: Colors.red.shade700,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ));
  }

  // ── Build ────────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kAuthBg,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 28, 24, 32),
          child: _step == 0 ? _buildEmailStep() : _buildConfirmationStep(),
        ),
      ),
    );
  }

  // ── Step 0: Email form ───────────────────────────────────────────────────────
  Widget _buildEmailStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AuthBackButton(onTap: () => context.pop()),
        const SizedBox(height: 22),
        Container(
          width: 54, height: 54,
          decoration: BoxDecoration(
            color: const Color(0xFFEEEDFE),
            borderRadius: BorderRadius.circular(16),
          ),
          child: const Icon(Icons.lock_outline_rounded, color: kAuthPrimary, size: 26),
        ),
        const SizedBox(height: 22),
        const Text(
          'Forgot your\npassword?',
          style: TextStyle(
            fontSize: 24, fontWeight: FontWeight.w500,
            color: kAuthText, letterSpacing: -0.4, height: 1.2,
          ),
        ),
        const SizedBox(height: 8),
        const Text(
          "No worries. Enter your email and we'll send you a reset link.",
          style: TextStyle(fontSize: 14, color: kAuthSec, height: 1.65),
        ),
        const SizedBox(height: 28),
        AuthField(
          label: 'Email address',
          controller: _emailCtrl,
          placeholder: 'you@email.com',
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _send(),
        ),
        const SizedBox(height: 28),
        AuthButton(
          label: 'Send reset link',
          isLoading: _isLoading,
          onTap: _send,
        ),
      ],
    );
  }

  // ── Step 1: Confirmation (link sent) ─────────────────────────────────────────
  Widget _buildConfirmationStep() {
    final canResend = _resendSeconds == 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AuthBackButton(onTap: () {
          _resendTimer?.cancel();
          setState(() { _step = 0; });
        }),
        const SizedBox(height: 22),

        // Icon
        Container(
          width: 54, height: 54,
          decoration: BoxDecoration(
            color: const Color(0xFFE1F5EE),
            borderRadius: BorderRadius.circular(16),
          ),
          child: const Icon(Icons.mark_email_read_outlined,
              color: kAuthGreen, size: 26),
        ),
        const SizedBox(height: 22),

        const Text(
          'Check your email',
          style: TextStyle(
            fontSize: 24, fontWeight: FontWeight.w500,
            color: kAuthText, letterSpacing: -0.4,
          ),
        ),
        const SizedBox(height: 8),
        RichText(
          text: TextSpan(
            style: const TextStyle(fontSize: 14, color: kAuthSec, height: 1.65),
            children: [
              const TextSpan(text: 'We sent a password reset link to '),
              TextSpan(
                text: _emailCtrl.text.trim(),
                style: const TextStyle(color: kAuthText, fontWeight: FontWeight.w500),
              ),
              const TextSpan(
                text: '. Tap the link in that email to set a new password.',
              ),
            ],
          ),
        ),
        const SizedBox(height: 32),

        // Info card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFF0F0FF),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFD4D1F5), width: 1),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.info_outline_rounded,
                  color: kAuthPrimary, size: 18),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  "The link will open the app directly on the new password screen. Check your spam folder if you don't see it.",
                  style: TextStyle(
                    fontSize: 13,
                    color: kAuthSec,
                    height: 1.5,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 32),

        // Resend
        Center(
          child: GestureDetector(
            onTap: canResend ? _resend : null,
            child: RichText(
              text: TextSpan(
                style: const TextStyle(fontSize: 13, color: kAuthPh),
                children: canResend
                    ? [
                        TextSpan(
                          text: 'Resend link',
                          style: TextStyle(
                            color: _isLoading ? kAuthPh : kAuthPrimary,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ]
                    : [
                        const TextSpan(text: 'Resend in '),
                        TextSpan(
                          text: '${_resendSeconds}s',
                          style: const TextStyle(
                              color: kAuthPrimary, fontWeight: FontWeight.w500),
                        ),
                      ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 32),

        // Back to sign in
        AuthButton(
          label: 'Back to Sign In',
          isLoading: _isLoading,
          isGhost: true,
          onTap: () => context.go('/login'),
        ),
      ],
    );
  }
}
