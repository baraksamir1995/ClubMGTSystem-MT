import 'dart:io';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import 'package:clby/l10n/l10n.dart';

import '../models/checkout_item.dart';
import '../providers/auth_provider.dart';
import '../providers/member_provider.dart';
import '../services/paymob_service.dart';
import '../services/api_service.dart';
import '../utils/error_utils.dart';
import 'paymob_card_screen.dart';
import 'paymob_webview_screen.dart';

class PaymentSummaryScreen extends StatefulWidget {
  final CheckoutItem item;

  const PaymentSummaryScreen({super.key, required this.item});

  @override
  State<PaymentSummaryScreen> createState() => _PaymentSummaryScreenState();
}

class _PaymentSummaryScreenState extends State<PaymentSummaryScreen> {
  final _service       = ApiService();
  final _paymobService = PaymobService();
  final _promoController = TextEditingController();

  String _planName = '';
  double _discountPct = 0.0;
  bool _loadingPlan = true;
  bool _isProcessing = false;
  bool _success = false;
  String? _gymId;
  late String _orderNumber;

  // Payment method — only one option for now
  String _paymentMethod = 'card';

  // Promo code state
  String? _promoCodeId;
  double  _promoDiscount = 0.0;
  String? _promoDiscountType;  // 'percent' | 'fixed'
  double? _promoDiscountValue; // raw value from DB (e.g. 15 for 15%)
  bool    _promoApplied  = false;
  bool    _promoLoading  = false;
  String? _promoError;

