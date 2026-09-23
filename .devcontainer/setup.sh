#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "======================================"
echo "  Scalengi Views — installation"
echo "======================================"

echo "Installation des dépendances..."
# Lifecycle commands run without a TTY. CI mode lets pnpm replace a persisted
# node_modules directory during a Codespaces rebuild instead of aborting while
# waiting for an interactive confirmation.
CI=true pnpm install --frozen-lockfile

echo "Vérification de la configuration desktop..."
pnpm version:check

echo ""
echo "======================================"
echo "  Environnement prêt"
echo "======================================"
