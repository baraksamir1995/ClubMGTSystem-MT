import 'package:clby/l10n/l10n.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../models/popup_model.dart';

/// Deep-link route map: admin CTA action value → app route path.
const Map<String, String> _kRouteMap = {
  'memberships': '/membership',
  'membership':  '/membership',
  'trainer':     '/explore/trainers',
  'trainers':    '/explore/trainers',
  'session':     '/schedule',
  'schedule':    '/schedule',
  'payment':     '/billing',
  'billing':     '/billing',
  'offers':      '/explore/offers',
  'checkin':     '/checkin',
  'profile':     '/profile',
};

class PopupOverlay extends StatelessWidget {
  final PopupModel popup;

  /// Called when the popup is permanently dismissed (either via CTA or "Not now").
  final VoidCallback onDismiss;

  const PopupOverlay({
    super.key,
    required this.popup,
    required this.onDismiss,
  });

  Future<void> _handleCta(BuildContext context) async {
    onDismiss();
    Navigator.of(context).pop();

    if (!popup.hasCta) return;

    final actionType  = popup.ctaActionType;
    final actionValue = popup.ctaActionValue ?? '';

    if (actionType == 'external_link' && actionValue.isNotEmpty) {
      final uri = Uri.tryParse(actionValue);
      if (uri != null && await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } else if (actionType == 'internal' && actionValue.isNotEmpty) {
      final route = _kRouteMap[actionValue] ?? '/$actionValue';
      if (context.mounted) context.push(route);
    }
  }

  void _handleDismiss(BuildContext context) {
    onDismiss();
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
      child: _PopupCard(
        popup: popup,
        onCta: () => _handleCta(context),
        onDismiss: () => _handleDismiss(context),
      ),
    );
  }
}

// ─── Card ─────────────────────────────────────────────────────────────────────

class _PopupCard extends StatelessWidget {
  final PopupModel popup;
  final VoidCallback onCta;
  final VoidCallback onDismiss;

  const _PopupCard({
    required this.popup,
    required this.onCta,
    required this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    final theme    = Theme.of(context);
    final hasImage = popup.hasImage;

    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: Container(
        color: theme.colorScheme.surface,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // ── Hero image ─────────────────────────────────────────────────
            if (hasImage)
              Stack(
                children: [
                  AspectRatio(
                    aspectRatio: 16 / 9,
                    child: Image.network(
                      popup.imageUrl!,
                      fit: BoxFit.cover,
                      errorBuilder: (context, err, trace) => Container(
                        color: theme.colorScheme.surfaceContainerHighest,
                        height: 180,
                        child: const Icon(
                          Icons.image_not_supported_outlined,
                          size: 40,
                          color: Colors.white38,
                        ),
                      ),
                    ),
                  ),
                  // Bottom gradient for readability
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.transparent,
                            Colors.black.withValues(alpha: 0.28),
                          ],
                        ),
                      ),
                    ),
                  ),
                  // Close button overlaid on image
                  PositionedDirectional(
                    top: 10,
                    end: 10,
                    child: _CloseButton(onTap: onDismiss),
                  ),
                ],
              )
            else
              Align(
                alignment: AlignmentDirectional.topEnd,
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: _CloseButton(onTap: onDismiss),
                ),
              ),

            // ── Text + actions ─────────────────────────────────────────────
            Padding(
              padding: EdgeInsets.fromLTRB(24, hasImage ? 20 : 4, 24, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    popup.title,
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                      height: 1.2,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  if (popup.subtitle != null && popup.subtitle!.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      popup.subtitle!,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                        height: 1.45,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                  const SizedBox(height: 24),

                  // ── Primary CTA ──────────────────────────────────────────
                  if (popup.hasCta)
                    ElevatedButton(
                      onPressed: onCta,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: theme.colorScheme.primary,
                        foregroundColor: theme.colorScheme.onPrimary,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        elevation: 0,
                      ),
                      child: Text(
                        popup.ctaLabel!,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                        ),
                      ),
                    ),

                  // ── Secondary dismiss ────────────────────────────────────
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: onDismiss,
                    style: TextButton.styleFrom(
                      foregroundColor: theme.colorScheme.onSurfaceVariant,
                      padding: const EdgeInsets.symmetric(vertical: 4),
                    ),
                    child: Text(
                      context.l10n.popupNotNow,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
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

// ─── Close button ─────────────────────────────────────────────────────────────

class _CloseButton extends StatelessWidget {
  final VoidCallback onTap;
  const _CloseButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.45),
          shape: BoxShape.circle,
        ),
        child: const Icon(Icons.close_rounded, color: Colors.white, size: 18),
      ),
    );
  }
}
