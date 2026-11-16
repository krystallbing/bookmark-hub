#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

BOOKMARKHUB_PORT=4399
BOOKMARKHUB_URL="http://localhost:${BOOKMARKHUB_PORT}"

echo "======================================================"
echo "          BookmarkHub macOS/Linux Launcher"
echo "======================================================"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js is not installed."
  echo "Please install Node.js (v18 or higher LTS) from https://nodejs.org/"
  exit 1
fi

is_running() {
  node -e "fetch('${BOOKMARKHUB_URL}').then((response) => process.exit(response.status < 500 ? 0 : 1)).catch(() => process.exit(1))" >/dev/null 2>&1
}

open_browser() {
  if command -v open >/dev/null 2>&1; then
    open "$BOOKMARKHUB_URL"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$BOOKMARKHUB_URL" >/dev/null 2>&1 || true
  else
    echo "[INFO] Open ${BOOKMARKHUB_URL} in your browser."
  fi
}

if is_running; then
  echo "[INFO] BookmarkHub is already running. Opening ${BOOKMARKHUB_URL}"
  open_browser
  exit 0
fi

if [ ! -x "node_modules/.bin/tsc" ]; then
  echo "[INFO] Dependencies are missing. Running npm install..."
  npm install
fi

if [ ! -f "apps/cli/dist/index.js" ]; then
  echo "[INFO] Compiling core packages..."
  npm run build:packages
fi

echo
echo "[INFO] Starting the web service at ${BOOKMARKHUB_URL}"
echo "[INFO] Keep this terminal open. Press Ctrl+C to stop BookmarkHub."
echo

(
  until is_running; do
    sleep 1
  done
  open_browser
) &

npm run dev
