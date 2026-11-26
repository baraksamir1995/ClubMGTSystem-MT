/// Gym events — `GET /api/events` (member view) and
/// `GET /api/me/event-registrations`. See docs/store-and-events.md.
library;

int? _parseInt(dynamic value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value);
  return null;
}

DateTime? _parseDate(dynamic value) {
  if (value == null) return null;
  return DateTime.tryParse(value.toString())?.toLocal();
}

bool _parseBool(dynamic value) =>
    value == true || value == 1 || value == '1' || value == 'true';

/// Registration lifecycle. `confirmed` | `pending_payment` | `cancelled`.
class EventRegistrationStatus {
  static const confirmed = 'confirmed';
  static const pendingPayment = 'pending_payment';
  static const cancelled = 'cancelled';
}

class EventConfiguration {
  final String id;
  final String name;

  const EventConfiguration({required this.id, required this.name});

  factory EventConfiguration.fromJson(Map<String, dynamic> json) =>
      EventConfiguration(
        id: json['id']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
      );
}

/// The caller's own registration embedded in an event (`my_registration`).
class MyEventRegistration {
  final String id;
  final String status;

  /// `na` (free) | `unpaid` | `paid` | `refunded`.
  final String paymentStatus;
  final String? configurationName;

  const MyEventRegistration({
    required this.id,
    required this.status,
    required this.paymentStatus,
    this.configurationName,
  });

  factory MyEventRegistration.fromJson(Map<String, dynamic> json) =>
      MyEventRegistration(
        id: json['id']?.toString() ?? '',
        status: json['status']?.toString() ?? EventRegistrationStatus.confirmed,
        paymentStatus: json['payment_status']?.toString() ?? 'na',
        configurationName: json['configuration_name'] as String?,
      );

  bool get isConfirmed => status == EventRegistrationStatus.confirmed;
  bool get isPendingPayment => status == EventRegistrationStatus.pendingPayment;
  bool get isPaid => paymentStatus == 'paid';

  /// Members can cancel their own unpaid / free registrations; paid ones
  /// must be cancelled (and refunded) by the gym.
  bool get canCancel => !isPaid && status != EventRegistrationStatus.cancelled;
}

class GymEvent {
  final String id;
  final String title;
  final String? description;
  final String? location;
  final String? imageUrl;
  final DateTime? startsAt;
  final DateTime? endsAt;
  final DateTime? registrationDeadline;

  /// null = unlimited.
  final int? capacity;

  /// null = unlimited.
  final int? seatsLeft;
  final bool isPaid;
  final int? priceCents;
  final String currency;
  final String? configurationLabel;
  final List<EventConfiguration> configurations;
  final MyEventRegistration? myRegistration;

  const GymEvent({
    required this.id,
    required this.title,
    this.description,
    this.location,
    this.imageUrl,
    this.startsAt,
    this.endsAt,
    this.registrationDeadline,
    this.capacity,
    this.seatsLeft,
    this.isPaid = false,
    this.priceCents,
    this.currency = 'EGP',
    this.configurationLabel,
    this.configurations = const [],
    this.myRegistration,
  });

  factory GymEvent.fromJson(Map<String, dynamic> json) {
    final rawConfigs = json['configurations'];
    final reg = json['my_registration'];
    final currency = json['currency']?.toString();
    return GymEvent(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      description: json['description'] as String?,
      location: json['location'] as String?,
      imageUrl: json['image_url'] as String?,
      startsAt: _parseDate(json['starts_at']),
      endsAt: _parseDate(json['ends_at']),
      registrationDeadline: _parseDate(json['registration_deadline']),
      capacity: _parseInt(json['capacity']),
      seatsLeft: _parseInt(json['seats_left']),
      isPaid: _parseBool(json['is_paid']),
      priceCents: _parseInt(json['price_cents']),
      currency: (currency == null || currency.isEmpty) ? 'EGP' : currency,
      configurationLabel: json['configuration_label'] as String?,
      configurations: rawConfigs is List
          ? rawConfigs
              .whereType<Map>()
              .map((c) => EventConfiguration.fromJson(Map<String, dynamic>.from(c)))
              .toList()
          : const [],
      myRegistration: reg is Map
          ? MyEventRegistration.fromJson(Map<String, dynamic>.from(reg))
          : null,
    );
  }

  double get price => (priceCents ?? 0) / 100;

  bool get requiresConfiguration => configurations.isNotEmpty;

  bool get isFull => seatsLeft != null && seatsLeft! <= 0;

  bool get registrationClosed =>
      registrationDeadline != null &&
      DateTime.now().isAfter(registrationDeadline!);

  /// Registered or holding a seat while payment settles.
  bool get isRegistered =>
      myRegistration != null &&
      myRegistration!.status != EventRegistrationStatus.cancelled;

  GymEvent copyWith({MyEventRegistration? myRegistration, bool clearRegistration = false}) {
    return GymEvent(
      id: id,
      title: title,
      description: description,
      location: location,
      imageUrl: imageUrl,
      startsAt: startsAt,
      endsAt: endsAt,
      registrationDeadline: registrationDeadline,
      capacity: capacity,
      seatsLeft: seatsLeft,
      isPaid: isPaid,
      priceCents: priceCents,
      currency: currency,
      configurationLabel: configurationLabel,
      configurations: configurations,
      myRegistration: clearRegistration ? null : (myRegistration ?? this.myRegistration),
    );
  }
}

/// Row of `GET /api/me/event-registrations` (cancelled are excluded).
class EventRegistrationSummary {
  final String id;
  final String eventId;
  final String status;
  final String paymentStatus;
  final bool attended;
  final String? configurationName;
  final String title;
  final DateTime? startsAt;
  final DateTime? endsAt;
  final String? location;
  final String? imageUrl;

  const EventRegistrationSummary({
    required this.id,
    required this.eventId,
    required this.status,
    required this.paymentStatus,
    this.attended = false,
    this.configurationName,
    required this.title,
    this.startsAt,
    this.endsAt,
    this.location,
    this.imageUrl,
  });

  factory EventRegistrationSummary.fromJson(Map<String, dynamic> json) =>
      EventRegistrationSummary(
        id: json['id']?.toString() ?? '',
        eventId: json['event_id']?.toString() ?? '',
        status: json['status']?.toString() ?? EventRegistrationStatus.confirmed,
        paymentStatus: json['payment_status']?.toString() ?? 'na',
        attended: _parseBool(json['attended']),
        configurationName: json['configuration_name'] as String?,
        title: json['title']?.toString() ?? '',
        startsAt: _parseDate(json['starts_at']),
        endsAt: _parseDate(json['ends_at']),
        location: json['location'] as String?,
        imageUrl: json['image_url'] as String?,
      );

  bool get isPast {
    final end = endsAt ?? startsAt;
    return end != null && end.isBefore(DateTime.now());
  }

  bool get canCancel =>
      paymentStatus != 'paid' && status != EventRegistrationStatus.cancelled && !isPast;
}
