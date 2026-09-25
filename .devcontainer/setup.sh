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
cargo build --locked --manifest-path server/Cargo.toml

echo "Vérification de la configuration desktop..."
pnpm version:check

mkdir -p data
if [[ ! -s data/demo-admin-password ]]; then
  umask 077
  openssl rand -base64 32 > data/demo-admin-password
fi
chmod 600 data/demo-admin-password

echo ""
echo "======================================"
echo "  Environnement prêt"
echo "======================================"
echo "Compte démo : admin@scalengi.demo"
echo "Mot de passe : cat data/demo-admin-password"
