/// A single session-transfer event from the perspective of the caller.
///
/// The /api/members/me/transfers endpoint returns two lists (sent + received)
/// each carrying the same row shape. `isSent` tells us which list the row
/// came from so the UI can render direction (sent to X / received from X).
class TransferLog {
  final String id;
  final int count;
  final DateTime createdAt;
  final String otherName;
  final String? otherPhotoUrl;
  final bool isSent;

  const TransferLog({
    required this.id,
    required this.count,
    required this.createdAt,
    required this.otherName,
    this.otherPhotoUrl,
    required this.isSent,
  });

  factory TransferLog.fromJson(Map<String, dynamic> json, {required bool isSent}) {
    return TransferLog(
      id: json['id'] as String,
      count: (json['count'] as num?)?.toInt() ?? 0,
      createdAt: DateTime.parse(json['created_at'] as String).toLocal(),
      otherName: (json['other_name'] as String?)?.trim().isNotEmpty == true
          ? (json['other_name'] as String).trim()
          : 'Member',
      otherPhotoUrl: json['other_photo'] as String?,
      isSent: isSent,
    );
  }
}
