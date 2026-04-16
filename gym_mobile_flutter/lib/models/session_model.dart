class Session {
  final String id;
  final String? classId;
  final String? className;
  final String? instructor;
  final String? location;
  final String? classColor;
  final DateTime scheduledAt;
  final int? durationMinutes;
  final int? capacity;
  final String? status;
  final int? bookedCount;
  final String? description;
  final String? classType;
  final String? imageUrl;
  final DateTime? endTime;
  final String? branchId;
  bool isBooked;
  bool hasRated;
  String? bookingId;
  String? bookingStatus;

  Session({
    required this.id,
    this.classId,
    this.className,
    this.instructor,
    this.location,
    this.classColor,
    required this.scheduledAt,
    this.durationMinutes,
    this.capacity,
    this.status,
    this.bookedCount,
    this.description,
    this.classType,
    this.imageUrl,
    this.endTime,
    this.branchId,
    this.isBooked = false,
    this.hasRated = false,
    this.bookingId,
    this.bookingStatus,
  });

  static DateTime _parseSessionDateTime(Map<String, dynamic> json,
      {String timeKey = 'start_time'}) {
    if (json['session_date'] != null) {
      final rawDate = json['session_date'] as String;
      // Strip ISO timestamp to just YYYY-MM-DD (Laravel returns "2026-04-14T00:00:00.000000Z")
      final date = rawDate.length > 10 ? rawDate.substring(0, 10) : rawDate;
      final time = (json[timeKey] as String?) ?? '00:00';
      final timePart = time.split(':').length >= 3 ? time : '$time:00';
      return DateTime.parse('${date}T$timePart');
    }
    return DateTime.parse(json['scheduled_at'] as String);
  }

  factory Session.fromJson(Map<String, dynamic> json) {
    final classJson = (json['classes'] ?? json['class_model']) as Map<String, dynamic>?;
    DateTime? endTime;
    if (json['end_time'] != null) {
      endTime = _parseSessionDateTime(json, timeKey: 'end_time');
    } else if (json['duration_minutes'] != null) {
      final start = _parseSessionDateTime(json);
      endTime = start.add(Duration(minutes: json['duration_minutes'] as int));
    }
    return Session(
      id: json['id'] as String,
      classId: json['class_id'] as String?,
      className: classJson?['name'] as String?,
      instructor: (json['instructor'] as String?) ?? classJson?['default_instructor'] as String?,
      location: (json['location'] as String?) ?? classJson?['location'] as String?,
      classColor: classJson?['color'] as String?,
      scheduledAt: _parseSessionDateTime(json),
      durationMinutes: json['duration_minutes'] as int?,
      capacity: json['capacity'] as int?,
      status: json['status'] as String?,
      bookedCount: json['booked_count'] as int?,
      description: classJson?['description'] as String?,
      classType: classJson?['class_type'] as String?,
      imageUrl: classJson?['image_url'] as String?,
      endTime: endTime,
      branchId: json['branch_id'] as String?,
    );
  }
}
