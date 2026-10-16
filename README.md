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
git clone https://github.com/devicki/grokbot-relay && cd grokbot-relay
sudo ./deploy/install.sh            # optional: --port 3000
sudo nano /etc/grokbot-relay/agents.json   # list your bot names (created from agents.example.json)
sudo -u grokbot -H bash -c 'cd /opt/grokbot-relay/relay && npx bdk login'
sudo systemctl start grokbot-relay
sudo systemctl status grokbot-relay --no-pager
sudo usermod -aG grokbot <user1>
sudo usermod -aG grokbot <user2>
```

Each regular user (log out and back in after `usermod`):

```bash
git clone https://github.com/devicki/grokbot-relay && cd grokbot-relay
./deploy/connect-claude.sh          # registers MCP server "grokbot" (user scope)
claude mcp list
claude plugin marketplace add devicki/dev-toolkit
claude plugin install grokbot-relay@dev-toolkit
```

Notes:
- `connect-claude.sh` stores a `bash -c` command that reads `/etc/grokbot-relay/env` at start, so the token is **not** written into Claude Code's config (`~/.claude.json`). If you use `claude mcp add` with the token inline instead, it is stored there in plain text.
- The token is still passed as a process argument (`--bearer-token`), so other local users may see it in `ps`. On a shared server, mount `/proc` with `hidepid=2` or accept that group members and admins can see it.
- Everyone in the `grokbot` group shares one token, so they share one BDK caller identity (contact list and read positions) and the same Grok Bot account.
- Rotate the token: edit the env file, `sudo systemctl restart grokbot-relay`, users re-run nothing (it is read at each start).

**VERIFY ON THE SERVER**
- `bdk serve` flags in the unit: `--host 127.0.0.1 --port`, `--mode single` (MCP at `/v1/mcp`), `--bearer-token` (from the 0.2.25 CLI reference, not run yet).
- Whether the `bdk login` credential (stored in the CLI config dir under `/var/lib/grokbot`) survives reboot and works under the hardened unit.
- That `bdk login` works on a headless server (it prints a sign-in link to open in any browser).

## Safety

- Keep `serve` on loopback. Put an authenticating proxy in front before exposing it anywhere.
- `check` reads the bot conversation. Anyone who can reach the relay can read replies.
- All callers share one Grok Bot account and bot memory.
- **Feedhand is request-only.** Posts go live only after you approve in the Feedhand chat. The relay never approves.
- `bdk mcp` does not work with `--prod` hosted deployments. Run it locally.
