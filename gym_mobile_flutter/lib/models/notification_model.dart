class GymNotification {
  final String id;
  final String gymId;
  final String title;
  final String message;
  final DateTime? sentAt;
  final String? recipientType;

  const GymNotification({
    required this.id,
    required this.gymId,
    required this.title,
    required this.message,
    this.sentAt,
    this.recipientType,
  });

  factory GymNotification.fromJson(Map<String, dynamic> json) {
    return GymNotification(
      id: json['id'] as String,
      gymId: json['gym_id'] as String,
      title: json['title'] as String,
      message: (json['body'] ?? json['message'] ?? '') as String,
      sentAt: json['sent_at'] != null
          ? DateTime.parse(json['sent_at'] as String)
          : null,
      recipientType: json['recipient_type'] as String?,
    );
  }
}
