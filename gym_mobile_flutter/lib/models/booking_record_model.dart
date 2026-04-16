class BookingRecord {
  final String id;
  final String? sessionId; // class_sessions.id — needed for rating submission
  final String status; // booked | attended | cancelled
  final DateTime bookedAt;
  final DateTime sessionDate;
  final DateTime? sessionEndTime;
  final String? className;
  final String? classType;
  final String? instructor;
  final String? classColor;

  BookingRecord({
    required this.id,
    this.sessionId,
    required this.status,
    required this.bookedAt,
    required this.sessionDate,
    this.sessionEndTime,
    this.className,
    this.classType,
    this.instructor,
    this.classColor,
  });

  bool get isUpcoming =>
      status == 'confirmed' && sessionDate.isAfter(DateTime.now());

  /// Parses the flat row returned by the get_last_unrated_attended_session RPC.
  factory BookingRecord.fromRpc(Map<String, dynamic> json) {
    DateTime sessionDate = DateTime.now();
    DateTime? sessionEndTime;

    if (json['session_date'] != null) {
      final date = (json['session_date'] as String).substring(0, 10);
      final startTime = (json['start_time'] as String?) ?? '00:00';
      final startPart = startTime.split(':').length >= 3 ? startTime : '$startTime:00';
      sessionDate = DateTime.parse('${date}T$startPart');

      if (json['end_time'] != null) {
        final endTime = json['end_time'] as String;
        final endPart = endTime.split(':').length >= 3 ? endTime : '$endTime:00';
        sessionEndTime = DateTime.parse('${date}T$endPart');
      }
    }

    return BookingRecord(
      id: json['id'] as String,
      sessionId: json['session_id'] as String?,
      status: json['status'] as String,
      bookedAt: DateTime.parse(json['created_at'] as String).toLocal(),
      sessionDate: sessionDate,
      sessionEndTime: sessionEndTime,
      className: json['class_name'] as String?,
      classType: json['class_type'] as String?,
      instructor: json['instructor'] as String?,
      classColor: json['color'] as String?,
    );
  }

  factory BookingRecord.fromJson(Map<String, dynamic> json) {
    final sessionJson = json['class_sessions'] as Map<String, dynamic>?;
    final classJson = sessionJson?['classes'] as Map<String, dynamic>?;

    DateTime sessionDate = DateTime.now();
    DateTime? sessionEndTime;

    if (sessionJson != null && sessionJson['session_date'] != null) {
      final date = (sessionJson['session_date'] as String).substring(0, 10);
      final startTime = (sessionJson['start_time'] as String?) ?? '00:00';
      final startPart =
          startTime.split(':').length >= 3 ? startTime : '$startTime:00';
      sessionDate = DateTime.parse('${date}T$startPart');

      if (sessionJson['end_time'] != null) {
        final endTime = sessionJson['end_time'] as String;
        final endPart =
            endTime.split(':').length >= 3 ? endTime : '$endTime:00';
        sessionEndTime = DateTime.parse('${date}T$endPart');
      }
    }

    return BookingRecord(
      id: json['id'] as String,
      sessionId: sessionJson?['id'] as String? ?? json['session_id'] as String?,
      status: json['status'] as String,
      bookedAt: DateTime.parse(json['created_at'] as String).toLocal(),
      sessionDate: sessionDate,
      sessionEndTime: sessionEndTime,
      className: classJson?['name'] as String?,
      classType: classJson?['class_type'] as String?,
      instructor: classJson?['instructor'] as String?,
      classColor: classJson?['color'] as String?,
    );
  }
}
