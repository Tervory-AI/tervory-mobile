# Workspace integration contract

The mobile shell loads only https://app.tervory.com. It does not rebuild any
Workspace UI, authenticate directly to an identity provider, or hold a provider
secret. All on-screen sign-in wording is **Trigger sign-in**.

## Sign-in (Workspace owner)

The companion `tervory-tank` branch `codex/mobile-apps` implements these endpoints.
They still require review and deployment before production sign-in acceptance.

1. Public GET `/mobile/sign-in` receives `state`, `code_challenge`,
   `code_challenge_method=S256`, and the exact `redirect_uri`
   `https://app.tervory.com/mobile/callback`. Reject all other redirect URIs.
   Authenticate through Trigger in the system browser, without provider names
   in Tervory's UI. Bind the resulting user and tenant to this challenge.
2. Redirect to that app link with an opaque single-use `code` (16–512 base64url
   characters) and the original `state`. Expire codes within five minutes.
   Never put session tokens or provider credentials in the link.
3. Public GET `/mobile/bridge` serves a minimal same-origin document without
   redirecting to sign-in. Native code injects the bundled bridge here.
4. Public POST `/api/mobile/session` receives JSON `code`, `code_verifier`,
   `redirect_uri`. Check Origin, the exact URI, expiry, one-time consumption,
   and SHA-256 PKCE proof. Set the existing Workspace HttpOnly, Secure,
   SameSite session cookie, scoped to the authenticated user and tenant.
   Return 200; use Cache-Control: no-store. Do not accept a tenant from the app.
5. Native code validates the exact HTTPS callback host/path, state, code shape,
   and five-minute lifetime; it forgets the state on consumption. The WebView
   exchanges the code and then opens `/chats`. Browser cookies are never copied.
   If the OS kills the process during sign-in, start again; pending proof stays
   in memory and is not backed up. This fails closed.

## Verified links (Workspace owner + founder)

Serve both documents publicly without authentication or redirects:

- `/.well-known/apple-app-site-association`: appID
  `MOBILE_APPLE_TEAM_ID.com.tervory.app`, components matching `/mobile/callback` only.
- `/.well-known/assetlinks.json`: relation `delegate_permission/common.handle_all_urls`,
  namespace `android_app`, package_name `com.tervory.app`, and the real Android
  signing certificate SHA-256 fingerprints. Never publish placeholder fingerprints.

Until the paid Apple account and signing identities exist, association is a
deployment prerequisite rather than a proven production capability. Unsigned
builds cannot prove universal links on a physical iOS device.

## Acceptance

CI uses an isolated `e2e` Android build, loopback-only fake Workspace and real system
Chrome. It exercises Trigger sign-in, one-use PKCE exchange, the HTTPS app callback,
an HttpOnly WebView session and authenticated `/chats`. It registers a fake phone
through the real push-plugin listener, calls fake notify and delivers the returned
payload through the native notification-tap intent, verifying its link opens.
This proves the requested fake-backed flow, not live Trigger or APNs/FCM delivery.
Release builds always use the fixed HTTPS production origin; only the e2e source
set contains the cleartext config. CI explicitly approves the callback association
for that test; production verification still requires real signing fingerprints.

After deploying the contract, install the debug APK in an Android emulator, verify
the host's app association with its actual debug certificate, and run
`npm run acceptance -- --serial emulator-5554`. Complete Trigger sign-in in the
emulator's system browser. The harness waits five minutes, attaches only to the
app's debug WebView, verifies `/chats`, no password input and authenticated
bootstrap HTTP 200, and saves local JSON/screenshot evidence under `.tmp/acceptance`.
It deliberately fails if the session is missing. This is an operator-assisted
acceptance harness; it is not a claim of automated browser credential entry or
of a passed production sign-in test. No test credentials are bundled.

## Push delivery (Workspace/Tank owner)

Tank exposes one general channel. No product-specific subscriptions or emitters
are added. The companion backend branch supplies the Workspace endpoints below.

- Authenticated GET `/api/mobile/bootstrap` returns `{ "push_enabled": true }`
  only once native delivery is configured for that user. Otherwise return false.
  Signed-out requests return 401 rather than redirecting to an identity page.
- Authenticated POST `/api/mobile/devices` accepts `{token, platform}` where
  platform is `ios` (APNs) or `android` (FCM). Derive user and tenant from the
  existing session; reject client tenant IDs and cross-origin requests. Upsert
  and rotate registrations without duplicating deliveries. Unlink registrations
  on sign-out, session revocation and account/tenant removal. Tokens are personal
  data; never log them. Only permit one active user/tenant binding per token.
- Any product may call `POST /v1/mobile/notify` with its existing Tank key and
  `{tenant_id, user_id?, title, body, link}`. Omit user_id to address the tenant.
  Tank's Python `notify` function provides the same channel. Each call fans out
  to every active matching phone, returns sent/dead/failed/unavailable counts,
  and removes provider-confirmed dead tokens. Callers own retry policy;
  repeating successful calls can duplicate notifications.
- APNs and FCM receive title/body notification payloads and `path` data.
  Notification taps open any same-origin Workspace link, never an external site.
  Senders choose lock-screen-safe text. Credentials remain server-side.

## Share drafts (Workspace owner)

Authenticated multipart POST `/api/mobile/shares` receives `share_id`, `text`,
and up to five binary `files` with a combined 5 MiB limit. Verify Origin and
session, derive the tenant, sanitize filenames, validate file sizes/types on the
server, store binary files as inert attachments, and create an **unsent chat draft**. Never
execute shared content, automatically fetch a URL or send a message. Deduplicate
`share_id` per user/tenant so retries return the same `{ "draft_id": "…" }`.
The existing `/chats?draft=…` UI must load only that user's tenant-scoped draft
and let the user review it before sending. Return 401 while signed out.

Android SEND/SEND_MULTIPLE opens `/chats` immediately. iOS writes a protected App
Group inbox atomically, then calls the public `UIScene.open` API with a nonce-only
`tervory://share/<id>` handoff. Cold and warm app URL handlers verify that nonce
against the private inbox before opening `/chats`. No file content or sign-in
proof travels through the custom scheme. Failure to open offers a retry button.
The unsigned archive checks compilation; signed-device testing is still needed
to verify the host share-sheet transition and App Group entitlement at runtime.
Both platforms retain the last pending share locally for at most 24 hours and
delete it after successful draft creation. Unsigned iOS builds cannot exercise
App Group sharing on a physical device. Signing must enable the App Group for
both `com.tervory.app` and `com.tervory.app.share`.
