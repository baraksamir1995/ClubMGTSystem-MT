class GymCapacity {
  final bool isEnabled;
  final int activeUsers;
  final int maxCapacity;
  final int percentage;

  /// One of: 'not_busy' | 'moderate' | 'busy'
  final String status;

  const GymCapacity({
    required this.isEnabled,
    required this.activeUsers,
    required this.maxCapacity,
    required this.percentage,
    required this.status,
  });

  factory GymCapacity.disabled() => const GymCapacity(
        isEnabled: false,
        activeUsers: 0,
        maxCapacity: 0,
        percentage: 0,
        status: 'not_busy',
      );

  factory GymCapacity.fromJson(Map<String, dynamic> json) {
    if (json['is_enabled'] != true) return GymCapacity.disabled();
    return GymCapacity(
      isEnabled: true,
      activeUsers: (json['active_users'] as num).toInt(),
      maxCapacity: (json['max_capacity'] as num).toInt(),
      percentage: (json['capacity_percentage'] as num).toInt(),
      status: json['status'] as String? ?? 'not_busy',
    );
  }
}
