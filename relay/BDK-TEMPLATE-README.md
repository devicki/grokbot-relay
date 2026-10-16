# Grok Bot agents

Consults the Grok Bot agents you name. This agent stays in its own
conversation and reports the reply.

```bash
npx @cursor/bdk init ./grokbot --template grokbot-agents
```

`init` asks for the names shown in the Grok Bot app. Skip the prompt
with `--var agents="Plan Keeper, Chief of Staff"`.

## Run

```bash
bdk login
bdk validate
bdk dev
```

In the playground, ask it to consult one of the names you entered. A
name outside the list is refused.

## Edit

- `bot/extensions/grokbot.ts`: who it may talk to
- `bot/instructions.md`: when to consult them
