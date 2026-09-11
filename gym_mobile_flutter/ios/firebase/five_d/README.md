# Firebase config needed for 5D Fitness EG (iOS)

Drop `GoogleService-Info.plist` for bundle `com.clbyapp.fivedfitness` here,
from the Firebase console project for 5D Fitness EG.

The Runner target's "Copy Firebase config for flavor" build phase copies it
into the .app for any `*fiveD` build configuration. Without it, the build
fails at that phase with `cp: ... No such file or directory`.

Android counterpart: `android/app/src/fiveD/google-services.json`.
