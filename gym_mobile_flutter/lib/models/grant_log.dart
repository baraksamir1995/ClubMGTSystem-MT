class GrantLog {
  final String id;
  final int count;
  final DateTime createdAt;
  final String? grantedByName;
  final String? note;

  const GrantLog({
    required this.id,
    required this.count,
    required this.createdAt,
    this.grantedByName,
    this.note,
  });

  factory GrantLog.fromJson(Map<String, dynamic> json) {
    return GrantLog(
      id: json['id'] as String,
      count: (json['count'] as num?)?.toInt() ?? 0,
      createdAt: DateTime.parse(json['created_at'] as String).toLocal(),
      grantedByName: json['granted_by_name'] as String?,
      note: json['note'] as String?,
    );
  }
}
