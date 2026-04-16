class CheckoutItem {
  /// 'membership'      → membership plan  → creates member_memberships
  /// 'session_package' → sessions plan    → creates member_memberships
  /// 'service_package' → PT/nutrition/physiotherapy package → creates member_service_assignments
  /// 'offer'           → offer            → records payment only (unless linkedPlanId/linkedPackageId is set)
  /// 'program'         → program          → records payment only
  final String type;
  final String id;
  final String title;
  final String subtitle;
  final double price;
  final double? originalPrice; // for offers: the crossed-out price
  final List<String> badges;

  /// Whether a member-tier discount should be applied (programs + session packages).
  final bool applyMemberDiscount;

  /// For session packages: the selected specialist/trainer name.
  final String? specialistName;

  /// For offers: if set, purchasing activates the linked membership plan at offer price.
  final String? linkedPlanId;

  /// For offers: if set, purchasing activates the linked service package at offer price.
  final String? linkedPackageId;

  const CheckoutItem({
    required this.type,
    required this.id,
    required this.title,
    required this.subtitle,
    required this.price,
    this.originalPrice,
    this.badges = const [],
    this.applyMemberDiscount = false,
    this.specialistName,
    this.linkedPlanId,
    this.linkedPackageId,
  });

  String get priceLabel {
    switch (type) {
      case 'offer':            return 'Offer price';
      case 'membership':       return 'Membership price';
      case 'session_package':  return 'Package price';
      case 'service_package':  return 'Package price';
      default:                 return 'Programme price';
    }
  }
}
