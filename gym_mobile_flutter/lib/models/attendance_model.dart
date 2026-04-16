class Attendance {
  final String id;
  final String? gymId;
  final String? memberId;
  final DateTime checkedInAt;
  final String? method;
  final String? accessPoint;

  const Attendance({
    required this.id,
    this.gymId,
    this.memberId,
    required this.checkedInAt,
    this.method,
    this.accessPoint,
  });

  factory Attendance.fromJson(Map<String, dynamic> json) {
    return Attendance(
      id: json['id'] as String,
      gymId: json['gym_id'] as String?,
      memberId: json['gym_member_id'] as String?,
      checkedInAt: DateTime.parse((json['check_in_at'] ?? json['checked_in_at'] ?? DateTime.now().toIso8601String()) as String).toLocal(),
      method: json['method'] as String?,
      accessPoint: json['access_point'] as String?,
    );
  }
}
