import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../services/api_service.dart';

// ── Design tokens ─────────────────────────────────────────────────────────────
const kAuthBg      = Color(0xFFF5F5F7);   // iOS-style light gray
const kAuthPrimary = Color(0xFF534AB7);
const kAuthFieldBg = Color(0xFFFFFFFF);   // white fields
const kAuthText    = Color(0xFF1C1C1E);   // iOS dark text
const kAuthSec     = Color(0xFF8E8E93);   // iOS secondary label
const kAuthPh      = Color(0xFFC7C7CC);   // iOS placeholder
const kAuthBorder  = Color(0xFFE5E5EA);   // iOS separator
const kAuthGreen   = Color(0xFF1D9E75);

// ── Branding helpers ──────────────────────────────────────────────────────────
const _kStorage     = FlutterSecureStorage();
const _kLogoKey     = 'cached_gym_logo_url';
const _kNameKey     = 'cached_gym_name';

Future<({String? logo, String? name})> _loadGymBranding() async {
  final logo = await _kStorage.read(key: _kLogoKey);
  final name = await _kStorage.read(key: _kNameKey);
  if (logo != null || name != null) return (logo: logo, name: name);
  // Fallback: fetch from Laravel API for first-time / no-cache users
  try {
    final service = ApiService();
    final gym = await service.getGymInfo('');
    return (
      logo: gym?.logoUrl,
      name: gym?.name,
    );
  } catch (_) {
    return (logo: null, name: null);
  }
}

// ── Logo (compact square — used in register header) ───────────────────────────
class AuthLogo extends StatefulWidget {
  final double size;
  const AuthLogo({super.key, this.size = 44});

  @override
  State<AuthLogo> createState() => _AuthLogoState();
}

class _AuthLogoState extends State<AuthLogo> {
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
    final r = widget.size * 0.30;
    if (_logoUrl != null) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(r),
        child: CachedNetworkImage(
          imageUrl: _logoUrl!,
          width: widget.size,
          height: widget.size,
          fit: BoxFit.cover,
          placeholder: (_, __) => _LogoFallback(size: widget.size),
          errorWidget: (_, __, ___) => _LogoFallback(size: widget.size),
        ),
      );
    }
    return _LogoFallback(size: widget.size);
  }
}

class _LogoFallback extends StatelessWidget {
  final double size;
  const _LogoFallback({required this.size});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: kAuthPrimary,
        borderRadius: BorderRadius.circular(size * 0.30),
      ),
      child: Icon(Icons.fitness_center_rounded,
          color: Colors.white, size: size * 0.48),
    );
  }
}

// ── GymBranding (logo + name row — used on login screen) ─────────────────────
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
        // Logo square
        ClipRRect(
          borderRadius: BorderRadius.circular(13),
          child: _logoUrl != null
              ? CachedNetworkImage(
                  imageUrl: _logoUrl!,
                  width: 44,
                  height: 44,
                  fit: BoxFit.cover,
                  placeholder: (_, __) => const _LogoFallback(size: 44),
                  errorWidget: (_, __, ___) => const _LogoFallback(size: 44),
                )
              : const _LogoFallback(size: 44),
        ),
        if (_gymName != null && _gymName!.isNotEmpty) ...[
          const SizedBox(width: 12),
          Flexible(
            child: Text(
              _gymName!,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: kAuthText,
                letterSpacing: -0.4,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
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
    final borderColor = hasError
        ? const Color(0xFFEF4444)
        : _focused
            ? kAuthPrimary
            : kAuthBorder;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          widget.label.toUpperCase(),
          style: const TextStyle(
            fontSize: 11, fontWeight: FontWeight.w500,
            color: kAuthSec, letterSpacing: 0.7,
          ),
        ),
        const SizedBox(height: 5),
        AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          height: 52,
          decoration: BoxDecoration(
            color: kAuthFieldBg,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: borderColor, width: 1.5),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: widget.controller,
                  focusNode: _focus,
                  obscureText: widget.isPassword ? widget.obscureText : false,
                  keyboardType: widget.keyboardType,
                  textInputAction: widget.textInputAction,
                  onSubmitted: widget.onSubmitted,
                  onChanged: widget.onChanged,
                  style: const TextStyle(fontSize: 15, color: kAuthText),
                  decoration: InputDecoration(
                    hintText: widget.placeholder,
                    hintStyle: const TextStyle(color: kAuthPh, fontSize: 15),
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
                  child: Padding(
                    padding: const EdgeInsets.only(left: 8),
                    child: Icon(
                      widget.obscureText
                          ? Icons.visibility_off_outlined
                          : Icons.visibility_outlined,
                      color: kAuthPh,
                      size: 18,
                    ),
                  ),
                ),
            ],
          ),
        ),
        if (hasError) ...[
          const SizedBox(height: 4),
          Text(
            widget.errorText!,
            style: const TextStyle(fontSize: 11, color: Color(0xFFEF4444)),
          ),
        ],
      ],
    );
  }
}

