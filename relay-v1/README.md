# grokbot-relay v1

HTTP client for the owner's Grok Bot agents on Agent SDK 0.3. This tree does not import `cursor-grokbot-agents`.

v0 stays in [`../relay`](../relay) on `@cursor/bdk@0.2.28`. Install docs for both lines, in four languages, are the root [README](../README.md).

| Tool | What it does |
| --- | --- |
| `grokbot__list` | Allowlist, plus contacts this caller has already asked. Not an account-wide list. |
| `grokbot__ask` | Get-or-create the named session, send one message, poll entries until the turn settles or the wait runs out. |
| `grokbot__check` | Keep reading a turn that came back `status: "running"`. Does not create a bot and does not send. |

`grokbot__interrupt` is not a tool. An empty allowlist throws. It does not mean any name. Every `POST …/messages` body is prefixed with `[relay:claude-code]`.

The number in `VERSION` is the proposed `1.0.0`. It is not a git tag yet. Root `VERSION` stays on the v0 line. See [RELEASING.md](../RELEASING.md).

## Checks that do not call the API

```bash
cd relay-v1
npm ci
npm test
npx tsc --noEmit
./node_modules/.bin/agent-sdk validate --dir . --json
```

`npm test` parses session JSON and `delivery` of `accepted_temporal` or `duplicate` against a mock fetch. A delivery other than those two fails. No Cursor key is required.

## Later server trial

Run this on the server that already has the `grokbot` user's Cursor login. Do not put an API key on the command line. Do not use `/var/lib/grokbot/state` (that is the running v0 service). A new bot name on `ask` creates an empty bot. Use a name that already exists. Replace both copies of `YOUR_EXISTING_BOT`.

`whoami` only reads the local login. Stop if that account is not the bot account. The `ask` command sends a real message.

```bash
cd relay-v1
export PATH="/opt/grokbot-relay/node/bin:$PATH"   # Node 22+; this is the server's private runtime
npm ci
npm test
./node_modules/.bin/agent-sdk validate --dir . --json

sudo -u grokbot -H ./node_modules/.bin/agent-sdk whoami --json

sudo -u grokbot -H env GROKBOT_RELAY_AGENTS='YOUR_EXISTING_BOT' \
  ./node_modules/.bin/agent-sdk tool call grokbot__ask --dir . \
  --state-root /tmp/grokbot-relay-v1-trial \
  --input '{"agent":"YOUR_EXISTING_BOT","message":"v1 trial ping","wait_seconds":60}' \
  --json
```

The `grokbot` user is `nologin`. `-H` selects `/var/lib/grokbot`, where that login lives. The allowlist is read when the process starts (`GROKBOT_RELAY_AGENTS`, or `GROKBOT_RELAY_AGENTS_FILE`, or `/etc/grokbot-relay/agents.json`). An empty list refuses the call.

`status: "running"` means the turn is still going. Call `grokbot__check` with the same agent. There is no interrupt command.

This trial does not replace `/opt/grokbot-relay` or the systemd unit.
