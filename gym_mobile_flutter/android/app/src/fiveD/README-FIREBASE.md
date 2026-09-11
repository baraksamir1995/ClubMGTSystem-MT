# Firebase config needed for 5D Fitness EG

Drop the Android `google-services.json` for bundle `com.clbyapp.fivedfitness`
here (from the Firebase console project for 5D Fitness EG).

The iOS counterpart goes in `ios/firebase/five_d/GoogleService-Info.plist` —
the Runner "Copy brand GoogleService-Info" build phase copies it for any
`*fiveD` configuration.

Until both exist, release builds of this flavor will fail at the
google-services Gradle step (Android) / have no FCM push (iOS).
