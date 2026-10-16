#!/usr/bin/env bash
# Register the grokbot relay in Claude Code for the current user.
# Requires membership in the grokbot group (to read /etc/grokbot-relay/env).
# Usage: ./connect-claude.sh [--scope user|local]
set -euo pipefail

ENV_FILE=/etc/grokbot-relay/env
SCOPE=user
if [[ "${1:-}" == "--scope" && -n "${2:-}" ]]; then SCOPE="$2"; fi

command -v claude >/dev/null || { echo "Claude Code (claude) not found." >&2; exit 1; }
[[ -r "$ENV_FILE" ]] || { echo "Cannot read $ENV_FILE. Ask the admin: sudo usermod -aG grokbot $USER (then log in again)." >&2; exit 1; }

PORT="$(sed -n 's/^GROKBOT_RELAY_PORT=//p' "$ENV_FILE")"
TOKEN="$(sed -n 's/^GROKBOT_RELAY_TOKEN=//p' "$ENV_FILE")"
[[ -n "$PORT" && -n "$TOKEN" ]] || { echo "$ENV_FILE is missing values." >&2; exit 1; }

# The token is read from the env file each time the MCP server starts,
# so it is not written into Claude Code's config.
claude mcp remove grokbot --scope "$SCOPE" >/dev/null 2>&1 || true
# shellcheck disable=SC2016  # expanded later, when Claude Code starts the server
claude mcp add grokbot --scope "$SCOPE" -- bash -c \
  'set -a; . /etc/grokbot-relay/env; set +a; exec npx -y @cursor/bdk mcp --url "http://127.0.0.1:${GROKBOT_RELAY_PORT}" --bearer-token "${GROKBOT_RELAY_TOKEN}"'
unset TOKEN

echo "Registered MCP server 'grokbot' (scope: $SCOPE). Check with: claude mcp list"
