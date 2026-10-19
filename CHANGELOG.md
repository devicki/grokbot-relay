# Changelog

## 0.7.2
- Default port 47800 (was 3000, often taken). `install` checks with `ss -ltn` and uses the next free port with a message; the wizard pre-fills the free port and re-checks your choice. A configured port is kept on update/reinstall (`--port` is then ignored with a note).
- `doctor` reports when the port is taken by another program and suggests a free one. README, `.mcp.json.example` and demo values updated.

## 0.7.1
- Fresh `install --tui` / first TUI run: download and verify gum before the first screen (with a plain spinner), so the wizard opens in the gum UI. whiptail/plain only if the download fails.

## 0.7.0
- New TUI look built on charmbracelet/gum 2.0.2: dark neon palette (violet/cyan), rounded borders, relay wordmark, status header (online/offline, port, bot count, version), spinners for long steps, wizard progress `[n/8]` with a bar, English button labels.
- `install`/`update` fetch the official gum release (x64/arm64), verify `checksums.txt`, and keep it in `/opt/grokbot-relay/bin/gum` (not on the global PATH). If that fails, whiptail/plain menus are used.
- `--plain` flag and `NO_COLOR` fallback. Menu registry, non-interactive subcommands and the uninstall `YES` confirmation are unchanged.

## 0.6.0
- Private Node runtime: `install` downloads the official Node 24 linux tarball (x64/arm64) from nodejs.org, verifies SHASUMS256, extracts to `/opt/grokbot-relay/node`. Never on the global PATH; the CLI and the systemd unit (`Environment=PATH=...`) use it. No Node needed beforehand (curl, tar, sha256sum only).
- `install --node system` to use an existing system node 22+. Runtime recorded in `/etc/grokbot-relay/runtime`.
- `node-upgrade` (CLI and TUI): refresh to the latest 24.x, roll back if `bdk validate` fails. `update` keeps the runtime.
- `connect-claude` runs the relay's Node + installed bdk (`/opt/grokbot-relay/relay/node_modules/.bin/bdk`) instead of `npx`, so users need no Node or nvm for the relay. Relay files are group-readable for `grokbot`.
- `doctor` shows the runtime path and version; `uninstall` lists the runtime (removed with `/opt`).

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
