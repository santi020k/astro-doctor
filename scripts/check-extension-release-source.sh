#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

VERSION=$(node -p "require('./packages/vscode-astro-doctor/package.json').version")
TAG="@santi020k/astro-doctor@${VERSION}"
TAG_SHA=$(git ls-remote --refs --tags origin "refs/tags/${TAG}" | cut -f1)

if [ -z "${VALIDATED_COMMIT:-}" ] || [ "$TAG_SHA" != "$VALIDATED_COMMIT" ]; then
  echo "Editor publishing requires the validated source to match ${TAG}. No editor artifact will be published." >&2
  exit 1
fi

bash scripts/check-validated-commit.sh --require-current
