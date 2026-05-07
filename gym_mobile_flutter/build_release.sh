#!/bin/bash
# Build a release APK for the default (multi-tenant) clby flavor.
# For a white-labeled brand build, use scripts/build_flavor.sh instead.
# Usage: ./build_release.sh
# Output: build/app/outputs/flutter-apk/app-release.apk

set -e

echo "Building release APK..."
flutter build apk \
  --release \
  --flavor clby \
  --dart-define-from-file=flavors/clby.json

echo ""
echo "Done! APK is at:"
echo "  build/app/outputs/flutter-apk/app-release.apk"
