class Profile {
  final String id;
  final String? fullName;
  final String? email;
  final String? phone;
  final DateTime? dateOfBirth;
  final String? gymId;
  final String? role;
  final String? avatarUrl;

  const Profile({
    required this.id,
    this.fullName,
    this.email,
    this.phone,
    this.dateOfBirth,
    this.gymId,
    this.role,
    this.avatarUrl,
  });

  factory Profile.fromJson(Map<String, dynamic> json) {
    return Profile(
      id: json['id'] as String,
      fullName: json['full_name'] as String?,
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      dateOfBirth: json['date_of_birth'] != null
          ? DateTime.tryParse(json['date_of_birth'] as String)
          : null,
      gymId: json['gym_id'] as String?,
      role: json['role'] as String?,
      avatarUrl: json['photo_url'] as String?,
    );
  }

  Profile copyWith({
    String? fullName,
    String? phone,
    DateTime? dateOfBirth,
    String? avatarUrl,
  }) {
    return Profile(
      id: id,
      fullName: fullName ?? this.fullName,
      email: email,
      phone: phone ?? this.phone,
      dateOfBirth: dateOfBirth ?? this.dateOfBirth,
      gymId: gymId,
      role: role,
      avatarUrl: avatarUrl ?? this.avatarUrl,
    );
  }
}

class GymMember {
  final String id;
  final String gymId;
  final String userId;
  final String? memberNumber;
  final String? status;
  final DateTime? joinedAt;

  const GymMember({
    required this.id,
    required this.gymId,
    required this.userId,
    this.memberNumber,
    this.status,
    this.joinedAt,
  });

  factory GymMember.fromJson(Map<String, dynamic> json) {
    return GymMember(
      id: json['id'] as String,
      gymId: json['gym_id'] as String,
      userId: json['user_id'] as String,
      memberNumber: json['member_number']?.toString(),
      status: json['status'] as String?,
      joinedAt: json['joined_at'] != null
          ? DateTime.parse(json['joined_at'] as String)
          : null,
    );
  }
}
