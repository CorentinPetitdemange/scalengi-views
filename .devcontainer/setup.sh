#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "======================================"
echo "  Scalengi Views — installation"
echo "======================================"

echo "Installation des dépendances..."
pnpm install --frozen-lockfile

echo "Vérification de la configuration desktop..."
pnpm version:check

echo ""
echo "======================================"
echo "  Environnement prêt"
echo "======================================"
