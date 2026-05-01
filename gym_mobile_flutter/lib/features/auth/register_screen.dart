import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../models/gym_model.dart';
import '../../services/api_service.dart';
import '../../services/analytics_service.dart';
import 'auth_widgets.dart';
import 'gym_selector.dart';
import '../../utils/env.dart';
import '../../utils/error_utils.dart';
import '../../widgets/country_codes.dart';
import '../../widgets/legal_links.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _pageController = PageController();
  int _step = 0; // 0 = step 1, 1 = step 2

  // Step 1 — personal + password
  final _firstNameCtrl  = TextEditingController();
  final _lastNameCtrl   = TextEditingController();
  final _passwordCtrl   = TextEditingController();
  final _confirmCtrl    = TextEditingController();
  DateTime? _dob;
  int _gender = 0; // 0 = Male, 1 = Female
  bool _obscurePw      = true;
  bool _obscureConfirm = true;

  // Step 2 — contact + gym
  final _phoneCtrl = TextEditingController();
  Country _country = kCountries.first;
  final _emailCtrl = TextEditingController();

  // Gym selection
  List<Gym> _gyms = [];
  Gym? _selectedGym;
  bool _gymsLoading = true;

  bool _isLoading = false;
  bool _dialogOpen = false;
  bool _step1Submitted = false;
  bool _step2Submitted = false;

  @override
  void initState() {
    super.initState();
    _firstNameCtrl.addListener(_rebuild);
    _lastNameCtrl.addListener(_rebuild);
    _passwordCtrl.addListener(_rebuild);
    _confirmCtrl.addListener(_rebuild);
    _phoneCtrl.addListener(_rebuild);
    _emailCtrl.addListener(_rebuild);
    _loadGyms();
  }

  Future<void> _loadGyms() async {
    try {
      final gyms = await ApiService().getActiveGyms();
      if (mounted) {
        setState(() {
          _gyms = gyms;
          _gymsLoading = false;
          // Auto-select gym from build-time GYM_ID if set
          if (Env.gymId.isNotEmpty) {
            final match = gyms.where((g) => g.id == Env.gymId);
            if (match.isNotEmpty) _selectedGym = match.first;
          }
        });
      }
    } catch (_) {
      if (mounted) setState(() => _gymsLoading = false);
    }
  }

  @override
  void dispose() {
    _pageController.dispose();
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    super.dispose();
  }

  void _rebuild() => setState(() {});

  // ── Validation ──────────────────────────────────────────────────────────────
  String? _validateStep1() {
    if (_firstNameCtrl.text.trim().isEmpty) return 'First name is required';
    if (_lastNameCtrl.text.trim().isEmpty) return 'Last name is required';
    if (_passwordCtrl.text.isEmpty) return 'Password is required';
    if (_passwordCtrl.text.length < 8) return 'Password must be at least 8 characters';
    if (_confirmCtrl.text != _passwordCtrl.text) return 'Passwords do not match';
    return null;
  }

  bool get _isStep1Valid =>
      _firstNameCtrl.text.trim().isNotEmpty &&
      _lastNameCtrl.text.trim().isNotEmpty &&
      _passwordCtrl.text.length >= 8 &&
      _confirmCtrl.text == _passwordCtrl.text;

  /// Phone is optional. The dropdown always carries a country code; "blank"
  /// means the user typed no digits. Once they do type digits, we accept
  /// any country (no per-region regex) — the backend stores the composed
  /// E.164-ish string.
  bool get _phoneLeftBlank => _phoneCtrl.text.trim().isEmpty;

  String _composedPhone() => composePhone(
        dialCode: _country.dialCode,
        typed: _phoneCtrl.text,
      );

  bool get _isStep2Valid =>
      _selectedGym != null &&
      _emailCtrl.text.trim().isNotEmpty &&
      RegExp(r'^[^@]+@[^@]+\.[^@]+').hasMatch(_emailCtrl.text.trim());

  // Per-field errors (only show after submission attempt)
  String? get _firstNameError => _step1Submitted && _firstNameCtrl.text.trim().isEmpty ? 'First name is required' : null;
  String? get _lastNameError => _step1Submitted && _lastNameCtrl.text.trim().isEmpty ? 'Last name is required' : null;
  String? get _passwordError {
    if (!_step1Submitted) return null;
    if (_passwordCtrl.text.isEmpty) return 'Password is required';
    if (_passwordCtrl.text.length < 8) return 'At least 8 characters';
    return null;
  }
  String? get _confirmError {
    if (!_step1Submitted) return null;
    if (_confirmCtrl.text.isEmpty) return 'Confirm your password';
    if (_confirmCtrl.text != _passwordCtrl.text) return 'Passwords do not match';
    return null;
  }
  String? get _phoneError {
    if (!_step2Submitted) return null;
    return null; // optional field, no client-side format check beyond country code
  }
  String? get _emailError {
    if (!_step2Submitted) return null;
    if (_emailCtrl.text.trim().isEmpty) return 'Email is required';
    if (!RegExp(r'^[^@]+@[^@]+\.[^@]+').hasMatch(_emailCtrl.text.trim())) return 'Invalid email';
    return null;
  }
  String? get _gymError {
    if (!_step2Submitted) return null;
    if (_selectedGym == null) return 'Please select a gym';
    return null;
  }

  String? _validateStep2() {
    if (_selectedGym == null) return 'Please select a gym';
    if (_emailCtrl.text.trim().isEmpty) return 'Email is required';
    if (!RegExp(r'^[^@]+@[^@]+\.[^@]+').hasMatch(_emailCtrl.text.trim())) {
      return 'Enter a valid email address';
    }
    return null;
  }

  // ── Navigation ──────────────────────────────────────────────────────────────
  void _nextStep() {
    setState(() => _step1Submitted = true);
    final err = _validateStep1();
    if (err != null) return;
    setState(() => _step = 1);
    _pageController.nextPage(
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeInOutCubic,
    );
  }

  void _prevStep() {
    setState(() => _step = 0);
    _pageController.previousPage(
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeInOutCubic,
    );
  }

  // ── Register ────────────────────────────────────────────────────────────────
  Future<void> _register() async {
    setState(() => _step2Submitted = true);
    final err = _validateStep2();
    if (err != null) return;

    setState(() => _isLoading = true);
    final email     = _emailCtrl.text.trim();
    final password  = _passwordCtrl.text;
    final fullName  = '${_firstNameCtrl.text.trim()} ${_lastNameCtrl.text.trim()}';
    final phone     = _phoneLeftBlank ? null : _composedPhone();
    final dob       = _dob?.toIso8601String().substring(0, 10);
    try {
      final service = ApiService();
      await service.register(
        email: email,
        password: password,
        fullName: fullName,
        phone: phone,
        gymId: _selectedGym!.id,
        dateOfBirth: dob,
        gender: _gender == 0 ? 'male' : 'female',
      );

      AnalyticsService.instance.logSignUp();
      AnalyticsService.instance.logGymSelected(
        _selectedGym!.id,
        _selectedGym!.name,
      );

      // Sign out after registration so user must confirm email / sign in
      await service.signOut();

      if (!mounted) return;
      _showSuccessDialog();
    } on ApiException catch (e) {
      if (!mounted) return;
      final lower = e.message.toLowerCase();
      if (lower.contains('already') || lower.contains('exists') || lower.contains('taken')) {
        _showError('This email is already registered. If your account was deleted, please use "Forgot Password" to regain access.');
        return;
      }
      if (lower.contains('phone')) {
        _showError(_friendlyDbError(e.message));
        return;
      }
      _showError(_friendlyAuthError(e.message));
    } catch (e) {
      if (!mounted) return;
      _showError(friendlyError(e));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }


  // ── Country picker (bottom sheet) ──────────────────────────────────────────
  Future<void> _openCountryPicker() async {
    FocusScope.of(context).unfocus();
    final screenH = MediaQuery.of(context).size.height;
    final picked = await showModalBottomSheet<Country>(
      context: context,
      backgroundColor: Colors.white,
      // Cap at 50% of screen so the sheet feels lightweight rather than
      // taking over the page; the inner ListView still scrolls.
      constraints: BoxConstraints(maxHeight: screenH * 0.5),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Container(
              width: 36, height: 4,
              decoration: BoxDecoration(
                color: kAuthBorder,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 8),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Select country',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: kAuthText),
                ),
              ),
            ),
            Flexible(
              child: ListView.builder(
                itemCount: kCountries.length,
                itemBuilder: (_, i) {
                  final c = kCountries[i];
                  final selected = c.dialCode == _country.dialCode && c.name == _country.name;
                  return ListTile(
                    dense: true,
                    visualDensity: const VisualDensity(vertical: -2),
                    leading: Text(c.flag, style: const TextStyle(fontSize: 22)),
                    title: Text(c.name, style: const TextStyle(fontSize: 14, color: kAuthText)),
                    trailing: Text(c.dialCode,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                          color: selected ? kAuthPrimary : kAuthSec,
                        )),
                    onTap: () => Navigator.of(ctx).pop(c),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
    if (picked != null && mounted) {
      setState(() => _country = picked);
    }
  }

  // ── Date picker ─────────────────────────────────────────────────────────────
  Future<void> _pickDob() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime(now.year - 20),
      firstDate: DateTime(now.year - 100),
      lastDate: DateTime(now.year - 10),
      helpText: 'Date of Birth',
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: Theme.of(ctx).colorScheme.copyWith(primary: kAuthPrimary),
        ),
        child: child!,
      ),
    );
    if (picked != null) setState(() => _dob = picked);
  }

  String _formatDob(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')} / ${d.month.toString().padLeft(2, '0')} / ${d.year}';

  // ── Helpers ─────────────────────────────────────────────────────────────────
  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: Colors.red.shade700,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ));
  }

  void _showSuccessDialog() {
    _dialogOpen = true;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        backgroundColor: Colors.white,
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: kAuthPrimary,
                  borderRadius: BorderRadius.circular(22),
                ),
                child: const Icon(Icons.mark_email_read_outlined, color: Colors.white, size: 36),
              ),
              const SizedBox(height: 20),
              const Text(
                'Check your email',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w500,
                  color: kAuthText,
                  letterSpacing: -0.4,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'We sent a confirmation link to ${_emailCtrl.text.trim()}. Please confirm your email before signing in.',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 14, color: kAuthSec, height: 1.6),
              ),
              const SizedBox(height: 24),
              AuthButton(
                label: 'Go to Sign In',
                onTap: () {
                  _dialogOpen = false;
                  Navigator.of(ctx).pop();
                  context.go('/login');
                },
              ),
            ],
          ),
        ),
      ),
    );

    // Auto-redirect to sign in after 4 seconds if user hasn't tapped the button
    Future.delayed(const Duration(seconds: 4), () {
      if (mounted && _dialogOpen) {
        _dialogOpen = false;
        Navigator.of(context, rootNavigator: true).pop();
        context.go('/login');
      }
    });
  }

  String _friendlyAuthError(String m) {
    final l = m.toLowerCase();
    if (l.contains('already registered') || l.contains('already exists')) {
      return 'This email is already registered. Please sign in instead.';
    }
    if (l.contains('invalid email')) return 'Please enter a valid email address.';
    if (l.contains('weak password')) return 'Password is too weak. Use at least 8 characters.';
    return m;
  }

  String _friendlyDbError(String m) {
    final l = m.toLowerCase();
    if (l.contains('profiles_phone_unique') || (l.contains('unique') && l.contains('phone'))) {
      return 'This phone number is already registered. Please use a different number.';
    }
    if (l.contains('permission denied') || l.contains('row-level security')) {
      return 'Registration is not allowed at this time. Contact your gym.';
    }
    return 'Registration failed. Please try again or contact support.';
  }

  // ── UI ───────────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kAuthBg,
      resizeToAvoidBottomInset: true,
      body: SafeArea(
        child: Column(
          children: [
            // ── Top bar (step indicator) ────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 20, 24, 0),
              child: Column(
                children: [
                  Row(
                    children: [
                      if (_step == 1)
                        AuthBackButton(onTap: _prevStep)
                      else
                        AuthBackButton(onTap: () => context.go('/login')),
                      const Spacer(),
                      const AuthLogo(size: 34),
                      const Spacer(),
                      Text(
                        'Step ${_step + 1} of 2',
                        style: const TextStyle(
                          fontSize: 12,
                          color: kAuthPh,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  AuthProgressBar(progress: (_step + 1) / 2),
                ],
              ),
            ),

            // ── Pages ───────────────────────────────────────────────────────
            Expanded(
              child: PageView(
                controller: _pageController,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  _Step1(),
                  _Step2(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Step 1: Personal info + password ────────────────────────────────────────
  Widget _Step1() {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            "Let's meet you",
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w500,
              color: kAuthText,
              letterSpacing: -0.4,
            ),
          ),
          const SizedBox(height: 5),
          const Text(
            'A few basics to get started',
            style: TextStyle(fontSize: 14, color: kAuthSec),
          ),
          const SizedBox(height: 24),

          // First / Last name row
          Row(
            children: [
              Expanded(
                child: AuthField(
                  label: 'First name',
                  controller: _firstNameCtrl,
                  placeholder: 'Ahmed',
                  errorText: _firstNameError,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: AuthField(
                  label: 'Last name',
                  controller: _lastNameCtrl,
                  placeholder: 'Hassan',
                  errorText: _lastNameError,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Date of birth
          AuthTapField(
            label: 'Date of birth',
            value: _dob != null ? _formatDob(_dob!) : '',
            placeholder: 'DD / MM / YYYY',
            onTap: _pickDob,
            trailing: const Icon(Icons.calendar_today_outlined,
                size: 16, color: kAuthPh),
          ),
          const SizedBox(height: 14),

          // Gender
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'GENDER',
                style: TextStyle(
                  fontSize: 11, fontWeight: FontWeight.w500,
                  color: kAuthSec, letterSpacing: 0.7,
                ),
              ),
              const SizedBox(height: 5),
              AuthSegment(
                options: const ['Male', 'Female'],
                selected: _gender,
                onSelect: (i) => setState(() => _gender = i),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Password
          StatefulBuilder(builder: (_, ss) {
            return AuthField(
              label: 'Password',
              controller: _passwordCtrl,
              placeholder: 'Create a password',
              isPassword: true,
              obscureText: _obscurePw,
              onToggleObscure: () => ss(() => _obscurePw = !_obscurePw),
              onChanged: (_) => setState(() {}),
              errorText: _passwordError,
            );
          }),
          if (_passwordCtrl.text.isNotEmpty) ...[
            const SizedBox(height: 12),
            AuthPasswordChecks(password: _passwordCtrl.text),
          ],
          const SizedBox(height: 14),

          // Confirm password
          StatefulBuilder(builder: (_, ss) {
            return AuthField(
              label: 'Confirm password',
              controller: _confirmCtrl,
              placeholder: 'Repeat your password',
              isPassword: true,
              obscureText: _obscureConfirm,
              onToggleObscure: () => ss(() => _obscureConfirm = !_obscureConfirm),
              textInputAction: TextInputAction.done,
              errorText: _confirmError,
            );
          }),
          const SizedBox(height: 28),

          AuthButton(label: 'Continue', isLoading: _isLoading, enabled: _isStep1Valid, onTap: _nextStep),
          const SizedBox(height: 20),
          Center(
            child: GestureDetector(
              onTap: () => context.go('/login'),
              child: RichText(
                text: const TextSpan(
                  style: TextStyle(fontSize: 13, color: kAuthSec),
                  children: [
                    TextSpan(text: 'Already a member? '),
                    TextSpan(
                      text: 'Sign in',
                      style: TextStyle(
                          color: kAuthPrimary, fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Step 2: Contact info ─────────────────────────────────────────────────────
  Widget _Step2() {
    return GestureDetector(
      onTap: () => FocusScope.of(context).unfocus(),
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          24, 20, 24,
          MediaQuery.of(context).viewInsets.bottom + 32,
        ),
        child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'How to reach you',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w500,
              color: kAuthText,
              letterSpacing: -0.4,
            ),
          ),
          const SizedBox(height: 5),
          const Text(
            'Used for verification and updates',
            style: TextStyle(fontSize: 14, color: kAuthSec),
          ),
          const SizedBox(height: 24),

          // Gym selection (hidden when GYM_ID is set at build time)
          if (Env.gymId.isEmpty) ...[
            GymSelector(
              gyms: _gyms,
              selected: _selectedGym,
              isLoading: _gymsLoading,
              errorText: _gymError,
              onSelected: (gym) => setState(() => _selectedGym = gym),
            ),
            const SizedBox(height: 14),
          ],

          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'MOBILE NUMBER (OPTIONAL)',
                style: TextStyle(
                  fontSize: 11, fontWeight: FontWeight.w500,
                  color: kAuthSec, letterSpacing: 0.7,
                ),
              ),
              const SizedBox(height: 5),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Country picker — opens a bottom sheet to choose dial code.
                  GestureDetector(
                    onTap: _openCountryPicker,
                    child: Container(
                      height: 52,
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: kAuthFieldBg,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: kAuthBorder, width: 1.5),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(_country.flag, style: const TextStyle(fontSize: 20)),
                          const SizedBox(width: 8),
                          Text(
                            _country.dialCode,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: kAuthText,
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Icon(Icons.expand_more, color: kAuthSec, size: 18),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Container(
                      height: 52,
                      decoration: BoxDecoration(
                        color: kAuthFieldBg,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: (_phoneError != null && _phoneError!.isNotEmpty)
                              ? const Color(0xFFEF4444)
                              : kAuthBorder,
                          width: 1.5,
                        ),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      alignment: Alignment.center,
                      child: TextField(
                        controller: _phoneCtrl,
                        keyboardType: TextInputType.phone,
                        textInputAction: TextInputAction.next,
                        style: const TextStyle(fontSize: 15, color: kAuthText),
                        decoration: const InputDecoration(
                          hintText: '10X XXX XXXX',
                          hintStyle: TextStyle(color: kAuthPh, fontSize: 15),
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          filled: true,
                          fillColor: Colors.transparent,
                          isDense: true,
                          contentPadding: EdgeInsets.zero,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              if (_phoneError != null && _phoneError!.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 6, left: 4),
                  child: Text(
                    _phoneError!,
                    style: const TextStyle(color: Color(0xFFEF4444), fontSize: 12),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 14),

          AuthField(
            label: 'Email address',
            controller: _emailCtrl,
            placeholder: 'you@email.com',
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _register(),
            errorText: _emailError,
          ),
          const SizedBox(height: 28),

          AuthButton(
            label: 'Create account',
            isLoading: _isLoading,
            enabled: _isStep2Valid,
            onTap: _register,
          ),
          const SizedBox(height: 16),
          const LegalConsentLine(
            prefix: 'By creating an account, you agree to our ',
          ),
        ],
      ),
    ),
    );
  }
}
