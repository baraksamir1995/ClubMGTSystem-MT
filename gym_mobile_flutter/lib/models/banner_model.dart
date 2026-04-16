class BannerModel {
  final String id;
  final String imageUrl;
  final String? caption;
  final String? description;
  final String? tag;
  final String? tagColor; // hex string e.g. '#FF6B6B'
  final String actionType; // 'external_link' | 'internal' | 'none'
  final String? actionValue;
  final int sortOrder;
  final bool isFeatured;
  final DateTime createdAt;

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
    required this.isFeatured,
    required this.createdAt,
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
      isFeatured: json['is_featured'] as bool? ?? false,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }

  bool get hasAction =>
      actionType != 'none' && actionValue != null && actionValue!.isNotEmpty;

  bool get isExternalLink => actionType == 'external_link';

  bool get isInternal => actionType == 'internal';
}
