import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_text.dart';
import '../../../widgets/coach_greeting_header.dart';
import '../coach_app_state.dart';

/// Coach QR / Scan — the home tab, now wired to `/api/coach/*`.
///
/// `Your code` + the coach name come from `state.identity` (loaded by
/// HomeScreen on first build). The "DEMO · SIMULATE SCAN" panel shows
/// the first 4 active assignments and triggers a real decrement on the
/// server when the coach taps Confirm.
class QrScreen extends StatefulWidget {
  const QrScreen({super.key});

  @override
  State<QrScreen> createState() => _QrScreenState();
}

class _QrScreenState extends State<QrScreen> {
  @override
  Widget build(BuildContext context) {
    final state = context.watch<CoachAppState>();
    final id = state.identity;

    return Column(
      children: [
        const CoachGreetingHeader(),
            Expanded(
              child: RefreshIndicator(
                color: AppColors.lime,
                backgroundColor: AppColors.surface,
                onRefresh: () =>
                    context.read<CoachAppState>().refreshRoster(),
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(24, 24, 24, 100),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Center(
                        child: Text(
                          'YOUR CODE',
                          style: AppText.mono(
                            size: 11,
                            letterSpacing: 1.5,
                            color: AppColors.textSec,
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Center(
                        child: Text(
                          (id?.name ?? '—').toUpperCase(),
                          style: AppText.disp(
                            size: 32,
                            letterSpacing: 1,
                            color: AppColors.text,
                            height: 1,
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                      Center(child: _QrCard(
                        // Real, scannable QR encoding the exact payload the
                        // member app's scanner reads (type/gym_id/trainer_id).
                        // Null until identity loads, then a loader shows.
                        data: (id != null && id.gymId.isNotEmpty && id.trainerProfileId.isNotEmpty)
                            ? jsonEncode({
                                'type': 'specialist_session',
                                'gym_id': id.gymId,
                                'trainer_id': id.trainerProfileId,
                              })
                            : null,
                      )),
                      const SizedBox(height: 16),
                      Center(
                        child: SizedBox(
                          width: 240,
                          child: Text(
                            'Members scan this with the CLBY app to log a session against their package.',
                            textAlign: TextAlign.center,
                            style: AppText.body(
                              size: 13,
                              color: AppColors.textSec,
                              letterSpacing: -0.1,
                              height: 1.4,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 28),
                      _ManualLogRow(onTap: () => context.push('/manual-log')),
                    ],
                  ),
                ),
              ),
            ),
          ],
    );
  }
}

class _QrCard extends StatelessWidget {
  /// JSON payload to encode, or null while the coach identity is loading.
  final String? data;
  const _QrCard({required this.data});
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 260,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: AppColors.lime.withValues(alpha: 0.12),
            blurRadius: 80,
            offset: const Offset(0, 30),
          ),
        ],
      ),
      // A real, scannable QR. No decorative overlay — brackets over the
      // finder patterns would break scanning, which was the bug.
      child: data == null
          ? SizedBox(
              width: 220,
              height: 220,
              child: Center(
                child: CircularProgressIndicator(color: AppColors.lime),
              ),
            )
          : QrImageView(
              data: data!,
              version: QrVersions.auto,
              size: 220,
              backgroundColor: Colors.white,
              padding: EdgeInsets.zero,
              errorCorrectionLevel: QrErrorCorrectLevel.M,
              eyeStyle: const QrEyeStyle(
                eyeShape: QrEyeShape.square,
                color: Color(0xFF000000),
              ),
              dataModuleStyle: const QrDataModuleStyle(
                dataModuleShape: QrDataModuleShape.square,
                color: Color(0xFF000000),
              ),
            ),
    );
  }
}

class _ManualLogRow extends StatelessWidget {
  final VoidCallback onTap;
  const _ManualLogRow({required this.onTap});
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        decoration: BoxDecoration(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.borderStrong),
        ),
        child: Row(
          children: [
            Icon(Icons.edit_outlined, size: 16, color: AppColors.text),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Manual session log',
                style: AppText.body(
                  size: 14,
                  weight: FontWeight.w500,
                  color: AppColors.text,
                  letterSpacing: -0.1,
                ),
              ),
            ),
            Icon(Icons.chevron_right_rounded, size: 18, color: AppColors.textSec),
          ],
        ),
      ),
    );
  }
}
