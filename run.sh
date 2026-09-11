#!/usr/bin/env sh
# Finalis AI Prescreen: start the local server (macOS / Linux).
#   ./run.sh                 picks the backend for you (Claude Code login, API key, or mock)
#   PRESCREEN_MOCK=1 ./run.sh   no model at all, just the page
cd "$(dirname "$0")" || exit 1
[ -f .env ] && { set -a; . ./.env; set +a; }
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required. Install it from https://www.python.org/downloads/ and run this again."
  exit 1
fi
exec python3 server.py "$@"
