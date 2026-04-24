import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

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
  final String prefix;

  const LegalConsentLine({
    super.key,
    this.textColor = const Color(0xFF6B7280),
    this.linkColor = const Color(0xFF5B50E8),
    this.fontSize = 12,
    this.prefix = 'By continuing, you agree to our ',
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
            TextSpan(text: prefix),
            linkSpan('Terms of Service', kTermsUrl),
            const TextSpan(text: ' and '),
            linkSpan('Privacy Policy', kPrivacyUrl),
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
