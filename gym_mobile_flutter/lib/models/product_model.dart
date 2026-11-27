/// Store products — shown in the Explore `store` section, the products list
/// and the product detail screen; bought in-app via Paymob
/// (`/api/paymob/intention`, `item_type: product`).
///
/// Availability rules (mirror the API contract, docs/store-and-events.md):
///   - `stock == null` means untracked / unlimited — never show stock UI.
///   - A variant is out of stock when `stock != null && stock <= 0`.
///   - A product with variants is available iff ANY variant is in stock;
///     price + stock then come from the chosen variant.
///   - A product without variants is out of stock when its own tracked
///     stock is depleted.
library;

double? _parseDouble(dynamic value) {
  if (value == null) return null;
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value);
  return null;
}

int? _parseInt(dynamic value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value);
  return null;
}

/// Stock at or below this is surfaced as "Only N left".
const int kLowStockThreshold = 5;

/// Max units per in-app purchase (server validates `quantity` 1–10).
const int kMaxPurchaseQuantity = 10;

class ProductVariant {
  final String id;
  final String name;
  final String? imageUrl;
  final double? beforePrice;
  final double price;
  final int? stock;
  final bool isActive;
  final int displayOrder;

  const ProductVariant({
    required this.id,
    required this.name,
    this.imageUrl,
    this.beforePrice,
    required this.price,
    this.stock,
    this.isActive = true,
    this.displayOrder = 0,
  });

  factory ProductVariant.fromJson(Map<String, dynamic> json) {
    return ProductVariant(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      imageUrl: json['image_url'] as String?,
      beforePrice: _parseDouble(json['before_price']),
      price: _parseDouble(json['price']) ?? 0,
      stock: _parseInt(json['stock']),
      isActive: json['is_active'] != false,
      displayOrder: _parseInt(json['display_order']) ?? 0,
    );
  }

  bool get isOutOfStock => stock != null && stock! <= 0;
  bool get hasDiscount => beforePrice != null && beforePrice! > price;
}

class Product {
  final String id;
  final String name;
  final String? description;
  final String? imageUrl;
  final double? beforePrice;
  final double price;
  final String currency;
  final int? stock;
  final bool isActive;
  final int displayOrder;
  final List<ProductVariant> variants;

  const Product({
    required this.id,
    required this.name,
    this.description,
    this.imageUrl,
    this.beforePrice,
    required this.price,
    this.currency = 'EGP',
    this.stock,
    this.isActive = true,
    this.displayOrder = 0,
    this.variants = const [],
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    final raw = json['variants'];
    final variants = <ProductVariant>[];
    if (raw is List) {
      for (final v in raw) {
        if (v is Map) {
          final variant = ProductVariant.fromJson(Map<String, dynamic>.from(v));
          // The member endpoint only returns active variants; be defensive.
          if (variant.isActive) variants.add(variant);
        }
      }
      variants.sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
    }
    return Product(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      description: json['description'] as String?,
      imageUrl: json['image_url'] as String?,
      beforePrice: _parseDouble(json['before_price']),
      price: _parseDouble(json['price']) ?? 0,
      currency: (json['currency'] as String?)?.trim().isNotEmpty == true
          ? json['currency'] as String
          : 'EGP',
      stock: _parseInt(json['stock']),
      isActive: json['is_active'] != false,
      displayOrder: _parseInt(json['display_order']) ?? 0,
      variants: variants,
    );
  }

  bool get hasVariants => variants.isNotEmpty;

  bool get isOutOfStock {
    if (hasVariants) {
      return !variants.any((v) => !v.isOutOfStock);
    }
    return stock != null && stock! <= 0;
  }

  bool get hasDiscount => beforePrice != null && beforePrice! > price;

  /// Lowest variant price ("from" price on cards); the product price when
  /// there are no variants.
  double get displayPrice {
    if (!hasVariants) return price;
    return variants.map((v) => v.price).reduce((a, b) => a < b ? a : b);
  }

  /// True when variants carry different prices (card shows "From …").
  bool get hasPriceRange =>
      hasVariants && variants.map((v) => v.price).toSet().length > 1;
}

/// One page of `/api/store/products` (Laravel paginator).
class ProductPage {
  final List<Product> items;
  final int currentPage;
  final int lastPage;
  final int total;

  const ProductPage({
    required this.items,
    this.currentPage = 1,
    this.lastPage = 1,
    this.total = 0,
  });

  bool get hasMore => currentPage < lastPage;

  factory ProductPage.fromJson(dynamic json) {
    if (json is List) {
      final items = json
          .whereType<Map>()
          .map((m) => Product.fromJson(Map<String, dynamic>.from(m)))
          .toList();
      return ProductPage(items: items, total: items.length);
    }
    if (json is! Map) return const ProductPage(items: []);
    final data = json['data'];
    final items = data is List
        ? data
            .whereType<Map>()
            .map((m) => Product.fromJson(Map<String, dynamic>.from(m)))
            .toList()
        : <Product>[];
    return ProductPage(
      items: items,
      currentPage: _parseInt(json['current_page']) ?? 1,
      lastPage: _parseInt(json['last_page']) ?? 1,
      total: _parseInt(json['total']) ?? items.length,
    );
  }
}
