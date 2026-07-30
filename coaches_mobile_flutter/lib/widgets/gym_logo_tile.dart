import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../core/constants/app_colors.dart';
import '../core/constants/app_text.dart';
import '../providers/branding_provider.dart';
import '../utils/env.dart';

/// The gym's logo in a rounded tile, degrading to the gym's initial while
/// the image loads or when the URL is dead/absent. Single definition shared
/// by the login header ([GymBrandHeader]) and the home header
/// ([CoachGreetingHeader]) so the two can't drift apart.
///
/// Uses [CachedNetworkImage] (same convention as gym_mobile_flutter) so the
/// logo survives cold starts and offline launches — the whole point of the
/// branding cache.
class GymLogoTile extends StatelessWidget {
  final double size;
  final GymBranding? branding;

  const GymLogoTile({super.key, required this.size, required this.branding});

  @override
  Widget build(BuildContext context) {
    final b = branding;
    final initialSource =
        (b != null && b.name.trim().isNotEmpty) ? b.name.trim() : Env.brandName;
    final initial = initialSource.isEmpty
        ? '?'
        : initialSource.characters.first.toUpperCase();
    final fallback = Center(
      child: Text(
        initial,
        style: AppText.disp(size: size * 0.45, color: AppColors.text),
      ),
    );
    final logoUrl = b?.logoUrl;
    return Container(
      width: size,
      height: size,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(size * 0.28),
        border: Border.all(color: AppColors.border),
      ),
      child: (logoUrl != null && logoUrl.isNotEmpty)
          ? CachedNetworkImage(
              imageUrl: logoUrl,
              fit: BoxFit.cover,
              placeholder: (_, _) => fallback,
              errorWidget: (_, _, _) => fallback,
            )
          : fallback,
    );
  }
}
