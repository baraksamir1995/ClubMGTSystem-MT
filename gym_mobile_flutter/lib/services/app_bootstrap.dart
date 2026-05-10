import 'dart:async';

import '../utils/logger.dart';

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
      appLog('[AppBootstrap] Bootstrap ended early: $e');
      // Never block navigation — let the app start even if data failed.
    }
  }

  Future<void> _run() async {
    // ── 1. Wait for AuthProvider to complete its session check ────────────
    await _waitForAuth();

    // ── 2. Nothing to preload for unauthenticated / guest users ──────────
    if (!_auth.isAuthenticated) return;

    final gymId = _auth.profile?.gymId;
    if (gymId == null) return;

    // ── 3. Critical-path loads — only what's visible on home above the
    //      fold the moment we navigate there. Sessions / notifications /
    //      popup are NOT awaited here:
    //        - sessions: HomeScreen renders the "Today's classes" shimmer
    //          for ~300ms while loadSessions runs in the background.
    //        - notifications: bell badge populates in the background.
    //        - popup: HomeScreen calls maybeShowPopup on its own, the
    //          first call performs the load if needed.
    //      Each previously added a full network round-trip to splash
    //      duration; deferring them shaves 1-2s off cold start without
    //      visible regression.
    bool criticalLoadsCompleted = false;
    try {
      await Future.wait<void>([
        _member.loadMemberData(gymId),
        _banners.loadBanners(gymId),
        _branches.loadBranches(gymId),
      ]).timeout(_dataTimeout);
      criticalLoadsCompleted = true;
    } catch (e) {
      appLog('[AppBootstrap] Critical loads failed/timed out: $e');
      // Leave isBootstrapped=false so HomeScreen's _loadData fallback
      // re-issues these requests once it mounts.
    }

    // ── 4. Background loads — fire-and-forget. They populate state via
    //      notifyListeners as they complete; splash doesn't wait.
    unawaited(_member.loadNotifications(gymId));
    unawaited(_member.loadSessions(gymId));
    unawaited(_popups.loadActivePopup(gymId));

    // ── 5. Signal that bootstrap completed only when critical-path data
    //      actually landed. Marking bootstrapped on a timeout would let
    //      HomeScreen skip its own fetch and leave shimmers stuck.
    if (criticalLoadsCompleted) {
      _member.markBootstrapped();
    }
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
