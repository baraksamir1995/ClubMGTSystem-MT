#!/usr/bin/env bash
#
# Build a flavored Flutter binary.
#
# Usage:
#   scripts/build_flavor.sh <flavor> <kind>
#
# Arguments:
#   <flavor>   Lowercase flavor name (e.g. clby, shift). Must have a matching
#              flavors/<flavor>.json and (for non-clby) a
#              flutter_launcher_icons-<flavor>.yaml.
#   <kind>     One of: apk | appbundle | ipa
#
# Examples:
#   scripts/build_flavor.sh clby apk          # multi-tenant Android APK
#   scripts/build_flavor.sh shift ipa         # white-label shift iOS archive
#
# Behaviour:
#   - For non-clby flavors, regenerates launcher icons from
#     flutter_launcher_icons-<flavor>.yaml first, so the brand asset is fresh.
#     clby's icons are committed and skipped.
#   - Reads dart-defines from flavors/<flavor>.json.
#   - Passes --flavor <flavor> through to Flutter, which routes to the matching
#     Android productFlavor and iOS scheme.
#
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <flavor> <apk|appbundle|ipa>" >&2
  exit 64
fi

FLAVOR="$1"
KIND="$2"

# Repo root is the parent of this script's directory.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DEFINES="flavors/${FLAVOR}.json"
ICONS_YAML="flutter_launcher_icons-${FLAVOR}.yaml"
SPLASH_YAML="flutter_native_splash-${FLAVOR}.yaml"

if [[ ! -f "$DEFINES" ]]; then
  echo "error: $DEFINES does not exist." >&2
  echo "Create it from flavors/clby.json.template before building." >&2
  exit 66
fi

case "$KIND" in
  apk|appbundle|ipa) ;;
  *)
    echo "error: kind must be one of: apk | appbundle | ipa (got '$KIND')" >&2
    exit 64
    ;;
esac

# clby's icons are committed; only regenerate per-flavor icons for white-labels.
if [[ "$FLAVOR" != "clby" && -f "$ICONS_YAML" ]]; then
  echo "==> Regenerating launcher icons for $FLAVOR"
  dart run flutter_launcher_icons -f "$ICONS_YAML"
fi

# Native splash assets are shared on disk, so regenerate per-flavor on every
# build to keep iOS LaunchScreen.storyboard / Android launch_background.xml
# matched to the flavor being built.
if [[ -f "$SPLASH_YAML" ]]; then
  echo "==> Regenerating native splash for $FLAVOR"
  dart run flutter_native_splash:create --path="$SPLASH_YAML"

  # When the YAML omits `image:`, flutter_native_splash writes a 1×1 BLACK
  # pixel to LaunchImage*.png. The storyboard renders that pixel at the old
  # declared 168×185 size — a black rectangle in the middle of the launch
  # screen. Repaint the LaunchImage pixels to match the YAML's `color:` so
  # the launch surface stays uniform.
  if ! grep -qE "^[[:space:]]*image:" "$SPLASH_YAML"; then
    SPLASH_BG=$(grep -E "^[[:space:]]*color:" "$SPLASH_YAML" | head -1 \
                | sed -E 's/.*color:[[:space:]]*"?#?([0-9A-Fa-f]+)"?.*/\1/')
    if [[ -n "$SPLASH_BG" ]]; then
      echo "==> Repainting LaunchImage*.png to #$SPLASH_BG"
      python3 - "$SPLASH_BG" <<'PY'
import sys
from PIL import Image
hex_color = sys.argv[1]
r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
img = Image.new('RGB', (1, 1), (r, g, b))
for p in [
    'ios/Runner/Assets.xcassets/LaunchImage.imageset/LaunchImage.png',
    'ios/Runner/Assets.xcassets/LaunchImage.imageset/LaunchImage@2x.png',
    'ios/Runner/Assets.xcassets/LaunchImage.imageset/LaunchImage@3x.png',
]:
    img.save(p)
PY
    fi
  fi
fi

echo "==> flutter build $KIND --flavor $FLAVOR --dart-define-from-file=$DEFINES"
flutter build "$KIND" \
  --release \
  --flavor "$FLAVOR" \
  --dart-define-from-file="$DEFINES"

echo
echo "Done. Output:"
case "$KIND" in
  apk)        echo "  build/app/outputs/flutter-apk/app-${FLAVOR}-release.apk" ;;
  appbundle)  echo "  build/app/outputs/bundle/${FLAVOR}Release/app-${FLAVOR}-release.aab" ;;
  ipa)        echo "  build/ios/ipa/*.ipa" ;;
esac
