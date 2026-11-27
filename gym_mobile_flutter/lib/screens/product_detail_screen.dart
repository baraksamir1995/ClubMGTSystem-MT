import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:clby/l10n/l10n.dart';

import '../features/store_events/in_app_checkout.dart';
import '../features/store_events/store_events_ui.dart';
import '../models/product_model.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import 'paymob_webview_screen.dart' show PaymobResult;

/// Fetches the active catalogue and finds [id]. There is no single-product
/// member endpoint; the store is small, so one 100-row page covers it.
Future<Product?> _fetchProduct(String id) async {
  final page = await ApiService().getStoreProducts(perPage: 100);
  for (final p in page.items) {
    if (p.id == id) return p;
  }
  return null;
}

/// Resolves a product by id when the route arrives without a [Product]
/// (deep link / state restore). In-app taps pass it via router `extra`.
class ProductDetailLoader extends StatefulWidget {
  final String productId;
  final Product? initial;

  const ProductDetailLoader({super.key, required this.productId, this.initial});

  @override
  State<ProductDetailLoader> createState() => _ProductDetailLoaderState();
}

class _ProductDetailLoaderState extends State<ProductDetailLoader> {
  Product? _product;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _product = widget.initial;
    if (_product == null) _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final p = await _fetchProduct(widget.productId);
      if (mounted) setState(() => _product = p);
    } catch (_) {
      // falls through to the retry state
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final product = _product;
    if (product != null) return ProductDetailScreen(product: product);
    return Scaffold(
      appBar: AppBar(),
      body: Center(
        child: _loading
            ? const CircularProgressIndicator()
            : Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(context.l10n.storeLoadProductFailed),
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: _load,
                    child: Text(context.l10n.commonRetry),
                  ),
                ],
              ),
      ),
    );
  }
}

/// Product detail: image, price, variant picker, quantity stepper, optional
/// note and a Buy bar that runs the Paymob checkout.
class ProductDetailScreen extends StatefulWidget {
  final Product product;

  const ProductDetailScreen({super.key, required this.product});

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  late Product _product;
  ProductVariant? _variant;
  int _quantity = 1;
  bool _busy = false;
  final _noteController = TextEditingController();
  static const int _noteMaxLength = 500;

  @override
  void initState() {
    super.initState();
    _product = widget.product;
    _preselectVariant();
    // The passed product may be stale (cached rail) — revalidate stock/price.
    unawaited(_refresh());
  }

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  void _preselectVariant() {
    final variants = _product.variants;
    if (variants.isEmpty) {
      _variant = null;
    } else {
      // Only ever select an in-stock variant; when all are sold out nothing
      // is selected and the product reads as out of stock.
      final inStock = variants.where((v) => !v.isOutOfStock).toList();
      final keep = inStock.where((v) => v.id == _variant?.id);
      _variant = keep.isNotEmpty
          ? keep.first
          : (inStock.isNotEmpty ? inStock.first : null);
    }
    _clampQuantity();
  }

  void _clampQuantity() {
    if (_quantity > _maxQuantity) _quantity = _maxQuantity < 1 ? 1 : _maxQuantity;
    if (_quantity < 1) _quantity = 1;
  }

  Future<void> _refresh() async {
    try {
      final fresh = await _fetchProduct(_product.id);
      if (fresh != null && mounted) {
        setState(() {
          _product = fresh;
          _preselectVariant();
        });
      }
    } catch (_) {
      // Best-effort; the server re-validates stock at checkout anyway.
    }
  }

  // ── Selection-aware getters ───────────────────────────────────────────────

  String? get _imageUrl {
    final vi = _variant?.imageUrl;
    if (vi != null && vi.isNotEmpty) return vi;
    return _product.imageUrl;
  }

  double get _unitPrice => _variant?.price ?? _product.price;

  double? get _beforePrice =>
      _variant != null ? _variant!.beforePrice : _product.beforePrice;

  bool get _hasDiscount => _beforePrice != null && _beforePrice! > _unitPrice;

  bool get _outOfStock => _product.hasVariants
      ? (_variant == null || _variant!.isOutOfStock)
      : _product.isOutOfStock;

  /// Tracked stock of the purchasable item (null = untracked).
  int? get _stock => _product.hasVariants ? _variant?.stock : _product.stock;

  int get _maxQuantity {
    final s = _stock;
    if (s == null) return kMaxPurchaseQuantity;
    return s < kMaxPurchaseQuantity ? s : kMaxPurchaseQuantity;
  }

  bool get _canBuy =>
      !_busy && !_outOfStock && (!_product.hasVariants || _variant != null);

