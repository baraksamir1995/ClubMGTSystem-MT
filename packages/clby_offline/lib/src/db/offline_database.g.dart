// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'offline_database.dart';

// ignore_for_file: type=lint
class $OutboxEventsTable extends OutboxEvents
    with TableInfo<$OutboxEventsTable, OutboxEvent> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $OutboxEventsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _eventIdMeta = const VerificationMeta(
    'eventId',
  );
  @override
  late final GeneratedColumn<String> eventId = GeneratedColumn<String>(
    'event_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _kindMeta = const VerificationMeta('kind');
  @override
  late final GeneratedColumn<String> kind = GeneratedColumn<String>(
    'kind',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _attendanceMethodMeta = const VerificationMeta(
    'attendanceMethod',
  );
  @override
  late final GeneratedColumn<String> attendanceMethod = GeneratedColumn<String>(
    'attendance_method',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _gymIdMeta = const VerificationMeta('gymId');
  @override
  late final GeneratedColumn<String> gymId = GeneratedColumn<String>(
    'gym_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _branchIdMeta = const VerificationMeta(
    'branchId',
  );
  @override
  late final GeneratedColumn<String> branchId = GeneratedColumn<String>(
    'branch_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _memberIdMeta = const VerificationMeta(
    'memberId',
  );
  @override
  late final GeneratedColumn<String> memberId = GeneratedColumn<String>(
    'member_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _classSessionIdMeta = const VerificationMeta(
    'classSessionId',
  );
  @override
  late final GeneratedColumn<String> classSessionId = GeneratedColumn<String>(
    'class_session_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _studioIdMeta = const VerificationMeta(
    'studioId',
  );
  @override
  late final GeneratedColumn<String> studioId = GeneratedColumn<String>(
    'studio_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _serviceAssignmentIdMeta =
      const VerificationMeta('serviceAssignmentId');
  @override
  late final GeneratedColumn<String> serviceAssignmentId =
      GeneratedColumn<String>(
        'service_assignment_id',
        aliasedName,
        true,
        type: DriftSqlType.string,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _trainerIdMeta = const VerificationMeta(
    'trainerId',
  );
  @override
  late final GeneratedColumn<String> trainerId = GeneratedColumn<String>(
    'trainer_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _deviceRecordedAtMeta = const VerificationMeta(
    'deviceRecordedAt',
  );
  @override
  late final GeneratedColumn<String> deviceRecordedAt = GeneratedColumn<String>(
    'device_recorded_at',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _deviceRecordedAtMsMeta =
      const VerificationMeta('deviceRecordedAtMs');
  @override
  late final GeneratedColumn<int> deviceRecordedAtMs = GeneratedColumn<int>(
    'device_recorded_at_ms',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _deviceTimezoneMeta = const VerificationMeta(
    'deviceTimezone',
  );
  @override
  late final GeneratedColumn<String> deviceTimezone = GeneratedColumn<String>(
    'device_timezone',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _qrRawMeta = const VerificationMeta('qrRaw');
  @override
  late final GeneratedColumn<String> qrRaw = GeneratedColumn<String>(
    'qr_raw',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _noteMeta = const VerificationMeta('note');
  @override
  late final GeneratedColumn<String> note = GeneratedColumn<String>(
    'note',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _metadataMeta = const VerificationMeta(
    'metadata',
  );
  @override
  late final GeneratedColumn<String> metadata = GeneratedColumn<String>(
    'metadata',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('{}'),
  );
  static const VerificationMeta _actorUserIdMeta = const VerificationMeta(
    'actorUserId',
  );
  @override
  late final GeneratedColumn<String> actorUserId = GeneratedColumn<String>(
    'actor_user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _actorTypeMeta = const VerificationMeta(
    'actorType',
  );
  @override
  late final GeneratedColumn<String> actorType = GeneratedColumn<String>(
    'actor_type',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _deviceIdMeta = const VerificationMeta(
    'deviceId',
  );
  @override
  late final GeneratedColumn<String> deviceId = GeneratedColumn<String>(
    'device_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _syncStatusMeta = const VerificationMeta(
    'syncStatus',
  );
  @override
  late final GeneratedColumn<String> syncStatus = GeneratedColumn<String>(
    'sync_status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('pending'),
  );
  static const VerificationMeta _syncAttemptsMeta = const VerificationMeta(
    'syncAttempts',
  );
  @override
  late final GeneratedColumn<int> syncAttempts = GeneratedColumn<int>(
    'sync_attempts',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _nextAttemptAtMeta = const VerificationMeta(
    'nextAttemptAt',
  );
  @override
  late final GeneratedColumn<int> nextAttemptAt = GeneratedColumn<int>(
    'next_attempt_at',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _lastAttemptAtMeta = const VerificationMeta(
    'lastAttemptAt',
  );
  @override
  late final GeneratedColumn<int> lastAttemptAt = GeneratedColumn<int>(
    'last_attempt_at',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _lastSyncErrorMeta = const VerificationMeta(
    'lastSyncError',
  );
  @override
  late final GeneratedColumn<String> lastSyncError = GeneratedColumn<String>(
    'last_sync_error',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _resultStatusMeta = const VerificationMeta(
    'resultStatus',
  );
  @override
  late final GeneratedColumn<String> resultStatus = GeneratedColumn<String>(
    'result_status',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _resultCodeMeta = const VerificationMeta(
    'resultCode',
  );
  @override
  late final GeneratedColumn<String> resultCode = GeneratedColumn<String>(
    'result_code',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _resultMessageMeta = const VerificationMeta(
    'resultMessage',
  );
  @override
  late final GeneratedColumn<String> resultMessage = GeneratedColumn<String>(
    'result_message',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _officialIdMeta = const VerificationMeta(
    'officialId',
  );
  @override
  late final GeneratedColumn<String> officialId = GeneratedColumn<String>(
    'official_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _flagsMeta = const VerificationMeta('flags');
  @override
  late final GeneratedColumn<String> flags = GeneratedColumn<String>(
    'flags',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('[]'),
  );
  static const VerificationMeta _serverReceivedAtMeta = const VerificationMeta(
    'serverReceivedAt',
  );
  @override
  late final GeneratedColumn<String> serverReceivedAt = GeneratedColumn<String>(
    'server_received_at',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _processedAtMeta = const VerificationMeta(
    'processedAt',
  );
  @override
  late final GeneratedColumn<String> processedAt = GeneratedColumn<String>(
    'processed_at',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<int> createdAt = GeneratedColumn<int>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    eventId,
    kind,
    attendanceMethod,
    gymId,
    branchId,
    memberId,
    classSessionId,
    studioId,
    serviceAssignmentId,
    trainerId,
    deviceRecordedAt,
    deviceRecordedAtMs,
    deviceTimezone,
    qrRaw,
    note,
    metadata,
    actorUserId,
    actorType,
    deviceId,
    syncStatus,
    syncAttempts,
    nextAttemptAt,
    lastAttemptAt,
    lastSyncError,
    resultStatus,
    resultCode,
    resultMessage,
    officialId,
    flags,
    serverReceivedAt,
    processedAt,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'outbox_events';
  @override
  VerificationContext validateIntegrity(
    Insertable<OutboxEvent> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('event_id')) {
      context.handle(
        _eventIdMeta,
        eventId.isAcceptableOrUnknown(data['event_id']!, _eventIdMeta),
      );
    } else if (isInserting) {
      context.missing(_eventIdMeta);
    }
    if (data.containsKey('kind')) {
      context.handle(
        _kindMeta,
        kind.isAcceptableOrUnknown(data['kind']!, _kindMeta),
      );
    } else if (isInserting) {
      context.missing(_kindMeta);
    }
    if (data.containsKey('attendance_method')) {
      context.handle(
        _attendanceMethodMeta,
        attendanceMethod.isAcceptableOrUnknown(
          data['attendance_method']!,
          _attendanceMethodMeta,
        ),
      );
    }
    if (data.containsKey('gym_id')) {
      context.handle(
        _gymIdMeta,
        gymId.isAcceptableOrUnknown(data['gym_id']!, _gymIdMeta),
      );
    } else if (isInserting) {
      context.missing(_gymIdMeta);
    }
    if (data.containsKey('branch_id')) {
      context.handle(
        _branchIdMeta,
        branchId.isAcceptableOrUnknown(data['branch_id']!, _branchIdMeta),
      );
    }
    if (data.containsKey('member_id')) {
      context.handle(
        _memberIdMeta,
        memberId.isAcceptableOrUnknown(data['member_id']!, _memberIdMeta),
      );
    } else if (isInserting) {
      context.missing(_memberIdMeta);
    }
    if (data.containsKey('class_session_id')) {
      context.handle(
        _classSessionIdMeta,
        classSessionId.isAcceptableOrUnknown(
          data['class_session_id']!,
          _classSessionIdMeta,
        ),
      );
    }
    if (data.containsKey('studio_id')) {
      context.handle(
        _studioIdMeta,
        studioId.isAcceptableOrUnknown(data['studio_id']!, _studioIdMeta),
      );
    }
    if (data.containsKey('service_assignment_id')) {
      context.handle(
        _serviceAssignmentIdMeta,
        serviceAssignmentId.isAcceptableOrUnknown(
          data['service_assignment_id']!,
          _serviceAssignmentIdMeta,
        ),
      );
    }
    if (data.containsKey('trainer_id')) {
      context.handle(
        _trainerIdMeta,
        trainerId.isAcceptableOrUnknown(data['trainer_id']!, _trainerIdMeta),
      );
    }
    if (data.containsKey('device_recorded_at')) {
      context.handle(
        _deviceRecordedAtMeta,
        deviceRecordedAt.isAcceptableOrUnknown(
          data['device_recorded_at']!,
          _deviceRecordedAtMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_deviceRecordedAtMeta);
    }
    if (data.containsKey('device_recorded_at_ms')) {
      context.handle(
        _deviceRecordedAtMsMeta,
        deviceRecordedAtMs.isAcceptableOrUnknown(
          data['device_recorded_at_ms']!,
          _deviceRecordedAtMsMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_deviceRecordedAtMsMeta);
    }
    if (data.containsKey('device_timezone')) {
      context.handle(
        _deviceTimezoneMeta,
        deviceTimezone.isAcceptableOrUnknown(
          data['device_timezone']!,
          _deviceTimezoneMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_deviceTimezoneMeta);
    }
    if (data.containsKey('qr_raw')) {
      context.handle(
        _qrRawMeta,
        qrRaw.isAcceptableOrUnknown(data['qr_raw']!, _qrRawMeta),
      );
    }
    if (data.containsKey('note')) {
      context.handle(
        _noteMeta,
        note.isAcceptableOrUnknown(data['note']!, _noteMeta),
      );
    }
    if (data.containsKey('metadata')) {
      context.handle(
        _metadataMeta,
        metadata.isAcceptableOrUnknown(data['metadata']!, _metadataMeta),
      );
    }
    if (data.containsKey('actor_user_id')) {
      context.handle(
        _actorUserIdMeta,
        actorUserId.isAcceptableOrUnknown(
          data['actor_user_id']!,
          _actorUserIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_actorUserIdMeta);
    }
    if (data.containsKey('actor_type')) {
      context.handle(
        _actorTypeMeta,
        actorType.isAcceptableOrUnknown(data['actor_type']!, _actorTypeMeta),
      );
    } else if (isInserting) {
      context.missing(_actorTypeMeta);
    }
    if (data.containsKey('device_id')) {
      context.handle(
        _deviceIdMeta,
        deviceId.isAcceptableOrUnknown(data['device_id']!, _deviceIdMeta),
      );
    } else if (isInserting) {
      context.missing(_deviceIdMeta);
    }
    if (data.containsKey('sync_status')) {
      context.handle(
        _syncStatusMeta,
        syncStatus.isAcceptableOrUnknown(data['sync_status']!, _syncStatusMeta),
      );
    }
    if (data.containsKey('sync_attempts')) {
      context.handle(
        _syncAttemptsMeta,
        syncAttempts.isAcceptableOrUnknown(
          data['sync_attempts']!,
          _syncAttemptsMeta,
        ),
      );
    }
    if (data.containsKey('next_attempt_at')) {
      context.handle(
        _nextAttemptAtMeta,
        nextAttemptAt.isAcceptableOrUnknown(
          data['next_attempt_at']!,
          _nextAttemptAtMeta,
        ),
      );
    }
    if (data.containsKey('last_attempt_at')) {
      context.handle(
        _lastAttemptAtMeta,
        lastAttemptAt.isAcceptableOrUnknown(
          data['last_attempt_at']!,
          _lastAttemptAtMeta,
        ),
      );
    }
    if (data.containsKey('last_sync_error')) {
      context.handle(
        _lastSyncErrorMeta,
        lastSyncError.isAcceptableOrUnknown(
          data['last_sync_error']!,
          _lastSyncErrorMeta,
        ),
      );
    }
    if (data.containsKey('result_status')) {
      context.handle(
        _resultStatusMeta,
        resultStatus.isAcceptableOrUnknown(
          data['result_status']!,
          _resultStatusMeta,
        ),
      );
    }
    if (data.containsKey('result_code')) {
      context.handle(
        _resultCodeMeta,
        resultCode.isAcceptableOrUnknown(data['result_code']!, _resultCodeMeta),
      );
    }
    if (data.containsKey('result_message')) {
      context.handle(
        _resultMessageMeta,
        resultMessage.isAcceptableOrUnknown(
          data['result_message']!,
          _resultMessageMeta,
        ),
      );
    }
    if (data.containsKey('official_id')) {
      context.handle(
        _officialIdMeta,
        officialId.isAcceptableOrUnknown(data['official_id']!, _officialIdMeta),
      );
    }
    if (data.containsKey('flags')) {
      context.handle(
        _flagsMeta,
        flags.isAcceptableOrUnknown(data['flags']!, _flagsMeta),
      );
    }
    if (data.containsKey('server_received_at')) {
      context.handle(
        _serverReceivedAtMeta,
        serverReceivedAt.isAcceptableOrUnknown(
          data['server_received_at']!,
          _serverReceivedAtMeta,
        ),
      );
    }
    if (data.containsKey('processed_at')) {
      context.handle(
        _processedAtMeta,
        processedAt.isAcceptableOrUnknown(
          data['processed_at']!,
          _processedAtMeta,
        ),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {eventId};
  @override
  OutboxEvent map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return OutboxEvent(
      eventId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}event_id'],
      )!,
      kind: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}kind'],
      )!,
      attendanceMethod: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}attendance_method'],
      ),
      gymId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}gym_id'],
      )!,
      branchId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}branch_id'],
      ),
      memberId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}member_id'],
      )!,
      classSessionId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}class_session_id'],
      ),
      studioId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}studio_id'],
      ),
      serviceAssignmentId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}service_assignment_id'],
      ),
      trainerId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}trainer_id'],
      ),
      deviceRecordedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}device_recorded_at'],
      )!,
      deviceRecordedAtMs: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}device_recorded_at_ms'],
      )!,
      deviceTimezone: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}device_timezone'],
      )!,
      qrRaw: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}qr_raw'],
      ),
      note: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}note'],
      ),
      metadata: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}metadata'],
      )!,
      actorUserId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}actor_user_id'],
      )!,
      actorType: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}actor_type'],
      )!,
      deviceId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}device_id'],
      )!,
      syncStatus: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}sync_status'],
      )!,
      syncAttempts: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}sync_attempts'],
      )!,
      nextAttemptAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}next_attempt_at'],
      ),
      lastAttemptAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}last_attempt_at'],
      ),
      lastSyncError: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}last_sync_error'],
      ),
      resultStatus: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}result_status'],
      ),
      resultCode: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}result_code'],
      ),
      resultMessage: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}result_message'],
      ),
      officialId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}official_id'],
      ),
      flags: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}flags'],
      )!,
      serverReceivedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}server_received_at'],
      ),
      processedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}processed_at'],
      ),
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $OutboxEventsTable createAlias(String alias) {
    return $OutboxEventsTable(attachedDatabase, alias);
  }
}

class OutboxEvent extends DataClass implements Insertable<OutboxEvent> {
  final String eventId;

  /// `attendance` | `service_session`
  final String kind;

  /// `staff_qr` | `member_qr` | `manual` (kind=attendance only)
  final String? attendanceMethod;
  final String gymId;
  final String? branchId;
  final String memberId;
  final String? classSessionId;
  final String? studioId;
  final String? serviceAssignmentId;

  /// trainer_profiles.id for a member-scanned coach QR (`kind:
  /// service_session`, `method: member_qr`). Added in schema v4.
  final String? trainerId;

  /// ISO-8601 with the device's UTC offset, exactly as sent. Immutable.
  final String deviceRecordedAt;

  /// Same instant as UTC epoch millis — ordering key only. Immutable.
  final int deviceRecordedAtMs;

  /// IANA zone name, e.g. `Africa/Cairo`.
  final String deviceTimezone;
  final String? qrRaw;
  final String? note;

  /// JSON object (≤ 4 KB), free-form, never trusted by the server.
  final String metadata;
  final String actorUserId;

  /// `admin` | `coach` | `member` (the app role that recorded it)
  final String actorType;
  final String deviceId;

  /// `pending` | `syncing` | `synced` | `rejected`
  final String syncStatus;
  final int syncAttempts;

  /// UTC epoch millis; null = due now.
  final int? nextAttemptAt;
  final int? lastAttemptAt;
  final String? lastSyncError;

  /// Raw server status: accepted | duplicate | rejected | error.
  final String? resultStatus;
  final String? resultCode;
  final String? resultMessage;

  /// attendance_id (kind=attendance) or service_log_id (kind=service_session).
  final String? officialId;

  /// JSON array of server review flags (D2), e.g. ["sessions_exhausted"].
  final String flags;
  final String? serverReceivedAt;
  final String? processedAt;

  /// UTC epoch micros at insert — ordering tie-breaker.
  final int createdAt;
  const OutboxEvent({
    required this.eventId,
    required this.kind,
    this.attendanceMethod,
    required this.gymId,
    this.branchId,
    required this.memberId,
    this.classSessionId,
    this.studioId,
    this.serviceAssignmentId,
    this.trainerId,
    required this.deviceRecordedAt,
    required this.deviceRecordedAtMs,
    required this.deviceTimezone,
    this.qrRaw,
    this.note,
    required this.metadata,
    required this.actorUserId,
    required this.actorType,
    required this.deviceId,
    required this.syncStatus,
    required this.syncAttempts,
    this.nextAttemptAt,
    this.lastAttemptAt,
    this.lastSyncError,
    this.resultStatus,
    this.resultCode,
    this.resultMessage,
    this.officialId,
    required this.flags,
    this.serverReceivedAt,
    this.processedAt,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['event_id'] = Variable<String>(eventId);
    map['kind'] = Variable<String>(kind);
    if (!nullToAbsent || attendanceMethod != null) {
      map['attendance_method'] = Variable<String>(attendanceMethod);
    }
    map['gym_id'] = Variable<String>(gymId);
    if (!nullToAbsent || branchId != null) {
      map['branch_id'] = Variable<String>(branchId);
    }
    map['member_id'] = Variable<String>(memberId);
    if (!nullToAbsent || classSessionId != null) {
      map['class_session_id'] = Variable<String>(classSessionId);
    }
    if (!nullToAbsent || studioId != null) {
      map['studio_id'] = Variable<String>(studioId);
    }
    if (!nullToAbsent || serviceAssignmentId != null) {
      map['service_assignment_id'] = Variable<String>(serviceAssignmentId);
    }
    if (!nullToAbsent || trainerId != null) {
      map['trainer_id'] = Variable<String>(trainerId);
    }
    map['device_recorded_at'] = Variable<String>(deviceRecordedAt);
    map['device_recorded_at_ms'] = Variable<int>(deviceRecordedAtMs);
    map['device_timezone'] = Variable<String>(deviceTimezone);
    if (!nullToAbsent || qrRaw != null) {
      map['qr_raw'] = Variable<String>(qrRaw);
    }
    if (!nullToAbsent || note != null) {
      map['note'] = Variable<String>(note);
    }
    map['metadata'] = Variable<String>(metadata);
    map['actor_user_id'] = Variable<String>(actorUserId);
    map['actor_type'] = Variable<String>(actorType);
    map['device_id'] = Variable<String>(deviceId);
    map['sync_status'] = Variable<String>(syncStatus);
    map['sync_attempts'] = Variable<int>(syncAttempts);
    if (!nullToAbsent || nextAttemptAt != null) {
      map['next_attempt_at'] = Variable<int>(nextAttemptAt);
    }
    if (!nullToAbsent || lastAttemptAt != null) {
      map['last_attempt_at'] = Variable<int>(lastAttemptAt);
    }
    if (!nullToAbsent || lastSyncError != null) {
      map['last_sync_error'] = Variable<String>(lastSyncError);
    }
    if (!nullToAbsent || resultStatus != null) {
      map['result_status'] = Variable<String>(resultStatus);
    }
    if (!nullToAbsent || resultCode != null) {
      map['result_code'] = Variable<String>(resultCode);
    }
    if (!nullToAbsent || resultMessage != null) {
      map['result_message'] = Variable<String>(resultMessage);
    }
    if (!nullToAbsent || officialId != null) {
      map['official_id'] = Variable<String>(officialId);
    }
    map['flags'] = Variable<String>(flags);
    if (!nullToAbsent || serverReceivedAt != null) {
      map['server_received_at'] = Variable<String>(serverReceivedAt);
    }
    if (!nullToAbsent || processedAt != null) {
      map['processed_at'] = Variable<String>(processedAt);
    }
    map['created_at'] = Variable<int>(createdAt);
    return map;
  }

  OutboxEventsCompanion toCompanion(bool nullToAbsent) {
    return OutboxEventsCompanion(
      eventId: Value(eventId),
      kind: Value(kind),
      attendanceMethod: attendanceMethod == null && nullToAbsent
          ? const Value.absent()
          : Value(attendanceMethod),
      gymId: Value(gymId),
      branchId: branchId == null && nullToAbsent
          ? const Value.absent()
          : Value(branchId),
      memberId: Value(memberId),
      classSessionId: classSessionId == null && nullToAbsent
          ? const Value.absent()
          : Value(classSessionId),
      studioId: studioId == null && nullToAbsent
          ? const Value.absent()
          : Value(studioId),
      serviceAssignmentId: serviceAssignmentId == null && nullToAbsent
          ? const Value.absent()
          : Value(serviceAssignmentId),
      trainerId: trainerId == null && nullToAbsent
          ? const Value.absent()
          : Value(trainerId),
      deviceRecordedAt: Value(deviceRecordedAt),
      deviceRecordedAtMs: Value(deviceRecordedAtMs),
      deviceTimezone: Value(deviceTimezone),
      qrRaw: qrRaw == null && nullToAbsent
          ? const Value.absent()
          : Value(qrRaw),
      note: note == null && nullToAbsent ? const Value.absent() : Value(note),
      metadata: Value(metadata),
      actorUserId: Value(actorUserId),
      actorType: Value(actorType),
      deviceId: Value(deviceId),
      syncStatus: Value(syncStatus),
      syncAttempts: Value(syncAttempts),
      nextAttemptAt: nextAttemptAt == null && nullToAbsent
          ? const Value.absent()
          : Value(nextAttemptAt),
      lastAttemptAt: lastAttemptAt == null && nullToAbsent
          ? const Value.absent()
          : Value(lastAttemptAt),
      lastSyncError: lastSyncError == null && nullToAbsent
          ? const Value.absent()
          : Value(lastSyncError),
      resultStatus: resultStatus == null && nullToAbsent
          ? const Value.absent()
          : Value(resultStatus),
      resultCode: resultCode == null && nullToAbsent
          ? const Value.absent()
          : Value(resultCode),
      resultMessage: resultMessage == null && nullToAbsent
          ? const Value.absent()
          : Value(resultMessage),
      officialId: officialId == null && nullToAbsent
          ? const Value.absent()
          : Value(officialId),
      flags: Value(flags),
      serverReceivedAt: serverReceivedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(serverReceivedAt),
      processedAt: processedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(processedAt),
      createdAt: Value(createdAt),
    );
  }

  factory OutboxEvent.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return OutboxEvent(
      eventId: serializer.fromJson<String>(json['eventId']),
      kind: serializer.fromJson<String>(json['kind']),
      attendanceMethod: serializer.fromJson<String?>(json['attendanceMethod']),
      gymId: serializer.fromJson<String>(json['gymId']),
      branchId: serializer.fromJson<String?>(json['branchId']),
      memberId: serializer.fromJson<String>(json['memberId']),
      classSessionId: serializer.fromJson<String?>(json['classSessionId']),
      studioId: serializer.fromJson<String?>(json['studioId']),
      serviceAssignmentId: serializer.fromJson<String?>(
        json['serviceAssignmentId'],
      ),
      trainerId: serializer.fromJson<String?>(json['trainerId']),
      deviceRecordedAt: serializer.fromJson<String>(json['deviceRecordedAt']),
      deviceRecordedAtMs: serializer.fromJson<int>(json['deviceRecordedAtMs']),
      deviceTimezone: serializer.fromJson<String>(json['deviceTimezone']),
      qrRaw: serializer.fromJson<String?>(json['qrRaw']),
      note: serializer.fromJson<String?>(json['note']),
      metadata: serializer.fromJson<String>(json['metadata']),
      actorUserId: serializer.fromJson<String>(json['actorUserId']),
      actorType: serializer.fromJson<String>(json['actorType']),
      deviceId: serializer.fromJson<String>(json['deviceId']),
      syncStatus: serializer.fromJson<String>(json['syncStatus']),
      syncAttempts: serializer.fromJson<int>(json['syncAttempts']),
      nextAttemptAt: serializer.fromJson<int?>(json['nextAttemptAt']),
      lastAttemptAt: serializer.fromJson<int?>(json['lastAttemptAt']),
      lastSyncError: serializer.fromJson<String?>(json['lastSyncError']),
      resultStatus: serializer.fromJson<String?>(json['resultStatus']),
      resultCode: serializer.fromJson<String?>(json['resultCode']),
      resultMessage: serializer.fromJson<String?>(json['resultMessage']),
      officialId: serializer.fromJson<String?>(json['officialId']),
      flags: serializer.fromJson<String>(json['flags']),
      serverReceivedAt: serializer.fromJson<String?>(json['serverReceivedAt']),
      processedAt: serializer.fromJson<String?>(json['processedAt']),
      createdAt: serializer.fromJson<int>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'eventId': serializer.toJson<String>(eventId),
      'kind': serializer.toJson<String>(kind),
      'attendanceMethod': serializer.toJson<String?>(attendanceMethod),
      'gymId': serializer.toJson<String>(gymId),
      'branchId': serializer.toJson<String?>(branchId),
      'memberId': serializer.toJson<String>(memberId),
      'classSessionId': serializer.toJson<String?>(classSessionId),
      'studioId': serializer.toJson<String?>(studioId),
      'serviceAssignmentId': serializer.toJson<String?>(serviceAssignmentId),
      'trainerId': serializer.toJson<String?>(trainerId),
      'deviceRecordedAt': serializer.toJson<String>(deviceRecordedAt),
      'deviceRecordedAtMs': serializer.toJson<int>(deviceRecordedAtMs),
      'deviceTimezone': serializer.toJson<String>(deviceTimezone),
      'qrRaw': serializer.toJson<String?>(qrRaw),
      'note': serializer.toJson<String?>(note),
      'metadata': serializer.toJson<String>(metadata),
      'actorUserId': serializer.toJson<String>(actorUserId),
      'actorType': serializer.toJson<String>(actorType),
      'deviceId': serializer.toJson<String>(deviceId),
      'syncStatus': serializer.toJson<String>(syncStatus),
      'syncAttempts': serializer.toJson<int>(syncAttempts),
      'nextAttemptAt': serializer.toJson<int?>(nextAttemptAt),
      'lastAttemptAt': serializer.toJson<int?>(lastAttemptAt),
      'lastSyncError': serializer.toJson<String?>(lastSyncError),
      'resultStatus': serializer.toJson<String?>(resultStatus),
      'resultCode': serializer.toJson<String?>(resultCode),
      'resultMessage': serializer.toJson<String?>(resultMessage),
      'officialId': serializer.toJson<String?>(officialId),
      'flags': serializer.toJson<String>(flags),
      'serverReceivedAt': serializer.toJson<String?>(serverReceivedAt),
      'processedAt': serializer.toJson<String?>(processedAt),
      'createdAt': serializer.toJson<int>(createdAt),
    };
  }

