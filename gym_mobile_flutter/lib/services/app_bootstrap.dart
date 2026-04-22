import 'dart:async';

import 'package:flutter/foundation.dart';

import '../features/banners/banner_provider.dart';
import '../features/branches/branch_provider.dart';
import '../features/popups/popup_provider.dart';
import '../providers/auth_provider.dart';
import '../providers/member_provider.dart';

/// Runs during the splash phase to pre-load all critical data.
///
/// Load order:
///   1. Wait for [AuthProvider] to finish its own session/profile init.
///   2. If not authenticated → return early (nothing to preload).
///   3. Load member data + banners + notifications in parallel.
///   4. Load sessions (requires member to be resolved first).
///   5. Call [MemberProvider.markBootstrapped] so screens skip their
///      own initState data fetch, preventing UI flicker.
class AppBootstrap {
  static const _totalTimeout = Duration(seconds: 12);
  static const _authTimeout = Duration(seconds: 10);
  static const _dataTimeout = Duration(seconds: 8);
  static const _sessionsTimeout = Duration(seconds: 6);

  final AuthProvider _auth;
  final MemberProvider _member;
  final BannerProvider _banners;
  final BranchProvider _branches;
  final PopupProvider _popups;

  AppBootstrap({
    required AuthProvider authProvider,
    required MemberProvider memberProvider,
    required BannerProvider bannerProvider,
    required BranchProvider branchProvider,
    required PopupProvider popupProvider,
  })  : _auth = authProvider,
        _member = memberProvider,
        _banners = bannerProvider,
        _branches = branchProvider,
        _popups = popupProvider;

  /// Runs the full bootstrap. Always resolves (never throws).
  Future<void> run() async {
    try {
      await _run().timeout(_totalTimeout);
    } catch (e) {
      debugPrint('[AppBootstrap] Bootstrap ended early: $e');
      // Never block navigation — let the app start even if data failed.
    }
  }

  Future<void> _run() async {
    // ── 1. Wait for AuthProvider to complete its session check ────────────
    await _waitForAuth();
    debugPrint('[AppBootstrap] after waitForAuth: authed=${_auth.isAuthenticated} profile=${_auth.profile?.id} gymId=${_auth.profile?.gymId}');

    // ── 2. Nothing to preload for unauthenticated / guest users ──────────
    if (!_auth.isAuthenticated) { debugPrint('[AppBootstrap] not authenticated — skipping'); return; }

    final gymId = _auth.profile?.gymId;
    if (gymId == null) { debugPrint('[AppBootstrap] no gymId on profile — skipping'); return; }
    debugPrint('[AppBootstrap] running preload for gym=$gymId');

    // ── 3. Load member data, notifications, banners, popup concurrently ──
    //       Notifications, banners, and popup only need gymId.
    //       Member data must finish before sessions (sessions need member.id).
    await Future.wait<void>([
      _member.loadMemberData(gymId),
      _member.loadNotifications(gymId),
      _banners.loadBanners(gymId),
      _branches.loadBranches(gymId),
      _popups.loadActivePopup(gymId),
    ]).timeout(_dataTimeout, onTimeout: () => []);

    // ── 4. Load sessions (enrichment uses member.id) ──────────────────────
    if (_member.member != null) {
      try {
        await _member.loadSessions(gymId).timeout(_sessionsTimeout);
      } catch (e) {
        debugPrint('[AppBootstrap] Sessions load timed out or failed: $e');
      }
    }

    // ── 5. Signal that bootstrap completed ────────────────────────────────
    _member.markBootstrapped();
  }

  /// Waits for [AuthProvider.isLoading] to become false.
  /// Returns immediately if already resolved.
  Future<void> _waitForAuth() async {
    if (!_auth.isLoading) return;

    final completer = Completer<void>();

    void listener() {
      if (!_auth.isLoading && !completer.isCompleted) {
        _auth.removeListener(listener);
        completer.complete();
      }
    }

    _auth.addListener(listener);

    try {
      await completer.future.timeout(_authTimeout);
    } catch (_) {
      _auth.removeListener(listener);
    }
  }
}
