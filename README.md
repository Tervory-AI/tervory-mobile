# Tervory mobile

Capacitor iOS and Android apps loading the existing Workspace at
https://app.tervory.com. Trigger sign-in opens in the system browser and returns
through a verified app link. The apps contain no password field.

Native push notifications deliver existing product alerts. Sharing a link or file
from another app opens Tervory chats at `/chats`.

Android and unsigned iOS build artifacts are produced for `mobile-v*` tags.
Store publication and signing require founder-managed Apple Developer and Google
Play accounts. This repository does not publish apps automatically.

## Development

Use Node 22 or newer, Java 21 and Android SDK 36 for Android, and macOS with
Xcode 26+ for iOS. Work at the repository root; there is no `mobile/` subfolder.

```sh
export TMPDIR="$PWD/.tmp"
mkdir -p "$TMPDIR"
npm ci
npm run sync
npm run android  # or npm run ios on macOS
```

`npm run assets` regenerates icons and splash screens from the unchanged logo in
`assets/brand/`; its original SHA-256 is enforced. Capacitor is MIT licensed.
See [third-party notices](THIRD-PARTY-NOTICES.md).

## Validation and releases

Run `bash scripts/precheck.sh` before every push. It uses Tank's checksum-pinned
Gitleaks 8.30.1 and immutable Semgrep 1.182.1 image, with no rule/file suppression
configuration. As in Tank, all Semgrep findings are reported and HIGH/ERROR or
CRITICAL findings block; lower-severity warnings remain visible for review.
Lint, Node tests and dependency audit also run. Test containers always use `--rm`,
label `tervory.test=1` and a name beginning with this checkout's folder name.

CI runs security, lint and tests, then builds Android and iOS on pull requests,
manual dispatch and `mobile-v*` tags. Android runs native link/share tests on an
API 35 emulator. Artifacts are an **unsigned `.aab`** and an **unsigned iOS
`.xcarchive.zip` including the Share extension**. They are not store-installable
releases. No publishing job exists. To release, update package.json and the iOS
app/extension marketing versions together, increment both native build numbers,
and have the release owner push the matching `mobile-v<version>` tag after review.

## Integration status

Read [the Workspace contract](docs/INTEGRATION.md) before testing sign-in, push or
chat drafts. These features need authenticated Workspace endpoints and existing
alert-worker delivery integration in the application repository. This repository
does not claim those endpoints are already deployed. Sign-in uses the system
browser; session cookies are issued by the Workspace, never copied from a browser.
Configure verified app links with real signing fingerprints and an Apple team ID.

Android sharing opens chats immediately. The iOS Share extension saves locally
and opens chats when the user next opens Tervory; iOS does not support automatic
containing-app launch from this extension point. Pending shares expire after
24 hours. Files become unsent drafts and are never automatically sent to a model.

Paid store/signing accounts and server push settings are listed by name in
[FOUNDER-SETTINGS.md](docs/ops/FOUNDER-SETTINGS.md). Unsigned builds need none of
those signing credentials. Live Trigger sign-in and authenticated `/chats` on an
emulator remain a release acceptance requirement, distinct from CI routing tests.
