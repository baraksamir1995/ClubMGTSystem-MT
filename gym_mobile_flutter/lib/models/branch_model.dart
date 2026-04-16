class BranchModel {
  final String id;
  final String gymId;
  final String name;
  final String? address;
  final String? imageUrl;
  final String? mapsUrl;
  final bool isActive;
  final DateTime createdAt;
  final DateTime? updatedAt;

  const BranchModel({
    required this.id,
    required this.gymId,
    required this.name,
    this.address,
    this.imageUrl,
    this.mapsUrl,
    required this.isActive,
    required this.createdAt,
    this.updatedAt,
  });

  factory BranchModel.fromJson(Map<String, dynamic> json) {
    return BranchModel(
      id: json['id'] as String,
      gymId: json['gym_id'] as String,
      name: json['name'] as String,
      address: json['address'] as String?,
      imageUrl: json['image_url'] as String?,
      mapsUrl: json['maps_url'] as String?,
      isActive: json['is_active'] as bool? ?? true,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: json['updated_at'] != null ? DateTime.parse(json['updated_at'] as String) : null,
    );
  }
}
