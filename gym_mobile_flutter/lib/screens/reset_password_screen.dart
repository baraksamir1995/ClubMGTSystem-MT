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
  bool _obscurePw      = true;
  bool _obscureConfirm = true;
  bool _isLoading      = false;

  @override
  void dispose() {
    _pwCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _update() async {
    if (_pwCtrl.text.isEmpty) {
      _showError('Please enter a password');
      return;
    }
    if (_pwCtrl.text.length < 8) {
      _showError('Password must be at least 8 characters');
      return;
    }
    if (_pwCtrl.text != _confirmCtrl.text) {
      _showError('Passwords do not match');
      return;
    }

    final auth = context.read<AuthProvider>();
    final token = auth.recoveryToken;
    if (token == null || token.isEmpty) {
      _showError('Reset link expired. Please request a new one.');
      return;
    }

    setState(() => _isLoading = true);
    try {
      await ApiService().resetPassword(token, _pwCtrl.text);
      if (!mounted) return;
      auth.clearPasswordRecovery();
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Password updated successfully!'),
        backgroundColor: kAuthGreen,
        behavior: SnackBarBehavior.floating,
      ));
      context.go('/login');
    } on ApiException catch (e) {
      if (!mounted) return;
      _showError(e.message);
    } catch (e) {
      if (!mounted) return;
      _showError(friendlyError(e));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showError(String msg) {
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
          padding: const EdgeInsets.fromLTRB(24, 28, 24, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 8),

              // Icon
              Container(
                width: 54,
                height: 54,
                decoration: BoxDecoration(
                  color: const Color(0xFFEEEDFE),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(Icons.lock_reset_rounded,
                    color: kAuthPrimary, size: 26),
              ),
              const SizedBox(height: 22),

              const Text(
                'New password',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w500,
                  color: kAuthText,
                  letterSpacing: -0.4,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Make it something strong',
                style: TextStyle(fontSize: 14, color: kAuthSec),
              ),
              const SizedBox(height: 28),

              AuthField(
                label: 'New password',
                controller: _pwCtrl,
                placeholder: 'Enter new password',
                isPassword: true,
                obscureText: _obscurePw,
                onToggleObscure: () =>
                    setState(() => _obscurePw = !_obscurePw),
                onChanged: (_) => setState(() {}),
              ),
              if (_pwCtrl.text.isNotEmpty) ...[
                const SizedBox(height: 12),
                AuthPasswordChecks(password: _pwCtrl.text),
              ],
              const SizedBox(height: 14),

              AuthField(
                label: 'Confirm password',
                controller: _confirmCtrl,
                placeholder: 'Repeat new password',
                isPassword: true,
                obscureText: _obscureConfirm,
                onToggleObscure: () =>
                    setState(() => _obscureConfirm = !_obscureConfirm),
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _update(),
              ),
              const SizedBox(height: 28),

              AuthButton(
                label: 'Set new password',
                isLoading: _isLoading,
                onTap: _update,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
