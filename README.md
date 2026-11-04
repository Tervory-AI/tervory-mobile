# Tervory mobile

Capacitor iOS and Android apps loading the existing Workspace at
https://app.tervory.com. Trigger sign-in opens in the system browser and returns
through a verified app link. The apps contain no password field.

Native push notifications deliver existing product alerts. Sharing a link or file
from another app opens Tervory chats at `/chats`.

Android and unsigned iOS build artifacts are produced for `mobile-v*` tags.
Store publication and signing require founder-managed Apple Developer and Google
Play accounts. This repository does not publish apps automatically.
