import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_colors.dart';
import '../../core/constants/app_text.dart';
import '../../widgets/c_button.dart';
import 'coach_offline_controller.dart';
import 'offline_logic.dart';
import 'offline_strings.dart';
import 'offline_widgets.dart';

/// Offline cold-start shell (replaces "CAN'T REACH THE GYM" when
/// [CoachOfflineController.tryEnterOfflineMode] allowed it): scan passes,
/// log sessions from the cached roster, see what's waiting to sync.
/// Online-only screens are not reachable and are explained.
class OfflineHome extends StatelessWidget {
  const OfflineHome({super.key, required this.onRetry, required this.onSignOut});
  final VoidCallback onRetry;
  final VoidCallback onSignOut;

  @override
  Widget build(BuildContext context) {
    final t = OfflineStrings.current();
    final c = context.watch<CoachOfflineController>();
    final canLog = c.logPath == LogPath.outbox;
    return OfflineDirectionality(
      strings: t,
      child: SafeArea(
        child: ListView(
          key: const Key('offline-home'),
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
          children: [
            Row(children: [
              Expanded(
                child: Text(t.offlineModeTitle,
                    style: AppText.disp(size: 26, letterSpacing: 1.2, color: AppColors.text)),
              ),
              const SyncIndicatorChip(),
            ]),
            const SizedBox(height: 8),
            Text(t.offlineModeBody,
                style: AppText.body(size: 13, color: AppColors.textSec, height: 1.4)),
            const SizedBox(height: 18),
            if (!canLog) ...[
              OfflineNotice(text: t.policyOffOffline, tone: AppColors.warn),
              const SizedBox(height: 12),
            ],
            CButton(
              key: const Key('offline-scan'),
              label: t.scanPass,
              icon: Icons.qr_code_scanner_rounded,
              size: CButtonSize.lg,
              full: true,
              disabled: !canLog,
              onTap: canLog ? () => context.push('/scan-pass') : null,
            ),
            const SizedBox(height: 10),
            CButton(
              key: const Key('offline-log'),
              label: t.logSession,
              icon: Icons.edit_outlined,
              variant: CButtonVariant.secondary,
              size: CButtonSize.lg,
              full: true,
              disabled: !canLog,
              onTap: canLog ? () => context.push('/offline-log') : null,
            ),
            const SizedBox(height: 10),
            CButton(
              label: '${t.thisDevice} · ${t.readinessTitle}',
              icon: Icons.devices_rounded,
              variant: CButtonVariant.secondary,
              full: true,
              onTap: () => context.push('/offline-status'),
            ),
            const SizedBox(height: 18),
            OfflineNotice(text: t.onlineOnlyNotice),
            const SizedBox(height: 18),
            CButton(label: t.retryOnline, icon: Icons.refresh_rounded, variant: CButtonVariant.ghost, onTap: onRetry),
            CButton(label: 'Sign out', variant: CButtonVariant.ghost, size: CButtonSize.sm, onTap: onSignOut),
          ],
        ),
      ),
    );
  }
}
