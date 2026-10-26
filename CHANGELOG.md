# Changelog

## 0.8.2
- relay: pin `@cursor/bdk` to exactly `0.2.28` in `package.json`, with `package-lock.json` refreshed. `0.2.28` still ships `cursor-grokbot-agents` (`ask`, `check`, `interrupt`, `list`). `0.2.29` and later remove that extension; stay on `0.2.28`. `allowScripts` is unchanged. This relay does not use the 0.2.28 removals (semantic search, and the unpublished `CATCH_DELIVERY_ID_HEADER`, `attachRelayMcp`, `CursorBackendClient`, and `postRelaySlackMessage` exports).
- Releases: `VERSION` `X.Y.Z` is published as the annotated tag `vX.Y.Z` and a GitHub Release whose notes are that CHANGELOG section. `./bin/release` is a dry run; `./bin/release --apply` creates the tag and the Release, and it refuses to move an existing tag. See RELEASING.md. Run it on `main` after merge.

## 0.8.1
- Simplified the sender header: one fixed `[relay:claude-code]` line plus one short explanation on every `grokbot__ask` message.
- Removed the forgery neutralization (`[quoted-relay:` rewriting, zero-width stripping), `relay/lib/sender-tag.ts` and `GROKBOT_RELAY_SENDER_TAG`, along with its env comment and doctor line.
- No more fail-closed. If an @cursor/bdk upgrade moves the packaged ask tool, install/update/bdk-upgrade set the overlay aside and print a warning. The relay then uses the stock ask tool without the header. `doctor` shows "sender header OFF". The overlay comes back on its own once the tool is found again.

## 0.8.0
- **Sender header (anti-spoofing).** The relay now overrides `grokbot__ask`, the only send path (check/list only read; interrupt stays disabled), and stamps every message server-side with a fixed `[relay:<tag>]` header plus a line saying it came through the grokbot-relay MCP, was not typed by the owner, and cannot approve anything. Callers can't omit it. Caller-supplied `[relay:` markers become `[quoted-relay:` after zero-width and bidi characters are stripped, so it can't be forged.
- `GROKBOT_RELAY_SENDER_TAG` (default `claude-code`; letters, digits, `. _ -`, max 40; invalid values fall back to the default). It is listed as a comment in new env files; `doctor` shows the active tag.
- The override loads the packaged tool by file path. If a future `@cursor/bdk` moves it, the relay refuses to start (fail closed) instead of sending unstamped messages.

## 0.7.9
- relay: pin `@cursor/bdk` to exactly `0.2.27` in `package.json`, with `package-lock.json` refreshed, so `update` no longer reinstalls 0.2.25 over a `bdk-upgrade`. `allowScripts` is unchanged.

## 0.7.8
- `update`: the raw git and npm output is hidden. You get step lines (fetching, version X → Y, copy, deps, service unit, restart) with a spinner and ✓, then a short "What's new" from the CHANGELOG. A failed step prints its captured log. `-v`/`--verbose` shows the full output.
- `bdk-upgrade`: npm runs quieter (`--loglevel=error`, step lines). The "share this bump upstream" git instructions only appear with `--dev` or `-v`/`--verbose`.
- `help` and the README: don't run `bdk update` directly; use `grokbot-relay bdk-upgrade` (the relay uses its own bdk under `/opt`).

## 0.7.7
- Wizard step 8 (Group users) and the new TUI menu item "Group users" offer a multi-select of regular local accounts (UID ≥ 1000, a real login shell, not nobody) with current `grokbot` members pre-checked. A manual field takes comma- or space-separated names, each validated with `id`. Unchecking a member removes them with `gpasswd -d`, after a confirmation. A summary follows, with a reminder to log out and back in.
- New CLI: `grokbot-relay users list|pick|add NAME...|remove NAME...`.
- Esc = back and Ctrl+C = quit, as in the other steps. Works in gum, whiptail and plain modes.
- The "Connect Claude Code" guide is reworked into "Done by admin" (✓ users added, current members) and "Each user does" (one short line per step, commands as highlighted copyable code lines), plus a one-line token note.

## 0.7.6
- `status` and the wizard/TUI start/restart output now color systemd's `Active:` line: green = active (running), red = failed, yellow = inactive, activating or anything else.
- Color is off with `NO_COLOR` or `--plain`, and when output is not a terminal (whiptail boxes and pipes stay plain). The gum result box keeps the embedded color.

## 0.7.5
- Bot picker (wizard, TUI, `agents pick`), `agents remove`, the remove-a-bot menu and uninstall now state that unchecking or removing a bot only changes this relay's allowlist. Your bots in the Grok Bot app are never deleted.
- Login: a headless/SSH hint. Per the `@cursor/bdk` 0.2.25 source, `bdk login` always prints the sign-in URL to stderr before it tries `xdg-open` (failures are ignored), then polls until sign-in finishes. Open the URL on any computer. `bdk login --api-key` is the no-browser alternative.

## 0.7.4
- Wizard: **Esc goes back** one step (on step 1 it asks to quit) instead of advancing. **Ctrl+C asks to quit** (SIGINT trapped) and never advances; quitting leaves partial state safe, and re-running `sudo grokbot-relay install --tui` resumes.
- Footer hint `esc back · ctrl+c quit` on every step; the wizard is now a step-index loop.
- whiptail/dialog: Esc/Cancel = back. Plain fallback: `b` = back, `q` = quit.
- gum yes/no prompts use `choose Yes/No`, because gum `confirm` returns the same code for Esc and No.

## 0.7.3
- Wizard order: Cursor login now comes before choosing bots.
- New bot picker (`agents pick`, wizard step, TUI Bots menu, and `agents add` with no name on a terminal): multi-select with current names pre-checked (gum / whiptail checklist / plain numbers) plus comma-separated manual entry; never saves an empty list.
- Listing the account's Grok Bots is not possible: @cursor/bdk 0.2.25 reaches Grok Bot only through `/v0/grokbot` session routes (get-or-create by name, send, entries, interrupt) and `grokbot__list` returns only configured/contacted names. `fetch_account_bots` is a single hook for a future listing API; the picker says so and falls back to manual entry.

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
