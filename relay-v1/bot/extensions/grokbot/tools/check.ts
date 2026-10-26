import { defineTool } from "@grok/agent-sdk";
import * as z from "zod/v4";
import { requireAllowlist } from "../../../lib/allowlist.js";
import { contactHostFrom } from "../../../lib/contacts.js";
import { checkAgent, DEFAULT_WAIT_SECONDS, MAX_WAIT_SECONDS } from "../../../lib/conversation.js";
import { productionBackend } from "../../../lib/grokbot-http.js";
import { grokbotExtension } from "../extension.js";

const agentName = z
  .string()
  .max(255)
  .optional()
  .describe(
    "The Grok Bot agent's name, as shown in the Grok Bot app. Must be on the allowlist and already asked. Optional when exactly one bot is allowlisted.",
  );

const waitSeconds = z
  .number()
  .int()
  .min(0)
  .max(MAX_WAIT_SECONDS)
  .default(DEFAULT_WAIT_SECONDS)
  .describe(
    `How long to wait for the reply before returning status "running" (default ${DEFAULT_WAIT_SECONDS}, max ${MAX_WAIT_SECONDS}). 0 returns after one look.`,
  );

export default defineTool({
  description:
    'Wait for, or poll, the reply of a Grok Bot agent you already asked: everything it has sent since you last read, and whether it is still working. Returns status "running" to keep waiting. Pass wait_seconds 0 for a single look. Does not create a bot and does not send a message.',
  effect: "write",
  inputSchema: z.object({
    agent: agentName,
    wait_seconds: waitSeconds,
  }),
  async execute(input, ctx) {
    const agents = requireAllowlist(grokbotExtension.config.agents);
    return checkAgent(
      { agent: input.agent, waitSeconds: input.wait_seconds },
      { backend: productionBackend(), agents, host: contactHostFrom(ctx) },
    );
  },
});
