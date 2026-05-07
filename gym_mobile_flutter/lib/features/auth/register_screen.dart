import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import '../../models/gym_model.dart';
import '../../services/api_service.dart';
import '../../services/analytics_service.dart';
import '../../utils/env.dart';
import '../../utils/error_utils.dart';
import '../../widgets/country_codes.dart';
import '../../widgets/legal_links.dart';
import 'auth_widgets.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _pageController = PageController();
  int _step = 0; // 0 Account · 1 You · 2 Club

  // Step 1 — Account
  final _emailCtrl    = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _obscurePw = true;

  // Step 2 — You
  final _nameCtrl  = TextEditingController();
  final _dayCtrl   = TextEditingController();
  final _yearCtrl  = TextEditingController();
  int? _month;
  final _phoneCtrl = TextEditingController();
  Country _country = kCountries.first;

  // Step 3 — Club
  final _gymSearchCtrl = TextEditingController();
  List<Gym> _gyms = [];
  bool _gymsLoading = true;
  Gym? _selectedGym;

  bool _isLoading = false;
  bool _registered = false;

  static const _months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];

  // White-label builds (GYM_ID baked at compile time) don't render the club
  // picker — the gym is fixed, so we skip step 2 entirely and submit from
  // step 1. Synthesize the Gym up-front so _register() has the data it needs.
  bool get _skipClubStep => Env.isWhiteLabel;

  @override
  void initState() {
    super.initState();
    _emailCtrl.addListener(_rebuild);
    _passwordCtrl.addListener(_rebuild);
    _nameCtrl.addListener(_rebuild);
    _dayCtrl.addListener(_rebuild);
    _yearCtrl.addListener(_rebuild);
    _phoneCtrl.addListener(_rebuild);
    _gymSearchCtrl.addListener(_rebuild);
    if (_skipClubStep) {
      _selectedGym = Gym(id: Env.gymId, name: Env.brandName);
      _gymsLoading = false;
    } else {
      _loadGyms();
    }
  }

  Future<void> _loadGyms() async {
    try {
      final gyms = await ApiService().getActiveGyms();
      if (!mounted) return;
      setState(() {
        _gyms = gyms;
        _gymsLoading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _gymsLoading = false);
    }
  }

  @override
  void dispose() {
    _pageController.dispose();
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _nameCtrl.dispose();
    _dayCtrl.dispose();
    _yearCtrl.dispose();
    _phoneCtrl.dispose();
    _gymSearchCtrl.dispose();
    super.dispose();
  }

  void _rebuild() => setState(() {});

  // ── Validation ──────────────────────────────────────────────────────────────
  bool get _validEmail =>
      RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+').hasMatch(_emailCtrl.text.trim());

  bool get _validPassword =>
      _passwordCtrl.text.length >= 8 &&
      RegExp(r'[A-Z]').hasMatch(_passwordCtrl.text) &&
      RegExp(r'[0-9]').hasMatch(_passwordCtrl.text);

  bool get _step0Valid => _validEmail && _validPassword;

  ({int? age, bool valid, bool ageOk}) get _dobInfo {
    final d = int.tryParse(_dayCtrl.text);
    final y = int.tryParse(_yearCtrl.text);
    final m = _month;
    final today = DateTime.now();
    if (d == null || m == null || y == null) return (age: null, valid: false, ageOk: false);
    if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > today.year) {
      return (age: null, valid: false, ageOk: false);
    }
    int age = today.year - y;
    if (today.month < m || (today.month == m && today.day < d)) age--;
    return (age: age, valid: true, ageOk: age >= 13 && age <= 120);
  }

  bool get _step1Valid {
    final dob = _dobInfo;
    final phoneDigits = _phoneCtrl.text.replaceAll(RegExp(r'\D'), '');
    final phoneOk = _phoneCtrl.text.trim().isEmpty || (phoneDigits.length >= 7 && phoneDigits.length <= 15);
    return _nameCtrl.text.trim().length >= 2 && dob.valid && dob.ageOk && phoneOk;
  }

  bool get _step2Valid => _selectedGym != null;

  // ── Navigation ──────────────────────────────────────────────────────────────
  void _goTo(int step) {
    setState(() => _step = step);
    _pageController.animateToPage(
      step,
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeInOutCubic,
    );
    FocusScope.of(context).unfocus();
  }

  void _back() {
    if (_step == 0) {
      context.go('/login');
      return;
    }
    _goTo(_step - 1);
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  Future<void> _register() async {
    if (!_step2Valid) return;
    setState(() => _isLoading = true);

    final email    = _emailCtrl.text.trim();
    final password = _passwordCtrl.text;
    final fullName = _nameCtrl.text.trim();
    final phone    = _phoneCtrl.text.trim().isEmpty
        ? null
        : composePhone(dialCode: _country.dialCode, typed: _phoneCtrl.text);
    final yyyy = int.parse(_yearCtrl.text);
    final mm   = (_month ?? 1).toString().padLeft(2, '0');
    final dd   = int.parse(_dayCtrl.text).toString().padLeft(2, '0');
    final dob  = '$yyyy-$mm-$dd';

    try {
      final api = ApiService();
      await api.register(
        email: email,
        password: password,
        fullName: fullName,
        phone: phone,
        gymId: _selectedGym!.id,
        dateOfBirth: dob,
      );

      AnalyticsService.instance.logSignUp();
      AnalyticsService.instance.logGymSelected(_selectedGym!.id, _selectedGym!.name);

      // Sign out — backend requires email verification before sign-in.
      await api.signOut();

      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _registered = true;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      _showError(_friendlyError(e.message));
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      _showError(friendlyError(e));
    }
  }

  String _friendlyError(String m) {
    final l = m.toLowerCase();
    if (l.contains('already') || l.contains('exists') || l.contains('taken')) {
      return 'This email is already registered. Use Forgot Password if you lost access.';
    }
    if (l.contains('phone')) return 'This phone number is already registered.';
    if (l.contains('weak password')) return 'Password is too weak. Use at least 8 characters.';
    return m;
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: kAuthError,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ));
  }

  Future<void> _openCountryPicker() async {
    FocusScope.of(context).unfocus();
    final screenH = MediaQuery.of(context).size.height;
    final picked = await showModalBottomSheet<Country>(
      context: context,
      backgroundColor: kAuthCard,
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
                color: kAuthHair, borderRadius: BorderRadius.circular(2),
              ),
            ),
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 12, 20, 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Select country',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: kAuthInk),
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
                    title: Text(c.name, style: const TextStyle(fontSize: 14, color: kAuthInk)),
                    trailing: Text(
                      c.dialCode,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                        color: selected ? kAuthPrimary : kAuthInk2,
                      ),
                    ),
                    onTap: () => Navigator.of(ctx).pop(c),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
    if (picked != null && mounted) setState(() => _country = picked);
  }

  // ── UI ──────────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    if (_registered) return _SuccessView(email: _emailCtrl.text.trim());
    return Scaffold(
      backgroundColor: kAuthBg,
      resizeToAvoidBottomInset: true,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
              child: Row(
                children: [
                  AuthBackButton(onTap: _back),
                  const Spacer(),
                ],
              ),
            ),
            const SizedBox(height: 8),
            AuthStepBar(
              step: _step,
              labels: _skipClubStep
                  ? const ['Account', 'You']
                  : const ['Account', 'You', 'Club'],
            ),
            const SizedBox(height: 4),
            Expanded(
              child: PageView(
                controller: _pageController,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  _accountStep(),
                  _personalStep(),
                  if (!_skipClubStep) _clubStep(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Step 0 — Account (email + password) ─────────────────────────────────────
  Widget _accountStep() {
    final keyboard = MediaQuery.of(context).viewInsets.bottom;
    final safeBottom = MediaQuery.of(context).padding.bottom;
    return SingleChildScrollView(
      // Bottom padding accounts for keyboard so the scroll content can be
      // pushed up when the user focuses a field — the focused TextField
      // calls Scrollable.ensureVisible to scroll itself above the keyboard.
      padding: EdgeInsets.fromLTRB(24, 14, 24, 16 + safeBottom + keyboard),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AuthMark(size: 48),
          const SizedBox(height: 18),
          const Text(
            'Create your account',
            style: TextStyle(
              fontSize: 28, fontWeight: FontWeight.w600,
              color: kAuthInk, letterSpacing: -0.6, height: 1.15,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            "Email and a strong password — we'll keep your account safe.",
            style: TextStyle(fontSize: 14, color: kAuthInk2, height: 1.5),
          ),
          const SizedBox(height: 22),

          AuthField(
            label: 'Email',
            controller: _emailCtrl,
            placeholder: 'you@example.com',
            keyboardType: TextInputType.emailAddress,
            leading: const Icon(Icons.mail_outline_rounded, size: 18, color: kAuthInk2),
          ),
          const SizedBox(height: 14),
          AuthField(
            label: 'Password',
            controller: _passwordCtrl,
            placeholder: 'At least 8 characters',
            isPassword: true,
            obscureText: _obscurePw,
            onToggleObscure: () => setState(() => _obscurePw = !_obscurePw),
            leading: const Icon(Icons.lock_outline_rounded, size: 18, color: kAuthInk2),
          ),
          const SizedBox(height: 12),
          AuthReqChips(password: _passwordCtrl.text),
          const SizedBox(height: 28),

          AuthButton(
            label: 'Continue',
            enabled: _step0Valid,
            onTap: () => _goTo(1),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text(
                'Already have an account? ',
                style: TextStyle(fontSize: 14, color: kAuthInk2),
              ),
              AuthTextLink(
                text: 'Sign in',
                onTap: () => context.go('/login'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Step 1 — You (name + DOB + optional mobile) ─────────────────────────────
  Widget _personalStep() {
    final dob = _dobInfo;
    final keyboard = MediaQuery.of(context).viewInsets.bottom;
    final safeBottom = MediaQuery.of(context).padding.bottom;
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(24, 14, 24, 16 + safeBottom + keyboard),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
                const AuthPeachIcon(icon: Icons.calendar_today_outlined),
                const SizedBox(height: 18),
                const Text(
                  'A bit about you',
                  style: TextStyle(
                    fontSize: 28, fontWeight: FontWeight.w600,
                    color: kAuthInk, letterSpacing: -0.6, height: 1.15,
                  ),
                ),
                const SizedBox(height: 22),

                AuthField(
                  label: 'Full name',
                  controller: _nameCtrl,
                  placeholder: 'e.g. Ahmed Hassan',
                  keyboardType: TextInputType.name,
                  leading: const Icon(Icons.person_outline_rounded, size: 18, color: kAuthInk2),
                ),
                const SizedBox(height: 16),

                // Date of birth — DD / Month / YYYY
                const Padding(
                  padding: EdgeInsets.only(left: 4),
                  child: Text(
                    'DATE OF BIRTH',
                    style: TextStyle(
                      fontSize: 12, fontWeight: FontWeight.w600,
                      color: kAuthInk2, letterSpacing: 0.3,
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Expanded(
                      flex: 10,
                      child: _FieldShell(
                        child: _dobNum(_dayCtrl, 'DD', 2),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      flex: 16,
                      child: _FieldShell(
                        focusable: false,
                        child: _dobMonth(),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      flex: 12,
                      child: _FieldShell(
                        child: _dobNum(_yearCtrl, 'YYYY', 4),
                      ),
                    ),
                  ],
                ),
                if (dob.valid && dob.ageOk) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: kAuthSuccessBg,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '${dob.age} years old ✓',
                      style: const TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w600, color: kAuthSuccess,
                      ),
                    ),
                  ),
                ] else if (dob.valid && !dob.ageOk) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: kAuthErrorBg,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Text(
                      'You must be at least 13 to sign up.',
                      style: TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w600, color: kAuthError,
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 16),

                // Mobile — optional
                Padding(
                  padding: const EdgeInsets.only(left: 4, right: 4),
                  child: Row(
                    children: const [
                      Text(
                        'MOBILE',
                        style: TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w600,
                          color: kAuthInk2, letterSpacing: 0.3,
                        ),
                      ),
                      Spacer(),
                      Text(
                        'Optional',
                        style: TextStyle(fontSize: 11, color: kAuthInk3, fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 6),
                _FieldShell(
                  child: Row(
                    children: [
                      GestureDetector(
                        onTap: _openCountryPicker,
                        behavior: HitTestBehavior.opaque,
                        child: Padding(
                          padding: const EdgeInsets.only(right: 10),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(_country.flag, style: const TextStyle(fontSize: 18)),
                              const SizedBox(width: 6),
                              Text(
                                _country.dialCode,
                                style: const TextStyle(
                                  fontSize: 15, fontWeight: FontWeight.w600, color: kAuthInk,
                                ),
                              ),
                              const Icon(Icons.expand_more_rounded, size: 18, color: kAuthInk2),
                            ],
                          ),
                        ),
                      ),
                      Expanded(
                        child: TextField(
                          controller: _phoneCtrl,
                          keyboardType: TextInputType.phone,
                          style: const TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w500, color: kAuthInk,
                          ),
                          decoration: const InputDecoration(
                            hintText: '10 1234 5678',
                            hintStyle: TextStyle(color: kAuthInk3, fontSize: 15, fontWeight: FontWeight.w400),
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            disabledBorder: InputBorder.none,
                            errorBorder: InputBorder.none,
                            focusedErrorBorder: InputBorder.none,
                            filled: false,
                            isDense: true,
                            contentPadding: EdgeInsets.zero,
                          ),
                          inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[\d\s]')),
                ],
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: 28),
      AuthButton(
        label: _skipClubStep ? 'Create account' : 'Continue',
        isLoading: _skipClubStep && _isLoading,
        enabled: _step1Valid,
        onTap: _skipClubStep ? _register : () => _goTo(2),
      ),
      if (_skipClubStep) ...[
        const SizedBox(height: 12),
        const LegalConsentLine(
          prefix: 'By creating an account you agree to our ',
        ),
      ],
        ],
      ),
    );
  }

  Widget _dobNum(TextEditingController ctrl, String hint, int max) {
    return TextField(
      controller: ctrl,
      keyboardType: TextInputType.number,
      textAlign: TextAlign.center,
      style: const TextStyle(
        fontSize: 16, fontWeight: FontWeight.w500, color: kAuthInk, letterSpacing: 1.0,
      ),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(
          color: kAuthInk3, fontSize: 15, fontWeight: FontWeight.w400, letterSpacing: 0,
        ),
        border: InputBorder.none,
        enabledBorder: InputBorder.none,
        focusedBorder: InputBorder.none,
        disabledBorder: InputBorder.none,
        errorBorder: InputBorder.none,
        focusedErrorBorder: InputBorder.none,
        filled: false,
        isDense: true,
        contentPadding: EdgeInsets.zero,
      ),
      inputFormatters: [
        FilteringTextInputFormatter.digitsOnly,
        LengthLimitingTextInputFormatter(max),
      ],
    );
  }

  Widget _dobMonth() {
    return DropdownButtonHideUnderline(
      child: DropdownButton<int>(
        value: _month,
        isExpanded: true,
        hint: const Text(
          'Month',
          style: TextStyle(color: kAuthInk3, fontSize: 15, fontWeight: FontWeight.w400),
        ),
        icon: const Icon(Icons.expand_more_rounded, size: 18, color: kAuthInk2),
        style: const TextStyle(
          fontSize: 16, fontWeight: FontWeight.w500, color: kAuthInk,
        ),
        dropdownColor: kAuthCard,
        borderRadius: BorderRadius.circular(12),
        items: List.generate(12, (i) {
          return DropdownMenuItem<int>(
            value: i + 1,
            child: Text(_months[i]),
          );
        }),
        onChanged: (v) => setState(() => _month = v),
      ),
    );
  }

  // ── Step 2 — Club ───────────────────────────────────────────────────────────
  Widget _clubStep() {
    final q = _gymSearchCtrl.text.trim().toLowerCase();
    final filtered = q.isEmpty
        ? _gyms
        : _gyms.where((g) => g.name.toLowerCase().contains(q)).toList();

    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 14, 24, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AuthPeachIcon(icon: Icons.location_on_outlined),
          const SizedBox(height: 18),
          const Text(
            'Pick your club',
            style: TextStyle(
              fontSize: 28, fontWeight: FontWeight.w600,
              color: kAuthInk, letterSpacing: -0.6, height: 1.15,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'This is the home location your sessions are tied to.',
            style: TextStyle(fontSize: 14, color: kAuthInk2, height: 1.5),
          ),
          const SizedBox(height: 18),
          AuthField(
            label: 'Search',
            controller: _gymSearchCtrl,
            placeholder: 'Search by name or area',
            leading: const Icon(Icons.search_rounded, size: 18, color: kAuthInk2),
          ),
          const SizedBox(height: 14),
          Expanded(
            child: _gymsLoading
                ? const Center(child: CircularProgressIndicator(color: kAuthPrimary, strokeWidth: 2.5))
                : filtered.isEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(28),
                          child: Text(
                            q.isEmpty
                                ? 'No clubs available right now.'
                                : 'No clubs match "$q".',
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: kAuthInk2, fontSize: 14),
                          ),
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.only(bottom: 4),
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (_, i) {
                          final g = filtered[i];
                          final selected = _selectedGym?.id == g.id;
                          return _GymCard(
                            gym: g,
                            selected: selected,
                            onTap: () => setState(() => _selectedGym = g),
                          );
                        },
                      ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(0, 8, 0, 16 + MediaQuery.of(context).padding.bottom),
            child: Column(
              children: [
                AuthButton(
                  label: 'Create account',
                  isLoading: _isLoading,
                  enabled: _step2Valid,
                  onTap: _register,
                ),
                const SizedBox(height: 12),
                const LegalConsentLine(
                  prefix: 'By creating an account you agree to our ',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Field shell that matches AuthField's container (focus ring + shadow) ────
// Wrap a TextField/dropdown to share the same look as the labeled AuthField.
// Set focusable: false for non-text triggers (e.g. month dropdown) so they
// don't try to track keyboard focus.
class _FieldShell extends StatefulWidget {
  final Widget child;
  final bool focusable;
  const _FieldShell({required this.child, this.focusable = true});

  @override
  State<_FieldShell> createState() => _FieldShellState();
}

class _FieldShellState extends State<_FieldShell> {
  bool _focused = false;

  void _onFocus(bool hasFocus) {
    if (hasFocus != _focused) setState(() => _focused = hasFocus);
  }

  @override
  Widget build(BuildContext context) {
    final ringColor = _focused ? kAuthPrimary : Colors.transparent;
    final body = AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      height: 50,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: kAuthCard,
        borderRadius: BorderRadius.circular(16),
        boxShadow: ringColor == Colors.transparent
            ? const [BoxShadow(color: Color(0x0A1F1A14), blurRadius: 2, offset: Offset(0, 1))]
            : [BoxShadow(color: ringColor, blurRadius: 0, spreadRadius: 2)],
      ),
      alignment: Alignment.center,
      child: widget.child,
    );
    if (!widget.focusable) return body;
    return Focus(
      canRequestFocus: false,
      onFocusChange: _onFocus,
      child: body,
    );
  }
}

// ── Gym card — selected = inverted dark card ─────────────────────────────────
class _GymCard extends StatelessWidget {
  final Gym gym;
  final bool selected;
  final VoidCallback onTap;
  const _GymCard({required this.gym, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: selected ? kAuthInk : kAuthCard,
          borderRadius: BorderRadius.circular(16),
          boxShadow: selected
              ? const [BoxShadow(color: Color(0x2D1F1A14), blurRadius: 18, offset: Offset(0, 6))]
              : const [BoxShadow(color: Color(0x0A1F1A14), blurRadius: 2, offset: Offset(0, 1))],
        ),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Container(
                width: 44, height: 44,
                color: selected ? const Color(0x1FFFFFFF) : kAuthPeach,
                child: gym.logoUrl != null && gym.logoUrl!.isNotEmpty
                    ? Image.network(
                        gym.logoUrl!,
                        width: 44, height: 44,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Icon(
                          Icons.fitness_center_rounded,
                          color: selected ? Colors.white : kAuthInk,
                          size: 22,
                        ),
                      )
                    : Icon(
                        Icons.fitness_center_rounded,
                        color: selected ? Colors.white : kAuthInk,
                        size: 22,
                      ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                gym.name,
                style: TextStyle(
                  fontSize: 15, fontWeight: FontWeight.w600,
                  color: selected ? Colors.white : kAuthInk,
                  letterSpacing: -0.1,
                ),
                maxLines: 2, overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 8),
            Container(
              width: 22, height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: selected ? Colors.white : Colors.transparent,
                border: Border.all(
                  color: selected ? Colors.white : const Color(0x2D1F1A14),
                  width: 1.6,
                ),
              ),
              alignment: Alignment.center,
              child: selected
                  ? const Icon(Icons.check_rounded, size: 13, color: kAuthInk)
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}

// ── Success view — backend requires email verification before sign-in ───────
class _SuccessView extends StatelessWidget {
  final String email;
  const _SuccessView({required this.email});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kAuthBg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
          child: Column(
            children: [
              const Spacer(),
              const AuthStatusIcon(),
              const SizedBox(height: 26),
              const Text(
                "You're all set",
                style: TextStyle(
                  fontSize: 28, fontWeight: FontWeight.w600,
                  color: kAuthInk, letterSpacing: -0.6,
                ),
              ),
              const SizedBox(height: 10),
              Text.rich(
                TextSpan(
                  style: const TextStyle(fontSize: 15, color: kAuthInk2, height: 1.5),
                  children: [
                    const TextSpan(text: "We sent a confirmation link to\n"),
                    TextSpan(
                      text: email.isEmpty ? 'your inbox' : email,
                      style: const TextStyle(color: kAuthInk, fontWeight: FontWeight.w600),
                    ),
                    const TextSpan(text: '.\nTap the link to activate your account, then sign in.'),
                  ],
                ),
                textAlign: TextAlign.center,
              ),
              const Spacer(),
              AuthButton(
                label: 'Continue to sign in',
                onTap: () => context.go('/login'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
