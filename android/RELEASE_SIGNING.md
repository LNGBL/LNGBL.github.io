# LangBlue Android signed release setup

The release workflow intentionally does not publish a debug APK. Before running it, configure a persistent Android signing key in GitHub Actions secrets.

## 1. Generate the signing key locally

Run this on a trusted computer and keep the keystore in a safe backup. Never commit the keystore or publish it.

```bash
keytool -genkeypair -v -keystore langblue-release.jks -alias langblue-release -keyalg RSA -keysize 2048 -validity 10000
```

Use a strong keystore password and remember the key password and alias. Losing the key can prevent future APK updates from installing over the existing signed app.

## 2. Add GitHub repository secrets

Open the repository settings:
Settings → Secrets and variables → Actions → New repository secret.

Add these four secrets:

- `LANGBLUE_KEYSTORE_BASE64`: the Base64 text of `langblue-release.jks`. On macOS/Linux, print it with `base64 < langblue-release.jks | tr -d '\\n'` and paste the output into GitHub; do not commit it.
- `LANGBLUE_KEYSTORE_PASSWORD`: the keystore password.
- `LANGBLUE_KEY_ALIAS`: `langblue-release` (or the alias chosen during key generation).
- `LANGBLUE_KEY_PASSWORD`: the key password.

## 3. Publish

Open Actions → Build Signed LangBlue Android Release → Run workflow. The workflow builds `assembleRelease`, verifies the APK signature, and publishes `LangBlue-Android-1.0.5.apk` to release tag `android-v1.0.5`.

The public download page intentionally no longer links to the old debug APK. Once the signed release exists, update its link to the release asset.

## Security notes

- Keep the keystore and all passwords private and backed up.
- Do not rotate the signing key casually; app updates must use the same signing identity.
- The release workflow is manual-only until signing secrets are configured, so a push cannot accidentally publish a debug build.
