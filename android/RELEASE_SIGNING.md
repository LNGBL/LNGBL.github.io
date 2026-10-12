# LangBlue Android — Debug build

The project is currently configured for **debug/testing builds only**. No Android release keystore and no GitHub signing secrets are needed for this workflow.

## Build a debug APK

1. Open [GitHub Actions](https://github.com/LNGBL/LNGBL.github.io/actions/workflows/android-apk.yml).
2. Choose **Build LangBlue Android Debug APK**.
3. Select **Run workflow** (or wait for a build triggered by an Android code change on `main`).
4. Open the completed workflow run and download the artifact named `LangBlue-Android-1.0.5-debug`.

The APK is signed with the standard Gradle debug key, is intended for testing, and is not a production release. GitHub Actions keeps the artifact for 14 days.

## Important

- Do not add release keystore secrets while the project remains in debug mode.
- Debug APKs are not suitable for public production distribution.
- If a previously installed app was signed with a different key, Android may refuse to install this debug build as an update. For testing, uninstalling the old app may be necessary; this removes its local app data.
- This guide replaces the previous release-signing instructions while LangBlue remains in debug mode.
