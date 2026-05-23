import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// CLBY Coach typography. Ported from `coach-tokens.jsx`:
///   FontDisp = Bebas Neue (display: titles, stats, uppercase wide)
///   FontBody = Geist       (body: form text, primary labels)
///   FontMono = Geist Mono  (data/labels: uppercase mono with letter-spacing)
///
/// Fonts are loaded at runtime via google_fonts, so no asset bundling is
/// needed. The helpers below let callers compose the right family/size/
/// letter-spacing the design specifies, without hardcoding TextStyle copies.
class AppText {
  AppText._();

  // Family names use Google Fonts' canonical spellings. The design uses
  // Geist / Geist Mono, but those aren't yet in the bundled google_fonts
  // 6.2.1 registry — getFont() throws. Inter and JetBrains Mono are the
  // closest, universally-available substitutes (Inter is the Geist
  // predecessor at Vercel; JetBrains Mono is the same neo-grotesque mono
  // class as Geist Mono). When bumping google_fonts to a version that
  // ships Geist, swap these back.
  static const String _dispFamily = 'Bebas Neue';
  static const String _bodyFamily = 'Inter';
  static const String _monoFamily = 'JetBrains Mono';

  /// Display — Bebas Neue. Use for large screen titles and stat numbers.
  /// The design uses wide uppercase letter-spacing ~0.5–6.
  static TextStyle disp({
    double size = 22,
    double letterSpacing = 1.2,
    Color color = const Color(0xFFF4F4F0),
    FontWeight weight = FontWeight.w400,
    double? height,
  }) =>
      GoogleFonts.getFont(
        _dispFamily,
        fontSize: size,
        color: color,
        letterSpacing: letterSpacing,
        fontWeight: weight,
        height: height,
      );

  /// Body — Geist. Default for form text, paragraphs, button labels.
  static TextStyle body({
    double size = 14,
    double letterSpacing = -0.2,
    Color color = const Color(0xFFF4F4F0),
    FontWeight weight = FontWeight.w400,
    double? height,
  }) =>
      GoogleFonts.getFont(
        _bodyFamily,
        fontSize: size,
        color: color,
        letterSpacing: letterSpacing,
        fontWeight: weight,
        height: height,
      );

  /// Mono — Geist Mono. Uppercase data labels, small captions, key/value.
  static TextStyle mono({
    double size = 11,
    double letterSpacing = 1.5,
    Color color = const Color(0xFFA3A39C),
    FontWeight weight = FontWeight.w400,
    double? height,
  }) =>
      GoogleFonts.getFont(
        _monoFamily,
        fontSize: size,
        color: color,
        letterSpacing: letterSpacing,
        fontWeight: weight,
        height: height,
      );
}
