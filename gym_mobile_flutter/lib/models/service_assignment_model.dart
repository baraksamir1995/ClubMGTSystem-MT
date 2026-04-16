class ServiceAssignment {
  final String id;
  final String packageName;
  final String serviceType;
  final String? trainerName;
  final int sessionsTotal;
  final int sessionsUsed;
  final String status;
  final String? notes;
  final DateTime assignedAt;

  const ServiceAssignment({
    required this.id,
    required this.packageName,
    required this.serviceType,
    this.trainerName,
    required this.sessionsTotal,
    required this.sessionsUsed,
    required this.status,
    this.notes,
    required this.assignedAt,
  });

  int get sessionsRemaining => (sessionsTotal - sessionsUsed).clamp(0, sessionsTotal);
  bool get isActive => status == 'active';

  String get serviceLabel {
    switch (serviceType) {
      case 'personal_trainer': return 'Personal Training';
      case 'nutritionist':     return 'Nutrition';
      case 'physiotherapist':  return 'Physiotherapy';
      default:                 return serviceType.replaceAll('_', ' ');
    }
  }

  factory ServiceAssignment.fromJson(Map<String, dynamic> json) {
    return ServiceAssignment(
      id:            json['id'] as String,
      packageName:   json['package_name'] as String,
      serviceType:   json['service_type'] as String,
      trainerName:   json['trainer_name'] as String?,
      sessionsTotal: (json['sessions_total'] as num).toInt(),
      sessionsUsed:  (json['sessions_used'] as num? ?? 0).toInt(),
      status:        json['status'] as String? ?? 'active',
      notes:         json['notes'] as String?,
      assignedAt:    DateTime.parse(json['assigned_at'] as String),
    );
  }
}
