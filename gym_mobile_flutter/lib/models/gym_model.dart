class Gym {
  final String id;
  final String name;
  final String? logoUrl;
  final String? primaryColor;
  final String? secondaryColor;
  final bool mobilePaymentsEnabled;
  // Per-gym toggle (admin Settings → "Session Transfers"). When false the
  // profile screen hides the "Share sessions" entry point. Defaults true
  // so a not-yet-loaded gym keeps the current behaviour (fail-open).
  final bool sessionTransferEnabled;

  const Gym({
    required this.id,
    required this.name,
    this.logoUrl,
    this.primaryColor,
    this.secondaryColor,
    this.mobilePaymentsEnabled = true,
    this.sessionTransferEnabled = true,
  });

  factory Gym.fromJson(Map<String, dynamic> json) {
    // Colors are stored inside branding_config JSONB, with top-level fallbacks
    final branding = json['branding_config'] as Map<String, dynamic>?;
    return Gym(
      id: json['id'] as String,
      name: json['name'] as String,
      logoUrl: json['logo_url'] as String?,
      primaryColor: branding?['primary_color'] as String? ?? json['primary_color'] as String?,
      secondaryColor: branding?['secondary_color'] as String? ?? json['secondary_color'] as String?,
      mobilePaymentsEnabled: json['mobile_payments_enabled'] as bool? ?? true,
      sessionTransferEnabled: json['session_transfer_enabled'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'logo_url': logoUrl,
      'branding_config': {
        'primary_color': primaryColor,
        'secondary_color': secondaryColor,
      },
      'mobile_payments_enabled': mobilePaymentsEnabled,
      'session_transfer_enabled': sessionTransferEnabled,
    };
  }
}
