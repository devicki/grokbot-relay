#!/usr/bin/env bash
# Install the grokbot-relay service. Run as root. Safe to re-run.
# Usage: sudo ./install.sh [--port N]
set -euo pipefail

PORT=3000
if [[ "${1:-}" == "--port" && -n "${2:-}" ]]; then PORT="$2"; fi

APP_DIR=/opt/grokbot-relay
HOME_DIR=/var/lib/grokbot
ENV_DIR=/etc/grokbot-relay
ENV_FILE="$ENV_DIR/env"
UNIT=/etc/systemd/system/grokbot-relay.service
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # repo root

[[ $EUID -eq 0 ]] || { echo "Run as root (sudo)." >&2; exit 1; }

# 1. Node 22+
command -v node >/dev/null || { echo "Node.js 22+ is required (not found)." >&2; exit 1; }
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
(( NODE_MAJOR >= 22 )) || { echo "Node.js 22+ is required (found $(node -v))." >&2; exit 1; }

# 2. System user/group
getent group grokbot >/dev/null || groupadd --system grokbot
if ! id grokbot >/dev/null 2>&1; then
  useradd --system --gid grokbot --home-dir "$HOME_DIR" --create-home --shell /usr/sbin/nologin grokbot
fi
install -d -o grokbot -g grokbot -m 750 "$HOME_DIR" "$HOME_DIR/state"

# 3. App files + dependencies
install -d -o grokbot -g grokbot -m 750 "$APP_DIR"
if command -v rsync >/dev/null; then
  rsync -a --delete --exclude node_modules --exclude .agent-serve --exclude memory "$SRC_DIR/relay/" "$APP_DIR/relay/"
else
  rm -rf "$APP_DIR/relay.new" && cp -a "$SRC_DIR/relay" "$APP_DIR/relay.new"
  [[ -d "$APP_DIR/relay/node_modules" ]] && mv "$APP_DIR/relay/node_modules" "$APP_DIR/relay.new/" || true
  rm -rf "$APP_DIR/relay" && mv "$APP_DIR/relay.new" "$APP_DIR/relay"
fi
chown -R grokbot:grokbot "$APP_DIR"
if [[ -f "$APP_DIR/relay/package-lock.json" ]]; then
  sudo -u grokbot -H bash -c "cd '$APP_DIR/relay' && npm ci --no-audit --no-fund"
else
  sudo -u grokbot -H bash -c "cd '$APP_DIR/relay' && npm install --no-audit --no-fund"
fi

# 4. Env file (token generated once, never printed)
install -d -o root -g grokbot -m 750 "$ENV_DIR"
if [[ ! -f "$ENV_FILE" ]]; then
  umask 077
  TOKEN="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
  printf 'GROKBOT_RELAY_PORT=%s\nGROKBOT_RELAY_TOKEN=%s\n' "$PORT" "$TOKEN" > "$ENV_FILE"
  unset TOKEN
  echo "Created $ENV_FILE (token not shown)."
else
  echo "$ENV_FILE exists; kept as is."
fi
chown root:grokbot "$ENV_FILE"
chmod 640 "$ENV_FILE"

# 4b. Agent allowlist (server-local, never in git)
AGENTS_FILE="$ENV_DIR/agents.json"
if [[ ! -f "$AGENTS_FILE" ]]; then
  install -o root -g grokbot -m 640 "$SRC_DIR/agents.example.json" "$AGENTS_FILE"
  echo "Created $AGENTS_FILE from agents.example.json. EDIT IT before starting."
else
  echo "$AGENTS_FILE exists; kept as is."
fi
chown root:grokbot "$AGENTS_FILE"
chmod 640 "$AGENTS_FILE"

# 5. systemd unit (enabled, not started)
install -o root -g root -m 644 "$SRC_DIR/deploy/grokbot-relay.service" "$UNIT"
systemctl daemon-reload
systemctl enable grokbot-relay.service >/dev/null

cat <<NEXT

Installed. Not started yet. Next steps:
  0) Edit the allowlist: list your bot names exactly as shown in the Grok Bot app.
       sudo nano $ENV_DIR/agents.json
     (The relay refuses to start if the list is empty.)
  1) Sign in to Cursor as the service user (opens a browser link to copy):
       sudo -u grokbot -H bash -c 'cd $APP_DIR/relay && npx bdk login'
  2) Start and check:
       sudo systemctl start grokbot-relay
       sudo systemctl status grokbot-relay --no-pager
       sudo journalctl -u grokbot-relay -n 50 --no-pager
  3) Allow regular users to connect (they must log out and back in):
       sudo usermod -aG grokbot <user1>
       sudo usermod -aG grokbot <user2>
NEXT
