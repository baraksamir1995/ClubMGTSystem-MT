import 'package:flutter/material.dart';

/// Coach-app color tokens — LIGHT theme.
///
/// Surfaces / ink / semantics are fixed `const` light-mode values (warm cream
/// + dark ink, matching the member app's light design language). Only the two
/// brand accents — [primary] (CTA / focus / highlights) and [secondary]
/// (energy accent) — and their derived tokens are MUTABLE: they default to
/// the dashboard's default branding and are overridden at runtime by
/// [applyBranding] with the gym's `branding_config.primary_color` /
/// `secondary_color` from the dashboard settings.
///
/// Only the six accent tokens are non-const — don't reference THOSE from
/// `const` widget constructors. Every fixed token is `const` and safe
/// anywhere.
class AppColors {
  AppColors._();

  // ── Surfaces (warm cream, member-app design language) ────────────────────
  static const Color bg = Color(0xFFF7F6F2);
  static const Color bgElev = Color(0xFFFFFFFF);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surface2 = Color(0xFFF0EFEA);
  static const Color surface3 = Color(0xFFE7E6E0);

  // Page background used outside the device frame in the prototype.
  static const Color outerBg = Color(0xFFF2F1EC);

  // ── Borders (black-alpha on light surfaces) ─────────────────────────────
  static const Color border = Color(0x14000000);
  static const Color borderStrong = Color(0x29000000);

  // ── Text (dark ink on light surfaces) ───────────────────────────────────
  static const Color text = Color(0xFF1F1A14);
  static const Color textSec = Color(0xFF6B6860);
  static const Color textTer = Color(0xFF9A968D);

  // ── Brand accents (dashboard-driven; see applyBranding) ─────────────────
  // Defaults mirror the dashboard's own default branding. Kept as private
  // consts so applyBranding(null) can RESET to them — a gym that clears its
  // colors (or a coach switching to an unbranded gym) must not inherit the
  // previous gym's accents.
  static const Color _defaultPrimary = Color(0xFF4F46E5);
  static const Color _defaultSecondary = Color(0xFF818CF8);

  /// Primary brand color — `branding_config.primary_color` in the dashboard.
  static Color primary = _defaultPrimary;

  /// Secondary brand color — `branding_config.secondary_color`.
  static Color secondary = _defaultSecondary;

  /// Pressed-state variant of [primary] (darkened, or lightened for
  /// near-black accents so feedback stays visible).
  static Color primaryDim = _dim(_defaultPrimary);

  /// Ink placed on top of [primary] — whichever of white / near-black has
  /// the higher WCAG contrast against it.
  static Color primaryInk = _inkOn(_defaultPrimary);

  /// Soft primary fill used behind chips/highlights (18% alpha).
  static Color primarySoft = _defaultPrimary.withValues(alpha: 0.18);

  /// Soft secondary fill.
  static Color secondarySoft = _defaultSecondary.withValues(alpha: 0.18);

  // ── Legacy accent names (lime = primary accent) ──────────────────────────
  // Existing screens read these; they resolve to the branding accents.
  static Color get lime => primary;
  static Color get limeText => primaryInk;

  // ── Semantic (fixed, AA on light surfaces) ──────────────────────────────
  static const Color warn = Color(0xFF9A6A0B);
  static const Color warnSoft = Color(0x2EE8AC4F);
  static const Color danger = Color(0xFFB3391F);
  static const Color dangerSoft = Color(0x2EE56A4A);
  static const Color success = Color(0xFF2E7D4F);
  static const Color successSoft = Color(0x2E6FD08C);

  // ── Convenience white ───────────────────────────────────────────────────
  static const Color white = Color(0xFFFFFFFF);

  // ── Avatar palette (hashed by name → one of these) ──────────────────────
  static const List<Color> avatarPalette = [
    Color(0xFFB04B36), // red
    Color(0xFFB67833), // orange
    Color(0xFF3E8C8C), // teal
    Color(0xFF6B4DA8), // purple
    Color(0xFFA84D8A), // magenta
    Color(0xFF3F8B5C), // green
    Color(0xFF3F6BB6), // blue
    Color(0xFF8F8A2C), // olive
  ];

  /// Apply the gym's dashboard branding. Passing null for a color RESETS
  /// that accent to the default — branding must never be sticky across
  /// gyms. Derived tokens (ink / dim / soft) are always recomputed in
  /// lockstep so they cannot desynchronize.
  static void applyBranding({Color? primaryColor, Color? secondaryColor}) {
    final p = primaryColor ?? _defaultPrimary;
    primary = p;
    primaryDim = _dim(p);
    primaryInk = _inkOn(p);
    primarySoft = p.withValues(alpha: 0.18);

    final s = secondaryColor ?? _defaultSecondary;
    secondary = s;
    secondarySoft = s.withValues(alpha: 0.18);
  }

  /// Parse a `#RGB` / `#RRGGBB` / `#AARRGGBB` hex string (with or without
  /// any number of leading `#`). Returns null when unparseable — callers
  /// should log so a gym's ignored dashboard color is diagnosable.
  static Color? tryParseHex(String? hex) {
    if (hex == null) return null;
    var h = hex.trim().replaceAll('#', '');
    if (h.length == 3) {
      h = h.split('').map((c) => '$c$c').join(); // #RGB shorthand
    }
    if (h.length == 6) h = 'FF$h';
    if (h.length != 8) return null;
    final v = int.tryParse(h, radix: 16);
    return v == null ? null : Color(v);
  }

  /// Pressed-state variant: darken, but LIGHTEN near-black accents where
  /// darkening is a no-op and pressed states would give no feedback.
  static Color _dim(Color c) {
    final hsl = HSLColor.fromColor(c);
    final delta = hsl.lightness < 0.18 ? 0.12 : -0.12;
    return hsl
        .withLightness((hsl.lightness + delta).clamp(0.0, 1.0))
        .toColor();
  }

  static const Color _inkDark = Color(0xFF14120E);

  /// White or near-black ink — whichever has the higher WCAG contrast ratio
  /// against the accent, so CTA labels stay readable whatever color the gym
  /// picks in the dashboard. (A fixed luminance threshold well above the
  /// ~0.18 crossover previously produced ~2:1 white-on-gold labels.)
  static Color _inkOn(Color c) {
    final l = c.computeLuminance();
    final whiteContrast = 1.05 / (l + 0.05);
    final darkContrast = (l + 0.05) / (_inkDark.computeLuminance() + 0.05);
    return whiteContrast >= darkContrast ? Colors.white : _inkDark;
  }
}
