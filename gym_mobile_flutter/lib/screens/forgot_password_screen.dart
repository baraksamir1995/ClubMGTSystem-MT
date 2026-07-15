import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:clby/l10n/l10n.dart';
import '../features/auth/auth_widgets.dart';
import '../services/api_service.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  // 0 = email form, 1 = link sent
  int _step = 0;

  final _emailCtrl = TextEditingController();
  bool _isLoading  = false;
  bool _resendJustNow = false;

  // Resend countdown — backend rate-limits resends; surface a countdown so
  // users don't pound the button while throttled.
  Timer? _resendTimer;
  int _resendSeconds = 60;

  @override
  void initState() {
    super.initState();
    _emailCtrl.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _resendTimer?.cancel();
    super.dispose();
  }

  bool get _emailValid =>
      RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+').hasMatch(_emailCtrl.text.trim());

  Future<void> _send({bool isResend = false}) async {
    final email = _emailCtrl.text.trim();
    if (!_emailValid) { _err(context.l10n.authEmailInvalid); return; }

    setState(() => _isLoading = true);
    try {
      await ApiService().resetPasswordForEmail(email);
      if (!mounted) return;
      setState(() {
        _step = 1;
        _isLoading = false;
        _resendJustNow = isResend;
      });
      _startResendTimer();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      _err(e.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      _err(context.l10n.commonError);
    }
  }

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
          _resendJustNow = false;
        }
      });
    });
  }

  Future<void> _resend() async {
    if (_resendSeconds > 0) return;
    await _send(isResend: true);
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
    return Scaffold(
      backgroundColor: kAuthBg,
      resizeToAvoidBottomInset: true,
      body: SafeArea(
        child: _step == 0 ? _emailStep() : _sentStep(),
      ),
    );
  }

  // ── Step 0: Enter email ─────────────────────────────────────────────────────
  Widget _emailStep() {
    final keyboard = MediaQuery.of(context).viewInsets.bottom;
    final safeBottom = MediaQuery.of(context).padding.bottom;
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(24, 16, 24, 16 + safeBottom + keyboard),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AuthBackButton(onTap: () => context.pop()),
          const SizedBox(height: 28),
          const AuthPeachIcon(icon: Icons.mail_outline_rounded),
          const SizedBox(height: 22),
          Text(
            context.l10n.authForgotPassword,
            style: const TextStyle(
              fontSize: 28, fontWeight: FontWeight.w600,
              color: kAuthInk, letterSpacing: -0.6, height: 1.15,
            ),
          ),
          const SizedBox(height: 8),
          RichText(
            text: TextSpan(
              style: const TextStyle(fontSize: 15, color: kAuthInk2, height: 1.5),
              children: [
                TextSpan(text: context.l10n.forgotIntroPrefix),
                TextSpan(
                  text: context.l10n.forgotIntroDuration,
                  style: const TextStyle(fontWeight: FontWeight.w600, color: kAuthInk),
                ),
                const TextSpan(text: '.'),
              ],
            ),
          ),
          const SizedBox(height: 24),
          AuthField(
            label: context.l10n.authEmailLabel,
            controller: _emailCtrl,
            placeholder: context.l10n.authEmailPlaceholder,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.done,
            autofocus: true,
            leading: const Icon(Icons.mail_outline_rounded, size: 18, color: kAuthInk2),
            onSubmitted: (_) => _send(),
          ),
          const SizedBox(height: 28),
          AuthButton(
            label: context.l10n.forgotSendLink,
            isLoading: _isLoading,
            enabled: _emailValid,
            onTap: _send,
          ),
        ],
      ),
    );
  }

  // ── Step 1: Link sent ───────────────────────────────────────────────────────
  Widget _sentStep() {
    final canResend = _resendSeconds == 0;

    return LayoutBuilder(builder: (ctx, constraints) {
      return SingleChildScrollView(
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: constraints.maxHeight),
          child: IntrinsicHeight(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  AuthBackButton(onTap: () {
                    _resendTimer?.cancel();
                    setState(() { _step = 0; });
                  }),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        const SizedBox(height: 24),
                        // Big peach circle with envelope + sparkle
                        Container(
                          width: 96, height: 96,
                          decoration: const BoxDecoration(
                            color: kAuthPeach,
                            shape: BoxShape.circle,
                          ),
                          alignment: Alignment.center,
                          child: Stack(
                            clipBehavior: Clip.none,
                            children: [
                              const Icon(Icons.mail_outline_rounded, size: 44, color: kAuthInk),
                              PositionedDirectional(
                                top: -4, end: -8,
                                child: Container(
                                  width: 22, height: 22,
                                  decoration: const BoxDecoration(
                                    color: kAuthPrimary,
                                    shape: BoxShape.circle,
                                  ),
                                  alignment: Alignment.center,
                                  child: const Icon(Icons.auto_awesome_rounded, size: 12, color: Colors.white),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 22),
                        Text(
                          context.l10n.forgotCheckEmail,
                          style: const TextStyle(
                            fontSize: 26, fontWeight: FontWeight.w600,
                            color: kAuthInk, letterSpacing: -0.5,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text.rich(
                          TextSpan(
                            style: const TextStyle(fontSize: 15, color: kAuthInk2, height: 1.5),
                            children: [
                              TextSpan(text: '${context.l10n.forgotSentLinkTo}\n'),
                              TextSpan(
                                text: _emailCtrl.text.trim().isEmpty ? context.l10n.authEmailPlaceholder : _emailCtrl.text.trim(),
                                style: const TextStyle(color: kAuthInk, fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 26),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          decoration: BoxDecoration(
                            color: kAuthPeach,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(Icons.info_outline_rounded, size: 18, color: kAuthInk),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  context.l10n.forgotSpamHint,
                                  style: const TextStyle(fontSize: 13, color: kAuthInk, fontWeight: FontWeight.w500, height: 1.5),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  AuthButton(
                    label: context.l10n.forgotBackToSignIn,
                    isGhost: true,
                    onTap: () => context.go('/login'),
                  ),
                  const SizedBox(height: 8),
                  GestureDetector(
                    onTap: canResend && !_isLoading ? _resend : null,
                    behavior: HitTestBehavior.opaque,
                    child: SizedBox(
                      width: double.infinity, height: 48,
                      child: Center(
                        child: Text(
                          canResend
                              ? (_resendJustNow ? context.l10n.forgotLinkSentAgain : context.l10n.forgotResendLink)
                              : context.l10n.forgotResendIn(_resendSeconds),
                          style: TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w500,
                            color: canResend ? kAuthInk2 : kAuthInk3,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    });
  }
}
