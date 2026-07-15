import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:clby/l10n/l10n.dart';

const String kTermsUrl = 'https://www.clbyapp.com/terms';
const String kPrivacyUrl = 'https://www.clbyapp.com/privacy';

Future<void> _open(String url) async {
  final uri = Uri.parse(url);
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}

/// Inline consent line for auth flows: "By continuing you agree to our
/// Terms of Service and Privacy Policy". Tap each link to open externally.
class LegalConsentLine extends StatelessWidget {
  final Color textColor;
  final Color linkColor;
  final double fontSize;
  /// When null, falls back to the localized default consent prefix.
  final String? prefix;

  const LegalConsentLine({
    super.key,
    this.textColor = const Color(0xFF6B7280),
    this.linkColor = const Color(0xFF5B50E8),
    this.fontSize = 12,
    this.prefix,
  });

  @override
  Widget build(BuildContext context) {
    TextSpan linkSpan(String label, String url) => TextSpan(
          text: label,
          style: TextStyle(
            color: linkColor,
            fontWeight: FontWeight.w600,
            decoration: TextDecoration.underline,
          ),
          recognizer: TapGestureRecognizer()..onTap = () => _open(url),
        );

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: RichText(
        textAlign: TextAlign.center,
        text: TextSpan(
          style: TextStyle(color: textColor, fontSize: fontSize, height: 1.4),
          children: [
            TextSpan(text: prefix ?? context.l10n.legalConsentPrefix),
            linkSpan(context.l10n.legalTermsOfService, kTermsUrl),
            TextSpan(text: context.l10n.legalAnd),
            linkSpan(context.l10n.legalPrivacyPolicy, kPrivacyUrl),
            const TextSpan(text: '.'),
          ],
        ),
      ),
    );
  }
}

/// Opens the Terms of Service in an external browser.
Future<void> openTermsOfService() => _open(kTermsUrl);

/// Opens the Privacy Policy in an external browser.
Future<void> openPrivacyPolicy() => _open(kPrivacyUrl);
