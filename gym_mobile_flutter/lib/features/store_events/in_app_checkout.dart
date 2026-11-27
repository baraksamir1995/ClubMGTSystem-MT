import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../providers/member_provider.dart';
import '../../screens/paymob_card_screen.dart';
import '../../screens/paymob_webview_screen.dart';
import '../../services/api_service.dart';
import '../../services/paymob_service.dart';

/// Paymob checkout for store products and paid events.
///
/// Reuses the same intention endpoint and card screen as memberships /
/// packages, but skips PaymentSummaryScreen on purpose: that screen prices
/// client-side (VAT, promo, member discount) and then calls purchase RPCs.
/// Products/events are priced by the server, and only the HMAC-verified
/// Paymob webhook settles them (stock taken, registration confirmed) — so
/// there is no post-payment client call here; callers simply re-fetch.
///
/// Throws [ApiException] (with `code`) when the intention is rejected, e.g.
/// `out_of_stock`, `event_full`. Returns null if the member record isn't
/// loaded yet.
Future<PaymobResult?> runInAppCheckout(
  BuildContext context, {
  required String itemType, // 'product' | 'event'
  required String itemId,
  required String itemName,
  required double displayAmount,
  required String currency,
  String? variantId,
  int? quantity,
  String? purchaseNote,
  String? eventConfigurationId,
}) async {
  final memberProvider = context.read<MemberProvider>();
  final profile = context.read<AuthProvider>().profile;
  var member = memberProvider.member;
  final gymId = profile?.gymId;
  if (member == null && gymId != null) {
    await memberProvider.ensureMemberLoaded(gymId);
    member = memberProvider.member;
  }
  if (member == null || gymId == null) {
    throw const ApiException(statusCode: 0, message: 'Member profile not loaded');
  }

  final intention = await PaymobService().createIntention(
    amountEgp: null, // server-priced
    gymId: gymId,
    planId: itemId,
    memberId: member.id,
    itemType: itemType,
    itemName: itemName,
    paymentMethod: 'card',
    userEmail: profile?.email,
    userPhone: profile?.phone,
    userName: profile?.fullName,
    variantId: variantId,
    quantity: quantity,
    purchaseNote: purchaseNote,
    eventConfigurationId: eventConfigurationId,
  );

  if (!context.mounted) return null;
  final primary = Theme.of(context).colorScheme.primary;
  final checkout = await Navigator.of(context).push<PaymobCheckoutResult>(
    MaterialPageRoute(
      builder: (_) => PaymobCardScreen(
        clientSecret: intention.clientSecret,
        publicKey: intention.publicKey,
        amount: displayAmount,
        currency: currency,
        primaryColor: primary,
      ),
      fullscreenDialog: true,
    ),
  );
  return checkout?.result ?? PaymobResult.cancelled;
}
