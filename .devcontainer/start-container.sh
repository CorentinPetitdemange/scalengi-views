#!/usr/bin/env bash
set -euo pipefail

export SCALENGI_AUTH_BIND="${SCALENGI_AUTH_BIND:-127.0.0.1:8787}"
export SCALENGI_AUTH_DATABASE_PATH="${SCALENGI_AUTH_DATABASE_PATH:-/app/data/scalengi-auth.sqlite3}"

./scalengi-views-auth &
auth_pid=$!
node server.js &
web_pid=$!
nginx -c /app/nginx.conf -g 'daemon off;' &
proxy_pid=$!

shutdown() {
  kill "$auth_pid" "$web_pid" "$proxy_pid" 2>/dev/null || true
}
trap shutdown EXIT INT TERM

wait -n "$auth_pid" "$web_pid" "$proxy_pid"
status=$?
exit "$status"
