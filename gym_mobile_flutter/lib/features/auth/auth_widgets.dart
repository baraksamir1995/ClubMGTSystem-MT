import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../services/api_service.dart';

// ── Design tokens ─────────────────────────────────────────────────────────────
// Warm cream + peach + orange system shared with the transfer + profile flows.
const kAuthBg        = Color(0xFFF7F6F2); // off-white background
const kAuthCard      = Color(0xFFFFFFFF);
const kAuthInk       = Color(0xFF1F1A14); // primary text
const kAuthInk2      = Color(0x9E1F1A14); // secondary text  (62% ink)
const kAuthInk3      = Color(0x6B1F1A14); // tertiary text   (42% ink)
const kAuthHair      = Color(0x141F1A14); // hairlines       (8% ink)
const kAuthPeach     = Color(0xFFF4DCC1);
const kAuthPeachDeep = Color(0xFFEAC59C);
const kAuthPrimary   = Color(0xFFE07A3B); // warm orange
const kAuthPrimaryD  = Color(0xFFC8642A);
const kAuthSuccess   = Color(0xFF3F8B5C);
const kAuthSuccessBg = Color(0xFFE4F0E6);
const kAuthWarn      = Color(0xFFB6531B);
const kAuthWarnBg    = Color(0xFFFBEAD6);
const kAuthError     = Color(0xFFC24E3D);
const kAuthErrorBg   = Color(0xFFFBE3DE);

// Backwards-compatible aliases so screens that imported the old names still
// resolve while the codebase migrates to the new tokens.
const kAuthText    = kAuthInk;
const kAuthSec     = kAuthInk2;
const kAuthPh      = kAuthInk3;
const kAuthBorder  = kAuthHair;
const kAuthGreen   = kAuthSuccess;
const kAuthFieldBg = kAuthCard;

// ── Branding helpers ──────────────────────────────────────────────────────────
const _kStorage = FlutterSecureStorage();
const _kLogoKey = 'cached_gym_logo_url';
const _kNameKey = 'cached_gym_name';

Future<({String? logo, String? name})> _loadGymBranding() async {
  final logo = await _kStorage.read(key: _kLogoKey);
  final name = await _kStorage.read(key: _kNameKey);
  if (logo != null || name != null) return (logo: logo, name: name);
  try {
    final service = ApiService();
    final gym = await service.getGymInfo('');
    return (logo: gym?.logoUrl, name: gym?.name);
  } catch (_) {
    return (logo: null, name: null);
  }
}

// ── Mark / Logo (compact dark square — top-left of auth screens) ──────────────
class AuthMark extends StatefulWidget {
  final double size;
  const AuthMark({super.key, this.size = 48});

  @override
  State<AuthMark> createState() => _AuthMarkState();
}

class _AuthMarkState extends State<AuthMark> {
  String? _logoUrl;

  @override
  void initState() {
    super.initState();
    _loadGymBranding().then((b) {
      if (mounted) setState(() => _logoUrl = b.logo);
    });
  }

  @override
  Widget build(BuildContext context) {
    final size = widget.size;
    final radius = size * 0.30;
    if (_logoUrl != null) {
      return Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(radius),
          boxShadow: const [
            BoxShadow(color: Color(0x2D1F1A14), blurRadius: 14, offset: Offset(0, 4)),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(radius),
          child: CachedNetworkImage(
            imageUrl: _logoUrl!,
            width: size,
            height: size,
            fit: BoxFit.cover,
            placeholder: (_, __) => _MarkFallback(size: size),
            errorWidget: (_, __, ___) => _MarkFallback(size: size),
          ),
        ),
      );
    }
    return _MarkFallback(size: size);
  }
}

class _MarkFallback extends StatelessWidget {
  final double size;
  const _MarkFallback({required this.size});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: kAuthInk,
        borderRadius: BorderRadius.circular(size * 0.30),
        boxShadow: const [
          BoxShadow(color: Color(0x2D1F1A14), blurRadius: 14, offset: Offset(0, 4)),
        ],
      ),
      child: Icon(Icons.fitness_center_rounded, color: Colors.white, size: size * 0.48),
    );
  }
}

/// Old name preserved for register_screen which still references it.
class AuthLogo extends StatelessWidget {
  final double size;
  const AuthLogo({super.key, this.size = 44});

  @override
  Widget build(BuildContext context) => AuthMark(size: size);
}

