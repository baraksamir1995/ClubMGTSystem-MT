import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:clby/l10n/l10n.dart';
import 'package:provider/provider.dart';
import '../models/session_model.dart';
import '../providers/auth_provider.dart';
import '../providers/member_provider.dart';
import '../services/api_service.dart';
import '../utils/error_utils.dart';

// ── Entry point ───────────────────────────────────────────────────────────────

Future<bool?> showRatingSheet(BuildContext context, Session session) {
  return showModalBottomSheet<bool?>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _RatingSheet(session: session),
  );
}

// ── Bottom sheet ──────────────────────────────────────────────────────────────

class _RatingSheet extends StatefulWidget {
  final Session session;
  const _RatingSheet({required this.session});

  @override
  State<_RatingSheet> createState() => _RatingSheetState();
}

class _RatingSheetState extends State<_RatingSheet> {
  int? _sessionRating;   // 1–5
  int? _trainerRating;   // 1–5, optional
  final _reviewCtrl = TextEditingController();
  bool _submitted = false;
  bool _submitting = false;

  List<String> get _labels => [
        context.l10n.ratingTerrible,
        context.l10n.ratingBad,
        context.l10n.ratingOkay,
        context.l10n.ratingGood,
        context.l10n.ratingExcellent,
      ];
  static const _emojis = ['😞', '😐', '😐', '😊', '😄'];
  static const _emojiColors = [
    Color(0xFFEF4444),
    Color(0xFFF97316),
    Color(0xFFEAB308),
    Color(0xFF22C55E),
    Color(0xFF22C55E),
  ];

  @override
  void dispose() {
    _reviewCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_sessionRating == null) return;
    setState(() => _submitting = true);
    try {
      final memberProvider = context.read<MemberProvider>();
      final authProvider = context.read<AuthProvider>();
      final memberId = memberProvider.member?.id;
      final gymId = authProvider.profile?.gymId;
      final bookingId = widget.session.bookingId;

      if (memberId == null || gymId == null || bookingId == null) {
        throw Exception('Missing required data');
      }

      await ApiService().submitRating(
        sessionId: widget.session.id,
        bookingId: bookingId,
        gymMemberId: memberId,
        gymId: gymId,
        sessionRating: _sessionRating!,
        trainerRating: _trainerRating,
        review: _reviewCtrl.text.trim().isEmpty ? null : _reviewCtrl.text.trim(),
      );

      if (mounted) {
        setState(() { _submitted = true; _submitting = false; });
        // Refresh sessions so hasRated reflects on the card
        final memberProvider = context.read<MemberProvider>();
        final authProvider = context.read<AuthProvider>();
        final gymId = authProvider.profile?.gymId;
        if (gymId != null) memberProvider.loadSessions(gymId);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(context.l10n.ratingSubmitFailed(friendlyError(e))),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    }
  }

