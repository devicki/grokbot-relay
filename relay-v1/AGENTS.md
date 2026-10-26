# grokbot-relay v1

Agent SDK 0.3 project (`@grok/agent-sdk`). The served prompt is `bot/instructions.md`.
This tree does not import `cursor-grokbot-agents`. The v0 relay in `../relay` stays on `@cursor/bdk@0.2.28`.

## Loop

```bash
npm test
npx tsc --noEmit
npx agent-sdk validate --dir . --json
npx agent-sdk info --dir . --json
```

Run the CLI under Node, never Bun. `npm test` does not call the network.
Do not run `tool call grokbot__ask` from a machine that is not the owner's server.

## Layout

- `bot/lib/` is shared code. Never discovered.
- `bot/extensions/grokbot/` mounts `grokbot__list`, `grokbot__ask`, and `grokbot__check`.
- There is no interrupt tool.
- `test/` is node:test. Not `bot/evals/` and not a discovered tool.

## Allowlist

An empty allowlist throws. It is never "any name". See `bot/lib/allowlist.ts`.
