import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'package:clby/l10n/l10n.dart';

import 'paymob_webview_screen.dart';

/// A fully custom card payment screen powered by the Paymob Pixel SDK.
/// The card input fields are hosted/secured by Paymob; only the surrounding
/// UI is ours — no raw card data ever touches our servers.
class PaymobCardScreen extends StatefulWidget {
  final String clientSecret;
  final String publicKey;
  final double amount;
  final String currency;
  final Color primaryColor;

  const PaymobCardScreen({
    super.key,
    required this.clientSecret,
    required this.publicKey,
    required this.amount,
    required this.currency,
    this.primaryColor = const Color(0xFF7C3AED),
  });

  @override
  State<PaymobCardScreen> createState() => _PaymobCardScreenState();
}

class _PaymobCardScreenState extends State<PaymobCardScreen> {
  late final WebViewController _controller;
  bool _loading = true;
  bool _htmlLoaded = false;

  static const _redirectBase = 'https://gymapp.redirect/payment/callback';

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..addJavaScriptChannel('PaymobChannel', onMessageReceived: _onMessage)
      ..setNavigationDelegate(NavigationDelegate(
        onPageStarted: (_) => setState(() => _loading = true),
        onPageFinished: (_) => setState(() => _loading = false),
        onWebResourceError: (_) => setState(() => _loading = false),
        onNavigationRequest: _handleNavigation,
      ));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Localized strings need an inherited-widget lookup, which isn't allowed
    // in initState — load the HTML here on the first pass instead.
    if (!_htmlLoaded) {
      _htmlLoaded = true;
      _controller.loadHtmlString(_buildHtml());
    }
  }

  void _onMessage(JavaScriptMessage message) {
    final data          = json.decode(message.message) as Map<String, dynamic>;
    final status        = data['status'] as String?;
    final transactionId = data['transaction_id'] as String?;

    PaymobResult result;
    switch (status) {
      case 'success':
        result = PaymobResult.success;
      case 'declined':
        result = PaymobResult.failed;
      default:
        return; // ignore unknown messages
    }

    if (mounted) Navigator.of(context).pop(
      PaymobCheckoutResult(result, transactionId: transactionId),
    );
  }

  NavigationDecision _handleNavigation(NavigationRequest request) {
    final url = request.url;

    // Only intercept 3DS completion — Pixel SDK handles everything else internally
    if (url.startsWith(_redirectBase)) {
      final uri           = Uri.parse(url);
      final success       = uri.queryParameters['success'] == 'true';
      final pending       = uri.queryParameters['pending'] == 'true';
      final transactionId = uri.queryParameters['id'] ?? uri.queryParameters['transaction_id'];

      PaymobResult result;
      if (success)      result = PaymobResult.success;
      else if (pending) result = PaymobResult.pending;
      else              result = PaymobResult.failed;

      if (mounted) Navigator.of(context).pop(
        PaymobCheckoutResult(result, transactionId: transactionId),
      );
      return NavigationDecision.prevent;
    }

    return NavigationDecision.navigate;
  }

  String _primaryHex() {
    final c = widget.primaryColor;
    return '#${c.red.toRadixString(16).padLeft(2, '0')}'
           '${c.green.toRadixString(16).padLeft(2, '0')}'
           '${c.blue.toRadixString(16).padLeft(2, '0')}';
  }

  String _buildHtml() {
    final l10n       = context.l10n;
    final primary    = _primaryHex();
    final amount     = widget.amount.toStringAsFixed(2);
    final currency   = widget.currency;
    final pubKey     = widget.publicKey;
    final secret     = widget.clientSecret;
    final isRtl      = Directionality.of(context) == TextDirection.rtl;
    final dir        = isRtl ? 'rtl' : 'ltr';
    final lang       = Localizations.localeOf(context).languageCode;

    final totalAmountLabel = l10n.paymobTotalAmount;
    final cardDetailsLabel = l10n.paymobCardDetails;
    final payLabel         = l10n.paymobPayAmount('$amount $currency');
    // json.encode-d so they can be embedded safely inside the JS below.
    final payLabelJs       = json.encode(payLabel);
    final processingJs     = json.encode(l10n.paymobProcessing);
    final declinedJs       = json.encode(l10n.paymobDeclinedCheckCard);
    final securedFooter    = l10n.paymobSecuredFooter;

    return '''
<!DOCTYPE html>
<html lang="$lang" dir="$dir">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
  <title>Payment</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #F6F7FB;
      min-height: 100vh;
      padding: 20px 16px 32px;
    }

    .amount-card {
      background: $primary;
      border-radius: 16px;
      padding: 20px 24px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .amount-label { font-size: 13px; color: rgba(255,255,255,0.75); }
    .amount-value { font-size: 24px; font-weight: 700; color: #fff; }

    .card {
      background: #fff;
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }
    .card-title {
      font-size: 14px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .card-title svg { flex-shrink: 0; }

    /* Pixel SDK renders into this div */
    #paymob-fields { min-height: 160px; }

    .pay-btn {
      width: 100%;
      height: 52px;
      border: none;
      border-radius: 14px;
      background: $primary;
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: opacity 0.15s;
      margin-top: 8px;
    }
    .pay-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .pay-btn:not(:disabled):active { opacity: 0.82; }

    .spinner {
      width: 18px; height: 18px;
      border: 2px solid rgba(255,255,255,0.35);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .secure {
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
      margin-top: 14px;
    }

    .error-msg {
      display: none;
      background: #fef2f2;
      border: 1px solid #fca5a5;
      border-radius: 10px;
      padding: 12px 14px;
      font-size: 13px;
      color: #dc2626;
      margin-top: 12px;
    }
    .error-msg.show { display: block; }
  </style>
</head>
<body>

  <div class="amount-card">
    <span class="amount-label">$totalAmountLabel</span>
    <span class="amount-value">$amount $currency</span>
  </div>

  <div class="card">
    <div class="card-title">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="$primary" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
      </svg>
      $cardDetailsLabel
    </div>
    <div id="paymob-fields"></div>
  </div>

  <button id="pay-btn" class="pay-btn" disabled>$payLabel</button>
  <div id="error-msg" class="error-msg"></div>
  <div class="secure">$securedFooter</div>

  <script src="https://cdn.jsdelivr.net/npm/paymob-pixel@latest/main.js" type="module"></script>
  <script>
    const payBtn  = document.getElementById('pay-btn');
    const errorEl = document.getElementById('error-msg');
    let   paying  = false;

    function showError(msg) {
      errorEl.textContent = msg;
      errorEl.classList.add('show');
    }

    function resetBtn() {
      paying = false;
      payBtn.disabled = true;
      payBtn.innerHTML = $payLabelJs;
    }

    window.addEventListener('load', () => {
      new Pixel({
        publicKey:      '$pubKey',
        clientSecret:   '$secret',
        paymentMethods: ['card'],
        elementId:      'paymob-fields',
        disablePay:     true,

        cardValidationChanged: (isValid) => {
          if (!paying) payBtn.disabled = !isValid;
        },

        beforePaymentComplete: async () => {
          paying = true;
          payBtn.disabled = true;
          payBtn.innerHTML = '<div class="spinner"></div> ' + $processingJs;
          errorEl.classList.remove('show');
          return true;
        },

        afterPaymentComplete: async (res) => {
          const status = res?.requirement?.status;
          if (status === 'success') {
            const txnId = res?.id || res?.transaction?.id || res?.requirement?.transaction_id || '';
            PaymobChannel.postMessage(JSON.stringify({ status: 'success', transaction_id: String(txnId) }));
          } else if (status === 'pending' && res.requirement?.redirect_url) {
            // 3DS required — navigate within WebView; Flutter intercepts the final redirect
            window.location.href = res.requirement.redirect_url;
          } else {
            const msg = res?.requirement?.message || $declinedJs;
            showError(msg);
            resetBtn();
            PaymobChannel.postMessage(JSON.stringify({ status: 'declined' }));
          }
        },
      });

      payBtn.addEventListener('click', () => {
        if (!paying) window.dispatchEvent(new Event('payFromOutside'));
      });
    });
  </script>
</body>
</html>
''';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.paymobCardPayment),
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
