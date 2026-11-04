# Mobile founder settings

Only names are checked in. Store values in repository secrets, provider consoles,
or the existing Workspace deployment settings; never commit signing files.

## Paid accounts and signing (unsigned builds until these exist)

- `APPLE_DEVELOPER_ACCOUNT`: Apple Developer Program membership.
- `APPLE_TEAM_ID`: Apple signing team identifier.
- `MOBILE_APPLE_TEAM_ID`: Workspace association document appID prefix.
- `APPLE_DISTRIBUTION_CERTIFICATE_P12`, `APPLE_DISTRIBUTION_CERTIFICATE_PASSWORD`:
  future distribution identity; not read by unsigned CI.
- `APPLE_APP_PROVISIONING_PROFILE`, `APPLE_SHARE_PROVISIONING_PROFILE`:
  profiles for the app and share extension; not read by unsigned CI.
- `GOOGLE_PLAY_DEVELOPER_ACCOUNT`: Google Play Console membership.
- `ANDROID_UPLOAD_KEYSTORE`, `ANDROID_UPLOAD_KEYSTORE_PASSWORD`,
  `ANDROID_UPLOAD_KEY_ALIAS`, `ANDROID_UPLOAD_KEY_PASSWORD`: future upload key;
  not read by unsigned CI.
- `MOBILE_ANDROID_CERT_SHA256`: actual installed signing identities,
  including Play app signing when enabled; published by the Workspace owner.

No store submission or signing is automatic. The shared identifier is
`com.tervory.app`. Configure the paid accounts before a physical-device universal
link or App Store push test. See ../INTEGRATION.md for the server prerequisites.

## Push and sharing

- `MOBILE_FIREBASE_GOOGLE_SERVICES_JSON`: repository secret holding the Android
  Firebase client configuration for `com.tervory.app`; injected only into native
  builds. Without it, builds remain unsigned and live FCM token registration is unavailable.
- `MOBILE_FCM_SERVICE_ACCOUNT_JSON`: existing-server
  delivery configuration for FCM HTTP v1; never included in the app or CI artifacts.
- `MOBILE_APNS_KEY_ID`, `MOBILE_APNS_TEAM_ID`, `MOBILE_APNS_KEY`,
  `MOBILE_APNS_ENVIRONMENT`: existing-server APNs delivery credentials and
  sandbox/production selection; never included in the app.
- `MOBILE_APP_GROUP_ID`: register the fixed value `group.com.tervory.app` for
  both Apple App IDs; the checked-in entitlements already reference it.

The mobile push plugin does not add a new paid service. APNs requires the Apple
membership above; FCM uses its free messaging service. Enable bootstrap push only
after the general Tank notify channel is configured. No product-specific wiring
is required. The Workspace mobile sign-out route revokes its phone registrations.
