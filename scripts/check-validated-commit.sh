#!/usr/bin/env bash
set -euo pipefail

if [ "$(git rev-parse HEAD)" != "$VALIDATED_COMMIT" ]; then
  echo "::error::Checkout does not match the validated commit."
  exit 1
fi

CURRENT_MAIN=$(git ls-remote origin refs/heads/main | cut -f1)
if [ "$CURRENT_MAIN" != "$VALIDATED_COMMIT" ] || [ "$WORKFLOW_COMMIT" != "$VALIDATED_COMMIT" ]; then
  echo "This run no longer targets the current validated main commit; skipping."
  if [ "${1:-}" = "--require-current" ]; then
    echo "::error::Refusing a mutation from a superseded main commit."
    exit 1
  fi
  echo "relevant=false" >> "$GITHUB_OUTPUT"
  exit 0
fi

if [ "${1:-}" != "--require-current" ]; then
  echo "relevant=true" >> "$GITHUB_OUTPUT"
fi
