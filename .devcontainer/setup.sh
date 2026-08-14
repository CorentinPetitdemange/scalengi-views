#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

readonly COMPOSE_FILE=".devcontainer/compose.yaml"
readonly DEMO_IMAGE="ghcr.io/corentinpetitdemange/scalengi-view:latest"

echo "======================================"
echo "  Scalengi Views — installation"
echo "======================================"

echo "Téléchargement de l’image de démonstration..."
if ! docker compose --file "$COMPOSE_FILE" pull; then
  echo "Image distante indisponible, construction locale de secours..."
  docker build --pull --tag "$DEMO_IMAGE" --file .devcontainer/Dockerfile .
fi

echo "Démarrage du conteneur..."
docker compose --file "$COMPOSE_FILE" up --detach --no-build

echo "Vérification de l’application..."
for attempt in $(seq 1 90); do
  container_id="$(docker compose --file "$COMPOSE_FILE" ps --quiet app)"
  container_health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"

  if [[ "$container_health" == "healthy" ]]; then
    echo ""
    echo "======================================"
    echo "  Scalengi Views est prêt"
    echo "======================================"
    echo "Application disponible sur http://localhost:3000"
    exit 0
  fi

  if [[ "$container_health" == "exited" || "$container_health" == "dead" ]]; then
    echo "Le conteneur s’est arrêté pendant son démarrage." >&2
    docker compose --file "$COMPOSE_FILE" logs --tail 100 >&2
    exit 1
  fi

  if (( attempt % 10 == 0 )); then
    echo "En attente de l’application... $((attempt * 2)) secondes"
  fi
  sleep 2
done

echo "L’application n’est pas devenue disponible dans le délai prévu." >&2
docker compose --file "$COMPOSE_FILE" ps >&2
docker compose --file "$COMPOSE_FILE" logs --tail 100 >&2
exit 1
