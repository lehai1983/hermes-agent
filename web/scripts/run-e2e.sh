#!/usr/bin/env bash
#
# run-e2e.sh — Start backend + Vite dev server, run Playwright E2E tests, clean up.
#
# Usage:
#   bash scripts/run-e2e.sh
#
# What it does:
#   1. Starts the Hermes gateway in the background
#   2. Waits for the gateway to be ready (http://localhost:18080)
#   3. Starts the Vite dev server in the background
#   4. Waits for Vite to be ready (http://localhost:5173)
#   5. Runs Playwright tests
#   6. Cleans up all background processes on exit
#

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────────
GATEWAY_BIN="/home/lx2r/.hermes/hermes-agent/venv/bin/hermes"
GATEWAY_URL="http://localhost:18080"
GATEWAY_TIMEOUT=20

VITE_URL="http://localhost:5173"
VITE_TIMEOUT=15

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(dirname "$SCRIPT_DIR")"

# ── PID tracking ───────────────────────────────────────────────────────────────
GATEWAY_PID=""
VITE_PID=""

# ── Cleanup function ───────────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo "🧹 Cleaning up background processes..."

  if [ -n "$VITE_PID" ] && kill -0 "$VITE_PID" 2>/dev/null; then
    echo "   ▸ Stopping Vite dev server (PID $VITE_PID)..."
    kill "$VITE_PID" 2>/dev/null || true
    # Wait briefly for graceful shutdown
    wait "$VITE_PID" 2>/dev/null || true
  fi

  if [ -n "$GATEWAY_PID" ] && kill -0 "$GATEWAY_PID" 2>/dev/null; then
    echo "   ▸ Stopping Hermes gateway (PID $GATEWAY_PID)..."
    kill "$GATEWAY_PID" 2>/dev/null || true
    wait "$GATEWAY_PID" 2>/dev/null || true
  fi

  echo "✅ Cleanup complete."
}

# Trap EXIT, SIGINT, SIGTERM to ensure cleanup runs
trap cleanup EXIT SIGINT SIGTERM

# ── Helper: wait for URL ───────────────────────────────────────────────────────
wait_for_url() {
  local url="$1"
  local timeout="$2"
  local name="$3"
  local elapsed=0

  echo "⏳ Waiting for $name at $url (up to ${timeout}s)..."

  while [ "$elapsed" -lt "$timeout" ]; do
    if curl -sf --max-time 2 "$url" >/dev/null 2>&1; then
      echo "✅ $name is ready!"
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
    echo "   ... still waiting (${elapsed}/${timeout}s)"
  done

  echo "❌ Timed out waiting for $name at $url"
  return 1
}

# ── Main ───────────────────────────────────────────────────────────────────────
main() {
  echo "═══════════════════════════════════════════════════════════"
  echo "  E2E Test Runner — Hermes Web"
  echo "═══════════════════════════════════════════════════════════"
  echo ""

  # Step 1: Start Hermes gateway
  echo "🚀 Step 1: Starting Hermes gateway..."
  "$GATEWAY_BIN" gateway run &
  GATEWAY_PID=$!
  echo "   ▸ Gateway started with PID $GATEWAY_PID"

  # Step 2: Wait for gateway to be ready
  echo ""
  if ! wait_for_url "$GATEWAY_URL" "$GATEWAY_TIMEOUT" "Hermes gateway"; then
    echo "ERROR: Gateway failed to start. Exiting."
    exit 1
  fi

  # Step 3: Start Vite dev server
  echo ""
  echo "🚀 Step 2: Starting Vite dev server..."
  cd "$WEB_DIR"
  npm run dev &
  VITE_PID=$!
  echo "   ▸ Vite started with PID $VITE_PID"

  # Step 4: Wait for Vite to be ready
  echo ""
  if ! wait_for_url "$VITE_URL" "$VITE_TIMEOUT" "Vite dev server"; then
    echo "ERROR: Vite dev server failed to start. Exiting."
    exit 1
  fi

  # Step 5: Run Playwright tests
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "  🧪 Running Playwright E2E tests..."
  echo "═══════════════════════════════════════════════════════════"
  echo ""

  cd "$WEB_DIR"
  npx playwright test
  PLAYWRIGHT_EXIT=$?

  echo ""
  if [ "$PLAYWRIGHT_EXIT" -eq 0 ]; then
    echo "✅ All E2E tests passed!"
  else
    echo "❌ E2E tests failed with exit code $PLAYWRIGHT_EXIT"
  fi

  # Step 6: Cleanup happens via trap
  exit "$PLAYWRIGHT_EXIT"
}

main "$@"
