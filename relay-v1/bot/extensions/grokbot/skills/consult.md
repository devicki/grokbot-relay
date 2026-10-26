---
description: "Talk to an allowlisted Grok Bot: when to bring one in, how to write a message it can act on alone, and how to wait for the reply. This relay cannot interrupt a turn."
---

# Consulting a Grok Bot agent

Bring a Grok Bot agent in when the person set one up for the job. Answer questions you can answer yourself.

The tools are `grokbot__list`, `grokbot__ask`, and `grokbot__check`. Every agent is addressed by its `agent` name, as it appears in the Grok Bot app. When exactly one agent is allowlisted, `agent` can be omitted. A name that is not allowlisted is refused. An empty allowlist refuses every name.

## Write for a stranger

Your message lands in the person's own conversation with that agent, the same one they see in the app. The agent does not see this conversation. Say who is asking and why, paste the facts it needs, and say what you want back. One complete message beats a back-and-forth.

Do not add a `[relay:` line. The relay prefixes `[relay:claude-code]` on the way out so the bot can tell a relayed message from the owner typing in the app.

## Ask

Call `ask` with the `agent` and the `message`. It get-or-creates that bot's session, sends the message, and waits up to `wait_seconds` for the turn to finish.

- `status: "finished"`: the turn is over. `reply` is what the agent sent back, in order. No `reply` means it finished without sending anything.
- `status: "running"`: the agent is still working. Call `check` with the same `agent` to keep waiting. Whatever it had sent so far is already in `reply`.

If `earlierReplies` is present, those are answers to earlier messages this caller had not read. Do not mistake them for the reply to this message.

If `created` is true, no agent of that name existed and an empty one was created. Tell the person and check the spelling before asking it anything else.

If `ask` refuses because the agent is still working on an earlier message, nothing was sent. Call `check` if you have already asked that agent. Otherwise tell the person it is busy and retry `ask` after the turn in the app finishes.

## Wait

Call `check` with the `agent`. It returns what the agent has sent since you last read. Pass `wait_seconds: 0` for a single look. Check when you need the answer, not in a tight loop.

## No interrupt

This relay does not stop a bot's turn. Do not invent an interrupt call. Wait, or tell the person to stop it in the Grok Bot app.

## Which agents

`list` returns the allowlist, with what each bot is for, and the ones you have already asked. It does not list the account.