  @override
  void initState() {
    super.initState();
    final ts = DateTime.now();
    _orderNumber = 'FC-${ts.year}-${(ts.millisecondsSinceEpoch % 100000).toString().padLeft(5, '0')}';
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadPlan());
  }

  @override
  void dispose() {
    _promoController.dispose();
    super.dispose();
  }

  Future<void> _loadPlan() async {
    final gymId = context.read<AuthProvider>().profile?.gymId;
    _gymId = gymId;

    if (!widget.item.applyMemberDiscount || gymId == null) {
      if (mounted) setState(() => _loadingPlan = false);
      return;
    }
    final result = await _service.getMemberActivePlan(gymId);
    if (mounted) {
      setState(() {
        _planName = result?.planName ?? '';
        _discountPct = result?.discountPct ?? 0.0;
        _loadingPlan = false;
      });
    }
  }

  String _buildNotes() {
    final item = widget.item;
    final typeLabel = switch (item.type) {
      'membership'      => 'Membership',
      'offer'           => 'Offer',
      'session_package' => 'Session Package',
      'service_package' => 'Service Package',
      _                 => 'Programme',
    };
    return '$typeLabel: ${item.title}';
  }

  Future<void> _processPayment() async {
    final gymId = _gymId;
    if (gymId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.paymentGymNotFound)),
      );
      return;
    }

    setState(() => _isProcessing = true);
    try {
      final item           = widget.item;
      final memberProvider = context.read<MemberProvider>();
      final profile        = context.read<AuthProvider>().profile;
      final member         = memberProvider.member;

      if (member == null) throw Exception('Member profile not loaded');

      // ── Step 1: create Paymob intention on the backend ─────────────────
      // For linked offers, use the linked plan/package ID so Paymob extras
      // reference the actual product being activated.
      final effectivePlanId = (item.type == 'offer' && item.linkedPlanId != null)
          ? item.linkedPlanId!
          : (item.type == 'offer' && item.linkedPackageId != null)
              ? item.linkedPackageId!
              : item.id;
      final effectiveItemType = (item.type == 'offer' && item.linkedPlanId != null)
          ? 'membership'
          : (item.type == 'offer' && item.linkedPackageId != null)
              ? 'service_package'
              : item.type;

      final intention = await _paymobService.createIntention(
        amountEgp:      _total,
        gymId:          gymId,
        planId:         effectivePlanId,
        memberId:       member.id,
        itemType:       effectiveItemType,
        itemName:       item.title,
        paymentMethod:  _paymentMethod,
        userEmail:      profile?.email,
        userPhone:      profile?.phone,
        userName:       profile?.fullName,
        specialistName: item.specialistName,
      );

      if (!mounted) return;

      // ── Step 2: open payment screen based on selected method ────────────
      final gymPrimary = _resolvePrimary();
      final PaymobCheckoutResult? checkout;

      if (_paymentMethod == 'card') {
        checkout = await Navigator.of(context).push<PaymobCheckoutResult>(
          MaterialPageRoute(
            builder: (_) => PaymobCardScreen(
              clientSecret: intention.clientSecret,
              publicKey:    intention.publicKey,
              amount:       _total,
              currency:     'EGP',
              primaryColor: gymPrimary,
            ),
            fullscreenDialog: true,
          ),
        );
      } else {
        // ValU and Apple Pay use Paymob's hosted unified checkout
        checkout = await Navigator.of(context).push<PaymobCheckoutResult>(
          MaterialPageRoute(
            builder: (_) => PaymobWebviewScreen(
              checkoutUrl: intention.checkoutUrl,
            ),
            fullscreenDialog: true,
          ),
        );
      }

      if (!mounted) return;

      final result        = checkout?.result;
      final transactionId = checkout?.transactionId;

      // ── Step 3: handle checkout result ─────────────────────────────────
      switch (result) {
        case PaymobResult.success:
          // Create the membership/service record immediately via RPC so it
          // appears in the app without waiting for the async Paymob webhook.
          // Then stamp the Paymob transaction ID directly on the payment record.
          String? paymentId;
          // When a promo is applied, pass the pre-promo total so the RPC can
          // correctly record the discount amount in the redemption.
          final prePromoTotal = _promoApplied
              ? _subtotalBeforePromo + (_subtotalBeforePromo * 0.14)
              : null;

          if (item.type == 'membership' || item.type == 'session_package') {
            paymentId = await _service.purchaseMembership(
              gymId: gymId,
              planId: item.id,
              amount: _total,
              currency: 'EGP',
              paymentMethod: _paymentMethod,
              originalAmount: prePromoTotal,
              promoCodeId: _promoCodeId,
            );
            if (!mounted) return;
            await Future.wait([
              memberProvider.refreshMembership(),
              if (_gymId != null) memberProvider.refreshMemberRecord(_gymId!),
              memberProvider.loadPayments(),
            ]);
          } else if (item.type == 'service_package') {
            paymentId = await _service.purchaseServicePackage(
              gymId: gymId,
              packageId: item.id,
              amount: _total,
              currency: 'EGP',
              paymentMethod: _paymentMethod,
              specialistName: item.specialistName,
              originalAmount: prePromoTotal,
              promoCodeId: _promoCodeId,
            );
            if (!mounted) return;
            await Future.wait([
              memberProvider.loadServiceAssignments(),
              memberProvider.loadPayments(),
            ]);
          } else if (item.type == 'offer' && item.linkedPlanId != null) {
            // Offer linked to a membership/session plan — activate it at offer price
            paymentId = await _service.purchaseMembership(
              gymId: gymId,
              planId: item.linkedPlanId!,
              amount: _total,
              currency: 'EGP',
              paymentMethod: _paymentMethod,
              originalAmount: item.originalPrice,
              promoCodeId: _promoCodeId,
            );
            if (!mounted) return;
            await Future.wait([
              memberProvider.refreshMembership(),
              if (_gymId != null) memberProvider.refreshMemberRecord(_gymId!),
              memberProvider.loadPayments(),
            ]);
          } else if (item.type == 'offer' && item.linkedPackageId != null) {
            // Offer linked to a service package — activate it at offer price
            paymentId = await _service.purchaseServicePackage(
              gymId: gymId,
              packageId: item.linkedPackageId!,
              amount: _total,
              currency: 'EGP',
              paymentMethod: _paymentMethod,
              specialistName: item.specialistName,
              originalAmount: item.originalPrice,
              promoCodeId: _promoCodeId,
            );
            if (!mounted) return;
            await Future.wait([
              memberProvider.loadServiceAssignments(),
              memberProvider.loadPayments(),
            ]);
          } else {
            paymentId = await _service.createMobilePayment(
              gymId: gymId,
              amount: _total,
              currency: 'EGP',
              paymentMethod: _paymentMethod,
              notes: _buildNotes(),
              serviceType: item.type,
              serviceName: item.title,
              specialistName: item.specialistName,
            );
            if (!mounted) return;
            await memberProvider.loadPayments();
          }
          // Stamp the Paymob transaction ID directly — no webhook race condition
          if (paymentId != null && transactionId != null && transactionId.isNotEmpty) {
            await _service.stampPaymobTransactionId(paymentId, transactionId);
          }
          if (!mounted) return;
          setState(() => _success = true);

        case PaymobResult.pending:
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(context.l10n.paymentPending),
              duration: const Duration(seconds: 5),
            ),
          );

        case PaymobResult.failed:
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(context.l10n.paymentDeclined)),
          );

        case PaymobResult.cancelled:
        case null:
          // User closed the checkout — go back to the previous screen
          if (mounted) context.pop();
          return;
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.paymentError(friendlyError(e)))),
      );
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  Future<void> _applyPromoCode() async {
    final code = _promoController.text.trim().toUpperCase();
    if (code.isEmpty || _gymId == null) return;
    setState(() { _promoLoading = true; _promoError = null; });
    try {
      final res = await _service.validatePromoCode(
        gymId:  _gymId!,
        code:   code,
        amount: _subtotalBeforePromo,
      );
      if (res['valid'] == true) {
        setState(() {
          _promoCodeId        = res['promo_code_id'] as String?;
          _promoDiscount      = (res['discount_amount'] as num).toDouble();
          _promoDiscountType  = res['discount_type'] as String?;
          _promoDiscountValue = (res['discount_value'] as num?)?.toDouble();
          _promoApplied       = true;
          _promoError         = null;
        });
      } else {
        setState(() {
          _promoDiscount      = 0;
          _promoDiscountType  = null;
          _promoDiscountValue = null;
          _promoApplied       = false;
          _promoCodeId        = null;
          _promoError         = res['error'] as String? ?? context.l10n.paymentInvalidPromo;
        });
      }
    } catch (e) {
      setState(() { _promoError = context.l10n.paymentPromoValidationFailed; });
    } finally {
      setState(() => _promoLoading = false);
    }
  }

  void _removePromoCode() {
    setState(() {
      _promoCodeId        = null;
      _promoDiscount      = 0;
      _promoDiscountType  = null;
      _promoDiscountValue = null;
      _promoApplied       = false;
      _promoError         = null;
      _promoController.clear();
    });
  }

  Color _resolvePrimary() => Theme.of(context).colorScheme.primary;

  // ── Price math ────────────────────────────────────────────────────────────

  double get _basePrice => widget.item.price;

  double get _discountAmount {
    if (!widget.item.applyMemberDiscount || _discountPct <= 0) return 0.0;
    return _basePrice * _discountPct / 100;
  }

  double get _subtotalBeforePromo => _basePrice - _discountAmount;

  double get _subtotal => _subtotalBeforePromo - _promoDiscount;

  double get _vat => _subtotal * 0.14;

  double get _total => _subtotal + _vat;

  // ── Formatting helpers ────────────────────────────────────────────────────

  String _fmt(double v) {
    final rounded = v.roundToDouble();
    final s = rounded.toStringAsFixed(0);
    final n = int.tryParse(s) ?? 0;
    if (n >= 1000) {
      final thousands = (n / 1000).floor();
      final remainder = (n % 1000).toString().padLeft(3, '0');
      return '$thousands,$remainder';
    }
    return s;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final primary = _resolvePrimary();
    final item = widget.item;
    final bottomPad = MediaQuery.of(context).padding.bottom;

    if (_success) {
      return _SuccessPage(
        item: widget.item,
        orderNumber: _orderNumber,
        total: _total,
        discountAmount: _discountAmount,
        planName: _planName,
        promoDiscount: _promoDiscount,
        promoCode: _promoApplied ? _promoController.text.trim().toUpperCase() : null,
        promoDiscountType: _promoDiscountType,
        promoDiscountValue: _promoDiscountValue,
        purchasedAt: DateTime.now(),
        fmt: _fmt,
      );
    }

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text(context.l10n.paymentSummaryTitle),
        centerTitle: true,
      ),
      body: _loadingPlan
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                // ── Item card ───────────────────────────────────────────────
                _ItemCard(item: item, theme: theme),
                const SizedBox(height: 16),

                // ── Member discount banner ──────────────────────────────────
                if (widget.item.applyMemberDiscount && _discountPct > 0) ...[
                  _DiscountBanner(
                    planName: _planName,
                    discountPct: _discountPct,
                  ),
                  const SizedBox(height: 16),
                ],

                // ── Promo code ──────────────────────────────────────────────
                _PromoSection(
                  controller:    _promoController,
                  theme:         theme,
                  isLoading:     _promoLoading,
                  isApplied:     _promoApplied,
                  discount:      _promoDiscount,
                  discountType:  _promoDiscountType,
                  discountValue: _promoDiscountValue,
                  errorText:     _promoError,
                  onApply:       _applyPromoCode,
                  onRemove:      _removePromoCode,
                  primary:       _resolvePrimary(),
                ),
                const SizedBox(height: 16),

                // ── Price breakdown ─────────────────────────────────────────
                _PriceBreakdown(
                  item: item,
                  planName: _planName,
                  discountPct: _discountPct,
                  discountAmount: _discountAmount,
                  promoDiscount: _promoDiscount,
                  promoApplied: _promoApplied,
                  promoCode: _promoApplied ? _promoController.text.trim().toUpperCase() : null,
                  promoDiscountType: _promoDiscountType,
                  promoDiscountValue: _promoDiscountValue,
                  subtotal: _subtotal,
                  vat: _vat,
                  total: _total,
                  fmt: _fmt,
                  theme: theme,
                ),
                const SizedBox(height: 16),

                // ── Payment method ──────────────────────────────────────────
                _PaymentMethodSection(
                  selected: _paymentMethod,
                  onChanged: (v) => setState(() => _paymentMethod = v),
                  theme: theme,
                ),
              ],
            ),
      // ── Sticky bottom bar ───────────────────────────────────────────────────
      bottomNavigationBar: Container(
        padding: EdgeInsets.fromLTRB(16, 12, 16, 12 + bottomPad),
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          border: Border(
            top: BorderSide(
              color: theme.colorScheme.outline.withValues(alpha: 0.12),
            ),
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: primary,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                  padding: const EdgeInsets.symmetric(vertical: 15),
                ),
                onPressed: (_loadingPlan || _isProcessing) ? null : _processPayment,
                child: _isProcessing
                    ? const _DollarLoader()
                    : Text(
                        context.l10n.paymentBuyNow(_fmt(_total)),
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                        ),
                      ),
              ),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.lock_rounded,
                  size: 12,
                  color: theme.colorScheme.onSurfaceVariant,
                ),
                const SizedBox(width: 4),
                Text(
                  context.l10n.paymentSecuredBySsl,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Item card
// ─────────────────────────────────────────────────────────────────────────────

class _ItemCard extends StatelessWidget {
  final CheckoutItem item;
  final ThemeData theme;

  const _ItemCard({required this.item, required this.theme});

  String _fmt(double v) {
    final s = v.toStringAsFixed(0);
    final n = int.tryParse(s) ?? 0;
    if (n >= 1000) {
      final t = (n / 1000).floor();
      final r = (n % 1000).toString().padLeft(3, '0');
      return '$t,$r';
    }
    return s;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: theme.colorScheme.outline.withValues(alpha: 0.12),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Badges
          if (item.badges.isNotEmpty) ...[
            Wrap(
              spacing: 6,
              runSpacing: 4,
              children: item.badges
                  .map((b) => _BadgeChip(label: b, theme: theme))
                  .toList(),
            ),
            const SizedBox(height: 10),
          ],
          // Title
          Text(
            item.title,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          if (item.subtitle.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              item.subtitle,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
          if (item.type == 'service_package' && item.specialistName != null &&
              item.specialistName!.isNotEmpty) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Icon(Icons.person_rounded,
                    size: 14,
                    color: theme.colorScheme.onSurfaceVariant),
                const SizedBox(width: 5),
                Text(
                  item.specialistName!,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 14),
          Divider(
            height: 1,
            thickness: 0.5,
            color: theme.colorScheme.outline.withValues(alpha: 0.15),
          ),
          const SizedBox(height: 14),
          // Price line
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                item.priceLabel,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(
                    _fmt(item.price),
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    context.l10n.paymentCurrencyEgp,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (item.originalPrice != null) ...[
                    const SizedBox(width: 8),
                    Text(
                      context.l10n.paymentAmountEgp(_fmt(item.originalPrice!)),
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                        decoration: TextDecoration.lineThrough,
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _BadgeChip extends StatelessWidget {
  final String label;
  final ThemeData theme;

  const _BadgeChip({required this.label, required this.theme});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: theme.colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: theme.colorScheme.onPrimaryContainer,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Discount banner
// ─────────────────────────────────────────────────────────────────────────────

class _DiscountBanner extends StatelessWidget {
  final String planName;
  final double discountPct;

  const _DiscountBanner({required this.planName, required this.discountPct});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF16A34A).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: const Color(0xFF16A34A).withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        children: [
          const Icon(Icons.local_offer_rounded,
              size: 18, color: Color(0xFF16A34A)),
          const SizedBox(width: 10),
          Expanded(
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: context.l10n
                        .paymentMemberDiscountPct(discountPct.toStringAsFixed(0)),
                    style: const TextStyle(
                      color: Color(0xFF16A34A),
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                  if (planName.isNotEmpty)
                    TextSpan(
                      text: ' ${context.l10n.paymentAppliedAsMember(planName)}',
                      style: TextStyle(
                        color: theme.colorScheme.onSurfaceVariant,
                        fontSize: 13,
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Price breakdown
// ─────────────────────────────────────────────────────────────────────────────

class _PriceBreakdown extends StatelessWidget {
  final CheckoutItem item;
  final String planName;
  final double discountPct;
  final double discountAmount;
  final double promoDiscount;
  final bool promoApplied;
  final String? promoCode;
  final String? promoDiscountType;
  final double? promoDiscountValue;
  final double subtotal;
  final double vat;
  final double total;
  final String Function(double) fmt;
  final ThemeData theme;

  const _PriceBreakdown({
    required this.item,
    required this.planName,
    required this.discountPct,
    required this.discountAmount,
    required this.promoDiscount,
    required this.promoApplied,
    required this.promoCode,
    this.promoDiscountType,
    this.promoDiscountValue,
    required this.subtotal,
    required this.vat,
    required this.total,
    required this.fmt,
    required this.theme,
  });

  String _promoLabel(BuildContext context) {
    final suffix = (promoDiscountType == 'percent' || promoDiscountType == 'percentage') && promoDiscountValue != null
        ? ' · ${context.l10n.paymentPctOff(promoDiscountValue!.toStringAsFixed(0))}'
        : '';
    return promoCode != null
        ? '${context.l10n.paymentPromoCode} ($promoCode$suffix)'
        : context.l10n.paymentPromoCode;
  }

  @override
  Widget build(BuildContext context) {
    final hasMemberDiscount =
        item.applyMemberDiscount && discountPct > 0 && discountAmount > 0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: theme.colorScheme.outline.withValues(alpha: 0.12),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.l10n.paymentPriceBreakdown,
            style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 12),
          _Row(label: item.priceLabel, value: context.l10n.paymentAmountEgp(fmt(item.price)), theme: theme),
          if (hasMemberDiscount) ...[
            const SizedBox(height: 8),
            _Row(
              label: planName.isNotEmpty
                  ? context.l10n.paymentMemberDiscountLabel(planName)
                  : context.l10n.paymentMemberDiscountLabel('${discountPct.toStringAsFixed(0)}%'),
              value: '− ${context.l10n.paymentAmountEgp(fmt(discountAmount))}',
              valueColor: const Color(0xFF16A34A),
              theme: theme,
            ),
          ],
          if (promoApplied && promoDiscount > 0) ...[
            const SizedBox(height: 8),
            _Row(
              label: _promoLabel(context),
              value: '− ${context.l10n.paymentAmountEgp(fmt(promoDiscount))}',
              valueColor: const Color(0xFF16A34A),
              theme: theme,
            ),
          ],
          const SizedBox(height: 8),
          _Row(label: context.l10n.paymentSubtotal, value: context.l10n.paymentAmountEgp(fmt(subtotal)), theme: theme),
          const SizedBox(height: 8),
          _Row(label: context.l10n.paymentVat, value: context.l10n.paymentAmountEgp(fmt(vat)), theme: theme),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Divider(
              height: 1, thickness: 0.5,
              color: theme.colorScheme.outline.withValues(alpha: 0.15),
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(context.l10n.paymentTotal,
                  style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
              Text(context.l10n.paymentAmountEgp(fmt(total)),
                  style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
            ],
          ),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;
  final ThemeData theme;

  const _Row({
    required this.label,
    required this.value,
    this.valueColor,
    required this.theme,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        Text(
          value,
          style: theme.textTheme.bodyMedium?.copyWith(
            fontWeight: FontWeight.w600,
            color: valueColor,
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Promo code section
// ─────────────────────────────────────────────────────────────────────────────

class _PromoSection extends StatelessWidget {
  final TextEditingController controller;
  final ThemeData theme;
  final bool isLoading;
  final bool isApplied;
  final double discount;
  final String? discountType;
  final double? discountValue;
  final String? errorText;
  final VoidCallback onApply;
  final VoidCallback onRemove;
  final Color primary;

  const _PromoSection({
    required this.controller,
    required this.theme,
    required this.isLoading,
    required this.isApplied,
    required this.discount,
    required this.onApply,
    required this.onRemove,
    required this.primary,
    this.discountType,
    this.discountValue,
    this.errorText,
  });

  @override
  Widget build(BuildContext context) {
    if (isApplied) {
      // ── Applied: compact green tag row ────────────────────────────────────
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0xFFF0FDF4),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF86EFAC), width: 1.2),
        ),
        child: Row(
          children: [
            const Icon(Icons.local_offer_rounded, color: Color(0xFF16A34A), size: 16),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                () {
                  final code = controller.text.trim().toUpperCase();
                  final isPercent = (discountType == 'percent' || discountType == 'percentage') && discountValue != null;
                  final pctPart = isPercent
                      ? '  ${context.l10n.paymentPctOff(discountValue!.toStringAsFixed(0))}'
                      : '';
                  return '$code$pctPart  ·  ${context.l10n.paymentYouSaved(discount.toStringAsFixed(0))}';
                }(),
                style: theme.textTheme.bodySmall?.copyWith(
                  color: const Color(0xFF16A34A),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            GestureDetector(
              onTap: onRemove,
              child: const Icon(Icons.close_rounded, color: Color(0xFF16A34A), size: 18),
            ),
          ],
        ),
      );
    }

    // ── Input row ──────────────────────────────────────────────────────────────
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: SizedBox(
                height: 46,
                child: TextField(
                  controller: controller,
                  textCapitalization: TextCapitalization.characters,
                  enabled: !isLoading,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.5,
                  ),
                  decoration: InputDecoration(
                    hintText: context.l10n.paymentPromoCode,
                    hintStyle: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                      fontWeight: FontWeight.w400,
                    ),
                    prefixIcon: Icon(Icons.local_offer_outlined,
                        size: 18, color: theme.colorScheme.onSurfaceVariant),
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 0),
                    filled: true,
                    fillColor: theme.colorScheme.surface,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: errorText != null
                            ? Colors.red.withValues(alpha: 0.7)
                            : theme.colorScheme.outline.withValues(alpha: 0.25),
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: errorText != null
                            ? Colors.red.withValues(alpha: 0.7)
                            : theme.colorScheme.outline.withValues(alpha: 0.25),
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: primary, width: 1.5),
                    ),
                    isDense: true,
                  ),
                  onSubmitted: (_) => onApply(),
                ),
              ),
            ),
            const SizedBox(width: 8),
            SizedBox(
              height: 46,
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: primary,
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                onPressed: isLoading ? null : onApply,
                child: isLoading
                    ? const SizedBox(
                        width: 16, height: 16,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : Text(context.l10n.paymentApply,
                        style: const TextStyle(
                            fontWeight: FontWeight.w600, fontSize: 14)),
              ),
            ),
          ],
        ),
        if (errorText != null) ...[
          const SizedBox(height: 5),
          Padding(
            padding: const EdgeInsetsDirectional.only(start: 4),
            child: Text(
              errorText!,
              style: theme.textTheme.bodySmall?.copyWith(color: Colors.red),
            ),
          ),
        ],
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment method section
// ─────────────────────────────────────────────────────────────────────────────

class _PaymentMethodSection extends StatelessWidget {
  final String selected;
  final ValueChanged<String> onChanged;
  final ThemeData theme;

  const _PaymentMethodSection({
    required this.selected,
    required this.onChanged,
    required this.theme,
  });

  @override
  Widget build(BuildContext context) {
    final primary = theme.colorScheme.primary;

    final methods = [
      _PaymentOption(id: 'card',      label: context.l10n.paymentMethodCard, icon: const _CardBadge()),
      _PaymentOption(id: 'valu',      label: 'valU',                icon: const _ValuBadge()),
      if (Platform.isIOS)
        _PaymentOption(id: 'apple_pay', label: 'Apple Pay',           icon: const _ApplePayBadge()),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          context.l10n.paymentMethodTitle,
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w700,
            color: theme.colorScheme.onSurface,
          ),
        ),
        const SizedBox(height: 10),
        ...methods.map((m) {
          final isSelected = selected == m.id;
          final isLast     = m == methods.last;
          return Padding(
            padding: EdgeInsets.only(bottom: isLast ? 0 : 8),
            child: GestureDetector(
              onTap: () => onChanged(m.id),
              behavior: HitTestBehavior.opaque,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                curve: Curves.easeInOut,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                decoration: BoxDecoration(
                  color: theme.colorScheme.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: isSelected
                        ? primary
                        : theme.colorScheme.outline.withValues(alpha: 0.18),
                    width: isSelected ? 2 : 1,
                  ),
                ),
                child: Row(
                  children: [
                    m.icon,
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        m.label,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w500,
                          color: theme.colorScheme.onSurface,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      width: 20, height: 20,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: isSelected
                              ? primary
                              : theme.colorScheme.outline.withValues(alpha: 0.4),
                          width: 2,
                        ),
                      ),
                      child: isSelected
                          ? Center(
                              child: Container(
                                width: 10, height: 10,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: primary,
                                ),
                              ),
                            )
                          : null,
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
      ],
    );
  }
}

class _PaymentOption {
  final String id;
  final String label;
  final Widget icon;
  const _PaymentOption({required this.id, required this.label, required this.icon});
}

// ── Payment method badge icons ────────────────────────────────────────────────

class _CardBadge extends StatelessWidget {
  const _CardBadge();
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44, height: 30,
      decoration: BoxDecoration(
        color: const Color(0xFFF4F4F6),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE0E0E6), width: 1),
      ),
      child: const Icon(Icons.credit_card_rounded, size: 18, color: Color(0xFF3D3D3D)),
    );
  }
}

class _ValuBadge extends StatelessWidget {
  const _ValuBadge();
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44, height: 30,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE0E0E6), width: 1),
      ),
      padding: const EdgeInsets.all(4),
      child: Image.asset(
        'assets/valu_logo.png',
        fit: BoxFit.contain,
      ),
    );
  }
}

