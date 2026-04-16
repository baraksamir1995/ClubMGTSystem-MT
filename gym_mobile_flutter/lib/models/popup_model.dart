class PopupModel {
  final String id;
  final String gymId;
  final String title;
  final String? subtitle;
  final String? imageUrl;
  final String? ctaLabel;
  final String ctaActionType; // 'none' | 'internal' | 'external_link'
  final String? ctaActionValue;
  final bool isActive;
  final int priority;
  final DateTime createdAt;

  const PopupModel({
    required this.id,
    required this.gymId,
    required this.title,
    this.subtitle,
    this.imageUrl,
    this.ctaLabel,
    required this.ctaActionType,
    this.ctaActionValue,
    required this.isActive,
    required this.priority,
    required this.createdAt,
  });

  factory PopupModel.fromJson(Map<String, dynamic> json) {
    return PopupModel(
      id: json['id'] as String,
      gymId: json['gym_id'] as String,
      title: json['title'] as String,
      subtitle: json['subtitle'] as String?,
      imageUrl: json['image_url'] as String?,
      ctaLabel: json['cta_label'] as String?,
      ctaActionType: json['cta_action_type'] as String? ?? 'none',
      ctaActionValue: json['cta_action_value'] as String?,
      isActive: json['is_active'] as bool? ?? false,
      priority: (json['priority'] as num?)?.toInt() ?? 0,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }

  bool get hasCta =>
      ctaLabel != null &&
      ctaLabel!.isNotEmpty &&
      ctaActionType != 'none' &&
      ctaActionValue != null &&
      ctaActionValue!.isNotEmpty;

  bool get hasImage => imageUrl != null && imageUrl!.isNotEmpty;
}
