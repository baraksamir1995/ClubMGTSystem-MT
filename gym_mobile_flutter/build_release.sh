#!/bin/bash
# Build a release APK with all dart-defines loaded from dart_defines.json
# Usage: ./build_release.sh
# Output: build/app/outputs/flutter-apk/app-release.apk

set -e

echo "Building release APK..."
flutter build apk \
  --release \
  --dart-define-from-file=dart_defines.json

echo ""
echo "Done! APK is at:"
echo "  build/app/outputs/flutter-apk/app-release.apk"
