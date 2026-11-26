import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:clby/l10n/l10n.dart';

import '../features/store_events/store_events_ui.dart';
import '../models/product_model.dart';

/// Compact product card — image, name, price ("From …" when variants differ),
/// discount tag and an out-of-stock chip. Used in the Explore store rail
/// (fixed [width]) and the products grid ([width] null → fills the tile).
class ProductCard extends StatelessWidget {
  final Product product;
  final double? width;

  const ProductCard({super.key, required this.product, this.width});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final primary = theme.colorScheme.primary;
    final outOfStock = product.isOutOfStock;
    final price = formatMoney(context, product.displayPrice, product.currency);

    return GestureDetector(
      onTap: () => context.push('/products/${product.id}', extra: product),
      child: Container(
        width: width,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: kSeHair),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  networkImageOrPlaceholder(context, product.imageUrl),
                  if (product.hasDiscount && !product.hasVariants)
                    PositionedDirectional(
                      top: 8,
                      end: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                        decoration: BoxDecoration(
                          color: primary,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          '-${(((product.beforePrice! - product.price) / product.beforePrice!) * 100).round()}%',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ),
                  if (outOfStock)
                    PositionedDirectional(
                      bottom: 8,
                      start: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: kSeMuted,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          context.l10n.storeOutOfStock,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: kSeInk,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    product.hasPriceRange
                        ? context.l10n.storePriceFrom(price)
                        : price,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: primary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
