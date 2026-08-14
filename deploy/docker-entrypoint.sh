#!/bin/sh
set -e

# Start Go API in background (same container)
/usr/local/bin/kafkaesque &
backend_pid=$!

cleanup() {
  kill "$backend_pid" 2>/dev/null || true
  wait "$backend_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Wait until API responds (max ~30s)
i=0
while [ "$i" -lt 30 ]; do
  if wget -q -O /dev/null http://127.0.0.1:8090/health 2>/dev/null; then
    break
  fi
  i=$((i + 1))
  sleep 1
done

# nginx serves UI + proxies /api to localhost:8090
exec nginx -g 'daemon off;'