// ── Tappable (read-only) field — e.g. date picker ─────────────────────────────
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
        Text(
          label.toUpperCase(),
          style: const TextStyle(
            fontSize: 11, fontWeight: FontWeight.w500,
            color: kAuthSec, letterSpacing: 0.7,
          ),
        ),
        const SizedBox(height: 5),
        GestureDetector(
          onTap: onTap,
          child: Container(
            height: 52,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: kAuthFieldBg,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: hasValue ? kAuthPrimary : kAuthBorder,
                width: 1.5,
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    hasValue ? value : placeholder,
                    style: TextStyle(
                      fontSize: 15,
                      color: hasValue ? kAuthText : kAuthPh,
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

// ── Primary / ghost button ────────────────────────────────────────────────────
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
    // Reset internal guard when parent clears isLoading
    if (old.isLoading && !widget.isLoading) _tapped = false;
  }

  void _handleTap() {
    if (_tapped || widget.isLoading || !widget.enabled || widget.onTap == null) return;
    setState(() => _tapped = true);
    widget.onTap!();
    // Reset guard after sync callbacks (async ones use isLoading to control state)
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
    return GestureDetector(
      onTap: busy || disabled ? null : _handleTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        width: double.infinity,
        height: 52,
        decoration: BoxDecoration(
          color: widget.isGhost
              ? Colors.transparent
              : disabled
                  ? kAuthPrimary.withValues(alpha: 0.35)
                  : kAuthPrimary,
          borderRadius: BorderRadius.circular(14),
          border: widget.isGhost ? Border.all(color: kAuthBorder, width: 1.5) : null,
        ),
        child: Center(
          child: busy
              ? SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: widget.isGhost ? kAuthPrimary : Colors.white,
                  ),
                )
              : Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      widget.label,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w500,
                        color: widget.isGhost ? const Color(0xFF444441) : Colors.white,
                      ),
                    ),
                    if (!widget.isGhost) ...[
                      const SizedBox(width: 8),
                      const Icon(Icons.arrow_forward_rounded,
                          color: Colors.white, size: 16),
                    ],
                  ],
                ),
        ),
      ),
    );
  }
}

// ── Circular back button ──────────────────────────────────────────────────────
class AuthBackButton extends StatelessWidget {
  final VoidCallback onTap;
  const AuthBackButton({super.key, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36,
        height: 36,
        decoration: const BoxDecoration(color: kAuthFieldBg, shape: BoxShape.circle),
        child: const Icon(Icons.arrow_back_ios_new_rounded,
            size: 14, color: Color(0xFF444441)),
      ),
    );
  }
}

// ── Segmented control ─────────────────────────────────────────────────────────
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
        color: kAuthBorder,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: options.asMap().entries.map((e) {
          final active = e.key == selected;
          return Expanded(
            child: GestureDetector(
              onTap: () => onSelect(e.key),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                height: 38,
                decoration: BoxDecoration(
                  color: active ? Colors.white : Colors.transparent,
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Center(
                  child: Text(
                    e.value,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: active ? kAuthText : const Color(0xFF888780),
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

// ── "or" divider ──────────────────────────────────────────────────────────────
class AuthDivider extends StatelessWidget {
  const AuthDivider({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: Container(height: 1, color: kAuthBorder)),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 10),
          child: Text('or',
              style: TextStyle(
                  fontSize: 12, color: kAuthPh, fontWeight: FontWeight.w500)),
        ),
        Expanded(child: Container(height: 1, color: kAuthBorder)),
      ],
    );
  }
}

// ── Password strength checks ──────────────────────────────────────────────────
class AuthPasswordChecks extends StatelessWidget {
  final String password;
  const AuthPasswordChecks({super.key, required this.password});

  @override
  Widget build(BuildContext context) {
    final items = [
      ('Min 8 characters', password.length >= 8),
      ('One uppercase letter', RegExp(r'[A-Z]').hasMatch(password)),
      ('One number', RegExp(r'[0-9]').hasMatch(password)),
    ];
    return Column(
      children: items.map((c) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 7),
          child: Row(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: 18, height: 18,
                decoration: BoxDecoration(
                  color: c.$2 ? kAuthGreen : Colors.transparent,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: c.$2 ? kAuthGreen : const Color(0xFFD3D1C7),
                    width: 1.5,
                  ),
                ),
                child: c.$2
                    ? const Icon(Icons.check_rounded,
                        color: Colors.white, size: 10)
                    : null,
              ),
              const SizedBox(width: 8),
              Text(
                c.$1,
                style: TextStyle(
                    fontSize: 12,
                    color: c.$2 ? kAuthGreen : kAuthPh),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}

// ── Step progress bar ─────────────────────────────────────────────────────────
class AuthProgressBar extends StatelessWidget {
  final double progress;
  const AuthProgressBar({super.key, required this.progress});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(2),
      child: Container(
        height: 3,
        color: kAuthBorder,
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
