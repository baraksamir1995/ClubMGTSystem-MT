import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:clby/l10n/l10n.dart';

import '../../models/event_model.dart';
import '../../services/api_service.dart';
import '../../utils/error_utils.dart';

// Shared bits for the Store + Events UI (formatting, images, error copy,
// status badges). CLBY design tokens: cream / ink / peach + gym primary.

const kSeInk = Color(0xFF1F1A14);
const kSeInk2 = Color(0x9E1F1A14);
const kSeHair = Color(0x141F1A14);
const kSePeach = Color(0xFFF4DCC1);
const kSeSuccess = Color(0xFF3F8B5C);
const kSeSuccessBg = Color(0xFFE4F0E6);
const kSeWarn = Color(0xFFB6531B);
const kSeWarnBg = Color(0xFFFBEAD6);
const kSeMuted = Color(0xFF6B7280);

/// "300 EGP" / "300 جنيه" — whole numbers without decimals.
String formatMoney(BuildContext context, double amount, String currency) {
  final isWhole = amount == amount.floorToDouble();
  final n = isWhole
      ? NumberFormat('#,###', 'en_US').format(amount.toInt())
      : NumberFormat('#,##0.##', 'en_US').format(amount);
  final cur = currency.toUpperCase() == 'EGP'
      ? context.l10n.packageCurrencyEgp
      : currency;
  return '$n $cur';
}

/// "Sat, Dec 6 · 6:00 PM" in the active locale.
String formatEventDate(BuildContext context, DateTime? dt) {
  if (dt == null) return '';
  final locale = Localizations.localeOf(context).toLanguageTag();
  try {
    return '${DateFormat('EEE, MMM d', locale).format(dt)} · '
        '${DateFormat('h:mm a', locale).format(dt)}';
  } catch (_) {
    // Locale date symbols not initialised — fall back to English.
    return '${DateFormat('EEE, MMM d').format(dt)} · '
        '${DateFormat('h:mm a').format(dt)}';
  }
}

/// Image with the product/event fallback chain → tinted placeholder icon.
Widget networkImageOrPlaceholder(
  BuildContext context,
  String? url, {
  IconData icon = Icons.shopping_bag_outlined,
  BoxFit fit = BoxFit.cover,
}) {
  final primary = Theme.of(context).colorScheme.primary;
  final placeholder = Container(
    color: primary.withValues(alpha: 0.08),
    child: Center(
      child: Icon(icon, size: 32, color: primary.withValues(alpha: 0.45)),
    ),
  );
  if (url == null || url.isEmpty) return placeholder;
  return CachedNetworkImage(
    imageUrl: url,
    fit: fit,
    placeholder: (_, _) => Container(color: primary.withValues(alpha: 0.06)),
    errorWidget: (_, _, _) => placeholder,
  );
}

/// Maps the contract's `{ error, code }` codes to localized copy. Falls back
/// to [friendlyError] (server message / network wording).
String storeEventsErrorMessage(BuildContext context, Object e) {
  final l = context.l10n;
  if (e is ApiException) {
    switch (e.code) {
      case 'out_of_stock':
        return l.storeErrOutOfStock;
      case 'variant_required':
        return l.storeErrVariantRequired;
      case 'product_unavailable':
        return l.storeErrProductUnavailable;
      case 'event_full':
        return l.eventsErrFull;
      case 'registration_closed':
        return l.eventsErrRegistrationClosed;
      case 'event_past':
        return l.eventsErrPast;
      case 'already_registered':
        return l.eventsErrAlreadyRegistered;
      case 'configuration_required':
        return l.eventsErrConfigurationRequired;
      case 'configuration_invalid':
        return l.eventsErrConfigurationInvalid;
      case 'plan_required':
        return l.eventsErrPlanRequired;
      case 'payment_required':
        return l.eventsErrPaymentRequired;
      case 'paid_registration':
        return l.eventsErrPaidRegistration;
      case 'price_mismatch':
        return l.storeErrPriceChanged;
    }
  }
  return friendlyError(e);
}

/// Small pill used for event price + registration status.
class SePill extends StatelessWidget {
  final String label;
  final Color fg;
  final Color bg;
  final IconData? icon;

  const SePill({
    super.key,
    required this.label,
    required this.fg,
    required this.bg,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 13, color: fg),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: fg),
          ),
        ],
      ),
    );
  }
}

/// Price pill: "Free" (green) or the formatted price (primary tint).
class EventPricePill extends StatelessWidget {
  final GymEvent event;
  const EventPricePill({super.key, required this.event});

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    if (!event.isPaid) {
      return SePill(
        label: context.l10n.eventsFree,
        fg: kSeSuccess,
        bg: kSeSuccessBg,
      );
    }
    return SePill(
      label: formatMoney(context, event.price, event.currency),
      fg: primary,
      bg: primary.withValues(alpha: 0.12),
    );
  }
}

/// Registration status badge: Registered / Payment processing.
class EventStatusPill extends StatelessWidget {
  final String status;
  const EventStatusPill({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    if (status == EventRegistrationStatus.pendingPayment) {
      return SePill(
        label: context.l10n.eventsStatusPaymentProcessing,
        fg: kSeWarn,
        bg: kSeWarnBg,
        icon: Icons.hourglass_top_rounded,
      );
    }
    return SePill(
      label: context.l10n.eventsStatusRegistered,
      fg: kSeSuccess,
      bg: kSeSuccessBg,
      icon: Icons.check_circle_rounded,
    );
  }
}

/// Selectable pill (variant / event option). Null [onTap] = disabled.
class SeChoiceChip extends StatelessWidget {
  final String label;
  final String? sublabel;
  final bool selected;
  final VoidCallback? onTap;

  const SeChoiceChip({
    super.key,
    required this.label,
    this.sublabel,
    required this.selected,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final disabled = onTap == null && !selected;
    return Semantics(
      button: true,
      selected: selected,
      enabled: !disabled,
      child: GestureDetector(
        onTap: onTap,
        child: Opacity(
          opacity: disabled ? 0.45 : 1,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
            decoration: BoxDecoration(
              color: selected ? primary : Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: selected ? primary : kSeHair),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: selected ? Colors.white : kSeInk,
                  ),
                ),
                if (sublabel != null) ...[
                  const SizedBox(width: 6),
                  Text(
                    sublabel!,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: selected ? Colors.white70 : kSeInk2,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