// ── Peach icon tile (used at top of forgot/reset/sign-up screens) ─────────────
class AuthPeachIcon extends StatelessWidget {
  final IconData icon;
  final double size;
  final double iconSize;
  const AuthPeachIcon({super.key, required this.icon, this.size = 56, this.iconSize = 26});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: kAuthPeach,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Icon(icon, color: kAuthInk, size: iconSize),
    );
  }
}

// ── GymBranding (logo + name row — kept for callers that still use it) ───────
class GymBranding extends StatefulWidget {
  const GymBranding({super.key});

  @override
  State<GymBranding> createState() => _GymBrandingState();
}

class _GymBrandingState extends State<GymBranding> {
  String? _logoUrl;
  String? _gymName;

  @override
  void initState() {
    super.initState();
    _loadGymBranding().then((b) {
      if (mounted) setState(() { _logoUrl = b.logo; _gymName = b.name; });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(13),
          child: _logoUrl != null
              ? CachedNetworkImage(
                  imageUrl: _logoUrl!,
                  width: 44, height: 44,
                  fit: BoxFit.cover,
                  placeholder: (_, __) => const _MarkFallback(size: 44),
                  errorWidget: (_, __, ___) => const _MarkFallback(size: 44),
                )
              : const _MarkFallback(size: 44),
        ),
        if (_gymName != null && _gymName!.isNotEmpty) ...[
          const SizedBox(width: 12),
          Flexible(
            child: Text(
              _gymName!,
              style: const TextStyle(
                fontSize: 18, fontWeight: FontWeight.w700,
                color: kAuthInk, letterSpacing: -0.4,
              ),
              maxLines: 1, overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ],
    );
  }
}

// ── Text field ────────────────────────────────────────────────────────────────
class AuthField extends StatefulWidget {
  final String label;
  final TextEditingController controller;
  final String placeholder;
  final TextInputType keyboardType;
  final bool isPassword;
  final bool obscureText;
  final VoidCallback? onToggleObscure;
  final TextInputAction textInputAction;
  final ValueChanged<String>? onSubmitted;
  final ValueChanged<String>? onChanged;
  final String? errorText;
  final Widget? leading;
  final bool autofocus;

  const AuthField({
    super.key,
    required this.label,
    required this.controller,
    required this.placeholder,
    this.keyboardType = TextInputType.text,
    this.isPassword = false,
    this.obscureText = false,
    this.onToggleObscure,
    this.textInputAction = TextInputAction.next,
    this.onSubmitted,
    this.onChanged,
    this.errorText,
    this.leading,
    this.autofocus = false,
  });

  @override
  State<AuthField> createState() => _AuthFieldState();
}

class _AuthFieldState extends State<AuthField> {
  final _focus = FocusNode();
  bool _focused = false;

  @override
  void initState() {
    super.initState();
    _focus.addListener(() => setState(() => _focused = _focus.hasFocus));
  }

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hasError = widget.errorText != null && widget.errorText!.isNotEmpty;
    final ringColor = hasError
        ? kAuthError
        : _focused ? kAuthPrimary : Colors.transparent;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4),
          child: Text(
            widget.label.toUpperCase(),
            style: const TextStyle(
              fontSize: 12, fontWeight: FontWeight.w600,
              color: kAuthInk2, letterSpacing: 0.3,
            ),
          ),
        ),
        const SizedBox(height: 6),
        AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          height: 50,
          decoration: BoxDecoration(
            color: kAuthCard,
            borderRadius: BorderRadius.circular(16),
            boxShadow: ringColor == Colors.transparent
                ? const [BoxShadow(color: Color(0x0A1F1A14), blurRadius: 2, offset: Offset(0, 1))]
                : [BoxShadow(color: ringColor, blurRadius: 0, spreadRadius: hasError ? 1.5 : 2)],
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              if (widget.leading != null) ...[
                widget.leading!,
                const SizedBox(width: 10),
              ],
              Expanded(
                child: TextField(
                  controller: widget.controller,
                  focusNode: _focus,
                  autofocus: widget.autofocus,
                  obscureText: widget.isPassword ? widget.obscureText : false,
                  keyboardType: widget.keyboardType,
                  textInputAction: widget.textInputAction,
                  onSubmitted: widget.onSubmitted,
                  onChanged: widget.onChanged,
                  style: const TextStyle(
                    fontSize: 16, fontWeight: FontWeight.w500,
                    color: kAuthInk, letterSpacing: 0.1,
                  ),
                  decoration: InputDecoration(
                    hintText: widget.placeholder,
                    hintStyle: const TextStyle(color: kAuthInk3, fontSize: 15, fontWeight: FontWeight.w400),
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
              if (widget.isPassword && widget.onToggleObscure != null)
                GestureDetector(
                  onTap: widget.onToggleObscure,
                  behavior: HitTestBehavior.opaque,
                  child: Padding(
                    padding: const EdgeInsets.only(left: 8),
                    child: Icon(
                      widget.obscureText ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                      color: kAuthInk2, size: 20,
                    ),
                  ),
                ),
            ],
          ),
        ),
        if (hasError) ...[
          const SizedBox(height: 6),
          Padding(
            padding: const EdgeInsets.only(left: 4),
            child: Text(
              widget.errorText!,
              style: const TextStyle(fontSize: 12, color: kAuthError, fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ],
    );
  }
}

// ── Tappable (read-only) field — e.g. date picker ────────────────────────────
class AuthTapField extends StatelessWidget {
  final String label;
  final String value;
  final String placeholder;
  final VoidCallback onTap;
  final Widget? trailing;

  const AuthTapField({
    super.key,
    required this.label,
    required this.value,
    required this.placeholder,
    required this.onTap,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    final hasValue = value.isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4),
          child: Text(
            label.toUpperCase(),
            style: const TextStyle(
              fontSize: 12, fontWeight: FontWeight.w600,
              color: kAuthInk2, letterSpacing: 0.3,
            ),
          ),
        ),
        const SizedBox(height: 6),
        GestureDetector(
          onTap: onTap,
          behavior: HitTestBehavior.opaque,
          child: Container(
            height: 50,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: kAuthCard,
              borderRadius: BorderRadius.circular(16),
              boxShadow: const [
                BoxShadow(color: Color(0x0A1F1A14), blurRadius: 2, offset: Offset(0, 1)),
              ],
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    hasValue ? value : placeholder,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: hasValue ? FontWeight.w500 : FontWeight.w400,
                      color: hasValue ? kAuthInk : kAuthInk3,
                    ),
                  ),
                ),
                if (trailing != null) trailing!,
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// ── Primary / ghost button ───────────────────────────────────────────────────
class AuthButton extends StatefulWidget {
  final String label;
  final VoidCallback? onTap;
  final bool isLoading;
  final bool isGhost;
  final bool enabled;

  const AuthButton({
    super.key,
    required this.label,
    this.onTap,
    this.isLoading = false,
    this.isGhost = false,
    this.enabled = true,
  });

  @override
  State<AuthButton> createState() => _AuthButtonState();
}

class _AuthButtonState extends State<AuthButton> {
  bool _tapped = false;

  @override
  void didUpdateWidget(AuthButton old) {
    super.didUpdateWidget(old);
    if (old.isLoading && !widget.isLoading) _tapped = false;
  }

  void _handleTap() {
    if (_tapped || widget.isLoading || !widget.enabled || widget.onTap == null) return;
    setState(() => _tapped = true);
    widget.onTap!();
    if (!widget.isLoading) {
      Future.microtask(() {
        if (mounted && !widget.isLoading) setState(() => _tapped = false);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final busy = widget.isLoading || _tapped;
    final disabled = !widget.enabled && !busy;
    final filled = !widget.isGhost;
    return GestureDetector(
      onTap: busy || disabled ? null : _handleTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        width: double.infinity,
        height: 56,
        decoration: BoxDecoration(
          color: filled
              ? (disabled ? kAuthPrimary.withValues(alpha: 0.40) : kAuthPrimary)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(18),
          border: widget.isGhost ? Border.all(color: kAuthHair, width: 1.5) : null,
          boxShadow: filled && !disabled
              ? const [BoxShadow(color: Color(0x59E07A3B), blurRadius: 18, offset: Offset(0, 6))]
              : const [],
        ),
        child: Center(
          child: busy
              ? SizedBox(
                  width: 22, height: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: widget.isGhost ? kAuthPrimary : Colors.white,
                  ),
                )
              : Text(
                  widget.label,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: widget.isGhost ? kAuthInk : Colors.white,
                    letterSpacing: 0.1,
                  ),
                ),
        ),
      ),
    );
  }
}

// ── Round back button — sits in the screen header at top-left ────────────────
class AuthBackButton extends StatelessWidget {
  final VoidCallback onTap;
  const AuthBackButton({super.key, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: 40, height: 40,
        decoration: const BoxDecoration(
          color: Color(0x0D1F1A14),
          shape: BoxShape.circle,
        ),
        child: const Icon(Icons.arrow_back_ios_new_rounded, size: 16, color: kAuthInk),
      ),
    );
  }
}

// ── Underlined text link (orange decoration) ─────────────────────────────────
class AuthTextLink extends StatelessWidget {
  final String text;
  final VoidCallback onTap;
  const AuthTextLink({super.key, required this.text, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Text(
          text,
          style: const TextStyle(
            fontSize: 14, fontWeight: FontWeight.w600,
            color: kAuthInk,
            decoration: TextDecoration.underline,
            decorationColor: kAuthPrimary,
            decorationThickness: 1.5,
          ),
        ),
      ),
    );
  }
}

