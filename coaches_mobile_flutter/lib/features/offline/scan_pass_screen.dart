import 'package:clby_offline/clby_offline.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_colors.dart';
import '../../core/constants/app_text.dart';
import '../../widgets/c_button.dart';
import '../../widgets/clby_app_bar.dart';
import 'coach_offline_controller.dart';
import 'offline_log_screen.dart';
import 'offline_logic.dart';
import 'offline_strings.dart';
import 'offline_widgets.dart';

/// Staff QR (coach use, PHASE2-CONTRACT): scan a member pass, verify it
/// OFFLINE (steps 1–6 against cached `pass_keys`), show the cached photo +
/// name "as of", then continue to package pick + confirm with
/// `metadata.source = "qr"` and `qr.raw`.
class ScanPassScreen extends StatefulWidget {
  const ScanPassScreen({super.key});

  @override
  State<ScanPassScreen> createState() => _ScanPassScreenState();
}

class _ScanPassScreenState extends State<ScanPassScreen> {
  final _camera = MobileScannerController(
    formats: const [BarcodeFormat.qrCode],
    detectionSpeed: DetectionSpeed.noDuplicates,
  );
  bool _busy = false;
  PassVerdict? _verdict;
  bool _noData = false;

  @override
  void dispose() {
    _camera.dispose();
    super.dispose();
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_busy || _verdict != null || _noData) return;
    final raw = capture.barcodes
        .map((b) => b.rawValue)
        .firstWhere((v) => v != null && v.isNotEmpty, orElse: () => null);
    if (raw == null) return;
    _busy = true;
    await _camera.stop();
    if (!mounted) return;
    final v = await context.read<CoachOfflineController>().verifyPass(raw);
    if (!mounted) return;
    setState(() {
      _busy = false;
      _verdict = v;
      _noData = v == null;
    });
  }

  Future<void> _again() async {
    setState(() {
      _verdict = null;
      _noData = false;
    });
    await _camera.start();
  }

  @override
  Widget build(BuildContext context) {
    final t = OfflineStrings.current();
    final v = _verdict;
    return OfflineDirectionality(
      strings: t,
      child: Scaffold(
        backgroundColor: AppColors.bg,
        body: Column(
          children: [
            ClbyAppBar(
              title: t.scanPass,
              onBack: () => context.pop(),
              trailing: const SyncIndicatorChip(),
            ),
            Expanded(
              child: Stack(
                children: [
                  Positioned.fill(
                    child: MobileScanner(controller: _camera, onDetect: _onDetect),
                  ),
                  if (v == null && !_noData)
                    PositionedDirectional(
                      start: 24,
                      end: 24,
                      bottom: 40,
                      child: OfflineNotice(text: t.cameraHint, icon: Icons.qr_code_scanner_rounded),
                    ),
                  if (_noData || v != null)
                    Positioned.fill(
                      child: Container(
                        color: AppColors.bg,
                        padding: const EdgeInsets.all(20),
                        child: _noData
                            ? _Failure(text: t.passNeedsData, onAgain: _again, t: t)
                            : switch (v!) {
                                PassInvalid(:final reason) =>
                                  _Failure(text: passFailureText(reason, t), onAgain: _again, t: t),
                                final PassValid ok => _Valid(verdict: ok, t: t, onAgain: _again),
                              },
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Failure extends StatelessWidget {
  const _Failure({required this.text, required this.onAgain, required this.t});
  final String text;
  final VoidCallback onAgain;
  final OfflineStrings t;

  @override
  Widget build(BuildContext context) => Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          OfflineNotice(key: const Key('pass-failure'), text: text,
              icon: Icons.gpp_bad_outlined, tone: AppColors.danger),
          const SizedBox(height: 20),
          CButton(label: t.scanAgain, icon: Icons.qr_code_scanner_rounded, onTap: onAgain),
        ],
      );
}

class _Valid extends StatelessWidget {
  const _Valid({required this.verdict, required this.t, required this.onAgain});
  final PassValid verdict;
  final OfflineStrings t;
  final VoidCallback onAgain;

  @override
  Widget build(BuildContext context) {
    final m = verdict.member;
    final now = DateTime.now();
    final active = verdict.assignments.where((a) => isActiveCachedAssignment(a, now)).toList();
    return ListView(
      key: const Key('pass-valid'),
      children: [
        const SizedBox(height: 8),
        Center(child: MemberPhoto(name: m.fullName, url: m.photoUrl, size: 112)),
        const SizedBox(height: 12),
        Center(
          child: Text(m.fullName,
              textAlign: TextAlign.center,
              style: AppText.body(size: 20, weight: FontWeight.w700, color: AppColors.text)),
        ),
        if (m.memberNumber != null)
          Center(child: Text('#${m.memberNumber}', style: AppText.mono(size: 12))),
        if (verdict.asOf != null)
          Center(
            child: Text(t.asOf(fmtWhen(verdict.asOf)),
                style: AppText.mono(size: 10.5, letterSpacing: 0.8)),
          ),
        const SizedBox(height: 16),
        OfflineNotice(text: t.confirmIdentity, icon: Icons.verified_user_outlined, tone: AppColors.primary),
        const SizedBox(height: 12),
        for (final a in active)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Text(
              '${a.packageName ?? a.serviceType ?? '—'}'
              '${sessionsLeft(a) == null ? '' : ' · ${t.sessionsLeft(sessionsLeft(a)!)}'}',
              style: AppText.body(size: 13, color: AppColors.textSec),
            ),
          ),
        if (active.isEmpty) OfflineNotice(text: t.noActiveAssignments, tone: AppColors.warn),
        const SizedBox(height: 18),
        CButton(
          key: const Key('pass-continue'),
          label: t.logSession,
          icon: Icons.arrow_forward_rounded,
          full: true,
          size: CButtonSize.lg,
          disabled: active.isEmpty,
          onTap: active.isEmpty
              ? null
              : () => context.pushReplacement('/offline-log',
                  extra: OfflineLogArgs(
                      memberId: verdict.pass.memberId, qrRaw: verdict.pass.raw, source: 'qr')),
        ),
        const SizedBox(height: 8),
        CButton(label: t.scanAgain, variant: CButtonVariant.ghost, onTap: onAgain),
      ],
    );
  }
}
