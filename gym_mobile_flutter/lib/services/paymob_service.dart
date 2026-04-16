import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import '../utils/env.dart';

const _storage = FlutterSecureStorage();
const _tokenKey = 'auth_token';

/// Result returned by [PaymobService.createIntention].
class PaymobIntention {
  final String clientSecret;
  final String publicKey;
  final String checkoutUrl;
  final String? paymentId;

  const PaymobIntention({
    required this.clientSecret,
    required this.publicKey,
    required this.checkoutUrl,
    this.paymentId,
  });
}

/// Thin wrapper around the Laravel `POST /api/paymob/intention` endpoint.
/// Keep all Paymob-specific logic here so the UI layer stays clean.
class PaymobService {
  String get _baseUrl => Env.apiUrl;

  Future<Map<String, String>> get _headers async {
    final token = await _storage.read(key: _tokenKey);
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  /// Calls the backend to create a Paymob payment intention.
  ///
  /// [amountEgp]      -- price in EGP (e.g. 500.0). Converted to cents internally.
  /// [gymId]          -- gym_id for the purchase
  /// [planId]         -- plan/package id being purchased
  /// [memberId]       -- gym_members.id for this user
  /// [itemType]       -- "membership" | "session_package" | "service_package" | "offer"
  /// [itemName]       -- human-readable name shown on checkout
  /// [paymentMethod]  -- "card" | "valu" | "apple_pay" (default: "card")
  /// [userEmail]      -- billed to (optional, falls back to auth email)
  /// [userPhone]      -- billed to (optional)
  /// [userName]       -- billed to (optional)
  Future<PaymobIntention> createIntention({
    required double amountEgp,
    required String gymId,
    required String planId,
    required String memberId,
    required String itemType,
    required String itemName,
    String paymentMethod = 'card',
    String? userEmail,
    String? userPhone,
    String? userName,
    String? specialistName,
  }) async {
    final amountCents = (amountEgp * 100).round();

    final uri = Uri.parse('$_baseUrl/api/paymob/intention');
    final response = await http.post(
      uri,
      headers: await _headers,
      body: jsonEncode({
        'amount_cents':   amountCents,
        'currency':       'EGP',
        'plan_id':        planId,
        'member_id':      memberId,
        'item_type':      itemType,
        'item_name':      itemName,
        'payment_method': paymentMethod,
        if (userEmail != null)      'user_email':      userEmail,
        if (userPhone != null)      'user_phone':      userPhone,
        if (userName  != null)      'user_name':       userName,
        if (specialistName != null) 'specialist_name': specialistName,
      }),
    ).timeout(
      const Duration(seconds: 30),
      onTimeout: () => throw Exception('Payment request timed out. Please check your connection and try again.'),
    );

    if (response.statusCode >= 400) {
      final body = jsonDecode(response.body) as Map<String, dynamic>?;
      final msg = body?['message'] ?? body?['error'] ?? 'Failed to create payment intention';
      throw Exception(msg);
    }

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return PaymobIntention(
      clientSecret: data['client_secret'] as String,
      publicKey:    data['public_key']    as String,
      checkoutUrl:  data['checkout_url']  as String,
      paymentId:   data['payment_id']    as String?,
    );
  }
}
