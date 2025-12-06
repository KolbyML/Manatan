#!/usr/bin/env bash
set -euo pipefail

echo "Starting Mangatan in development mode..."

# Always run from the repo root (where this script lives)
cd "$(dirname "${BASH_SOURCE[0]}")"

OCR_BIN_DIR="Suwayomi-Server/server/src/main/resources/ocr-binaries"

echo "Copying OCR binaries..."
mkdir -p "$OCR_BIN_DIR"
cp ocr-server/dist/* "$OCR_BIN_DIR"/

SERVER_PID=""
WEBUI_PID=""

cleanup() {
  echo
  echo "Stopping dev services..."
  # Remove the trap so we don't recurse on ourselves
  trap - INT TERM
  # Kill *all* processes in this process group (script + children: gradle, java, yarn, etc.)
  kill 0 || true
}


trap cleanup INT TERM

echo "Cleaning Suwayomi-Server..."
(
  cd Suwayomi-Server
  ./gradlew clean
)

echo "Starting Suwayomi-Server..."
(
  cd Suwayomi-Server
  ./gradlew :server:run --stacktrace -PwebUIEnabled=false
) &
SERVER_PID=$!

echo "Waiting for server on http://localhost:3033..."
until curl -sSf http://localhost:3033 >/dev/null 2>&1; do
  sleep 1
done
echo "Server is up on http://localhost:3033"

# Optional: use Node 22.12.0 via nvm if available
if [[ -d "${NVM_DIR:-$HOME/.nvm}" ]]; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck disable=SC1090
    . "$NVM_DIR/nvm.sh"
    nvm use 22.12.0 || true
  fi
fi

echo "Starting Suwayomi-WebUI..."
(
  cd Suwayomi-WebUI
  yarn dev
) &
WEBUI_PID=$!

sleep 5
echo "Opening http://localhost:3000 in browser..."
open http://localhost:3000 2>/dev/null || true

echo "Dev environment running. Press Ctrl+C to stop."
# Wait for both processes; if either exits, script will end and trap will run if interrupted
wait "$SERVER_PID" "$WEBUI_PID"
