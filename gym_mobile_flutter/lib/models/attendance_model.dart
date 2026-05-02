class Attendance {
  final String id;
  final String? gymId;
  final String? memberId;
  final DateTime checkedInAt;
  final String? method;
  final String? accessPoint;
  // Source identifiers via joins on the Laravel attendance index endpoint.
  // Exactly one of branch / studio / class is populated per row, so they
  // double as the structural distinction the UI uses to split "Entrance"
  // (branch) from "Classes" (studio + class) in the filter chips.
  final String? branchName;
  final String? studioName;
  final String? className;

  const Attendance({
    required this.id,
    this.gymId,
    this.memberId,
    required this.checkedInAt,
    this.method,
    this.accessPoint,
    this.branchName,
    this.studioName,
    this.className,
  });

  factory Attendance.fromJson(Map<String, dynamic> json) {
    return Attendance(
      id: json['id'] as String,
      gymId: json['gym_id'] as String?,
      memberId: json['gym_member_id'] as String?,
      checkedInAt: DateTime.parse((json['check_in_at'] ?? json['checked_in_at'] ?? DateTime.now().toIso8601String()) as String).toLocal(),
      method: json['method'] as String?,
      accessPoint: json['access_point'] as String?,
      branchName: json['branch_name'] as String?,
      studioName: json['studio_name'] as String?,
      className: json['class_name'] as String?,
    );
  }

  /// Branch (gym) entrance scan. Used for the Entrance filter chip.
  bool get isEntrance => branchName != null && studioName == null && className == null;

  /// Studio or class scan. Used for the Classes filter chip.
  bool get isClassOrStudio => studioName != null || className != null;
}
