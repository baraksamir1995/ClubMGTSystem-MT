import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../core/constants/app_colors.dart';
import '../core/constants/app_text.dart';
import '../features/coach/coach_app_state.dart';
import '../features/coach/load_error.dart';
import '../features/coach/screens/attendance_screen.dart';
import '../features/coach/screens/members_screen.dart';
import '../features/coach/screens/qr_screen.dart';
import '../features/coach/widgets/bottom_nav.dart';
import '../features/offline/coach_offline_controller.dart';
import '../features/offline/offline_home.dart';
import '../features/offline/offline_strings.dart';
import '../providers/auth_provider.dart';
import '../widgets/c_button.dart';

/// Authenticated coach shell. The Scan tab is the QR home. Members /
/// Log live alongside. CoachAppState is loaded once on first build; the
/// shell renders a dark splash while the first roster + today are
/// fetching, and an error fallback (with Retry) if the load fails.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _index = 0;
  bool _kickedOff = false;
  /// The current load failure has been acted on (offline attempt, sign-in
  /// redirect, or engine pause). Reset by [_retryOnline].
  bool _errorHandled = false;

  /// Retry the online load (profile + roster); a fresh network failure may
  /// enter offline mode again.
  void _retryOnline() {
    _errorHandled = false;
    final auth = context.read<AuthProvider>();
    if (auth.profile == null) auth.refreshProfile();
    context.read<CoachAppState>().load();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Kick off the initial roster + today fetch once. Subsequent navigation
    // back to /home doesn't refetch — the tabs have their own
    // pull-to-refresh affordances.
    if (!_kickedOff) {
      _kickedOff = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        context.read<CoachAppState>().load();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<CoachAppState>();
    final offline = context.watch<CoachOfflineController>();
    final firstLoad = state.identity == null && state.isLoading;
    final hardError = state.identity == null && state.error != null;

    final action = hardError ? homeErrorAction(state.errorKind) : null;

    // Only a NETWORK failure (no connection / timeout / 5xx) may open
    // offline mode: reopen the SAME coach's store (token + user in secure
    // storage, store opens with its own key, has cached data).
    // 401 → normal sign-in flow. 403 (access revoked, inactive trainer
    // profile) → blocked screen + engine paused, never offline mode.
    if (!_errorHandled && action != null) {
      _errorHandled = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final ctl = context.read<CoachOfflineController>();
        switch (action) {
          case HomeErrorAction.tryOfflineMode:
            if (!ctl.offlineMode) ctl.tryEnterOfflineMode();
          case HomeErrorAction.signIn:
            _signOut(context);
          case HomeErrorAction.blocked:
            ctl.onAccessForbidden(state.error ?? 'forbidden');
          case HomeErrorAction.showError:
            break;
        }
      });
    }
    if (state.identity != null && offline.offlineMode) {
      WidgetsBinding.instance.addPostFrameCallback(
          (_) => context.read<CoachOfflineController>().leaveOfflineMode());
    }
    if (action == HomeErrorAction.tryOfflineMode && offline.offlineMode) {
      return Scaffold(
        backgroundColor: AppColors.bg,
        body: OfflineHome(
          onRetry: _retryOnline,
          onSignOut: () => _signOut(context),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: Stack(
        children: [
          Positioned.fill(
            child: firstLoad ||
                    (action == HomeErrorAction.tryOfflineMode && offline.checkingEntry) ||
                    action == HomeErrorAction.signIn
                ? const _ShellLoading()
                : hardError
                    ? _ShellError(
                        message: state.error!,
                        // Network failure but offline mode was refused:
                        // say exactly why.
                        detail: action == HomeErrorAction.tryOfflineMode &&
                                offline.entryBlock != null
                            ? OfflineStrings.current().entryBlocked(offline.entryBlock!)
                            : null,
                        onRetry: _retryOnline,
                        onSignOut: () => _signOut(context),
                      )
                    : _tabContent(),
          ),
          if (!firstLoad && !hardError)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: CoachBottomNav(
                index: _index,
                onTabChanged: (i) => setState(() => _index = i),
                onLogout: () => _signOut(context),
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _signOut(BuildContext context) async {
    final auth = context.read<AuthProvider>();
    final coach = context.read<CoachAppState>();
    await auth.signOut();
    coach.clear();
    if (context.mounted) context.go('/login');
  }

  Widget _tabContent() {
    switch (_index) {
      case 0:
        return const QrScreen();
      case 1:
        return const MembersScreen();
      case 2:
        return const AttendanceScreen();
      default:
        return const SizedBox.shrink();
    }
  }
}

class _ShellLoading extends StatelessWidget {
  const _ShellLoading();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SizedBox(
        width: 24,
        height: 24,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          valueColor: AlwaysStoppedAnimation(AppColors.lime),
        ),
      ),
    );
  }
}

class _ShellError extends StatelessWidget {
  final String message;
  final String? detail;
  final VoidCallback onRetry;
  final VoidCallback onSignOut;

  const _ShellError({
    required this.message,
    this.detail,
    required this.onRetry,
    required this.onSignOut,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: AppColors.surface2,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.border),
              ),
              alignment: Alignment.center,
              child: Icon(Icons.cloud_off_rounded,
                  size: 26, color: AppColors.textSec),
            ),
            const SizedBox(height: 16),
            Text(
              "CAN'T REACH THE GYM",
              style: AppText.disp(
                size: 22,
                letterSpacing: 1.2,
                color: AppColors.text,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: AppText.body(
                size: 13,
                color: AppColors.textSec,
                letterSpacing: -0.1,
                height: 1.4,
              ),
            ),
            if (detail != null) ...[
              const SizedBox(height: 10),
              Text(
                detail!,
                key: const Key('offline-entry-blocked'),
                textAlign: TextAlign.center,
                textDirection: OfflineStrings.current().direction,
                style: AppText.body(
                  size: 12.5,
                  color: AppColors.warn,
                  letterSpacing: -0.1,
                  height: 1.4,
                ),
              ),
            ],
            const SizedBox(height: 22),
            CButton(
              label: 'Retry',
              icon: Icons.refresh_rounded,
              variant: CButtonVariant.primary,
              size: CButtonSize.md,
              onTap: onRetry,
            ),
            const SizedBox(height: 8),
            CButton(
              label: 'Sign out',
              variant: CButtonVariant.ghost,
              size: CButtonSize.sm,
              onTap: onSignOut,
            ),
          ],
        ),
      ),
    );
  }
}
