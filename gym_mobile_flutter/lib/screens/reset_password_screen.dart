import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../features/auth/auth_widgets.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../utils/error_utils.dart';

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key});

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _pwCtrl      = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _show         = false; // single eye toggles both fields, per design
  bool _isLoading    = false;
  bool _done         = false;

  @override
  void initState() {
    super.initState();
    _pwCtrl.addListener(() => setState(() {}));
    _confirmCtrl.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _pwCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  bool get _reqsOk =>
      _pwCtrl.text.length >= 8 &&
      RegExp(r'[A-Z]').hasMatch(_pwCtrl.text) &&
      RegExp(r'[0-9]').hasMatch(_pwCtrl.text);

  bool get _mismatch =>
      _confirmCtrl.text.isNotEmpty && _pwCtrl.text != _confirmCtrl.text;

  bool get _valid => _reqsOk && _confirmCtrl.text.isNotEmpty && !_mismatch;

  Future<void> _update() async {
    if (!_valid) return;

    final auth = context.read<AuthProvider>();
    final token = auth.recoveryToken;
    if (token == null || token.isEmpty) {
      _err('Reset link expired. Please request a new one.');
      return;
    }

    setState(() => _isLoading = true);
    try {
      await ApiService().resetPassword(token, _pwCtrl.text);
      if (!mounted) return;
      auth.clearPasswordRecovery();
      setState(() {
        _isLoading = false;
        _done = true;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      _err(e.message);
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      _err(friendlyError(e));
    }
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
        child: _done ? _successView() : _formView(),
      ),
    );
  }

  Widget _formView() {
    final keyboard = MediaQuery.of(context).viewInsets.bottom;
    final safeBottom = MediaQuery.of(context).padding.bottom;
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(24, 16, 24, 16 + safeBottom + keyboard),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AuthBackButton(onTap: () => context.go('/login')),
          const SizedBox(height: 28),
          const AuthPeachIcon(icon: Icons.lock_outline_rounded),
          const SizedBox(height: 22),
          const Text(
            'Set a new password',
            style: TextStyle(
              fontSize: 28, fontWeight: FontWeight.w600,
              color: kAuthInk, letterSpacing: -0.6, height: 1.15,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            "Choose something you haven't used before.",
            style: TextStyle(fontSize: 15, color: kAuthInk2, height: 1.5),
          ),
          const SizedBox(height: 24),

          AuthField(
            label: 'New password',
            controller: _pwCtrl,
            placeholder: 'At least 8 characters',
            isPassword: true,
            obscureText: !_show,
            onToggleObscure: () => setState(() => _show = !_show),
            leading: const Icon(Icons.lock_outline_rounded, size: 18, color: kAuthInk2),
          ),
          const SizedBox(height: 10),
          AuthStrengthMeter(password: _pwCtrl.text),
          const SizedBox(height: 14),

          AuthField(
            label: 'Confirm password',
            controller: _confirmCtrl,
            placeholder: 'Type it again',
            isPassword: true,
            obscureText: !_show,
            onToggleObscure: () => setState(() => _show = !_show),
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _update(),
            leading: const Icon(Icons.lock_outline_rounded, size: 18, color: kAuthInk2),
            errorText: _mismatch ? "Passwords don't match" : null,
          ),
          const SizedBox(height: 16),
          AuthPasswordChecks(password: _pwCtrl.text),
          const SizedBox(height: 28),

          AuthButton(
            label: 'Update password',
            isLoading: _isLoading,
            enabled: _valid,
            onTap: _update,
          ),
        ],
      ),
    );
  }

  Widget _successView() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
      child: Column(
        children: [
          const Spacer(),
          const AuthStatusIcon(),
          const SizedBox(height: 26),
          const Text(
            'Password updated',
            style: TextStyle(
              fontSize: 26, fontWeight: FontWeight.w600,
              color: kAuthInk, letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'You can now sign in with your new password.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 15, color: kAuthInk2, height: 1.5),
          ),
          const Spacer(),
          AuthButton(
            label: 'Continue to sign in',
            onTap: () => context.go('/login'),
          ),
        ],
      ),
    );
  }
}
