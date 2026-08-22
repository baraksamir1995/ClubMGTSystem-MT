/// A published version of a gym's Contract Terms & Conditions.
class ContractTerms {
  final String id;
  final String gymId;
  final String content;
  final int version;
  final DateTime? updatedAt;

  const ContractTerms({
    required this.id,
    required this.gymId,
    required this.content,
    required this.version,
    this.updatedAt,
  });

  factory ContractTerms.fromJson(Map<String, dynamic> json) => ContractTerms(
        id: json['id']?.toString() ?? '',
        gymId: json['gym_id']?.toString() ?? '',
        content: json['contract_terms_conditions']?.toString() ?? '',
        version: (json['terms_version'] as num?)?.toInt() ?? 1,
        updatedAt: json['updated_at'] != null
            ? DateTime.tryParse(json['updated_at'].toString())
            : null,
      );
}

/// Outcome of a terms fetch.
///
/// "The gym has not configured terms" and "the request failed" must lead
/// to different screens — an empty state vs a retry — so they can't both
/// collapse into a plain null.
class ContractTermsResult {
  final ContractTerms? terms;
  final bool failed;

  /// True when the returned terms are the exact version the invoice was
  /// issued under, rather than the gym's current version.
  final bool isPinnedVersion;

  const ContractTermsResult({
    this.terms,
    this.failed = false,
    this.isPinnedVersion = false,
  });

  bool get isEmpty => !failed && terms == null;
}
