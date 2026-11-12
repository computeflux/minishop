#!/usr/bin/env bash
set -euo pipefail

# ── 路径 ──────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

SOL_ABI_DIR="$ROOT_DIR/src/contracts/evm"
EVM_OUT_DIR="$ROOT_DIR/src/contracts/evm/typechain"

INK_ABI_DIR="$ROOT_DIR/public/contract"
INK_OUT_DIR="$ROOT_DIR/src/contracts/tee/types"

# ── Solidity: typechain ───────────────────────────────────────
echo "[1/2] Generating Solidity typechain types..."
mkdir -p "$EVM_OUT_DIR"

# 删除旧类型，避免残留
rm -rf "$EVM_OUT_DIR"/*

npx typechain \
  --target ethers-v6 \
  --out-dir "$EVM_OUT_DIR" \
  "$SOL_ABI_DIR"/*.abi.json

echo "  → Solidity types written to $EVM_OUT_DIR"

# ── ink!: ink-abi-ts-gen ──────────────────────────────────────
echo "[2/2] Generating ink! ABI TypeScript types..."
mkdir -p "$INK_OUT_DIR"

# 检查 ink-abi-ts-gen 是否可用
if ! command -v ink-abi-ts-gen &>/dev/null; then
  echo "  ⚠ ink-abi-ts-gen not found in PATH."
  echo "  Please install it first, e.g.:"
  echo "    cargo install ink-abi-ts-gen"
  echo "  or ensure it is in your PATH."
  exit 1
fi

for abi_file in "$INK_ABI_DIR"/*.json; do
  # 跳过 Solidity ABI（以 .sol.abi.json 结尾）
  if [[ "$(basename "$abi_file")" == *.sol.abi.json ]]; then
    continue
  fi

  name="$(basename "$abi_file" .json)"
  echo "  → $name"
  ink-abi-ts-gen "$abi_file" "$INK_OUT_DIR/$name.ts"
done

echo "  → ink! types written to $INK_OUT_DIR"
echo "Done."
