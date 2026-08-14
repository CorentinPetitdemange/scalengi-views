#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "======================================"
echo "  Scalengi Views — installation"
echo "======================================"

echo "Node $(node --version)"
echo "pnpm $(pnpm --version)"
pnpm install --frozen-lockfile
pnpm build

echo ""
echo "Installation et build terminées. L’application démarrera automatiquement sur le port 3000."
