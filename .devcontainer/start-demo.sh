#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

readonly LOG_FILE=".devcontainer/dev-server.log"
readonly PID_FILE=".devcontainer/dev-server.pid"
readonly APP_URL="http://localhost:3000"

codespaces_host=""
if [[ -n "${CODESPACE_NAME:-}" && -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]]; then
  codespaces_host="${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
fi

app_is_ready() {
  if [[ -n "$codespaces_host" ]]; then
    curl --silent --fail --max-time 2 --header "Host: $codespaces_host" "$APP_URL" > /dev/null
  else
    curl --silent --fail --max-time 2 "$APP_URL" > /dev/null
  fi
}

if app_is_ready; then
  echo "Scalengi Views fonctionne déjà sur le port 3000."
  exit 0
fi

if [[ -f "$PID_FILE" ]]; then
  existing_pid="$(cat "$PID_FILE")"
  if [[ "$existing_pid" =~ ^[0-9]+$ ]] && kill -0 "$existing_pid" 2>/dev/null; then
    echo "Le serveur Scalengi Views démarre déjà (PID $existing_pid)."
  else
    rm -f "$PID_FILE"
  fi
fi

if [[ ! -f "$PID_FILE" ]]; then
  echo "Démarrage de Scalengi Views..."
  nohup pnpm dev -- -H 0.0.0.0 > "$LOG_FILE" 2>&1 &
  echo "$!" > "$PID_FILE"
fi

for attempt in $(seq 1 60); do
  if app_is_ready; then
    echo ""
    echo "======================================"
    echo "  Scalengi Views est prêt"
    echo "======================================"
    echo "Ouvrez le port transféré 3000 dans votre navigateur."
    echo "Aucun compte n’est nécessaire ; les vues de démonstration sont créées localement."
    exit 0
  fi

  if (( attempt % 10 == 0 )); then
    echo "En attente du serveur... $((attempt * 2)) secondes"
  fi
  sleep 2
done

echo "Le serveur n’a pas répondu dans le délai prévu." >&2
echo "Dernières lignes du journal :" >&2
tail -n 80 "$LOG_FILE" >&2 || true
exit 1