  OutboxEvent copyWith({
    String? eventId,
    String? kind,
    Value<String?> attendanceMethod = const Value.absent(),
    String? gymId,
    Value<String?> branchId = const Value.absent(),
    String? memberId,
    Value<String?> classSessionId = const Value.absent(),
    Value<String?> studioId = const Value.absent(),
    Value<String?> serviceAssignmentId = const Value.absent(),
    Value<String?> trainerId = const Value.absent(),
    String? deviceRecordedAt,
    int? deviceRecordedAtMs,
    String? deviceTimezone,
    Value<String?> qrRaw = const Value.absent(),
    Value<String?> note = const Value.absent(),
    String? metadata,
    String? actorUserId,
    String? actorType,
    String? deviceId,
    String? syncStatus,
    int? syncAttempts,
    Value<int?> nextAttemptAt = const Value.absent(),
    Value<int?> lastAttemptAt = const Value.absent(),
    Value<String?> lastSyncError = const Value.absent(),
    Value<String?> resultStatus = const Value.absent(),
    Value<String?> resultCode = const Value.absent(),
    Value<String?> resultMessage = const Value.absent(),
    Value<String?> officialId = const Value.absent(),
    String? flags,
    Value<String?> serverReceivedAt = const Value.absent(),
    Value<String?> processedAt = const Value.absent(),
    int? createdAt,
  }) => OutboxEvent(
    eventId: eventId ?? this.eventId,
    kind: kind ?? this.kind,
    attendanceMethod: attendanceMethod.present
        ? attendanceMethod.value
        : this.attendanceMethod,
    gymId: gymId ?? this.gymId,
    branchId: branchId.present ? branchId.value : this.branchId,
    memberId: memberId ?? this.memberId,
    classSessionId: classSessionId.present
        ? classSessionId.value
        : this.classSessionId,
    studioId: studioId.present ? studioId.value : this.studioId,
    serviceAssignmentId: serviceAssignmentId.present
        ? serviceAssignmentId.value
        : this.serviceAssignmentId,
    trainerId: trainerId.present ? trainerId.value : this.trainerId,
    deviceRecordedAt: deviceRecordedAt ?? this.deviceRecordedAt,
    deviceRecordedAtMs: deviceRecordedAtMs ?? this.deviceRecordedAtMs,
    deviceTimezone: deviceTimezone ?? this.deviceTimezone,
    qrRaw: qrRaw.present ? qrRaw.value : this.qrRaw,
    note: note.present ? note.value : this.note,
    metadata: metadata ?? this.metadata,
    actorUserId: actorUserId ?? this.actorUserId,
    actorType: actorType ?? this.actorType,
    deviceId: deviceId ?? this.deviceId,
    syncStatus: syncStatus ?? this.syncStatus,
    syncAttempts: syncAttempts ?? this.syncAttempts,
    nextAttemptAt: nextAttemptAt.present
        ? nextAttemptAt.value
        : this.nextAttemptAt,
    lastAttemptAt: lastAttemptAt.present
        ? lastAttemptAt.value
        : this.lastAttemptAt,
    lastSyncError: lastSyncError.present
        ? lastSyncError.value
        : this.lastSyncError,
    resultStatus: resultStatus.present ? resultStatus.value : this.resultStatus,
    resultCode: resultCode.present ? resultCode.value : this.resultCode,
    resultMessage: resultMessage.present
        ? resultMessage.value
        : this.resultMessage,
    officialId: officialId.present ? officialId.value : this.officialId,
    flags: flags ?? this.flags,
    serverReceivedAt: serverReceivedAt.present
        ? serverReceivedAt.value
        : this.serverReceivedAt,
    processedAt: processedAt.present ? processedAt.value : this.processedAt,
    createdAt: createdAt ?? this.createdAt,
  );
  OutboxEvent copyWithCompanion(OutboxEventsCompanion data) {
    return OutboxEvent(
      eventId: data.eventId.present ? data.eventId.value : this.eventId,
      kind: data.kind.present ? data.kind.value : this.kind,
      attendanceMethod: data.attendanceMethod.present
          ? data.attendanceMethod.value
          : this.attendanceMethod,
      gymId: data.gymId.present ? data.gymId.value : this.gymId,
      branchId: data.branchId.present ? data.branchId.value : this.branchId,
      memberId: data.memberId.present ? data.memberId.value : this.memberId,
      classSessionId: data.classSessionId.present
          ? data.classSessionId.value
          : this.classSessionId,
      studioId: data.studioId.present ? data.studioId.value : this.studioId,
      serviceAssignmentId: data.serviceAssignmentId.present
          ? data.serviceAssignmentId.value
          : this.serviceAssignmentId,
      trainerId: data.trainerId.present ? data.trainerId.value : this.trainerId,
      deviceRecordedAt: data.deviceRecordedAt.present
          ? data.deviceRecordedAt.value
          : this.deviceRecordedAt,
      deviceRecordedAtMs: data.deviceRecordedAtMs.present
          ? data.deviceRecordedAtMs.value
          : this.deviceRecordedAtMs,
      deviceTimezone: data.deviceTimezone.present
          ? data.deviceTimezone.value
          : this.deviceTimezone,
      qrRaw: data.qrRaw.present ? data.qrRaw.value : this.qrRaw,
      note: data.note.present ? data.note.value : this.note,
      metadata: data.metadata.present ? data.metadata.value : this.metadata,
      actorUserId: data.actorUserId.present
          ? data.actorUserId.value
          : this.actorUserId,
      actorType: data.actorType.present ? data.actorType.value : this.actorType,
      deviceId: data.deviceId.present ? data.deviceId.value : this.deviceId,
      syncStatus: data.syncStatus.present
          ? data.syncStatus.value
          : this.syncStatus,
      syncAttempts: data.syncAttempts.present
          ? data.syncAttempts.value
          : this.syncAttempts,
      nextAttemptAt: data.nextAttemptAt.present
          ? data.nextAttemptAt.value
          : this.nextAttemptAt,
      lastAttemptAt: data.lastAttemptAt.present
          ? data.lastAttemptAt.value
          : this.lastAttemptAt,
      lastSyncError: data.lastSyncError.present
          ? data.lastSyncError.value
          : this.lastSyncError,
      resultStatus: data.resultStatus.present
          ? data.resultStatus.value
          : this.resultStatus,
      resultCode: data.resultCode.present
          ? data.resultCode.value
          : this.resultCode,
      resultMessage: data.resultMessage.present
          ? data.resultMessage.value
          : this.resultMessage,
      officialId: data.officialId.present
          ? data.officialId.value
          : this.officialId,
      flags: data.flags.present ? data.flags.value : this.flags,
      serverReceivedAt: data.serverReceivedAt.present
          ? data.serverReceivedAt.value
          : this.serverReceivedAt,
      processedAt: data.processedAt.present
          ? data.processedAt.value
          : this.processedAt,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('OutboxEvent(')
          ..write('eventId: $eventId, ')
          ..write('kind: $kind, ')
          ..write('attendanceMethod: $attendanceMethod, ')
          ..write('gymId: $gymId, ')
          ..write('branchId: $branchId, ')
          ..write('memberId: $memberId, ')
          ..write('classSessionId: $classSessionId, ')
          ..write('studioId: $studioId, ')
          ..write('serviceAssignmentId: $serviceAssignmentId, ')
          ..write('trainerId: $trainerId, ')
          ..write('deviceRecordedAt: $deviceRecordedAt, ')
          ..write('deviceRecordedAtMs: $deviceRecordedAtMs, ')
          ..write('deviceTimezone: $deviceTimezone, ')
          ..write('qrRaw: $qrRaw, ')
          ..write('note: $note, ')
          ..write('metadata: $metadata, ')
          ..write('actorUserId: $actorUserId, ')
          ..write('actorType: $actorType, ')
          ..write('deviceId: $deviceId, ')
          ..write('syncStatus: $syncStatus, ')
          ..write('syncAttempts: $syncAttempts, ')
          ..write('nextAttemptAt: $nextAttemptAt, ')
          ..write('lastAttemptAt: $lastAttemptAt, ')
          ..write('lastSyncError: $lastSyncError, ')
          ..write('resultStatus: $resultStatus, ')
          ..write('resultCode: $resultCode, ')
          ..write('resultMessage: $resultMessage, ')
          ..write('officialId: $officialId, ')
          ..write('flags: $flags, ')
          ..write('serverReceivedAt: $serverReceivedAt, ')
          ..write('processedAt: $processedAt, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hashAll([
    eventId,
    kind,
    attendanceMethod,
    gymId,
    branchId,
    memberId,
    classSessionId,
    studioId,
    serviceAssignmentId,
    trainerId,
    deviceRecordedAt,
    deviceRecordedAtMs,
    deviceTimezone,
    qrRaw,
    note,
    metadata,
    actorUserId,
    actorType,
    deviceId,
    syncStatus,
    syncAttempts,
    nextAttemptAt,
    lastAttemptAt,
    lastSyncError,
    resultStatus,
    resultCode,
    resultMessage,
    officialId,
    flags,
    serverReceivedAt,
    processedAt,
    createdAt,
  ]);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is OutboxEvent &&
          other.eventId == this.eventId &&
          other.kind == this.kind &&
          other.attendanceMethod == this.attendanceMethod &&
          other.gymId == this.gymId &&
          other.branchId == this.branchId &&
          other.memberId == this.memberId &&
          other.classSessionId == this.classSessionId &&
          other.studioId == this.studioId &&
          other.serviceAssignmentId == this.serviceAssignmentId &&
          other.trainerId == this.trainerId &&
          other.deviceRecordedAt == this.deviceRecordedAt &&
          other.deviceRecordedAtMs == this.deviceRecordedAtMs &&
          other.deviceTimezone == this.deviceTimezone &&
          other.qrRaw == this.qrRaw &&
          other.note == this.note &&
          other.metadata == this.metadata &&
          other.actorUserId == this.actorUserId &&
          other.actorType == this.actorType &&
          other.deviceId == this.deviceId &&
          other.syncStatus == this.syncStatus &&
          other.syncAttempts == this.syncAttempts &&
          other.nextAttemptAt == this.nextAttemptAt &&
          other.lastAttemptAt == this.lastAttemptAt &&
          other.lastSyncError == this.lastSyncError &&
          other.resultStatus == this.resultStatus &&
          other.resultCode == this.resultCode &&
          other.resultMessage == this.resultMessage &&
          other.officialId == this.officialId &&
          other.flags == this.flags &&
          other.serverReceivedAt == this.serverReceivedAt &&
          other.processedAt == this.processedAt &&
          other.createdAt == this.createdAt);
}

class OutboxEventsCompanion extends UpdateCompanion<OutboxEvent> {
  final Value<String> eventId;
  final Value<String> kind;
  final Value<String?> attendanceMethod;
  final Value<String> gymId;
  final Value<String?> branchId;
  final Value<String> memberId;
  final Value<String?> classSessionId;
  final Value<String?> studioId;
  final Value<String?> serviceAssignmentId;
  final Value<String?> trainerId;
  final Value<String> deviceRecordedAt;
  final Value<int> deviceRecordedAtMs;
  final Value<String> deviceTimezone;
  final Value<String?> qrRaw;
  final Value<String?> note;
  final Value<String> metadata;
  final Value<String> actorUserId;
  final Value<String> actorType;
  final Value<String> deviceId;
  final Value<String> syncStatus;
  final Value<int> syncAttempts;
  final Value<int?> nextAttemptAt;
  final Value<int?> lastAttemptAt;
  final Value<String?> lastSyncError;
  final Value<String?> resultStatus;
  final Value<String?> resultCode;
  final Value<String?> resultMessage;
  final Value<String?> officialId;
  final Value<String> flags;
  final Value<String?> serverReceivedAt;
  final Value<String?> processedAt;
  final Value<int> createdAt;
  final Value<int> rowid;
  const OutboxEventsCompanion({
    this.eventId = const Value.absent(),
    this.kind = const Value.absent(),
    this.attendanceMethod = const Value.absent(),
    this.gymId = const Value.absent(),
    this.branchId = const Value.absent(),
    this.memberId = const Value.absent(),
    this.classSessionId = const Value.absent(),
    this.studioId = const Value.absent(),
    this.serviceAssignmentId = const Value.absent(),
    this.trainerId = const Value.absent(),
    this.deviceRecordedAt = const Value.absent(),
    this.deviceRecordedAtMs = const Value.absent(),
    this.deviceTimezone = const Value.absent(),
    this.qrRaw = const Value.absent(),
    this.note = const Value.absent(),
    this.metadata = const Value.absent(),
    this.actorUserId = const Value.absent(),
    this.actorType = const Value.absent(),
    this.deviceId = const Value.absent(),
    this.syncStatus = const Value.absent(),
    this.syncAttempts = const Value.absent(),
    this.nextAttemptAt = const Value.absent(),
    this.lastAttemptAt = const Value.absent(),
    this.lastSyncError = const Value.absent(),
    this.resultStatus = const Value.absent(),
    this.resultCode = const Value.absent(),
    this.resultMessage = const Value.absent(),
    this.officialId = const Value.absent(),
    this.flags = const Value.absent(),
    this.serverReceivedAt = const Value.absent(),
    this.processedAt = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  OutboxEventsCompanion.insert({
    required String eventId,
    required String kind,
    this.attendanceMethod = const Value.absent(),
    required String gymId,
    this.branchId = const Value.absent(),
    required String memberId,
    this.classSessionId = const Value.absent(),
    this.studioId = const Value.absent(),
    this.serviceAssignmentId = const Value.absent(),
    this.trainerId = const Value.absent(),
    required String deviceRecordedAt,
    required int deviceRecordedAtMs,
    required String deviceTimezone,
    this.qrRaw = const Value.absent(),
    this.note = const Value.absent(),
    this.metadata = const Value.absent(),
    required String actorUserId,
    required String actorType,
    required String deviceId,
    this.syncStatus = const Value.absent(),
    this.syncAttempts = const Value.absent(),
    this.nextAttemptAt = const Value.absent(),
    this.lastAttemptAt = const Value.absent(),
    this.lastSyncError = const Value.absent(),
    this.resultStatus = const Value.absent(),
    this.resultCode = const Value.absent(),
    this.resultMessage = const Value.absent(),
    this.officialId = const Value.absent(),
    this.flags = const Value.absent(),
    this.serverReceivedAt = const Value.absent(),
    this.processedAt = const Value.absent(),
    required int createdAt,
    this.rowid = const Value.absent(),
  }) : eventId = Value(eventId),
       kind = Value(kind),
       gymId = Value(gymId),
       memberId = Value(memberId),
       deviceRecordedAt = Value(deviceRecordedAt),
       deviceRecordedAtMs = Value(deviceRecordedAtMs),
       deviceTimezone = Value(deviceTimezone),
       actorUserId = Value(actorUserId),
       actorType = Value(actorType),
       deviceId = Value(deviceId),
       createdAt = Value(createdAt);
  static Insertable<OutboxEvent> custom({
    Expression<String>? eventId,
    Expression<String>? kind,
    Expression<String>? attendanceMethod,
    Expression<String>? gymId,
    Expression<String>? branchId,
    Expression<String>? memberId,
    Expression<String>? classSessionId,
    Expression<String>? studioId,
    Expression<String>? serviceAssignmentId,
    Expression<String>? trainerId,
    Expression<String>? deviceRecordedAt,
    Expression<int>? deviceRecordedAtMs,
    Expression<String>? deviceTimezone,
    Expression<String>? qrRaw,
    Expression<String>? note,
    Expression<String>? metadata,
    Expression<String>? actorUserId,
    Expression<String>? actorType,
    Expression<String>? deviceId,
    Expression<String>? syncStatus,
    Expression<int>? syncAttempts,
    Expression<int>? nextAttemptAt,
    Expression<int>? lastAttemptAt,
    Expression<String>? lastSyncError,
    Expression<String>? resultStatus,
    Expression<String>? resultCode,
    Expression<String>? resultMessage,
    Expression<String>? officialId,
    Expression<String>? flags,
    Expression<String>? serverReceivedAt,
    Expression<String>? processedAt,
    Expression<int>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (eventId != null) 'event_id': eventId,
      if (kind != null) 'kind': kind,
      if (attendanceMethod != null) 'attendance_method': attendanceMethod,
      if (gymId != null) 'gym_id': gymId,
      if (branchId != null) 'branch_id': branchId,
      if (memberId != null) 'member_id': memberId,
      if (classSessionId != null) 'class_session_id': classSessionId,
      if (studioId != null) 'studio_id': studioId,
      if (serviceAssignmentId != null)
        'service_assignment_id': serviceAssignmentId,
      if (trainerId != null) 'trainer_id': trainerId,
      if (deviceRecordedAt != null) 'device_recorded_at': deviceRecordedAt,
      if (deviceRecordedAtMs != null)
        'device_recorded_at_ms': deviceRecordedAtMs,
      if (deviceTimezone != null) 'device_timezone': deviceTimezone,
      if (qrRaw != null) 'qr_raw': qrRaw,
      if (note != null) 'note': note,
      if (metadata != null) 'metadata': metadata,
      if (actorUserId != null) 'actor_user_id': actorUserId,
      if (actorType != null) 'actor_type': actorType,
      if (deviceId != null) 'device_id': deviceId,
      if (syncStatus != null) 'sync_status': syncStatus,
      if (syncAttempts != null) 'sync_attempts': syncAttempts,
      if (nextAttemptAt != null) 'next_attempt_at': nextAttemptAt,
      if (lastAttemptAt != null) 'last_attempt_at': lastAttemptAt,
      if (lastSyncError != null) 'last_sync_error': lastSyncError,
      if (resultStatus != null) 'result_status': resultStatus,
      if (resultCode != null) 'result_code': resultCode,
      if (resultMessage != null) 'result_message': resultMessage,
      if (officialId != null) 'official_id': officialId,
      if (flags != null) 'flags': flags,
      if (serverReceivedAt != null) 'server_received_at': serverReceivedAt,
      if (processedAt != null) 'processed_at': processedAt,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  OutboxEventsCompanion copyWith({
    Value<String>? eventId,
    Value<String>? kind,
    Value<String?>? attendanceMethod,
    Value<String>? gymId,
    Value<String?>? branchId,
    Value<String>? memberId,
    Value<String?>? classSessionId,
    Value<String?>? studioId,
    Value<String?>? serviceAssignmentId,
    Value<String?>? trainerId,
    Value<String>? deviceRecordedAt,
    Value<int>? deviceRecordedAtMs,
    Value<String>? deviceTimezone,
    Value<String?>? qrRaw,
    Value<String?>? note,
    Value<String>? metadata,
    Value<String>? actorUserId,
    Value<String>? actorType,
    Value<String>? deviceId,
    Value<String>? syncStatus,
    Value<int>? syncAttempts,
    Value<int?>? nextAttemptAt,
    Value<int?>? lastAttemptAt,
    Value<String?>? lastSyncError,
    Value<String?>? resultStatus,
    Value<String?>? resultCode,
    Value<String?>? resultMessage,
    Value<String?>? officialId,
    Value<String>? flags,
    Value<String?>? serverReceivedAt,
    Value<String?>? processedAt,
    Value<int>? createdAt,
    Value<int>? rowid,
  }) {
    return OutboxEventsCompanion(
      eventId: eventId ?? this.eventId,
      kind: kind ?? this.kind,
      attendanceMethod: attendanceMethod ?? this.attendanceMethod,
      gymId: gymId ?? this.gymId,
      branchId: branchId ?? this.branchId,
      memberId: memberId ?? this.memberId,
      classSessionId: classSessionId ?? this.classSessionId,
      studioId: studioId ?? this.studioId,
      serviceAssignmentId: serviceAssignmentId ?? this.serviceAssignmentId,
      trainerId: trainerId ?? this.trainerId,
      deviceRecordedAt: deviceRecordedAt ?? this.deviceRecordedAt,
      deviceRecordedAtMs: deviceRecordedAtMs ?? this.deviceRecordedAtMs,
      deviceTimezone: deviceTimezone ?? this.deviceTimezone,
      qrRaw: qrRaw ?? this.qrRaw,
      note: note ?? this.note,
      metadata: metadata ?? this.metadata,
      actorUserId: actorUserId ?? this.actorUserId,
      actorType: actorType ?? this.actorType,
      deviceId: deviceId ?? this.deviceId,
      syncStatus: syncStatus ?? this.syncStatus,
      syncAttempts: syncAttempts ?? this.syncAttempts,
      nextAttemptAt: nextAttemptAt ?? this.nextAttemptAt,
      lastAttemptAt: lastAttemptAt ?? this.lastAttemptAt,
      lastSyncError: lastSyncError ?? this.lastSyncError,
      resultStatus: resultStatus ?? this.resultStatus,
      resultCode: resultCode ?? this.resultCode,
      resultMessage: resultMessage ?? this.resultMessage,
      officialId: officialId ?? this.officialId,
      flags: flags ?? this.flags,
      serverReceivedAt: serverReceivedAt ?? this.serverReceivedAt,
      processedAt: processedAt ?? this.processedAt,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (eventId.present) {
      map['event_id'] = Variable<String>(eventId.value);
    }
    if (kind.present) {
      map['kind'] = Variable<String>(kind.value);
    }
    if (attendanceMethod.present) {
      map['attendance_method'] = Variable<String>(attendanceMethod.value);
    }
    if (gymId.present) {
      map['gym_id'] = Variable<String>(gymId.value);
    }
    if (branchId.present) {
      map['branch_id'] = Variable<String>(branchId.value);
    }
    if (memberId.present) {
      map['member_id'] = Variable<String>(memberId.value);
    }
    if (classSessionId.present) {
      map['class_session_id'] = Variable<String>(classSessionId.value);
    }
    if (studioId.present) {
      map['studio_id'] = Variable<String>(studioId.value);
    }
    if (serviceAssignmentId.present) {
      map['service_assignment_id'] = Variable<String>(
        serviceAssignmentId.value,
      );
    }
    if (trainerId.present) {
      map['trainer_id'] = Variable<String>(trainerId.value);
    }
    if (deviceRecordedAt.present) {
      map['device_recorded_at'] = Variable<String>(deviceRecordedAt.value);
    }
    if (deviceRecordedAtMs.present) {
      map['device_recorded_at_ms'] = Variable<int>(deviceRecordedAtMs.value);
    }
    if (deviceTimezone.present) {
      map['device_timezone'] = Variable<String>(deviceTimezone.value);
    }
    if (qrRaw.present) {
      map['qr_raw'] = Variable<String>(qrRaw.value);
    }
    if (note.present) {
      map['note'] = Variable<String>(note.value);
    }
    if (metadata.present) {
      map['metadata'] = Variable<String>(metadata.value);
    }
    if (actorUserId.present) {
      map['actor_user_id'] = Variable<String>(actorUserId.value);
    }
    if (actorType.present) {
      map['actor_type'] = Variable<String>(actorType.value);
    }
    if (deviceId.present) {
      map['device_id'] = Variable<String>(deviceId.value);
    }
    if (syncStatus.present) {
      map['sync_status'] = Variable<String>(syncStatus.value);
    }
    if (syncAttempts.present) {
      map['sync_attempts'] = Variable<int>(syncAttempts.value);
    }
    if (nextAttemptAt.present) {
      map['next_attempt_at'] = Variable<int>(nextAttemptAt.value);
    }
    if (lastAttemptAt.present) {
      map['last_attempt_at'] = Variable<int>(lastAttemptAt.value);
    }
    if (lastSyncError.present) {
      map['last_sync_error'] = Variable<String>(lastSyncError.value);
    }
    if (resultStatus.present) {
      map['result_status'] = Variable<String>(resultStatus.value);
    }
    if (resultCode.present) {
      map['result_code'] = Variable<String>(resultCode.value);
    }
    if (resultMessage.present) {
      map['result_message'] = Variable<String>(resultMessage.value);
    }
    if (officialId.present) {
      map['official_id'] = Variable<String>(officialId.value);
    }
    if (flags.present) {
      map['flags'] = Variable<String>(flags.value);
    }
    if (serverReceivedAt.present) {
      map['server_received_at'] = Variable<String>(serverReceivedAt.value);
    }
    if (processedAt.present) {
      map['processed_at'] = Variable<String>(processedAt.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<int>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('OutboxEventsCompanion(')
          ..write('eventId: $eventId, ')
          ..write('kind: $kind, ')
          ..write('attendanceMethod: $attendanceMethod, ')
          ..write('gymId: $gymId, ')
          ..write('branchId: $branchId, ')
          ..write('memberId: $memberId, ')
          ..write('classSessionId: $classSessionId, ')
          ..write('studioId: $studioId, ')
          ..write('serviceAssignmentId: $serviceAssignmentId, ')
          ..write('trainerId: $trainerId, ')
          ..write('deviceRecordedAt: $deviceRecordedAt, ')
          ..write('deviceRecordedAtMs: $deviceRecordedAtMs, ')
          ..write('deviceTimezone: $deviceTimezone, ')
          ..write('qrRaw: $qrRaw, ')
          ..write('note: $note, ')
          ..write('metadata: $metadata, ')
          ..write('actorUserId: $actorUserId, ')
          ..write('actorType: $actorType, ')
          ..write('deviceId: $deviceId, ')
          ..write('syncStatus: $syncStatus, ')
          ..write('syncAttempts: $syncAttempts, ')
          ..write('nextAttemptAt: $nextAttemptAt, ')
          ..write('lastAttemptAt: $lastAttemptAt, ')
          ..write('lastSyncError: $lastSyncError, ')
          ..write('resultStatus: $resultStatus, ')
          ..write('resultCode: $resultCode, ')
          ..write('resultMessage: $resultMessage, ')
          ..write('officialId: $officialId, ')
          ..write('flags: $flags, ')
          ..write('serverReceivedAt: $serverReceivedAt, ')
          ..write('processedAt: $processedAt, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CachedMembersTable extends CachedMembers
    with TableInfo<$CachedMembersTable, CachedMember> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedMembersTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _gymMemberIdMeta = const VerificationMeta(
    'gymMemberId',
  );
  @override
  late final GeneratedColumn<String> gymMemberId = GeneratedColumn<String>(
    'gym_member_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _memberNumberMeta = const VerificationMeta(
    'memberNumber',
  );
  @override
  late final GeneratedColumn<String> memberNumber = GeneratedColumn<String>(
    'member_number',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _fullNameMeta = const VerificationMeta(
    'fullName',
  );
  @override
  late final GeneratedColumn<String> fullName = GeneratedColumn<String>(
    'full_name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _searchTextMeta = const VerificationMeta(
    'searchText',
  );
  @override
  late final GeneratedColumn<String> searchText = GeneratedColumn<String>(
    'search_text',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _phoneLast4Meta = const VerificationMeta(
    'phoneLast4',
  );
  @override
  late final GeneratedColumn<String> phoneLast4 = GeneratedColumn<String>(
    'phone_last4',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _photoUrlMeta = const VerificationMeta(
    'photoUrl',
  );
  @override
  late final GeneratedColumn<String> photoUrl = GeneratedColumn<String>(
    'photo_url',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    gymMemberId,
    memberNumber,
    fullName,
    searchText,
    phoneLast4,
    photoUrl,
    status,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_members';
  @override
  VerificationContext validateIntegrity(
    Insertable<CachedMember> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('gym_member_id')) {
      context.handle(
        _gymMemberIdMeta,
        gymMemberId.isAcceptableOrUnknown(
          data['gym_member_id']!,
          _gymMemberIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_gymMemberIdMeta);
    }
    if (data.containsKey('member_number')) {
      context.handle(
        _memberNumberMeta,
        memberNumber.isAcceptableOrUnknown(
          data['member_number']!,
          _memberNumberMeta,
        ),
      );
    }
    if (data.containsKey('full_name')) {
      context.handle(
        _fullNameMeta,
        fullName.isAcceptableOrUnknown(data['full_name']!, _fullNameMeta),
      );
    } else if (isInserting) {
      context.missing(_fullNameMeta);
    }
    if (data.containsKey('search_text')) {
      context.handle(
        _searchTextMeta,
        searchText.isAcceptableOrUnknown(data['search_text']!, _searchTextMeta),
      );
    } else if (isInserting) {
      context.missing(_searchTextMeta);
    }
    if (data.containsKey('phone_last4')) {
      context.handle(
        _phoneLast4Meta,
        phoneLast4.isAcceptableOrUnknown(data['phone_last4']!, _phoneLast4Meta),
      );
    }
    if (data.containsKey('photo_url')) {
      context.handle(
        _photoUrlMeta,
        photoUrl.isAcceptableOrUnknown(data['photo_url']!, _photoUrlMeta),
      );
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {gymMemberId};
  @override
  CachedMember map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedMember(
      gymMemberId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}gym_member_id'],
      )!,
      memberNumber: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}member_number'],
      ),
      fullName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}full_name'],
      )!,
      searchText: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}search_text'],
      )!,
      phoneLast4: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}phone_last4'],
      ),
      photoUrl: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}photo_url'],
      ),
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      ),
    );
  }

  @override
  $CachedMembersTable createAlias(String alias) {
    return $CachedMembersTable(attachedDatabase, alias);
  }
}

class CachedMember extends DataClass implements Insertable<CachedMember> {
  final String gymMemberId;
  final String? memberNumber;
  final String fullName;

