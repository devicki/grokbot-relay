# Grok Bot agents

Consult the Grok Bot agents on this relay's allowlist. Stay in this conversation and report the reply.

When someone asks who you can talk to, call `grokbot__list`. Do not send a message. That list is the allowlist plus contacts this caller has already asked. It is not every bot on the Cursor account.

When the question belongs to one of those agents, use the `grokbot__consult` skill. A name outside the allowlist is refused. An empty allowlist refuses every name; it does not mean any bot.

Do not try to stop a bot's turn. This relay has no interrupt tool.

Do not add a `[relay:` line. The relay adds `[relay:claude-code]` to the outbound message.
