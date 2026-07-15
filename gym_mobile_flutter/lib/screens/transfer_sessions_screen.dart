import 'dart:async';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:clby/l10n/l10n.dart';
import '../providers/auth_provider.dart';
import '../providers/member_provider.dart';
import '../services/api_service.dart';
import '../widgets/slide_to_confirm.dart';

/// Share sessions with another member in the same gym.
///
/// Multi-step flow mirroring the Transfer Confirmation design:
///   compose → confirm → loading → success | error
///
/// "compose" is a merged search + count picker (kept lighter than the
/// design's two separate steps since our member finds the recipient and
/// picks the count on the same screen). After Send the user lands on the
/// new confirm step (slide-to-confirm), then full-screen loading, then
/// either the success card with the new balance progress bar or the
/// error retry view.
enum _Step { search, amount, confirm, loading, success, error }

// Warm aesthetic tokens carried from the design — only the orange/peach
// accents are overridden to use the gym's primary/secondary colors at
// build time. Background neutralised to off-white per UX direction.
const _kBg = Color(0xFFF7F6F2);
const _kInk = Color(0xFF1F1A14);
const _kInk2 = Color(0x9E1F1A14); // 0.62 alpha
const _kInk3 = Color(0x6B1F1A14); // 0.42 alpha
const _kHair = Color(0x141F1A14); // 0.08 alpha
const _kCard = Color(0xFFFFFFFF);
const _kSuccess = Color(0xFF3F8B5C);
const _kError = Color(0xFFC24E3D);
const _kWarn = Color(0xFFB6531B);
const _kWarnBg = Color(0xFFFBEAD6);

class TransferSessionsScreen extends StatefulWidget {
  const TransferSessionsScreen({super.key});

  @override
  State<TransferSessionsScreen> createState() => _TransferSessionsScreenState();
}

class _TransferSessionsScreenState extends State<TransferSessionsScreen> {
  final _phoneCtrl = TextEditingController();
  int _count = 1;
  bool _isLooking = false;
  Map<String, dynamic>? _recipient;
  _Step _step = _Step.search;
  String? _errorMessage;
  Timer? _searchDebounce;
  bool _phoneFocused = false;
  final _phoneFocusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _phoneFocusNode.addListener(() {
      if (mounted) setState(() => _phoneFocused = _phoneFocusNode.hasFocus);
    });
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _phoneFocusNode.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  /// Live debounced lookup. Schedules a backend lookup ~400ms after the user
  /// stops typing, when they've entered ≥3 digits.
  void _scheduleLookup() {
    _searchDebounce?.cancel();
    final raw = _phoneCtrl.text.replaceAll(RegExp(r'[^0-9]'), '');
    if (raw.length < 3) {
      if (_recipient != null && mounted) setState(() => _recipient = null);
      return;
    }
    _searchDebounce = Timer(const Duration(milliseconds: 700), _lookup);
  }

  /// Normalise the user-typed phone into an E.164-ish string the backend
  /// can match against. If the user types a leading `+`, we trust their
  /// country code as-is; otherwise we default to Egypt (+20) — the primary
  /// local market — and strip any leading 0.
  String _normalizedPhone() {
    var raw = _phoneCtrl.text.trim();
    final hasPlus = raw.startsWith('+');
    raw = raw.replaceAll(RegExp(r'[^0-9]'), '');
    if (!hasPlus && raw.startsWith('0')) raw = raw.substring(1);
    return hasPlus ? '+$raw' : '+20$raw';
  }

  // ── lookup / transfer ─────────────────────────────────────────────────
  /// Live lookup. The empty-state UI in [_buildSearch] handles "no match"
  /// visually so we don't surface a snackbar for it — only for actual API
  /// errors (rate limit, server, network) which the user can act on.
  Future<void> _lookup() async {
    if (_phoneCtrl.text.trim().isEmpty) return;
    setState(() {
      _isLooking = true;
      _recipient = null;
    });
    try {
      final res = await ApiService().lookupMemberByPhone(_normalizedPhone());
      if (!mounted) return;
      setState(() => _recipient = res);
    } on ApiException catch (e) {
      if (mounted) _showSnack(e.message);
    } catch (_) {
      if (mounted) _showSnack(context.l10n.transferLookupFailed);
    } finally {
      if (mounted) setState(() => _isLooking = false);
    }
  }

