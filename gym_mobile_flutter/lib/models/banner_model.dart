class BannerModel {
  final String id;
  final String imageUrl;
  final String? caption;
  final String? description;
  final String? tag;
  final String? tagColor; // hex string e.g. '#FF6B6B'
  final String actionType; // 'external_link' | 'internal' | 'sponsor' | 'none'
  final String? actionValue;
  final int sortOrder;
  final bool isActive;
  final bool isFeatured;
  final DateTime createdAt;

  // Sponsor variant: populated only when actionType == 'sponsor'.
  // promoCode is optional (perks like "show this at the club" carry no code).
  // externalUrl is optional (in-club perks may have no website to visit).
  final String? sponsorPromoCode;
  final String? sponsorExternalUrl;
  final String? sponsorTerms;

  const BannerModel({
    required this.id,
    required this.imageUrl,
    this.caption,
    this.description,
    this.tag,
    this.tagColor,
    required this.actionType,
    this.actionValue,
    required this.sortOrder,
    this.isActive = true,
    required this.isFeatured,
    required this.createdAt,
    this.sponsorPromoCode,
    this.sponsorExternalUrl,
    this.sponsorTerms,
  });

  factory BannerModel.fromJson(Map<String, dynamic> json) {
    return BannerModel(
      id: json['id'] as String,
      imageUrl: json['image_url'] as String,
      caption: json['caption'] as String?,
      description: json['description'] as String?,
      tag: json['tag'] as String?,
      tagColor: json['tag_color'] as String?,
      actionType: json['action_type'] as String? ?? 'none',
      actionValue: json['action_value'] as String?,
      sortOrder: (json['sort_order'] as num?)?.toInt() ?? 0,
      isActive: json['is_active'] as bool? ?? true,
      isFeatured: json['is_featured'] as bool? ?? false,
      createdAt: DateTime.parse(json['created_at'] as String),
      sponsorPromoCode: json['sponsor_promo_code'] as String?,
      sponsorExternalUrl: json['sponsor_external_url'] as String?,
      sponsorTerms: json['sponsor_terms'] as String?,
    );
  }

  bool get hasAction =>
      isSponsor ||
      (actionType != 'none' && actionValue != null && actionValue!.isNotEmpty);

  bool get isExternalLink => actionType == 'external_link';

  bool get isInternal => actionType == 'internal';

  bool get isSponsor => actionType == 'sponsor';
}
