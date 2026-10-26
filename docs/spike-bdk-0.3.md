# Spike: grokbot-relay on Agent SDK 0.3

**Verdict: possible, as a separate line that calls the HTTP routes itself.**

The stock relay cannot load on `@cursor/bdk@0.3.0` or `@grok/agent-sdk@0.3.0`. The `cursor-grokbot-agents` extension, its tools, and `init --from grokbot` are gone. The four session routes that extension called on `https://api.cursor.com` were still mounted on 2026-10-26: unauthenticated requests returned **401**, and missing paths returned **404**.

This VM had no Cursor login, so an authenticated get-or-create or ask was not run here. `relay/package.json` stays pinned to `@cursor/bdk@0.2.28`.

**Update (owner's server, 2026-10-26).** Live `open-session` for the existing bot name `Herdrbot` succeeded under the `grokbot` system user: `ok: true`, `sessionId` `15100626`, `latestUpdatedSeq` present. Cursor login on that account works. That call did not send a message. Send, entry polling, the allowlist, and the `[relay:claude-code]` header are implemented in `relay-v1/`, not in this spike, and still need their own server trial.

## What was run

| Check | Result |
| --- | --- |
| `@cursor/bdk@0.2.27` exports | `./extensions/cursor-grokbot-agents` is still an export. This is the pin on `main`. |
| `@cursor/bdk@0.2.28` tarball | Extension, tools `ask` / `check` / `interrupt` / `list`, template `grokbot-agents`, and `dist/internal/convert-grokbot` are present. |
| `@cursor/bdk@0.2.29` and `@grok/agent-sdk@0.2.29` | No path contains `grokbot`. Changelog: the extension is removed and the package has no replacement. The two tarballs match except `package.json` `"name"`. |
| `@cursor/bdk@0.3.0` and `@grok/agent-sdk@0.3.0` | Same as each other except `package.json` `"name"`. Extensions on disk: `cursor-cloud-agents`, `improve`, `jev`, `slack-communication`. |
| `agent-sdk init --from grokbot --dry-run --json` on both 0.3.0 packages | Exit 2, `{"error":{"code":"usage","message":"Grok Bot import was removed."}}`. No directory created. |
| Stock `relay/` copied to `/tmp` and installed with `@cursor/bdk@0.3.0` | `import "@cursor/bdk/extensions/cursor-grokbot-agents"` throws `ERR_PACKAGE_PATH_NOT_EXPORTED`. `bdk validate --json` exits 1 with `module_load_failed` on `bot/extensions/grokbot/extension.ts`. `dist/extensions/cursor-grokbot-agents/tools/ask.js` is absent, so the sender-header overlay has nothing to wrap. |
| `spike/bdk-0-3` on `@grok/agent-sdk@0.3.0` | `tsc --noEmit` passes. `agent-sdk validate --json` returns `ok: true` for slug `bdk-0-3`. |
| `agent-sdk tool call self-check` | `result.ok: true`. Mock `POST /v0/grokbot/sessions` response parsed to a session. No network. |
| `agent-sdk tool call routes` | The four session routes on `api.cursor.com` returned 401. `GET /v0/grokbot`, `GET /v0/grokbot/agents`, and `GET https://api2.cursor.sh/v0/grokbot/sessions` returned 404. |
| `agent-sdk tool call open-session` with no `GROKBOT_SPIKE_CONFIRM` | Returns `refused: true` in 2ms. It does not call the API. |
| `agent-sdk whoami --json` with no key and no login file | Exit 1, `{"error":{"code":"failed","message":"Not signed in to Cursor. ..."}}`. |
| `cursorAgentTemplate: "grokbot-agents"` on an otherwise valid 0.3 project | `validate` still returns `ok: true`. `readDeployTemplate` drops names outside the 0.3 template list. |

`@grok/agent-sdk@0.2.28` still contains `cursor-grokbot-agents`, and it is a different build from `@cursor/bdk@0.2.28` (510 files differ, and the `@cursor/bdk` tarball is the one that also carries the grokbot template and the import converter). From 0.2.29 upward the two package names are the same bits. Both 0.3.0 CLIs print `"name": "@grok/agent-sdk"` from `version --json`. The installed `@cursor/bdk@0.3.0` `package.json` name is still `@cursor/bdk`.

Public docs at `https://cursor.com/docs/agent-sdk/guides/grokbot-agents` still show `import cursorGrokBotAgents from "@grok/agent-sdk/extensions/cursor-grokbot-agents"`. That page disagrees with the 0.2.29 changelog and with the 0.3.0 tarball. The tarball is the contract used here.

## Relay dependencies on Grok Bot BDK APIs

These are the production couplings. The 0.2.27 pin still satisfies them. 0.3.0 does not.

| Site | Coupling | On 0.3.0 |
| --- | --- | --- |
| `relay/package.json` | `"@cursor/bdk": "0.2.27"` | A 0.3 install resolves, then project load fails. |
| `relay/package.json` | `"cursorAgentTemplate": "grokbot-agents"` | Ignored by deploy-template selection. Validate of a stamped 0.3 project still passed. |
| `relay/bot/extensions/grokbot/extension.ts` | `import cursorGrokBotAgents from "@cursor/bdk/extensions/cursor-grokbot-agents"` | Subpath is not exported. This is the validate error. |
| same file | `cursorGrokBotAgents({ agents })` allowlist. Empty list is never passed, because the 0.2.28 extension treats an empty list as "any name". | Factory is gone with the extension. |
| `relay/bot/extensions/grokbot/tools/ask.ts` | File import of `dist/extensions/cursor-grokbot-agents/tools/ask.js`, then prepends `[relay:claude-code]`. | File is absent. `header_check` in `bin/grokbot-relay` would park this overlay. |
| `relay/bot/extensions/grokbot/tools/interrupt.ts` | `disableTool()` from `@cursor/bdk/extensions` | `disableTool` is still exported. The tool it disables is not. |
| `relay/bot/instructions.md`, `relay/evals/grokbot-agents.eval.ts` | Tool names `grokbot__list`, `grokbot__ask`, `grokbot__interrupt` | Those contributions are not in the package. |
| `relay/bot/agent.ts`, `relay/evals/evals.config.ts` | `defineAgent`, `defineEval`, `defineEvalConfig` | Still exported from 0.3.0 (`defineAgent` from the package root, evals from `./evals`). |
| `deploy/grokbot-relay.service` | `bdk serve --dir . --host 127.0.0.1 --port … --mode single --state-root … --bearer-token … --no-playground` | `agent-sdk help serve --json` still lists every one of those flags. Default host is still `127.0.0.1`. `--mode single` still mounts `/v1/*`. |
| `bin/grokbot-relay` `login` / `doctor` | `bdk login`, `bdk login --api-key`, `bdk whoami` | `login` still has `--api-key` and `--key-name`. `whoami --json` works and reports signed-out as exit 1. |
| `connect-claude` | `bdk mcp --url … --bearer-token …` | Bare `mcp` is a silent alias of `mcp serve` (`aliases: [{ name: "mcp", silent: true }]`). `--url` and `--bearer-token` remain. |
| README `mcp install` | `--name`, `--bearer-token`, `--print` | `--name` and `--bearer-token` remain. `--print` is a hidden alias of `--dry-run` (`printAliasFlag`). |
| `npm run dev` | `bdk dev` | `dev` is still `serve --dev`. |
| `fetch_account_bots` in `bin/grokbot-relay` | Comment: account list is unavailable; only `/v0/grokbot` session routes exist | Still true. `GET /v0/grokbot/agents` is 404. |

`bdk-upgrade` runs `npm install @cursor/bdk@latest`, then `bdk validate`, and rolls back when validate fails. Latest on 2026-10-26 is `0.3.0`. On the current tree that validate fails, so the script's own rollback path should restore `0.2.27` and `header_check` should put `ask.ts` back once `ask.js` exists again. That path was read from `bin/grokbot-relay` and was not executed (it needs the systemd install). `--pin` writes into the source clone only after validate passes, so a failed 0.3 upgrade does not rewrite the pin by itself.

## CLI surface that still exists

From `agent-sdk help --json` on `@grok/agent-sdk@0.3.0` (the `@cursor/bdk@0.3.0` binary is the same file):

`serve`, `dev`, `validate`, `info`, `login`, `whoami`, `mcp serve` (alias `mcp`), `mcp install`, `tool call`, `run`, `eval` are present. `init` remains, and its help text says `--from grokbot:…` and `--from-grokbot` fail because Grok Bot import was removed.

`defineAgent` runtime in `dist/types.d.ts` is `"local" | "cloud"`. The 0.2.x `"grokbot"` runtime is not in that union. Migrate docs still treat `runtime: "grokbot"` as a legacy marker to move off. A comment on `agentName` still mentions Grok Bot turns; there is no client next to that comment.

`cursor-cloud-agents` is a different extension (`cloud__launch`, `cloud__get`, `cloud__reply`, `cloud__list`, …) for Cursor cloud coding agents on repositories. It does not speak to named Grok Bot agents.

## Replacement for the owner's Grok Bot agents

**Observed, and used by the spike.** `@grok/agent-sdk@0.3.0` exports `cursorExternalApiUrl` and `resolveApiKeySync` from the package root. `cursorExternalApiUrl()` defaults to `https://api.cursor.com` (`CURSOR_API_BASE_URL` overrides it). The 0.2.28 client in `dist/extensions/cursor-grokbot-agents/lib/backend.js` called:

| Method | Path | Unauthenticated status on 2026-10-26 |
| --- | --- | --- |
| `POST` | `/v0/grokbot/sessions` body `{ name }` | 401 `Invalid User API Key` |
| `POST` | `/v0/grokbot/sessions/:id/messages` body `{ text, messageId }` | 401 |
| `GET` | `/v0/grokbot/sessions/:id/entries?afterUpdatedSeq=` | 401 |
| `POST` | `/v0/grokbot/sessions/:id/interrupt` body `{ reason }` | 401 |

Auth header in that client is `Authorization: Bearer <user API key>` plus `x-cursor-client-type: agent-serve`. The key comes from `resolveApiKeySync`: explicit option, then `CURSOR_API_KEY`, `CURSOR_API_KEY_FILE`, `CURSOR_SERVICE_ACCOUNT_KEY`, then `agent-sdk login`. Session JSON fields the 0.2.28 schema required: `id`, `name`, `createdAtMs`, `latestUpdatedSeq`. Send JSON required `delivery` of `accepted_temporal` or `duplicate`.

`POST /v0/grokbot/sessions` is get-or-create. The 0.2.28 extension comment says a missing name creates an agent on the account. The spike refuses to call it unless `GROKBOT_SPIKE_CONFIRM=1`.

**Not a list API.** `grokbot__list` in 0.2.28 returns the configured allowlist plus contacts already stored for that caller. It does not enumerate the account. `GET /v0/grokbot/agents` is 404.

**Hypothesis, not used.** `GET https://api.cursor.com/v0/agents` also returned 401. The 0.2.28 Grok Bot client never calls that path. It may belong to another product. This spike does not treat it as a bot list.

**No in-package replacement.** 0.2.29 changelog sentence: `@grok/agent-sdk/extensions/cursor-grokbot-agents` is removed, and the package has no replacement. 0.3.0's shorter changelog does not repeat that sentence; the files are still absent, and `scaffold.js` still throws `Grok Bot import was removed.`

## Spike

Code lives in `spike/bdk-0-3/`. The directory name avoids a dot because 0.3 rejects a mount slug that fails `/^[A-Za-z0-9][A-Za-z0-9_-]*$/` (`bdk-0.3` failed validate with that error).

- `bot/lib/grokbot-http.ts` probes the routes with no key, and can `POST /v0/grokbot/sessions` when a key is supplied.
- `routes` records the live status codes above.
- `self-check` parses a fake session response and checks that the bearer token is a header.
- `open-session` is the authenticated hop. It stays inert unless `GROKBOT_SPIKE_CONFIRM=1`.

Message send, entry polling, and interrupt are not implemented in this spike. The production allowlist, sender header, and interrupt-disabled behavior are not ported here. They are implemented in `relay-v1/`. Wiring that tree into `bin/grokbot-relay` or the systemd unit is still later work. The unit keeps serving `relay/`.

### Commands already run here

```bash
cd spike/bdk-0-3
npm ci
npx tsc --noEmit
npx agent-sdk validate --dir . --json
npx agent-sdk tool call self-check --dir . --state-root /tmp/spike-bdk-state --json
npx agent-sdk tool call routes --dir . --state-root /tmp/spike-bdk-state --json
npx agent-sdk tool call open-session --dir . --state-root /tmp/spike-bdk-state \
  --input '{"name":"Example"}' --json
```

The last command refused, which is what we want on a machine with no login.

### Commands for a machine that has the owner's Cursor account

Do this on the server that should talk to those bots. A new name on `open-session` creates an empty bot. Use a name copied from the Grok Bot app.

```bash
cd spike/bdk-0-3
npm ci
npx agent-sdk login          # prints a URL; the key stays off argv
npx agent-sdk whoami --json  # stop if this is not the bot account

export GROKBOT_SPIKE_CONFIRM=1
npx agent-sdk tool call open-session --dir . \
  --input '{"name":"YOUR_EXISTING_BOT"}' --json
unset GROKBOT_SPIKE_CONFIRM
```

A successful result has `ok: true`, `sessionId`, `name`, `createdAtMs`, and `latestUpdatedSeq`. That is the get-or-create hop, not a full ask. A full ask still needs `POST …/messages` and `GET …/entries` with the same bearer token, using a fresh `messageId` per send, and it must treat `delivery` other than `accepted_temporal` or `duplicate` as failure. Those two calls are deliberately not in this spike, so a trial here cannot post into a bot conversation.

There is still no account-wide list command to run.

## Shipping beside the 0.2.28 line

Keep `main` on the current pin. `@cursor/bdk@0.2.28` is the last release whose tarball still contains `cursor-grokbot-agents`. `0.2.29` is the break. This repo's pin is `0.2.28`, which still exports the extension; this spike does not move it. Rows above that still say `0.2.27` are the couplings as first read; `0.8.2` set the pin to `0.2.28` before this v1 tree.

The live `open-session` command above succeeded on the owner's account (see the update at the top). The second line is `relay-v1/`. It is not what `bin/grokbot-relay` installs.

- **v0.x** stays this tree: `@cursor/bdk` at `0.2.28`. `bdk-upgrade` should refuse anything above `0.2.28` before it runs `npm install`. That guard is not in this branch.
- **v1.x** is `relay-v1/`. Its dependency is `@grok/agent-sdk@0.3.0` (same code as `@cursor/bdk@0.3.x`). It mounts its own tools over `bot/lib/grokbot-http.ts`, keeps the allowlist and the `[relay:claude-code]` header in front of `POST …/messages`, and keeps interrupt disabled. It does not import `cursor-grokbot-agents`. Proposed version `1.0.0` in `relay-v1/VERSION` is not tagged yet.
- Install is already git plus `/opt`, so a second npm package name is optional. A major version tag, or a long-lived `release/0.2` branch with `main` moving only when v1 is proven, is enough. The install script should check out an explicit tag. It should not track npm `latest`.
- `connect-claude` can keep calling `bdk mcp --url --bearer-token` on 0.3, because bare `mcp` is still the stdio proxy. The unit's `bdk serve` flags listed above still match `help serve`.

## Risks

- The 0.3 package says the extension has no replacement. The routes answering 401 is behavior observed on one day, not a documented SDK API. They can be removed without an SDK minor bump.
- `POST /v0/grokbot/sessions` creates a bot when the name is new. The production relay already warns about that.
- Callers still share one Cursor account and one bot memory, same as today.
- `bdk-check` will report `0.3.0` as newer than `0.2.27` and invite `bdk-upgrade`. The upgrade should roll back after validate fails. Until a ceiling exists, that command is a large download and a service-restart attempt, and it is the wrong way to reach this spike.
- Website guides that still import `cursor-grokbot-agents` will mislead a port that trusts docs over the tarball.
- `open-session` on a logged-in host is a write. Leave `GROKBOT_SPIKE_CONFIRM` unset except for that one command.
- Proving ask, the sender header, allowlist refusal, and MCP-through-`serve` on the live account still needs the owner's login and an existing bot. `relay-v1/` covers those in unit tests with a mock fetch. The server trial is in the root README. This spike does not start `serve`.
