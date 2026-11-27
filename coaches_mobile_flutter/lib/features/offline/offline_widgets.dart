import 'package:cached_network_image/cached_network_image.dart';
import 'package:clby_offline/clby_offline.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_colors.dart';
import '../../core/constants/app_text.dart';
import '../../widgets/avatar.dart';
import 'coach_offline_controller.dart';
import 'offline_logic.dart';
import 'offline_strings.dart';

String fmtWhen(DateTime? t) =>
    t == null ? '—' : DateFormat('d MMM, HH:mm', 'en_GB').format(t.toLocal());

String fmtAge(Duration? d) {
  if (d == null) return '—';
  if (d.inDays >= 1) return '${d.inDays} d ${d.inHours.remainder(24)} h';
  if (d.inHours >= 1) return '${d.inHours} h ${d.inMinutes.remainder(60)} min';
  return '${d.inMinutes} min';
}

({Color fg, Color bg, IconData icon}) indicatorStyle(SyncIndicator i) => switch (i) {
      SyncIndicator.online => (fg: AppColors.success, bg: AppColors.successSoft, icon: Icons.cloud_done_outlined),
      SyncIndicator.syncing => (fg: AppColors.primary, bg: AppColors.primarySoft, icon: Icons.sync_rounded),
      SyncIndicator.pending => (fg: AppColors.warn, bg: AppColors.warnSoft, icon: Icons.schedule_rounded),
      SyncIndicator.offline => (fg: AppColors.textSec, bg: AppColors.surface2, icon: Icons.cloud_off_rounded),
      SyncIndicator.expired => (fg: AppColors.warn, bg: AppColors.warnSoft, icon: Icons.history_toggle_off_rounded),
      SyncIndicator.failed ||
      SyncIndicator.authRequired ||
      SyncIndicator.deviceRevoked ||
      SyncIndicator.deviceMismatch =>
        (fg: AppColors.danger, bg: AppColors.dangerSoft, icon: Icons.error_outline_rounded),
    };

/// Connection / sync indicator (contract states). Tap → readiness screen.
class SyncIndicatorChip extends StatelessWidget {
  const SyncIndicatorChip({super.key, this.onTap});
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.watch<CoachOfflineController>();
    final t = OfflineStrings.current();
    final st = indicatorStyle(c.sync.indicator);
    return Semantics(
      button: true,
      label: indicatorLabel(c.sync, t),
      child: GestureDetector(
        onTap: onTap ?? () => context.push('/offline-status'),
        child: Container(
          key: const Key('sync-indicator'),
          padding: const EdgeInsetsDirectional.fromSTEB(10, 6, 12, 6),
          decoration: BoxDecoration(
            color: st.bg,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(st.icon, size: 14, color: st.fg),
              const SizedBox(width: 6),
              Text(indicatorLabel(c.sync, t),
                  style: AppText.body(size: 12, weight: FontWeight.w600, color: st.fg)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Cached member photo (disk cache from earlier online views), initials
/// fallback when offline and never downloaded.
class MemberPhoto extends StatelessWidget {
  const MemberPhoto({super.key, required this.name, this.url, this.size = 44});
  final String name;
  final String? url;
  final double size;

  @override
  Widget build(BuildContext context) {
    final fallback = Avatar(name: name.isEmpty ? '?' : name, size: size);
    final u = url;
    if (u == null || u.isEmpty) return fallback;
    return ClipOval(
      child: CachedNetworkImage(
        imageUrl: u,
        width: size,
        height: size,
        fit: BoxFit.cover,
        placeholder: (_, _) => fallback,
        errorWidget: (_, _, _) => fallback,
      ),
    );
  }
}

/// Saved / Synced / Rejected chip for one recorded item.
class EventStateChip extends StatelessWidget {
  const EventStateChip({super.key, required this.event});
  final OutboxEvent event;

  @override
  Widget build(BuildContext context) {
    final t = OfflineStrings.current();
    final s = OutboxStatus.fromWire(event.syncStatus);
    final (fg, bg, icon) = switch (s) {
      OutboxStatus.synced => (AppColors.success, AppColors.successSoft, Icons.check_circle_outline_rounded),
      OutboxStatus.rejected => (AppColors.danger, AppColors.dangerSoft, Icons.block_rounded),
      _ => (AppColors.warn, AppColors.warnSoft, Icons.schedule_rounded),
    };
    return Container(
      padding: const EdgeInsetsDirectional.fromSTEB(8, 4, 10, 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: fg),
          const SizedBox(width: 5),
          Flexible(
            child: Text(itemStateLabel(event, t),
                style: AppText.body(size: 11.5, weight: FontWeight.w600, color: fg)),
          ),
        ],
      ),
    );
  }
}

/// Small bordered notice row (policy off / online-only / errors).
class OfflineNotice extends StatelessWidget {
  const OfflineNotice({super.key, required this.text, this.icon = Icons.info_outline_rounded, this.tone});
  final String text;
  final IconData icon;
  final Color? tone;

  @override
  Widget build(BuildContext context) {
    final fg = tone ?? AppColors.textSec;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: fg),
          const SizedBox(width: 8),
          Expanded(
            child: Text(text,
                style: AppText.body(size: 12.5, color: fg, height: 1.4, letterSpacing: -0.1)),
          ),
        ],
      ),
    );
  }
}
