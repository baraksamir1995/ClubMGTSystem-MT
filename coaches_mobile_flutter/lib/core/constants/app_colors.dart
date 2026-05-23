import 'package:flutter/material.dart';

/// CLBY brand tokens — taken from the official brand system:
///   #0A0A0A bg / #161616 surface / #B8FF2E green (entry) /
///   #FF6B2B orange (energy) / #F5F5F2 fg
///
/// `lime` is kept as an alias of the brand green for backward compat
/// with the existing screens; new code should prefer `green`.
class AppColors {
  AppColors._();

  // ── Surfaces ────────────────────────────────────────────────────────────
  static const Color bg = Color(0xFF0A0A0A);
  static const Color bgElev = Color(0xFF101010);
  static const Color surface = Color(0xFF161616);
  static const Color surface2 = Color(0xFF1F1F1F);
  static const Color surface3 = Color(0xFF272727);

  // Page background used outside the device frame in the prototype.
  static const Color outerBg = Color(0xFF080808);

  // ── Borders ─────────────────────────────────────────────────────────────
  static const Color border = Color(0x14FFFFFF); // rgba(255,255,255,0.08)
  static const Color borderStrong = Color(0x24FFFFFF); // rgba(255,255,255,0.14)

  // ── Text (off-white per brand system) ───────────────────────────────────
  static const Color text = Color(0xFFF5F5F2);
  static const Color textSec = Color(0xFFA3A39C);
  static const Color textTer = Color(0xFF5E5E58);

  // ── Brand accents ───────────────────────────────────────────────────────
  /// Primary — "entry" green per the brand system.
  static const Color green = Color(0xFFB8FF2E);
  static const Color greenDim = Color(0xFFA1E125);
  /// Ink color for foreground placed on top of `green`.
  static const Color greenText = Color(0xFF0A0A0A);
  /// Soft green fill used behind chips/highlights.
  static const Color greenSoft = Color(0x2EB8FF2E);

  /// Secondary — "energy" orange.
  static const Color orange = Color(0xFFFF6B2B);
  static const Color orangeSoft = Color(0x2EFF6B2B);

  // Aliases — keep `lime*` names working until the screens stop reading
  // them. They map to the new brand green so the change is one-line.
  static const Color lime = green;
  static const Color limeText = greenText;
  static const Color limeDim = greenSoft;

  // ── Semantic ────────────────────────────────────────────────────────────
  /// warn = amber (~oklch(0.78 0.16 70))
  static const Color warn = Color(0xFFE8AC4F);
  static const Color warnSoft = Color(0x2EE8AC4F);
  /// danger = red (~oklch(0.7 0.22 25))
  static const Color danger = Color(0xFFE56A4A);
  static const Color dangerSoft = Color(0x2EE56A4A);
  /// success = green (~oklch(0.78 0.18 145))
  static const Color success = Color(0xFF6FD08C);
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
}

// ── Auth-screen aliases ──────────────────────────────────────────────────────
// Stable names other widgets reference. Kept so a future redesign only
// touches one file. The k* aliases mirror the design's `C.*` names.
const Color kAuthBg = AppColors.bg;
const Color kAuthSurface = AppColors.surface;
const Color kAuthSurface2 = AppColors.surface2;
const Color kAuthInk = AppColors.text;
const Color kAuthInk2 = AppColors.textSec;
const Color kAuthInk3 = AppColors.textTer;
const Color kAuthPrimary = AppColors.lime;
const Color kAuthPrimaryInk = AppColors.limeText;
const Color kAuthError = AppColors.danger;
const Color kAuthErrorSoft = AppColors.dangerSoft;
const Color kAuthBorder = AppColors.border;
const Color kAuthBorderStrong = AppColors.borderStrong;

// Older alias kept so any incidental imports still resolve. Equivalent to
// `surface` in the dark palette.
const Color kAuthCard = AppColors.surface;
