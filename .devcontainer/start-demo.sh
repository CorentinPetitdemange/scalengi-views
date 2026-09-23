#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

readonly APP_URL="http://127.0.0.1:3000/"
readonly LOG_FILE="/tmp/scalengi-views-dev.log"
readonly PID_FILE="/tmp/scalengi-views-dev.pid"

is_ready() {
  node -e "fetch('$APP_URL').then(response => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
}

if is_ready; then
  echo "Scalengi Views est déjà disponible sur http://localhost:3000"
  exit 0
fi

if [[ -f "$PID_FILE" ]]; then
  previous_pid="$(cat "$PID_FILE")"
  if kill -0 "$previous_pid" 2>/dev/null; then
    kill "$previous_pid"
  fi
  rm -f "$PID_FILE"
fi

echo "Démarrage de Scalengi Views..."
# pnpm forwards options directly to the script. Adding a standalone `--` here
# would make Vinext ignore --hostname and bind only to localhost, which leaves
# the external Codespaces port forward with a 502 response.
nohup pnpm dev --hostname 0.0.0.0 >"$LOG_FILE" 2>&1 &
server_pid=$!
echo "$server_pid" >"$PID_FILE"

for attempt in $(seq 1 60); do
  if is_ready; then
    echo ""
    echo "======================================"
    echo "  Scalengi Views"
    echo "======================================"
    echo "Application disponible sur http://localhost:3000"
    echo "Le port 3000 s’ouvre automatiquement dans le navigateur."
    exit 0
  fi

  if ! kill -0 "$server_pid" 2>/dev/null; then
    echo "Le serveur de développement s’est arrêté pendant son démarrage." >&2
    tail -n 100 "$LOG_FILE" >&2
    exit 1
  fi

  sleep 1
done

echo "L’application n’est pas devenue disponible dans le délai prévu." >&2
tail -n 100 "$LOG_FILE" >&2
exit 1