  // ── Checkout ─────────────────────────────────────────────────────────────

  Future<void> _buy() async {
    if (!_canBuy) return;
    FocusScope.of(context).unfocus();
    final variant = _variant;
    final note = _noteController.text.trim();
    final messenger = ScaffoldMessenger.of(context);
    final l10n = context.l10n;
    setState(() => _busy = true);
    try {
      final result = await runInAppCheckout(
        context,
        itemType: 'product',
        itemId: _product.id,
        itemName: variant != null ? '${_product.name} — ${variant.name}' : _product.name,
        displayAmount: _unitPrice * _quantity,
        currency: _product.currency,
        variantId: variant?.id,
        quantity: _quantity,
        purchaseNote: note.isEmpty ? null : note,
      );
      if (!mounted) return;
      switch (result) {
        case PaymobResult.success:
          _noteController.clear();
          await _showSuccess();
        case PaymobResult.pending:
          messenger.showSnackBar(SnackBar(
            content: Text(l10n.paymentPending),
            duration: const Duration(seconds: 5),
          ));
        case PaymobResult.failed:
          messenger.showSnackBar(SnackBar(content: Text(l10n.paymentDeclined)));
        case PaymobResult.cancelled:
        case null:
          break;
      }
    } catch (e) {
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(content: Text(storeEventsErrorMessage(context, e))),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
    // Whatever happened, show the server's current stock.
    await _refresh();
  }

  Future<void> _showSuccess() {
    final primary = Theme.of(context).colorScheme.primary;
    return showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 28, 24, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: const BoxDecoration(
                  color: kSeSuccessBg,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_rounded, color: kSeSuccess, size: 36),
              ),
              const SizedBox(height: 16),
              Text(
                ctx.l10n.storeOrderPlacedTitle,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: kSeInk,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                ctx.l10n.storeOrderPlacedBody,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 14, color: kSeInk2, height: 1.45),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: FilledButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  style: FilledButton.styleFrom(
                    backgroundColor: primary,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: Text(ctx.l10n.commonDone),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── UI ───────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final primary = theme.colorScheme.primary;
    final product = _product;
    final paymentsEnabled =
        context.watch<AuthProvider>().gym?.mobilePaymentsEnabled ?? true;
    final keyboardInset = MediaQuery.of(context).viewInsets.bottom;
    final stock = _stock;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text(product.name, overflow: TextOverflow.ellipsis),
        centerTitle: true,
      ),
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => FocusScope.of(context).unfocus(),
        child: RefreshIndicator(
          color: primary,
          onRefresh: _refresh,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.only(bottom: 32 + keyboardInset),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AspectRatio(
                  aspectRatio: 4 / 3,
                  child: networkImageOrPlaceholder(context, _imageUrl),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        product.name,
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: kSeInk,
                          letterSpacing: -0.3,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        crossAxisAlignment: WrapCrossAlignment.end,
                        spacing: 8,
                        children: [
                          Text(
                            formatMoney(context, _unitPrice, product.currency),
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              color: primary,
                            ),
                          ),
                          if (_hasDiscount)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 3),
                              child: Text(
                                formatMoney(context, _beforePrice!, product.currency),
                                style: const TextStyle(
                                  fontSize: 14,
                                  color: kSeInk2,
                                  decoration: TextDecoration.lineThrough,
                                ),
                              ),
                            ),
                        ],
                      ),
                      if (_outOfStock) ...[
                        const SizedBox(height: 10),
                        SePill(
                          label: context.l10n.storeOutOfStock,
                          fg: kSeMuted,
                          bg: kSeMuted.withValues(alpha: 0.12),
                        ),
                      ] else if (stock != null && stock <= kLowStockThreshold) ...[
                        const SizedBox(height: 10),
                        SePill(
                          label: context.l10n.storeOnlyLeft(stock),
                          fg: kSeWarn,
                          bg: kSeWarnBg,
                        ),
                      ],

                      // Variants
                      if (product.hasVariants) ...[
                        const SizedBox(height: 22),
                        _Label(context.l10n.storeOptions),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            for (final v in product.variants)
                              SeChoiceChip(
                                label: v.name,
                                sublabel: v.isOutOfStock
                                    ? context.l10n.storeOutOfStock
                                    : null,
                                selected: _variant?.id == v.id,
                                onTap: v.isOutOfStock || _busy
                                    ? null
                                    : () => setState(() {
                                          _variant = v;
                                          _clampQuantity();
                                        }),
                              ),
                          ],
                        ),
                      ],

                      // Quantity
                      if (paymentsEnabled && !_outOfStock) ...[
                        const SizedBox(height: 22),
                        Row(
                          children: [
                            Expanded(child: _Label(context.l10n.storeQuantity)),
                            _Stepper(
                              value: _quantity,
                              min: 1,
                              max: _maxQuantity,
                              enabled: !_busy,
                              onChanged: (q) => setState(() => _quantity = q),
                            ),
                          ],
                        ),
                      ],

                      // Note
                      if (paymentsEnabled && !_outOfStock) ...[
                        const SizedBox(height: 22),
                        _Label(context.l10n.storeNoteTitle),
                        const SizedBox(height: 4),
                        Text(
                          context.l10n.storeNoteSubtitle,
                          style: const TextStyle(fontSize: 12, color: kSeInk2),
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: _noteController,
                          maxLength: _noteMaxLength,
                          maxLines: 3,
                          minLines: 2,
                          enabled: !_busy,
                          keyboardType: TextInputType.multiline,
                          textCapitalization: TextCapitalization.sentences,
                          onTapOutside: (_) => FocusScope.of(context).unfocus(),
                          decoration: InputDecoration(
                            hintText: context.l10n.storeNoteHint,
                            filled: true,
                            fillColor: Colors.white,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: const BorderSide(color: kSeHair),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: const BorderSide(color: kSeHair),
                            ),
                          ),
                        ),
                      ],

                      // Description
                      if ((product.description ?? '').trim().isNotEmpty) ...[
                        const SizedBox(height: 18),
                        _Label(context.l10n.storeDescription),
                        const SizedBox(height: 8),
                        Text(
                          product.description!.trim(),
                          style: const TextStyle(
                            fontSize: 14,
                            color: kSeInk2,
                            height: 1.55,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      bottomNavigationBar: _BuyBar(
        paymentsEnabled: paymentsEnabled,
        keyboardOpen: keyboardInset > 0,
        total: formatMoney(context, _unitPrice * _quantity, product.currency),
        label: _outOfStock
            ? context.l10n.storeOutOfStock
            : context.l10n.storeBuyNow,
        busy: _busy,
        onBuy: _canBuy ? _buy : null,
      ),
    );
  }
}

