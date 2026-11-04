# Mobile founder settings

Only names are checked in. Store values in repository secrets, provider consoles,
or the existing Workspace deployment settings; never commit signing files.

## Paid accounts and signing (unsigned builds until these exist)

- `APPLE_DEVELOPER_ACCOUNT`: Apple Developer Program membership.
- `APPLE_TEAM_ID`: Apple team identifier; association document appID prefix.
- `APPLE_DISTRIBUTION_CERTIFICATE_P12`, `APPLE_DISTRIBUTION_CERTIFICATE_PASSWORD`:
  future distribution identity; not read by unsigned CI.
- `APPLE_APP_PROVISIONING_PROFILE`, `APPLE_SHARE_PROVISIONING_PROFILE`:
  profiles for the app and share extension; not read by unsigned CI.
- `GOOGLE_PLAY_DEVELOPER_ACCOUNT`: Google Play Console membership.
- `ANDROID_UPLOAD_KEYSTORE`, `ANDROID_UPLOAD_KEYSTORE_PASSWORD`,
  `ANDROID_UPLOAD_KEY_ALIAS`, `ANDROID_UPLOAD_KEY_PASSWORD`: future upload key;
  not read by unsigned CI.
- `ANDROID_APP_LINK_SHA256_FINGERPRINTS`: actual installed signing identities,
  including Play app signing when enabled; published by the Workspace owner.

No store submission or signing is automatic. The shared identifier is
`com.tervory.app`. Configure the paid accounts before a physical-device universal
link or App Store push test. See ../INTEGRATION.md for the server prerequisites.
