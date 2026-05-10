plugins {
    id("com.android.application")
    // START: FlutterFire Configuration
    id("com.google.gms.google-services")
    // END: FlutterFire Configuration
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}
import java.util.Properties
import java.io.FileInputStream

// Per-flavor signing — clby's keystore + shift's keystore live in separate
// properties files so each white-label brand can rotate its signing key
// independently. Both files are gitignored.
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

val shiftKeystoreProperties = Properties()
val shiftKeystorePropertiesFile = rootProject.file("shift-key.properties")
if (shiftKeystorePropertiesFile.exists()) {
    shiftKeystoreProperties.load(FileInputStream(shiftKeystorePropertiesFile))
}

android {
    namespace = "com.clubmgt.gym_mobile_flutter"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }
    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }
    defaultConfig {
        // applicationId moved into the clby flavor — every brand has its own.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }
    // Per-brand white-label dimension. Each flavor owns its applicationId,
    // user-visible app name, and (via src/<flavor>/res/) its launcher icon
    // and Firebase config. Build with:
    //   flutter build apk --flavor clby --dart-define-from-file=flavors/clby.json
    signingConfigs {
        create("release") {
            keyAlias = keystoreProperties.getProperty("keyAlias")
            keyPassword = keystoreProperties.getProperty("keyPassword")
            storeFile = keystoreProperties.getProperty("storeFile")?.let { f -> file(f) }
            storePassword = keystoreProperties.getProperty("storePassword")
        }
        create("releaseShift") {
            keyAlias = shiftKeystoreProperties.getProperty("keyAlias")
            keyPassword = shiftKeystoreProperties.getProperty("keyPassword")
            storeFile = shiftKeystoreProperties.getProperty("storeFile")?.let { f -> file(f) }
            storePassword = shiftKeystoreProperties.getProperty("storePassword")
        }
    }
    // Per-brand white-label dimension. Each flavor owns its applicationId,
    // user-visible app name, signing keystore, version, and (via
    // src/<flavor>/res/) launcher icon + Firebase config. Build with:
    //   flutter build apk --flavor clby --dart-define-from-file=flavors/clby.json
    flavorDimensions += "brand"
    productFlavors {
        create("clby") {
            dimension = "brand"
            // Renamed from com.clubmgt.gym_mobile_flutter so clby ships under the
            // same com.clbyapp.* namespace as shift on Play Store. Done before
            // the first Play upload, so no install base to break.
            applicationId = "com.clbyapp.clby"
            resValue("string", "app_name", "CLBY")
            signingConfig = signingConfigs.getByName("release")
        }
        create("shift") {
            dimension = "brand"
            applicationId = "com.clbyapp.shift"
            resValue("string", "app_name", "Shift")
            // Shift versions independently of clby — bump these on each
            // shift release; clby's pubspec version is unaffected.
            versionCode = 1
            versionName = "1.0.0"
            signingConfig = signingConfigs.getByName("releaseShift")
        }
    }
    buildTypes {
        // Per-flavor signingConfig (above) is used for release builds of each
        // flavor. Debug builds fall back to AGP's auto-generated debug keystore.
        debug {
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}
flutter {
    source = "../.."
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}