class _BuyBar extends StatelessWidget {
  final bool paymentsEnabled;
  final bool keyboardOpen;
  final String total;
  final String label;
  final bool busy;
  final VoidCallback? onBuy;

  const _BuyBar({
    required this.paymentsEnabled,
    required this.keyboardOpen,
    required this.total,
    required this.label,
    required this.busy,
    required this.onBuy,
  });

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final bottom = keyboardOpen ? 0.0 : MediaQuery.of(context).padding.bottom;
    return Container(
      padding: EdgeInsets.fromLTRB(16, 12, 16, 12 + bottom),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: kSeHair)),
      ),
      child: !paymentsEnabled
          ? Row(
              children: [
                const Icon(Icons.storefront_outlined, color: kSeInk2, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    context.l10n.storeBuyAtFrontDesk,
                    style: const TextStyle(fontSize: 13, color: kSeInk2),
                  ),
                ),
              ],
            )
          : Row(
              children: [
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        context.l10n.storeTotal,
                        style: const TextStyle(fontSize: 12, color: kSeInk2),
                      ),
                      Text(
                        total,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: kSeInk,
                        ),
                      ),
                    ],
                  ),
                ),
                SizedBox(
                  height: 52,
                  width: 180,
                  child: FilledButton(
                    onPressed: onBuy,
                    style: FilledButton.styleFrom(
                      backgroundColor: primary,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: busy
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text(
                            label,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                  ),
                ),
              ],
            ),
    );
  }
}

class _Label extends StatelessWidget {
  final String text;
  const _Label(this.text);

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: const TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w700,
          color: kSeInk,
        ),
      );
}

class _Stepper extends StatelessWidget {
  final int value;
  final int min;
  final int max;
  final bool enabled;
  final ValueChanged<int> onChanged;

  const _Stepper({
    required this.value,
    required this.min,
    required this.max,
    required this.enabled,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    Widget btn(IconData icon, bool active, VoidCallback cb) => InkResponse(
          onTap: active && enabled ? cb : null,
          radius: 22,
          child: Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: active && enabled ? kSePeach : kSeHair,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 18, color: active && enabled ? kSeInk : kSeInk2),
          ),
        );

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        btn(Icons.remove_rounded, value > min, () => onChanged(value - 1)),
        SizedBox(
          width: 40,
          child: Text(
            '$value',
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: kSeInk,
            ),
          ),
        ),
        btn(Icons.add_rounded, value < max, () => onChanged(value + 1)),
      ],
    );
  }
}
