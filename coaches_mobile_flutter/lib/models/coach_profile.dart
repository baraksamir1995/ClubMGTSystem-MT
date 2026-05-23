/// Minimal authenticated-coach profile, parsed from `GET /api/me`.
/// The clby-api `User` model maps to the `profiles` table; coaches are
/// profiles with a trainer/staff role and a `gym_id`.
class CoachProfile {
  final String id;
  final String email;
  final String? fullName;
  final String? phone;
  final String? photoUrl;
  final String? role;
  final String? gymId;

  const CoachProfile({
    required this.id,
    required this.email,
    this.fullName,
    this.phone,
    this.photoUrl,
    this.role,
    this.gymId,
  });

  factory CoachProfile.fromJson(Map<String, dynamic> json) {
    // Tolerate the API returning the profile either at the top level or
    // wrapped in a `data` envelope.
    final m = (json['data'] is Map<String, dynamic>)
        ? json['data'] as Map<String, dynamic>
        : json;
    return CoachProfile(
      id: m['id']?.toString() ?? '',
      email: m['email']?.toString() ?? '',
      fullName: m['full_name']?.toString(),
      phone: m['phone']?.toString(),
      photoUrl: m['photo_url']?.toString(),
      role: m['role']?.toString(),
      gymId: m['gym_id']?.toString(),
    );
  }

  String get displayName =>
      (fullName != null && fullName!.trim().isNotEmpty) ? fullName! : email;
}
