#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

readonly COMPOSE_FILE=".devcontainer/compose.yaml"

echo "Vérification du conteneur Scalengi Views..."
docker compose --file "$COMPOSE_FILE" up --detach

echo ""
echo "======================================"
echo "  Scalengi Views"
echo "======================================"
echo "Application disponible sur http://localhost:3000"
echo "Le port 3000 s’ouvre automatiquement dans le navigateur."
