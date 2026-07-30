import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../core/constants/app_colors.dart';
import '../core/constants/app_text.dart';
import '../features/coach/coach_app_state.dart';
import '../features/coach/screens/attendance_screen.dart';
import '../features/coach/screens/members_screen.dart';
import '../features/coach/screens/qr_screen.dart';
import '../features/coach/widgets/bottom_nav.dart';
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
    final firstLoad = state.identity == null && state.isLoading;
    final hardError = state.identity == null && state.error != null;

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: Stack(
        children: [
          Positioned.fill(
            child: firstLoad
                ? const _ShellLoading()
                : hardError
                    ? _ShellError(
                        message: state.error!,
                        onRetry: () => context.read<CoachAppState>().load(),
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
  final VoidCallback onRetry;
  final VoidCallback onSignOut;

  const _ShellError({
    required this.message,
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
