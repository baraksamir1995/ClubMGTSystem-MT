import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'package:clby/l10n/l10n.dart';

/// The result returned when the Paymob WebView checkout finishes.
enum PaymobResult { success, pending, failed, cancelled }

class PaymobCheckoutResult {
  final PaymobResult result;
  final String?      transactionId;
  const PaymobCheckoutResult(this.result, {this.transactionId});
}

/// Hosts the Paymob unified checkout inside a WebView.
///
/// Paymob redirects to [_redirectBase] after the user completes (or fails)
/// payment. We intercept that navigation and pop with the appropriate
/// [PaymobResult] — the URL is never actually loaded.
class PaymobWebviewScreen extends StatefulWidget {
  final String checkoutUrl;

  const PaymobWebviewScreen({super.key, required this.checkoutUrl});

  @override
  State<PaymobWebviewScreen> createState() => _PaymobWebviewScreenState();
}

class _PaymobWebviewScreenState extends State<PaymobWebviewScreen> {
  late final WebViewController _controller;
  bool _loading = true;

  // Dummy domain the Flutter WebView intercepts — never actually requested
  static const _redirectBase  = 'https://gymapp.redirect/payment/callback';
  // Only allow navigation within Paymob domains
  static const _paymobDomains = ['accept.paymob.com', 'paymob.com', 'paymobsolutions.com'];

  @override
  void initState() {
    super.initState();

    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) => setState(() => _loading = true),
          onPageFinished: (_) => setState(() => _loading = false),
          onWebResourceError: (_) => setState(() => _loading = false),
          onNavigationRequest: _handleNavigation,
        ),
      )
      ..loadRequest(Uri.parse(widget.checkoutUrl));
  }

  NavigationDecision _handleNavigation(NavigationRequest request) {
    final url = request.url;

    // Intercept our dummy redirect domain — Paymob sends result here
    if (url.startsWith(_redirectBase)) {
      final uri           = Uri.parse(url);
      final success       = uri.queryParameters['success'] == 'true';
      final pending       = uri.queryParameters['pending'] == 'true';
      final transactionId = uri.queryParameters['id'] ?? uri.queryParameters['transaction_id'];

      PaymobResult result;
      if (success)       result = PaymobResult.success;
      else if (pending)  result = PaymobResult.pending;
      else               result = PaymobResult.failed;

      if (mounted) Navigator.of(context).pop(
        PaymobCheckoutResult(result, transactionId: transactionId),
      );
      return NavigationDecision.prevent;
    }

    // Block navigation away from Paymob domains (e.g. close button inside checkout)
    final host = Uri.tryParse(url)?.host ?? '';
    final isPaymob = _paymobDomains.any((d) => host == d || host.endsWith('.$d'));
    if (!isPaymob) {
      if (mounted) Navigator.of(context).pop(
        PaymobCheckoutResult(PaymobResult.cancelled),
      );
      return NavigationDecision.prevent;
    }

    return NavigationDecision.navigate;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.paymobSecurePayment),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.of(context).pop(
            const PaymobCheckoutResult(PaymobResult.cancelled),
          ),
        ),
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_loading)
            const Center(child: CircularProgressIndicator()),
        ],
      ),
    );
  }
}
