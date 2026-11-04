#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
mkdir -p "$TMPDIR/emulator"
node scripts/fake-workspace.mjs > "$TMPDIR/emulator/fake-workspace.log" 2>&1 &
server=$!
trap 'kill "$server" 2>/dev/null || true' EXIT
for attempt in {1..20}; do
  if curl --fail --silent http://127.0.0.1:4100/proof >/dev/null; then break; fi
  sleep 1
done
curl --fail --silent http://127.0.0.1:4100/proof >/dev/null
adb reverse tcp:4100 tcp:4100
adb shell am set-debug-app --persistent com.android.chrome
adb shell "echo 'chrome --no-first-run --disable-fre --no-default-browser-check' > /data/local/tmp/chrome-command-line"
status=0
(cd android && ./gradlew --no-daemon :app:connectedE2eAndroidTest) || status=$?
adb pull /sdcard/Android/data/com.tervory.app/files/trigger-sign-in.png "$TMPDIR/emulator/" || true
curl --fail --silent http://127.0.0.1:4100/proof > "$TMPDIR/emulator/proof.json"
exit "$status"