// ── Segmented control ────────────────────────────────────────────────────────
class AuthSegment extends StatelessWidget {
  final List<String> options;
  final int selected;
  final ValueChanged<int> onSelect;

  const AuthSegment({
    super.key,
    required this.options,
    required this.selected,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: const Color(0x0A1F1A14),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: options.asMap().entries.map((e) {
          final active = e.key == selected;
          return Expanded(
            child: GestureDetector(
              onTap: () => onSelect(e.key),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                height: 40,
                decoration: BoxDecoration(
                  color: active ? kAuthCard : Colors.transparent,
                  borderRadius: BorderRadius.circular(11),
                  boxShadow: active
                      ? const [BoxShadow(color: Color(0x141F1A14), blurRadius: 4, offset: Offset(0, 1))]
                      : const [],
                ),
                child: Center(
                  child: Text(
                    e.value,
                    style: TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w600,
                      color: active ? kAuthInk : kAuthInk2,
                    ),
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

// ── "or" divider ─────────────────────────────────────────────────────────────
class AuthDivider extends StatelessWidget {
  const AuthDivider({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: Container(height: 1, color: kAuthHair)),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 12),
          child: Text(
            'or',
            style: TextStyle(fontSize: 12, color: kAuthInk3, fontWeight: FontWeight.w500),
          ),
        ),
        Expanded(child: Container(height: 1, color: kAuthHair)),
      ],
    );
  }
}

// ── Password strength: 4-bar meter ──────────────────────────────────────────
int authPasswordStrength(String pw) {
  int s = 0;
  if (pw.length >= 8) s++;
  if (RegExp(r'[A-Z]').hasMatch(pw)) s++;
  if (RegExp(r'[0-9]').hasMatch(pw)) s++;
  if (RegExp(r'[^A-Za-z0-9]').hasMatch(pw)) s++;
  return s;
}

class AuthStrengthMeter extends StatelessWidget {
  final String password;
  const AuthStrengthMeter({super.key, required this.password});

  @override
  Widget build(BuildContext context) {
    final s = authPasswordStrength(password);
    const labels = ['Too short', 'Weak', 'Okay', 'Strong', 'Very strong'];
    const colors = [kAuthInk3, kAuthError, kAuthWarn, kAuthSuccess, kAuthSuccess];
    return Padding(
      padding: const EdgeInsets.only(left: 4, right: 4),
      child: Row(
        children: [
          Expanded(
            child: Row(
              children: List.generate(4, (i) => Expanded(
                child: Container(
                  margin: EdgeInsets.only(right: i < 3 ? 4 : 0),
                  height: 4,
                  decoration: BoxDecoration(
                    color: i < s ? colors[s] : kAuthHair,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              )),
            ),
          ),
          const SizedBox(width: 10),
          SizedBox(
            width: 78,
            child: Text(
              password.isEmpty ? '' : labels[s],
              textAlign: TextAlign.right,
              style: TextStyle(
                fontSize: 11, fontWeight: FontWeight.w600,
                color: password.isEmpty ? kAuthInk3 : colors[s],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Password requirement checks ──────────────────────────────────────────────
class AuthPasswordChecks extends StatelessWidget {
  final String password;
  const AuthPasswordChecks({super.key, required this.password});

  @override
  Widget build(BuildContext context) {
    final items = [
      ('At least 8 characters', password.length >= 8),
      ('One uppercase letter',  RegExp(r'[A-Z]').hasMatch(password)),
      ('One number',            RegExp(r'[0-9]').hasMatch(password)),
    ];
    return Column(
      children: items.map((c) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Row(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: 16, height: 16,
                decoration: BoxDecoration(
                  color: c.$2 ? kAuthSuccess : kAuthHair,
                  shape: BoxShape.circle,
                ),
                child: c.$2
                    ? const Icon(Icons.check_rounded, color: Colors.white, size: 11)
                    : null,
              ),
              const SizedBox(width: 8),
              Text(
                c.$1,
                style: TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w500,
                  color: c.$2 ? kAuthInk : kAuthInk2,
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}

// ── Compact requirement chips (used inline under the password field) ─────────
class AuthReqChips extends StatelessWidget {
  final String password;
  const AuthReqChips({super.key, required this.password});

  @override
  Widget build(BuildContext context) {
    final items = [
      ('8+ chars',  password.length >= 8),
      ('Uppercase', RegExp(r'[A-Z]').hasMatch(password)),
      ('Number',    RegExp(r'[0-9]').hasMatch(password)),
    ];
    return Padding(
      padding: const EdgeInsets.only(left: 4, right: 4),
      child: Wrap(
        spacing: 6, runSpacing: 6,
        children: items.map((r) {
          final ok = r.$2;
          return Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
            decoration: BoxDecoration(
              color: ok ? kAuthSuccessBg : const Color(0x0A1F1A14),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  ok ? '✓' : '○',
                  style: TextStyle(
                    fontSize: 11, fontWeight: FontWeight.w700,
                    color: ok ? kAuthSuccess : kAuthInk3,
                  ),
                ),
                const SizedBox(width: 4),
                Text(
                  r.$1,
                  style: TextStyle(
                    fontSize: 11, fontWeight: FontWeight.w600,
                    color: ok ? kAuthSuccess : kAuthInk3,
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }
}

// ── Step bar (Account / You / Club) for the sign-up flow ─────────────────────
class AuthStepBar extends StatelessWidget {
  final int step; // 0..(labels.length-1)
  final List<String> labels;
  const AuthStepBar({
    super.key,
    required this.step,
    this.labels = const ['Account', 'You', 'Club'],
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Row(
        children: List.generate(labels.length * 2 - 1, (i) {
          if (i.isOdd) {
            final between = i ~/ 2;
            final done = between < step;
            return Expanded(
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 6),
                height: 2,
                decoration: BoxDecoration(
                  color: done ? kAuthSuccess : const Color(0x1A1F1A14),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            );
          }
          final idx = i ~/ 2;
          final done = idx < step;
          final active = idx == step;
          return Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                width: 22, height: 22,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: done ? kAuthSuccess : (active ? kAuthInk : Colors.transparent),
                  border: (done || active) ? null : Border.all(color: const Color(0x2D1F1A14), width: 1.4),
                ),
                alignment: Alignment.center,
                child: done
                    ? const Icon(Icons.check_rounded, color: Colors.white, size: 13)
                    : Text(
                        '${idx + 1}',
                        style: TextStyle(
                          fontSize: 11, fontWeight: FontWeight.w700,
                          color: active ? Colors.white : kAuthInk3,
                        ),
                      ),
              ),
              const SizedBox(width: 8),
              Text(
                labels[idx].toUpperCase(),
                style: TextStyle(
                  fontSize: 11, fontWeight: FontWeight.w600,
                  letterSpacing: 0.2,
                  color: active ? kAuthInk : (done ? kAuthInk2 : kAuthInk3),
                ),
              ),
            ],
          );
        }),
      ),
    );
  }
}

// ── Big success / status icon for done screens ───────────────────────────────
class AuthStatusIcon extends StatelessWidget {
  final IconData icon;
  final Color color;
  const AuthStatusIcon({super.key, this.icon = Icons.check_rounded, this.color = kAuthSuccess});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 96, height: 96,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(color: color.withValues(alpha: 0.35), blurRadius: 28, offset: const Offset(0, 10)),
        ],
      ),
      child: Icon(icon, color: Colors.white, size: 42),
    );
  }
}

// ── Step progress bar (kept for callers that haven't migrated yet) ───────────
class AuthProgressBar extends StatelessWidget {
  final double progress;
  const AuthProgressBar({super.key, required this.progress});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(2),
      child: Container(
        height: 3,
        color: kAuthHair,
        child: LayoutBuilder(
          builder: (_, c) => Align(
            alignment: Alignment.centerLeft,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 350),
              curve: Curves.easeInOut,
              width: c.maxWidth * progress,
              height: 3,
              color: kAuthPrimary,
            ),
          ),
        ),
      ),
    );
  }
}