  /// Lower-cased name + member number, for local search.
  final String searchText;
  final String? phoneLast4;
  final String? photoUrl;
  final String? status;
  const CachedMember({
    required this.gymMemberId,
    this.memberNumber,
    required this.fullName,
    required this.searchText,
    this.phoneLast4,
    this.photoUrl,
    this.status,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['gym_member_id'] = Variable<String>(gymMemberId);
    if (!nullToAbsent || memberNumber != null) {
      map['member_number'] = Variable<String>(memberNumber);
    }
    map['full_name'] = Variable<String>(fullName);
    map['search_text'] = Variable<String>(searchText);
    if (!nullToAbsent || phoneLast4 != null) {
      map['phone_last4'] = Variable<String>(phoneLast4);
    }
    if (!nullToAbsent || photoUrl != null) {
      map['photo_url'] = Variable<String>(photoUrl);
    }
    if (!nullToAbsent || status != null) {
      map['status'] = Variable<String>(status);
    }
    return map;
  }

  CachedMembersCompanion toCompanion(bool nullToAbsent) {
    return CachedMembersCompanion(
      gymMemberId: Value(gymMemberId),
      memberNumber: memberNumber == null && nullToAbsent
          ? const Value.absent()
          : Value(memberNumber),
      fullName: Value(fullName),
      searchText: Value(searchText),
      phoneLast4: phoneLast4 == null && nullToAbsent
          ? const Value.absent()
          : Value(phoneLast4),
      photoUrl: photoUrl == null && nullToAbsent
          ? const Value.absent()
          : Value(photoUrl),
      status: status == null && nullToAbsent
          ? const Value.absent()
          : Value(status),
    );
  }

  factory CachedMember.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedMember(
      gymMemberId: serializer.fromJson<String>(json['gymMemberId']),
      memberNumber: serializer.fromJson<String?>(json['memberNumber']),
      fullName: serializer.fromJson<String>(json['fullName']),
      searchText: serializer.fromJson<String>(json['searchText']),
      phoneLast4: serializer.fromJson<String?>(json['phoneLast4']),
      photoUrl: serializer.fromJson<String?>(json['photoUrl']),
      status: serializer.fromJson<String?>(json['status']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'gymMemberId': serializer.toJson<String>(gymMemberId),
      'memberNumber': serializer.toJson<String?>(memberNumber),
      'fullName': serializer.toJson<String>(fullName),
      'searchText': serializer.toJson<String>(searchText),
      'phoneLast4': serializer.toJson<String?>(phoneLast4),
      'photoUrl': serializer.toJson<String?>(photoUrl),
      'status': serializer.toJson<String?>(status),
    };
  }

  CachedMember copyWith({
    String? gymMemberId,
    Value<String?> memberNumber = const Value.absent(),
    String? fullName,
    String? searchText,
    Value<String?> phoneLast4 = const Value.absent(),
    Value<String?> photoUrl = const Value.absent(),
    Value<String?> status = const Value.absent(),
  }) => CachedMember(
    gymMemberId: gymMemberId ?? this.gymMemberId,
    memberNumber: memberNumber.present ? memberNumber.value : this.memberNumber,
    fullName: fullName ?? this.fullName,
    searchText: searchText ?? this.searchText,
    phoneLast4: phoneLast4.present ? phoneLast4.value : this.phoneLast4,
    photoUrl: photoUrl.present ? photoUrl.value : this.photoUrl,
    status: status.present ? status.value : this.status,
  );
  CachedMember copyWithCompanion(CachedMembersCompanion data) {
    return CachedMember(
      gymMemberId: data.gymMemberId.present
          ? data.gymMemberId.value
          : this.gymMemberId,
      memberNumber: data.memberNumber.present
          ? data.memberNumber.value
          : this.memberNumber,
      fullName: data.fullName.present ? data.fullName.value : this.fullName,
      searchText: data.searchText.present
          ? data.searchText.value
          : this.searchText,
      phoneLast4: data.phoneLast4.present
          ? data.phoneLast4.value
          : this.phoneLast4,
      photoUrl: data.photoUrl.present ? data.photoUrl.value : this.photoUrl,
      status: data.status.present ? data.status.value : this.status,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedMember(')
          ..write('gymMemberId: $gymMemberId, ')
          ..write('memberNumber: $memberNumber, ')
          ..write('fullName: $fullName, ')
          ..write('searchText: $searchText, ')
          ..write('phoneLast4: $phoneLast4, ')
          ..write('photoUrl: $photoUrl, ')
          ..write('status: $status')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    gymMemberId,
    memberNumber,
    fullName,
    searchText,
    phoneLast4,
    photoUrl,
    status,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedMember &&
          other.gymMemberId == this.gymMemberId &&
          other.memberNumber == this.memberNumber &&
          other.fullName == this.fullName &&
          other.searchText == this.searchText &&
          other.phoneLast4 == this.phoneLast4 &&
          other.photoUrl == this.photoUrl &&
          other.status == this.status);
}

class CachedMembersCompanion extends UpdateCompanion<CachedMember> {
  final Value<String> gymMemberId;
  final Value<String?> memberNumber;
  final Value<String> fullName;
  final Value<String> searchText;
  final Value<String?> phoneLast4;
  final Value<String?> photoUrl;
  final Value<String?> status;
  final Value<int> rowid;
  const CachedMembersCompanion({
    this.gymMemberId = const Value.absent(),
    this.memberNumber = const Value.absent(),
    this.fullName = const Value.absent(),
    this.searchText = const Value.absent(),
    this.phoneLast4 = const Value.absent(),
    this.photoUrl = const Value.absent(),
    this.status = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedMembersCompanion.insert({
    required String gymMemberId,
    this.memberNumber = const Value.absent(),
    required String fullName,
    required String searchText,
    this.phoneLast4 = const Value.absent(),
    this.photoUrl = const Value.absent(),
    this.status = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : gymMemberId = Value(gymMemberId),
       fullName = Value(fullName),
       searchText = Value(searchText);
  static Insertable<CachedMember> custom({
    Expression<String>? gymMemberId,
    Expression<String>? memberNumber,
    Expression<String>? fullName,
    Expression<String>? searchText,
    Expression<String>? phoneLast4,
    Expression<String>? photoUrl,
    Expression<String>? status,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (gymMemberId != null) 'gym_member_id': gymMemberId,
      if (memberNumber != null) 'member_number': memberNumber,
      if (fullName != null) 'full_name': fullName,
      if (searchText != null) 'search_text': searchText,
      if (phoneLast4 != null) 'phone_last4': phoneLast4,
      if (photoUrl != null) 'photo_url': photoUrl,
      if (status != null) 'status': status,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedMembersCompanion copyWith({
    Value<String>? gymMemberId,
    Value<String?>? memberNumber,
    Value<String>? fullName,
    Value<String>? searchText,
    Value<String?>? phoneLast4,
    Value<String?>? photoUrl,
    Value<String?>? status,
    Value<int>? rowid,
  }) {
    return CachedMembersCompanion(
      gymMemberId: gymMemberId ?? this.gymMemberId,
      memberNumber: memberNumber ?? this.memberNumber,
      fullName: fullName ?? this.fullName,
      searchText: searchText ?? this.searchText,
      phoneLast4: phoneLast4 ?? this.phoneLast4,
      photoUrl: photoUrl ?? this.photoUrl,
      status: status ?? this.status,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (gymMemberId.present) {
      map['gym_member_id'] = Variable<String>(gymMemberId.value);
    }
    if (memberNumber.present) {
      map['member_number'] = Variable<String>(memberNumber.value);
    }
    if (fullName.present) {
      map['full_name'] = Variable<String>(fullName.value);
    }
    if (searchText.present) {
      map['search_text'] = Variable<String>(searchText.value);
    }
    if (phoneLast4.present) {
      map['phone_last4'] = Variable<String>(phoneLast4.value);
    }
    if (photoUrl.present) {
      map['photo_url'] = Variable<String>(photoUrl.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedMembersCompanion(')
          ..write('gymMemberId: $gymMemberId, ')
          ..write('memberNumber: $memberNumber, ')
          ..write('fullName: $fullName, ')
          ..write('searchText: $searchText, ')
          ..write('phoneLast4: $phoneLast4, ')
          ..write('photoUrl: $photoUrl, ')
          ..write('status: $status, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CachedMembershipsTable extends CachedMemberships
    with TableInfo<$CachedMembershipsTable, CachedMembership> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedMembershipsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _membershipIdMeta = const VerificationMeta(
    'membershipId',
  );
  @override
  late final GeneratedColumn<String> membershipId = GeneratedColumn<String>(
    'membership_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _gymMemberIdMeta = const VerificationMeta(
    'gymMemberId',
  );
  @override
  late final GeneratedColumn<String> gymMemberId = GeneratedColumn<String>(
    'gym_member_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _planTypeMeta = const VerificationMeta(
    'planType',
  );
  @override
  late final GeneratedColumn<String> planType = GeneratedColumn<String>(
    'plan_type',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _sourceTypeMeta = const VerificationMeta(
    'sourceType',
  );
  @override
  late final GeneratedColumn<String> sourceType = GeneratedColumn<String>(
    'source_type',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _paymentStatusMeta = const VerificationMeta(
    'paymentStatus',
  );
  @override
  late final GeneratedColumn<String> paymentStatus = GeneratedColumn<String>(
    'payment_status',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _startDateMeta = const VerificationMeta(
    'startDate',
  );
  @override
  late final GeneratedColumn<String> startDate = GeneratedColumn<String>(
    'start_date',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _endDateMeta = const VerificationMeta(
    'endDate',
  );
  @override
  late final GeneratedColumn<String> endDate = GeneratedColumn<String>(
    'end_date',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _sessionsRemainingMeta = const VerificationMeta(
    'sessionsRemaining',
  );
  @override
  late final GeneratedColumn<int> sessionsRemaining = GeneratedColumn<int>(
    'sessions_remaining',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _sessionsTotalMeta = const VerificationMeta(
    'sessionsTotal',
  );
  @override
  late final GeneratedColumn<int> sessionsTotal = GeneratedColumn<int>(
    'sessions_total',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _freezeStatusMeta = const VerificationMeta(
    'freezeStatus',
  );
  @override
  late final GeneratedColumn<String> freezeStatus = GeneratedColumn<String>(
    'freeze_status',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _allowedBranchIdsMeta = const VerificationMeta(
    'allowedBranchIds',
  );
  @override
  late final GeneratedColumn<String> allowedBranchIds = GeneratedColumn<String>(
    'allowed_branch_ids',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    membershipId,
    gymMemberId,
    planType,
    sourceType,
    status,
    paymentStatus,
    startDate,
    endDate,
    sessionsRemaining,
    sessionsTotal,
    freezeStatus,
    allowedBranchIds,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_memberships';
  @override
  VerificationContext validateIntegrity(
    Insertable<CachedMembership> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('membership_id')) {
      context.handle(
        _membershipIdMeta,
        membershipId.isAcceptableOrUnknown(
          data['membership_id']!,
          _membershipIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_membershipIdMeta);
    }
    if (data.containsKey('gym_member_id')) {
      context.handle(
        _gymMemberIdMeta,
        gymMemberId.isAcceptableOrUnknown(
          data['gym_member_id']!,
          _gymMemberIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_gymMemberIdMeta);
    }
    if (data.containsKey('plan_type')) {
      context.handle(
        _planTypeMeta,
        planType.isAcceptableOrUnknown(data['plan_type']!, _planTypeMeta),
      );
    }
    if (data.containsKey('source_type')) {
      context.handle(
        _sourceTypeMeta,
        sourceType.isAcceptableOrUnknown(data['source_type']!, _sourceTypeMeta),
      );
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    }
    if (data.containsKey('payment_status')) {
      context.handle(
        _paymentStatusMeta,
        paymentStatus.isAcceptableOrUnknown(
          data['payment_status']!,
          _paymentStatusMeta,
        ),
      );
    }
    if (data.containsKey('start_date')) {
      context.handle(
        _startDateMeta,
        startDate.isAcceptableOrUnknown(data['start_date']!, _startDateMeta),
      );
    }
    if (data.containsKey('end_date')) {
      context.handle(
        _endDateMeta,
        endDate.isAcceptableOrUnknown(data['end_date']!, _endDateMeta),
      );
    }
    if (data.containsKey('sessions_remaining')) {
      context.handle(
        _sessionsRemainingMeta,
        sessionsRemaining.isAcceptableOrUnknown(
          data['sessions_remaining']!,
          _sessionsRemainingMeta,
        ),
      );
    }
    if (data.containsKey('sessions_total')) {
      context.handle(
        _sessionsTotalMeta,
        sessionsTotal.isAcceptableOrUnknown(
          data['sessions_total']!,
          _sessionsTotalMeta,
        ),
      );
    }
    if (data.containsKey('freeze_status')) {
      context.handle(
        _freezeStatusMeta,
        freezeStatus.isAcceptableOrUnknown(
          data['freeze_status']!,
          _freezeStatusMeta,
        ),
      );
    }
    if (data.containsKey('allowed_branch_ids')) {
      context.handle(
        _allowedBranchIdsMeta,
        allowedBranchIds.isAcceptableOrUnknown(
          data['allowed_branch_ids']!,
          _allowedBranchIdsMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {gymMemberId, membershipId};
  @override
  CachedMembership map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedMembership(
      membershipId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}membership_id'],
      )!,
      gymMemberId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}gym_member_id'],
      )!,
      planType: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}plan_type'],
      ),
      sourceType: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}source_type'],
      ),
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      ),
      paymentStatus: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payment_status'],
      ),
      startDate: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}start_date'],
      ),
      endDate: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}end_date'],
      ),
      sessionsRemaining: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}sessions_remaining'],
      ),
      sessionsTotal: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}sessions_total'],
      ),
      freezeStatus: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}freeze_status'],
      ),
      allowedBranchIds: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}allowed_branch_ids'],
      ),
    );
  }

  @override
  $CachedMembershipsTable createAlias(String alias) {
    return $CachedMembershipsTable(attachedDatabase, alias);
  }
}

class CachedMembership extends DataClass
    implements Insertable<CachedMembership> {
  final String membershipId;
  final String gymMemberId;
  final String? planType;
  final String? sourceType;
  final String? status;
  final String? paymentStatus;
  final String? startDate;
  final String? endDate;
  final int? sessionsRemaining;
  final int? sessionsTotal;
  final String? freezeStatus;

  /// JSON array, or NULL = all branches.
  final String? allowedBranchIds;
  const CachedMembership({
    required this.membershipId,
    required this.gymMemberId,
    this.planType,
    this.sourceType,
    this.status,
    this.paymentStatus,
    this.startDate,
    this.endDate,
    this.sessionsRemaining,
    this.sessionsTotal,
    this.freezeStatus,
    this.allowedBranchIds,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['membership_id'] = Variable<String>(membershipId);
    map['gym_member_id'] = Variable<String>(gymMemberId);
    if (!nullToAbsent || planType != null) {
      map['plan_type'] = Variable<String>(planType);
    }
    if (!nullToAbsent || sourceType != null) {
      map['source_type'] = Variable<String>(sourceType);
    }
    if (!nullToAbsent || status != null) {
      map['status'] = Variable<String>(status);
    }
    if (!nullToAbsent || paymentStatus != null) {
      map['payment_status'] = Variable<String>(paymentStatus);
    }
    if (!nullToAbsent || startDate != null) {
      map['start_date'] = Variable<String>(startDate);
    }
    if (!nullToAbsent || endDate != null) {
      map['end_date'] = Variable<String>(endDate);
    }
    if (!nullToAbsent || sessionsRemaining != null) {
      map['sessions_remaining'] = Variable<int>(sessionsRemaining);
    }
    if (!nullToAbsent || sessionsTotal != null) {
      map['sessions_total'] = Variable<int>(sessionsTotal);
    }
    if (!nullToAbsent || freezeStatus != null) {
      map['freeze_status'] = Variable<String>(freezeStatus);
    }
    if (!nullToAbsent || allowedBranchIds != null) {
      map['allowed_branch_ids'] = Variable<String>(allowedBranchIds);
    }
    return map;
  }

  CachedMembershipsCompanion toCompanion(bool nullToAbsent) {
    return CachedMembershipsCompanion(
      membershipId: Value(membershipId),
      gymMemberId: Value(gymMemberId),
      planType: planType == null && nullToAbsent
          ? const Value.absent()
          : Value(planType),
      sourceType: sourceType == null && nullToAbsent
          ? const Value.absent()
          : Value(sourceType),
      status: status == null && nullToAbsent
          ? const Value.absent()
          : Value(status),
      paymentStatus: paymentStatus == null && nullToAbsent
          ? const Value.absent()
          : Value(paymentStatus),
      startDate: startDate == null && nullToAbsent
          ? const Value.absent()
          : Value(startDate),
      endDate: endDate == null && nullToAbsent
          ? const Value.absent()
          : Value(endDate),
      sessionsRemaining: sessionsRemaining == null && nullToAbsent
          ? const Value.absent()
          : Value(sessionsRemaining),
      sessionsTotal: sessionsTotal == null && nullToAbsent
          ? const Value.absent()
          : Value(sessionsTotal),
      freezeStatus: freezeStatus == null && nullToAbsent
          ? const Value.absent()
          : Value(freezeStatus),
      allowedBranchIds: allowedBranchIds == null && nullToAbsent
          ? const Value.absent()
          : Value(allowedBranchIds),
    );
  }

  factory CachedMembership.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedMembership(
      membershipId: serializer.fromJson<String>(json['membershipId']),
      gymMemberId: serializer.fromJson<String>(json['gymMemberId']),
      planType: serializer.fromJson<String?>(json['planType']),
      sourceType: serializer.fromJson<String?>(json['sourceType']),
      status: serializer.fromJson<String?>(json['status']),
      paymentStatus: serializer.fromJson<String?>(json['paymentStatus']),
      startDate: serializer.fromJson<String?>(json['startDate']),
      endDate: serializer.fromJson<String?>(json['endDate']),
      sessionsRemaining: serializer.fromJson<int?>(json['sessionsRemaining']),
      sessionsTotal: serializer.fromJson<int?>(json['sessionsTotal']),
      freezeStatus: serializer.fromJson<String?>(json['freezeStatus']),
      allowedBranchIds: serializer.fromJson<String?>(json['allowedBranchIds']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'membershipId': serializer.toJson<String>(membershipId),
      'gymMemberId': serializer.toJson<String>(gymMemberId),
      'planType': serializer.toJson<String?>(planType),
      'sourceType': serializer.toJson<String?>(sourceType),
      'status': serializer.toJson<String?>(status),
      'paymentStatus': serializer.toJson<String?>(paymentStatus),
      'startDate': serializer.toJson<String?>(startDate),
      'endDate': serializer.toJson<String?>(endDate),
      'sessionsRemaining': serializer.toJson<int?>(sessionsRemaining),
      'sessionsTotal': serializer.toJson<int?>(sessionsTotal),
      'freezeStatus': serializer.toJson<String?>(freezeStatus),
      'allowedBranchIds': serializer.toJson<String?>(allowedBranchIds),
    };
  }

  CachedMembership copyWith({
    String? membershipId,
    String? gymMemberId,
    Value<String?> planType = const Value.absent(),
    Value<String?> sourceType = const Value.absent(),
    Value<String?> status = const Value.absent(),
    Value<String?> paymentStatus = const Value.absent(),
    Value<String?> startDate = const Value.absent(),
    Value<String?> endDate = const Value.absent(),
    Value<int?> sessionsRemaining = const Value.absent(),
    Value<int?> sessionsTotal = const Value.absent(),
    Value<String?> freezeStatus = const Value.absent(),
    Value<String?> allowedBranchIds = const Value.absent(),
  }) => CachedMembership(
    membershipId: membershipId ?? this.membershipId,
    gymMemberId: gymMemberId ?? this.gymMemberId,
    planType: planType.present ? planType.value : this.planType,
    sourceType: sourceType.present ? sourceType.value : this.sourceType,
    status: status.present ? status.value : this.status,
    paymentStatus: paymentStatus.present
        ? paymentStatus.value
        : this.paymentStatus,
    startDate: startDate.present ? startDate.value : this.startDate,
    endDate: endDate.present ? endDate.value : this.endDate,
    sessionsRemaining: sessionsRemaining.present
        ? sessionsRemaining.value
        : this.sessionsRemaining,
    sessionsTotal: sessionsTotal.present
        ? sessionsTotal.value
        : this.sessionsTotal,
    freezeStatus: freezeStatus.present ? freezeStatus.value : this.freezeStatus,
    allowedBranchIds: allowedBranchIds.present
        ? allowedBranchIds.value
        : this.allowedBranchIds,
  );
  CachedMembership copyWithCompanion(CachedMembershipsCompanion data) {
    return CachedMembership(
      membershipId: data.membershipId.present
          ? data.membershipId.value
          : this.membershipId,
      gymMemberId: data.gymMemberId.present
          ? data.gymMemberId.value
          : this.gymMemberId,
      planType: data.planType.present ? data.planType.value : this.planType,
      sourceType: data.sourceType.present
          ? data.sourceType.value
          : this.sourceType,
      status: data.status.present ? data.status.value : this.status,
      paymentStatus: data.paymentStatus.present
          ? data.paymentStatus.value
          : this.paymentStatus,
      startDate: data.startDate.present ? data.startDate.value : this.startDate,
      endDate: data.endDate.present ? data.endDate.value : this.endDate,
      sessionsRemaining: data.sessionsRemaining.present
          ? data.sessionsRemaining.value
          : this.sessionsRemaining,
      sessionsTotal: data.sessionsTotal.present
          ? data.sessionsTotal.value
          : this.sessionsTotal,
      freezeStatus: data.freezeStatus.present
          ? data.freezeStatus.value
          : this.freezeStatus,
      allowedBranchIds: data.allowedBranchIds.present
          ? data.allowedBranchIds.value
          : this.allowedBranchIds,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedMembership(')
          ..write('membershipId: $membershipId, ')
          ..write('gymMemberId: $gymMemberId, ')
          ..write('planType: $planType, ')
          ..write('sourceType: $sourceType, ')
          ..write('status: $status, ')
          ..write('paymentStatus: $paymentStatus, ')
          ..write('startDate: $startDate, ')
          ..write('endDate: $endDate, ')
          ..write('sessionsRemaining: $sessionsRemaining, ')
          ..write('sessionsTotal: $sessionsTotal, ')
          ..write('freezeStatus: $freezeStatus, ')
          ..write('allowedBranchIds: $allowedBranchIds')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    membershipId,
    gymMemberId,
    planType,
    sourceType,
    status,
    paymentStatus,
    startDate,
    endDate,
    sessionsRemaining,
    sessionsTotal,
    freezeStatus,
    allowedBranchIds,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedMembership &&
          other.membershipId == this.membershipId &&
          other.gymMemberId == this.gymMemberId &&
          other.planType == this.planType &&
          other.sourceType == this.sourceType &&
          other.status == this.status &&
          other.paymentStatus == this.paymentStatus &&
          other.startDate == this.startDate &&
          other.endDate == this.endDate &&
          other.sessionsRemaining == this.sessionsRemaining &&
          other.sessionsTotal == this.sessionsTotal &&
          other.freezeStatus == this.freezeStatus &&
          other.allowedBranchIds == this.allowedBranchIds);
}

class CachedMembershipsCompanion extends UpdateCompanion<CachedMembership> {
  final Value<String> membershipId;
  final Value<String> gymMemberId;
  final Value<String?> planType;
  final Value<String?> sourceType;
  final Value<String?> status;
  final Value<String?> paymentStatus;
  final Value<String?> startDate;
  final Value<String?> endDate;
  final Value<int?> sessionsRemaining;
  final Value<int?> sessionsTotal;
  final Value<String?> freezeStatus;
  final Value<String?> allowedBranchIds;
  final Value<int> rowid;
  const CachedMembershipsCompanion({
    this.membershipId = const Value.absent(),
    this.gymMemberId = const Value.absent(),
    this.planType = const Value.absent(),
    this.sourceType = const Value.absent(),
    this.status = const Value.absent(),
    this.paymentStatus = const Value.absent(),
    this.startDate = const Value.absent(),
    this.endDate = const Value.absent(),
    this.sessionsRemaining = const Value.absent(),
    this.sessionsTotal = const Value.absent(),
    this.freezeStatus = const Value.absent(),
    this.allowedBranchIds = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedMembershipsCompanion.insert({
    required String membershipId,
    required String gymMemberId,
    this.planType = const Value.absent(),
    this.sourceType = const Value.absent(),
    this.status = const Value.absent(),
    this.paymentStatus = const Value.absent(),
    this.startDate = const Value.absent(),
    this.endDate = const Value.absent(),
    this.sessionsRemaining = const Value.absent(),
    this.sessionsTotal = const Value.absent(),
    this.freezeStatus = const Value.absent(),
    this.allowedBranchIds = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : membershipId = Value(membershipId),
       gymMemberId = Value(gymMemberId);
  static Insertable<CachedMembership> custom({
    Expression<String>? membershipId,
    Expression<String>? gymMemberId,
    Expression<String>? planType,
    Expression<String>? sourceType,
    Expression<String>? status,
    Expression<String>? paymentStatus,
    Expression<String>? startDate,
    Expression<String>? endDate,
    Expression<int>? sessionsRemaining,
    Expression<int>? sessionsTotal,
    Expression<String>? freezeStatus,
    Expression<String>? allowedBranchIds,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (membershipId != null) 'membership_id': membershipId,
      if (gymMemberId != null) 'gym_member_id': gymMemberId,
      if (planType != null) 'plan_type': planType,
      if (sourceType != null) 'source_type': sourceType,
      if (status != null) 'status': status,
      if (paymentStatus != null) 'payment_status': paymentStatus,
      if (startDate != null) 'start_date': startDate,
      if (endDate != null) 'end_date': endDate,
      if (sessionsRemaining != null) 'sessions_remaining': sessionsRemaining,
      if (sessionsTotal != null) 'sessions_total': sessionsTotal,
      if (freezeStatus != null) 'freeze_status': freezeStatus,
      if (allowedBranchIds != null) 'allowed_branch_ids': allowedBranchIds,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedMembershipsCompanion copyWith({
    Value<String>? membershipId,
    Value<String>? gymMemberId,
    Value<String?>? planType,
    Value<String?>? sourceType,
    Value<String?>? status,
    Value<String?>? paymentStatus,
    Value<String?>? startDate,
    Value<String?>? endDate,
    Value<int?>? sessionsRemaining,
    Value<int?>? sessionsTotal,
    Value<String?>? freezeStatus,
    Value<String?>? allowedBranchIds,
    Value<int>? rowid,
  }) {
    return CachedMembershipsCompanion(
      membershipId: membershipId ?? this.membershipId,
      gymMemberId: gymMemberId ?? this.gymMemberId,
      planType: planType ?? this.planType,
      sourceType: sourceType ?? this.sourceType,
      status: status ?? this.status,
      paymentStatus: paymentStatus ?? this.paymentStatus,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      sessionsRemaining: sessionsRemaining ?? this.sessionsRemaining,
      sessionsTotal: sessionsTotal ?? this.sessionsTotal,
      freezeStatus: freezeStatus ?? this.freezeStatus,
      allowedBranchIds: allowedBranchIds ?? this.allowedBranchIds,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (membershipId.present) {
      map['membership_id'] = Variable<String>(membershipId.value);
    }
    if (gymMemberId.present) {
      map['gym_member_id'] = Variable<String>(gymMemberId.value);
    }
    if (planType.present) {
      map['plan_type'] = Variable<String>(planType.value);
    }
    if (sourceType.present) {
      map['source_type'] = Variable<String>(sourceType.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (paymentStatus.present) {
      map['payment_status'] = Variable<String>(paymentStatus.value);
    }
    if (startDate.present) {
      map['start_date'] = Variable<String>(startDate.value);
    }
    if (endDate.present) {
      map['end_date'] = Variable<String>(endDate.value);
    }
    if (sessionsRemaining.present) {
      map['sessions_remaining'] = Variable<int>(sessionsRemaining.value);
    }
    if (sessionsTotal.present) {
      map['sessions_total'] = Variable<int>(sessionsTotal.value);
    }
    if (freezeStatus.present) {
      map['freeze_status'] = Variable<String>(freezeStatus.value);
    }
    if (allowedBranchIds.present) {
      map['allowed_branch_ids'] = Variable<String>(allowedBranchIds.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedMembershipsCompanion(')
          ..write('membershipId: $membershipId, ')
          ..write('gymMemberId: $gymMemberId, ')
          ..write('planType: $planType, ')
          ..write('sourceType: $sourceType, ')
          ..write('status: $status, ')
          ..write('paymentStatus: $paymentStatus, ')
          ..write('startDate: $startDate, ')
          ..write('endDate: $endDate, ')
          ..write('sessionsRemaining: $sessionsRemaining, ')
          ..write('sessionsTotal: $sessionsTotal, ')
          ..write('freezeStatus: $freezeStatus, ')
          ..write('allowedBranchIds: $allowedBranchIds, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CachedBranchesTable extends CachedBranches
    with TableInfo<$CachedBranchesTable, CachedBranch> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedBranchesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _isActiveMeta = const VerificationMeta(
    'isActive',
  );
  @override
  late final GeneratedColumn<bool> isActive = GeneratedColumn<bool>(
    'is_active',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("is_active" IN (0, 1))',
    ),
    defaultValue: const Constant(true),
  );
  static const VerificationMeta _qrTokenMeta = const VerificationMeta(
    'qrToken',
  );
  @override
  late final GeneratedColumn<String> qrToken = GeneratedColumn<String>(
    'qr_token',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [id, name, isActive, qrToken];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_branches';
  @override
  VerificationContext validateIntegrity(
    Insertable<CachedBranch> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
        _nameMeta,
        name.isAcceptableOrUnknown(data['name']!, _nameMeta),
      );
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('is_active')) {
      context.handle(
        _isActiveMeta,
        isActive.isAcceptableOrUnknown(data['is_active']!, _isActiveMeta),
      );
    }
    if (data.containsKey('qr_token')) {
      context.handle(
        _qrTokenMeta,
        qrToken.isAcceptableOrUnknown(data['qr_token']!, _qrTokenMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CachedBranch map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedBranch(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      name: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}name'],
      )!,
      isActive: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}is_active'],
      )!,
      qrToken: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}qr_token'],
      ),
    );
  }

  @override
  $CachedBranchesTable createAlias(String alias) {
    return $CachedBranchesTable(attachedDatabase, alias);
  }
}

class CachedBranch extends DataClass implements Insertable<CachedBranch> {
  final String id;
  final String name;
  final bool isActive;

  /// Current `branches.qr_token` (member snapshot, Phase 3): a v2 branch
  /// QR must carry exactly this token. Added in schema v3.
  final String? qrToken;
  const CachedBranch({
    required this.id,
    required this.name,
    required this.isActive,
    this.qrToken,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['name'] = Variable<String>(name);
    map['is_active'] = Variable<bool>(isActive);
    if (!nullToAbsent || qrToken != null) {
      map['qr_token'] = Variable<String>(qrToken);
    }
    return map;
  }

  CachedBranchesCompanion toCompanion(bool nullToAbsent) {
    return CachedBranchesCompanion(
      id: Value(id),
      name: Value(name),
      isActive: Value(isActive),
      qrToken: qrToken == null && nullToAbsent
          ? const Value.absent()
          : Value(qrToken),
    );
  }

  factory CachedBranch.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedBranch(
      id: serializer.fromJson<String>(json['id']),
      name: serializer.fromJson<String>(json['name']),
      isActive: serializer.fromJson<bool>(json['isActive']),
      qrToken: serializer.fromJson<String?>(json['qrToken']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'name': serializer.toJson<String>(name),
      'isActive': serializer.toJson<bool>(isActive),
      'qrToken': serializer.toJson<String?>(qrToken),
    };
  }

  CachedBranch copyWith({
    String? id,
    String? name,
    bool? isActive,
    Value<String?> qrToken = const Value.absent(),
  }) => CachedBranch(
    id: id ?? this.id,
    name: name ?? this.name,
    isActive: isActive ?? this.isActive,
    qrToken: qrToken.present ? qrToken.value : this.qrToken,
  );
  CachedBranch copyWithCompanion(CachedBranchesCompanion data) {
    return CachedBranch(
      id: data.id.present ? data.id.value : this.id,
      name: data.name.present ? data.name.value : this.name,
      isActive: data.isActive.present ? data.isActive.value : this.isActive,
      qrToken: data.qrToken.present ? data.qrToken.value : this.qrToken,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedBranch(')
          ..write('id: $id, ')
          ..write('name: $name, ')
          ..write('isActive: $isActive, ')
          ..write('qrToken: $qrToken')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, name, isActive, qrToken);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedBranch &&
          other.id == this.id &&
          other.name == this.name &&
          other.isActive == this.isActive &&
          other.qrToken == this.qrToken);
}

class CachedBranchesCompanion extends UpdateCompanion<CachedBranch> {
  final Value<String> id;
  final Value<String> name;
  final Value<bool> isActive;
  final Value<String?> qrToken;
  final Value<int> rowid;
  const CachedBranchesCompanion({
    this.id = const Value.absent(),
    this.name = const Value.absent(),
    this.isActive = const Value.absent(),
    this.qrToken = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedBranchesCompanion.insert({
    required String id,
    required String name,
    this.isActive = const Value.absent(),
    this.qrToken = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       name = Value(name);
  static Insertable<CachedBranch> custom({
    Expression<String>? id,
    Expression<String>? name,
    Expression<bool>? isActive,
    Expression<String>? qrToken,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (name != null) 'name': name,
      if (isActive != null) 'is_active': isActive,
      if (qrToken != null) 'qr_token': qrToken,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedBranchesCompanion copyWith({
    Value<String>? id,
    Value<String>? name,
    Value<bool>? isActive,
    Value<String?>? qrToken,
    Value<int>? rowid,
  }) {
    return CachedBranchesCompanion(
      id: id ?? this.id,
      name: name ?? this.name,
      isActive: isActive ?? this.isActive,
      qrToken: qrToken ?? this.qrToken,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (isActive.present) {
      map['is_active'] = Variable<bool>(isActive.value);
    }
    if (qrToken.present) {
      map['qr_token'] = Variable<String>(qrToken.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedBranchesCompanion(')
          ..write('id: $id, ')
          ..write('name: $name, ')
          ..write('isActive: $isActive, ')
          ..write('qrToken: $qrToken, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CachedClassSessionsTable extends CachedClassSessions
    with TableInfo<$CachedClassSessionsTable, CachedClassSession> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedClassSessionsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _classIdMeta = const VerificationMeta(
    'classId',
  );
  @override
  late final GeneratedColumn<String> classId = GeneratedColumn<String>(
    'class_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _branchIdMeta = const VerificationMeta(
    'branchId',
  );
  @override
  late final GeneratedColumn<String> branchId = GeneratedColumn<String>(
    'branch_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _studioIdMeta = const VerificationMeta(
    'studioId',
  );
  @override
  late final GeneratedColumn<String> studioId = GeneratedColumn<String>(
    'studio_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _startsAtMeta = const VerificationMeta(
    'startsAt',
  );
  @override
  late final GeneratedColumn<String> startsAt = GeneratedColumn<String>(
    'starts_at',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _endsAtMeta = const VerificationMeta('endsAt');
  @override
  late final GeneratedColumn<String> endsAt = GeneratedColumn<String>(
    'ends_at',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    classId,
    name,
    branchId,
    studioId,
    startsAt,
    endsAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_class_sessions';
  @override
  VerificationContext validateIntegrity(
    Insertable<CachedClassSession> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('class_id')) {
      context.handle(
        _classIdMeta,
        classId.isAcceptableOrUnknown(data['class_id']!, _classIdMeta),
      );
    }
    if (data.containsKey('name')) {
      context.handle(
        _nameMeta,
        name.isAcceptableOrUnknown(data['name']!, _nameMeta),
      );
    }
    if (data.containsKey('branch_id')) {
      context.handle(
        _branchIdMeta,
        branchId.isAcceptableOrUnknown(data['branch_id']!, _branchIdMeta),
      );
    }
    if (data.containsKey('studio_id')) {
      context.handle(
        _studioIdMeta,
        studioId.isAcceptableOrUnknown(data['studio_id']!, _studioIdMeta),
      );
    }
    if (data.containsKey('starts_at')) {
      context.handle(
        _startsAtMeta,
        startsAt.isAcceptableOrUnknown(data['starts_at']!, _startsAtMeta),
      );
    }
    if (data.containsKey('ends_at')) {
      context.handle(
        _endsAtMeta,
        endsAt.isAcceptableOrUnknown(data['ends_at']!, _endsAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CachedClassSession map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedClassSession(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      classId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}class_id'],
      ),
      name: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}name'],
      ),
      branchId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}branch_id'],
      ),
      studioId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}studio_id'],
      ),
      startsAt: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}starts_at'],
      ),
      endsAt: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}ends_at'],
      ),
    );
  }

  @override
  $CachedClassSessionsTable createAlias(String alias) {
    return $CachedClassSessionsTable(attachedDatabase, alias);
  }
}

class CachedClassSession extends DataClass
    implements Insertable<CachedClassSession> {
  final String id;
  final String? classId;
  final String? name;
  final String? branchId;
  final String? studioId;
  final String? startsAt;
  final String? endsAt;
  const CachedClassSession({
    required this.id,
    this.classId,
    this.name,
    this.branchId,
    this.studioId,
    this.startsAt,
    this.endsAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    if (!nullToAbsent || classId != null) {
      map['class_id'] = Variable<String>(classId);
    }
    if (!nullToAbsent || name != null) {
      map['name'] = Variable<String>(name);
    }
    if (!nullToAbsent || branchId != null) {
      map['branch_id'] = Variable<String>(branchId);
    }
    if (!nullToAbsent || studioId != null) {
      map['studio_id'] = Variable<String>(studioId);
    }
    if (!nullToAbsent || startsAt != null) {
      map['starts_at'] = Variable<String>(startsAt);
    }
    if (!nullToAbsent || endsAt != null) {
      map['ends_at'] = Variable<String>(endsAt);
    }
    return map;
  }

  CachedClassSessionsCompanion toCompanion(bool nullToAbsent) {
    return CachedClassSessionsCompanion(
      id: Value(id),
      classId: classId == null && nullToAbsent
          ? const Value.absent()
          : Value(classId),
      name: name == null && nullToAbsent ? const Value.absent() : Value(name),
      branchId: branchId == null && nullToAbsent
          ? const Value.absent()
          : Value(branchId),
      studioId: studioId == null && nullToAbsent
          ? const Value.absent()
          : Value(studioId),
      startsAt: startsAt == null && nullToAbsent
          ? const Value.absent()
          : Value(startsAt),
      endsAt: endsAt == null && nullToAbsent
          ? const Value.absent()
          : Value(endsAt),
    );
  }

  factory CachedClassSession.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedClassSession(
      id: serializer.fromJson<String>(json['id']),
      classId: serializer.fromJson<String?>(json['classId']),
      name: serializer.fromJson<String?>(json['name']),
      branchId: serializer.fromJson<String?>(json['branchId']),
      studioId: serializer.fromJson<String?>(json['studioId']),
      startsAt: serializer.fromJson<String?>(json['startsAt']),
      endsAt: serializer.fromJson<String?>(json['endsAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'classId': serializer.toJson<String?>(classId),
      'name': serializer.toJson<String?>(name),
      'branchId': serializer.toJson<String?>(branchId),
      'studioId': serializer.toJson<String?>(studioId),
      'startsAt': serializer.toJson<String?>(startsAt),
      'endsAt': serializer.toJson<String?>(endsAt),
    };
  }

  CachedClassSession copyWith({
    String? id,
    Value<String?> classId = const Value.absent(),
    Value<String?> name = const Value.absent(),
    Value<String?> branchId = const Value.absent(),
    Value<String?> studioId = const Value.absent(),
    Value<String?> startsAt = const Value.absent(),
    Value<String?> endsAt = const Value.absent(),
  }) => CachedClassSession(
    id: id ?? this.id,
    classId: classId.present ? classId.value : this.classId,
    name: name.present ? name.value : this.name,
    branchId: branchId.present ? branchId.value : this.branchId,
    studioId: studioId.present ? studioId.value : this.studioId,
    startsAt: startsAt.present ? startsAt.value : this.startsAt,
    endsAt: endsAt.present ? endsAt.value : this.endsAt,
  );
  CachedClassSession copyWithCompanion(CachedClassSessionsCompanion data) {
    return CachedClassSession(
      id: data.id.present ? data.id.value : this.id,
      classId: data.classId.present ? data.classId.value : this.classId,
      name: data.name.present ? data.name.value : this.name,
      branchId: data.branchId.present ? data.branchId.value : this.branchId,
      studioId: data.studioId.present ? data.studioId.value : this.studioId,
      startsAt: data.startsAt.present ? data.startsAt.value : this.startsAt,
      endsAt: data.endsAt.present ? data.endsAt.value : this.endsAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedClassSession(')
          ..write('id: $id, ')
          ..write('classId: $classId, ')
          ..write('name: $name, ')
          ..write('branchId: $branchId, ')
          ..write('studioId: $studioId, ')
          ..write('startsAt: $startsAt, ')
          ..write('endsAt: $endsAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(id, classId, name, branchId, studioId, startsAt, endsAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedClassSession &&
          other.id == this.id &&
          other.classId == this.classId &&
          other.name == this.name &&
          other.branchId == this.branchId &&
          other.studioId == this.studioId &&
          other.startsAt == this.startsAt &&
          other.endsAt == this.endsAt);
}

class CachedClassSessionsCompanion extends UpdateCompanion<CachedClassSession> {
  final Value<String> id;
  final Value<String?> classId;
  final Value<String?> name;
  final Value<String?> branchId;
  final Value<String?> studioId;
  final Value<String?> startsAt;
  final Value<String?> endsAt;
  final Value<int> rowid;
  const CachedClassSessionsCompanion({
    this.id = const Value.absent(),
    this.classId = const Value.absent(),
    this.name = const Value.absent(),
    this.branchId = const Value.absent(),
    this.studioId = const Value.absent(),
    this.startsAt = const Value.absent(),
    this.endsAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedClassSessionsCompanion.insert({
    required String id,
    this.classId = const Value.absent(),
    this.name = const Value.absent(),
    this.branchId = const Value.absent(),
    this.studioId = const Value.absent(),
    this.startsAt = const Value.absent(),
    this.endsAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id);
  static Insertable<CachedClassSession> custom({
    Expression<String>? id,
    Expression<String>? classId,
    Expression<String>? name,
    Expression<String>? branchId,
    Expression<String>? studioId,
    Expression<String>? startsAt,
    Expression<String>? endsAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (classId != null) 'class_id': classId,
      if (name != null) 'name': name,
      if (branchId != null) 'branch_id': branchId,
      if (studioId != null) 'studio_id': studioId,
      if (startsAt != null) 'starts_at': startsAt,
      if (endsAt != null) 'ends_at': endsAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedClassSessionsCompanion copyWith({
    Value<String>? id,
    Value<String?>? classId,
    Value<String?>? name,
    Value<String?>? branchId,
    Value<String?>? studioId,
    Value<String?>? startsAt,
    Value<String?>? endsAt,
    Value<int>? rowid,
  }) {
    return CachedClassSessionsCompanion(
      id: id ?? this.id,
      classId: classId ?? this.classId,
      name: name ?? this.name,
      branchId: branchId ?? this.branchId,
      studioId: studioId ?? this.studioId,
      startsAt: startsAt ?? this.startsAt,
      endsAt: endsAt ?? this.endsAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (classId.present) {
      map['class_id'] = Variable<String>(classId.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (branchId.present) {
      map['branch_id'] = Variable<String>(branchId.value);
    }
    if (studioId.present) {
      map['studio_id'] = Variable<String>(studioId.value);
    }
    if (startsAt.present) {
      map['starts_at'] = Variable<String>(startsAt.value);
    }
    if (endsAt.present) {
      map['ends_at'] = Variable<String>(endsAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedClassSessionsCompanion(')
          ..write('id: $id, ')
          ..write('classId: $classId, ')
          ..write('name: $name, ')
          ..write('branchId: $branchId, ')
          ..write('studioId: $studioId, ')
          ..write('startsAt: $startsAt, ')
          ..write('endsAt: $endsAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CachedAssignmentsTable extends CachedAssignments
    with TableInfo<$CachedAssignmentsTable, CachedAssignment> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedAssignmentsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _assignmentIdMeta = const VerificationMeta(
    'assignmentId',
  );
  @override
  late final GeneratedColumn<String> assignmentId = GeneratedColumn<String>(
    'assignment_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _gymMemberIdMeta = const VerificationMeta(
    'gymMemberId',
  );
  @override
  late final GeneratedColumn<String> gymMemberId = GeneratedColumn<String>(
    'gym_member_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _trainerIdMeta = const VerificationMeta(
    'trainerId',
  );
  @override
  late final GeneratedColumn<String> trainerId = GeneratedColumn<String>(
    'trainer_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _memberNameMeta = const VerificationMeta(
    'memberName',
  );
  @override
  late final GeneratedColumn<String> memberName = GeneratedColumn<String>(
    'member_name',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _memberNumberMeta = const VerificationMeta(
    'memberNumber',
  );
  @override
  late final GeneratedColumn<String> memberNumber = GeneratedColumn<String>(
    'member_number',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _photoUrlMeta = const VerificationMeta(
    'photoUrl',
  );
  @override
  late final GeneratedColumn<String> photoUrl = GeneratedColumn<String>(
    'photo_url',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _serviceTypeMeta = const VerificationMeta(
    'serviceType',
  );
  @override
  late final GeneratedColumn<String> serviceType = GeneratedColumn<String>(
    'service_type',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _packageNameMeta = const VerificationMeta(
    'packageName',
  );
  @override
  late final GeneratedColumn<String> packageName = GeneratedColumn<String>(
    'package_name',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _sessionsTotalMeta = const VerificationMeta(
    'sessionsTotal',
  );
  @override
  late final GeneratedColumn<int> sessionsTotal = GeneratedColumn<int>(
    'sessions_total',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _sessionsUsedMeta = const VerificationMeta(
    'sessionsUsed',
  );
  @override
  late final GeneratedColumn<int> sessionsUsed = GeneratedColumn<int>(
    'sessions_used',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _expiresAtMeta = const VerificationMeta(
    'expiresAt',
  );
  @override
  late final GeneratedColumn<String> expiresAt = GeneratedColumn<String>(
    'expires_at',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _lastSessionAtMeta = const VerificationMeta(
    'lastSessionAt',
  );
  @override
  late final GeneratedColumn<String> lastSessionAt = GeneratedColumn<String>(
    'last_session_at',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    assignmentId,
    gymMemberId,
    trainerId,
    memberName,
    memberNumber,
    photoUrl,
    serviceType,
    packageName,
    sessionsTotal,
    sessionsUsed,
    status,
    expiresAt,
    lastSessionAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_assignments';
  @override
  VerificationContext validateIntegrity(
    Insertable<CachedAssignment> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('assignment_id')) {
      context.handle(
        _assignmentIdMeta,
        assignmentId.isAcceptableOrUnknown(
          data['assignment_id']!,
          _assignmentIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_assignmentIdMeta);
    }
    if (data.containsKey('gym_member_id')) {
      context.handle(
        _gymMemberIdMeta,
        gymMemberId.isAcceptableOrUnknown(
          data['gym_member_id']!,
          _gymMemberIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_gymMemberIdMeta);
    }
    if (data.containsKey('trainer_id')) {
      context.handle(
        _trainerIdMeta,
        trainerId.isAcceptableOrUnknown(data['trainer_id']!, _trainerIdMeta),
      );
    }
    if (data.containsKey('member_name')) {
      context.handle(
        _memberNameMeta,
        memberName.isAcceptableOrUnknown(data['member_name']!, _memberNameMeta),
      );
    }
    if (data.containsKey('member_number')) {
      context.handle(
        _memberNumberMeta,
        memberNumber.isAcceptableOrUnknown(
          data['member_number']!,
          _memberNumberMeta,
        ),
      );
    }
    if (data.containsKey('photo_url')) {
      context.handle(
        _photoUrlMeta,
        photoUrl.isAcceptableOrUnknown(data['photo_url']!, _photoUrlMeta),
      );
    }
    if (data.containsKey('service_type')) {
      context.handle(
        _serviceTypeMeta,
        serviceType.isAcceptableOrUnknown(
          data['service_type']!,
          _serviceTypeMeta,
        ),
      );
    }
    if (data.containsKey('package_name')) {
      context.handle(
        _packageNameMeta,
        packageName.isAcceptableOrUnknown(
          data['package_name']!,
          _packageNameMeta,
        ),
      );
    }
    if (data.containsKey('sessions_total')) {
      context.handle(
        _sessionsTotalMeta,
        sessionsTotal.isAcceptableOrUnknown(
          data['sessions_total']!,
          _sessionsTotalMeta,
        ),
      );
    }
    if (data.containsKey('sessions_used')) {
      context.handle(
        _sessionsUsedMeta,
        sessionsUsed.isAcceptableOrUnknown(
          data['sessions_used']!,
          _sessionsUsedMeta,
        ),
      );
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    }
    if (data.containsKey('expires_at')) {
      context.handle(
        _expiresAtMeta,
        expiresAt.isAcceptableOrUnknown(data['expires_at']!, _expiresAtMeta),
      );
    }
    if (data.containsKey('last_session_at')) {
      context.handle(
        _lastSessionAtMeta,
        lastSessionAt.isAcceptableOrUnknown(
          data['last_session_at']!,
          _lastSessionAtMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {assignmentId};
  @override
  CachedAssignment map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedAssignment(
      assignmentId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}assignment_id'],
      )!,
      gymMemberId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}gym_member_id'],
      )!,
      trainerId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}trainer_id'],
      ),
      memberName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}member_name'],
      ),
      memberNumber: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}member_number'],
      ),
      photoUrl: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}photo_url'],
      ),
      serviceType: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}service_type'],
      ),
      packageName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}package_name'],
      ),
      sessionsTotal: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}sessions_total'],
      ),
      sessionsUsed: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}sessions_used'],
      ),
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      ),
      expiresAt: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}expires_at'],
      ),
      lastSessionAt: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}last_session_at'],
      ),
    );
  }

  @override
  $CachedAssignmentsTable createAlias(String alias) {
    return $CachedAssignmentsTable(attachedDatabase, alias);
  }
}

class CachedAssignment extends DataClass
    implements Insertable<CachedAssignment> {
  final String assignmentId;
  final String gymMemberId;

  /// Trainer of the assignment (member snapshot; schema v4).
  final String? trainerId;
  final String? memberName;
  final String? memberNumber;
  final String? photoUrl;
  final String? serviceType;
  final String? packageName;
  final int? sessionsTotal;
  final int? sessionsUsed;
  final String? status;
  final String? expiresAt;
  final String? lastSessionAt;
  const CachedAssignment({
    required this.assignmentId,
    required this.gymMemberId,
    this.trainerId,
    this.memberName,
    this.memberNumber,
    this.photoUrl,
    this.serviceType,
    this.packageName,
    this.sessionsTotal,
    this.sessionsUsed,
    this.status,
    this.expiresAt,
    this.lastSessionAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['assignment_id'] = Variable<String>(assignmentId);
    map['gym_member_id'] = Variable<String>(gymMemberId);
    if (!nullToAbsent || trainerId != null) {
      map['trainer_id'] = Variable<String>(trainerId);
    }
    if (!nullToAbsent || memberName != null) {
      map['member_name'] = Variable<String>(memberName);
    }
    if (!nullToAbsent || memberNumber != null) {
      map['member_number'] = Variable<String>(memberNumber);
    }
    if (!nullToAbsent || photoUrl != null) {
      map['photo_url'] = Variable<String>(photoUrl);
    }
    if (!nullToAbsent || serviceType != null) {
      map['service_type'] = Variable<String>(serviceType);
    }
    if (!nullToAbsent || packageName != null) {
      map['package_name'] = Variable<String>(packageName);
    }
    if (!nullToAbsent || sessionsTotal != null) {
      map['sessions_total'] = Variable<int>(sessionsTotal);
    }
    if (!nullToAbsent || sessionsUsed != null) {
      map['sessions_used'] = Variable<int>(sessionsUsed);
    }
    if (!nullToAbsent || status != null) {
      map['status'] = Variable<String>(status);
    }
    if (!nullToAbsent || expiresAt != null) {
      map['expires_at'] = Variable<String>(expiresAt);
    }
    if (!nullToAbsent || lastSessionAt != null) {
      map['last_session_at'] = Variable<String>(lastSessionAt);
    }
    return map;
  }

  CachedAssignmentsCompanion toCompanion(bool nullToAbsent) {
    return CachedAssignmentsCompanion(
      assignmentId: Value(assignmentId),
      gymMemberId: Value(gymMemberId),
      trainerId: trainerId == null && nullToAbsent
          ? const Value.absent()
          : Value(trainerId),
      memberName: memberName == null && nullToAbsent
          ? const Value.absent()
          : Value(memberName),
      memberNumber: memberNumber == null && nullToAbsent
          ? const Value.absent()
          : Value(memberNumber),
      photoUrl: photoUrl == null && nullToAbsent
          ? const Value.absent()
          : Value(photoUrl),
      serviceType: serviceType == null && nullToAbsent
          ? const Value.absent()
          : Value(serviceType),
      packageName: packageName == null && nullToAbsent
          ? const Value.absent()
          : Value(packageName),
      sessionsTotal: sessionsTotal == null && nullToAbsent
          ? const Value.absent()
          : Value(sessionsTotal),
      sessionsUsed: sessionsUsed == null && nullToAbsent
          ? const Value.absent()
          : Value(sessionsUsed),
      status: status == null && nullToAbsent
          ? const Value.absent()
          : Value(status),
      expiresAt: expiresAt == null && nullToAbsent
          ? const Value.absent()
          : Value(expiresAt),
      lastSessionAt: lastSessionAt == null && nullToAbsent
          ? const Value.absent()
          : Value(lastSessionAt),
    );
  }

  factory CachedAssignment.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedAssignment(
      assignmentId: serializer.fromJson<String>(json['assignmentId']),
      gymMemberId: serializer.fromJson<String>(json['gymMemberId']),
      trainerId: serializer.fromJson<String?>(json['trainerId']),
      memberName: serializer.fromJson<String?>(json['memberName']),
      memberNumber: serializer.fromJson<String?>(json['memberNumber']),
      photoUrl: serializer.fromJson<String?>(json['photoUrl']),
      serviceType: serializer.fromJson<String?>(json['serviceType']),
      packageName: serializer.fromJson<String?>(json['packageName']),
      sessionsTotal: serializer.fromJson<int?>(json['sessionsTotal']),
      sessionsUsed: serializer.fromJson<int?>(json['sessionsUsed']),
      status: serializer.fromJson<String?>(json['status']),
      expiresAt: serializer.fromJson<String?>(json['expiresAt']),
      lastSessionAt: serializer.fromJson<String?>(json['lastSessionAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'assignmentId': serializer.toJson<String>(assignmentId),
      'gymMemberId': serializer.toJson<String>(gymMemberId),
      'trainerId': serializer.toJson<String?>(trainerId),
      'memberName': serializer.toJson<String?>(memberName),
      'memberNumber': serializer.toJson<String?>(memberNumber),
      'photoUrl': serializer.toJson<String?>(photoUrl),
      'serviceType': serializer.toJson<String?>(serviceType),
      'packageName': serializer.toJson<String?>(packageName),
      'sessionsTotal': serializer.toJson<int?>(sessionsTotal),
      'sessionsUsed': serializer.toJson<int?>(sessionsUsed),
      'status': serializer.toJson<String?>(status),
      'expiresAt': serializer.toJson<String?>(expiresAt),
      'lastSessionAt': serializer.toJson<String?>(lastSessionAt),
    };
  }

  CachedAssignment copyWith({
    String? assignmentId,
    String? gymMemberId,
    Value<String?> trainerId = const Value.absent(),
    Value<String?> memberName = const Value.absent(),
    Value<String?> memberNumber = const Value.absent(),
    Value<String?> photoUrl = const Value.absent(),
    Value<String?> serviceType = const Value.absent(),
    Value<String?> packageName = const Value.absent(),
    Value<int?> sessionsTotal = const Value.absent(),
    Value<int?> sessionsUsed = const Value.absent(),
    Value<String?> status = const Value.absent(),
    Value<String?> expiresAt = const Value.absent(),
    Value<String?> lastSessionAt = const Value.absent(),
  }) => CachedAssignment(
    assignmentId: assignmentId ?? this.assignmentId,
    gymMemberId: gymMemberId ?? this.gymMemberId,
    trainerId: trainerId.present ? trainerId.value : this.trainerId,
    memberName: memberName.present ? memberName.value : this.memberName,
    memberNumber: memberNumber.present ? memberNumber.value : this.memberNumber,
    photoUrl: photoUrl.present ? photoUrl.value : this.photoUrl,
    serviceType: serviceType.present ? serviceType.value : this.serviceType,
    packageName: packageName.present ? packageName.value : this.packageName,
    sessionsTotal: sessionsTotal.present
        ? sessionsTotal.value
        : this.sessionsTotal,
    sessionsUsed: sessionsUsed.present ? sessionsUsed.value : this.sessionsUsed,
    status: status.present ? status.value : this.status,
    expiresAt: expiresAt.present ? expiresAt.value : this.expiresAt,
    lastSessionAt: lastSessionAt.present
        ? lastSessionAt.value
        : this.lastSessionAt,
  );
  CachedAssignment copyWithCompanion(CachedAssignmentsCompanion data) {
    return CachedAssignment(
      assignmentId: data.assignmentId.present
          ? data.assignmentId.value
          : this.assignmentId,
      gymMemberId: data.gymMemberId.present
          ? data.gymMemberId.value
          : this.gymMemberId,
      trainerId: data.trainerId.present ? data.trainerId.value : this.trainerId,
      memberName: data.memberName.present
          ? data.memberName.value
          : this.memberName,
      memberNumber: data.memberNumber.present
          ? data.memberNumber.value
          : this.memberNumber,
      photoUrl: data.photoUrl.present ? data.photoUrl.value : this.photoUrl,
      serviceType: data.serviceType.present
          ? data.serviceType.value
          : this.serviceType,
      packageName: data.packageName.present
          ? data.packageName.value
          : this.packageName,
      sessionsTotal: data.sessionsTotal.present
          ? data.sessionsTotal.value
          : this.sessionsTotal,
      sessionsUsed: data.sessionsUsed.present
          ? data.sessionsUsed.value
          : this.sessionsUsed,
      status: data.status.present ? data.status.value : this.status,
      expiresAt: data.expiresAt.present ? data.expiresAt.value : this.expiresAt,
      lastSessionAt: data.lastSessionAt.present
          ? data.lastSessionAt.value
          : this.lastSessionAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedAssignment(')
          ..write('assignmentId: $assignmentId, ')
          ..write('gymMemberId: $gymMemberId, ')
          ..write('trainerId: $trainerId, ')
          ..write('memberName: $memberName, ')
          ..write('memberNumber: $memberNumber, ')
          ..write('photoUrl: $photoUrl, ')
          ..write('serviceType: $serviceType, ')
          ..write('packageName: $packageName, ')
          ..write('sessionsTotal: $sessionsTotal, ')
          ..write('sessionsUsed: $sessionsUsed, ')
          ..write('status: $status, ')
          ..write('expiresAt: $expiresAt, ')
          ..write('lastSessionAt: $lastSessionAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    assignmentId,
    gymMemberId,
    trainerId,
    memberName,
    memberNumber,
    photoUrl,
    serviceType,
    packageName,
    sessionsTotal,
    sessionsUsed,
    status,
    expiresAt,
    lastSessionAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedAssignment &&
          other.assignmentId == this.assignmentId &&
          other.gymMemberId == this.gymMemberId &&
          other.trainerId == this.trainerId &&
          other.memberName == this.memberName &&
          other.memberNumber == this.memberNumber &&
          other.photoUrl == this.photoUrl &&
          other.serviceType == this.serviceType &&
          other.packageName == this.packageName &&
          other.sessionsTotal == this.sessionsTotal &&
          other.sessionsUsed == this.sessionsUsed &&
          other.status == this.status &&
          other.expiresAt == this.expiresAt &&
          other.lastSessionAt == this.lastSessionAt);
}

class CachedAssignmentsCompanion extends UpdateCompanion<CachedAssignment> {
  final Value<String> assignmentId;
  final Value<String> gymMemberId;
  final Value<String?> trainerId;
  final Value<String?> memberName;
  final Value<String?> memberNumber;
  final Value<String?> photoUrl;
  final Value<String?> serviceType;
  final Value<String?> packageName;
  final Value<int?> sessionsTotal;
  final Value<int?> sessionsUsed;
  final Value<String?> status;
  final Value<String?> expiresAt;
  final Value<String?> lastSessionAt;
  final Value<int> rowid;
  const CachedAssignmentsCompanion({
    this.assignmentId = const Value.absent(),
    this.gymMemberId = const Value.absent(),
    this.trainerId = const Value.absent(),
    this.memberName = const Value.absent(),
    this.memberNumber = const Value.absent(),
    this.photoUrl = const Value.absent(),
    this.serviceType = const Value.absent(),
    this.packageName = const Value.absent(),
    this.sessionsTotal = const Value.absent(),
    this.sessionsUsed = const Value.absent(),
    this.status = const Value.absent(),
    this.expiresAt = const Value.absent(),
    this.lastSessionAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedAssignmentsCompanion.insert({
    required String assignmentId,
    required String gymMemberId,
    this.trainerId = const Value.absent(),
    this.memberName = const Value.absent(),
    this.memberNumber = const Value.absent(),
    this.photoUrl = const Value.absent(),
    this.serviceType = const Value.absent(),
    this.packageName = const Value.absent(),
    this.sessionsTotal = const Value.absent(),
    this.sessionsUsed = const Value.absent(),
    this.status = const Value.absent(),
    this.expiresAt = const Value.absent(),
    this.lastSessionAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : assignmentId = Value(assignmentId),
       gymMemberId = Value(gymMemberId);
  static Insertable<CachedAssignment> custom({
    Expression<String>? assignmentId,
    Expression<String>? gymMemberId,
    Expression<String>? trainerId,
    Expression<String>? memberName,
    Expression<String>? memberNumber,
    Expression<String>? photoUrl,
    Expression<String>? serviceType,
    Expression<String>? packageName,
    Expression<int>? sessionsTotal,
    Expression<int>? sessionsUsed,
    Expression<String>? status,
    Expression<String>? expiresAt,
    Expression<String>? lastSessionAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (assignmentId != null) 'assignment_id': assignmentId,
      if (gymMemberId != null) 'gym_member_id': gymMemberId,
      if (trainerId != null) 'trainer_id': trainerId,
      if (memberName != null) 'member_name': memberName,
      if (memberNumber != null) 'member_number': memberNumber,
      if (photoUrl != null) 'photo_url': photoUrl,
      if (serviceType != null) 'service_type': serviceType,
      if (packageName != null) 'package_name': packageName,
      if (sessionsTotal != null) 'sessions_total': sessionsTotal,
      if (sessionsUsed != null) 'sessions_used': sessionsUsed,
      if (status != null) 'status': status,
      if (expiresAt != null) 'expires_at': expiresAt,
      if (lastSessionAt != null) 'last_session_at': lastSessionAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedAssignmentsCompanion copyWith({
    Value<String>? assignmentId,
    Value<String>? gymMemberId,
    Value<String?>? trainerId,
    Value<String?>? memberName,
    Value<String?>? memberNumber,
    Value<String?>? photoUrl,
    Value<String?>? serviceType,
    Value<String?>? packageName,
    Value<int?>? sessionsTotal,
    Value<int?>? sessionsUsed,
    Value<String?>? status,
    Value<String?>? expiresAt,
    Value<String?>? lastSessionAt,
    Value<int>? rowid,
  }) {
    return CachedAssignmentsCompanion(
      assignmentId: assignmentId ?? this.assignmentId,
      gymMemberId: gymMemberId ?? this.gymMemberId,
      trainerId: trainerId ?? this.trainerId,
      memberName: memberName ?? this.memberName,
      memberNumber: memberNumber ?? this.memberNumber,
      photoUrl: photoUrl ?? this.photoUrl,
      serviceType: serviceType ?? this.serviceType,
      packageName: packageName ?? this.packageName,
      sessionsTotal: sessionsTotal ?? this.sessionsTotal,
      sessionsUsed: sessionsUsed ?? this.sessionsUsed,
      status: status ?? this.status,
      expiresAt: expiresAt ?? this.expiresAt,
      lastSessionAt: lastSessionAt ?? this.lastSessionAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (assignmentId.present) {
      map['assignment_id'] = Variable<String>(assignmentId.value);
    }
    if (gymMemberId.present) {
      map['gym_member_id'] = Variable<String>(gymMemberId.value);
    }
    if (trainerId.present) {
      map['trainer_id'] = Variable<String>(trainerId.value);
    }
    if (memberName.present) {
      map['member_name'] = Variable<String>(memberName.value);
    }
    if (memberNumber.present) {
      map['member_number'] = Variable<String>(memberNumber.value);
    }
    if (photoUrl.present) {
      map['photo_url'] = Variable<String>(photoUrl.value);
    }
    if (serviceType.present) {
      map['service_type'] = Variable<String>(serviceType.value);
    }
    if (packageName.present) {
      map['package_name'] = Variable<String>(packageName.value);
    }
    if (sessionsTotal.present) {
      map['sessions_total'] = Variable<int>(sessionsTotal.value);
    }
    if (sessionsUsed.present) {
      map['sessions_used'] = Variable<int>(sessionsUsed.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (expiresAt.present) {
      map['expires_at'] = Variable<String>(expiresAt.value);
    }
    if (lastSessionAt.present) {
      map['last_session_at'] = Variable<String>(lastSessionAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedAssignmentsCompanion(')
          ..write('assignmentId: $assignmentId, ')
          ..write('gymMemberId: $gymMemberId, ')
          ..write('trainerId: $trainerId, ')
          ..write('memberName: $memberName, ')
          ..write('memberNumber: $memberNumber, ')
          ..write('photoUrl: $photoUrl, ')
          ..write('serviceType: $serviceType, ')
          ..write('packageName: $packageName, ')
          ..write('sessionsTotal: $sessionsTotal, ')
          ..write('sessionsUsed: $sessionsUsed, ')
          ..write('status: $status, ')
          ..write('expiresAt: $expiresAt, ')
          ..write('lastSessionAt: $lastSessionAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CachedRecentAttendanceTable extends CachedRecentAttendance
    with TableInfo<$CachedRecentAttendanceTable, CachedRecentAttendanceRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedRecentAttendanceTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _attendanceIdMeta = const VerificationMeta(
    'attendanceId',
  );
  @override
  late final GeneratedColumn<String> attendanceId = GeneratedColumn<String>(
    'attendance_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _gymMemberIdMeta = const VerificationMeta(
    'gymMemberId',
  );
  @override
  late final GeneratedColumn<String> gymMemberId = GeneratedColumn<String>(
    'gym_member_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _classSessionIdMeta = const VerificationMeta(
    'classSessionId',
  );
  @override
  late final GeneratedColumn<String> classSessionId = GeneratedColumn<String>(
    'class_session_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _branchIdMeta = const VerificationMeta(
    'branchId',
  );
  @override
  late final GeneratedColumn<String> branchId = GeneratedColumn<String>(
    'branch_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _checkInAtMeta = const VerificationMeta(
    'checkInAt',
  );
  @override
  late final GeneratedColumn<String> checkInAt = GeneratedColumn<String>(
    'check_in_at',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    attendanceId,
    gymMemberId,
    classSessionId,
    branchId,
    checkInAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_recent_attendance';
  @override
  VerificationContext validateIntegrity(
    Insertable<CachedRecentAttendanceRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('attendance_id')) {
      context.handle(
        _attendanceIdMeta,
        attendanceId.isAcceptableOrUnknown(
          data['attendance_id']!,
          _attendanceIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_attendanceIdMeta);
    }
    if (data.containsKey('gym_member_id')) {
      context.handle(
        _gymMemberIdMeta,
        gymMemberId.isAcceptableOrUnknown(
          data['gym_member_id']!,
          _gymMemberIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_gymMemberIdMeta);
    }
    if (data.containsKey('class_session_id')) {
      context.handle(
        _classSessionIdMeta,
        classSessionId.isAcceptableOrUnknown(
          data['class_session_id']!,
          _classSessionIdMeta,
        ),
      );
    }
    if (data.containsKey('branch_id')) {
      context.handle(
        _branchIdMeta,
        branchId.isAcceptableOrUnknown(data['branch_id']!, _branchIdMeta),
      );
    }
    if (data.containsKey('check_in_at')) {
      context.handle(
        _checkInAtMeta,
        checkInAt.isAcceptableOrUnknown(data['check_in_at']!, _checkInAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {attendanceId};
  @override
  CachedRecentAttendanceRow map(
    Map<String, dynamic> data, {
    String? tablePrefix,
  }) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedRecentAttendanceRow(
      attendanceId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}attendance_id'],
      )!,
      gymMemberId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}gym_member_id'],
      )!,
      classSessionId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}class_session_id'],
      ),
      branchId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}branch_id'],
      ),
      checkInAt: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}check_in_at'],
      ),
    );
  }

  @override
  $CachedRecentAttendanceTable createAlias(String alias) {
    return $CachedRecentAttendanceTable(attachedDatabase, alias);
  }
}

class CachedRecentAttendanceRow extends DataClass
    implements Insertable<CachedRecentAttendanceRow> {
  final String attendanceId;
  final String gymMemberId;
  final String? classSessionId;
  final String? branchId;
  final String? checkInAt;
  const CachedRecentAttendanceRow({
    required this.attendanceId,
    required this.gymMemberId,
    this.classSessionId,
    this.branchId,
    this.checkInAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['attendance_id'] = Variable<String>(attendanceId);
    map['gym_member_id'] = Variable<String>(gymMemberId);
    if (!nullToAbsent || classSessionId != null) {
      map['class_session_id'] = Variable<String>(classSessionId);
    }
    if (!nullToAbsent || branchId != null) {
      map['branch_id'] = Variable<String>(branchId);
    }
    if (!nullToAbsent || checkInAt != null) {
      map['check_in_at'] = Variable<String>(checkInAt);
    }
    return map;
  }

  CachedRecentAttendanceCompanion toCompanion(bool nullToAbsent) {
    return CachedRecentAttendanceCompanion(
      attendanceId: Value(attendanceId),
      gymMemberId: Value(gymMemberId),
      classSessionId: classSessionId == null && nullToAbsent
          ? const Value.absent()
          : Value(classSessionId),
      branchId: branchId == null && nullToAbsent
          ? const Value.absent()
          : Value(branchId),
      checkInAt: checkInAt == null && nullToAbsent
          ? const Value.absent()
          : Value(checkInAt),
    );
  }

  factory CachedRecentAttendanceRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedRecentAttendanceRow(
      attendanceId: serializer.fromJson<String>(json['attendanceId']),
      gymMemberId: serializer.fromJson<String>(json['gymMemberId']),
      classSessionId: serializer.fromJson<String?>(json['classSessionId']),
      branchId: serializer.fromJson<String?>(json['branchId']),
      checkInAt: serializer.fromJson<String?>(json['checkInAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'attendanceId': serializer.toJson<String>(attendanceId),
      'gymMemberId': serializer.toJson<String>(gymMemberId),
      'classSessionId': serializer.toJson<String?>(classSessionId),
      'branchId': serializer.toJson<String?>(branchId),
      'checkInAt': serializer.toJson<String?>(checkInAt),
    };
  }

  CachedRecentAttendanceRow copyWith({
    String? attendanceId,
    String? gymMemberId,
    Value<String?> classSessionId = const Value.absent(),
    Value<String?> branchId = const Value.absent(),
    Value<String?> checkInAt = const Value.absent(),
  }) => CachedRecentAttendanceRow(
    attendanceId: attendanceId ?? this.attendanceId,
    gymMemberId: gymMemberId ?? this.gymMemberId,
    classSessionId: classSessionId.present
        ? classSessionId.value
        : this.classSessionId,
    branchId: branchId.present ? branchId.value : this.branchId,
    checkInAt: checkInAt.present ? checkInAt.value : this.checkInAt,
  );
  CachedRecentAttendanceRow copyWithCompanion(
    CachedRecentAttendanceCompanion data,
  ) {
    return CachedRecentAttendanceRow(
      attendanceId: data.attendanceId.present
          ? data.attendanceId.value
          : this.attendanceId,
      gymMemberId: data.gymMemberId.present
          ? data.gymMemberId.value
          : this.gymMemberId,
      classSessionId: data.classSessionId.present
          ? data.classSessionId.value
          : this.classSessionId,
      branchId: data.branchId.present ? data.branchId.value : this.branchId,
      checkInAt: data.checkInAt.present ? data.checkInAt.value : this.checkInAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedRecentAttendanceRow(')
          ..write('attendanceId: $attendanceId, ')
          ..write('gymMemberId: $gymMemberId, ')
          ..write('classSessionId: $classSessionId, ')
          ..write('branchId: $branchId, ')
          ..write('checkInAt: $checkInAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    attendanceId,
    gymMemberId,
    classSessionId,
    branchId,
    checkInAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedRecentAttendanceRow &&
          other.attendanceId == this.attendanceId &&
          other.gymMemberId == this.gymMemberId &&
          other.classSessionId == this.classSessionId &&
          other.branchId == this.branchId &&
          other.checkInAt == this.checkInAt);
}

class CachedRecentAttendanceCompanion
    extends UpdateCompanion<CachedRecentAttendanceRow> {
  final Value<String> attendanceId;
  final Value<String> gymMemberId;
  final Value<String?> classSessionId;
  final Value<String?> branchId;
  final Value<String?> checkInAt;
  final Value<int> rowid;
  const CachedRecentAttendanceCompanion({
    this.attendanceId = const Value.absent(),
    this.gymMemberId = const Value.absent(),
    this.classSessionId = const Value.absent(),
    this.branchId = const Value.absent(),
    this.checkInAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedRecentAttendanceCompanion.insert({
    required String attendanceId,
    required String gymMemberId,
    this.classSessionId = const Value.absent(),
    this.branchId = const Value.absent(),
    this.checkInAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : attendanceId = Value(attendanceId),
       gymMemberId = Value(gymMemberId);
  static Insertable<CachedRecentAttendanceRow> custom({
    Expression<String>? attendanceId,
    Expression<String>? gymMemberId,
    Expression<String>? classSessionId,
    Expression<String>? branchId,
    Expression<String>? checkInAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (attendanceId != null) 'attendance_id': attendanceId,
      if (gymMemberId != null) 'gym_member_id': gymMemberId,
      if (classSessionId != null) 'class_session_id': classSessionId,
      if (branchId != null) 'branch_id': branchId,
      if (checkInAt != null) 'check_in_at': checkInAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedRecentAttendanceCompanion copyWith({
    Value<String>? attendanceId,
    Value<String>? gymMemberId,
    Value<String?>? classSessionId,
    Value<String?>? branchId,
    Value<String?>? checkInAt,
    Value<int>? rowid,
  }) {
    return CachedRecentAttendanceCompanion(
      attendanceId: attendanceId ?? this.attendanceId,
      gymMemberId: gymMemberId ?? this.gymMemberId,
      classSessionId: classSessionId ?? this.classSessionId,
      branchId: branchId ?? this.branchId,
      checkInAt: checkInAt ?? this.checkInAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (attendanceId.present) {
      map['attendance_id'] = Variable<String>(attendanceId.value);
    }
    if (gymMemberId.present) {
      map['gym_member_id'] = Variable<String>(gymMemberId.value);
    }
    if (classSessionId.present) {
      map['class_session_id'] = Variable<String>(classSessionId.value);
    }
    if (branchId.present) {
      map['branch_id'] = Variable<String>(branchId.value);
    }
    if (checkInAt.present) {
      map['check_in_at'] = Variable<String>(checkInAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedRecentAttendanceCompanion(')
          ..write('attendanceId: $attendanceId, ')
          ..write('gymMemberId: $gymMemberId, ')
          ..write('classSessionId: $classSessionId, ')
          ..write('branchId: $branchId, ')
          ..write('checkInAt: $checkInAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CachedRecentServiceLogsTable extends CachedRecentServiceLogs
    with TableInfo<$CachedRecentServiceLogsTable, CachedRecentServiceLog> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedRecentServiceLogsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _serviceLogIdMeta = const VerificationMeta(
    'serviceLogId',
  );
  @override
  late final GeneratedColumn<String> serviceLogId = GeneratedColumn<String>(
    'service_log_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _assignmentIdMeta = const VerificationMeta(
    'assignmentId',
  );
  @override
  late final GeneratedColumn<String> assignmentId = GeneratedColumn<String>(
    'assignment_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _loggedAtMeta = const VerificationMeta(
    'loggedAt',
  );
  @override
  late final GeneratedColumn<String> loggedAt = GeneratedColumn<String>(
    'logged_at',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [serviceLogId, assignmentId, loggedAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_recent_service_logs';
  @override
  VerificationContext validateIntegrity(
    Insertable<CachedRecentServiceLog> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('service_log_id')) {
      context.handle(
        _serviceLogIdMeta,
        serviceLogId.isAcceptableOrUnknown(
          data['service_log_id']!,
          _serviceLogIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_serviceLogIdMeta);
    }
    if (data.containsKey('assignment_id')) {
      context.handle(
        _assignmentIdMeta,
        assignmentId.isAcceptableOrUnknown(
          data['assignment_id']!,
          _assignmentIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_assignmentIdMeta);
    }
    if (data.containsKey('logged_at')) {
      context.handle(
        _loggedAtMeta,
        loggedAt.isAcceptableOrUnknown(data['logged_at']!, _loggedAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {serviceLogId};
  @override
  CachedRecentServiceLog map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedRecentServiceLog(
      serviceLogId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}service_log_id'],
      )!,
      assignmentId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}assignment_id'],
      )!,
      loggedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}logged_at'],
      ),
    );
  }

  @override
  $CachedRecentServiceLogsTable createAlias(String alias) {
    return $CachedRecentServiceLogsTable(attachedDatabase, alias);
  }
}

class CachedRecentServiceLog extends DataClass
    implements Insertable<CachedRecentServiceLog> {
  final String serviceLogId;
  final String assignmentId;
  final String? loggedAt;
  const CachedRecentServiceLog({
    required this.serviceLogId,
    required this.assignmentId,
    this.loggedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['service_log_id'] = Variable<String>(serviceLogId);
    map['assignment_id'] = Variable<String>(assignmentId);
    if (!nullToAbsent || loggedAt != null) {
      map['logged_at'] = Variable<String>(loggedAt);
    }
    return map;
  }

  CachedRecentServiceLogsCompanion toCompanion(bool nullToAbsent) {
    return CachedRecentServiceLogsCompanion(
      serviceLogId: Value(serviceLogId),
      assignmentId: Value(assignmentId),
      loggedAt: loggedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(loggedAt),
    );
  }

  factory CachedRecentServiceLog.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedRecentServiceLog(
      serviceLogId: serializer.fromJson<String>(json['serviceLogId']),
      assignmentId: serializer.fromJson<String>(json['assignmentId']),
      loggedAt: serializer.fromJson<String?>(json['loggedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'serviceLogId': serializer.toJson<String>(serviceLogId),
      'assignmentId': serializer.toJson<String>(assignmentId),
      'loggedAt': serializer.toJson<String?>(loggedAt),
    };
  }

  CachedRecentServiceLog copyWith({
    String? serviceLogId,
    String? assignmentId,
    Value<String?> loggedAt = const Value.absent(),
  }) => CachedRecentServiceLog(
    serviceLogId: serviceLogId ?? this.serviceLogId,
    assignmentId: assignmentId ?? this.assignmentId,
    loggedAt: loggedAt.present ? loggedAt.value : this.loggedAt,
  );
  CachedRecentServiceLog copyWithCompanion(
    CachedRecentServiceLogsCompanion data,
  ) {
    return CachedRecentServiceLog(
      serviceLogId: data.serviceLogId.present
          ? data.serviceLogId.value
          : this.serviceLogId,
      assignmentId: data.assignmentId.present
          ? data.assignmentId.value
          : this.assignmentId,
      loggedAt: data.loggedAt.present ? data.loggedAt.value : this.loggedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedRecentServiceLog(')
          ..write('serviceLogId: $serviceLogId, ')
          ..write('assignmentId: $assignmentId, ')
          ..write('loggedAt: $loggedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(serviceLogId, assignmentId, loggedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedRecentServiceLog &&
          other.serviceLogId == this.serviceLogId &&
          other.assignmentId == this.assignmentId &&
          other.loggedAt == this.loggedAt);
}

class CachedRecentServiceLogsCompanion
    extends UpdateCompanion<CachedRecentServiceLog> {
  final Value<String> serviceLogId;
  final Value<String> assignmentId;
  final Value<String?> loggedAt;
  final Value<int> rowid;
  const CachedRecentServiceLogsCompanion({
    this.serviceLogId = const Value.absent(),
    this.assignmentId = const Value.absent(),
    this.loggedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedRecentServiceLogsCompanion.insert({
    required String serviceLogId,
    required String assignmentId,
    this.loggedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : serviceLogId = Value(serviceLogId),
       assignmentId = Value(assignmentId);
  static Insertable<CachedRecentServiceLog> custom({
    Expression<String>? serviceLogId,
    Expression<String>? assignmentId,
    Expression<String>? loggedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (serviceLogId != null) 'service_log_id': serviceLogId,
      if (assignmentId != null) 'assignment_id': assignmentId,
      if (loggedAt != null) 'logged_at': loggedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedRecentServiceLogsCompanion copyWith({
    Value<String>? serviceLogId,
    Value<String>? assignmentId,
    Value<String?>? loggedAt,
    Value<int>? rowid,
  }) {
    return CachedRecentServiceLogsCompanion(
      serviceLogId: serviceLogId ?? this.serviceLogId,
      assignmentId: assignmentId ?? this.assignmentId,
      loggedAt: loggedAt ?? this.loggedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (serviceLogId.present) {
      map['service_log_id'] = Variable<String>(serviceLogId.value);
    }
    if (assignmentId.present) {
      map['assignment_id'] = Variable<String>(assignmentId.value);
    }
    if (loggedAt.present) {
      map['logged_at'] = Variable<String>(loggedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedRecentServiceLogsCompanion(')
          ..write('serviceLogId: $serviceLogId, ')
          ..write('assignmentId: $assignmentId, ')
          ..write('loggedAt: $loggedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CachedPassKeysTable extends CachedPassKeys
    with TableInfo<$CachedPassKeysTable, CachedPassKey> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedPassKeysTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _kidMeta = const VerificationMeta('kid');
  @override
  late final GeneratedColumn<String> kid = GeneratedColumn<String>(
    'kid',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _publicKeyMeta = const VerificationMeta(
    'publicKey',
  );
  @override
  late final GeneratedColumn<String> publicKey = GeneratedColumn<String>(
    'public_key',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _validUntilMeta = const VerificationMeta(
    'validUntil',
  );
  @override
  late final GeneratedColumn<String> validUntil = GeneratedColumn<String>(
    'valid_until',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [kid, publicKey, status, validUntil];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_pass_keys';
  @override
  VerificationContext validateIntegrity(
    Insertable<CachedPassKey> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('kid')) {
      context.handle(
        _kidMeta,
        kid.isAcceptableOrUnknown(data['kid']!, _kidMeta),
      );
    } else if (isInserting) {
      context.missing(_kidMeta);
    }
    if (data.containsKey('public_key')) {
      context.handle(
        _publicKeyMeta,
        publicKey.isAcceptableOrUnknown(data['public_key']!, _publicKeyMeta),
      );
    } else if (isInserting) {
      context.missing(_publicKeyMeta);
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    } else if (isInserting) {
      context.missing(_statusMeta);
    }
    if (data.containsKey('valid_until')) {
      context.handle(
        _validUntilMeta,
        validUntil.isAcceptableOrUnknown(data['valid_until']!, _validUntilMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {kid};
  @override
  CachedPassKey map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedPassKey(
      kid: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}kid'],
      )!,
      publicKey: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}public_key'],
      )!,
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      validUntil: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}valid_until'],
      ),
    );
  }

  @override
  $CachedPassKeysTable createAlias(String alias) {
    return $CachedPassKeysTable(attachedDatabase, alias);
  }
}

class CachedPassKey extends DataClass implements Insertable<CachedPassKey> {
  final String kid;

  /// Ed25519 public key, base64url (32 bytes).
  final String publicKey;

  /// `active` | `retired`.
  final String status;

  /// ISO-8601; for retired keys, passes signed by it are accepted until
  /// then. NULL = no limit (active key).
  final String? validUntil;
  const CachedPassKey({
    required this.kid,
    required this.publicKey,
    required this.status,
    this.validUntil,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['kid'] = Variable<String>(kid);
    map['public_key'] = Variable<String>(publicKey);
    map['status'] = Variable<String>(status);
    if (!nullToAbsent || validUntil != null) {
      map['valid_until'] = Variable<String>(validUntil);
    }
    return map;
  }

  CachedPassKeysCompanion toCompanion(bool nullToAbsent) {
    return CachedPassKeysCompanion(
      kid: Value(kid),
      publicKey: Value(publicKey),
      status: Value(status),
      validUntil: validUntil == null && nullToAbsent
          ? const Value.absent()
          : Value(validUntil),
    );
  }

  factory CachedPassKey.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedPassKey(
      kid: serializer.fromJson<String>(json['kid']),
      publicKey: serializer.fromJson<String>(json['publicKey']),
      status: serializer.fromJson<String>(json['status']),
      validUntil: serializer.fromJson<String?>(json['validUntil']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'kid': serializer.toJson<String>(kid),
      'publicKey': serializer.toJson<String>(publicKey),
      'status': serializer.toJson<String>(status),
      'validUntil': serializer.toJson<String?>(validUntil),
    };
  }

  CachedPassKey copyWith({
    String? kid,
    String? publicKey,
    String? status,
    Value<String?> validUntil = const Value.absent(),
  }) => CachedPassKey(
    kid: kid ?? this.kid,
    publicKey: publicKey ?? this.publicKey,
    status: status ?? this.status,
    validUntil: validUntil.present ? validUntil.value : this.validUntil,
  );
  CachedPassKey copyWithCompanion(CachedPassKeysCompanion data) {
    return CachedPassKey(
      kid: data.kid.present ? data.kid.value : this.kid,
      publicKey: data.publicKey.present ? data.publicKey.value : this.publicKey,
      status: data.status.present ? data.status.value : this.status,
      validUntil: data.validUntil.present
          ? data.validUntil.value
          : this.validUntil,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedPassKey(')
          ..write('kid: $kid, ')
          ..write('publicKey: $publicKey, ')
          ..write('status: $status, ')
          ..write('validUntil: $validUntil')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(kid, publicKey, status, validUntil);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedPassKey &&
          other.kid == this.kid &&
          other.publicKey == this.publicKey &&
          other.status == this.status &&
          other.validUntil == this.validUntil);
}

class CachedPassKeysCompanion extends UpdateCompanion<CachedPassKey> {
  final Value<String> kid;
  final Value<String> publicKey;
  final Value<String> status;
  final Value<String?> validUntil;
  final Value<int> rowid;
  const CachedPassKeysCompanion({
    this.kid = const Value.absent(),
    this.publicKey = const Value.absent(),
    this.status = const Value.absent(),
    this.validUntil = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedPassKeysCompanion.insert({
    required String kid,
    required String publicKey,
    required String status,
    this.validUntil = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : kid = Value(kid),
       publicKey = Value(publicKey),
       status = Value(status);
  static Insertable<CachedPassKey> custom({
    Expression<String>? kid,
    Expression<String>? publicKey,
    Expression<String>? status,
    Expression<String>? validUntil,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (kid != null) 'kid': kid,
      if (publicKey != null) 'public_key': publicKey,
      if (status != null) 'status': status,
      if (validUntil != null) 'valid_until': validUntil,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedPassKeysCompanion copyWith({
    Value<String>? kid,
    Value<String>? publicKey,
    Value<String>? status,
    Value<String?>? validUntil,
    Value<int>? rowid,
  }) {
    return CachedPassKeysCompanion(
      kid: kid ?? this.kid,
      publicKey: publicKey ?? this.publicKey,
      status: status ?? this.status,
      validUntil: validUntil ?? this.validUntil,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (kid.present) {
      map['kid'] = Variable<String>(kid.value);
    }
    if (publicKey.present) {
      map['public_key'] = Variable<String>(publicKey.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (validUntil.present) {
      map['valid_until'] = Variable<String>(validUntil.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedPassKeysCompanion(')
          ..write('kid: $kid, ')
          ..write('publicKey: $publicKey, ')
          ..write('status: $status, ')
          ..write('validUntil: $validUntil, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CachedTrainersTable extends CachedTrainers
    with TableInfo<$CachedTrainersTable, CachedTrainer> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedTrainersTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant(''),
  );
  static const VerificationMeta _serviceTypeMeta = const VerificationMeta(
    'serviceType',
  );
  @override
  late final GeneratedColumn<String> serviceType = GeneratedColumn<String>(
    'service_type',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _isActiveMeta = const VerificationMeta(
    'isActive',
  );
  @override
  late final GeneratedColumn<bool> isActive = GeneratedColumn<bool>(
    'is_active',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("is_active" IN (0, 1))',
    ),
    defaultValue: const Constant(true),
  );
  @override
  List<GeneratedColumn> get $columns => [id, name, serviceType, isActive];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_trainers';
  @override
  VerificationContext validateIntegrity(
    Insertable<CachedTrainer> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
        _nameMeta,
        name.isAcceptableOrUnknown(data['name']!, _nameMeta),
      );
    }
    if (data.containsKey('service_type')) {
      context.handle(
        _serviceTypeMeta,
        serviceType.isAcceptableOrUnknown(
          data['service_type']!,
          _serviceTypeMeta,
        ),
      );
    }
    if (data.containsKey('is_active')) {
      context.handle(
        _isActiveMeta,
        isActive.isAcceptableOrUnknown(data['is_active']!, _isActiveMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CachedTrainer map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedTrainer(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      name: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}name'],
      )!,
      serviceType: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}service_type'],
      ),
      isActive: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}is_active'],
      )!,
    );
  }

  @override
  $CachedTrainersTable createAlias(String alias) {
    return $CachedTrainersTable(attachedDatabase, alias);
  }
}

class CachedTrainer extends DataClass implements Insertable<CachedTrainer> {
  final String id;
  final String name;
  final String? serviceType;
  final bool isActive;
  const CachedTrainer({
    required this.id,
    required this.name,
    this.serviceType,
    required this.isActive,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['name'] = Variable<String>(name);
    if (!nullToAbsent || serviceType != null) {
      map['service_type'] = Variable<String>(serviceType);
    }
    map['is_active'] = Variable<bool>(isActive);
    return map;
  }

  CachedTrainersCompanion toCompanion(bool nullToAbsent) {
    return CachedTrainersCompanion(
      id: Value(id),
      name: Value(name),
      serviceType: serviceType == null && nullToAbsent
          ? const Value.absent()
          : Value(serviceType),
      isActive: Value(isActive),
    );
  }

  factory CachedTrainer.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedTrainer(
      id: serializer.fromJson<String>(json['id']),
      name: serializer.fromJson<String>(json['name']),
      serviceType: serializer.fromJson<String?>(json['serviceType']),
      isActive: serializer.fromJson<bool>(json['isActive']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'name': serializer.toJson<String>(name),
      'serviceType': serializer.toJson<String?>(serviceType),
      'isActive': serializer.toJson<bool>(isActive),
    };
  }

  CachedTrainer copyWith({
    String? id,
    String? name,
    Value<String?> serviceType = const Value.absent(),
    bool? isActive,
  }) => CachedTrainer(
    id: id ?? this.id,
    name: name ?? this.name,
    serviceType: serviceType.present ? serviceType.value : this.serviceType,
    isActive: isActive ?? this.isActive,
  );
  CachedTrainer copyWithCompanion(CachedTrainersCompanion data) {
    return CachedTrainer(
      id: data.id.present ? data.id.value : this.id,
      name: data.name.present ? data.name.value : this.name,
      serviceType: data.serviceType.present
          ? data.serviceType.value
          : this.serviceType,
      isActive: data.isActive.present ? data.isActive.value : this.isActive,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedTrainer(')
          ..write('id: $id, ')
          ..write('name: $name, ')
          ..write('serviceType: $serviceType, ')
          ..write('isActive: $isActive')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, name, serviceType, isActive);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedTrainer &&
          other.id == this.id &&
          other.name == this.name &&
          other.serviceType == this.serviceType &&
          other.isActive == this.isActive);
}

class CachedTrainersCompanion extends UpdateCompanion<CachedTrainer> {
  final Value<String> id;
  final Value<String> name;
  final Value<String?> serviceType;
  final Value<bool> isActive;
  final Value<int> rowid;
  const CachedTrainersCompanion({
    this.id = const Value.absent(),
    this.name = const Value.absent(),
    this.serviceType = const Value.absent(),
    this.isActive = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedTrainersCompanion.insert({
    required String id,
    this.name = const Value.absent(),
    this.serviceType = const Value.absent(),
    this.isActive = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id);
  static Insertable<CachedTrainer> custom({
    Expression<String>? id,
    Expression<String>? name,
    Expression<String>? serviceType,
    Expression<bool>? isActive,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (name != null) 'name': name,
      if (serviceType != null) 'service_type': serviceType,
      if (isActive != null) 'is_active': isActive,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedTrainersCompanion copyWith({
    Value<String>? id,
    Value<String>? name,
    Value<String?>? serviceType,
    Value<bool>? isActive,
    Value<int>? rowid,
  }) {
    return CachedTrainersCompanion(
      id: id ?? this.id,
      name: name ?? this.name,
      serviceType: serviceType ?? this.serviceType,
      isActive: isActive ?? this.isActive,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (serviceType.present) {
      map['service_type'] = Variable<String>(serviceType.value);
    }
    if (isActive.present) {
      map['is_active'] = Variable<bool>(isActive.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedTrainersCompanion(')
          ..write('id: $id, ')
          ..write('name: $name, ')
          ..write('serviceType: $serviceType, ')
          ..write('isActive: $isActive, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $SyncMetaTable extends SyncMeta
    with TableInfo<$SyncMetaTable, SyncMetaEntry> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $SyncMetaTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _keyMeta = const VerificationMeta('key');
  @override
  late final GeneratedColumn<String> key = GeneratedColumn<String>(
    'key',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _valueMeta = const VerificationMeta('value');
  @override
  late final GeneratedColumn<String> value = GeneratedColumn<String>(
    'value',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [key, value];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'sync_meta';
  @override
  VerificationContext validateIntegrity(
    Insertable<SyncMetaEntry> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('key')) {
      context.handle(
        _keyMeta,
        key.isAcceptableOrUnknown(data['key']!, _keyMeta),
      );
    } else if (isInserting) {
      context.missing(_keyMeta);
    }
    if (data.containsKey('value')) {
      context.handle(
        _valueMeta,
        value.isAcceptableOrUnknown(data['value']!, _valueMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {key};
  @override
  SyncMetaEntry map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return SyncMetaEntry(
      key: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}key'],
      )!,
      value: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}value'],
      ),
    );
  }

  @override
  $SyncMetaTable createAlias(String alias) {
    return $SyncMetaTable(attachedDatabase, alias);
  }
}

class SyncMetaEntry extends DataClass implements Insertable<SyncMetaEntry> {
  final String key;
  final String? value;
  const SyncMetaEntry({required this.key, this.value});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['key'] = Variable<String>(key);
    if (!nullToAbsent || value != null) {
      map['value'] = Variable<String>(value);
    }
    return map;
  }

  SyncMetaCompanion toCompanion(bool nullToAbsent) {
    return SyncMetaCompanion(
      key: Value(key),
      value: value == null && nullToAbsent
          ? const Value.absent()
          : Value(value),
    );
  }

  factory SyncMetaEntry.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return SyncMetaEntry(
      key: serializer.fromJson<String>(json['key']),
      value: serializer.fromJson<String?>(json['value']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'key': serializer.toJson<String>(key),
      'value': serializer.toJson<String?>(value),
    };
  }

  SyncMetaEntry copyWith({
    String? key,
    Value<String?> value = const Value.absent(),
  }) => SyncMetaEntry(
    key: key ?? this.key,
    value: value.present ? value.value : this.value,
  );
  SyncMetaEntry copyWithCompanion(SyncMetaCompanion data) {
    return SyncMetaEntry(
      key: data.key.present ? data.key.value : this.key,
      value: data.value.present ? data.value.value : this.value,
    );
  }

  @override
  String toString() {
    return (StringBuffer('SyncMetaEntry(')
          ..write('key: $key, ')
          ..write('value: $value')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(key, value);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SyncMetaEntry &&
          other.key == this.key &&
          other.value == this.value);
}

class SyncMetaCompanion extends UpdateCompanion<SyncMetaEntry> {
  final Value<String> key;
  final Value<String?> value;
  final Value<int> rowid;
  const SyncMetaCompanion({
    this.key = const Value.absent(),
    this.value = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  SyncMetaCompanion.insert({
    required String key,
    this.value = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : key = Value(key);
  static Insertable<SyncMetaEntry> custom({
    Expression<String>? key,
    Expression<String>? value,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (key != null) 'key': key,
      if (value != null) 'value': value,
      if (rowid != null) 'rowid': rowid,
    });
  }

  SyncMetaCompanion copyWith({
    Value<String>? key,
    Value<String?>? value,
    Value<int>? rowid,
  }) {
    return SyncMetaCompanion(
      key: key ?? this.key,
      value: value ?? this.value,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (key.present) {
      map['key'] = Variable<String>(key.value);
    }
    if (value.present) {
      map['value'] = Variable<String>(value.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('SyncMetaCompanion(')
          ..write('key: $key, ')
          ..write('value: $value, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$OfflineDatabase extends GeneratedDatabase {
  _$OfflineDatabase(QueryExecutor e) : super(e);
  $OfflineDatabaseManager get managers => $OfflineDatabaseManager(this);
  late final $OutboxEventsTable outboxEvents = $OutboxEventsTable(this);
  late final $CachedMembersTable cachedMembers = $CachedMembersTable(this);
  late final $CachedMembershipsTable cachedMemberships =
      $CachedMembershipsTable(this);
  late final $CachedBranchesTable cachedBranches = $CachedBranchesTable(this);
  late final $CachedClassSessionsTable cachedClassSessions =
      $CachedClassSessionsTable(this);
  late final $CachedAssignmentsTable cachedAssignments =
      $CachedAssignmentsTable(this);
  late final $CachedRecentAttendanceTable cachedRecentAttendance =
      $CachedRecentAttendanceTable(this);
  late final $CachedRecentServiceLogsTable cachedRecentServiceLogs =
      $CachedRecentServiceLogsTable(this);
  late final $CachedPassKeysTable cachedPassKeys = $CachedPassKeysTable(this);
  late final $CachedTrainersTable cachedTrainers = $CachedTrainersTable(this);
  late final $SyncMetaTable syncMeta = $SyncMetaTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    outboxEvents,
    cachedMembers,
    cachedMemberships,
    cachedBranches,
    cachedClassSessions,
    cachedAssignments,
    cachedRecentAttendance,
    cachedRecentServiceLogs,
    cachedPassKeys,
    cachedTrainers,
    syncMeta,
  ];
}

typedef $$OutboxEventsTableCreateCompanionBuilder =
    OutboxEventsCompanion Function({
      required String eventId,
      required String kind,
      Value<String?> attendanceMethod,
      required String gymId,
      Value<String?> branchId,
      required String memberId,
      Value<String?> classSessionId,
      Value<String?> studioId,
      Value<String?> serviceAssignmentId,
      Value<String?> trainerId,
      required String deviceRecordedAt,
      required int deviceRecordedAtMs,
      required String deviceTimezone,
      Value<String?> qrRaw,
      Value<String?> note,
      Value<String> metadata,
      required String actorUserId,
      required String actorType,
      required String deviceId,
      Value<String> syncStatus,
      Value<int> syncAttempts,
      Value<int?> nextAttemptAt,
      Value<int?> lastAttemptAt,
      Value<String?> lastSyncError,
      Value<String?> resultStatus,
      Value<String?> resultCode,
      Value<String?> resultMessage,
      Value<String?> officialId,
      Value<String> flags,
      Value<String?> serverReceivedAt,
      Value<String?> processedAt,
      required int createdAt,
      Value<int> rowid,
    });
typedef $$OutboxEventsTableUpdateCompanionBuilder =
    OutboxEventsCompanion Function({
      Value<String> eventId,
      Value<String> kind,
      Value<String?> attendanceMethod,
      Value<String> gymId,
      Value<String?> branchId,
      Value<String> memberId,
      Value<String?> classSessionId,
      Value<String?> studioId,
      Value<String?> serviceAssignmentId,
      Value<String?> trainerId,
      Value<String> deviceRecordedAt,
      Value<int> deviceRecordedAtMs,
      Value<String> deviceTimezone,
      Value<String?> qrRaw,
      Value<String?> note,
      Value<String> metadata,
      Value<String> actorUserId,
      Value<String> actorType,
      Value<String> deviceId,
      Value<String> syncStatus,
      Value<int> syncAttempts,
      Value<int?> nextAttemptAt,
      Value<int?> lastAttemptAt,
      Value<String?> lastSyncError,
      Value<String?> resultStatus,
      Value<String?> resultCode,
      Value<String?> resultMessage,
      Value<String?> officialId,
      Value<String> flags,
      Value<String?> serverReceivedAt,
      Value<String?> processedAt,
      Value<int> createdAt,
      Value<int> rowid,
    });

class $$OutboxEventsTableFilterComposer
    extends Composer<_$OfflineDatabase, $OutboxEventsTable> {
  $$OutboxEventsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get eventId => $composableBuilder(
    column: $table.eventId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get kind => $composableBuilder(
    column: $table.kind,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get attendanceMethod => $composableBuilder(
    column: $table.attendanceMethod,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get gymId => $composableBuilder(
    column: $table.gymId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get branchId => $composableBuilder(
    column: $table.branchId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get memberId => $composableBuilder(
    column: $table.memberId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get classSessionId => $composableBuilder(
    column: $table.classSessionId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get studioId => $composableBuilder(
    column: $table.studioId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get serviceAssignmentId => $composableBuilder(
    column: $table.serviceAssignmentId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get trainerId => $composableBuilder(
    column: $table.trainerId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get deviceRecordedAt => $composableBuilder(
    column: $table.deviceRecordedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get deviceRecordedAtMs => $composableBuilder(
    column: $table.deviceRecordedAtMs,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get deviceTimezone => $composableBuilder(
    column: $table.deviceTimezone,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get qrRaw => $composableBuilder(
    column: $table.qrRaw,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get note => $composableBuilder(
    column: $table.note,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get metadata => $composableBuilder(
    column: $table.metadata,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get actorUserId => $composableBuilder(
    column: $table.actorUserId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get actorType => $composableBuilder(
    column: $table.actorType,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get deviceId => $composableBuilder(
    column: $table.deviceId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get syncStatus => $composableBuilder(
    column: $table.syncStatus,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get syncAttempts => $composableBuilder(
    column: $table.syncAttempts,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get nextAttemptAt => $composableBuilder(
    column: $table.nextAttemptAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get lastAttemptAt => $composableBuilder(
    column: $table.lastAttemptAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get lastSyncError => $composableBuilder(
    column: $table.lastSyncError,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get resultStatus => $composableBuilder(
    column: $table.resultStatus,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get resultCode => $composableBuilder(
    column: $table.resultCode,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get resultMessage => $composableBuilder(
    column: $table.resultMessage,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get officialId => $composableBuilder(
    column: $table.officialId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get flags => $composableBuilder(
    column: $table.flags,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get serverReceivedAt => $composableBuilder(
    column: $table.serverReceivedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get processedAt => $composableBuilder(
    column: $table.processedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$OutboxEventsTableOrderingComposer
    extends Composer<_$OfflineDatabase, $OutboxEventsTable> {
  $$OutboxEventsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get eventId => $composableBuilder(
    column: $table.eventId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get kind => $composableBuilder(
    column: $table.kind,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get attendanceMethod => $composableBuilder(
    column: $table.attendanceMethod,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get gymId => $composableBuilder(
    column: $table.gymId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get branchId => $composableBuilder(
    column: $table.branchId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get memberId => $composableBuilder(
    column: $table.memberId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get classSessionId => $composableBuilder(
    column: $table.classSessionId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get studioId => $composableBuilder(
    column: $table.studioId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get serviceAssignmentId => $composableBuilder(
    column: $table.serviceAssignmentId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get trainerId => $composableBuilder(
    column: $table.trainerId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get deviceRecordedAt => $composableBuilder(
    column: $table.deviceRecordedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get deviceRecordedAtMs => $composableBuilder(
    column: $table.deviceRecordedAtMs,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get deviceTimezone => $composableBuilder(
    column: $table.deviceTimezone,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get qrRaw => $composableBuilder(
    column: $table.qrRaw,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get note => $composableBuilder(
    column: $table.note,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get metadata => $composableBuilder(
    column: $table.metadata,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get actorUserId => $composableBuilder(
    column: $table.actorUserId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get actorType => $composableBuilder(
    column: $table.actorType,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get deviceId => $composableBuilder(
    column: $table.deviceId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get syncStatus => $composableBuilder(
    column: $table.syncStatus,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get syncAttempts => $composableBuilder(
    column: $table.syncAttempts,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get nextAttemptAt => $composableBuilder(
    column: $table.nextAttemptAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get lastAttemptAt => $composableBuilder(
    column: $table.lastAttemptAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get lastSyncError => $composableBuilder(
    column: $table.lastSyncError,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get resultStatus => $composableBuilder(
    column: $table.resultStatus,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get resultCode => $composableBuilder(
    column: $table.resultCode,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get resultMessage => $composableBuilder(
    column: $table.resultMessage,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get officialId => $composableBuilder(
    column: $table.officialId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get flags => $composableBuilder(
    column: $table.flags,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get serverReceivedAt => $composableBuilder(
    column: $table.serverReceivedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get processedAt => $composableBuilder(
    column: $table.processedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$OutboxEventsTableAnnotationComposer
    extends Composer<_$OfflineDatabase, $OutboxEventsTable> {
  $$OutboxEventsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get eventId =>
      $composableBuilder(column: $table.eventId, builder: (column) => column);

  GeneratedColumn<String> get kind =>
      $composableBuilder(column: $table.kind, builder: (column) => column);

  GeneratedColumn<String> get attendanceMethod => $composableBuilder(
    column: $table.attendanceMethod,
    builder: (column) => column,
  );

  GeneratedColumn<String> get gymId =>
      $composableBuilder(column: $table.gymId, builder: (column) => column);

  GeneratedColumn<String> get branchId =>
      $composableBuilder(column: $table.branchId, builder: (column) => column);

  GeneratedColumn<String> get memberId =>
      $composableBuilder(column: $table.memberId, builder: (column) => column);

  GeneratedColumn<String> get classSessionId => $composableBuilder(
    column: $table.classSessionId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get studioId =>
      $composableBuilder(column: $table.studioId, builder: (column) => column);

  GeneratedColumn<String> get serviceAssignmentId => $composableBuilder(
    column: $table.serviceAssignmentId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get trainerId =>
      $composableBuilder(column: $table.trainerId, builder: (column) => column);

  GeneratedColumn<String> get deviceRecordedAt => $composableBuilder(
    column: $table.deviceRecordedAt,
    builder: (column) => column,
  );

  GeneratedColumn<int> get deviceRecordedAtMs => $composableBuilder(
    column: $table.deviceRecordedAtMs,
    builder: (column) => column,
  );

  GeneratedColumn<String> get deviceTimezone => $composableBuilder(
    column: $table.deviceTimezone,
    builder: (column) => column,
  );

  GeneratedColumn<String> get qrRaw =>
      $composableBuilder(column: $table.qrRaw, builder: (column) => column);

  GeneratedColumn<String> get note =>
      $composableBuilder(column: $table.note, builder: (column) => column);

  GeneratedColumn<String> get metadata =>
      $composableBuilder(column: $table.metadata, builder: (column) => column);

  GeneratedColumn<String> get actorUserId => $composableBuilder(
    column: $table.actorUserId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get actorType =>
      $composableBuilder(column: $table.actorType, builder: (column) => column);

  GeneratedColumn<String> get deviceId =>
      $composableBuilder(column: $table.deviceId, builder: (column) => column);

  GeneratedColumn<String> get syncStatus => $composableBuilder(
    column: $table.syncStatus,
    builder: (column) => column,
  );

  GeneratedColumn<int> get syncAttempts => $composableBuilder(
    column: $table.syncAttempts,
    builder: (column) => column,
  );

  GeneratedColumn<int> get nextAttemptAt => $composableBuilder(
    column: $table.nextAttemptAt,
    builder: (column) => column,
  );

  GeneratedColumn<int> get lastAttemptAt => $composableBuilder(
    column: $table.lastAttemptAt,
    builder: (column) => column,
  );

  GeneratedColumn<String> get lastSyncError => $composableBuilder(
    column: $table.lastSyncError,
    builder: (column) => column,
  );

  GeneratedColumn<String> get resultStatus => $composableBuilder(
    column: $table.resultStatus,
    builder: (column) => column,
  );

  GeneratedColumn<String> get resultCode => $composableBuilder(
    column: $table.resultCode,
    builder: (column) => column,
  );

  GeneratedColumn<String> get resultMessage => $composableBuilder(
    column: $table.resultMessage,
    builder: (column) => column,
  );

  GeneratedColumn<String> get officialId => $composableBuilder(
    column: $table.officialId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get flags =>
      $composableBuilder(column: $table.flags, builder: (column) => column);

  GeneratedColumn<String> get serverReceivedAt => $composableBuilder(
    column: $table.serverReceivedAt,
    builder: (column) => column,
  );

  GeneratedColumn<String> get processedAt => $composableBuilder(
    column: $table.processedAt,
    builder: (column) => column,
  );

  GeneratedColumn<int> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$OutboxEventsTableTableManager
    extends
        RootTableManager<
          _$OfflineDatabase,
          $OutboxEventsTable,
          OutboxEvent,
          $$OutboxEventsTableFilterComposer,
          $$OutboxEventsTableOrderingComposer,
          $$OutboxEventsTableAnnotationComposer,
          $$OutboxEventsTableCreateCompanionBuilder,
          $$OutboxEventsTableUpdateCompanionBuilder,
          (
            OutboxEvent,
            BaseReferences<_$OfflineDatabase, $OutboxEventsTable, OutboxEvent>,
          ),
          OutboxEvent,
          PrefetchHooks Function()
        > {
  $$OutboxEventsTableTableManager(
    _$OfflineDatabase db,
    $OutboxEventsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$OutboxEventsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$OutboxEventsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$OutboxEventsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> eventId = const Value.absent(),
                Value<String> kind = const Value.absent(),
                Value<String?> attendanceMethod = const Value.absent(),
                Value<String> gymId = const Value.absent(),
                Value<String?> branchId = const Value.absent(),
                Value<String> memberId = const Value.absent(),
                Value<String?> classSessionId = const Value.absent(),
                Value<String?> studioId = const Value.absent(),
                Value<String?> serviceAssignmentId = const Value.absent(),
                Value<String?> trainerId = const Value.absent(),
                Value<String> deviceRecordedAt = const Value.absent(),
                Value<int> deviceRecordedAtMs = const Value.absent(),
                Value<String> deviceTimezone = const Value.absent(),
                Value<String?> qrRaw = const Value.absent(),
                Value<String?> note = const Value.absent(),
                Value<String> metadata = const Value.absent(),
                Value<String> actorUserId = const Value.absent(),
                Value<String> actorType = const Value.absent(),
                Value<String> deviceId = const Value.absent(),
                Value<String> syncStatus = const Value.absent(),
                Value<int> syncAttempts = const Value.absent(),
                Value<int?> nextAttemptAt = const Value.absent(),
                Value<int?> lastAttemptAt = const Value.absent(),
                Value<String?> lastSyncError = const Value.absent(),
                Value<String?> resultStatus = const Value.absent(),
                Value<String?> resultCode = const Value.absent(),
                Value<String?> resultMessage = const Value.absent(),
                Value<String?> officialId = const Value.absent(),
                Value<String> flags = const Value.absent(),
                Value<String?> serverReceivedAt = const Value.absent(),
                Value<String?> processedAt = const Value.absent(),
                Value<int> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => OutboxEventsCompanion(
                eventId: eventId,
                kind: kind,
                attendanceMethod: attendanceMethod,
                gymId: gymId,
                branchId: branchId,
                memberId: memberId,
                classSessionId: classSessionId,
                studioId: studioId,
                serviceAssignmentId: serviceAssignmentId,
                trainerId: trainerId,
                deviceRecordedAt: deviceRecordedAt,
                deviceRecordedAtMs: deviceRecordedAtMs,
                deviceTimezone: deviceTimezone,
                qrRaw: qrRaw,
                note: note,
                metadata: metadata,
                actorUserId: actorUserId,
                actorType: actorType,
                deviceId: deviceId,
                syncStatus: syncStatus,
                syncAttempts: syncAttempts,
                nextAttemptAt: nextAttemptAt,
                lastAttemptAt: lastAttemptAt,
                lastSyncError: lastSyncError,
                resultStatus: resultStatus,
                resultCode: resultCode,
                resultMessage: resultMessage,
                officialId: officialId,
                flags: flags,
                serverReceivedAt: serverReceivedAt,
                processedAt: processedAt,
                createdAt: createdAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String eventId,
                required String kind,
                Value<String?> attendanceMethod = const Value.absent(),
                required String gymId,
                Value<String?> branchId = const Value.absent(),
                required String memberId,
                Value<String?> classSessionId = const Value.absent(),
                Value<String?> studioId = const Value.absent(),
                Value<String?> serviceAssignmentId = const Value.absent(),
                Value<String?> trainerId = const Value.absent(),
                required String deviceRecordedAt,
                required int deviceRecordedAtMs,
                required String deviceTimezone,
                Value<String?> qrRaw = const Value.absent(),
                Value<String?> note = const Value.absent(),
                Value<String> metadata = const Value.absent(),
                required String actorUserId,
                required String actorType,
                required String deviceId,
                Value<String> syncStatus = const Value.absent(),
                Value<int> syncAttempts = const Value.absent(),
                Value<int?> nextAttemptAt = const Value.absent(),
                Value<int?> lastAttemptAt = const Value.absent(),
                Value<String?> lastSyncError = const Value.absent(),
                Value<String?> resultStatus = const Value.absent(),
                Value<String?> resultCode = const Value.absent(),
                Value<String?> resultMessage = const Value.absent(),
                Value<String?> officialId = const Value.absent(),
                Value<String> flags = const Value.absent(),
                Value<String?> serverReceivedAt = const Value.absent(),
                Value<String?> processedAt = const Value.absent(),
                required int createdAt,
                Value<int> rowid = const Value.absent(),
              }) => OutboxEventsCompanion.insert(
                eventId: eventId,
                kind: kind,
                attendanceMethod: attendanceMethod,
                gymId: gymId,
                branchId: branchId,
                memberId: memberId,
                classSessionId: classSessionId,
                studioId: studioId,
                serviceAssignmentId: serviceAssignmentId,
                trainerId: trainerId,
                deviceRecordedAt: deviceRecordedAt,
                deviceRecordedAtMs: deviceRecordedAtMs,
                deviceTimezone: deviceTimezone,
                qrRaw: qrRaw,
                note: note,
                metadata: metadata,
                actorUserId: actorUserId,
                actorType: actorType,
                deviceId: deviceId,
                syncStatus: syncStatus,
                syncAttempts: syncAttempts,
                nextAttemptAt: nextAttemptAt,
                lastAttemptAt: lastAttemptAt,
                lastSyncError: lastSyncError,
                resultStatus: resultStatus,
                resultCode: resultCode,
                resultMessage: resultMessage,
                officialId: officialId,
                flags: flags,
                serverReceivedAt: serverReceivedAt,
                processedAt: processedAt,
                createdAt: createdAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$OutboxEventsTable, OutboxEvent>(table),
                  BaseReferences<
                    _$OfflineDatabase,
                    $OutboxEventsTable,
                    OutboxEvent
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$OutboxEventsTableProcessedTableManager =
    ProcessedTableManager<
      _$OfflineDatabase,
      $OutboxEventsTable,
      OutboxEvent,
      $$OutboxEventsTableFilterComposer,
      $$OutboxEventsTableOrderingComposer,
      $$OutboxEventsTableAnnotationComposer,
      $$OutboxEventsTableCreateCompanionBuilder,
      $$OutboxEventsTableUpdateCompanionBuilder,
      (
        OutboxEvent,
        BaseReferences<_$OfflineDatabase, $OutboxEventsTable, OutboxEvent>,
      ),
      OutboxEvent,
      PrefetchHooks Function()
    >;
typedef $$CachedMembersTableCreateCompanionBuilder =
    CachedMembersCompanion Function({
      required String gymMemberId,
      Value<String?> memberNumber,
      required String fullName,
      required String searchText,
      Value<String?> phoneLast4,
      Value<String?> photoUrl,
      Value<String?> status,
      Value<int> rowid,
    });
typedef $$CachedMembersTableUpdateCompanionBuilder =
    CachedMembersCompanion Function({
      Value<String> gymMemberId,
      Value<String?> memberNumber,
      Value<String> fullName,
      Value<String> searchText,
      Value<String?> phoneLast4,
      Value<String?> photoUrl,
      Value<String?> status,
      Value<int> rowid,
    });

class $$CachedMembersTableFilterComposer
    extends Composer<_$OfflineDatabase, $CachedMembersTable> {
  $$CachedMembersTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get gymMemberId => $composableBuilder(
    column: $table.gymMemberId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get memberNumber => $composableBuilder(
    column: $table.memberNumber,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get fullName => $composableBuilder(
    column: $table.fullName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get searchText => $composableBuilder(
    column: $table.searchText,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get phoneLast4 => $composableBuilder(
    column: $table.phoneLast4,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get photoUrl => $composableBuilder(
    column: $table.photoUrl,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CachedMembersTableOrderingComposer
    extends Composer<_$OfflineDatabase, $CachedMembersTable> {
  $$CachedMembersTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get gymMemberId => $composableBuilder(
    column: $table.gymMemberId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get memberNumber => $composableBuilder(
    column: $table.memberNumber,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get fullName => $composableBuilder(
    column: $table.fullName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get searchText => $composableBuilder(
    column: $table.searchText,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get phoneLast4 => $composableBuilder(
    column: $table.phoneLast4,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get photoUrl => $composableBuilder(
    column: $table.photoUrl,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CachedMembersTableAnnotationComposer
    extends Composer<_$OfflineDatabase, $CachedMembersTable> {
  $$CachedMembersTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get gymMemberId => $composableBuilder(
    column: $table.gymMemberId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get memberNumber => $composableBuilder(
    column: $table.memberNumber,
    builder: (column) => column,
  );

  GeneratedColumn<String> get fullName =>
      $composableBuilder(column: $table.fullName, builder: (column) => column);

  GeneratedColumn<String> get searchText => $composableBuilder(
    column: $table.searchText,
    builder: (column) => column,
  );

  GeneratedColumn<String> get phoneLast4 => $composableBuilder(
    column: $table.phoneLast4,
    builder: (column) => column,
  );

  GeneratedColumn<String> get photoUrl =>
      $composableBuilder(column: $table.photoUrl, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);
}

class $$CachedMembersTableTableManager
    extends
        RootTableManager<
          _$OfflineDatabase,
          $CachedMembersTable,
          CachedMember,
          $$CachedMembersTableFilterComposer,
          $$CachedMembersTableOrderingComposer,
          $$CachedMembersTableAnnotationComposer,
          $$CachedMembersTableCreateCompanionBuilder,
          $$CachedMembersTableUpdateCompanionBuilder,
          (
            CachedMember,
            BaseReferences<
              _$OfflineDatabase,
              $CachedMembersTable,
              CachedMember
            >,
          ),
          CachedMember,
          PrefetchHooks Function()
        > {
  $$CachedMembersTableTableManager(
    _$OfflineDatabase db,
    $CachedMembersTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedMembersTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedMembersTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedMembersTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> gymMemberId = const Value.absent(),
                Value<String?> memberNumber = const Value.absent(),
                Value<String> fullName = const Value.absent(),
                Value<String> searchText = const Value.absent(),
                Value<String?> phoneLast4 = const Value.absent(),
                Value<String?> photoUrl = const Value.absent(),
                Value<String?> status = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedMembersCompanion(
                gymMemberId: gymMemberId,
                memberNumber: memberNumber,
                fullName: fullName,
                searchText: searchText,
                phoneLast4: phoneLast4,
                photoUrl: photoUrl,
                status: status,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String gymMemberId,
                Value<String?> memberNumber = const Value.absent(),
                required String fullName,
                required String searchText,
                Value<String?> phoneLast4 = const Value.absent(),
                Value<String?> photoUrl = const Value.absent(),
                Value<String?> status = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedMembersCompanion.insert(
                gymMemberId: gymMemberId,
                memberNumber: memberNumber,
                fullName: fullName,
                searchText: searchText,
                phoneLast4: phoneLast4,
                photoUrl: photoUrl,
                status: status,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$CachedMembersTable, CachedMember>(table),
                  BaseReferences<
                    _$OfflineDatabase,
                    $CachedMembersTable,
                    CachedMember
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CachedMembersTableProcessedTableManager =
    ProcessedTableManager<
      _$OfflineDatabase,
      $CachedMembersTable,
      CachedMember,
      $$CachedMembersTableFilterComposer,
      $$CachedMembersTableOrderingComposer,
      $$CachedMembersTableAnnotationComposer,
      $$CachedMembersTableCreateCompanionBuilder,
      $$CachedMembersTableUpdateCompanionBuilder,
      (
        CachedMember,
        BaseReferences<_$OfflineDatabase, $CachedMembersTable, CachedMember>,
      ),
      CachedMember,
      PrefetchHooks Function()
    >;
typedef $$CachedMembershipsTableCreateCompanionBuilder =
    CachedMembershipsCompanion Function({
      required String membershipId,
      required String gymMemberId,
      Value<String?> planType,
      Value<String?> sourceType,
      Value<String?> status,
      Value<String?> paymentStatus,
      Value<String?> startDate,
      Value<String?> endDate,
      Value<int?> sessionsRemaining,
      Value<int?> sessionsTotal,
      Value<String?> freezeStatus,
      Value<String?> allowedBranchIds,
      Value<int> rowid,
    });
typedef $$CachedMembershipsTableUpdateCompanionBuilder =
    CachedMembershipsCompanion Function({
      Value<String> membershipId,
      Value<String> gymMemberId,
      Value<String?> planType,
      Value<String?> sourceType,
      Value<String?> status,
      Value<String?> paymentStatus,
      Value<String?> startDate,
      Value<String?> endDate,
      Value<int?> sessionsRemaining,
      Value<int?> sessionsTotal,
      Value<String?> freezeStatus,
      Value<String?> allowedBranchIds,
      Value<int> rowid,
    });

class $$CachedMembershipsTableFilterComposer
    extends Composer<_$OfflineDatabase, $CachedMembershipsTable> {
  $$CachedMembershipsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get membershipId => $composableBuilder(
    column: $table.membershipId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get gymMemberId => $composableBuilder(
    column: $table.gymMemberId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get planType => $composableBuilder(
    column: $table.planType,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get sourceType => $composableBuilder(
    column: $table.sourceType,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get paymentStatus => $composableBuilder(
    column: $table.paymentStatus,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get startDate => $composableBuilder(
    column: $table.startDate,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get endDate => $composableBuilder(
    column: $table.endDate,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get sessionsRemaining => $composableBuilder(
    column: $table.sessionsRemaining,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get sessionsTotal => $composableBuilder(
    column: $table.sessionsTotal,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get freezeStatus => $composableBuilder(
    column: $table.freezeStatus,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get allowedBranchIds => $composableBuilder(
    column: $table.allowedBranchIds,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CachedMembershipsTableOrderingComposer
    extends Composer<_$OfflineDatabase, $CachedMembershipsTable> {
  $$CachedMembershipsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get membershipId => $composableBuilder(
    column: $table.membershipId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get gymMemberId => $composableBuilder(
    column: $table.gymMemberId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get planType => $composableBuilder(
    column: $table.planType,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get sourceType => $composableBuilder(
    column: $table.sourceType,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get paymentStatus => $composableBuilder(
    column: $table.paymentStatus,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get startDate => $composableBuilder(
    column: $table.startDate,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get endDate => $composableBuilder(
    column: $table.endDate,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get sessionsRemaining => $composableBuilder(
    column: $table.sessionsRemaining,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get sessionsTotal => $composableBuilder(
    column: $table.sessionsTotal,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get freezeStatus => $composableBuilder(
    column: $table.freezeStatus,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get allowedBranchIds => $composableBuilder(
    column: $table.allowedBranchIds,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CachedMembershipsTableAnnotationComposer
    extends Composer<_$OfflineDatabase, $CachedMembershipsTable> {
  $$CachedMembershipsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get membershipId => $composableBuilder(
    column: $table.membershipId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get gymMemberId => $composableBuilder(
    column: $table.gymMemberId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get planType =>
      $composableBuilder(column: $table.planType, builder: (column) => column);

  GeneratedColumn<String> get sourceType => $composableBuilder(
    column: $table.sourceType,
    builder: (column) => column,
  );

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<String> get paymentStatus => $composableBuilder(
    column: $table.paymentStatus,
    builder: (column) => column,
  );

  GeneratedColumn<String> get startDate =>
      $composableBuilder(column: $table.startDate, builder: (column) => column);

  GeneratedColumn<String> get endDate =>
      $composableBuilder(column: $table.endDate, builder: (column) => column);

  GeneratedColumn<int> get sessionsRemaining => $composableBuilder(
    column: $table.sessionsRemaining,
    builder: (column) => column,
  );

  GeneratedColumn<int> get sessionsTotal => $composableBuilder(
    column: $table.sessionsTotal,
    builder: (column) => column,
  );

  GeneratedColumn<String> get freezeStatus => $composableBuilder(
    column: $table.freezeStatus,
    builder: (column) => column,
  );

  GeneratedColumn<String> get allowedBranchIds => $composableBuilder(
    column: $table.allowedBranchIds,
    builder: (column) => column,
  );
}

class $$CachedMembershipsTableTableManager
    extends
        RootTableManager<
          _$OfflineDatabase,
          $CachedMembershipsTable,
          CachedMembership,
          $$CachedMembershipsTableFilterComposer,
          $$CachedMembershipsTableOrderingComposer,
          $$CachedMembershipsTableAnnotationComposer,
          $$CachedMembershipsTableCreateCompanionBuilder,
          $$CachedMembershipsTableUpdateCompanionBuilder,
          (
            CachedMembership,
            BaseReferences<
              _$OfflineDatabase,
              $CachedMembershipsTable,
              CachedMembership
            >,
          ),
          CachedMembership,
          PrefetchHooks Function()
        > {
  $$CachedMembershipsTableTableManager(
    _$OfflineDatabase db,
    $CachedMembershipsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedMembershipsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedMembershipsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedMembershipsTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> membershipId = const Value.absent(),
                Value<String> gymMemberId = const Value.absent(),
                Value<String?> planType = const Value.absent(),
                Value<String?> sourceType = const Value.absent(),
                Value<String?> status = const Value.absent(),
                Value<String?> paymentStatus = const Value.absent(),
                Value<String?> startDate = const Value.absent(),
                Value<String?> endDate = const Value.absent(),
                Value<int?> sessionsRemaining = const Value.absent(),
                Value<int?> sessionsTotal = const Value.absent(),
                Value<String?> freezeStatus = const Value.absent(),
                Value<String?> allowedBranchIds = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedMembershipsCompanion(
                membershipId: membershipId,
                gymMemberId: gymMemberId,
                planType: planType,
                sourceType: sourceType,
                status: status,
                paymentStatus: paymentStatus,
                startDate: startDate,
                endDate: endDate,
                sessionsRemaining: sessionsRemaining,
                sessionsTotal: sessionsTotal,
                freezeStatus: freezeStatus,
                allowedBranchIds: allowedBranchIds,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String membershipId,
                required String gymMemberId,
                Value<String?> planType = const Value.absent(),
                Value<String?> sourceType = const Value.absent(),
                Value<String?> status = const Value.absent(),
                Value<String?> paymentStatus = const Value.absent(),
                Value<String?> startDate = const Value.absent(),
                Value<String?> endDate = const Value.absent(),
                Value<int?> sessionsRemaining = const Value.absent(),
                Value<int?> sessionsTotal = const Value.absent(),
                Value<String?> freezeStatus = const Value.absent(),
                Value<String?> allowedBranchIds = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedMembershipsCompanion.insert(
                membershipId: membershipId,
                gymMemberId: gymMemberId,
                planType: planType,
                sourceType: sourceType,
                status: status,
                paymentStatus: paymentStatus,
                startDate: startDate,
                endDate: endDate,
                sessionsRemaining: sessionsRemaining,
                sessionsTotal: sessionsTotal,
                freezeStatus: freezeStatus,
                allowedBranchIds: allowedBranchIds,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$CachedMembershipsTable, CachedMembership>(table),
                  BaseReferences<
                    _$OfflineDatabase,
                    $CachedMembershipsTable,
                    CachedMembership
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CachedMembershipsTableProcessedTableManager =
    ProcessedTableManager<
      _$OfflineDatabase,
      $CachedMembershipsTable,
      CachedMembership,
      $$CachedMembershipsTableFilterComposer,
      $$CachedMembershipsTableOrderingComposer,
      $$CachedMembershipsTableAnnotationComposer,
      $$CachedMembershipsTableCreateCompanionBuilder,
      $$CachedMembershipsTableUpdateCompanionBuilder,
      (
        CachedMembership,
        BaseReferences<
          _$OfflineDatabase,
          $CachedMembershipsTable,
          CachedMembership
        >,
      ),
      CachedMembership,
      PrefetchHooks Function()
    >;
typedef $$CachedBranchesTableCreateCompanionBuilder =
    CachedBranchesCompanion Function({
      required String id,
      required String name,
      Value<bool> isActive,
      Value<String?> qrToken,
      Value<int> rowid,
    });
typedef $$CachedBranchesTableUpdateCompanionBuilder =
    CachedBranchesCompanion Function({
      Value<String> id,
      Value<String> name,
      Value<bool> isActive,
      Value<String?> qrToken,
      Value<int> rowid,
    });

class $$CachedBranchesTableFilterComposer
    extends Composer<_$OfflineDatabase, $CachedBranchesTable> {
  $$CachedBranchesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get isActive => $composableBuilder(
    column: $table.isActive,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get qrToken => $composableBuilder(
    column: $table.qrToken,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CachedBranchesTableOrderingComposer
    extends Composer<_$OfflineDatabase, $CachedBranchesTable> {
  $$CachedBranchesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get isActive => $composableBuilder(
    column: $table.isActive,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get qrToken => $composableBuilder(
    column: $table.qrToken,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CachedBranchesTableAnnotationComposer
    extends Composer<_$OfflineDatabase, $CachedBranchesTable> {
  $$CachedBranchesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<bool> get isActive =>
      $composableBuilder(column: $table.isActive, builder: (column) => column);

  GeneratedColumn<String> get qrToken =>
      $composableBuilder(column: $table.qrToken, builder: (column) => column);
}

class $$CachedBranchesTableTableManager
    extends
        RootTableManager<
          _$OfflineDatabase,
          $CachedBranchesTable,
          CachedBranch,
          $$CachedBranchesTableFilterComposer,
          $$CachedBranchesTableOrderingComposer,
          $$CachedBranchesTableAnnotationComposer,
          $$CachedBranchesTableCreateCompanionBuilder,
          $$CachedBranchesTableUpdateCompanionBuilder,
          (
            CachedBranch,
            BaseReferences<
              _$OfflineDatabase,
              $CachedBranchesTable,
              CachedBranch
            >,
          ),
          CachedBranch,
          PrefetchHooks Function()
        > {
  $$CachedBranchesTableTableManager(
    _$OfflineDatabase db,
    $CachedBranchesTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedBranchesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedBranchesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedBranchesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> name = const Value.absent(),
                Value<bool> isActive = const Value.absent(),
                Value<String?> qrToken = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedBranchesCompanion(
                id: id,
                name: name,
                isActive: isActive,
                qrToken: qrToken,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String name,
                Value<bool> isActive = const Value.absent(),
                Value<String?> qrToken = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedBranchesCompanion.insert(
                id: id,
                name: name,
                isActive: isActive,
                qrToken: qrToken,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$CachedBranchesTable, CachedBranch>(table),
                  BaseReferences<
                    _$OfflineDatabase,
                    $CachedBranchesTable,
                    CachedBranch
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CachedBranchesTableProcessedTableManager =
    ProcessedTableManager<
      _$OfflineDatabase,
      $CachedBranchesTable,
      CachedBranch,
      $$CachedBranchesTableFilterComposer,
      $$CachedBranchesTableOrderingComposer,
      $$CachedBranchesTableAnnotationComposer,
      $$CachedBranchesTableCreateCompanionBuilder,
      $$CachedBranchesTableUpdateCompanionBuilder,
      (
        CachedBranch,
        BaseReferences<_$OfflineDatabase, $CachedBranchesTable, CachedBranch>,
      ),
      CachedBranch,
      PrefetchHooks Function()
    >;
typedef $$CachedClassSessionsTableCreateCompanionBuilder =
    CachedClassSessionsCompanion Function({
      required String id,
      Value<String?> classId,
      Value<String?> name,
      Value<String?> branchId,
      Value<String?> studioId,
      Value<String?> startsAt,
      Value<String?> endsAt,
      Value<int> rowid,
    });
typedef $$CachedClassSessionsTableUpdateCompanionBuilder =
    CachedClassSessionsCompanion Function({
      Value<String> id,
      Value<String?> classId,
      Value<String?> name,
      Value<String?> branchId,
      Value<String?> studioId,
      Value<String?> startsAt,
      Value<String?> endsAt,
      Value<int> rowid,
    });

class $$CachedClassSessionsTableFilterComposer
    extends Composer<_$OfflineDatabase, $CachedClassSessionsTable> {
  $$CachedClassSessionsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get classId => $composableBuilder(
    column: $table.classId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get branchId => $composableBuilder(
    column: $table.branchId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get studioId => $composableBuilder(
    column: $table.studioId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get startsAt => $composableBuilder(
    column: $table.startsAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get endsAt => $composableBuilder(
    column: $table.endsAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CachedClassSessionsTableOrderingComposer
    extends Composer<_$OfflineDatabase, $CachedClassSessionsTable> {
  $$CachedClassSessionsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get classId => $composableBuilder(
    column: $table.classId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get branchId => $composableBuilder(
    column: $table.branchId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get studioId => $composableBuilder(
    column: $table.studioId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get startsAt => $composableBuilder(
    column: $table.startsAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get endsAt => $composableBuilder(
    column: $table.endsAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CachedClassSessionsTableAnnotationComposer
    extends Composer<_$OfflineDatabase, $CachedClassSessionsTable> {
  $$CachedClassSessionsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get classId =>
      $composableBuilder(column: $table.classId, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get branchId =>
      $composableBuilder(column: $table.branchId, builder: (column) => column);

  GeneratedColumn<String> get studioId =>
      $composableBuilder(column: $table.studioId, builder: (column) => column);

  GeneratedColumn<String> get startsAt =>
      $composableBuilder(column: $table.startsAt, builder: (column) => column);

  GeneratedColumn<String> get endsAt =>
      $composableBuilder(column: $table.endsAt, builder: (column) => column);
}

class $$CachedClassSessionsTableTableManager
    extends
        RootTableManager<
          _$OfflineDatabase,
          $CachedClassSessionsTable,
          CachedClassSession,
          $$CachedClassSessionsTableFilterComposer,
          $$CachedClassSessionsTableOrderingComposer,
          $$CachedClassSessionsTableAnnotationComposer,
          $$CachedClassSessionsTableCreateCompanionBuilder,
          $$CachedClassSessionsTableUpdateCompanionBuilder,
          (
            CachedClassSession,
            BaseReferences<
              _$OfflineDatabase,
              $CachedClassSessionsTable,
              CachedClassSession
            >,
          ),
          CachedClassSession,
          PrefetchHooks Function()
        > {
  $$CachedClassSessionsTableTableManager(
    _$OfflineDatabase db,
    $CachedClassSessionsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedClassSessionsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedClassSessionsTableOrderingComposer(
                $db: db,
                $table: table,
              ),
          createComputedFieldComposer: () =>
              $$CachedClassSessionsTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String?> classId = const Value.absent(),
                Value<String?> name = const Value.absent(),
                Value<String?> branchId = const Value.absent(),
                Value<String?> studioId = const Value.absent(),
                Value<String?> startsAt = const Value.absent(),
                Value<String?> endsAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedClassSessionsCompanion(
                id: id,
                classId: classId,
                name: name,
                branchId: branchId,
                studioId: studioId,
                startsAt: startsAt,
                endsAt: endsAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                Value<String?> classId = const Value.absent(),
                Value<String?> name = const Value.absent(),
                Value<String?> branchId = const Value.absent(),
                Value<String?> studioId = const Value.absent(),
                Value<String?> startsAt = const Value.absent(),
                Value<String?> endsAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedClassSessionsCompanion.insert(
                id: id,
                classId: classId,
                name: name,
                branchId: branchId,
                studioId: studioId,
                startsAt: startsAt,
                endsAt: endsAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$CachedClassSessionsTable, CachedClassSession>(
                    table,
                  ),
                  BaseReferences<
                    _$OfflineDatabase,
                    $CachedClassSessionsTable,
                    CachedClassSession
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CachedClassSessionsTableProcessedTableManager =
    ProcessedTableManager<
      _$OfflineDatabase,
      $CachedClassSessionsTable,
      CachedClassSession,
      $$CachedClassSessionsTableFilterComposer,
      $$CachedClassSessionsTableOrderingComposer,
      $$CachedClassSessionsTableAnnotationComposer,
      $$CachedClassSessionsTableCreateCompanionBuilder,
      $$CachedClassSessionsTableUpdateCompanionBuilder,
      (
        CachedClassSession,
        BaseReferences<
          _$OfflineDatabase,
          $CachedClassSessionsTable,
          CachedClassSession
        >,
      ),
      CachedClassSession,
      PrefetchHooks Function()
    >;
typedef $$CachedAssignmentsTableCreateCompanionBuilder =
    CachedAssignmentsCompanion Function({
      required String assignmentId,
      required String gymMemberId,
      Value<String?> trainerId,
      Value<String?> memberName,
      Value<String?> memberNumber,
      Value<String?> photoUrl,
      Value<String?> serviceType,
      Value<String?> packageName,
      Value<int?> sessionsTotal,
      Value<int?> sessionsUsed,
      Value<String?> status,
      Value<String?> expiresAt,
      Value<String?> lastSessionAt,
      Value<int> rowid,
    });
typedef $$CachedAssignmentsTableUpdateCompanionBuilder =
    CachedAssignmentsCompanion Function({
      Value<String> assignmentId,
      Value<String> gymMemberId,
      Value<String?> trainerId,
      Value<String?> memberName,
      Value<String?> memberNumber,
      Value<String?> photoUrl,
      Value<String?> serviceType,
      Value<String?> packageName,
      Value<int?> sessionsTotal,
      Value<int?> sessionsUsed,
      Value<String?> status,
      Value<String?> expiresAt,
      Value<String?> lastSessionAt,
      Value<int> rowid,
    });

class $$CachedAssignmentsTableFilterComposer
    extends Composer<_$OfflineDatabase, $CachedAssignmentsTable> {
  $$CachedAssignmentsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get assignmentId => $composableBuilder(
    column: $table.assignmentId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get gymMemberId => $composableBuilder(
    column: $table.gymMemberId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get trainerId => $composableBuilder(
    column: $table.trainerId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get memberName => $composableBuilder(
    column: $table.memberName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get memberNumber => $composableBuilder(
    column: $table.memberNumber,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get photoUrl => $composableBuilder(
    column: $table.photoUrl,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get serviceType => $composableBuilder(
    column: $table.serviceType,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get packageName => $composableBuilder(
    column: $table.packageName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get sessionsTotal => $composableBuilder(
    column: $table.sessionsTotal,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get sessionsUsed => $composableBuilder(
    column: $table.sessionsUsed,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get expiresAt => $composableBuilder(
    column: $table.expiresAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get lastSessionAt => $composableBuilder(
    column: $table.lastSessionAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CachedAssignmentsTableOrderingComposer
    extends Composer<_$OfflineDatabase, $CachedAssignmentsTable> {
  $$CachedAssignmentsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get assignmentId => $composableBuilder(
    column: $table.assignmentId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get gymMemberId => $composableBuilder(
    column: $table.gymMemberId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get trainerId => $composableBuilder(
    column: $table.trainerId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get memberName => $composableBuilder(
    column: $table.memberName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get memberNumber => $composableBuilder(
    column: $table.memberNumber,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get photoUrl => $composableBuilder(
    column: $table.photoUrl,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get serviceType => $composableBuilder(
    column: $table.serviceType,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get packageName => $composableBuilder(
    column: $table.packageName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get sessionsTotal => $composableBuilder(
    column: $table.sessionsTotal,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get sessionsUsed => $composableBuilder(
    column: $table.sessionsUsed,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get expiresAt => $composableBuilder(
    column: $table.expiresAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get lastSessionAt => $composableBuilder(
    column: $table.lastSessionAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CachedAssignmentsTableAnnotationComposer
    extends Composer<_$OfflineDatabase, $CachedAssignmentsTable> {
  $$CachedAssignmentsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get assignmentId => $composableBuilder(
    column: $table.assignmentId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get gymMemberId => $composableBuilder(
    column: $table.gymMemberId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get trainerId =>
      $composableBuilder(column: $table.trainerId, builder: (column) => column);

  GeneratedColumn<String> get memberName => $composableBuilder(
    column: $table.memberName,
    builder: (column) => column,
  );

  GeneratedColumn<String> get memberNumber => $composableBuilder(
    column: $table.memberNumber,
    builder: (column) => column,
  );

  GeneratedColumn<String> get photoUrl =>
      $composableBuilder(column: $table.photoUrl, builder: (column) => column);

  GeneratedColumn<String> get serviceType => $composableBuilder(
    column: $table.serviceType,
    builder: (column) => column,
  );

  GeneratedColumn<String> get packageName => $composableBuilder(
    column: $table.packageName,
    builder: (column) => column,
  );

  GeneratedColumn<int> get sessionsTotal => $composableBuilder(
    column: $table.sessionsTotal,
    builder: (column) => column,
  );

  GeneratedColumn<int> get sessionsUsed => $composableBuilder(
    column: $table.sessionsUsed,
    builder: (column) => column,
  );

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<String> get expiresAt =>
      $composableBuilder(column: $table.expiresAt, builder: (column) => column);

  GeneratedColumn<String> get lastSessionAt => $composableBuilder(
    column: $table.lastSessionAt,
    builder: (column) => column,
  );
}

class $$CachedAssignmentsTableTableManager
    extends
        RootTableManager<
          _$OfflineDatabase,
          $CachedAssignmentsTable,
          CachedAssignment,
          $$CachedAssignmentsTableFilterComposer,
          $$CachedAssignmentsTableOrderingComposer,
          $$CachedAssignmentsTableAnnotationComposer,
          $$CachedAssignmentsTableCreateCompanionBuilder,
          $$CachedAssignmentsTableUpdateCompanionBuilder,
          (
            CachedAssignment,
            BaseReferences<
              _$OfflineDatabase,
              $CachedAssignmentsTable,
              CachedAssignment
            >,
          ),
          CachedAssignment,
          PrefetchHooks Function()
        > {
  $$CachedAssignmentsTableTableManager(
    _$OfflineDatabase db,
    $CachedAssignmentsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedAssignmentsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedAssignmentsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedAssignmentsTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> assignmentId = const Value.absent(),
                Value<String> gymMemberId = const Value.absent(),
                Value<String?> trainerId = const Value.absent(),
                Value<String?> memberName = const Value.absent(),
                Value<String?> memberNumber = const Value.absent(),
                Value<String?> photoUrl = const Value.absent(),
                Value<String?> serviceType = const Value.absent(),
                Value<String?> packageName = const Value.absent(),
                Value<int?> sessionsTotal = const Value.absent(),
                Value<int?> sessionsUsed = const Value.absent(),
                Value<String?> status = const Value.absent(),
                Value<String?> expiresAt = const Value.absent(),
                Value<String?> lastSessionAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedAssignmentsCompanion(
                assignmentId: assignmentId,
                gymMemberId: gymMemberId,
                trainerId: trainerId,
                memberName: memberName,
                memberNumber: memberNumber,
                photoUrl: photoUrl,
                serviceType: serviceType,
                packageName: packageName,
                sessionsTotal: sessionsTotal,
                sessionsUsed: sessionsUsed,
                status: status,
                expiresAt: expiresAt,
                lastSessionAt: lastSessionAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String assignmentId,
                required String gymMemberId,
                Value<String?> trainerId = const Value.absent(),
                Value<String?> memberName = const Value.absent(),
                Value<String?> memberNumber = const Value.absent(),
                Value<String?> photoUrl = const Value.absent(),
                Value<String?> serviceType = const Value.absent(),
                Value<String?> packageName = const Value.absent(),
                Value<int?> sessionsTotal = const Value.absent(),
                Value<int?> sessionsUsed = const Value.absent(),
                Value<String?> status = const Value.absent(),
                Value<String?> expiresAt = const Value.absent(),
                Value<String?> lastSessionAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedAssignmentsCompanion.insert(
                assignmentId: assignmentId,
                gymMemberId: gymMemberId,
                trainerId: trainerId,
                memberName: memberName,
                memberNumber: memberNumber,
                photoUrl: photoUrl,
                serviceType: serviceType,
                packageName: packageName,
                sessionsTotal: sessionsTotal,
                sessionsUsed: sessionsUsed,
                status: status,
                expiresAt: expiresAt,
                lastSessionAt: lastSessionAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$CachedAssignmentsTable, CachedAssignment>(table),
                  BaseReferences<
                    _$OfflineDatabase,
                    $CachedAssignmentsTable,
                    CachedAssignment
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CachedAssignmentsTableProcessedTableManager =
    ProcessedTableManager<
      _$OfflineDatabase,
      $CachedAssignmentsTable,
      CachedAssignment,
      $$CachedAssignmentsTableFilterComposer,
      $$CachedAssignmentsTableOrderingComposer,
      $$CachedAssignmentsTableAnnotationComposer,
      $$CachedAssignmentsTableCreateCompanionBuilder,
      $$CachedAssignmentsTableUpdateCompanionBuilder,
      (
        CachedAssignment,
        BaseReferences<
          _$OfflineDatabase,
          $CachedAssignmentsTable,
          CachedAssignment
        >,
      ),
      CachedAssignment,
      PrefetchHooks Function()
    >;
typedef $$CachedRecentAttendanceTableCreateCompanionBuilder =
    CachedRecentAttendanceCompanion Function({
      required String attendanceId,
      required String gymMemberId,
      Value<String?> classSessionId,
      Value<String?> branchId,
      Value<String?> checkInAt,
      Value<int> rowid,
    });
typedef $$CachedRecentAttendanceTableUpdateCompanionBuilder =
    CachedRecentAttendanceCompanion Function({
      Value<String> attendanceId,
      Value<String> gymMemberId,
      Value<String?> classSessionId,
      Value<String?> branchId,
      Value<String?> checkInAt,
      Value<int> rowid,
    });

class $$CachedRecentAttendanceTableFilterComposer
    extends Composer<_$OfflineDatabase, $CachedRecentAttendanceTable> {
  $$CachedRecentAttendanceTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get attendanceId => $composableBuilder(
    column: $table.attendanceId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get gymMemberId => $composableBuilder(
    column: $table.gymMemberId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get classSessionId => $composableBuilder(
    column: $table.classSessionId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get branchId => $composableBuilder(
    column: $table.branchId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get checkInAt => $composableBuilder(
    column: $table.checkInAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CachedRecentAttendanceTableOrderingComposer
    extends Composer<_$OfflineDatabase, $CachedRecentAttendanceTable> {
  $$CachedRecentAttendanceTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get attendanceId => $composableBuilder(
    column: $table.attendanceId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get gymMemberId => $composableBuilder(
    column: $table.gymMemberId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get classSessionId => $composableBuilder(
    column: $table.classSessionId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get branchId => $composableBuilder(
    column: $table.branchId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get checkInAt => $composableBuilder(
    column: $table.checkInAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CachedRecentAttendanceTableAnnotationComposer
    extends Composer<_$OfflineDatabase, $CachedRecentAttendanceTable> {
  $$CachedRecentAttendanceTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get attendanceId => $composableBuilder(
    column: $table.attendanceId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get gymMemberId => $composableBuilder(
    column: $table.gymMemberId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get classSessionId => $composableBuilder(
    column: $table.classSessionId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get branchId =>
      $composableBuilder(column: $table.branchId, builder: (column) => column);

  GeneratedColumn<String> get checkInAt =>
      $composableBuilder(column: $table.checkInAt, builder: (column) => column);
}

class $$CachedRecentAttendanceTableTableManager
    extends
        RootTableManager<
          _$OfflineDatabase,
          $CachedRecentAttendanceTable,
          CachedRecentAttendanceRow,
          $$CachedRecentAttendanceTableFilterComposer,
          $$CachedRecentAttendanceTableOrderingComposer,
          $$CachedRecentAttendanceTableAnnotationComposer,
          $$CachedRecentAttendanceTableCreateCompanionBuilder,
          $$CachedRecentAttendanceTableUpdateCompanionBuilder,
          (
            CachedRecentAttendanceRow,
            BaseReferences<
              _$OfflineDatabase,
              $CachedRecentAttendanceTable,
              CachedRecentAttendanceRow
            >,
          ),
          CachedRecentAttendanceRow,
          PrefetchHooks Function()
        > {
  $$CachedRecentAttendanceTableTableManager(
    _$OfflineDatabase db,
    $CachedRecentAttendanceTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedRecentAttendanceTableFilterComposer(
                $db: db,
                $table: table,
              ),
          createOrderingComposer: () =>
              $$CachedRecentAttendanceTableOrderingComposer(
                $db: db,
                $table: table,
              ),
          createComputedFieldComposer: () =>
              $$CachedRecentAttendanceTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> attendanceId = const Value.absent(),
                Value<String> gymMemberId = const Value.absent(),
                Value<String?> classSessionId = const Value.absent(),
                Value<String?> branchId = const Value.absent(),
                Value<String?> checkInAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedRecentAttendanceCompanion(
                attendanceId: attendanceId,
                gymMemberId: gymMemberId,
                classSessionId: classSessionId,
                branchId: branchId,
                checkInAt: checkInAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String attendanceId,
                required String gymMemberId,
                Value<String?> classSessionId = const Value.absent(),
                Value<String?> branchId = const Value.absent(),
                Value<String?> checkInAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedRecentAttendanceCompanion.insert(
                attendanceId: attendanceId,
                gymMemberId: gymMemberId,
                classSessionId: classSessionId,
                branchId: branchId,
                checkInAt: checkInAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<
                    $CachedRecentAttendanceTable,
                    CachedRecentAttendanceRow
                  >(table),
                  BaseReferences<
                    _$OfflineDatabase,
                    $CachedRecentAttendanceTable,
                    CachedRecentAttendanceRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CachedRecentAttendanceTableProcessedTableManager =
    ProcessedTableManager<
      _$OfflineDatabase,
      $CachedRecentAttendanceTable,
      CachedRecentAttendanceRow,
      $$CachedRecentAttendanceTableFilterComposer,
      $$CachedRecentAttendanceTableOrderingComposer,
      $$CachedRecentAttendanceTableAnnotationComposer,
      $$CachedRecentAttendanceTableCreateCompanionBuilder,
      $$CachedRecentAttendanceTableUpdateCompanionBuilder,
      (
        CachedRecentAttendanceRow,
        BaseReferences<
          _$OfflineDatabase,
          $CachedRecentAttendanceTable,
          CachedRecentAttendanceRow
        >,
      ),
      CachedRecentAttendanceRow,
      PrefetchHooks Function()
    >;
typedef $$CachedRecentServiceLogsTableCreateCompanionBuilder =
    CachedRecentServiceLogsCompanion Function({
      required String serviceLogId,
      required String assignmentId,
      Value<String?> loggedAt,
      Value<int> rowid,
    });
typedef $$CachedRecentServiceLogsTableUpdateCompanionBuilder =
    CachedRecentServiceLogsCompanion Function({
      Value<String> serviceLogId,
      Value<String> assignmentId,
      Value<String?> loggedAt,
      Value<int> rowid,
    });

class $$CachedRecentServiceLogsTableFilterComposer
    extends Composer<_$OfflineDatabase, $CachedRecentServiceLogsTable> {
  $$CachedRecentServiceLogsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get serviceLogId => $composableBuilder(
    column: $table.serviceLogId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get assignmentId => $composableBuilder(
    column: $table.assignmentId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get loggedAt => $composableBuilder(
    column: $table.loggedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CachedRecentServiceLogsTableOrderingComposer
    extends Composer<_$OfflineDatabase, $CachedRecentServiceLogsTable> {
  $$CachedRecentServiceLogsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get serviceLogId => $composableBuilder(
    column: $table.serviceLogId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get assignmentId => $composableBuilder(
    column: $table.assignmentId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get loggedAt => $composableBuilder(
    column: $table.loggedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CachedRecentServiceLogsTableAnnotationComposer
    extends Composer<_$OfflineDatabase, $CachedRecentServiceLogsTable> {
  $$CachedRecentServiceLogsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get serviceLogId => $composableBuilder(
    column: $table.serviceLogId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get assignmentId => $composableBuilder(
    column: $table.assignmentId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get loggedAt =>
      $composableBuilder(column: $table.loggedAt, builder: (column) => column);
}

class $$CachedRecentServiceLogsTableTableManager
    extends
        RootTableManager<
          _$OfflineDatabase,
          $CachedRecentServiceLogsTable,
          CachedRecentServiceLog,
          $$CachedRecentServiceLogsTableFilterComposer,
          $$CachedRecentServiceLogsTableOrderingComposer,
          $$CachedRecentServiceLogsTableAnnotationComposer,
          $$CachedRecentServiceLogsTableCreateCompanionBuilder,
          $$CachedRecentServiceLogsTableUpdateCompanionBuilder,
          (
            CachedRecentServiceLog,
            BaseReferences<
              _$OfflineDatabase,
              $CachedRecentServiceLogsTable,
              CachedRecentServiceLog
            >,
          ),
          CachedRecentServiceLog,
          PrefetchHooks Function()
        > {
  $$CachedRecentServiceLogsTableTableManager(
    _$OfflineDatabase db,
    $CachedRecentServiceLogsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedRecentServiceLogsTableFilterComposer(
                $db: db,
                $table: table,
              ),
          createOrderingComposer: () =>
              $$CachedRecentServiceLogsTableOrderingComposer(
                $db: db,
                $table: table,
              ),
          createComputedFieldComposer: () =>
              $$CachedRecentServiceLogsTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> serviceLogId = const Value.absent(),
                Value<String> assignmentId = const Value.absent(),
                Value<String?> loggedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedRecentServiceLogsCompanion(
                serviceLogId: serviceLogId,
                assignmentId: assignmentId,
                loggedAt: loggedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String serviceLogId,
                required String assignmentId,
                Value<String?> loggedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedRecentServiceLogsCompanion.insert(
                serviceLogId: serviceLogId,
                assignmentId: assignmentId,
                loggedAt: loggedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<
                    $CachedRecentServiceLogsTable,
                    CachedRecentServiceLog
                  >(table),
                  BaseReferences<
                    _$OfflineDatabase,
                    $CachedRecentServiceLogsTable,
                    CachedRecentServiceLog
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CachedRecentServiceLogsTableProcessedTableManager =
    ProcessedTableManager<
      _$OfflineDatabase,
      $CachedRecentServiceLogsTable,
      CachedRecentServiceLog,
      $$CachedRecentServiceLogsTableFilterComposer,
      $$CachedRecentServiceLogsTableOrderingComposer,
      $$CachedRecentServiceLogsTableAnnotationComposer,
      $$CachedRecentServiceLogsTableCreateCompanionBuilder,
      $$CachedRecentServiceLogsTableUpdateCompanionBuilder,
      (
        CachedRecentServiceLog,
        BaseReferences<
          _$OfflineDatabase,
          $CachedRecentServiceLogsTable,
          CachedRecentServiceLog
        >,
      ),
      CachedRecentServiceLog,
      PrefetchHooks Function()
    >;
typedef $$CachedPassKeysTableCreateCompanionBuilder =
    CachedPassKeysCompanion Function({
      required String kid,
      required String publicKey,
      required String status,
      Value<String?> validUntil,
      Value<int> rowid,
    });
typedef $$CachedPassKeysTableUpdateCompanionBuilder =
    CachedPassKeysCompanion Function({
      Value<String> kid,
      Value<String> publicKey,
      Value<String> status,
      Value<String?> validUntil,
      Value<int> rowid,
    });

class $$CachedPassKeysTableFilterComposer
    extends Composer<_$OfflineDatabase, $CachedPassKeysTable> {
  $$CachedPassKeysTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get kid => $composableBuilder(
    column: $table.kid,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get publicKey => $composableBuilder(
    column: $table.publicKey,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get validUntil => $composableBuilder(
    column: $table.validUntil,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CachedPassKeysTableOrderingComposer
    extends Composer<_$OfflineDatabase, $CachedPassKeysTable> {
  $$CachedPassKeysTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get kid => $composableBuilder(
    column: $table.kid,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get publicKey => $composableBuilder(
    column: $table.publicKey,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get validUntil => $composableBuilder(
    column: $table.validUntil,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CachedPassKeysTableAnnotationComposer
    extends Composer<_$OfflineDatabase, $CachedPassKeysTable> {
  $$CachedPassKeysTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get kid =>
      $composableBuilder(column: $table.kid, builder: (column) => column);

  GeneratedColumn<String> get publicKey =>
      $composableBuilder(column: $table.publicKey, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<String> get validUntil => $composableBuilder(
    column: $table.validUntil,
    builder: (column) => column,
  );
}

class $$CachedPassKeysTableTableManager
    extends
        RootTableManager<
          _$OfflineDatabase,
          $CachedPassKeysTable,
          CachedPassKey,
          $$CachedPassKeysTableFilterComposer,
          $$CachedPassKeysTableOrderingComposer,
          $$CachedPassKeysTableAnnotationComposer,
          $$CachedPassKeysTableCreateCompanionBuilder,
          $$CachedPassKeysTableUpdateCompanionBuilder,
          (
            CachedPassKey,
            BaseReferences<
              _$OfflineDatabase,
              $CachedPassKeysTable,
              CachedPassKey
            >,
          ),
          CachedPassKey,
          PrefetchHooks Function()
        > {
  $$CachedPassKeysTableTableManager(
    _$OfflineDatabase db,
    $CachedPassKeysTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedPassKeysTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedPassKeysTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedPassKeysTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> kid = const Value.absent(),
                Value<String> publicKey = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<String?> validUntil = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedPassKeysCompanion(
                kid: kid,
                publicKey: publicKey,
                status: status,
                validUntil: validUntil,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String kid,
                required String publicKey,
                required String status,
                Value<String?> validUntil = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedPassKeysCompanion.insert(
                kid: kid,
                publicKey: publicKey,
                status: status,
                validUntil: validUntil,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$CachedPassKeysTable, CachedPassKey>(table),
                  BaseReferences<
                    _$OfflineDatabase,
                    $CachedPassKeysTable,
                    CachedPassKey
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CachedPassKeysTableProcessedTableManager =
    ProcessedTableManager<
      _$OfflineDatabase,
      $CachedPassKeysTable,
      CachedPassKey,
      $$CachedPassKeysTableFilterComposer,
      $$CachedPassKeysTableOrderingComposer,
      $$CachedPassKeysTableAnnotationComposer,
      $$CachedPassKeysTableCreateCompanionBuilder,
      $$CachedPassKeysTableUpdateCompanionBuilder,
      (
        CachedPassKey,
        BaseReferences<_$OfflineDatabase, $CachedPassKeysTable, CachedPassKey>,
      ),
      CachedPassKey,
      PrefetchHooks Function()
    >;
typedef $$CachedTrainersTableCreateCompanionBuilder =
    CachedTrainersCompanion Function({
      required String id,
      Value<String> name,
      Value<String?> serviceType,
      Value<bool> isActive,
      Value<int> rowid,
    });
typedef $$CachedTrainersTableUpdateCompanionBuilder =
    CachedTrainersCompanion Function({
      Value<String> id,
      Value<String> name,
      Value<String?> serviceType,
      Value<bool> isActive,
      Value<int> rowid,
    });

class $$CachedTrainersTableFilterComposer
    extends Composer<_$OfflineDatabase, $CachedTrainersTable> {
  $$CachedTrainersTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get serviceType => $composableBuilder(
    column: $table.serviceType,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get isActive => $composableBuilder(
    column: $table.isActive,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CachedTrainersTableOrderingComposer
    extends Composer<_$OfflineDatabase, $CachedTrainersTable> {
  $$CachedTrainersTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get serviceType => $composableBuilder(
    column: $table.serviceType,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get isActive => $composableBuilder(
    column: $table.isActive,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CachedTrainersTableAnnotationComposer
    extends Composer<_$OfflineDatabase, $CachedTrainersTable> {
  $$CachedTrainersTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get serviceType => $composableBuilder(
    column: $table.serviceType,
    builder: (column) => column,
  );

  GeneratedColumn<bool> get isActive =>
      $composableBuilder(column: $table.isActive, builder: (column) => column);
}

class $$CachedTrainersTableTableManager
    extends
        RootTableManager<
          _$OfflineDatabase,
          $CachedTrainersTable,
          CachedTrainer,
          $$CachedTrainersTableFilterComposer,
          $$CachedTrainersTableOrderingComposer,
          $$CachedTrainersTableAnnotationComposer,
          $$CachedTrainersTableCreateCompanionBuilder,
          $$CachedTrainersTableUpdateCompanionBuilder,
          (
            CachedTrainer,
            BaseReferences<
              _$OfflineDatabase,
              $CachedTrainersTable,
              CachedTrainer
            >,
          ),
          CachedTrainer,
          PrefetchHooks Function()
        > {
  $$CachedTrainersTableTableManager(
    _$OfflineDatabase db,
    $CachedTrainersTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedTrainersTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedTrainersTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedTrainersTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> name = const Value.absent(),
                Value<String?> serviceType = const Value.absent(),
                Value<bool> isActive = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedTrainersCompanion(
                id: id,
                name: name,
                serviceType: serviceType,
                isActive: isActive,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                Value<String> name = const Value.absent(),
                Value<String?> serviceType = const Value.absent(),
                Value<bool> isActive = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedTrainersCompanion.insert(
                id: id,
                name: name,
                serviceType: serviceType,
                isActive: isActive,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$CachedTrainersTable, CachedTrainer>(table),
                  BaseReferences<
                    _$OfflineDatabase,
                    $CachedTrainersTable,
                    CachedTrainer
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CachedTrainersTableProcessedTableManager =
    ProcessedTableManager<
      _$OfflineDatabase,
      $CachedTrainersTable,
      CachedTrainer,
      $$CachedTrainersTableFilterComposer,
      $$CachedTrainersTableOrderingComposer,
      $$CachedTrainersTableAnnotationComposer,
      $$CachedTrainersTableCreateCompanionBuilder,
      $$CachedTrainersTableUpdateCompanionBuilder,
      (
        CachedTrainer,
        BaseReferences<_$OfflineDatabase, $CachedTrainersTable, CachedTrainer>,
      ),
      CachedTrainer,
      PrefetchHooks Function()
    >;
typedef $$SyncMetaTableCreateCompanionBuilder =
    SyncMetaCompanion Function({
      required String key,
      Value<String?> value,
      Value<int> rowid,
    });
typedef $$SyncMetaTableUpdateCompanionBuilder =
    SyncMetaCompanion Function({
      Value<String> key,
      Value<String?> value,
      Value<int> rowid,
    });

class $$SyncMetaTableFilterComposer
    extends Composer<_$OfflineDatabase, $SyncMetaTable> {
  $$SyncMetaTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get key => $composableBuilder(
    column: $table.key,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get value => $composableBuilder(
    column: $table.value,
    builder: (column) => ColumnFilters(column),
  );
}

class $$SyncMetaTableOrderingComposer
    extends Composer<_$OfflineDatabase, $SyncMetaTable> {
  $$SyncMetaTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get key => $composableBuilder(
    column: $table.key,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get value => $composableBuilder(
    column: $table.value,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$SyncMetaTableAnnotationComposer
    extends Composer<_$OfflineDatabase, $SyncMetaTable> {
  $$SyncMetaTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get key =>
      $composableBuilder(column: $table.key, builder: (column) => column);

  GeneratedColumn<String> get value =>
      $composableBuilder(column: $table.value, builder: (column) => column);
}

class $$SyncMetaTableTableManager
    extends
        RootTableManager<
          _$OfflineDatabase,
          $SyncMetaTable,
          SyncMetaEntry,
          $$SyncMetaTableFilterComposer,
          $$SyncMetaTableOrderingComposer,
          $$SyncMetaTableAnnotationComposer,
          $$SyncMetaTableCreateCompanionBuilder,
          $$SyncMetaTableUpdateCompanionBuilder,
          (
            SyncMetaEntry,
            BaseReferences<_$OfflineDatabase, $SyncMetaTable, SyncMetaEntry>,
          ),
          SyncMetaEntry,
          PrefetchHooks Function()
        > {
  $$SyncMetaTableTableManager(_$OfflineDatabase db, $SyncMetaTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$SyncMetaTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$SyncMetaTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$SyncMetaTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> key = const Value.absent(),
                Value<String?> value = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => SyncMetaCompanion(key: key, value: value, rowid: rowid),
          createCompanionCallback:
              ({
                required String key,
                Value<String?> value = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => SyncMetaCompanion.insert(
                key: key,
                value: value,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$SyncMetaTable, SyncMetaEntry>(table),
                  BaseReferences<
                    _$OfflineDatabase,
                    $SyncMetaTable,
                    SyncMetaEntry
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$SyncMetaTableProcessedTableManager =
    ProcessedTableManager<
      _$OfflineDatabase,
      $SyncMetaTable,
      SyncMetaEntry,
      $$SyncMetaTableFilterComposer,
      $$SyncMetaTableOrderingComposer,
      $$SyncMetaTableAnnotationComposer,
      $$SyncMetaTableCreateCompanionBuilder,
      $$SyncMetaTableUpdateCompanionBuilder,
      (
        SyncMetaEntry,
        BaseReferences<_$OfflineDatabase, $SyncMetaTable, SyncMetaEntry>,
      ),
      SyncMetaEntry,
      PrefetchHooks Function()
    >;

class $OfflineDatabaseManager {
  final _$OfflineDatabase _db;
  $OfflineDatabaseManager(this._db);
  $$OutboxEventsTableTableManager get outboxEvents =>
      $$OutboxEventsTableTableManager(_db, _db.outboxEvents);
  $$CachedMembersTableTableManager get cachedMembers =>
      $$CachedMembersTableTableManager(_db, _db.cachedMembers);
  $$CachedMembershipsTableTableManager get cachedMemberships =>
      $$CachedMembershipsTableTableManager(_db, _db.cachedMemberships);
  $$CachedBranchesTableTableManager get cachedBranches =>
      $$CachedBranchesTableTableManager(_db, _db.cachedBranches);
  $$CachedClassSessionsTableTableManager get cachedClassSessions =>
      $$CachedClassSessionsTableTableManager(_db, _db.cachedClassSessions);
  $$CachedAssignmentsTableTableManager get cachedAssignments =>
      $$CachedAssignmentsTableTableManager(_db, _db.cachedAssignments);
  $$CachedRecentAttendanceTableTableManager get cachedRecentAttendance =>
      $$CachedRecentAttendanceTableTableManager(
        _db,
        _db.cachedRecentAttendance,
      );
  $$CachedRecentServiceLogsTableTableManager get cachedRecentServiceLogs =>
      $$CachedRecentServiceLogsTableTableManager(
        _db,
        _db.cachedRecentServiceLogs,
      );
  $$CachedPassKeysTableTableManager get cachedPassKeys =>
      $$CachedPassKeysTableTableManager(_db, _db.cachedPassKeys);
  $$CachedTrainersTableTableManager get cachedTrainers =>
      $$CachedTrainersTableTableManager(_db, _db.cachedTrainers);
  $$SyncMetaTableTableManager get syncMeta =>
      $$SyncMetaTableTableManager(_db, _db.syncMeta);
}
