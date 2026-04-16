class TrainerProfile {
  final String id;
  final String name;
  final String? photoUrl;
  final String? bio;
  final List<String> specialisations;
  final String trainerType; // 'personal_trainer' | 'nutritionist' | 'physiotherapist'
  final double? avgRating;
  final bool isActive;
  final List<String> branchIds;

  TrainerProfile({
    required this.id,
    required this.name,
    this.photoUrl,
    this.bio,
    required this.specialisations,
    required this.trainerType,
    this.avgRating,
    required this.isActive,
    this.branchIds = const [],
  });

  factory TrainerProfile.fromJson(Map<String, dynamic> json,
      {double? avgRating}) {
    final sps = json['specialisations'] ?? json['specialties'] ?? [];
    // trainer_branches is a list of join rows when fetched with select
    final tb = json['trainer_branches'] as List?;
    final branchIds = tb != null
        ? tb.map((r) => (r as Map<String, dynamic>)['branch_id'] as String).toList()
        : <String>[];
    return TrainerProfile(
      id: (json['id'] as String?) ?? '',
      name: (json['name'] as String?) ?? '',
      photoUrl: json['photo_url'] as String?,
      bio: json['bio'] as String?,
      specialisations:
          (sps as List).map((s) => s.toString()).toList(),
      trainerType:
          (json['trainer_type'] as String?) ?? 'personal_trainer',
      avgRating: avgRating ?? (json['avg_rating'] as num?)?.toDouble(),
      isActive: (json['is_active'] as bool?) ?? true,
      branchIds: branchIds,
    );
  }

  String get displayType {
    switch (trainerType) {
      case 'nutritionist':
        return 'Nutritionist';
      case 'physiotherapist':
        return 'Physiotherapist';
      default:
        return 'Personal trainer';
    }
  }

  String get ctaLabel {
    switch (trainerType) {
      case 'nutritionist':
        return 'Book a consultation';
      default:
        return 'Book a session';
    }
  }
}
