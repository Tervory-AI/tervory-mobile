# Workspace integration contract

The mobile shell loads only https://app.tervory.com. It does not rebuild any
Workspace UI, authenticate directly to an identity provider, or hold a provider
secret. All on-screen sign-in wording is **Trigger sign-in**.

## Sign-in (Workspace owner)

These are required endpoints, **not existing verified services**. The initial
tervory-tank main checkout still used the old identity integration. The Workspace
owner must implement and deploy this contract before real sign-in acceptance.

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
   Return 204; use Cache-Control: no-store. Do not accept a tenant from the app.
5. Native code validates the exact HTTPS callback host/path, state, code shape,
   and five-minute lifetime; it forgets the state on consumption. The WebView
   exchanges the code and then opens `/chats`. Browser cookies are never copied.
   If the OS kills the process during sign-in, start again; pending proof stays
   in memory and is not backed up. This fails closed.

## Verified links (Workspace owner + founder)

Serve both documents publicly without authentication or redirects:

- `/.well-known/apple-app-site-association`: appID
  `APPLE_TEAM_ID.com.tervory.app`, components matching `/mobile/callback` only.
- `/.well-known/assetlinks.json`: relation `delegate_permission/common.handle_all_urls`,
  namespace `android_app`, package_name `com.tervory.app`, and the real Android
  signing certificate SHA-256 fingerprints. Never publish placeholder fingerprints.

Until the paid Apple account and signing identities exist, association is a
deployment prerequisite rather than a proven production capability. Unsigned
builds cannot prove universal links on a physical iOS device.

## Acceptance

The release is not complete until CI builds both platforms and an Android
emulator authenticates through Trigger in its browser, follows the verified
callback, and opens the authenticated `/chats` page. A URL-routing or mock-server
test alone is not sign-in acceptance. Record the build URL and emulator evidence.

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

These endpoints also require implementation; the mobile repository cannot wire
the existing product delivery workers by itself.

- Authenticated GET `/api/mobile/bootstrap` returns `{ "push_enabled": true }`
  only once native delivery is configured for that user. Otherwise return false.
- Authenticated POST `/api/mobile/devices` accepts `{token, platform}` where
  platform is `ios` (APNs) or `android` (FCM). Derive user and tenant from the
  existing session; reject client tenant IDs and cross-origin requests. Upsert
  and rotate registrations without duplicating deliveries. Unlink registrations
  on sign-out, session revocation and account/tenant removal. Tokens are personal
  data; never log them. Only permit one active user/tenant binding per token.
- Fan out the alerts already emitted by Tiger, Radix, Autumbra, Market Lab and
  the morning report through APNs/FCM alongside existing delivery. Reuse the
  existing event IDs for deduplication, user preferences and authorization.
  Delete invalid/revoked tokens, retry transient failures with a bound, and do
  not include private alert bodies in lock-screen text by default.
- Send notification payloads, not data-only background messages. Use generic
  title/body and optional `data.path` restricted to `/chats` or its descendants.
  Native notification taps always return to chats; payloads cannot open external
  sites. APNs and FCM credentials stay on the server.

## Share drafts (Workspace owner)

Authenticated multipart POST `/api/mobile/shares` receives `share_id`, `text`,
and up to five binary `files` with a combined 10 MiB limit. Verify Origin and
session, derive the tenant, sanitize filenames, validate file sizes/types on the
server, scan/quarantine attachments, and store an **unsent chat draft**. Never
execute shared content, automatically fetch a URL or send a message. Deduplicate
`share_id` per user/tenant so retries return the same `{ "draft_id": "…" }`.
The existing `/chats?draft=…` UI must load only that user's tenant-scoped draft
and let the user review it before sending. Return 401 while signed out.

Android SEND/SEND_MULTIPLE opens `/chats` immediately. iOS uses a Share extension
and a protected App Group inbox; the next containing-app activation opens chats.
The user sees “Saved. Open Tervory to continue in chats.” Apple does not support
launching the containing app from its Share extension via NSExtensionContext.open:
https://developer.apple.com/documentation/foundation/nsextensioncontext/open(_:completionhandler:)
Immediate app launch from an iOS share sheet is therefore not claimed here.
Both platforms retain the last pending share locally for at most 24 hours and
delete it after successful draft creation. Unsigned iOS builds cannot exercise
App Group sharing on a physical device. Signing must enable the App Group for
both `com.tervory.app` and `com.tervory.app.share`.
