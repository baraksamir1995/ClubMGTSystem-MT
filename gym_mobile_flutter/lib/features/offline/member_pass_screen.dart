import 'dart:convert';
import 'dart:io';

import 'package:clby/l10n/l10n.dart';
import 'package:clby_offline/clby_offline.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:screen_protector/screen_protector.dart';

import 'member_offline_controller.dart';
import 'offline_ui.dart';

/// The member's own pass (PHASE3 §4): cached QR, shown offline too.
/// High error correction; screen-capture protection on this screen only
/// (global protection caused black-screen bugs — see main.dart).
/// No brightness boost: no brightness plugin is in the app.
class MemberPassScreen extends StatefulWidget {
  const MemberPassScreen({super.key});

  @override
  State<MemberPassScreen> createState() => _MemberPassScreenState();
}

class _MemberPassScreenState extends State<MemberPassScreen> {
  CachedMemberPass? _pass;
  String? _name;
  String? _number;
  List<CachedMembership> _buckets = const [];
  DateTime? _asOf;
  bool _loading = true;
  bool _refreshing = false;

  @override
  void initState() {
    super.initState();
    _protect(true);
    WidgetsBinding.instance.addPostFrameCallback((_) => _load(refreshIfNeeded: true));
  }

  @override
  void dispose() {
    _protect(false);
    super.dispose();
  }

  Future<void> _protect(bool on) async {
    try {
      if (Platform.isIOS) {
        on ? await ScreenProtector.preventScreenshotOn() : await ScreenProtector.preventScreenshotOff();
      } else if (Platform.isAndroid) {
        on ? await ScreenProtector.protectDataLeakageOn() : await ScreenProtector.protectDataLeakageOff();
      }
    } catch (_) {/* unsupported platform / plugin error: show anyway */}
  }

  Future<void> _load({bool refreshIfNeeded = false}) async {
    final c = context.read<MemberOfflineController>();
    final s = c.store;
    if (s == null) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    var pass = await s.memberPass();
    final needsRefresh = pass == null || pass.isExpiredAt(DateTime.now()) || c.sync.dataExpired;
    if (refreshIfNeeded && needsRefresh && !c.offlineMode && c.sync.online) {
      await _refresh(reload: false);
      pass = await s.memberPass();
    }
    final me = await s.db.readMeta(SyncMetaKeys.member);
    Map<String, dynamic>? meJson;
    try {
      meJson = me == null ? null : jsonDecode(me) as Map<String, dynamic>;
    } catch (_) {}
    final self = meJson?['gym_member_id']?.toString();
    final buckets = self == null ? <CachedMembership>[] : await s.membershipsOf(self);
    final asOfRaw = await s.db.readMeta(SyncMetaKeys.asOf);
    if (!mounted) return;
    setState(() {
      _pass = pass;
      _name = meJson?['full_name']?.toString();
      _number = meJson?['member_number']?.toString();
      _buckets = buckets;
      _asOf = asOfRaw == null ? null : DateTime.tryParse(asOfRaw);
      _loading = false;
    });
  }

  Future<void> _refresh({bool reload = true}) async {
    setState(() => _refreshing = true);
    try {
      await context.read<MemberOfflineController>().refreshData();
    } catch (_) {/* stays on cached pass */}
    if (!mounted) return;
    setState(() => _refreshing = false);
    if (reload) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final c = context.watch<MemberOfflineController>();
    final pass = _pass;
    final expired = pass != null && pass.isExpiredAt(DateTime.now());
    final canRefresh = !c.offlineMode && c.store != null;
    return Scaffold(
      backgroundColor: kOffBg,
      appBar: AppBar(
        backgroundColor: kOffBg,
        surfaceTintColor: kOffBg,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: kOffInk),
          onPressed: () => context.canPop() ? context.pop() : context.go('/offline'),
        ),
        title: Text(l.memberPassTitle, style: const TextStyle(color: kOffInk, fontWeight: FontWeight.w700)),
        actions: const [Padding(padding: EdgeInsetsDirectional.only(end: 12), child: Center(child: OfflineSyncChip()))],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(22, 8, 22, 32),
              children: [
                OfflineCard(
                  padding: const EdgeInsets.all(22),
                  child: Column(children: [
                    if (pass == null)
                      _Message(text: l.memberPassUnavailable)
                    else if (expired)
                      _Message(text: l.memberPassExpiredOffline)
                    else ...[
                      Text(l.memberPassHint,
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 13, color: kOffMuted)),
                      const SizedBox(height: 16),
                      Container(
                        key: const Key('member-pass-qr'),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18)),
                        child: QrImageView(
                          data: pass.qr,
                          version: QrVersions.auto,
                          size: 248,
                          backgroundColor: Colors.white,
                          errorCorrectionLevel: QrErrorCorrectLevel.H,
                          padding: EdgeInsets.zero,
                        ),
                      ),
                    ],
                    const SizedBox(height: 16),
                    if (_name != null)
                      Text(_name!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: kOffInk)),
                    if (_number != null)
                      Text(l.memberPassNumber(_number!),
                          style: const TextStyle(fontSize: 13, color: kOffMuted)),
                    if (pass?.expiresAt != null && !expired) ...[
                      const SizedBox(height: 8),
                      Text(l.memberPassValidUntil(fmtOfflineDate(context, pass!.expiresAt)),
                          key: const Key('member-pass-valid-until'),
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: kOffSuccess)),
                    ],
                  ]),
                ),
                if (_buckets.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  OfflineCard(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(l.checkinMembershipAsOf(fmtOfflineTime(context, _asOf)),
                          style: const TextStyle(fontSize: 12, color: kOffMuted, letterSpacing: 0.2)),
                      const SizedBox(height: 8),
                      for (final b in _buckets)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 3),
                          child: Text(
                            [
                              b.planType ?? b.sourceType ?? '—',
                              if (b.endDay != null) '→ ${b.endDay}',
                              if (b.sessionsRemaining != null) '· ${b.sessionsRemaining}',
                            ].join(' '),
                            style: const TextStyle(fontSize: 14, color: kOffInk),
                          ),
                        ),
                    ]),
                  ),
                ],
                if (canRefresh) ...[
                  const SizedBox(height: 16),
                  OutlinedButton.icon(
                    onPressed: _refreshing ? null : _refresh,
                    icon: _refreshing
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.refresh_rounded),
                    label: Text(l.memberPassRefresh),
                  ),
                ],
              ],
            ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({required this.text});
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 24),
        child: Text(text,
            key: const Key('member-pass-message'),
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 14, color: kOffMuted, height: 1.4)),
      );
}
