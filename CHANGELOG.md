# Changelog

## 0.5.2
- `grokbot-relay uninstall [--purge|--keep-config] [-y]`: stops/disables and removes the service, `/opt/grokbot-relay`, the CLI link and the recorded source path; asks before config, Cursor login/state and the grokbot user. Never touches the source clone. TUI entry with a danger confirmation (type YES).

## 0.5.1
- `relay/package.json` declares `allowScripts` (npm 11.16+): esbuild and protobufjs allowed, @cursor/bdk (optional skill installer) denied. Older npm ignores the field. Fixes "install scripts not yet covered by allowScripts" during `npm ci`/`rebuild`.
- Quieter rebuild after `npm ci`; clearer `doctor` message when esbuild does not work.

## 0.5.0
- TUI: `grokbot-relay` with no arguments (or `tui`) on a terminal opens a menu; whiptail > dialog > plain prompts. Setup wizard (`install --tui`, or offered on first run): Node check, port, install, bot names, login, start, doctor, group users. Menus are one-line registries in `bin/lib/tui.sh`.
- After `npm ci` / bdk upgrade, run `npm rebuild esbuild protobufjs` (newer npm can skip their install scripts). `doctor` checks that esbuild works.
- npm update/fund notices hidden.

## 0.4.0
- New `grokbot-relay` CLI (`bin/grokbot-relay`, bash, no extra deps): install, login, start/stop/restart/status/logs, enable/disable, update, bdk-check, bdk-upgrade [--pin], agents list/add/remove/edit, doctor, connect-claude, version, help.
- `install` links `/usr/local/bin/grokbot-relay` and records the source clone in `/etc/grokbot-relay/source` for `update`.
- `deploy/install.sh` and `deploy/connect-claude.sh` are now thin wrappers.
- `VERSION` file.

## 0.3.0
- Agent allowlist moved out of git: read from `GROKBOT_RELAY_AGENTS` or `/etc/grokbot-relay/agents.json` (`GROKBOT_RELAY_AGENTS_FILE` to override). The relay refuses to start if nothing valid is configured, so it never falls back to allowing any name.
- New `agents.example.json` with generic names. `install.sh` creates the server config from it if missing (640 root:grokbot) and asks you to edit it.

## 0.2.1
- Moved out of devicki/dev-toolkit into this repo. Install docs clone devicki/grokbot-relay.

## 0.2.0
- Server deployment: systemd unit (loopback, hardened), idempotent `deploy/install.sh`, `deploy/connect-claude.sh` for regular users, `relay/package-lock.json` for `npm ci`.

## 0.1.0
- First version: BDK relay scaffold (allowlist, interrupt disabled), usage skill, .mcp.json example, ko/en README.
