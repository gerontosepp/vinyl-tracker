#!/usr/bin/env bash
# Verifies that the Rust toolchain pinned in rust-toolchain.toml matches the CI workflows and
# the MSRV declarations in the Cargo manifests. Run it after bumping the toolchain.
set -euo pipefail

cd "$(dirname "$0")/.."

pinned="$(sed -n 's/^channel = "\([^"]*\)".*/\1/p' rust-toolchain.toml | head -n 1)"
if [[ -z "$pinned" ]]; then
  echo "::error::rust-toolchain.toml does not declare a channel"
  exit 1
fi

failed=0

# The workflow toolchain must be the same version as the pin.
while IFS= read -r line; do
  file="${line%%:*}"
  value="${line##*: }"
  value="${value//\"/}"
  if [[ "$value" != "$pinned" ]]; then
    echo "::error::$file pins toolchain '$value', expected '$pinned'"
    failed=1
  fi
done < <(grep -rn "toolchain: " .github/workflows/*.yml)

# The MSRV in the manifests must be the pin's minor version (1.100 for 1.100.0).
msrv="${pinned%.*}"
for manifest in backend/Cargo.toml backend/crates/vinyl-api-types/Cargo.toml mcp/Cargo.toml; do
  declared="$(sed -n 's/^rust-version = "\([^"]*\)".*/\1/p' "$manifest" | head -n 1)"
  if [[ -z "$declared" ]]; then
    echo "::error::$manifest does not declare rust-version"
    failed=1
  elif [[ "$declared" != "$msrv" ]]; then
    echo "::error::$manifest declares rust-version '$declared', expected '$msrv'"
    failed=1
  fi
done

if [[ "$failed" -eq 0 ]]; then
  echo "Rust toolchain $pinned is consistent across rust-toolchain.toml, workflows and manifests"
fi
exit "$failed"