class _ApplePayBadge extends StatelessWidget {
  const _ApplePayBadge();
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44, height: 30,
      decoration: BoxDecoration(
        color: Colors.black,
        borderRadius: BorderRadius.circular(8),
      ),
      child: const Center(
        child: Text(
          'Pay',
          style: TextStyle(
            color: Colors.white,
            fontSize: 13,
            fontWeight: FontWeight.w600,
            letterSpacing: -0.3,
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Full-screen success page
// ─────────────────────────────────────────────────────────────────────────────

class _SuccessPage extends StatelessWidget {
  final CheckoutItem item;
  final String orderNumber;
  final double total;
  final double discountAmount;
  final String planName;
  final double promoDiscount;
  final String? promoCode;
  final String? promoDiscountType;
  final double? promoDiscountValue;
  final DateTime purchasedAt;
  final String Function(double) fmt;

  const _SuccessPage({
    required this.item,
    required this.orderNumber,
    required this.total,
    required this.discountAmount,
    required this.planName,
    required this.promoDiscount,
    this.promoCode,
    this.promoDiscountType,
    this.promoDiscountValue,
    required this.purchasedAt,
    required this.fmt,
  });

  String _typeLabelPlural(BuildContext context) {
    switch (item.type) {
      case 'membership':      return context.l10n.paymentTypeMembershipsLower;
      case 'offer':           return context.l10n.paymentTypeOffersLower;
      case 'session_package': return context.l10n.paymentTypeSessionPackagesLower;
      default:                return context.l10n.paymentTypeProgrammesLower;
    }
  }

  List<_NextStep> _buildNextSteps(BuildContext context) {
    final l10n = context.l10n;
    final primary = Theme.of(context).colorScheme.primary;
    final steps = <_NextStep>[
      _NextStep(
        number: 1,
        title: l10n.paymentStepEmailTitle,
        description: l10n.paymentStepEmailDesc,
        accentColor: primary,
        bgColor: primary.withValues(alpha: 0.12),
      ),
    ];

    switch (item.type) {
      case 'membership':
        steps.add(_NextStep(
          number: 2,
          title: l10n.paymentStepMembershipActiveTitle,
          description: l10n.paymentStepMembershipActiveDesc,
          accentColor: const Color(0xFF0D9488),
          bgColor: const Color(0xFFCCFBF1),
        ));
        steps.add(_NextStep(
          number: 3,
          title: l10n.paymentStepScanQrTitle,
          description: l10n.paymentStepScanQrDesc,
          accentColor: const Color(0xFF2563EB),
          bgColor: const Color(0xFFDBEAFE),
        ));
        break;

      case 'session_package':
        steps.add(_NextStep(
          number: 2,
          title: l10n.paymentStepSessionsAvailableTitle,
          description: l10n.paymentStepSessionsAddedDesc(item.title),
          accentColor: const Color(0xFF0D9488),
          bgColor: const Color(0xFFCCFBF1),
        ));
        steps.add(_NextStep(
          number: 3,
          title: l10n.paymentStepScanQrDayOneTitle,
          description: l10n.paymentStepScanQrInstructorDesc,
          accentColor: const Color(0xFF2563EB),
          bgColor: const Color(0xFFDBEAFE),
        ));
        break;

      case 'offer' when item.linkedPlanId != null:
        steps.add(_NextStep(
          number: 2,
          title: l10n.paymentStepMembershipActiveTitle,
          description: l10n.paymentStepOfferMembershipDesc,
          accentColor: const Color(0xFF0D9488),
          bgColor: const Color(0xFFCCFBF1),
        ));
        steps.add(_NextStep(
          number: 3,
          title: l10n.paymentStepScanQrTitle,
          description: l10n.paymentStepScanQrDesc,
          accentColor: const Color(0xFF2563EB),
          bgColor: const Color(0xFFDBEAFE),
        ));
        break;

      case 'offer' when item.linkedPackageId != null:
        steps.add(_NextStep(
          number: 2,
          title: l10n.paymentStepSessionsAvailableTitle,
          description: l10n.paymentStepOfferSessionsDesc,
          accentColor: const Color(0xFF0D9488),
          bgColor: const Color(0xFFCCFBF1),
        ));
        steps.add(_NextStep(
          number: 3,
          title: l10n.paymentStepScanQrDayOneTitle,
          description: l10n.paymentStepScanQrInstructorDesc,
          accentColor: const Color(0xFF2563EB),
          bgColor: const Color(0xFFDBEAFE),
        ));
        break;

      default: // programme / plain offer
        steps.add(_NextStep(
          number: 2,
          title: l10n.paymentStepSessionsActiveTitle,
          description: l10n.paymentStepBookFirstDesc(item.title),
          accentColor: const Color(0xFF0D9488),
          bgColor: const Color(0xFFCCFBF1),
        ));
        steps.add(_NextStep(
          number: 3,
          title: l10n.paymentStepScanQrDayOneTitle,
          description: l10n.paymentStepScanQrTrainerDesc,
          accentColor: const Color(0xFF2563EB),
          bgColor: const Color(0xFFDBEAFE),
        ));
    }

    return steps;
  }

  @override
  Widget build(BuildContext context) {
    final bottomPad = MediaQuery.of(context).padding.bottom;
    final totalSavings = discountAmount + promoDiscount;
    final hasSavings = totalSavings > 0;
    final l10n = context.l10n;
    final hasOfferDiscount = item.originalPrice != null && item.originalPrice! > item.price;
    final offerDiscount = hasOfferDiscount ? item.originalPrice! - item.price : 0.0;
    final isProgramme = item.type != 'membership' &&
        item.type != 'offer' &&
        item.type != 'session_package';
    final nextSteps = _buildNextSteps(context);

    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F0),
      body: Column(
        children: [
          // ── Header ─────────────────────────────────────────────────────────
          Container(
            width: double.infinity,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: AlignmentDirectional.topStart,
                end: AlignmentDirectional.bottomEnd,
                colors: [Color(0xFF1E1B4B), Color(0xFF3730A3)],
              ),
            ),
            padding: EdgeInsets.only(
              top: MediaQuery.of(context).padding.top + 40,
              bottom: 40,
              left: 24,
              right: 24,
            ),
            child: Column(
              children: [
                // Check circle
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: const Color(0xFF0D9488).withValues(alpha: 0.25),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: const Color(0xFF0D9488).withValues(alpha: 0.5),
                      width: 1.5,
                    ),
                  ),
                  child: const Icon(
                    Icons.check_rounded,
                    color: Color(0xFF2DD4BF),
                    size: 36,
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  l10n.paymentSuccessTitle,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  l10n.paymentOrderNumber(orderNumber),
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.6),
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),

          // ── Scrollable body ────────────────────────────────────────────────
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Section label
                  Padding(
                    padding: const EdgeInsetsDirectional.only(start: 4, bottom: 10),
                    child: Text(
                      l10n.paymentYourOrder,
                      style: const TextStyle(
                        color: Color(0xFF6B7280),
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.8,
                      ),
                    ),
                  ),

                  // Order details card
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFE8E6E0)),
                    ),
                    child: Column(
                      children: [
                        _OrderRow(label: l10n.paymentItem, value: item.title),
                        if (item.subtitle.isNotEmpty)
                          _OrderRow(
                              label: isProgramme ? l10n.paymentDuration : l10n.paymentDetails,
                              value: item.subtitle),
                        _OrderRow(
                          label: l10n.paymentStarts,
                          value: DateFormat('EEE, MMM d, yyyy').format(purchasedAt),
                        ),
                        if (hasOfferDiscount) ...[
                          _OrderRow(
                            label: l10n.paymentOriginalPrice,
                            value: l10n.paymentAmountEgp(fmt(item.originalPrice!)),
                            strikethrough: true,
                          ),
                          _OrderRow(
                            label: l10n.paymentOfferDiscount,
                            value: '− ${l10n.paymentAmountEgp(fmt(offerDiscount))}',
                            valueColor: const Color(0xFF16A34A),
                          ),
                        ],
                        if (promoDiscount > 0 && promoCode != null)
                          _OrderRow(
                            label: l10n.paymentPromoWithCode(promoCode!),
                            value: '− ${l10n.paymentAmountEgp(fmt(promoDiscount))}',
                            valueColor: const Color(0xFF16A34A),
                          ),
                        _OrderRow(
                          label: l10n.paymentTotalPaid,
                          value: l10n.paymentAmountEgp(fmt(total)),
                          bold: true,
                          last: true,
                        ),
                      ],
                    ),
                  ),

