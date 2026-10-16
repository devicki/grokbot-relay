# Changelog

## 0.3.0
- Agent allowlist moved out of git: read from `GROKBOT_RELAY_AGENTS` or `/etc/grokbot-relay/agents.json` (`GROKBOT_RELAY_AGENTS_FILE` to override). The relay refuses to start if nothing valid is configured, so it never falls back to allowing any name.
- New `agents.example.json` with generic names. `install.sh` creates the server config from it if missing (640 root:grokbot) and asks you to edit it.

## 0.2.1
- Moved out of devicki/dev-toolkit into this repo. Install docs clone devicki/grokbot-relay.

## 0.2.0
- Server deployment: systemd unit (loopback, hardened), idempotent `deploy/install.sh`, `deploy/connect-claude.sh` for regular users, `relay/package-lock.json` for `npm ci`.

## 0.1.0
- First version: BDK relay scaffold (allowlist, interrupt disabled), usage skill, .mcp.json example, ko/en README.
