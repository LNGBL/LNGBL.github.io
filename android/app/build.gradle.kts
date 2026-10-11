plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}
android {
    namespace = "io.langblue.android"
    compileSdk = 35
    defaultConfig {
        applicationId = "io.langblue.android"
        minSdk = 31
        targetSdk = 35
        versionCode = 5
        versionName = "1.0.5"
    }
    signingConfigs {
        create("release") {
            storeFile = file(System.getenv("LANGBLUE_KEYSTORE_PATH") ?: "langblue-release.jks")
            storePassword = System.getenv("LANGBLUE_KEYSTORE_PASSWORD") ?: ""
            keyAlias = System.getenv("LANGBLUE_KEY_ALIAS") ?: ""
            keyPassword = System.getenv("LANGBLUE_KEY_PASSWORD") ?: ""
        }
    }
    buildTypes {
        getByName("release") {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = false
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures { compose = true }
}
dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.10.0")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
}