                  // Savings banner
                  if (hasSavings) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF16A34A).withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: const Color(0xFF16A34A).withValues(alpha: 0.25),
                        ),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.star_rounded,
                              size: 18, color: Color(0xFF16A34A)),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  l10n.paymentSavedOnOrder(fmt(totalSavings)),
                                  style: const TextStyle(
                                    color: Color(0xFF15803D),
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                if (hasOfferDiscount && promoDiscount > 0)
                                  Text(
                                    l10n.paymentSavingsBreakdown(fmt(offerDiscount), fmt(promoDiscount)),
                                    style: const TextStyle(
                                      color: Color(0xFF16A34A),
                                      fontSize: 12,
                                    ),
                                  )
                                else if (planName.isNotEmpty)
                                  Text(
                                    planName,
                                    style: const TextStyle(
                                      color: Color(0xFF16A34A),
                                      fontSize: 12,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 20),

                  // What happens next
                  Padding(
                    padding: const EdgeInsetsDirectional.only(start: 4, bottom: 10),
                    child: Text(
                      l10n.paymentWhatHappensNext,
                      style: const TextStyle(
                        color: Color(0xFF6B7280),
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.8,
                      ),
                    ),
                  ),
                  Column(
                    children: [
                      for (int i = 0; i < nextSteps.length; i++) ...[
                        _NextStepCard(step: nextSteps[i]),
                        if (i < nextSteps.length - 1)
                          const SizedBox(height: 8),
                      ],
                    ],
                  ),

                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),

          // ── Bottom actions ─────────────────────────────────────────────────
          Container(
            color: const Color(0xFFF5F5F0),
            padding: EdgeInsets.fromLTRB(16, 8, 16, 12 + bottomPad),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF4F46E5),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 15),
                    ),
                    onPressed: () => context.go('/home'),
                    child: Text(
                      l10n.paymentBackToHome,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF1C1C1E),
                      side: const BorderSide(color: Color(0xFFD1D5DB)),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 15),
                    ),
                    onPressed: () {
                      // Pop back to the explore/browse screen
                      while (context.canPop()) {
                        context.pop();
                      }
                    },
                    child: Text(
                      l10n.paymentBrowseMore(_typeLabelPlural(context)),
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _NextStep {
  final int number;
  final String title;
  final String description;
  final Color accentColor;
  final Color bgColor;

  const _NextStep({
    required this.number,
    required this.title,
    required this.description,
    required this.accentColor,
    required this.bgColor,
  });
}

class _NextStepCard extends StatelessWidget {
  final _NextStep step;
  const _NextStepCard({required this.step});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE8E6E0)),
      ),
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: step.bgColor,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Center(
              child: Text(
                '${step.number}',
                style: TextStyle(
                  color: step.accentColor,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  step.title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1C1C1E),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  step.description,
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF6B7280),
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _OrderRow extends StatelessWidget {
  final String label;
  final String value;
  final bool bold;
  final bool last;
  final bool strikethrough;
  final Color? valueColor;

  const _OrderRow({
    required this.label,
    required this.value,
    this.bold = false,
    this.last = false,
    this.strikethrough = false,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
          child: Row(
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  color: bold ? const Color(0xFF1C1C1E) : const Color(0xFF6B7280),
                  fontWeight: bold ? FontWeight.w700 : FontWeight.w400,
                ),
              ),
              const Spacer(),
              Text(
                value,
                style: TextStyle(
                  fontSize: bold ? 16 : 13,
                  fontWeight: bold ? FontWeight.w800 : FontWeight.w500,
                  color: valueColor ?? const Color(0xFF1C1C1E),
                  decoration: strikethrough ? TextDecoration.lineThrough : null,
                  decorationColor: const Color(0xFF9CA3AF),
                ),
              ),
            ],
          ),
        ),
        if (!last)
          const Divider(height: 1, thickness: 0.5, color: Color(0xFFE8E6E0),
              indent: 16, endIndent: 16),
      ],
    );
  }
}

// ─── Dollar sign payment loader ──────────────────────────────────────────────

class _DollarLoader extends StatefulWidget {
  const _DollarLoader();
  @override
  State<_DollarLoader> createState() => _DollarLoaderState();
}

class _DollarLoaderState extends State<_DollarLoader>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _scale;
  late final Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      duration: const Duration(milliseconds: 650),
      vsync: this,
    )..repeat(reverse: true);
    _scale = Tween<double>(begin: 0.65, end: 1.15).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut),
    );
    _opacity = Tween<double>(begin: 0.45, end: 1.0).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) => Opacity(
        opacity: _opacity.value,
        child: Transform.scale(
          scale: _scale.value,
          child: Text(
            '\$',
            style: TextStyle(
              color: Theme.of(context).colorScheme.primary,
              fontSize: 24,
              fontWeight: FontWeight.w900,
              height: 1,
            ),
          ),
        ),
      ),
    );
  }
}
