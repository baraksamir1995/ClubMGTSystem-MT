import 'dart:convert';

import 'package:clby_offline/clby_offline.dart' show CachedSignedQr;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/constants/app_colors.dart';
import '../../core/constants/app_text.dart';
import 'coach_offline_controller.dart';

/// QR text for the coach QR screen: the server-signed `own_qr` when cached
/// and not expired; else today's unsigned `{type, gym_id, trainer_id}`
/// (online-only for members); null while identity is unknown.
String? signedOrUnsignedCoachQr({
  required CachedSignedQr? signed,
  required String? gymId,
  required String? trainerId,
  DateTime? now,
}) {
  if (signed != null && !signed.isExpiredAt(now ?? DateTime.now())) return signed.qr;
  if (gymId == null || gymId.isEmpty || trainerId == null || trainerId.isEmpty) return null;
  return jsonEncode({'type': 'specialist_session', 'gym_id': gymId, 'trainer_id': trainerId});
}

/// Offline home: the coach's cached signed QR (members can scan it with
/// no connection). Hidden when never fetched.
class OwnQrCard extends StatelessWidget {
  const OwnQrCard({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.watch<CoachOfflineController>();
    return FutureBuilder<CachedSignedQr?>(
      future: c.ownQr(),
      builder: (context, snap) {
        final q = snap.data;
        if (q == null || q.isExpiredAt(DateTime.now())) return const SizedBox.shrink();
        return Center(
          child: Container(
            key: const Key('own-qr'),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(children: [
              QrImageView(
                data: q.qr,
                version: QrVersions.auto,
                size: 200,
                errorCorrectionLevel: QrErrorCorrectLevel.M,
                backgroundColor: Colors.white,
              ),
              const SizedBox(height: 6),
              Text('YOUR CODE', style: AppText.mono(size: 10, letterSpacing: 1.4)),
            ]),
          ),
        );
      },
    );
  }
}