  Future<void> _runTransfer() async {
    if (_recipient == null) return;
    setState(() => _step = _Step.loading);
    try {
      await ApiService().transferSessions(
        phone: _normalizedPhone(),
        count: _count,
      );
      if (!mounted) return;
      await context.read<MemberProvider>().refreshMembership();
      if (!mounted) return;
      setState(() => _step = _Step.success);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _step = _Step.error;
          _errorMessage = _mapReason(e.message);
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _step = _Step.error;
          _errorMessage = context.l10n.transferFailedConnection;
        });
      }
    }
  }

  String _mapReason(String raw) {
    final lower = raw.toLowerCase();
    if (raw.contains('insufficient_sessions')) return context.l10n.transferInsufficientSessions;
    if (raw.contains('no_eligible_membership')) return context.l10n.transferNoEligibleMembership;
    if (raw.contains('cannot_transfer_to_self')) return context.l10n.transferCannotSelf;
    if (raw.contains('receiver_not_in_gym')) return context.l10n.transferReceiverNotInGym;
    if (raw.contains('receiver_not_found')) return context.l10n.transferReceiverNotFound;
    if (lower.contains('too many attempts')) return context.l10n.transferTooManyAttempts;
    if (raw.contains('transfer_internal_error')) return context.l10n.transferServerError;
    return raw;
  }

  void _showSnack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: _kError,
    ));
  }

  void _restart() {
    setState(() {
      _step = _Step.search;
      _recipient = null;
      _phoneCtrl.clear();
      _count = 1;
      _errorMessage = null;
    });
  }

  // ── build ─────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final memberProvider = context.watch<MemberProvider>();
    final summary = memberProvider.membershipSummary;
    final membership = memberProvider.currentMembership;

    final available = summary?.totalSessions ?? (membership?.sessionsRemaining ?? 0);
    final hasBalance = available > 0
        && (summary != null && summary.buckets.isNotEmpty
            || (membership?.hasStudioAccess ?? false));

    final primary = Theme.of(context).colorScheme.primary;
    final secondary = Theme.of(context).colorScheme.secondary;

    return Scaffold(
      backgroundColor: _kBg,
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 250),
        switchInCurve: Curves.easeOut,
        child: KeyedSubtree(
          key: ValueKey(_step),
          child: switch (_step) {
            _Step.search => _buildSearch(available: available, hasBalance: hasBalance, primary: primary, secondary: secondary),
            _Step.amount => _buildAmount(balance: available, primary: primary, secondary: secondary),
            _Step.confirm => _buildConfirm(balance: available, primary: primary, secondary: secondary),
            _Step.loading => _buildLoading(primary: primary, secondary: secondary),
            _Step.success => _buildSuccess(balance: available, primary: primary, secondary: secondary),
            _Step.error => _buildError(primary: primary),
          },
        ),
      ),
    );
  }

  // ── header ────────────────────────────────────────────────────────────
  Widget _header({required String title, required VoidCallback onBack}) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
      child: SizedBox(
        height: 48,
        child: Row(
          children: [
            _circleIconButton(Icons.arrow_back_ios_new_rounded, onTap: onBack),
            const Spacer(),
            Text(
              title,
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w600,
                color: _kInk,
                letterSpacing: -0.2,
              ),
            ),
            const Spacer(),
            const SizedBox(width: 40),
          ],
        ),
      ),
    );
  }

  Widget _circleIconButton(IconData icon, {required VoidCallback onTap}) {
    return Material(
      color: const Color(0x0D1F1A14),
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: 40,
          height: 40,
          child: Icon(icon, size: 18, color: _kInk),
        ),
      ),
    );
  }

  // ── SEARCH step — design's SearchStep ────────────────────────────────
  Widget _buildSearch({
    required int available,
    required bool hasBalance,
    required Color primary,
    required Color secondary,
  }) {
    final digits = _phoneCtrl.text.replaceAll(RegExp(r'[^0-9]'), '');
    final tooShort = digits.isNotEmpty && digits.length < 3;
    final hasResult = _recipient != null;
    final showEmpty = digits.length >= 3 && !_isLooking && !hasResult;
    final peachTint = secondary.withValues(alpha: 0.32);

    return SafeArea(
      child: Column(
        children: [
          _header(title: context.l10n.transferSendSessions, onBack: () => Navigator.of(context).pop()),

          // Top fixed block (hero + search + balance chip)
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 8, 22, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  context.l10n.transferWhoTitle,
                  style: const TextStyle(
                    fontSize: 28, fontWeight: FontWeight.w600,
                    color: _kInk, letterSpacing: -0.6, height: 1.15,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  context.l10n.transferSearchSubtitle,
                  style: const TextStyle(fontSize: 14, color: _kInk2, height: 1.5),
                ),
                const SizedBox(height: 22),

                // Search input — country chooser + digits in a single white pill
                _searchInputRow(primary: primary),

                if (tooShort) ...[
                  Padding(
                    padding: const EdgeInsetsDirectional.only(top: 8, start: 4),
                    child: Text(
                      context.l10n.transferTypeAtLeast3,
                      style: const TextStyle(fontSize: 12, color: _kInk3),
                    ),
                  ),
                ],

                const SizedBox(height: 14),

                // Balance chip — peach (secondary tint)
                Container(
                  padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                  decoration: BoxDecoration(
                    color: peachTint,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(context.l10n.transferYouHave,
                          style: const TextStyle(fontSize: 13, color: _kInk2, fontWeight: FontWeight.w500)),
                      Text(
                        context.l10n.transferSessionsAvailable(available),
                        style: const TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w600, color: _kInk,
                          fontFeatures: [FontFeature.tabularFigures()],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Results / empty / hint
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(22, 20, 22, 22),
              children: [
                if (!hasBalance)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 18),
                    child: Text(
                      context.l10n.transferNoSharable,
                      style: const TextStyle(color: _kInk2, fontSize: 14),
                    ),
                  )
                else if (_isLooking) ...[
                  const SizedBox(height: 28),
                  Center(
                    child: SizedBox(
                      width: 22, height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        valueColor: AlwaysStoppedAnimation(primary),
                      ),
                    ),
                  ),
                ]
                else if (hasResult) ...[
                  Padding(
                    padding: const EdgeInsetsDirectional.only(start: 4, bottom: 8),
                    child: Text(
                      context.l10n.transferOneMatch,
                      style: const TextStyle(
                        fontSize: 11, color: _kInk3, fontWeight: FontWeight.w600,
                        letterSpacing: 0.6,
                      ),
                    ),
                  ),
                  _resultRow(),
                ]
                else if (showEmpty) ...[
                  Center(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 32),
                      child: Column(
                        children: [
                          Container(
                            width: 56, height: 56,
                            decoration: BoxDecoration(
                              color: peachTint, shape: BoxShape.circle,
                            ),
                            alignment: Alignment.center,
                            child: const Icon(Icons.search_rounded, color: _kInk, size: 22),
                          ),
                          const SizedBox(height: 14),
                          Text(
                            context.l10n.transferNoMemberFound,
                            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: _kInk),
                          ),
                          const SizedBox(height: 6),
                          ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 240),
                            child: Text(
                              context.l10n.transferDoubleCheck,
                              style: const TextStyle(fontSize: 13, color: _kInk2, height: 1.5),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ]
                else ...[
                  Center(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 28),
                      child: Column(
                        children: [
                          Container(
                            width: 56, height: 56,
                            decoration: BoxDecoration(
                              color: peachTint, shape: BoxShape.circle,
                            ),
                            alignment: Alignment.center,
                            child: const Icon(Icons.search_rounded, color: _kInk, size: 22),
                          ),
                          const SizedBox(height: 12),
                          ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 260),
                            child: Text(
                              context.l10n.transferStartTyping,
                              style: const TextStyle(fontSize: 14, color: _kInk2, height: 1.5),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// White-pill phone input matching the design's SearchStep input —
  /// phone icon on the left, single text field, optional clear button.
  /// Focus ring uses gym `primary`.
  Widget _searchInputRow({required Color primary}) {
    return Container(
      decoration: BoxDecoration(
        color: _kCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: _phoneFocused ? primary : Colors.transparent,
          width: 2,
        ),
        boxShadow: _phoneFocused
            ? null
            : const [BoxShadow(color: Color(0x0A1F1A14), blurRadius: 2, offset: Offset(0, 1))],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Row(
        children: [
          Icon(
            Icons.phone_outlined,
            size: 18,
            color: _phoneFocused ? primary : _kInk2,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: TextField(
              controller: _phoneCtrl,
              focusNode: _phoneFocusNode,
              keyboardType: TextInputType.phone,
              onChanged: (_) => _scheduleLookup(),
              cursorColor: primary,
              style: const TextStyle(
                fontSize: 16, color: _kInk, fontWeight: FontWeight.w500, letterSpacing: 0.3,
              ),
              decoration: const InputDecoration(
                hintText: '+20 100 000 0000',
                hintStyle: TextStyle(color: _kInk3, fontSize: 16, fontWeight: FontWeight.w500),
                // Zero out every border slot so the outer container's focus
                // ring is the only visible border on the pill.
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                disabledBorder: InputBorder.none,
                errorBorder: InputBorder.none,
                focusedErrorBorder: InputBorder.none,
                filled: false,
                isDense: true,
                contentPadding: EdgeInsets.symmetric(vertical: 14),
              ),
            ),
          ),
          if (_phoneCtrl.text.isNotEmpty)
            Padding(
              padding: const EdgeInsetsDirectional.only(start: 4),
              child: Material(
                color: const Color(0x141F1A14),
                shape: const CircleBorder(),
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: () {
                    setState(() {
                      _phoneCtrl.clear();
                      _recipient = null;
                    });
                  },
                  child: const SizedBox(
                    width: 22, height: 22,
                    child: Icon(Icons.close_rounded, size: 14, color: _kInk2),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  /// Single-result row matching the design — white card, avatar, name +
  /// VERIFIED pill, masked phone in monospace, chevron. Tapping it advances
  /// to the amount step.
  Widget _resultRow() {
    final name = _recipient?['full_name'] as String? ?? context.l10n.transferMemberFallback;
    final masked = _maskedPhone();
    return Material(
      color: _kCard,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => setState(() {
          _count = 1;
          _step = _Step.amount;
        }),
        child: Container(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            boxShadow: const [
              BoxShadow(color: Color(0x0A1F1A14), blurRadius: 2, offset: Offset(0, 1)),
            ],
          ),
          child: Row(
            children: [
              _RecipientAvatar(url: _recipient?['photo_url'] as String?, size: 42),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 15, fontWeight: FontWeight.w600,
                              color: _kInk, letterSpacing: -0.1,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                          decoration: BoxDecoration(
                            color: _kSuccess.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            context.l10n.transferVerified,
                            style: const TextStyle(
                              fontSize: 10, fontWeight: FontWeight.w600,
                              color: _kSuccess, letterSpacing: 0.3,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      masked,
                      style: const TextStyle(
                        fontSize: 12, color: _kInk2, fontFamily: 'Menlo', letterSpacing: 0.3,
                      ),
                    ),
                  ],
                ),
              ),
              const Padding(
                padding: EdgeInsetsDirectional.only(start: 4),
                child: Icon(Icons.chevron_right_rounded, size: 22, color: _kInk3),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Masks the typed phone for display: country code (the leading + and
  /// 1–4 digits) + last 4 digits with bullets in between. Matches the
  /// design's `maskPhone()`.
  String _maskedPhone() {
    final raw = _phoneCtrl.text.trim();
    final digits = raw.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.length <= 4) return raw;
    final last = digits.substring(digits.length - 4);
    final ccMatch = RegExp(r'^(\+\d{1,4})').firstMatch(raw);
    final cc = ccMatch?.group(1) ?? '+20';
    return '$cc ··· ··· $last';
  }

  // ── AMOUNT step — design's AmountStep ────────────────────────────────
  Widget _buildAmount({
    required int balance,
    required Color primary,
    required Color secondary,
  }) {
    final after = balance - _count;
    final presets = [1, 3, 5, 10].where((p) => p <= balance).toList();
    final recipientName = _recipient?['full_name'] as String? ?? context.l10n.transferMemberFallback;
    final peachTint = secondary.withValues(alpha: 0.32);

    return SafeArea(
      child: Column(
        children: [
          _header(title: context.l10n.transferHowMany, onBack: () => setState(() => _step = _Step.search)),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(22, 12, 22, 0),
              child: Column(
                children: [
                  // Recipient pill
                  Container(
                    padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
                    decoration: BoxDecoration(
                      color: _kCard,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: const [
                        BoxShadow(color: Color(0x0A1F1A14), blurRadius: 2, offset: Offset(0, 1)),
                      ],
                    ),
                    child: Row(
                      children: [
                        _RecipientAvatar(url: _recipient?['photo_url'] as String?, size: 40),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                context.l10n.transferSendingTo,
                                style: const TextStyle(
                                  fontSize: 11, color: _kInk2, fontWeight: FontWeight.w500,
                                  letterSpacing: 0.4,
                                ),
                              ),
                              const SizedBox(height: 1),
                              Text(
                                recipientName,
                                style: const TextStyle(
                                  fontSize: 15, fontWeight: FontWeight.w600, color: _kInk,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Big stepper
                  const SizedBox(height: 36),
                  Text(
                    context.l10n.transferSessionsCaps,
                    style: const TextStyle(
                      fontSize: 11, color: _kInk2, fontWeight: FontWeight.w600,
                      letterSpacing: 0.7,
                    ),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _bigStepperButton(
                        icon: Icons.remove_rounded,
                        background: _kCard, foreground: _kInk,
                        enabled: _count > 1,
                        onTap: () => setState(() => _count = (_count - 1).clamp(1, balance)),
                      ),
                      const SizedBox(width: 28),
                      SizedBox(
                        width: 110,
                        child: Center(
                          child: Text(
                            '$_count',
                            style: const TextStyle(
                              fontSize: 88, fontWeight: FontWeight.w600,
                              color: _kInk, letterSpacing: -3, height: 1,
                              fontFeatures: [FontFeature.tabularFigures()],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 28),
                      _bigStepperButton(
                        icon: Icons.add_rounded,
                        background: _kInk, foreground: Colors.white,
                        enabled: _count < balance,
                        onTap: () => setState(() => _count = (_count + 1).clamp(1, balance)),
                      ),
                    ],
                  ),

                  // Preset chips
                  const SizedBox(height: 28),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    alignment: WrapAlignment.center,
                    children: [
                      for (final p in presets) _presetChip(p, _count == p, () => setState(() => _count = p)),
                      if (balance > 1)
                        _presetChip(balance, _count == balance, () => setState(() => _count = balance), label: context.l10n.transferMax),
                    ],
                  ),

                  // Peach balance preview
                  const SizedBox(height: 28),
                  Container(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                    decoration: BoxDecoration(
                      color: peachTint,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(context.l10n.transferYoullHaveLeft,
                                  style: const TextStyle(fontSize: 12, color: _kInk2, fontWeight: FontWeight.w500)),
                              const SizedBox(height: 1),
                              Text(
                                context.l10n.transferSessionsCount(after),
                                style: TextStyle(
                                  fontSize: 17, fontWeight: FontWeight.w600,
                                  color: after < 3 ? _kWarn : _kInk,
                                  fontFeatures: const [FontFeature.tabularFigures()],
                                ),
                              ),
                            ],
                          ),
                        ),
                        Text.rich(
                          TextSpan(
                            style: const TextStyle(
                              fontSize: 13, fontWeight: FontWeight.w600, color: _kInk,
                              fontFeatures: [FontFeature.tabularFigures()],
                            ),
                            children: [
                              TextSpan(text: '$balance '),
                              const TextSpan(text: '→ ', style: TextStyle(color: _kInk3)),
                              TextSpan(
                                text: '$after',
                                style: TextStyle(color: _darken(primary, 0.18)),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const Spacer(),

                  // Continue
                  Padding(
                    padding: const EdgeInsets.only(bottom: 22),
                    child: SizedBox(
                      width: double.infinity,
                      height: 56,
                      child: FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: primary,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                        ).copyWith(
                          overlayColor: WidgetStatePropertyAll(_darken(primary, 0.06)),
                          shadowColor: WidgetStatePropertyAll(primary.withValues(alpha: 0.35)),
                        ),
                        onPressed: () => setState(() => _step = _Step.confirm),
                        child: Text(context.l10n.transferContinue,
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _bigStepperButton({
    required IconData icon,
    required Color background,
    required Color foreground,
    required bool enabled,
    required VoidCallback onTap,
  }) {
    return Opacity(
      opacity: enabled ? 1 : 0.4,
      child: Material(
        color: background,
        shape: const CircleBorder(),
        elevation: 0,
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: enabled ? onTap : null,
          child: SizedBox(
            width: 52, height: 52,
            child: Icon(icon, color: foreground, size: 26),
          ),
        ),
      ),
    );
  }

  Widget _presetChip(int value, bool selected, VoidCallback onTap, {String? label}) {
    return Material(
      color: selected ? _kInk : const Color(0x0D1F1A14),
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Text(
            label ?? '$value',
            style: TextStyle(
              fontSize: 13, fontWeight: FontWeight.w600,
              color: selected ? Colors.white : _kInk,
            ),
          ),
        ),
      ),
    );
  }

  static Color _darken(Color c, double amount) {
    final hsl = HSLColor.fromColor(c);
    return hsl.withLightness((hsl.lightness - amount).clamp(0.0, 1.0)).toColor();
  }

  // ── CONFIRM step — Variant B (Detailed) ──────────────────────────────
  Widget _buildConfirm({
    required int balance,
    required Color primary,
    required Color secondary,
  }) {
    final after = balance - _count;
    final recipientName = _recipient?['full_name'] as String? ?? context.l10n.transferMemberFallback;
    final senderName = context.read<AuthProvider>().profile?.fullName ?? context.l10n.transferYou;
    final membership = context.read<MemberProvider>().currentMembership;
    final sessionTypeLabel = (membership?.planName?.trim().isNotEmpty ?? false)
        ? membership!.planName!
        : context.l10n.transferGroupSessions;

    return SafeArea(
      child: Column(
        children: [
          _header(title: context.l10n.transferConfirmTitle, onBack: () => setState(() => _step = _Step.amount)),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
              child: Column(
                children: [
                  // ── Sender → Recipient pill card ────────────────────
                  _whiteCard(
                    radius: 28,
                    padding: const EdgeInsets.all(22),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          child: Column(
                            children: [
                              _personAvatar(name: senderName, size: 52),
                              const SizedBox(height: 8),
                              Text(context.l10n.transferFrom,
                                  style: const TextStyle(
                                    fontSize: 11, fontWeight: FontWeight.w500,
                                    color: _kInk2, letterSpacing: 1.4,
                                  )),
                              const SizedBox(height: 2),
                              Text(
                                context.l10n.transferYou,
                                style: const TextStyle(
                                  fontSize: 14, fontWeight: FontWeight.w600, color: _kInk,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // Sessions count chip — uses gym primary, sized to content
                            // so it always sits on a single line.
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                              decoration: BoxDecoration(
                                color: primary,
                                borderRadius: BorderRadius.circular(999),
                                boxShadow: [
                                  BoxShadow(
                                    color: primary.withValues(alpha: 0.35),
                                    blurRadius: 12, offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              child: Text(
                                context.l10n.transferSessionsCount(_count),
                                maxLines: 1,
                                softWrap: false,
                                overflow: TextOverflow.visible,
                                style: const TextStyle(
                                  fontSize: 14, fontWeight: FontWeight.w700,
                                  color: Colors.white, letterSpacing: 0.2,
                                  fontFeatures: [FontFeature.tabularFigures()],
                                ),
                              ),
                            ),
                            const SizedBox(height: 6),
                            CustomPaint(
                              size: const Size(80, 14),
                              painter: _DashedArrowPainter(),
                            ),
                          ],
                        ),
                        Expanded(
                          child: Column(
                            children: [
                              _RecipientAvatar(url: _recipient?['photo_url'] as String?, size: 52),
                              const SizedBox(height: 8),
                              Text(context.l10n.transferTo,
                                  style: const TextStyle(
                                    fontSize: 11, fontWeight: FontWeight.w500,
                                    color: _kInk2, letterSpacing: 1.4,
                                  )),
                              const SizedBox(height: 2),
                              ConstrainedBox(
                                constraints: const BoxConstraints(maxWidth: 110),
                                child: Text(
                                  recipientName,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                    fontSize: 14, fontWeight: FontWeight.w600, color: _kInk,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),

                  // ── Detail rows card ────────────────────────────────
                  _whiteCard(
                    radius: 22,
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                    child: Column(
                      children: [
                        _detailRow(label: context.l10n.transferSessionType, value: sessionTypeLabel),
                        _detailRow(label: context.l10n.transferQuantity, value: context.l10n.transferSessionsCount(_count)),
                        _detailRow(label: context.l10n.transferYourBalance, value: context.l10n.transferSessionsCount(balance)),
                        _detailRow(
                          label: context.l10n.transferBalanceAfter,
                          value: context.l10n.transferSessionsCount(after),
                          valueColor: after < 3 ? _kWarn : _kInk,
                          last: true,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),

                  // ── Warning box ─────────────────────────────────────
                  Container(
                    padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                    decoration: BoxDecoration(
                      color: _kWarnBg,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Padding(
                          padding: EdgeInsets.only(top: 1),
                          child: Icon(Icons.info_outline, size: 16, color: _kWarn),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            context.l10n.transferWarning,
                            style: const TextStyle(
                              fontSize: 13, color: _kWarn, height: 1.45,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const Spacer(),

                  // ── CTA: Slide to send + Edit transfer ──────────────
                  Padding(
                    padding: const EdgeInsets.only(bottom: 22),
                    child: Column(
                      children: [
                        SlideToConfirm(
                          label: context.l10n.transferSlideToSend(_count),
                          primary: primary,
                          onConfirm: _runTransfer,
                        ),
                        SizedBox(
                          width: double.infinity,
                          height: 48,
                          child: TextButton(
                            onPressed: () => setState(() => _step = _Step.amount),
                            child: Text(
                              context.l10n.transferEdit,
                              style: const TextStyle(
                                color: _kInk2, fontSize: 15, fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _detailRow({
    required String label,
    required String value,
    Color valueColor = _kInk,
    bool mono = false,
    bool last = false,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        border: last ? null : const Border(bottom: BorderSide(color: _kHair, width: 1)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 14, color: _kInk2, fontWeight: FontWeight.w500,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: valueColor,
              fontFamily: mono ? 'Menlo' : null,
              letterSpacing: mono ? 0.5 : 0,
            ),
          ),
        ],
      ),
    );
  }

  Widget _personAvatar({required String name, double size = 52}) {
    final initials = name
        .split(RegExp(r'\s+'))
        .where((p) => p.isNotEmpty)
        .take(2)
        .map((p) => p[0].toUpperCase())
        .join();
    final hues = [
      const Color(0xFFF4DCC1),
      const Color(0xFFEFD0B0),
      const Color(0xFFF2C9A8),
      const Color(0xFFEAC59C),
    ];
    final hue = hues[(name.codeUnits.firstOrNull ?? 0) % hues.length];
    return Container(
      width: size, height: size,
      decoration: BoxDecoration(
        color: hue,
        shape: BoxShape.circle,
        boxShadow: const [BoxShadow(color: Color(0x0A1F1A14), blurRadius: 1, spreadRadius: 0.5)],
      ),
      alignment: Alignment.center,
      child: Text(
        initials,
        style: TextStyle(
          fontWeight: FontWeight.w600,
          color: _kInk,
          fontSize: size * 0.36,
          letterSpacing: 0.2,
        ),
      ),
    );
  }

  // ── LOADING step ──────────────────────────────────────────────────────
  Widget _buildLoading({required Color primary, required Color secondary}) {
    final recipientName = _recipient?['full_name'] as String? ?? context.l10n.transferMemberFallback;
    final peach = secondary.withValues(alpha: 0.32);
    final logoUrl = context.read<AuthProvider>().gym?.logoUrl;
    return SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 84,
                height: 84,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    SizedBox(
                      width: 84, height: 84,
                      child: CircularProgressIndicator(
                        strokeWidth: 4,
                        valueColor: AlwaysStoppedAnimation(primary),
                        backgroundColor: peach,
                      ),
                    ),
                    _AnimatedGymLogo(
                      logoUrl: logoUrl,
                      backgroundColor: peach,
                      size: 48,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 28),
              Text(
                context.l10n.transferSending,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w600,
                  color: _kInk,
                  letterSpacing: -0.4,
                ),
              ),
              const SizedBox(height: 6),
              Text.rich(
                TextSpan(
                  style: const TextStyle(fontSize: 14, color: _kInk2, height: 1.5),
                  children: [
                    TextSpan(text: '${context.l10n.transferTransferringTo(_count)}\n'),
                    TextSpan(
                      text: recipientName,
                      style: const TextStyle(color: _kInk, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── SUCCESS step ──────────────────────────────────────────────────────
  Widget _buildSuccess({
    required int balance,
    required Color primary,
    required Color secondary,
  }) {
    // After the API call, refreshMembership has updated `available` to the
    // new balance — we use that as the post-transfer state.
    final after = balance;
    // Total before the transfer = current balance + what was sent.
    final totalBefore = after + _count;
    final progress = totalBefore == 0 ? 0.0 : (after / totalBefore).clamp(0.0, 1.0);
    final recipientName = _recipient?['full_name'] as String? ?? context.l10n.transferMemberFallback;

    return SafeArea(
      child: Column(
        children: [
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 40, 24, 0),
              child: Column(
                children: [
                  // Animated success ring (pop)
                  TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0, end: 1),
                    duration: const Duration(milliseconds: 420),
                    curve: const Cubic(.2, 1.4, .4, 1),
                    builder: (_, t, child) => Transform.scale(
                      scale: 0.4 + 0.6 * t,
                      child: Opacity(opacity: t.clamp(0.0, 1.0), child: child),
                    ),
                    child: Container(
                      width: 96, height: 96,
                      decoration: BoxDecoration(
                        color: _kSuccess,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: _kSuccess.withValues(alpha: 0.35),
                            blurRadius: 28, offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: const Icon(Icons.check_rounded, color: Colors.white, size: 48),
                    ),
                  ),
                  const SizedBox(height: 28),
                  Text(
                    context.l10n.transferSent,
                    style: const TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w600,
                      color: _kInk,
                      letterSpacing: -0.6,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text.rich(
                    TextSpan(
                      style: const TextStyle(fontSize: 15, color: _kInk2, height: 1.5),
                      children: [
                        TextSpan(
                          text: context.l10n.transferSessionsCount(_count),
                          style: const TextStyle(color: _kInk, fontWeight: FontWeight.w600),
                        ),
                        TextSpan(text: ' ${context.l10n.transferDeliveredTo}\n'),
                        TextSpan(
                          text: recipientName,
                          style: const TextStyle(color: _kInk, fontWeight: FontWeight.w600),
                        ),
                        TextSpan(text: '. ${context.l10n.transferNotificationNote}'),
                      ],
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 28),

                  // Remaining balance card with progress bar
                  _whiteCard(
                    radius: 22,
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(context.l10n.transferRemainingBalance,
                                style: const TextStyle(fontSize: 13, color: _kInk2, fontWeight: FontWeight.w500)),
                            Text(
                              '$after',
                              style: const TextStyle(
                                fontSize: 22, fontWeight: FontWeight.w600, color: _kInk,
                                fontFeatures: [FontFeature.tabularFigures()],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: progress,
                            minHeight: 8,
                            backgroundColor: secondary.withValues(alpha: 0.32),
                            valueColor: AlwaysStoppedAnimation(primary),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 0, 22, 22),
            child: Column(
              children: [
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: _kInk,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                    ),
                    onPressed: () => Navigator.of(context).pop(),
                    child: Text(context.l10n.commonDone,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 16)),
                  ),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: TextButton(
                    onPressed: _restart,
                    child: Text(
                      context.l10n.transferSendAnother,
                      style: const TextStyle(color: _kInk2, fontSize: 15, fontWeight: FontWeight.w500),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── ERROR step ────────────────────────────────────────────────────────
  Widget _buildError({required Color primary}) {
    return SafeArea(
      child: Column(
        children: [
          _header(title: context.l10n.transferConfirmTitle, onBack: _restart),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
              child: Column(
                children: [
                  Container(
                    width: 88, height: 88,
                    decoration: BoxDecoration(
                      color: _kError,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: _kError.withValues(alpha: 0.32),
                          blurRadius: 28, offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.priority_high_rounded, color: Colors.white, size: 44),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    context.l10n.transferFailedTitle,
                    style: const TextStyle(
                      fontSize: 24, fontWeight: FontWeight.w600,
                      color: _kInk, letterSpacing: -0.4,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    context.l10n.transferFailedBody,
                    style: const TextStyle(fontSize: 14, color: _kInk2, height: 1.5),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 22),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: _kError.withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.info_outline, size: 16, color: _kError),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _errorMessage ?? context.l10n.transferUnknownError,
                            style: const TextStyle(
                              fontSize: 13, color: _kError,
                              fontWeight: FontWeight.w500, height: 1.5,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 0, 22, 22),
            child: Column(
              children: [
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: primary,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                      elevation: 0,
                    ),
                    onPressed: _runTransfer,
                    child: Text(context.l10n.transferTryAgain,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 16)),
                  ),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: TextButton(
                    onPressed: _restart,
                    child: Text(
                      context.l10n.transferCancel,
                      style: const TextStyle(color: _kInk2, fontSize: 15, fontWeight: FontWeight.w500),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── UI fragments ──────────────────────────────────────────────────────
  Widget _whiteCard({
    required Widget child,
    double radius = 22,
    EdgeInsets padding = const EdgeInsets.fromLTRB(18, 16, 18, 16),
  }) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: _kCard,
        borderRadius: BorderRadius.circular(radius),
        boxShadow: const [
          BoxShadow(color: Color(0x0A1F1A14), blurRadius: 2, offset: Offset(0, 1)),
        ],
      ),
      child: child,
    );
  }

}

/// Animated gym logo for the loading state. Continuously pulses scale +
/// fade so the user feels the action is in flight. Falls back to a
/// fitness-center icon when the gym hasn't set a logo.
class _AnimatedGymLogo extends StatefulWidget {
  final String? logoUrl;
  final Color backgroundColor;
  final double size;

  const _AnimatedGymLogo({
    required this.logoUrl,
    required this.backgroundColor,
    required this.size,
  });

  @override
  State<_AnimatedGymLogo> createState() => _AnimatedGymLogoState();
}

class _AnimatedGymLogoState extends State<_AnimatedGymLogo>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _scale;
  late final Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    )..repeat(reverse: true);
    _scale = Tween<double>(begin: 0.82, end: 1.0)
        .chain(CurveTween(curve: Curves.easeInOut))
        .animate(_ctrl);
    _opacity = Tween<double>(begin: 0.7, end: 1.0)
        .chain(CurveTween(curve: Curves.easeInOut))
        .animate(_ctrl);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final inner = (widget.logoUrl != null && widget.logoUrl!.isNotEmpty)
        ? ClipOval(
            child: CachedNetworkImage(
              imageUrl: widget.logoUrl!,
              width: widget.size, height: widget.size, fit: BoxFit.cover,
              placeholder: (_, __) => _fallback(),
              errorWidget: (_, __, ___) => _fallback(),
            ),
          )
        : _fallback();
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, child) => Opacity(
        opacity: _opacity.value,
        child: Transform.scale(scale: _scale.value, child: child),
      ),
      child: Container(
        width: widget.size, height: widget.size,
        decoration: BoxDecoration(
          color: widget.backgroundColor,
          shape: BoxShape.circle,
        ),
        child: inner,
      ),
    );
  }

  Widget _fallback() => const Icon(Icons.fitness_center_rounded, color: _kInk, size: 24);
}

/// 80×14 dashed arrow used in Variant B between sender and recipient avatars.
class _DashedArrowPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    const dashStroke = 1.6;
    const arrowStroke = 1.8;
    final dashPaint = Paint()
      ..color = _kInk3
      ..strokeWidth = dashStroke
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    final arrowPaint = Paint()
      ..color = _kInk
      ..strokeWidth = arrowStroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;

    // Dashed line from x=2 to x=72 at y=7
    const dashLen = 3.0, gapLen = 3.0;
    double x = 2;
    while (x < 72) {
      canvas.drawLine(Offset(x, 7), Offset(x + dashLen, 7), dashPaint);
      x += dashLen + gapLen;
    }
    // Arrow head: 68,2 → 74,7 → 68,12
    final path = Path()
      ..moveTo(68, 2)
      ..lineTo(74, 7)
      ..lineTo(68, 12);
    canvas.drawPath(path, arrowPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter old) => false;
}

class _RecipientAvatar extends StatelessWidget {
  final String? url;
  final double size;
  const _RecipientAvatar({required this.url, this.size = 48});

  @override
  Widget build(BuildContext context) {
    final fallback = Container(
      width: size, height: size,
      decoration: const BoxDecoration(
        color: Color(0xFFF4DCC1),
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: const Icon(Icons.person_rounded, color: _kInk),
    );
    if (url == null || url!.isEmpty) return fallback;
    return ClipOval(
      child: CachedNetworkImage(
        imageUrl: url!,
        width: size, height: size,
        fit: BoxFit.cover,
        placeholder: (_, __) => fallback,
        errorWidget: (_, __, ___) => fallback,
      ),
    );
  }
}
