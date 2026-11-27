import 'package:clby/l10n/l10n.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import 'member_offline_controller.dart';

enum _PendingChoice { cancel, sync, signOut }

/// Before signing out (PHASE3 §4): if check-ins are still waiting to be
/// confirmed, say so and offer "Sync now" when online. Pending events are
/// never deleted by sign-out (they stay for this account on this phone).
/// Returns true when sign-out should proceed.
Future<bool> warnPendingBeforeSignOut(BuildContext context) async {
  final c = context.read<MemberOfflineController>();
  final pending = c.pendingCount;
  if (pending == 0 || c.store == null) return true;
  final l = context.l10n;
  final canSync = !c.offlineMode && c.sync.online;
  final choice = await showDialog<_PendingChoice>(
    context: context,
    builder: (ctx) => AlertDialog(
      key: const Key('signout-pending-dialog'),
      title: Text(l.signOutPendingTitle(pending)),
      content: Text(l.signOutPendingBody),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(ctx, _PendingChoice.cancel),
            child: Text(l.commonCancel)),
        if (canSync)
          TextButton(
              onPressed: () => Navigator.pop(ctx, _PendingChoice.sync),
              child: Text(l.syncNowAction)),
        TextButton(
            onPressed: () => Navigator.pop(ctx, _PendingChoice.signOut),
            child: Text(l.signOutPendingSignOutAnyway)),
      ],
    ),
  );
  switch (choice) {
    case _PendingChoice.signOut:
      return true;
    case _PendingChoice.sync:
      await c.syncNow();
      // Everything confirmed → go ahead; otherwise stay (state is visible).
      return c.pendingCount == 0;
    case _PendingChoice.cancel:
    case null:
      return false;
  }
}

/// Sign-out used from offline mode (same AuthProvider.signOut fan-out).
Future<void> confirmSignOut(BuildContext context) async {
  if (!await warnPendingBeforeSignOut(context)) return;
  if (!context.mounted) return;
  await context.read<AuthProvider>().signOut();
  if (context.mounted) context.go('/login');
}
