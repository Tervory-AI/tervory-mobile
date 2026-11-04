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
