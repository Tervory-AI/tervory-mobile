#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
export TMPDIR="$PWD/.tmp"
mkdir -p "$TMPDIR/security-bin"
bin="$TMPDIR/security-bin"
if [ ! -x "$bin/gitleaks" ]; then
  curl --fail --silent --show-error --location --retry 3 \
    https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz \
    --output "$bin/gitleaks.tar.gz"
  echo "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb  $bin/gitleaks.tar.gz" | sha256sum --check
  tar -xzf "$bin/gitleaks.tar.gz" -C "$bin" gitleaks
fi
"$bin/gitleaks" git --redact .
"$bin/gitleaks" dir --redact --no-banner README.md
if [ -f package-lock.json ]; then
  npm run lint
  npm test
  npm audit --omit=dev --audit-level=high
fi
folder=$(basename "$PWD")
docker run --rm --label tervory.test=1 --name "${folder}-semgrep-$$" \
  --volume "$PWD:/src" --workdir /src --entrypoint semgrep \
  semgrep/semgrep:1.182.1@sha256:c8f333ab0ad103d2bcd3b55cbeabcfc556bfeaa7446ba18594a4320f3807ffc9 \
  scan --config p/default --error --metrics=off --disable-version-check
git diff --check
