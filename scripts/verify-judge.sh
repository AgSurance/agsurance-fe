#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
contracts_dir="${AGSURANCE_SC_DIR:-../agsurance-sc}"
if [[ ! -f "$contracts_dir/contracts/manual-demo-factory/Cargo.toml" ]]; then
  echo "Clone https://github.com/AgSurance/agsurance-sc beside this repo, or set AGSURANCE_SC_DIR." >&2
  exit 1
fi
contracts_dir="$(cd "$contracts_dir" && pwd)"
build_dir="${CARGO_TARGET_DIR:-$contracts_dir/target}"
mkdir -p "$build_dir"
build_dir="$(cd "$build_dir" && pwd)"
wasm_dir="$build_dir/wasm32-unknown-unknown/release"

bun install --frozen-lockfile
rustup target add wasm32-unknown-unknown
(
  cd "$contracts_dir"
  cargo build --locked --release --target wasm32-unknown-unknown --target-dir "$build_dir"
  AGSURANCE_WALLET_WASM="$wasm_dir/agent_wallet.wasm" \
    AGSURANCE_VAULT_WASM="$wasm_dir/coverage_vault.wasm" \
    cargo build --locked --release --target wasm32-unknown-unknown --target-dir "$build_dir" -p manual-demo-factory
)

AGSURANCE_WASM_DIR="$wasm_dir" bun scripts/test-rolling-capacity.ts
echo "AgSurance judge verification passed."
