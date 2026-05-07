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