  String get _sessionRatingLabel =>
      _sessionRating != null ? _labels[_sessionRating! - 1] : '';

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).padding.bottom;

    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFFF5F5F0),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(bottom: bottom),
      child: AnimatedSize(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
        child: _submitted ? _buildSuccess() : _buildForm(),
      ),
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────

  Widget _buildForm() {
    final session = widget.session;
    final timeStr = _formatTime(session.scheduledAt, session.endTime);
    final dateStr = DateFormat('EEE, MMM d').format(session.scheduledAt);
    final reviewLen = _reviewCtrl.text.length;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.symmetric(vertical: 12),
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Header
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      context.l10n.ratingTitle,
                      style: const TextStyle(
                          fontSize: 20, fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      context.l10n.ratingSubtitle,
                      style: TextStyle(
                          fontSize: 13,
                          color: Colors.black.withValues(alpha: 0.5)),
                    ),
                  ],
                ),
              ),
              GestureDetector(
                onTap: () => Navigator.of(context).pop(),
                child: Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.08),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.close, size: 16),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Session info card
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                  color: Colors.black.withValues(alpha: 0.08)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        session.className ?? context.l10n.sessionCardClass,
                        style: const TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 15),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '$dateStr · $timeStr',
                        style: TextStyle(
                            fontSize: 12,
                            color:
                                Colors.black.withValues(alpha: 0.5)),
                      ),
                      if (session.instructor != null) ...[
                        const SizedBox(height: 1),
                        Text(
                          session.instructor!,
                          style: TextStyle(
                              fontSize: 12,
                              color: Colors.black
                                  .withValues(alpha: 0.5)),
                        ),
                      ],
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: const Color(0xFFDCFCE7),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                        color: const Color(0xFF16A34A)
                            .withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.check,
                          size: 12, color: Color(0xFF16A34A)),
                      const SizedBox(width: 4),
                      Text(
                        context.l10n.sessionCardAttended,
                        style: const TextStyle(
                          color: Color(0xFF16A34A),
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Session overall rating
          Text(
            context.l10n.ratingHowWasSession,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
          ),
          const SizedBox(height: 2),
          Text(
            context.l10n.ratingOverallHint,
            style: TextStyle(
                fontSize: 12, color: Colors.black.withValues(alpha: 0.5)),
          ),
          const SizedBox(height: 14),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(5, (i) {
              final rating = i + 1;
              final selected = _sessionRating == rating;
              final color = _emojiColors[i];
              return GestureDetector(
                onTap: () {
                  HapticFeedback.lightImpact();
                  setState(() => _sessionRating = rating);
                },
                child: Column(
                  children: [
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      width: 54,
                      height: 54,
                      decoration: BoxDecoration(
                        color: selected
                            ? color.withValues(alpha: 0.12)
                            : Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: selected
                              ? color
                              : Colors.black.withValues(alpha: 0.1),
                          width: selected ? 1.5 : 1,
                        ),
                      ),
                      child: Center(
                        child: Text(
                          _emojis[i],
                          // Force the platform emoji font as fallback —
                          // Flutter on iOS occasionally fails to cascade
                          // emoji glyphs from the inherited text style and
                          // renders them as tofu boxes.
                          style: const TextStyle(
                            fontSize: 24,
                            fontFamilyFallback: [
                              'Apple Color Emoji',
                              'Noto Color Emoji',
                              'Segoe UI Emoji',
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _labels[i],
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: selected
                            ? FontWeight.w700
                            : FontWeight.w400,
                        color: selected
                            ? color
                            : Colors.black.withValues(alpha: 0.5),
                      ),
                    ),
                  ],
                ),
              );
            }),
          ),

          // Trainer rating + review — appear after session is rated
          if (_sessionRating != null) ...[
            const SizedBox(height: 24),
            _buildDivider(),
            const SizedBox(height: 20),

            // Trainer rating
            if (session.instructor != null) ...[
              Row(
                children: [
                  Text(
                    context.l10n.ratingHowWasTrainer(session.instructor!),
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 15),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    context.l10n.ratingOptional,
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.black.withValues(alpha: 0.4),
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                context.l10n.ratingTrainerHint,
                style: TextStyle(
                    fontSize: 12,
                    color: Colors.black.withValues(alpha: 0.5)),
              ),
              const SizedBox(height: 12),
              Row(
                children: List.generate(5, (i) {
                  final rating = i + 1;
                  final filled = _trainerRating != null &&
                      rating <= _trainerRating!;
                  return GestureDetector(
                    onTap: () {
                      HapticFeedback.lightImpact();
                      setState(() => _trainerRating = rating);
                    },
                    child: Padding(
                      padding: const EdgeInsetsDirectional.only(end: 8),
                      child: Icon(
                        filled ? Icons.star_rounded : Icons.star_outline_rounded,
                        size: 32,
                        color: filled
                            ? const Color(0xFFF59E0B)
                            : Colors.black.withValues(alpha: 0.2),
                      ),
                    ),
                  );
                }),
              ),
              const SizedBox(height: 20),
              _buildDivider(),
              const SizedBox(height: 20),
            ],

            // Review text
            Row(
              children: [
                Text(
                  context.l10n.ratingLeaveReview,
                  style:
                      const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                ),
                const SizedBox(width: 6),
                Text(
                  context.l10n.ratingOptional,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.black.withValues(alpha: 0.4),
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              context.l10n.ratingShareHint,
              style: TextStyle(
                  fontSize: 12,
                  color: Colors.black.withValues(alpha: 0.5)),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _reviewCtrl,
              maxLines: 4,
              maxLength: 300,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                hintText: context.l10n.ratingReviewHint,
                hintStyle: TextStyle(
                    color: Colors.black.withValues(alpha: 0.35),
                    fontSize: 13),
                filled: true,
                fillColor: Colors.white,
                counterText: '$reviewLen / 300',
                counterStyle: TextStyle(
                    color: Colors.black.withValues(alpha: 0.4),
                    fontSize: 11),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(
                      color: Colors.black.withValues(alpha: 0.1)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(
                      color: Colors.black.withValues(alpha: 0.1)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFF1D1D1B)),
                ),
                contentPadding: const EdgeInsets.all(12),
              ),
            ),
          ],

          const SizedBox(height: 20),

          // Submit button
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1D1D1B),
                foregroundColor: Colors.white,
                disabledBackgroundColor:
                    Colors.black.withValues(alpha: 0.12),
                disabledForegroundColor:
                    Colors.black.withValues(alpha: 0.35),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
                textStyle: const TextStyle(
                    fontSize: 16, fontWeight: FontWeight.w600),
              ),
              onPressed:
                  (_sessionRating != null && !_submitting) ? _submit : null,
              child: _submitting
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : Text(context.l10n.ratingSubmit),
            ),
          ),

          // Skip
          if (!_submitted) ...[
            const SizedBox(height: 10),
            GestureDetector(
              onTap: () => Navigator.of(context).pop(false),
              child: Center(
                child: Text(
                  context.l10n.ratingSkipForNow,
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.black.withValues(alpha: 0.45),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ── Success screen ─────────────────────────────────────────────────────────

  Widget _buildSuccess() {
    final authProvider = context.read<AuthProvider>();
    final name = authProvider.profile?.fullName ?? context.l10n.ratingYou;
    final initial = name.isNotEmpty ? name[0].toUpperCase() : 'Y';
    final review = _reviewCtrl.text.trim();
    final trainerStars = _trainerRating ?? 0;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Green checkmark circle
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: const Color(0xFFDCFCE7),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.check_rounded,
                size: 32, color: Color(0xFF16A34A)),
          ),
          const SizedBox(height: 16),
          Text(
            context.l10n.ratingThanks,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Text(
            context.l10n.ratingSubmittedDesc,
            textAlign: TextAlign.center,
            style: TextStyle(
                fontSize: 13, color: Colors.black.withValues(alpha: 0.5)),
          ),
          const SizedBox(height: 20),

          // Summary pills
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _SummaryPill(
                label: context.l10n.ratingSessionSummary(_sessionRatingLabel),
                color: _emojiColors[(_sessionRating ?? 1) - 1],
              ),
              if (_trainerRating != null) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                        color: Colors.black.withValues(alpha: 0.1)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(context.l10n.ratingTrainerSummary,
                          style: const TextStyle(
                              fontSize: 12, fontWeight: FontWeight.w600)),
                      ...List.generate(
                        trainerStars,
                        (i) => const Icon(Icons.star_rounded,
                            size: 14, color: Color(0xFFF59E0B)),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),

          // Review preview
          if (review.isNotEmpty) ...[
            const SizedBox(height: 16),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                    color: Colors.black.withValues(alpha: 0.08)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 30,
                    height: 30,
                    decoration: const BoxDecoration(
                      color: Color(0xFFDDE4FF),
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(
                        initial,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                          color: Color(0xFF4F46E5),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              name.split(' ').first,
                              style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13),
                            ),
                            Text(
                              context.l10n.ratingJustNow,
                              style: TextStyle(
                                fontSize: 11,
                                color: Colors.black
                                    .withValues(alpha: 0.4),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(review,
                            style: const TextStyle(fontSize: 13)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 20),

          // Done button
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1D1D1B),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
                textStyle: const TextStyle(
                    fontSize: 16, fontWeight: FontWeight.w600),
              ),
              onPressed: () => Navigator.of(context).pop(true),
              child: Text(context.l10n.commonDone),
            ),
          ),
          const SizedBox(height: 10),
          GestureDetector(
            onTap: () => Navigator.of(context).pop(true),
            child: Center(
              child: Text(
                context.l10n.ratingViewBookings,
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.black.withValues(alpha: 0.5),
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDivider() => Container(
        height: 1,
        color: Colors.black.withValues(alpha: 0.06),
      );

  String _formatTime(DateTime start, DateTime? end) {
    final s = DateFormat('h:mm a').format(start);
    if (end == null) return s;
    return '$s – ${DateFormat('h:mm a').format(end)}';
  }
}

// ── Summary pill ──────────────────────────────────────────────────────────────

class _SummaryPill extends StatelessWidget {
  final String label;
  final Color color;
  const _SummaryPill({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
