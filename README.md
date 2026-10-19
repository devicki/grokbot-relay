# grokbot-relay

Ask your own Grok Bot agents from Claude Code, Cursor, or a terminal through a **local** Cursor BDK relay (`cursor-grokbot-agents` extension). [한국어](README.ko.md)

> Status 0.1.0: scaffold checked against `@cursor/bdk` 0.2.25 docs. Items marked **VERIFY LOCALLY** are not tested yet.

> The usage skill (Claude Code plugin) lives in [devicki/dev-toolkit](https://github.com/devicki/dev-toolkit/tree/main/plugins/grokbot-relay). This repo is the relay server.

## How it works

```
Claude Code / Cursor ──stdio──> bdk mcp ──HTTP (127.0.0.1)──> bdk serve (relay/) ──> your Grok Bot agents
```

- Allowlist: server-local, never in git. `GROKBOT_RELAY_AGENTS` (comma-separated names) or `/etc/grokbot-relay/agents.json` (format: [`agents.example.json`](agents.example.json); other path via `GROKBOT_RELAY_AGENTS_FILE`). If nothing valid is configured, the relay refuses to start: an empty list would otherwise allow any name. Copy names exactly as shown in the Grok Bot app; a typo can create a new empty bot. `grokbot__interrupt` is removed by `tools/interrupt.ts`.
- Auth uses your own Cursor login on this machine. Nothing is stored in this repo.

## Install (local)

Requires Node.js 22+.

```bash
cd relay
npm install
npx bdk login                     # your Cursor account, in the browser
export GROKBOT_RELAY_AGENTS="Feedhand,Research Bot"   # your bot names, exactly as in the app
npx bdk validate
npx bdk dev                       # optional: try "who can you talk to?" in the playground

export GROKBOT_RELAY_TOKEN="$(openssl rand -hex 32)"   # keep it out of git
npx bdk serve --dir . --bearer-token "$GROKBOT_RELAY_TOKEN"
```

**VERIFY LOCALLY**
- the port and base URL `bdk serve` prints, and whether the MCP path is `/v1/mcp` or `/<slug>/v1/mcp`;
- that `serve` accepts `--bearer-token` (the CLI help lists it for serve) and listens on 127.0.0.1 only.

### Cursor

```bash
npx bdk mcp install --url http://127.0.0.1:<PORT> --bearer-token "$GROKBOT_RELAY_TOKEN" --name grokbot --print   # preview
npx bdk mcp install --url http://127.0.0.1:<PORT> --bearer-token "$GROKBOT_RELAY_TOKEN" --name grokbot
```

This writes the token into `~/.cursor/mcp.json`. Treat that file as a credential.

### Claude Code

```bash
export GROKBOT_RELAY_PORT=<PORT>
claude mcp add grokbot -- npx -y @cursor/bdk mcp --url "http://127.0.0.1:$GROKBOT_RELAY_PORT" --bearer-token "$GROKBOT_RELAY_TOKEN"
```

Or copy `.mcp.json.example` to your project's `.mcp.json`; it reads `GROKBOT_RELAY_PORT` and `GROKBOT_RELAY_TOKEN` from the environment. Then install this plugin for the `grokbot-relay` skill:

```bash
claude plugin marketplace add devicki/dev-toolkit
claude plugin install grokbot-relay@dev-toolkit
```

## Server deployment (Linux, systemd)

One server, one service account `grokbot`, several users. An admin (root) installs; regular users in the `grokbot` group connect.

| Path | What |
| --- | --- |
| `/opt/grokbot-relay/relay` | relay app (owner `grokbot`) |
| `/var/lib/grokbot` | `grokbot` home: Cursor login + serve state |
| `/etc/grokbot-relay/agents.json` | allowlist of bot names (640 root:grokbot, not in git) |
| `/etc/grokbot-relay/env` | `GROKBOT_RELAY_PORT`, `GROKBOT_RELAY_TOKEN` (640 root:grokbot) |

Admin (root):

```bash
node -v                                   # v22+
git clone https://github.com/devicki/grokbot-relay && cd grokbot-relay
sudo ./bin/grokbot-relay install          # or: sudo ./deploy/install.sh ; optional --port 3000
sudo grokbot-relay agents add "Feedhand"  # your bot names, exactly as in the app (or: agents edit)
sudo grokbot-relay agents remove "Research Bot"   # drop the example name
sudo grokbot-relay login                  # Cursor sign-in as the grokbot user
sudo grokbot-relay start
sudo grokbot-relay doctor
sudo usermod -aG grokbot <user1>
sudo usermod -aG grokbot <user2>
```

Update later:

```bash
sudo grokbot-relay update                 # git pull the recorded clone, recopy, npm ci, restart; shows old -> new version
sudo grokbot-relay bdk-check              # is a newer @cursor/bdk out?
sudo grokbot-relay bdk-upgrade            # upgrade, validate, restart or roll back
```

Each regular user (log out and back in after `usermod`):

```bash
id                                        # grokbot group listed?
grokbot-relay connect-claude              # registers MCP server "grokbot" (user scope)
claude mcp list
claude plugin marketplace add devicki/dev-toolkit
claude plugin install grokbot-relay@dev-toolkit
```

## CLI

`install` links `/usr/local/bin/grokbot-relay` to the copy in `/opt/grokbot-relay/bin`. The source clone path is recorded in `/etc/grokbot-relay/source` for `update`. The token is never printed.

| Command | Root | What |
|---|---|---|
| `install [--port N]` | yes | user, `/opt` app, `npm ci`, env (token made once), `agents.json` (from example if missing), systemd unit enabled but not started |
| `login` | yes | `bdk login` as the grokbot user |
| `start`, `stop`, `restart` | yes | control the service |
| `status`, `logs [-f]` | no | `systemctl status`, `journalctl` |
| `enable`, `disable` | yes | start at boot or not |
| `update` | yes | `git pull --ff-only` in the source clone, recopy, `npm ci`, restart; env and `agents.json` kept |
| `bdk-check` | no | installed vs npm latest `@cursor/bdk`, with links |
| `bdk-upgrade [--pin]` | yes | `npm install @cursor/bdk@latest` in `/opt`, `bdk validate`, restart only if it passes, else roll back. `--pin` writes `relay/package*.json` into the source clone so you can open a PR |
| `agents list` | group | allowed names |
| `agents add NAME`, `agents remove NAME`, `agents edit` | yes | change `agents.json` and restart; an empty list is refused |
| `doctor` | best as root | node, files and permissions, service, port on 127.0.0.1, login (`bdk whoami`), bdk version |
| `connect-claude [--scope user\|local]` | no (grokbot group) | register the relay in Claude Code |
| `version`, `help` | no | |

Notes:
- `connect-claude` stores a `bash -c` command that reads `/etc/grokbot-relay/env` at start, so the token is **not** written into Claude Code's config (`~/.claude.json`). If you use `claude mcp add` with the token inline instead, it is stored there in plain text.
- The token is still passed as a process argument (`--bearer-token`), so other local users may see it in `ps`. On a shared server, mount `/proc` with `hidepid=2` or accept that group members and admins can see it.
- Everyone in the `grokbot` group shares one token, so they share one BDK caller identity (contact list and read positions) and the same Grok Bot account.
- Rotate the token: edit the env file, `sudo grokbot-relay restart`, users re-run nothing (it is read at each start).

**VERIFY ON THE SERVER**
- `bdk serve` flags in the unit: `--host 127.0.0.1 --port`, `--mode single` (MCP at `/v1/mcp`), `--bearer-token` (from the 0.2.25 CLI reference, not run yet).
- Whether `doctor`'s login check (`bdk whoami`) works, and whether the `bdk login` credential (stored in the CLI config dir under `/var/lib/grokbot`) survives reboot and works under the hardened unit.
- That `bdk login` works on a headless server (it prints a sign-in link to open in any browser).

## Safety

- Keep `serve` on loopback. Put an authenticating proxy in front before exposing it anywhere.
- `check` reads the bot conversation. Anyone who can reach the relay can read replies.
- All callers share one Grok Bot account and bot memory.
- **Feedhand is request-only.** Posts go live only after you approve in the Feedhand chat. The relay never approves.
- `bdk mcp` does not work with `--prod` hosted deployments. Run it locally.
