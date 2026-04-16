class Payment {
  final String id;
  final String gymId;
  final String? membershipId;
  final double amount;
  final String? currency;
  final String? status;
  final DateTime? paidAt;
  final DateTime? createdAt;

  const Payment({
    required this.id,
    required this.gymId,
    this.membershipId,
    required this.amount,
    this.currency,
    this.status,
    this.paidAt,
    this.createdAt,
  });

  factory Payment.fromJson(Map<String, dynamic> json) {
    return Payment(
      id: json['id'] as String,
      gymId: json['gym_id'] as String,
      membershipId: json['membership_id'] as String?,
      amount: (json['amount'] as num).toDouble(),
      currency: json['currency'] as String?,
      status: json['status'] as String?,
      paidAt: json['paid_at'] != null
          ? DateTime.parse(json['paid_at'] as String)
          : null,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : null,
    );
  }
}
