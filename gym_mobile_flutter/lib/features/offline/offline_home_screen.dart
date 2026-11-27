import 'package:clby/l10n/l10n.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../screens/qr_scanner_screen.dart';
import 'member_offline_controller.dart';
import 'offline_ui.dart';
import 'sign_out_guard.dart';

/// Limited offline mode (PHASE3 §4): pass + gym-QR check-in + this phone's
/// check-ins. Everything else needs a connection (router redirects here).
class OfflineHomeScreen extends StatelessWidget {
  const OfflineHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final c = context.watch<MemberOfflineController>();
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      backgroundColor: kOffBg,
      body: SafeArea(
        child: ListView(
          key: const Key('member-offline-home'),
          padding: const EdgeInsets.fromLTRB(22, 20, 22, 32),
          children: [
            Row(children: [
              Expanded(
                child: Text(l.offlineModeTitle,
                    style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: kOffInk)),
              ),
              const OfflineSyncChip(),
            ]),
            const SizedBox(height: 8),
            Text(l.offlineModeBody, style: const TextStyle(fontSize: 14, color: kOffMuted, height: 1.4)),
            const SizedBox(height: 20),
            _Action(
              key: const Key('offline-pass'),
              icon: Icons.qr_code_2_rounded,
              label: l.memberPassTitle,
              onTap: () => context.push('/member-pass'),
            ),
            _Action(
              key: const Key('offline-scan'),
              icon: Icons.qr_code_scanner_rounded,
              label: l.qrScanTitle,
              onTap: () => Navigator.of(context)
                  .push(MaterialPageRoute(builder: (_) => const QrScannerScreen())),
            ),
            _Action(
              key: const Key('offline-checkins'),
              icon: Icons.history_rounded,
              label: l.thisPhoneCheckinsTitle,
              onTap: () => context.push('/offline-checkins'),
            ),
            const SizedBox(height: 10),
            OfflineCard(
              child: Row(children: [
                const Icon(Icons.info_outline_rounded, size: 18, color: kOffMuted),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(l.offlineOnlineOnlyNotice,
                      style: const TextStyle(fontSize: 13, color: kOffMuted, height: 1.4)),
                ),
              ]),
            ),
            const SizedBox(height: 18),
            FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: kOffInk, minimumSize: const Size.fromHeight(50)),
              onPressed: auth.isLoading ? null : c.retryOnline,
              icon: const Icon(Icons.refresh_rounded),
              label: Text(l.offlineTryAgain),
            ),
            TextButton(
              onPressed: () => confirmSignOut(context),
              child: Text(l.profileSignOut, style: const TextStyle(color: kOffMuted)),
            ),
          ],
        ),
      ),
    );
  }
}

class _Action extends StatelessWidget {
  const _Action({super.key, required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Material(
          color: kOffCard,
          borderRadius: BorderRadius.circular(18),
          child: InkWell(
            borderRadius: BorderRadius.circular(18),
            onTap: onTap,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: kOffHair),
              ),
              child: Row(children: [
                Icon(icon, color: kOffInk),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(label,
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: kOffInk)),
                ),
                const Icon(Icons.chevron_right_rounded, color: kOffMuted),
              ]),
            ),
          ),
        ),
      );
}
